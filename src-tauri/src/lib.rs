// Shared with main.rs. See scope.rs.
mod scope;

// The Android/iOS entry point. Every plugin and command registered only in
// main.rs is SILENTLY MISSING here - see the plugin rows in
// PROFILE_SYNC_SPEC.md §10. That is not a style preference: with the dialog
// plugin missing from this file the app rejects `dialog.save` with
// "dialog.save not allowed. Plugin not found", which is exactly the failure
// the rule exists to prevent (observed during the 2026-10-04 Android spike).
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_os::init())
    .plugin(tauri_plugin_dialog::init())
    .invoke_handler(tauri::generate_handler![scope::grant_path])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}