# opencode Session Summary — Tauri Android Port + Mobile UI

Read this at the start of the next session to recover context.

## What the project is
**"The SpellCaster"** — a TTRPG soundboard app where the GM/DM assigns **sounds to Characters** (each has a set of sound buttons) and **Environment categories** (ambient zones each with sounds). Users play, loop, stop, and reorder sounds; edit characters/categories/sound properties; apply themes and a box-size (zoom) slider. It's a **Tauri 2.x** cross-platform shell around a **React 19 + Vite + Tailwind** SPA, being ported to Android as a phone app.

## Goal
Turn the "SpellCaster" TTRPG soundboard (a **Tauri 2.x cross-platform app** wrapping a **React 19 + Vite + Tailwind** frontend) into an installable **Android phone app**, with the UI scaled to a comfortable mobile/phone layout. All mobile changes are **gated behind `isMobile`** (`platform()` from `@tauri-apps/plugin-os`) so desktop/web stay untouched. See `MOBILE_ONLY_INSTRUCTIONS.md`.

## Project facts
- Frontend: React 19 + Vite, entry `src/main.jsx`, main logic in `src/App.jsx` (~4370 lines, single monolithic component).
- Backend: Rust/Tauri 2.x (`src-tauri/`). Uses `tauri-plugin-fs` (2.5.1) + `tauri-plugin-log`.
- Storage abstraction:
  - `isTauri` path → `@tauri-apps/plugin-fs` writing to `BaseDirectory.AppData` (read back via `convertFileSrc`).
  - web path → `localStorage` keys `sound_file_*` as data-URLs.
- Data localStorage keys: `ttrpg_characters`, `ttrpg_environments`, `ttrpg_groups`, `ttrpg_themes`, `ttrpg_data_version`.
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

## Mobile UI work — SESSION 2026-08-31 evening (all still behind `isMobile`)
- **Edit button on the sound-grid CONTAINER** (the box with the character/category name at top-left): a single toggle at the container's **top-right** (`z-[60]` so it stays clickable even while the drawer is open). On tap it toggles `editMode`. The container's character/category **name** opens the rename modal ONLY when tapped while in edit mode; in edit mode the name turns `text-lime-400` + pointer cursor to hint it's editable. This replaces a previously-added (now removed) edit button inside the drawer. Edit mode is NOT reset when the drawer closes.
- **Drawer edit-mode Add buttons**: "Add Character / Add Sound" and "Add Category / Add Sound" are stacked full-width rows (matching the category-row style: `w-full`, icon + text, `text-sm text-lime-400` green text on `bg-dark-700` box), **Add Sound always the bottom row**. Uses `openAddCharacterModal`, `openAddCategoryModal`, `openAddSoundModal(tabType)`.
- **Per-sound-card delete/edit buttons in edit mode**: now smaller (26px targets, `p-0.5`, 10px icons) and positioned **inside** the card at `top-1 left-1` / `top-1 right-1` (was `-top-2 ____` sticking outside and clashing with neighbor cards).
- **Slider number entry (mobile header)**: the volume & box-size `%` readouts are now clickable `<input type="number">`s for manual entry (volume 0–100, size 50–200, clamped, commit on blur/Enter). `%` sign shown right after each. **Width is fixed `w-[3ch]` with `text-right`** so the speaker/magnifier icons stay in a STABLE position regardless of the value (don't re-introduce dynamic width — it made icons move; don't drop the icon spacing either: icons have `-mr-1`, container `gap-2` = a small 4px gap between icon and number). Added state: `volumeInput/volumeFocused` (mirrors existing `boxSizeInput/boxSizeFocused`).
- **Drag-and-reorder fix (mobile touch)**: drag-to-reorder logic (`moveSound`, pointer handlers) was already present; it failed on touch because dragstart was being hijacked for scrolling. Added `touch-action: 'none'` on the sound card when in `editMode`, an `onPointerCancel` cleanup handler, and wrapped `setPointerCapture` in try/catch. (These touch the SHARED `renderSoundCard`, but only affect edit-mode dragging; harmless to desktop.)

## Theme system (mobile drawer)
- `--theme-bg-primary` = app background (default `#090d16`, or `palette.darker` in `applyTheme`).
- `--theme-bg-secondary` = panels (`bg-dark-800`, default `#0f172a`).
- `--theme-bg-drawer` = **new** drawer background (`bg-dark-950`), default `#060a12`; for custom themes = `darkenColor(palette.darker, 0.4)` — i.e. a **secondary shade derived from the selected theme, darker than the primary background**. Set in both `:root` (index.css) and `applyTheme` (App.jsx). So the drawer is darker than the selected background in every theme.

## Build verification
`npx eslint src/App.jsx` → 0 errors (pre-existing non-blocking warnings: unused `convertFileSrc`, `_`, `ev`). `npx vite build` succeeds.

## 2026-09-01 (later) — #16 rail-selection clobbering FIXED
Added `switchTab(type)` + `selectItem(type, id)` helpers in `src/App.jsx`:
- `switchTab` now remembers each tab's own last selection in `activeCharacterId` / `activeEnvironmentId` (previously single `activeTab` couldn't hold two), so toggling Characters↔Environment no longer resets to the first item. Used by all rail + drawer tab buttons.
- `selectItem` sets `activeTab` and the per-tab memory together; wired into the mobile-drawer and desktop-sidebar list clicks.
- Verified on emulator (Pixel_7): select Human Paladin → switch to Env → back → still Human Paladin; select Environmental Effects → Characters → back → still Environmental Effects. No logcat JS errors.
- This resolves the last "partial" item (#16) from the (now-deleted) audit reports. Backup: `ttrpg-soundboard-backup-20260901-154654`.

## Backups (Desktop / OneDrive Masaüstü)
Backup root is **`C:\Users\emire\OneDrive\Masaüstü\`** (not `Desktop`). Per AGENTS.md, always back up before changes; exclusions: `node_modules`, `dist`, `.git`, `src-tauri/target`, `src-tauri/gen` (use bare dir names for `/XD` because PowerShell mangles full paths).
- `ttrpg-soundboard-backup-20260903-141939` (newest — pre-groups-final-fixes; groups feature uncommitted).
- Previous: `ttrpg-soundboard-backup-20260901-154654` (pre-#16 fix, groups not yet started).
- Older backups from this work were deleted by the user after each new backup was made.

## Next likely work
- Group feature fixes are now complete; remaining todo: lint + build + test on emulator and desktop for the full groups feature (if not already done this session).
- Release APK (`npm run tauri android build`, needs signing keystore).
- Wake Lock, fullscreen guard on mobile, iOS (needs macOS + Apple account).

## 2026-09-01 session — all 28 original + 9 follow-up issues fixed
The edge-to-edge audit (originally tracked in `TESTING_REPORT.md` + `TESTING_REPORT_FOLLOWUP.md`, **deleted** once fully resolved — see git history if needed) is **fully resolved** — #16 (the last partial) was fixed and on-emulator verified:
- Audio/storage: blob URL revoke on stop + cleanup, fade-in reads `audio._fadeTargetVolume` so master-volume changes scale smoothly mid-fade, canonical `audio._soundId` replaces `startsWith` instance matching, smoke-guarded delete/dupe paths.
- Data robustness: `readStoredData` (via `normalizeStoredData`) guarantees `sounds: []`; `boxSize`, theme + sound colors (`normalizeHex` / `getHueRotateFromColor` / glow) NaN-safe.
- Mobile UI: no layout flash (`isMobile` is now a sync const), drawer got `role="dialog"` + `aria-modal` + `aria-label` + Escape + Tab focus trap + `safe-area-inset-bottom`, bottom-sheet modals get safe-area padding, empty-state hints in all sidebars.
- Version: `vite.config.js` now `define`s `__APP_VERSION__` from `package.json` → About modal shows `0.1.3` (do not hardcode the version).
- Edit mode: Stop-All + per-card stop work while editing (N4).
- Verification: `npx vite build` ✓, `npx eslint src/App.jsx` → 0 errors / 3 warnings (pre-existing: `convertFileSrc`, `_`, `ev`).

## Groups feature (started 2026-09-01, continued later — UNCOMMITTED)
A third top-level entity type alongside Characters and Environment. Groups contain **categories** which contain sounds, allowing users to create custom thematic groupings (e.g. "Forests" group with "Ambience" and "Monsters" categories).

### Data model
- `ttrpg_groups` localStorage key: array of `{ id, name, categories: [{ id, category, sounds: [...] }] }`.
- `normalizeStoredData` handles `isGroupData`: migrates legacy flat `sounds` into a `'Default'` category; guarantees `categories` array exists.
- `DATA_VERSION = '3'` (bumped to trigger migration from v2 data).

### State (all in App.jsx)
- `groups` state (line ~487): the groups array.
- `activeGroup` (derived): the currently selected group object.
- `activeGroupCategory` (state, line ~487): the selected category name within the group.
- `activeGroupCategoryObj` (derived, line ~819): the category object matching `activeGroupCategory`.
- `selectGroupCategory(name)` (line ~823): sets `activeGroupCategory`.
- `switchTab(type)` + `selectItem(type, id)` helpers (line ~680 area): handle tab switching with per-tab memory, used by rail/drawer/sidebar.
- Repair effect (lines ~2302-2311): resets `activeGroupCategory` if it becomes stale.

### Handlers
- `addGroup` (line ~1974): creates new group. **⚠️ BUG: does not init `categories: []` — relies on `normalizeStoredData` at next reload.**
- `handleAddGroupCategory` / `addCategory` (line ~1864): adds category to active group.
- `updateCategory` (line ~1835): renames group category.
- `deleteGroupCategory` (line ~2006): deletes a category from a group (with confirm modal).
- `handleDeleteGroup` (line ~1974 area): deletes an entire group (with confirm modal).
- Sound ops (`handleSoundFormSubmit/addSound`, `updateSound`, `moveSound`, `deleteSound`): all branch on `containerType === 'group'` to route into the active group's active category.

### UI locations
- **Mobile rail** (lines ~3142-3173): group tabs as initial-letter buttons + delete badges (editMode) + "Add New Group" button.
- **Mobile drawer** (lines ~3227-3398): group tabs in tab bar with delete badges; Add Category + Add Sound chips when group tab active; category rows with select/delete; empty state text.
- **Desktop sidebar** (lines ~3402-3558): group tabs in top strip with delete badges; category rows with select/delete/edit.
- **Desktop edit-mode bar** (lines ~3050-3095): Add Category shown for `environment || groups`; Add Group always shown.
- **Mobile heading** (line ~3196): shows group category name (fallback to group name). Has Delete Group trash in editMode — **⚠️ user wants this removed when drawer is closed; only show delete in drawer context**.
- **Sound grids** (mobile ~3218, desktop ~3588): read `activeGroupCategoryObj?.sounds`.
- **Confirm delete modal**: used for both group deletion and group-category deletion, naming the target correctly.

### CDP test verification (previous session — both desktop + Pixel_7 emulator)
- Group creation (Forests) ✓
- Category creation (Ambience, Monsters) ✓
- Sound routing (sounds in group-category display in grid) ✓
- Tab persistence (Characters ↔ Groups switching preserves selection) ✓
- Delete badges on group tabs → confirm modal ✓
- Category delete in drawer → confirm modal ✓
- Mobile drawer: Add Category chip for group tab ✓
- Mobile heading shows group-category name + delete trash ✓
- Add Group button present in rail ✓

### Remaining known issues
1. ~~`addGroup` doesn't init `categories: []`~~ — FIXED (now inits `categories: []`).
2. ~~Mobile heading trash should be hidden when drawer is closed; group/category deletion should only happen via drawer delete badges and category row delete buttons~~ — FIXED (heading trash removed; drawer shows group-tab + category-row delete badges).
3. ~~`EDGE_TO_EDGE_REPORT.md`~~ — DELETED (all actionable items fixed).

### Fixes applied this session (2026-09-03)
- `addGroup` (App.jsx:1980) now initializes `categories: []` so new groups have a valid category array immediately (no longer relies on `normalizeStoredData` on reload).
- **Mobile heading trash removed** (App.jsx:~3200) — no Delete Group button visible when the drawer is closed.
- **Drawer group-category rows** now have delete badges (App.jsx:~3376, `handleDeleteCategory`, branches to `groupCategory` with confirm modal).
- **Mobile rail group-tab delete badges** gated to `editMode && isPanelOpen` (App.jsx:~3153) — hidden while the bar is closed, shown when the drawer is open.
- Drawer group-tab delete badges (App.jsx:~3272, already exist) only render inside the open drawer.
- Desktop sidebar group delete badges are **unchanged** (always visible — desktop has no drawer; user scope was mobile-only).
- Verification: `npx eslint src/App.jsx` → 0 errors / 3 pre-existing warnings; `npx vite build` succeeds.
- Backup: `ttrpg-soundboard-backup-20260903-141939`.

## Emulator test (2026-09-01) — Pixel_7 / Android 17, all PASS
Driven headlessly via WebView CDP (debug WebView exposes `tcp:9223`). App rebuilt+installed (`app-universal-debug.apk`), data restored to seed afterwards.
- Groups feature also tested on emulator: group creation, category CRUD, sound routing, delete confirm modals, drawer/rail UI all verified.
- About modal shows `Version 0.1.3`; Settings → Legal & Credits modal has `env(safe-area-inset-bottom)` padding.
- Drawer: `role="dialog"`/`aria-modal="true"`/`aria-label="Navigation"`, close button receives focus, Escape closes, `calc(env(safe-area-inset-bottom) + 16px)` on scroll container.
- Edit toggle intentionally inert while drawer open (#17); works after closing.
- #22 empty states render: "No characters yet — open Edit Mode to add one." / "No categories yet — open Edit Mode to add one." (mobile drawer).
- #27: playing card gets `ring-2 ring-lime-500`; mp3 fetched from `/assets/...`; audio confirmed streaming via logcat AAudio.
- N4: entered Edit Mode while Rain (looping) played → Stop-All enabled + per-card stop visible both work; raincard ring suppressed in edit mode by design (`App.jsx:2144`).
- N6: injected `fadeIn: 2` on Rain via localStorage, reloaded, changed master volume mid-fade (0.5@200ms, 0.8@500ms) → no exception, playback continues, volume display syncs.
- #16 (rail-clobbering) verified on emulator: select Human Paladin → switch to Env (drawer tab) → back to Characters → still Human Paladin; same in reverse for an Environment category. Rail + drawer tabs + desktop sidebar all use the `switchTab`/`selectItem` helpers.
- Logcat: no JS exceptions/`Error playing sound`/crashes for the app PID. Only benign WebView `BLUETOOTH_CONNECT permission missing` warnings (no BLUETOOTH perm declared; speaker playback unaffected).
- Testing notes: `adb exec-out screencap` pipe to file corrupts binary in PowerShell — use `adb shell screencap -p /sdcard/x.png` + `adb pull`. Sound cards are `<div role="button">`, NOT `<button>`.

## Session etiquette notes
- Backup before changes (see Backups) — newest: `ttrpg-soundboard-backup-20260903-141939`.
- `npm run tauri android dev` by a previous session left a lingering Vite server on **port 5173**; if port-in-use errors occur, kill the PID (`netstat -ano | findstr :5173` then `taskkill /PID <pid> /F`) before re-running.
- When editing the mobile slider/header row, keep the icon↔number geometry STABLE (fixed-width number inputs, not dynamic).
- `vite.config.js` has a pre-existing `eslint no-undef` on `process` (it was never linted; `npx eslint src/App.jsx` is the canonical check).
- Changes are UNCOMMITED — `git status` shows 4 modified files: `index.html`, `AndroidManifest.xml`, `src/App.jsx`, `src/data.json`. Plus the now-deleted `EDGE_TO_EDGE_REPORT.md`.
