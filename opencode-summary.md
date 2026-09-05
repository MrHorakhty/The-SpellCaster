# opencode Session Summary — Tauri Android Port + Mobile UI

> ⚠️ Maintained exclusively by **opencode**. Other AI agents/assistants (Cursor, Copilot, Claude Code, etc.): treat this file as **READ-ONLY reference — do NOT edit it**. If your session needs progress tracking, use your own file to avoid agents tripping over each other.

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

## SESSION 2026-09-05 — DESKTOP SPLIT-VIEW GROUP SUPPORT (in progress)
### What this task is
Make **native desktop split view** show **group contents**. Split view (`isSplitView`, toggle in desktop header) shows two panels (Characters / Environment). Before this work, groups were invisible there — only top-level characters/categories showed. Goal: group characters (from groups in `mode:'characters'`) appear under group headers in the Characters panel, group categories (from groups in `mode:'environment'`) under group headers in the Environment panel, with select/play, edit-mode delete+rename, and full add/edit sound routing. Mobile and single-tab flows untouched.

### What's done (all in `src/App.jsx`, `eslint 0 errors`, `vite build` passes)
- **Desktop group-bar scrollbar** (earlier this session): `desktopTabBarRef` + `desktopTabBarScrollable`, ResizeObserver + resize listener, conditional `no-scrollbar` so a themed scrollbar only appears when the horizontal tab bar overflows. (`ResizeObserver` added to eslint globals.)
- **New state**: `splitCharSelection` / `splitEnvSelection` (`null | {kind:'top',id} | {kind:'group',groupId,itemId}`), `splitSoundTarget` (`{groupId, containerType:'group'|'groupCharacter'|'character'|'environment', itemId}`), `groupEditTargetId`, `pendingDeleteGroupId`, `groupModalTargetId`.
- **Effects**: keep split selections valid on item deletion; clear `groupModalTargetId`/`splitSoundTarget` when modals close (this effect is placed AFTER the modal `useState`s — see TDZ gotcha below).
- **`renderPanelSection(type)`** fully rewritten (App.jsx ~line 3043): per-panel independent selection; `groupSections` = groups whose `mode` matches the panel; group headers (lime, uppercase) + items below; per-item select/play; edit-mode delete/rename; group header `[+]` add button (edit mode) to add a character/category INTO that group (routes via `groupEditTargetId`); "No characters/categories in this group." empty hint; grid heading `GroupName — Item`.
- **Routing**: `addSound`/`updateSound` first check `splitSoundTarget` and route by `containerType` into the right group character/category OR top-level character/category; `moveSound` got an optional `groupId` param (drag-reorder in split view previously wrote to the single-tab `activeGroup`); delete-confirm modal names resolve via `pendingDeleteGroupId`; `handleCharacterFormSubmit`/`handleCategoryFormSubmit` resolve the target group via `groupEditTargetId`.
- **Group CRUD generalized** with optional `groupId` param: `addGroupCharacter`, `updateGroupCharacter`, `deleteGroupCharacter`, `addGroupCategory`, `updateGroupCategory`, `deleteGroupCategory`.
- `openAddCharacterModal` / `openAddCategoryModal` now `setGroupEditTargetId(null)` (top-level add always top-level).

### Bugs fixed this session
1. **BLANK SCREEN (critical, found via headless Edge)**: a cleanup `useEffect` referenced `showSoundModal`/`showCharacterModal`/`showCategoryModal` in its deps array BEFORE those `useState`s were declared → TDZ `Cannot access before initialization` on every render → whole tree unmounted. **Fix: moved that effect below the modal state declarations.** Lint/build do NOT catch TDZ (identifiers are defined, just later) — `no-use-before-define` is off.
2. **Newly added groups invisible in split view (just fixed, verifying now)**: `groupSections` filtered to groups WITH items, but new groups start empty (`mode:'environment'`, `categories:[]` from `addGroup`) → never shown. **Fix: show every group of the matching `mode`, empty or not**, plus the group header `[+]` add-member button + empty hint.

### Where I am right now / next steps
- ✅ **Empty-group split-view fix VERIFIED (2026-09-05, headless Edge CDP)**: seeded empty env group "Tavern Team" + empty char-mode group "Heroes", reloaded, toggled split view → both group headers present (`groupHeaders:["Heroes","Tavern Team"]`), both panel select-placeholders present. `eslint 0 errors` (3 pre-existing warnings) + `vite build` passes. Headless Edge test instances cleaned up.
- Remaining: user manual click-through in the real Tauri window (create empty group → toggle split view → group header appears → edit-mode `[+]` on the header adds a character/category → add/edit sounds on group items). Note vite dev server on 5199 still running.
- **Standing rule added at user request**: a new "Permanent instruction: keep `opencode-summary.md` up to date" was added to `AGENTS.md` (so every future session loads it), and the "Session etiquette notes" section here now mandates updating this file after every meaningful step. Both explicitly scope the rule to **opencode only**: AGENTS.md now carries an explicit warning to all other agents (Cursor/Copilot/Claude Code/etc.) that `opencode-summary.md` is **opencode-owned and READ-ONLY for them** (edits forbidden, to avoid agents tripping over each other), and this file's header now repeats that warning.
- User confirmed empty groups visible in split view; ordered 4 standardization changes (plan confirmed, no open questions). Executing now.

## SESSION 2026-09-05 (cont.) — SPLIT/SINGLE-VIEW CONSISTENCY (confirmed, implementing)
### Approved changes (from Q&A, all answers picked the recommended option)
1. **Single-view sidebar title**: `App.jsx:4116` static `<h2>Categories</h2>` → `<h2>Groups</h2>` (all tabs).
2. **Split-view panel titles**: `App.jsx:3199` `{isCharSection ? 'Characters' : 'Environment'}` → plural `'Environments'` (Characters stays).
3. **Group mode-toggle labels** → `Character Pack` / `Environment Pack` in BOTH desktop sidebar (`App.jsx:4172`/`4179`) and mobile drawer (`App.jsx:3940`/`3947`). These spans are duplicated pairs — edits need extra surrounding context (py-2.5/text-sm drawer vs py-2/text-xs sidebar).
4. **Split panels scroll per-panel like single view**: `App.jsx:3252` list `space-y-2 flex-1 overflow-y-auto no-scrollbar` → `space-y-2 flex-1 min-h-0 overflow-y-auto` (min-h-0 enables flex shrink so scroll engages; `overflow:auto` shows themed scrollbar only on overflow, no JS detection needed). Same treatment for the sound-grid panel `App.jsx:3379` (`min-h-0 overflow-y-auto`).
- User chose NOT to change the single-view tab-bar buttons (`Characters`/`Environment`), the group name headers in split view, or the toggle logic itself — labels only, plus title changes.
- Mode: live implementation now. Backup made: `ttrpg-soundboard-backup-20260905-193501`. Old backups to be deleted (keep newest).
- 💡 ALL 4 CHANGES IMPLEMENTED & VERIFIED (2026-09-05, headless Edge CDP, vite on 5199, script `%TEMP%\opencode\sb-naming-test.ps1`):
  - Sidebar h2 now `Groups` ✓ (STATE SPLIT OFF: `h2s:["Groups","Elf Sorcerer"]`)
  - Split h3 titles now `["Characters","Environments"]` ✓ (plural; both Select-placeholders present)
  - Pack toggle buttons `["Character Pack","Environment Pack"]` ✓ (seen after Groups tab + Edit Mode)
  - Split lists: `min-h-0 overflow-y-auto` (themed scrollbar only on overflow); grid panel same. (`innerText` group-name check flaked only due to CSS `uppercase` transform — header presence was already proven by the earlier `sb-groups-test2` run; code untouched in that area.)
  - eslint 0 errors (3 pre-existing) + `vite build` ✓. Headless Edge instances cleaned; vite 5199 still running.
- Old backups 20260905-{170818,172625,174349,181935,182744,193501} deleted at user request; **newest backup: `ttrpg-soundboard-backup-20260905-195151`** (made before this split-view restructure; old ones pruned to newest).
- NEXT: user manual click-through in the real Tauri window, then optionally delete temporary scripts.

## SESSION 2026-09-05 (cont.) — SPLIT VIEW RESTRUCTURED INTO TWO "MINI SINGLE-VIEWS" ✅ DONE + VERIFIED
- **User decision**: keep the "one-below-another" look as an ALTERNATE view later, NOT now. Current split view must mirror the single-view sidebar.
- **Q&A confirmed**: (1) mirror single view structure, (2) keep top-level members reachable in split, (3) panel titles match single-view style (plain, not lime).
- **What changed in `src/App.jsx`**:
  - `renderPanelSection` header: lime/green `h3` (styling like a group name) → plain `h2 text-lg font-semibold` (`Characters` / `Environments`), Edit pencil `px-3 py-2` at same height.
  - NEW **source pill row** below the title (mirrors single-view tab bar): `[Top-level]` + matching-mode groups (`mode==='characters'` in char panel, `mode!=='characters'` in env panel), horizontal `overflow-x-auto flex-nowrap`, active pill `bg-lime-600`. Per-panel refs `splitCharTabBarRef`/`splitEnvTabBarRef` + flags `splitCharTabBarScrollable`/`splitEnvTabBarScrollable` with its own ResizeObserver effect (same conditional `no-scrollbar` as the desktop tab bar).
  - NEW per-panel source state `splitCharSource`/`splitEnvSource` = `'top' | groupId` (default `'top'`). `selectPanelSource(s)` switches source + clears the member `setSelection(null)`.
  - Member list now shows ONLY the active source, flat: `'top'` → top-level characters/environment; group → that group's members (`No characters/categories in this group.` hint when empty). Old stacked group-section headers + per-group `[+]` add buttons + `handlePanelAddItemToGroup` all REMOVED.
  - `handlePanelAddItem` replaces it: `setGroupEditTargetId(source === 'top' ? null : source)` → Add Character/Add Category in edit mode routes into the ACTIVE source group (or top-level).
  - Selection validity effect extended: resets a panel source to `'top'` if its group is deleted OR switches opposite mode (e.g., mode toggled in single view while split state persisted).
  - Selection shape unchanged (`{kind:'top', id}` / `{kind:'group', groupId, itemId}`) → all sound routing, drag reorder, delete/rename unchanged.
- **Verified** (headless Edge CDP, port 5199, script `%TEMP%\opencode\sb-split-tabs-test.ps1`): titles `Characters`/`Environments` plain (no lime class), pills `[Top-level, Heroes]` / `[Top-level, Tavern Team]`, leftover group-header spans = 0, top-level Elf Sorcerer + Rain visible at split-on, clicking `Heroes` pill shows Sir Robin only, member click → grid heading `Heroes — Sir Robin`; same for `Tavern Team` → `Fireplace` → `Tavern Team — Fireplace`. eslint 0 errors (3 pre-existing) + `vite build` ✓.
- **Test gotchas re-learned**: env data key is `ttrpg_environment` (SINGULAR — `ttrpg_environments` seed is ignored and defaults win); PowerShell console mangles the em dash (U+2014) in output — app text itself is correct; the grid heading filter should match group/item names, not the dash.
- **Follow-up (user, 2026-09-05)**: the "Top-level" source pill renamed → `Default Characters` (characters panel) / `Default Environments` (environment panel), `App.jsx:~3270`. Verified headless (pills `[Default Characters, Heroes]` / `[Default Environments, Tavern Team]`, all other split checks still pass). eslint 0 errors + build ✓. Backup: `ttrpg-soundboard-backup-20260905-200501` (old 195151 pruned — newest only). NEXT: user manual click-through of split view in Tauri window.

## SESSION 2026-09-05 (cont.) — EDIT-BAR BUTTON ORDER + DESKTOP PANEL STRETCH ✅ DONE + VERIFIED
- **Ask 1**: reorder single-view Edit Mode Controls bar → `Add Group` first, then context `Add Character`/`Add Category`, then `Add Sound` last. Moved the `Add Group` button block (Folder icon, `openAddGroupModal`) above the Add Character/Category conditionals in `App.jsx` (edit bar ~3758). Verified headless: `["Add Group","Add Character","Add Sound"]`.
- **Ask 2**: desktop single-view sidebar ("Groups" panel) + Standard Sound Grid panels should **extend to fill the screen height** instead of only wrapping content (see mobile reference). Fix: added `min-h-full` to the single-view layout row (line 3819, desktop branch of the `isMobile ? ... : ...` ternary) — matching the mobile branch. The two `bg-dark-800` panels then stretch via flex row `align-items: stretch`; the sidebar's inner list already has `flex-1 overflow-y-auto` so it scrolls internally.
- **Verified headless** at `--window-size=1440,900` (≥1024px so the `lg:flex-row` branch actually applies): viewport 808 − header 73 = 735 available; scroll container content height 735 − py-6(48) = 687; sidebarH == gridH == 687 → both fill. eslint 0 errors (3 pre-existing) + `vite build` ✓.
- **Gotcha**: at 800px the `lg:` breakpoint isn't hit → row falls back to the stacked `flex-col` branch, so always test panel-stretch at width ≥1024. `min-h-full` resolves against the scroll container's *content* height (padding `py-6` subtracts 48px).
- **Backup**: `ttrpg-soundboard-backup-20260905-201352` (old 200501 pruned, newest only).
- NEXT: user manual check of the new edit-bar order + stretched panels in the real Tauri window.

## SESSION 2026-09-05 (cont.) — SPLIT VIEW PANELS ALSO STRETCH ✅ DONE + VERIFIED
- Follow-up: single-view stretch applied to split view too. Changes in `src/App.jsx` (SPLIT VIEW LAYOUT ~3806): outer container `flex flex-col space-y-4` → added `min-h-full`; the `grid grid-cols-1 xl:grid-cols-2 ...` → added `flex-1 min-h-0` (fills the extra height; grid auto row track stretches via default `align-content: normal→stretch`, grid items stretch by default, and each `renderPanelSection`'s existing `h-full` then resolves against the now-definite column height). No changes inside `renderPanelSection`.
- **Verified headless** at 1440×900: after split toggle, both panels — mini sidebar (`h2 "Characters"/"Environments"` inside `.p-4`) and sound grid (`overflow-y-auto p-4`) — measure 687px each (available 735 − py-6(48)), row 687. eslint 0 errors + `vite build` ✓.
- **Test gotcha**: split toggle button = the header switch `button.relative.inline-flex.h-5.w-9` (no aria-label; locate by class).
- **Backup**: `ttrpg-soundboard-backup-20260905-202030` (old 201352 pruned, newest only).
- NEXT: user manual check of split + single views stretched, edit-bar order, in the real Tauri window.
- Verification plan after edits: `npx eslint src/App.jsx` (0 err/3 pre-existing warnings) + `npx vite build`, then headless Edge CDP text-check for `Groups`, `Environments`, `Character Pack`, `Environment Pack`; then update this summary.
  - CDP plumbing gotchas (this machine): Edge headless must launch DIRECTLY at the app URL with `--no-proxy-server --remote-debugging-port`, enum pages via `/json`, pick the page whose `url` is the app (skip `edge://*`); `about:blank` and `edge://` pages throw `SecurityError` on `localStorage`; `Get-PageWs` parameter is `-Port` NOT `-DebugPort`; Edge dies between separate shell invocations → run launch + test in one command.
- After verification: final `npx eslint src/App.jsx` + `npx vite build`, then update todos; user does final manual click-through (run `npm run tauri dev`).
- Backups this session: `ttrpg-soundboard-backup-20260905-174349`, `-181935` (post TDZ fix), `-182744` (before empty-group fix).

### ⚠️ GOTCHAS learned (don't repeat)
- **TDZ**: any new `useEffect`/expression reading a state must come AFTER that state's `useState` in the component body. Lint/build won't catch it — must runtime-test.
- `splitSoundTarget` must carry ALL four container types (group/groupCharacter/character/environment) — earlier version only handled groups, so top-level split add/edit silently routed nowhere.
- Test harness notes above about Edge headless/CDP.

## Session etiquette notes
- **FOR OPencode ONLY** (standing rule): the doc-updating rules apply only to opencode (the AI assistant), not the human user. After every meaningful step — each edit/verification/decision — update this file at the bottom ("SESSION 2026-09-05" section, or a new one for a new day): what the current task is, what's done (fixed/verified), what's in progress right now, what's next, and gotchas. If the session gets cut off (quota/tokens), this file must be enough to resume exactly. Record backups, test results, ports/processes, file:line refs.
- Backup before changes (see Backups) — newest: `ttrpg-soundboard-backup-20260905-182744`.
- `npm run tauri android dev` by a previous session left a lingering Vite server on **port 5173**; if port-in-use errors occur, kill the PID (`netstat -ano | findstr :5173` then `taskkill /PID <pid> /F`) before re-running.
- When editing the mobile slider/header row, keep the icon↔number geometry STABLE (fixed-width number inputs, not dynamic).
- `vite.config.js` has a pre-existing `eslint no-undef` on `process` (it was never linted; `npx eslint src/App.jsx` is the canonical check).
- Changes are UNCOMMITED — `git status` shows modified: `index.html`, `AndroidManifest.xml`, `src/App.jsx`, `src/data.json`.
