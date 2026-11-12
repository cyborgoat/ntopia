#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_fs::init())
        // Remembers folders the user picked (e.g. on an external volume) so they stay readable after a restart.
        .plugin(tauri_plugin_persisted_scope::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            #[cfg(all(target_os = "macos", dev))]
            watch_dev_runner(app.handle());
            build_tray(app)?;
            Ok(())
        })
        // Closing the window hides it to the tray so reminders and live notifications keep arriving
        // as system notifications. Quit from the tray menu to exit.
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app, _event| {
            // Clicking the Dock icon while hidden brings the window back.
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Reopen { .. } = _event {
                use tauri::Manager;
                if let Some(window) = _app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        });
}

/// Adds the menu bar (macOS) / system tray (Windows) icon with a native menu.
fn build_tray(app: &tauri::App) -> tauri::Result<()> {
    use tauri::{
        Manager,
        menu::{Menu, MenuItem, PredefinedMenuItem},
        tray::TrayIconBuilder,
    };

    let show = MenuItem::with_id(app, "show", "Open NTOPIA", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Quit NTOPIA", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &separator, &quit])?;

    let mut tray = TrayIconBuilder::new()
        .menu(&menu)
        .tooltip("NTOPIA")
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.unminimize();
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "quit" => app.exit(0),
            _ => {}
        });
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;
    Ok(())
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
