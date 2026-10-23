//! A tiny native splash window drawn with GDI.
//!
//! It is created before Tauri starts so there is something on screen while
//! WebView2 is still initializing. The main window stays hidden until the web
//! app calls `finish_startup`, then this window fades away.

#![cfg(windows)]

use std::sync::atomic::{AtomicBool, AtomicIsize, Ordering};
use std::sync::OnceLock;
use std::time::{Duration, Instant};

use tauri::Manager;
use windows_sys::core::PCWSTR;
use windows_sys::Win32::Foundation::{COLORREF, HWND, LPARAM, LRESULT, RECT, SIZE, WPARAM};
use windows_sys::Win32::Graphics::Gdi::{
    BeginPaint, BitBlt, CreateCompatibleBitmap, CreateCompatibleDC, CreateFontW, CreatePen,
    CreateRoundRectRgn, CreateSolidBrush, DeleteDC, DeleteObject, DrawTextW, EndPaint, FillRect,
    FrameRect, GetStockObject, GetTextExtentPoint32W, InvalidateRect, RoundRect, SelectObject,
    SetBkMode, SetTextCharacterExtra, SetTextColor, SetWindowRgn, TextOutW, UpdateWindow,
    CLEARTYPE_QUALITY, CLIP_DEFAULT_PRECIS, DEFAULT_CHARSET, DEFAULT_PITCH, DT_CENTER,
    DT_SINGLELINE, DT_VCENTER, FW_NORMAL, HDC, HFONT, HGDIOBJ, NULL_BRUSH, OUT_DEFAULT_PRECIS,
    PAINTSTRUCT, PS_SOLID, SRCCOPY, TRANSPARENT,
};
use windows_sys::Win32::System::LibraryLoader::GetModuleHandleW;
use windows_sys::Win32::UI::HiDpi::{
    GetDpiForSystem, GetDpiForWindow, SetProcessDpiAwarenessContext,
    DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2,
};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    CreateWindowExW, DefWindowProcW, DestroyWindow, DispatchMessageW, GetClientRect, GetMessageW,
    GetSystemMetrics, IsWindow, LoadCursorW, PostMessageW, PostQuitMessage, RegisterClassW,
    SetLayeredWindowAttributes, SetTimer, ShowWindow, TranslateMessage, CS_DROPSHADOW, CS_HREDRAW,
    CS_VREDRAW, IDC_ARROW, LWA_ALPHA, MSG, SM_CXSCREEN, SM_CYSCREEN, SW_SHOWNOACTIVATE, WM_CLOSE,
    WM_DESTROY, WM_ERASEBKGND, WM_PAINT, WM_TIMER, WNDCLASSW, WS_EX_LAYERED, WS_EX_TOOLWINDOW,
    WS_EX_TOPMOST, WS_POPUP,
};

const LOGICAL_WIDTH: i32 = 520;
const LOGICAL_HEIGHT: i32 = 300;
const MIN_VISIBLE: Duration = Duration::from_millis(520);
const FADE_IN: Duration = Duration::from_millis(180);
const FADE_OUT: Duration = Duration::from_millis(180);
const PROGRESS_MS: f32 = 900.0;
const WM_CLOSE_SPLASH: u32 = 0x8000 + 1;

static SPLASH_HWND: AtomicIsize = AtomicIsize::new(0);
static CLOSING: AtomicBool = AtomicBool::new(false);
static START: OnceLock<Instant> = OnceLock::new();
static CLOSE_START: OnceLock<Instant> = OnceLock::new();

const fn rgb(r: u8, g: u8, b: u8) -> COLORREF {
    (r as u32) | ((g as u32) << 8) | ((b as u32) << 16)
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

    // Wait until the window exists and has been shown. The splash thread then
    // owns its own message loop, so its fade-in runs while WebView2 starts.
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
    let y = (screen_height - height) / 2 - (18.0 * scale).round() as i32;

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

    let radius = (28.0 * scale).round() as i32;
    let region = CreateRoundRectRgn(0, 0, width + 1, height + 1, radius, radius);
    if !region.is_null() && SetWindowRgn(hwnd, region, 1) == 0 {
        DeleteObject(region as HGDIOBJ);
    }

    SPLASH_HWND.store(hwnd as isize, Ordering::SeqCst);
    START.get_or_init(Instant::now);
    SetLayeredWindowAttributes(hwnd, 0, 0, LWA_ALPHA);
    ShowWindow(hwnd, SW_SHOWNOACTIVATE);
    UpdateWindow(hwnd);
    SetTimer(hwnd, 1, 16, None);
    true
}

unsafe fn run_message_loop() {
    let mut message: MSG = std::mem::zeroed();
    while GetMessageW(&mut message, std::ptr::null_mut(), 0, 0) > 0 {
        TranslateMessage(&message);
        DispatchMessageW(&message);
    }
}

/// Asks the splash to fade out. Safe to call before the window exists.
pub fn close() {
    let hwnd = SPLASH_HWND.load(Ordering::SeqCst) as HWND;
    if !hwnd.is_null() {
        unsafe {
            PostMessageW(hwnd, WM_CLOSE_SPLASH, 0, 0);
        }
    }
}

pub fn is_open() -> bool {
    let hwnd = SPLASH_HWND.load(Ordering::SeqCst) as HWND;
    !hwnd.is_null() && unsafe { IsWindow(hwnd) != 0 }
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

fn request_close() {
    if !CLOSING.swap(true, Ordering::SeqCst) {
        CLOSE_START.get_or_init(Instant::now);
    }
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
        WM_TIMER => {
            animate(hwnd);
            0
        }
        WM_CLOSE_SPLASH | WM_CLOSE => {
            request_close();
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

unsafe fn animate(hwnd: HWND) {
    let start = START.get_or_init(Instant::now);
    let now = Instant::now();
    let elapsed = now.saturating_duration_since(*start);
    let fade_in = (elapsed.as_millis() * 255 / FADE_IN.as_millis()).min(255) as u8;

    let alpha = if CLOSING.load(Ordering::SeqCst) {
        let close_start = *CLOSE_START.get_or_init(Instant::now);
        let since_close = now.saturating_duration_since(close_start);
        let min_remaining = MIN_VISIBLE.saturating_sub(elapsed);
        if since_close < min_remaining {
            fade_in
        } else {
            let fade_elapsed = since_close - min_remaining;
            if fade_elapsed >= FADE_OUT {
                0
            } else {
                let remaining = 1.0 - fade_elapsed.as_secs_f32() / FADE_OUT.as_secs_f32();
                (255.0 * remaining).round() as u8
            }
        }
    } else {
        fade_in
    };

    SetLayeredWindowAttributes(hwnd, 0, alpha, LWA_ALPHA);
    InvalidateRect(hwnd, std::ptr::null(), 0);

    if CLOSING.load(Ordering::SeqCst) && alpha == 0 {
        DestroyWindow(hwnd);
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

    // Double buffer the whole card so the fade and progress bar never flicker.
    let memory = CreateCompatibleDC(hdc);
    let bitmap = CreateCompatibleBitmap(hdc, width, height);
    let previous = SelectObject(memory, bitmap as HGDIOBJ);

    let background = CreateSolidBrush(rgb(6, 7, 7));
    FillRect(memory, &client, background);
    DeleteObject(background as HGDIOBJ);

    let border = CreateSolidBrush(rgb(28, 28, 32));
    FrameRect(memory, &client, border);
    DeleteObject(border as HGDIOBJ);

    let dpi = GetDpiForWindow(hwnd).max(96);
    let scale = dpi as f32 / 96.0;
    let center_x = width as f32 / 2.0;
    let tile_size = (64.0 * scale).round() as i32;
    let tile_x = (center_x - tile_size as f32 / 2.0).round() as i32;
    let tile_y = (height as f32 / 2.0 - 86.0 * scale).round() as i32;
    let radius = (18.0 * scale).round() as i32;

    let tile_brush = CreateSolidBrush(rgb(246, 243, 235));
    let tile_pen = CreatePen(PS_SOLID, (1.0 * scale).max(1.0) as i32, rgb(58, 58, 62));
    let old_brush = SelectObject(memory, tile_brush as HGDIOBJ);
    let old_pen = SelectObject(memory, tile_pen as HGDIOBJ);
    RoundRect(
        memory,
        tile_x,
        tile_y,
        tile_x + tile_size,
        tile_y + tile_size,
        radius,
        radius,
    );
    SelectObject(memory, old_brush);
    SelectObject(memory, old_pen);
    DeleteObject(tile_brush as HGDIOBJ);
    DeleteObject(tile_pen as HGDIOBJ);

    draw_mark(memory, tile_x, tile_y, scale);

    let title_font = make_font(24.0, scale, FW_NORMAL as i32, windows_sys::w!("Georgia"));
    let caption_font = make_font(10.0, scale, 500, windows_sys::w!("Segoe UI"));

    let title = "Notebook";
    let suffix = ".io";
    let title_width = measure_text(memory, title_font, title);
    let suffix_width = measure_text(memory, title_font, suffix);
    let title_x = ((width as f32 - (title_width + suffix_width) as f32) / 2.0).round() as i32;
    let title_y = tile_y + (82.0 * scale).round() as i32;
    draw_text(
        memory,
        title_font,
        rgb(244, 242, 236),
        title,
        title_x,
        title_y,
    );
    draw_text(
        memory,
        title_font,
        rgb(133, 133, 139),
        suffix,
        title_x + title_width,
        title_y,
    );

    let rule_width = (54.0 * scale).round() as i32;
    let rule_height = (1.0 * scale).max(1.0) as i32;
    let rule = RECT {
        left: (width - rule_width) / 2,
        top: tile_y + (120.0 * scale).round() as i32,
        right: (width + rule_width) / 2,
        bottom: tile_y + (120.0 * scale).round() as i32 + rule_height,
    };
    let rule_brush = CreateSolidBrush(rgb(43, 43, 48));
    FillRect(memory, &rule, rule_brush);
    DeleteObject(rule_brush as HGDIOBJ);

    let caption = "A QUIET PLACE TO WRITE";
    let caption_rect = RECT {
        left: 0,
        top: tile_y + (133.0 * scale).round() as i32,
        right: width,
        bottom: tile_y + (151.0 * scale).round() as i32,
    };
    draw_centered(
        memory,
        caption_font,
        rgb(133, 133, 139),
        caption,
        caption_rect,
        (1.4 * scale).round() as i32,
    );

    let track_x = (72.0 * scale).round() as i32;
    let track_width = (376.0 * scale).round() as i32;
    let track_height = (2.0 * scale).max(1.0) as i32;
    let track_y = tile_y + (194.0 * scale).round() as i32;
    let track = RECT {
        left: track_x,
        top: track_y,
        right: track_x + track_width,
        bottom: track_y + track_height,
    };
    let track_brush = CreateSolidBrush(rgb(28, 28, 32));
    FillRect(memory, &track, track_brush);
    DeleteObject(track_brush as HGDIOBJ);

    let elapsed = START.get_or_init(Instant::now).elapsed();
    let progress = (0.08 + elapsed.as_secs_f32() * 1000.0 / PROGRESS_MS).clamp(0.0, 1.0);
    let filled = (track_width as f32 * progress).round() as i32;
    if filled > 0 {
        let fill = RECT {
            left: track_x,
            top: track_y,
            right: track_x + filled,
            bottom: track_y + track_height,
        };
        let fill_brush = CreateSolidBrush(rgb(207, 194, 162));
        FillRect(memory, &fill, fill_brush);
        DeleteObject(fill_brush as HGDIOBJ);
    }
    if progress < 1.0 && filled > 0 {
        let glow = RECT {
            left: track_x + filled - (2.0 * scale).round() as i32,
            top: track_y,
            right: track_x + filled,
            bottom: track_y + track_height,
        };
        let glow_brush = CreateSolidBrush(rgb(236, 226, 201));
        FillRect(memory, &glow, glow_brush);
        DeleteObject(glow_brush as HGDIOBJ);
    }

    BitBlt(hdc, 0, 0, width, height, memory, 0, 0, SRCCOPY);
    SelectObject(memory, previous);
    DeleteObject(bitmap as HGDIOBJ);
    DeleteDC(memory);
    DeleteObject(title_font as HGDIOBJ);
    DeleteObject(caption_font as HGDIOBJ);
}

unsafe fn draw_mark(hdc: HDC, tile_x: i32, tile_y: i32, scale: f32) {
    let left = tile_x + (20.0 * scale).round() as i32;
    let top = tile_y + (16.0 * scale).round() as i32;
    let right = left + (24.0 * scale).round() as i32;
    let bottom = top + (32.0 * scale).round() as i32;

    let pen = CreatePen(PS_SOLID, (1.6 * scale).max(1.0) as i32, rgb(23, 23, 21));
    let old_pen = SelectObject(hdc, pen as HGDIOBJ);
    let old_brush = SelectObject(hdc, GetStockObject(NULL_BRUSH));
    RoundRect(
        hdc,
        left,
        top,
        right,
        bottom,
        (4.0 * scale).round() as i32,
        (4.0 * scale).round() as i32,
    );
    SelectObject(hdc, old_brush);
    SelectObject(hdc, old_pen);
    DeleteObject(pen as HGDIOBJ);

    let ink = CreateSolidBrush(rgb(23, 23, 21));
    let spine = RECT {
        left: left + (6.0 * scale).round() as i32,
        top: top + (8.0 * scale).round() as i32,
        right: left + (7.0 * scale).round() as i32,
        bottom: bottom - (8.0 * scale).round() as i32,
    };
    FillRect(hdc, &spine, ink);
    for offset in [10.0, 16.0, 22.0] {
        let line = RECT {
            left: left + (11.0 * scale).round() as i32,
            top: top + (offset * scale).round() as i32,
            right: left + (19.0 * scale).round() as i32,
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

unsafe fn draw_centered(
    hdc: HDC,
    font: HFONT,
    color: COLORREF,
    text: &str,
    mut rect: RECT,
    extra: i32,
) {
    let old = SelectObject(hdc, font as HGDIOBJ);
    SetBkMode(hdc, TRANSPARENT as i32);
    SetTextColor(hdc, color);
    SetTextCharacterExtra(hdc, extra);
    let wide: Vec<u16> = text.encode_utf16().collect();
    DrawTextW(
        hdc,
        wide.as_ptr(),
        wide.len() as i32,
        &mut rect,
        DT_CENTER | DT_SINGLELINE | DT_VCENTER,
    );
    SetTextCharacterExtra(hdc, 0);
    SelectObject(hdc, old);
}
