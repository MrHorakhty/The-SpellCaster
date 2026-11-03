#[tauri::command]
pub fn global_shortcuts_available() -> bool {
    cfg!(target_os = "windows")
}

pub fn configure<R: tauri::Runtime>(builder: tauri::Builder<R>) -> tauri::Builder<R> {
    #[cfg(target_os = "windows")]
    let builder = builder.plugin(tauri_plugin_global_shortcut::Builder::new().build());
    builder
}
