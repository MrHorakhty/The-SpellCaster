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
- `ttrpg-soundboard-backup-20260903-143404` (newest — pre group character/group mode toggle; groups feature + fixes uncommitted).
- `ttrpg-soundboard-backup-20260903-141939` (pre rail-delete-badge fix).
- Previous: `ttrpg-soundboard-backup-20260901-154654` (pre-#16 fix, groups not yet started).
- Older backups from this work were deleted by the user after each new backup was made.

## Next likely work
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
- `ttrpg_groups` localStorage key: array of `{ id, name, mode, categories: [{ id, category, sounds: [...] }], characters: [{ id, name, sounds: [...] }] }`.
- `mode` is `'characters'` | `'environment'` (default `'environment'`); each group independently remembers its mode.
- `normalizeStoredData` handles `isGroupData`: migrates legacy flat `sounds` into a `'Default'` category; guarantees `categories` and `characters` arrays exist; defaults `mode` to `'environment'` for legacy data (no data reset needed).
- `DATA_VERSION = '3'` (bumped to trigger migration from v2 data).

### State (all in App.jsx)
- `groups` state: the groups array.
- `activeGroup` (derived): the currently selected group object.
- `activeGroupCategory` (state): the selected category name within the group.
- `activeGroupCategoryObj` (derived): the category object matching `activeGroupCategory`.
- `activeGroupCharacterId` (state): the selected character id within the group.
- `activeGroupCharacter` (derived): the character object matching `activeGroupCharacterId`.
- `selectGroupCategory(name)`: sets `activeGroupCategory`.
- `selectGroupCharacter(id)`: sets `activeGroupCharacterId`.
- `toggleGroupMode(groupId)`: **converts** the group between `'characters'` and `'environment'` representation (NOT a view-hide toggle):
  - environment → characters: each category is **converted into a character** (`name` ← `category`, sounds carried over), then `categories` is cleared.
  - characters → environment: each character is **converted into a category** (`category` ← `name`, sounds carried over), then `characters` is cleared.
  - So a group holds one representation at a time; names/sounds survive the round-trip (only container ids regenerate, e.g. `Ambience` category becomes an `Ambience` character with a Person icon).
- `switchTab(type)` + `selectItem(type, id)` helpers: handle tab switching with per-tab memory, used by rail/drawer/sidebar.
- Repair effect: keeps selection valid — for environment mode defaults to first category; for characters mode defaults to first character.

### Handlers
- `addGroup`: creates new group with `mode: 'environment'`, `categories: []`, `characters: []`.
- `addCategory` / `updateCategory` / `deleteGroupCategory`: route into group categories (environment mode).
- `addGroupCharacter` / `updateGroupCharacter` / `deleteGroupCharacter`: route into group characters (characters mode).
- `handleCharacterFormSubmit`: branches — group character mode validates/adds/edits within the group's `characters`; otherwise top-level characters.
- `handleDeleteCharacter` / `handleEditCharacter`: branch on `tabType === 'groups'` to target group characters.
- Sound ops (`addSound`, `updateSound`, `moveSound`, `deleteSound`, `deleteGroup`, confirm modal): branch on group `mode` — characters mode routes into `group.characters[n].sounds` (containerType `'groupCharacter'`), environment mode into `group.categories[n].sounds` (containerType `'group'`).

### UI locations
- **Mobile rail**: group tabs as initial-letter buttons + delete badges (editMode + drawer open) + "Add New Group" button.
- **Mobile drawer**: group tabs with delete badges; **segmented Characters/Environment toggle** (editMode, group tab active) with User/Music icons (44px); Add Character/Add Category + Add Sound chips branch on group mode; character rows (User icon) vs category rows (Music icon) with delete badges; mode-specific empty states.
- **Desktop sidebar**: group tabs with delete badges; **segmented Characters/Environment toggle** (editMode, group tab active); character rows vs category rows with select/delete/edit.
- **Desktop edit-mode bar**: Add Character shown for group-character mode or top-level characters; Add Category shown for environment or group-environment mode; Add Group always shown.
- **Mobile + desktop headings**: show group character name (characters mode) or group category name (environment mode), fallback to group name.
- **Sound grids**: read `activeGroupCharacter?.sounds` (characters mode) or `activeGroupCategoryObj?.sounds` (environment mode).
- **Confirm delete modal**: names group deletion, group-category deletion, and group-character deletion targets correctly.

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
- **Character/Group mode toggle**: added this session, code-verified (lint + build) but NOT yet run on emulator/desktop.

### Remaining known issues
1. ~~`addGroup` doesn't init `categories: []`~~ — FIXED (now inits `categories: []`).
2. ~~Mobile heading trash should be hidden when drawer is closed; group/category deletion should only happen via drawer delete badges and category row delete buttons~~ — FIXED (heading trash removed; drawer shows group-tab + category-row delete badges).
3. ~~`EDGE_TO_EDGE_REPORT.md`~~ — DELETED (all actionable items fixed).
4. ~~Character/Group mode toggle button highlighting was inverted (both lime in environment mode, neither green in characters mode)~~ — FIXED: Characters is green when `mode==='characters'`, Environment green when `mode!=='characters'` (exactly one always green), in both drawer + desktop sidebar.
5. ~~Toggle was view-hide only (categories vanished instead of converting)~~ — FIXED: toggle now **converts** entries between category ↔ character representations.
6. ~~Character/Group mode toggle needs on-device verification~~ — **VERIFIED on Pixel_7 emulator via WebView CDP (2026-09-03)**:
   - Button highlighting: exactly one green at a time — Environment lime in env mode, Characters lime in char mode (checked via computed background of the `flex-1` segmented buttons).
   - Conversion environment→characters: seed group Forest [Ambience(Wind), Monsters] → after toggle `mode:'characters'`, `categories:[]`, `characters:[{name:Ambience,sounds:[Wind]},{name:Monsters,sounds:[]}]` — sounds carried over.
   - Conversion characters→environment: round-trips back to categories keeping the Wind sound.
   - Test scripts cleaned up; adb forward removed.

### Fixes/features applied this session (2026-09-03)
- `addGroup` (App.jsx:~1980) now initializes `categories: []` so new groups have a valid category array immediately.
- **Mobile heading trash removed** — no Delete Group button visible when the drawer is closed.
- **Drawer group-category rows** now have delete badges (`handleDeleteCategory`, branches to `groupCategory` with confirm modal).
- **Mobile rail group-tab delete badges** gated to `editMode && isPanelOpen` — hidden while the bar is closed, shown when the drawer is open.
- Drawer group-tab delete badges only render inside the open drawer.
- Desktop sidebar group delete badges are **unchanged** (always visible — desktop has no drawer; user scope was mobile-only).
- **NEW: Character/Group mode toggle for groups** — per-group `mode`, segmented toggle in drawer + sidebar, branching Add buttons, character/category rows, grid/heading routing, and full group-character CRUD. Backup: `ttrpg-soundboard-backup-20260903-143404`.
- **Group mode toggle fixes (same day)**:
  - **Button highlighting fixed** — the Characters toggle button had inverted logic (both pills lime in environment mode / neither green in characters mode). Now exactly one is green: Characters green when `mode==='characters'`, Environment green when `mode!=='characters'` (drawer App.jsx:~3479 + desktop sidebar App.jsx:~3712).
  - **Toggle now CONVERTS data** instead of hiding — per user clarification, switching a group to Characters mode converts each category into a character (name+sounds kept, e.g. `Ambience` category → `Ambience` character); switching back converts characters into categories. `toggleGroupMode` (App.jsx:~2483) clears the source array and regenerates container ids; names/sounds survive round-trip.

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

## Emulator test (2026-09-03) — group mode toggle CONVERSION + HIGHLIGHT
Driven headlessly via WebView CDP. The running debug app serves the frontend from the Vite dev server (port 5173) — the served `/src/App.jsx` was confirmed to contain the reworked `toggleGroupMode` (conversion) before testing, so the running app reflected the latest code (no reinstall needed).
- CDP plumbing on this machine: emulator console `5554` ≠ app pid. The abstract socket is **`webview_devtools_remote_<app-pid>`** (the app pid from `adb shell ps -A | grep spellcaster`), NOT `_5554`. Command: `adb forward tcp:9223 localabstract:webview_devtools_remote_<pid>` → `curl http://127.0.0.1:9223/json`. Navigation via `Runtime.evaluate` clicking real `<button>` elements by aria-label / innerText.
- Seed: `localStorage.ttrpg_groups` = `[{id:'gt1', name:'Forest', mode:'environment', categories:[{category:'Ambience', sounds:[Wind]},{category:'Monsters', sounds:[]}], characters:[]}]`, then `Page.reload`.
- Drive sequence: rail "Enter Edit Mode" → drawer "Open navigation" → drawer group tab "Forest" → segmented toggle clicks.
- **Highlight ✓**: exactly one segmented button lime at a time — Env lime in env mode, Characters lime in char mode (via `bg-lime-600` class + computed background of the `flex-1` buttons).
- **Conversion ✓ (env→characters)**: after clicking "Characters", storage = `mode:'characters'`, `categories:[]`, `characters:[{name:'Ambience',sounds:[Wind]},{name:'Monsters',sounds:[]}]` — categories became characters, `Wind` sound carried over.
- **Conversion ✓ (characters→env)**: after clicking "Environment", storage = `mode:'environment'`, `categories:[{category:'Ambience',sounds:[Wind]},{category:'Monsters',sounds:[]}]`, `characters:[]` — round-trips cleanly preserving names + sounds (container ids regenerate each toggle).
- Test scripts cleaned up from `%TEMP%\opencode`; `adb forward` removed afterwards.

## Session etiquette notes
- Backup before changes (see Backups) — newest: `ttrpg-soundboard-backup-20260903-143404`.
- `npm run tauri android dev` by a previous session left a lingering Vite server on **port 5173**; if port-in-use errors occur, kill the PID (`netstat -ano | findstr :5173` then `taskkill /PID <pid> /F`) before re-running.
- When editing the mobile slider/header row, keep the icon↔number geometry STABLE (fixed-width number inputs, not dynamic).
- `vite.config.js` has a pre-existing `eslint no-undef` on `process` (it was never linted; `npx eslint src/App.jsx` is the canonical check).
- Changes are UNCOMMITED — `git status` shows modified: `index.html`, `AndroidManifest.xml`, `src/App.jsx`, `src/data.json`.
