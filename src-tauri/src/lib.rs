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
        .invoke_handler(tauri::generate_handler![set_tray_labels, set_tray_mute_checked])
        .setup(|app| {
            #[cfg(desktop)]
            {
                app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;
                app.handle().plugin(tauri_plugin_process::init())?;
            }
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

/// Tray handles kept so the webview can relabel items and sync the mute check mark.
struct TrayState {
    tray: tauri::tray::TrayIcon,
    items: Vec<(&'static str, tauri::menu::MenuItem<tauri::Wry>)>,
    mute: tauri::menu::CheckMenuItem<tauri::Wry>,
}

fn show_main_window(app: &tauri::AppHandle) {
    use tauri::Manager;
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// Updates tray labels. Keys: open, home, todo, notebook, notifications, settings, mute, update, quit, tooltip.
#[tauri::command]
fn set_tray_labels(state: tauri::State<'_, TrayState>, labels: std::collections::HashMap<String, String>) {
    for (key, item) in &state.items {
        if let Some(text) = labels.get(*key) {
            let _ = item.set_text(text);
        }
    }
    if let Some(text) = labels.get("mute") {
        let _ = state.mute.set_text(text);
    }
    if let Some(text) = labels.get("tooltip") {
        let _ = state.tray.set_tooltip(Some(text.as_str()));
    }
}

#[tauri::command]
fn set_tray_mute_checked(state: tauri::State<'_, TrayState>, checked: bool) {
    let _ = state.mute.set_checked(checked);
}

/// Adds the menu bar (macOS) / system tray (Windows) icon with a native menu.
fn build_tray(app: &tauri::App) -> tauri::Result<()> {
    use tauri::{
        Emitter, Manager,
        menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem},
        tray::TrayIconBuilder,
    };

    let item = |id: &'static str, text: &str| MenuItem::with_id(app, id, text, true, None::<&str>);
    let open = item("show", "Open NTOPIA")?;
    let home = item("nav:/", "Home")?;
    let todo = item("nav:/todo", "Todo")?;
    let notebook = item("nav:/notebook", "Notebook")?;
    let notifications = item("nav:/notifications", "Notifications")?;
    let settings = item("nav:/settings", "Settings")?;
    let update = item("update", "Check for Updates…")?;
    let mute = CheckMenuItem::with_id(app, "mute", "Mute notifications", true, false, None::<&str>)?;
    let quit = item("quit", "Quit NTOPIA")?;
    let sep = || PredefinedMenuItem::separator(app);
    let (s1, s2, s3) = (sep()?, sep()?, sep()?);
    let menu = Menu::with_items(
        app,
        &[&open, &s1, &home, &todo, &notebook, &notifications, &settings, &s2, &mute, &update, &s3, &quit],
    )?;

    let mut tray = TrayIconBuilder::new()
        .menu(&menu)
        .tooltip("NTOPIA")
        .on_menu_event(|app, event| {
            let id = event.id.as_ref();
            if let Some(path) = id.strip_prefix("nav:") {
                show_main_window(app);
                let _ = app.emit("tray-navigate", path);
                return;
            }
            match id {
                "show" => show_main_window(app),
                "update" => {
                    show_main_window(app);
                    let _ = app.emit("tray-check-updates", ());
                }
                "mute" => {
                    let _ = app.emit("tray-toggle-mute", ());
                }
                "quit" => app.exit(0),
                _ => {}
            }
        });
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    let tray = tray.build(app)?;
    app.manage(TrayState {
        tray,
        items: vec![
            ("open", open),
            ("home", home),
            ("todo", todo),
            ("notebook", notebook),
            ("notifications", notifications),
            ("settings", settings),
            ("update", update),
            ("quit", quit),
        ],
        mute,
    });
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
