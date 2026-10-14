// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Shared with lib.rs - `grant_path` must exist in BOTH entry points. See the
// note in scope.rs for why a runtime grant is used instead of `fs:scope: ["**"]`.
mod scope;

fn main() {
    tauri::Builder::default()
        // Register the file system plugin here
        .plugin(tauri_plugin_fs::init())
        // Save/open pickers for profile export and import. Registering the
        // plugin is NOT enough on its own - capabilities/default.json also needs
        // dialog:allow-save + dialog:allow-open, or the call fails with
        // "Permissions associated with this command: dialog:allow-save,
        // dialog:default", which reads like a registration bug and is not one.
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![scope::grant_path])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}