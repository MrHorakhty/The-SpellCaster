# opencode Session Summary — Tauri Android Port + Mobile UI

Read this at the start of the next session to recover context.

## Goal
Turn the "SpellCaster" TTRPG soundboard (a **Tauri 2.x cross-platform app** wrapping a **React 19 + Vite + Tailwind** frontend) into an installable **Android phone app**, with the UI scaled to a comfortable mobile/phone layout. All mobile changes are **gated behind `isMobile`** (`platform()` from `@tauri-apps/plugin-os`) so desktop/web stay untouched. See `MOBILE_ONLY_INSTRUCTIONS.md`.

## Project facts
- Frontend: React 19 + Vite, entry `src/main.jsx`, main logic in `src/App.jsx` (~3400 lines, single monolithic component).
- Backend: Rust/Tauri 2.x (`src-tauri/`). Uses `tauri-plugin-fs` (2.5.1) + `tauri-plugin-log`.
- Storage abstraction:
  - `isTauri` path → `@tauri-apps/plugin-fs` writing to `BaseDirectory.AppData` (read back via `convertFileSrc`).
  - web path → `localStorage` keys `sound_file_*` as data-URLs.
- App package `com.mrhorakhty.thespellcaster.debug`; main activity `com.mrhorakhty.thespellcaster.MainActivity`; adb at `C:\Users\emire\AppData\Local\Android\Sdk\platform-tools\adb.exe`.
- `src-tauri/tauri.conf.json`: `devUrl: http://localhost:5173`, identifier `com.mrhorakhty.thespellcaster`.

## ⚠️ IMPORTANT ARCHITECTURE GOTCHA
There are **two Rust entry points**:
- `src-tauri/src/main.rs` — desktop binary only; registers `tauri_plugin_fs::init()`.
- `src-tauri/src/lib.rs` — Android/iOS (`#[cfg_attr(mobile, tauri::mobile_entry_point)]`).

Plugins registered ONLY in `main.rs` are silently missing on mobile (symptom: `plugin fs not found`). **lib.rs now also registers `tauri_plugin_fs::init()`**. Keep the two in sync when adding plugins.

## ⚠️ CRITICAL code bug found (platform())
`platform()` from `@tauri-apps/plugin-os` is **synchronous** (returns a string), NOT async. `.then()`-ing it caused `TypeError` → React unmount → blank/black screen. Use it synchronously (App.jsx ~line 333, `isMobile = platform() === 'android'` style pattern). Reverted once already; don't re-introduce.

## Vite binding (dev-server access)
`vite.config.js` sets `host: '0.0.0.0'` so the Android emulator (via `10.0.2.2` → host loopback `127.0.0.1`) reaches the dev server. (ProtonVPN's `10.2.0.2` interface previously collided and baked the wrong host.) Dev-only; release builds unaffected. **The app loads the frontend from the Vite dev server in debug builds, so `npm run tauri android dev` must stay running** — the installed debug APK alone shows a blank screen without it. An HMR-websocket connection warning ("failed to connect to websocket") is cosmetic and doesn't block rendering.

## Environment (verified)
- Rust 1.97.1; Android Rust targets installed. Android SDK `C:\Users\emire\AppData\Local\Android\Sdk`; NDK `30.0.16138531`; JDK = Android Studio JBR (JDK 21); JAVA_HOME points there.
- AVDs: `Pixel_7`, `Pixel_Tablet`, `Small_Phone` (boot via `emulator.exe -avd <name>`).
- Persistent User env vars: `ANDROID_HOME`/`ANDROID_SDK_ROOT` = SDK path, `JAVA_HOME` = JBR, PATH += `jbr\bin`.

## ⚠️ OPERATIONAL WARNING for agents
`npm run tauri android dev` **never exits** (watches for rebuilds + streams logcat). It hangs the tool call. Prefer `adb shell logcat` / `adb devices` for read-only verification, or launch detached via `Start-Process` and tail a log file. Rust changes need a rebuild (slow on fresh build, fast incremental).

## Mobile UI work (gated behind `isMobile`) — all in `src/App.jsx`
- **Header**: two rows (row 1: app icon `h-10 w-10` + title `text-2xl` + stop + settings; row 2: sliders). Split view/fullscreen/number inputs hidden on mobile. Safe-area: `paddingTop: max(env(safe-area-inset-top), 12px)`.
- **Slider row**: centered, both sliders exactly `w-[90px]` (kept small/centered away from screen edges to avoid Android gesture-nav back-swipe triggering), `%` labels to the LEFT, volume icon + divider + zoom icon between. Range `0.5–2.0` step `0.1`.
- **Sound cards**: mobile `w-full` in a grid; desktop fixed `140px * boxSize` width.
- **Left navigation (mobile)**: a persistent collapsed icon rail (`w-14`, hamburger + User/Music icon buttons) that opens a **left slide-in drawer** (`w-[80%] max-w-[320px]`, `drawer-slide` CSS animation 200ms) containing the Characters/Environment tabs, edit-mode tools, and vertical category list. Selecting a category **keeps the panel open** (per user choice). Drawer uses `bg-dark-950` = `--theme-bg-drawer` (a shade darker than the selected theme background; see theme note below). **No dimmer backdrop** (a transparent full-screen `z-40` click-catcher closes it). Drawer `opacity: 0.9`.
- **Edit mode**: mobile action buttons always visible (no hover) with 44px targets.
- **Modals** (6 total: Sound, Character, Category, Delete Confirm, Settings, About): mobile = bottom slide-up `rounded-t-xl min-h-[80vh] p-0 sm:p-4`; desktop unchanged.
- **Box-size scaling (mobile)**: the size slider changes the whole box by switching grid columns: `boxSize >= 1.5 → 1 col`, `>= 0.7 → 2 cols`, else `3 cols`. Inner card keeps `aspect-square` so height follows width. Card `borderRadius` is **static `12px`** (doesn't scale with boxSize — user wants the rounded-corner ratio constant regardless of size). Padding/icons/fonts still scale with `boxSize`.
- **Container stretch**: mobile branch uses `flex-1 min-h-full` (and the standard-view wrapper `min-h-full`) so the rail + sound panel stretch to the bottom of the screen. Sound panel inner wrapper `flex-1 min-w-0 rounded-xl p-3`; grid `grid-cols-*` from boxSize.

## Theme system (mobile drawer)
- `--theme-bg-primary` = app background (default `#090d16`, or `palette.darker` in `applyTheme`).
- `--theme-bg-secondary` = panels (`bg-dark-800`, default `#0f172a`).
- `--theme-bg-drawer` = **new** drawer background (`bg-dark-950`), default `#060a12`; for custom themes = `darkenColor(palette.darker, 0.4)` — i.e. a **secondary shade derived from the selected theme, darker than the primary background**. Set in both `:root` (index.css) and `applyTheme` (App.jsx). So the drawer is darker than the selected background in every theme.

## Build verification
`npx eslint src/App.jsx` → 0 errors (pre-existing non-blocking warnings: unused `convertFileSrc`, `_`, `platformType`, `ev`). `npx vite build` succeeds.

## Backups (Desktop / OneDrive Masaüstü)
Backup root is **`C:\Users\emire\OneDrive\Masaüstü\`** (not `Desktop`). Per AGENTS.md, always back up before changes; exclusions: `node_modules`, `dist`, `.git`, `src-tauri/target`, `src-tauri/gen` (use bare dir names for `/XD` because PowerShell mangles full paths).
- `ttrpg-soundboard-backup-20260831-202455` (38.2 MB, current, newest)
- Older backups from this work were deleted by the user after each new backup was made.

## Next likely work
- Continue mobile UI refinements (all behind `isMobile`).
- Release APK (`npm run tauri android build`, needs signing keystore).
- Wake Lock, fullscreen guard on mobile, iOS (needs macOS + Apple account).
