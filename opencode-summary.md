# opencode Session Summary — Tauri Android Port

Read this at the start of the next session to recover context.

## Goal
Turn the "SpellCaster" TTRPG soundboard (currently a **Tauri 2.x desktop app** wrapping a **React 19 + Vite + Tailwind** frontend) into an installable **Android phone app via Tauri mobile**. iOS is a lower priority (needs Mac + paid Apple account).

## Project facts
- Frontend: React 19 + Vite, entry `src/main.jsx`, main logic in `src/App.jsx` (~3200 lines).
- Backend: Rust/Tauri 2.x (`src-tauri/`). Uses `tauri-plugin-fs` (2.5.1) + `tauri-plugin-log`.
- Critical design: the app already has a **full web fallback** — it detects `isTauri` via `window.__TAURI_INTERNALS__` (App.jsx:7) and uses `localStorage` + browser HTML5 `new Audio()` when not in Tauri. So config/storage already works cross-platform.
- Storage abstraction (App.jsx):
  - `isTauri` path → `@tauri-apps/plugin-fs` writing to `BaseDirectory.AppData`, read back via `convertFileSrc`.
  - web path → `localStorage` keys `sound_file_*` as data-URLs (App.jsx:1001, 1042, 1551).
- Audio: HTML5 `new Audio(soundUrl)` with fade in/out helpers (App.jsx:278, 1610). Requires user gesture (`enableAudio` gate at App.jsx:633).
- `src-tauri/tauri.conf.json`: `assetProtocol.scope` is `["$APPDATA/**/*"]`. Bundle has `android.debugApplicationIdSuffix = ".debug"`.

## ⚠️ IMPORTANT ARCHITECTURE GOTCHA (found this session)
There are **two Rust entry points**:
- `src-tauri/src/main.rs` — used by the **desktop** binary only; registers `tauri_plugin_fs::init()`.
- `src-tauri/src/lib.rs` — used by **Android/iOS** (`#[cfg_attr(mobile, tauri::mobile_entry_point)]`).

Any plugin/command registered ONLY in `main.rs` will silently be missing on mobile (symptom: `plugin fs not found`). **lib.rs now also registers `tauri_plugin_fs::init()`** (added 2026-08-31). Keep the two in sync when adding plugins.

## Status of the Android setup (DONE, build verified 2026-08-31)
- Toolchain ✅ (env vars now persist at User level, see below).
- `src-tauri/gen/android` generated ✅ (`npm run tauri android init`).
- Icons generated for android/ios ✅.
- AssetProtocol scope reviewed ✅ — left as `["$APPDATA/**/*"]`; the app only reads/writes `BaseDirectory.AppData`, so `$CACHE`/`$TMP` are NOT needed.
- **First emulator build ✅** — app installs and launches on `Pixel_7` AVD (`com.mrhorakhty.thespellcaster.debug`); audio works (AAudio streams open `AAUDIO_OK`); the `plugin fs not found` errors are GONE.

### Fixes applied this session (2 files)
1. `vite.config.js` — added `server.host: true`. REQUIRED for mobile dev: Vite defaults to `localhost` only, but the emulator's WebView reaches the host at `http://10.2.0.2:5173/`. Without `host: true`, `tauri android dev` fails with `Could not connect to http://10.2.0.2:5173/ after 180s`.
2. `src-tauri/src/lib.rs` — added `.plugin(tauri_plugin_fs::init())` (see gotcha above). Fixed `Failed to read local file: plugin fs not found` on Android.

### Known cosmetic issue (not fixed — user will handle)
`Failed to toggle fullscreen: [object Object]` (App.jsx ~657, `toggleFullscreen`) — `setFullscreen` is not supported on Android. Already wrapped in try/catch so it's harmless; recommended fix: guard to desktop-only (no easy `isMobile` check exists yet — there is only `isTauri`).

## Environment (verified this session)
- Rust 1.97.1; all 4 Android Rust targets installed (`aarch64-linux-android`, `armv7-linux-androideabi`, `i686-linux-android`, `x86_64-linux-android`).
- Android SDK at `C:\Users\emire\AppData\Local\Android\Sdk` — platforms android-35/36/37.x, build-tools 34-36, NDK `30.0.16138531`.
- JDK = Android Studio JBR (`C:\Program Files\Android\Android Studio\jbr`, JDK 21). System `java` is 1.8 (wrong) → JAVA_HOME/PATH point to JBR.
- AVDs available: `Pixel_7`, `Pixel_Tablet`, `Small_Phone` (boot via `emulator.exe -avd <name>`).
- `npm run tauri info` works; shows desktop info (the Android panel isn't printed, but the build succeeding proves SDK/NDK/JDK are fine).

### Env vars (Persistent, User level) — only re-run if a fresh shell shows empty
- `ANDROID_HOME` / `ANDROID_SDK_ROOT` = `C:\Users\emire\AppData\Local\Android\Sdk`
- `JAVA_HOME` = `C:\Program Files\Android\Android Studio\jbr`
- `PATH` (User) += `C:\Program Files\Android\Android Studio\jbr\bin`

```powershell
[Environment]::SetEnvironmentVariable("ANDROID_HOME", "C:\Users\emire\AppData\Local\Android\Sdk", "User")
[Environment]::SetEnvironmentVariable("ANDROID_SDK_ROOT", "C:\Users\emire\AppData\Local\Android\Sdk", "User")
[Environment]::SetEnvironmentVariable("JAVA_HOME", "C:\Program Files\Android\Android Studio\jbr", "User")
```

## ⚠️ OPERATIONAL WARNING for agents
`npm run tauri android dev` **never exits** — it stays attached (watching for rebuilds + streaming logcat). In an agent loop this hangs the tool call and ends in a user/agent abort. Prefer:
- **Read-only verification:** check the app via `adb shell logcat` / `adb devices` instead of re-running dev.
- If you DO run it, launch detached with `Start-Process` and collect output from a log file, then verify via adb.
- A Rust change requires a rebuild; a full fresh `tauri android dev` takes a long time (cargo cross-compile + gradle). Incremental rebuilds after a first successful build are fast.

## Next session (user is doing app-specific UI work via Android Studio AI meanwhile)
1. **Verify end-to-end sound playback** — tap a sound on the emulator and confirm audio; this exercises `convertFileSrc` + the `$APPDATA` asset scope for the FIRST time. If asset URLs 404, the `assetProtocol.scope` may need `$APPDATA/**/*` hardened (e.g. also `$CACHE`/`$TMP`). No errors seen so far, but a real play hasn't been confirmed.
2. **Release APK** — `npm run tauri android build` (needs a signing keystore; see Android Studio docs / tauri.conf).
3. App-specific changes user will make (via Android Studio AI): **responsive/mobile layout**, **Wake Lock** (`navigator.wakeLock`), **fullscreen guard on mobile**. iOS still lower-priority (needs macOS + Apple account).

## Backups made this session (Desktop)
- `C:\Users\emire\Desktop\ttrpg-soundboard-backup-20260831-030626` (pre-vite fix)
- `C:\Users\emire\Desktop\ttrpg-soundboard-backup-20260831-033256` (pre-fs-plugin fix)

## ⚠️ MANDATORY (per AGENTS.md)
Before making ANY code changes to the project, create a backup copy of the project folder on the Windows Desktop (excluding `node_modules`, `dist`, `.git`, `src-tauri/target`, `src-tauri/gen`):
- Format: `C:\Users\emire\Desktop\ttrpg-soundboard-backup-<YYYYMMDD-HHMMSS>`
- Snippet:
  ```powershell
  $dst = "C:\Users\emire\Desktop\ttrpg-soundboard-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
  robocopy "C:\Users\emire\Projects\ttrpg-soundboard" $dst /E /XD node_modules dist .git src-tauri\target src-tauri\gen
  ```