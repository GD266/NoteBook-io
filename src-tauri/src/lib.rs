use std::ffi::OsStr;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use tauri::{Emitter, Manager, WindowEvent};
use tauri_plugin_window_state::{AppHandleExt, StateFlags};

const MAX_TEXT_FILE_BYTES: u64 = 10 * 1024 * 1024;

/// Files handed to the app by Windows before the webview is ready. The
/// frontend drains this queue once it mounts, and the single-instance plugin
/// adds to it when another process forwards an open request.
static PENDING_FILES: Mutex<Vec<PathBuf>> = Mutex::new(Vec::new());

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct OpenedTextFile {
    name: String,
    file_name: String,
    path: String,
    content: String,
}

fn canonical_text_path(value: &OsStr) -> Option<PathBuf> {
    let path = Path::new(value);
    if !path.is_file() {
        return None;
    }

    let is_text = path
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("txt"));
    if !is_text {
        return None;
    }

    path.canonicalize().ok()
}

fn queue_text_file(path: PathBuf) {
    let Ok(mut pending) = PENDING_FILES.lock() else {
        return;
    };
    if !pending.iter().any(|existing| existing == &path) {
        pending.push(path);
    }
}

fn queue_text_files_from_args<I, S>(args: I) -> bool
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    for arg in args {
        if let Some(path) = canonical_text_path(arg.as_ref()) {
            queue_text_file(path);
            return true;
        }
    }
    false
}

fn decode_utf16(bytes: &[u8], little_endian: bool) -> String {
    let units: Vec<u16> = bytes
        .chunks_exact(2)
        .map(|chunk| {
            if little_endian {
                u16::from_le_bytes([chunk[0], chunk[1]])
            } else {
                u16::from_be_bytes([chunk[0], chunk[1]])
            }
        })
        .collect();
    String::from_utf16_lossy(&units)
}

fn decode_text(bytes: &[u8]) -> String {
    if let Some(rest) = bytes.strip_prefix(&[0xEF, 0xBB, 0xBF]) {
        return String::from_utf8_lossy(rest).into_owned();
    }
    if let Some(rest) = bytes.strip_prefix(&[0xFF, 0xFE]) {
        return decode_utf16(rest, true);
    }
    if let Some(rest) = bytes.strip_prefix(&[0xFE, 0xFF]) {
        return decode_utf16(rest, false);
    }

    match std::str::from_utf8(bytes) {
        Ok(text) => text.to_owned(),
        // Older Windows text files are commonly saved as Windows-1252.
        Err(_) => encoding_rs::WINDOWS_1252.decode(bytes).0.into_owned(),
    }
}

#[tauri::command]
fn take_pending_files() -> Vec<String> {
    let Ok(mut pending) = PENDING_FILES.lock() else {
        return Vec::new();
    };

    pending
        .drain(..)
        .map(|path| path.to_string_lossy().into_owned())
        .collect()
}

#[tauri::command]
fn read_text_file(path: String) -> Result<OpenedTextFile, String> {
    let canonical = canonical_text_path(OsStr::new(&path))
        .ok_or_else(|| "That file is not a readable .txt document.".to_string())?;

    let metadata = std::fs::metadata(&canonical)
        .map_err(|error| format!("Could not read that text file: {error}"))?;
    if metadata.len() > MAX_TEXT_FILE_BYTES {
        return Err("That text file is larger than 10 MB.".to_string());
    }

    let bytes =
        std::fs::read(&canonical).map_err(|error| format!("Could not read that text file: {error}"))?;
    let content = decode_text(&bytes);

    let file_name = canonical
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("text.txt")
        .to_string();
    let name = canonical
        .file_stem()
        .and_then(|stem| stem.to_str())
        .map(str::trim)
        .filter(|stem| !stem.is_empty())
        .unwrap_or("Untitled")
        .to_string();

    Ok(OpenedTextFile {
        name,
        file_name,
        path: canonical.to_string_lossy().into_owned(),
        content,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Windows passes the associated file as the first non-executable argument.
    queue_text_files_from_args(std::env::args_os());

    tauri::Builder::default()
        // This must be registered before the other plugins so opening a file
        // while Notebook.io is already running reaches the existing window.
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            let has_file = queue_text_files_from_args(args);
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
            if has_file {
                let _ = app.emit("open-text-file", ());
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_window_state::Builder::default()
                // The main window starts hidden so the plugin can restore its
                // size and position before the first frame is shown. Never
                // persist or restore visibility here.
                .with_state_flags(StateFlags::SIZE | StateFlags::POSITION | StateFlags::MAXIMIZED)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![take_pending_files, read_text_file])
        .setup(|app| {
            // The window-state plugin has restored the saved bounds by now, so
            // the window can appear immediately — no splash, no artificial
            // delay — while WebView2 finishes loading in the background.
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
            }

            Ok(())
        })
        // The plugin already saves on RunEvent::Exit, but writing while the
        // window still exists makes close/reopen reliable on Windows too.
        .on_window_event(|window, event| {
            if matches!(event, WindowEvent::CloseRequested { .. }) {
                let _ = window.app_handle().save_window_state(
                    StateFlags::SIZE | StateFlags::POSITION | StateFlags::MAXIMIZED,
                );
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Notebook.io");
}
