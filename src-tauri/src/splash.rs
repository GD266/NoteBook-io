//! A tiny static native splash window drawn with GDI.
//!
//! It is created before Tauri starts so there is something on screen while
//! WebView2 is still initializing. It has no animation: the app dismisses it as
//! soon as the first real frame is ready.

#![cfg(windows)]

use std::sync::atomic::{AtomicIsize, Ordering};
use std::time::Duration;

use tauri::Manager;
use windows_sys::core::PCWSTR;
use windows_sys::Win32::Foundation::{
    CloseHandle, COLORREF, HWND, LPARAM, LRESULT, RECT, SIZE, WPARAM,
};
use windows_sys::Win32::Graphics::Gdi::{
    BeginPaint, BitBlt, CreateCompatibleBitmap, CreateCompatibleDC, CreateFontW, CreatePen,
    CreateRoundRectRgn, CreateSolidBrush, DeleteDC, DeleteObject, EndPaint, FillRect, FrameRect,
    GetStockObject, GetTextExtentPoint32W, RoundRect, SelectObject, SetBkMode,
    SetTextCharacterExtra, SetTextColor, SetWindowRgn, TextOutW, UpdateWindow, CLEARTYPE_QUALITY,
    CLIP_DEFAULT_PRECIS, DEFAULT_CHARSET, DEFAULT_PITCH, FW_NORMAL, HDC, HFONT, HGDIOBJ,
    NULL_BRUSH, OUT_DEFAULT_PRECIS, PAINTSTRUCT, PS_SOLID, SRCCOPY, TRANSPARENT,
};
use windows_sys::Win32::System::LibraryLoader::GetModuleHandleW;
use windows_sys::Win32::System::Threading::OpenMutexW;
use windows_sys::Win32::UI::HiDpi::{
    GetDpiForSystem, GetDpiForWindow, SetProcessDpiAwarenessContext,
    DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2,
};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    CreateWindowExW, DefWindowProcW, DestroyWindow, DispatchMessageW, GetClientRect, GetMessageW,
    GetSystemMetrics, IsWindow, LoadCursorW, PostMessageW, PostQuitMessage, RegisterClassW,
    SetForegroundWindow, SetLayeredWindowAttributes, ShowWindow, TranslateMessage, CS_DROPSHADOW,
    CS_HREDRAW, CS_VREDRAW, IDC_ARROW, LWA_ALPHA, MSG, SM_CXSCREEN, SM_CYSCREEN, SW_SHOW, WM_CLOSE,
    WM_DESTROY, WM_ERASEBKGND, WM_PAINT, WNDCLASSW, WS_EX_LAYERED, WS_EX_TOOLWINDOW,
    WS_EX_TOPMOST, WS_POPUP,
};

const LOGICAL_WIDTH: i32 = 220;
const LOGICAL_HEIGHT: i32 = 56;

static SPLASH_HWND: AtomicIsize = AtomicIsize::new(0);

const fn rgb(r: u8, g: u8, b: u8) -> COLORREF {
    (r as u32) | ((g as u32) << 8) | ((b as u32) << 16)
}

/// The single-instance plugin owns this mutex. Opening it without creating it
/// lets a second launch skip the splash before the plugin forwards the file and
/// exits.
pub fn instance_already_running() -> bool {
    unsafe {
        let handle = OpenMutexW(
            0x0010_0000, // SYNCHRONIZE
            0,
            windows_sys::w!("io.notebook.desktop-sim"),
        );
        if handle.is_null() {
            false
        } else {
            CloseHandle(handle);
            true
        }
    }
}

/// Creates and shows the native splash. Returns false when Windows refuses to
/// create the window; the caller then falls back to showing the main window.
pub fn show() -> bool {
    unsafe {
        // Tauri would normally do this later, but the splash has to exist before
        // Tauri's event loop starts. Setting it first also keeps the splash sharp
        // on high-DPI displays.
        let _ = SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
    }

    let (sender, receiver) = std::sync::mpsc::channel();
    let thread = std::thread::Builder::new()
        .name("notebook-splash".into())
        .spawn(move || {
            let created = unsafe { create_splash_window() };
            let _ = sender.send(created);
            if created {
                unsafe { run_message_loop() };
            }
        });

    if thread.is_err() {
        return false;
    }

    receiver.recv().unwrap_or(false)
}

unsafe fn create_splash_window() -> bool {
    let hinstance = GetModuleHandleW(std::ptr::null());
    if hinstance.is_null() {
        return false;
    }

    let class_name = windows_sys::w!("NotebookIoSplash");
    let window_class = WNDCLASSW {
        style: CS_HREDRAW | CS_VREDRAW | CS_DROPSHADOW,
        lpfnWndProc: Some(window_proc),
        cbClsExtra: 0,
        cbWndExtra: 0,
        hInstance: hinstance,
        hIcon: std::ptr::null_mut(),
        hCursor: LoadCursorW(std::ptr::null_mut(), IDC_ARROW),
        hbrBackground: std::ptr::null_mut(),
        lpszMenuName: std::ptr::null(),
        lpszClassName: class_name,
    };
    // If the class already exists, CreateWindowExW will reuse it.
    RegisterClassW(&window_class);

    let dpi = GetDpiForSystem().max(96);
    let scale = dpi as f32 / 96.0;
    let width = (LOGICAL_WIDTH as f32 * scale).round() as i32;
    let height = (LOGICAL_HEIGHT as f32 * scale).round() as i32;
    let screen_width = GetSystemMetrics(SM_CXSCREEN);
    let screen_height = GetSystemMetrics(SM_CYSCREEN);
    let x = (screen_width - width) / 2;
    let y = (screen_height - height) / 2;

    let hwnd = CreateWindowExW(
        WS_EX_LAYERED | WS_EX_TOOLWINDOW | WS_EX_TOPMOST,
        class_name,
        windows_sys::w!("Notebook.io"),
        WS_POPUP,
        x,
        y,
        width,
        height,
        std::ptr::null_mut(),
        std::ptr::null_mut(),
        hinstance,
        std::ptr::null(),
    );
    if hwnd.is_null() {
        return false;
    }

    let radius = (16.0 * scale).round() as i32;
    let region = CreateRoundRectRgn(0, 0, width + 1, height + 1, radius, radius);
    if !region.is_null() && SetWindowRgn(hwnd, region, 1) == 0 {
        DeleteObject(region as HGDIOBJ);
    }

    SPLASH_HWND.store(hwnd as isize, Ordering::SeqCst);
    SetLayeredWindowAttributes(hwnd, 0, 255, LWA_ALPHA);
    ShowWindow(hwnd, SW_SHOW);
    SetForegroundWindow(hwnd);
    UpdateWindow(hwnd);
    true
}

unsafe fn run_message_loop() {
    let mut message: MSG = std::mem::zeroed();
    while GetMessageW(&mut message, std::ptr::null_mut(), 0, 0) > 0 {
        TranslateMessage(&message);
        DispatchMessageW(&message);
    }
}

/// Dismisses the splash immediately. Safe to call before the window exists.
pub fn close() {
    let hwnd = SPLASH_HWND.load(Ordering::SeqCst) as HWND;
    if !hwnd.is_null() {
        unsafe {
            PostMessageW(hwnd, WM_CLOSE, 0, 0);
        }
    }
}

pub fn is_open() -> bool {
    let hwnd = SPLASH_HWND.load(Ordering::SeqCst) as HWND;
    !hwnd.is_null() && unsafe { IsWindow(hwnd) != 0 }
}

/// Keep the splash above the main window while the app finishes loading.
pub fn focus() {
    let hwnd = SPLASH_HWND.load(Ordering::SeqCst) as HWND;
    if !hwnd.is_null() {
        unsafe {
            SetForegroundWindow(hwnd);
        }
    }
}

/// If the web app never reports ready, do not leave the user with only a
/// splash. This is a last-resort fallback, not part of normal startup.
pub fn watchdog(app: tauri::AppHandle) {
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_secs(8));
        if !is_open() {
            return;
        }
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.show();
            let _ = window.set_focus();
        }
        close();
    });
}

unsafe extern "system" fn window_proc(
    hwnd: HWND,
    message: u32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    match message {
        WM_PAINT => {
            let mut paint: PAINTSTRUCT = std::mem::zeroed();
            let hdc = BeginPaint(hwnd, &mut paint);
            paint_splash(hwnd, hdc);
            EndPaint(hwnd, &paint);
            0
        }
        WM_ERASEBKGND => 1,
        WM_CLOSE => {
            DestroyWindow(hwnd);
            0
        }
        WM_DESTROY => {
            SPLASH_HWND.store(0, Ordering::SeqCst);
            // This window lives on its own thread, so quitting here only ends
            // the splash message loop.
            PostQuitMessage(0);
            0
        }
        _ => DefWindowProcW(hwnd, message, wparam, lparam),
    }
}

unsafe fn paint_splash(hwnd: HWND, hdc: HDC) {
    let mut client = RECT {
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
    };
    GetClientRect(hwnd, &mut client);
    let width = client.right - client.left;
    let height = client.bottom - client.top;
    if width <= 0 || height <= 0 {
        return;
    }

    // Double buffer the tiny card so the static paint is crisp.
    let memory = CreateCompatibleDC(hdc);
    let bitmap = CreateCompatibleBitmap(hdc, width, height);
    let previous = SelectObject(memory, bitmap as HGDIOBJ);

    let background = CreateSolidBrush(rgb(11, 11, 13));
    FillRect(memory, &client, background);
    DeleteObject(background as HGDIOBJ);

    let border = CreateSolidBrush(rgb(37, 37, 42));
    FrameRect(memory, &client, border);
    DeleteObject(border as HGDIOBJ);

    let dpi = GetDpiForWindow(hwnd).max(96);
    let scale = dpi as f32 / 96.0;
    let tile_size = (24.0 * scale).round() as i32;
    let gap = (11.0 * scale).round() as i32;
    let tile_radius = (7.0 * scale).round() as i32;

    let title_font = make_font(13.0, scale, 600, windows_sys::w!("Segoe UI"));
    let caption_font = make_font(8.0, scale, FW_NORMAL as i32, windows_sys::w!("Segoe UI"));

    let title = "Notebook";
    let suffix = ".io";
    let title_width = measure_text(memory, title_font, title);
    let suffix_width = measure_text(memory, title_font, suffix);
    let group_width = tile_size + gap + title_width + suffix_width;
    let tile_x = (width - group_width) / 2;
    let tile_y = (height - tile_size) / 2;
    let text_x = tile_x + tile_size + gap;

    let tile_brush = CreateSolidBrush(rgb(241, 238, 230));
    let tile_pen = CreatePen(PS_SOLID, (1.0 * scale).max(1.0) as i32, rgb(58, 58, 62));
    let old_brush = SelectObject(memory, tile_brush as HGDIOBJ);
    let old_pen = SelectObject(memory, tile_pen as HGDIOBJ);
    RoundRect(
        memory,
        tile_x,
        tile_y,
        tile_x + tile_size,
        tile_y + tile_size,
        tile_radius,
        tile_radius,
    );
    SelectObject(memory, old_brush);
    SelectObject(memory, old_pen);
    DeleteObject(tile_brush as HGDIOBJ);
    DeleteObject(tile_pen as HGDIOBJ);

    draw_book_mark(memory, tile_x, tile_y, tile_size, scale);

    let title_y = (13.0 * scale).round() as i32;
    draw_text(
        memory,
        title_font,
        rgb(244, 242, 236),
        title,
        text_x,
        title_y,
    );
    draw_text(
        memory,
        title_font,
        rgb(133, 133, 139),
        suffix,
        text_x + title_width,
        title_y,
    );

    draw_text_spaced(
        memory,
        caption_font,
        rgb(133, 133, 139),
        "OPENING",
        text_x,
        (31.0 * scale).round() as i32,
        (1.1 * scale).round() as i32,
    );

    BitBlt(hdc, 0, 0, width, height, memory, 0, 0, SRCCOPY);
    SelectObject(memory, previous);
    DeleteObject(bitmap as HGDIOBJ);
    DeleteDC(memory);
    DeleteObject(title_font as HGDIOBJ);
    DeleteObject(caption_font as HGDIOBJ);
}

unsafe fn draw_book_mark(hdc: HDC, tile_x: i32, tile_y: i32, tile_size: i32, scale: f32) {
    let pad = (5.0 * scale).round() as i32;
    let left = tile_x + pad;
    let top = tile_y + pad;
    let right = tile_x + tile_size - pad;
    let bottom = tile_y + tile_size - pad;

    let pen = CreatePen(PS_SOLID, (1.2 * scale).max(1.0) as i32, rgb(23, 23, 21));
    let old_pen = SelectObject(hdc, pen as HGDIOBJ);
    let old_brush = SelectObject(hdc, GetStockObject(NULL_BRUSH));
    RoundRect(
        hdc,
        left,
        top,
        right,
        bottom,
        (3.0 * scale).round() as i32,
        (3.0 * scale).round() as i32,
    );
    SelectObject(hdc, old_brush);
    SelectObject(hdc, old_pen);
    DeleteObject(pen as HGDIOBJ);

    let ink = CreateSolidBrush(rgb(23, 23, 21));
    let spine = RECT {
        left: left + (2.0 * scale).round() as i32,
        top: top + (3.0 * scale).round() as i32,
        right: left + (3.0 * scale).round() as i32,
        bottom: bottom - (3.0 * scale).round() as i32,
    };
    FillRect(hdc, &spine, ink);

    for offset in [5.0, 8.0, 11.0] {
        let line = RECT {
            left: left + (6.0 * scale).round() as i32,
            top: top + (offset * scale).round() as i32,
            right: right - (3.0 * scale).round() as i32,
            bottom: top + (offset * scale).round() as i32 + (1.0 * scale).max(1.0) as i32,
        };
        FillRect(hdc, &line, ink);
    }
    DeleteObject(ink as HGDIOBJ);
}

unsafe fn make_font(size: f32, scale: f32, weight: i32, face: PCWSTR) -> HFONT {
    CreateFontW(
        -(size * scale).round() as i32,
        0,
        0,
        0,
        weight,
        0,
        0,
        0,
        DEFAULT_CHARSET as u32,
        OUT_DEFAULT_PRECIS as u32,
        CLIP_DEFAULT_PRECIS as u32,
        CLEARTYPE_QUALITY as u32,
        DEFAULT_PITCH as u32,
        face,
    )
}

unsafe fn measure_text(hdc: HDC, font: HFONT, text: &str) -> i32 {
    let old = SelectObject(hdc, font as HGDIOBJ);
    let wide: Vec<u16> = text.encode_utf16().collect();
    let mut size = SIZE { cx: 0, cy: 0 };
    GetTextExtentPoint32W(hdc, wide.as_ptr(), wide.len() as i32, &mut size);
    SelectObject(hdc, old);
    size.cx
}

unsafe fn draw_text(hdc: HDC, font: HFONT, color: COLORREF, text: &str, x: i32, y: i32) {
    let old = SelectObject(hdc, font as HGDIOBJ);
    SetBkMode(hdc, TRANSPARENT as i32);
    SetTextColor(hdc, color);
    let wide: Vec<u16> = text.encode_utf16().collect();
    TextOutW(hdc, x, y, wide.as_ptr(), wide.len() as i32);
    SelectObject(hdc, old);
}

unsafe fn draw_text_spaced(
    hdc: HDC,
    font: HFONT,
    color: COLORREF,
    text: &str,
    x: i32,
    y: i32,
    extra: i32,
) {
    let old = SelectObject(hdc, font as HGDIOBJ);
    SetBkMode(hdc, TRANSPARENT as i32);
    SetTextColor(hdc, color);
    SetTextCharacterExtra(hdc, extra);
    let wide: Vec<u16> = text.encode_utf16().collect();
    TextOutW(hdc, x, y, wide.as_ptr(), wide.len() as i32);
    SetTextCharacterExtra(hdc, 0);
    SelectObject(hdc, old);
}
