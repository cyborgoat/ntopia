#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|_app| {
            #[cfg(all(target_os = "macos", dev))]
            watch_dev_runner(_app.handle());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(all(target_os = "macos", dev))]
fn watch_dev_runner(app: &tauri::AppHandle) {
    let Some(pid) = std::env::var("NTOPIA_DEV_RUNNER_PID")
        .ok()
        .and_then(|value| value.parse::<i32>().ok())
        .filter(|pid| *pid > 0)
    else {
        return;
    };
    if let Some(path) = std::env::var_os("NTOPIA_DEV_PID_FILE") {
        if let Err(error) = std::fs::write(path, std::process::id().to_string()) {
            eprintln!("Failed to acknowledge development launch: {error}");
        }
    }
    // LaunchServices owns the bundled process, so Cargo cannot kill it directly.
    // Follow the runner's lifetime to preserve Ctrl+C and Rust hot reload.
    let app = app.clone();
    std::thread::spawn(move || {
        loop {
            // Signal 0 only checks whether the runner still exists.
            if unsafe { libc::kill(pid, 0) } == -1
                && std::io::Error::last_os_error().raw_os_error() == Some(libc::ESRCH)
            {
                app.exit(0);
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(200));
        }
    });
}
