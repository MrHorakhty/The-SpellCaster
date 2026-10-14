// The runtime fs-scope grant (PROFILE_SYNC_SPEC.md §10, and the answer to the
// spec's last platform unknown - spiked and measured on Windows 2026-10-06).
//
// THE PROBLEM. `dialog.save()` returns the absolute path the user chose, but
// this app's fs scope is AppData-only. `writeFile` to that path fails with
// "forbidden path ... maybe it is not allowed on the scope for allow-write-file",
// and so does `exists()` on it - so it is a scope limit, not a write-only limit.
//
// TWO FIXES, BOTH MEASURED. A blanket `{"identifier":"fs:scope","allow":["**"]}`
// entry also works, with zero Rust. It was not chosen: it hands the frontend
// write access to the entire filesystem, which for a publicly shipped app means
// any future XSS or injected dependency can write anywhere. The command below is
// the same mechanism the fs plugin itself uses for drag-and-drop
// (`RunEvent::WindowEvent::DragDrop` -> `app.fs_scope().allow_file(path)`), so
// it is a few lines and it is auditable.
//
// SCOPE IS EXACTLY ONE FILE. `allow_file` covers that path and nothing else -
// granting a directory does NOT let you write a new file inside it (that needs
// `allow_directory(dir, true)`, which is also what the plugin uses for dropped
// folders). The save dialog returns a file, so `allow_file` is the right call,
// and the narrowness is the entire reason this route was preferred.
//
// ANDROID DOES NOT NEED IT. The mobile `resolve_file` path takes the URL branch
// for a `content://` URI and skips the scope check entirely; raw paths there are
// refused regardless. The frontend only calls this on desktop.

use tauri_plugin_fs::FsExt;

/// Widen the fs scope to one user-picked file, for the duration of the session.
///
/// Returns the path back so the caller can log what it actually granted - and
/// so a UI that wants to display the destination does not have to trust its own
/// remembered string over what was granted.
#[tauri::command]
pub fn grant_path(app: tauri::AppHandle, path: String) -> Result<String, String> {
    app.fs_scope()
        .allow_file(&path)
        .map_err(|e| e.to_string())?;
    Ok(path)
}