#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Draw something before WebView2 starts. If this fails, `run` falls back to
    // showing the main window immediately.
    #[cfg(windows)]
    notebook_io_lib::splash::show();

    notebook_io_lib::run()
}
