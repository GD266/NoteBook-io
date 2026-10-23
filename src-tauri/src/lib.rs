use tauri::{Manager, WindowEvent};
use tauri_plugin_window_state::{AppHandleExt, StateFlags};

#[cfg(windows)]
pub mod splash;

#[tauri::command]
fn finish_startup(app: tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }

    #[cfg(windows)]
    splash::close();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_window_state::Builder::default()
                // The main window starts hidden so the plugin can restore its
                // size and position before it is shown. Never persist or
                // restore visibility here.
                .with_state_flags(StateFlags::SIZE | StateFlags::POSITION | StateFlags::MAXIMIZED)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![finish_startup])
        .setup(|app| {
            #[cfg(windows)]
            {
                if splash::is_open() {
                    splash::watchdog(app.handle().clone());
                } else if let Some(window) = app.get_webview_window("main") {
                    // The native splash could not be created; never leave the
                    // app without a visible window.
                    let _ = window.show();
                }
            }

            #[cfg(not(windows))]
            {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                }
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
