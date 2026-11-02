#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Draw something before WebView2 starts. If this fails, `run` falls back to
    // showing the main window immediately. A second launch (for example,
    // double-clicking another .txt file) skips the splash so it can hand the
    // file to the existing window without flashing a loader.
    #[cfg(windows)]
    {
        if !notebook_io_lib::splash::instance_already_running() {
            notebook_io_lib::splash::show();
        }
    }

    notebook_io_lib::run()
}
