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
- `ttrpg-soundboard-backup-20260907-155920` (newest — pre E2E; old 20260907-152054 pruned).

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

## SESSION 2026-09-07 — DESKTOP SINGLE-VIEW SOUND GRID NOW SCROLLS INDEPENDENTLY ✅
- **Ask**: "If there are a lot of sounds in a single panel, will it unlock scrolling on its own? If not it should" — desktop version only.
- **Was**: desktop single-view "Standard Sound Grid" (`App.jsx:4387`) had `flex-1 min-w-0` **but no `overflow-y-auto`/`min-h-0`** → it grew with content and the WHOLE page scrolled (sidebar + grid together). Split-view panels already scrolled internally; single-view did not.
- **Fix (3 one-line class changes, desktop single-view only) — `src/App.jsx`**:
  1. Main-content wrapper `App.jsx:3748`: `flex-1 overflow-y-auto w-full …` → added `flex flex-col` (so its child can be a height-bounded flex item). Behavior-neutral for mobile + split (verified reasoning: their wrappers use `min-h-full`, unchanged; they still whole-page scroll).
  2. Single-view layout row `App.jsx:3819` desktop branch: `… gap-6 min-h-full` → `… gap-6 flex-1 min-h-0` (row now bounded to the content area instead of growing). Mobile branch untouched.
  3. Sound-grid panel `App.jsx:4387`: `flex-1 min-w-0 bg-dark-800 rounded-xl p-6` → `flex-1 min-w-0 min-h-0 bg-dark-800 rounded-xl p-6 overflow-y-auto` (scrolls internally).
  - Sidebar (already `flex-col` + inner `flex-1 overflow-y-auto no-scrollbar` list at 4246) stays fixed; grid scrolls; on <1024px (flex-col fallback) old whole-page scroll still takes over — acceptable.
- **Verified**: `npx eslint src/App.jsx` 0 errors (3 pre-existing warnings) ✓ · `npx vite build` ✓ · **headless Edge CDP** (vite preview :5233, remote-debug :9333, seed 60 sounds via localStorage):
  - Grid panel `clientH 687 / scrollH 1636` (hasFlexWrapGrid); `scrollTo(bottom)` → `scrollTop 949`, clippedAtBottom true.
  - Page didn't move: `windowScrollY 0`, `docScrollH 808 == viewport 808`; sidebar `top 97` before and after scrolling.
  - **Harness gotcha**: naive finder matched the outer main-content wrapper first (its `scrollH == clientH`, so scrollTop never moved and looked "stuck") — must filter finder to `scrollHeight > clientHeight`. Initial misleading runs were a TEST bug, the app was correct all along.
- **Backup**: `ttrpg-soundboard-backup-20260907-142054` (newest; old 20260905-202030 pruned to newest). Now only `src/App.jsx` modified vs git.
- **NEXT**: user manual check in the real Tauri window (desktop single view, many sounds → grid scrolls, sidebar fixed). Test scripts in `%TEMP%\opencode\` (sb-scroll-test.ps1, sb-scroll-cdp.mjs); processes cleaned up.

## SESSION 2026-09-07 (cont.) — PRE-COMMIT END-TO-END TESTING ✅
- **User asked for E2E testing before committing the scroll changes. Done — PASS=45, FAIL=0, WARN=3.**
- Build/test gates: `npx eslint src/App.jsx` 0 errors (3 pre-existing warnings) ✓ · `npx vite build` ✓.
- **Test harness**: headless Edge CDP (vite preview :5233, remote-debug :9333), seed 60 char sounds / 60 env sounds / 2 groups, script `%TEMP%\opencode\sb-e2e-full.mjs` + `sb-e2e-run.ps1` (all in `%TEMP%\opencode\`, NOT in repo).
- **Suite A (single-view scroll) — 10/10 PASS**: grid panel (`bg-dark-800 … overflow-y-auto`) scrollH=1636/clientH=687, scrollTo(bottom)→scrollTop=949, window.scrollY=0, docScrollH==innerH (808), sidebar pinned at top=97 before/after, no horizontal overflow.
- **Suite B (split-view scroll) — PASS except expected WARN**: 2 panels found; clicked Human Paladin in the split Characters panel (note: split view has NO `lg:w-64` sidebar — the earlier click selector was wrong and was the cause of one "Suite B" failure) → panel 0 scrollH=4740/clientH=687, scrollTo(bottom)→4053, page pinned. Panel 1 WARN (environment panel, nothing selected → empty, nothing to scroll — correct).
- **Suite C (regression) — 30 checks, 0 FAIL, 3 WARN**: structure/sidebar/nav/tab-persistence/edit-mode/sliders/settings/themes/data all PASS. WARNs: C18/C19 (playback ring test — seed data has no real .mp3 so audio can't start; known test limitation, not app bug). C20/C21 etc fine.
- **Test-script gotchas this session**: (1) find-the-grid by vague `.flex.flex-wrap` descendant matched the outer main-content wrapper FIRST (scrollH==clientH → looked "not scrolling") — must target the `bg-dark-800 … overflow-y-auto` grid panel explicitly. (2) `\'` inside a backtick template literal sent to CDP turns into a bare apostrophe → `SyntaxError: missing ) after argument list` in the injected page JS; use double-quoted inner strings ("B4: page didn't scroll") instead.
- **Backup**: newest now `ttrpg-soundboard-backup-20260907-155920` (old 20260905-202030, 20260907-142054, 20260907-152054 deleted at user request — newest kept only).
- **NEXT**: user commit of `src/App.jsx` (+ opencode-summary.md) on `mobile-support` branch.

## SESSION 2026-09-07 (cont.) — SPLIT VIEW PANELS NOW SCROLL INTERNALLY TOO ✅
- **Ask**: "does split view also scroll like this?" — answer was NO at first: split panels already had `overflow-y-auto min-h-0` on their grid (`App.jsx:3441`), but the two-panel CSS grid's **auto rows expand to content**, so panels grew and the whole page scrolled again (same class of bug single view just had).
- **Fix — `src/App.jsx`** (2 spots this step):
  1. Split wrapper `App.jsx:3807`: `flex flex-col space-y-4 min-h-full` → `flex-1 min-h-0` (wrapper bounded to content area; main-content is now `flex flex-col` from the single-view fix).
  2. Split panel row `App.jsx:3808`: `grid grid-cols-1 xl:grid-cols-2 …` → **`flex flex-col xl:flex-row gap-6 flex-1 min-h-0 divide-y xl:divide-y-0 xl:divide-x divide-dark-700`**; the two panel columns (`3809/3812`) got `flex-1 min-w-0 min-h-0` (kept `pr-0 xl:pr-4` / `pt-6 xl:pt-0 xl:pl-4`). CSS-grid auto rows were the root cause — row height chased content, so `h-full` panels followed it; flex + `min-h-0` bounds them. Tailwind `divide-*` still works on flex children.
- **Verified**: eslint 0 errors (3 pre-existing) ✓ · `vite build` ✓ · headless Edge CDP (same preview:5233 / remote-debug:9333, seed 60-sound char, toggle split switch, click "Seed Wizard"):
  - Sound-grid panel `clientH 687 / scrollH 4740`, `scrollTo(bottom)` → `scrollTop 4053`, bottom reached.
  - Page pinned: `windowScrollY 0`, `docScrollH 808 == viewport`; main-content `735/735` (no whole-page scroll). Env panel `687/687` (placeholder, nothing selected — expected).
  - **Key learning**: bounding the WRAPPER alone isn't enough for split — the inner panel ROW must be flex (not CSS grid auto rows) or the tracks still grow to content. `flex-1 min-h-0` on the wrapper + row + each panel column.
- **Backup**: `ttrpg-soundboard-backup-20260907-152054` (newest; 142054 pruned to newest). `git status`: only `src/App.jsx` modified.
- **NEXT**: user manual check in real Tauri window (single view + split view, many sounds → each grid scrolls, sidebar fixed). Test scripts `%TEMP%\opencode\sb-split-scroll{,-test.ps1,-cdp.mjs,-2.mjs,-3.mjs}`; processes cleaned up.

## SESSION 2026-09-11 — E2E TEST: WEBVIEW (browser) + WINDOWS PROGRAM (Tauri) ✅ (no code changes)
- **User request**: "end to end test on webview and windows program versions. Don't change anything just do the test and report back."
- **Confirmed no code changes**: `git status` unchanged after the run (`src/App.jsx`, `opencode-summary.md` only); `dist/` + `src-tauri/target/` gitignored (vite build output + debug binary). NO backup was needed (nothing changed).
- **Test harness** (all in `%TEMP%\opencode\`, NOT in repo — same pattern as previous sessions):
  - `e2e-run.mjs` — generalized single suite parameterized via env: `CDP_PORT`, `LABEL`, `EXPECT_TAURI` (1/0), `SAVE_RESTORE` (1 = capture all localStorage before seeding, restore + reload after). Seeding now uses the CORRECT env key `ttrpg_environment` (SINGULAR — `ttrpg_environments` is ignored by the app, a latent bug in the old 9/7 seed). Covers: platform (P1–P6), single-view scroll (A1–A10), split-view scroll (B0–B7 + source-pill listing), regression feature matrix incl. env tab loads Forest (C1–C34, incl. About → Version 0.1.3, number inputs, sliders, themes, data keys, viewport fills).
  - `e2e-all.ps1` — Phase A: `vite build` (via `cmd /c` to swallow the benign INEFFECTIVE_DYNAMIC_IMPORT warning) → `vite preview :5233` → headless Edge CDP :9333 (fresh profile `e2e-web-profile`) → suite with `EXPECT_TAURI=0`. Phase B: set `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9224 --remote-allow-origins=*`, launch `npm run tauri dev` detached, poll `http://127.0.0.1:9224/json` (up to 15 min), suite with `EXPECT_TAURI=1 SAVE_RESTORE=1`. NOTE: PS `$ErrorActionPreference='Stop'` makes the npx vite build stderr warning throw → use 'Continue' + `cmd /c ... 2>&1`.
- **RESULTS — Phase A (webview, browser via headless Edge @ localhost:5233)**: **PASS=57 FAIL=0 WARN=3** (WARNs all expected: C18/C19 no real .mp3 in seed so no playback ring; split env panel empty-not-scrollable). Viewport 1416×808; single-view grid scrolls independently (scrollH 1636/clientH 687, page pinned, sidebar pinned top=97); split OK; pills `Default Characters|Default Environments`.
- **RESULTS — Phase B (Windows program, `src-tauri/target/debug/app.exe`, page @ localhost:5173 via WebView2 CDP)**: **PASS=57 FAIL=0 WARN=3** (same expected WARNs; split env panel is a placeholder). Viewport 1200×800 (window 1200×800 from tauri.conf.json); single-view grid scrolls (scrollH 1948/clientH 679); split panels scroll internally (panel0 scrollH 1932/clientH 315); page pinned throughout; `isTauri=true` verified; **desktop app real data protected**: 6 localStorage keys captured and restored, `localStorage.restore: restored` + reload confirmed before app kill.
- **Processes/ports**: after cleanup → no listeners on 5173/5233/9333/9224, no app.exe/msedge test procs. ⚠️ gotcha: the runner's kill-by-cmdline didn't reach the Tauri-launched `app.exe` (survived the npm wrapper), so `e2e-all.ps1` Phase B cleanup was supplemented manually: `Stop-Process -Id <app-pid>` + the msedgewebview2.exe child (PID holding 9224). The `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` approach works reliably for driving the real Windows webview headlessly.
- **Backup**: none needed (no changes). Oldest-known data concern: none. `git status`: only `src/App.jsx` + `opencode-summary.md` modified (pre-existing, uncommitted).
- **NEXT**: report handed to user (this session). No open items; user's choice on committing the uncommitted changes.

## SESSION 2026-09-11 (cont.) — HARNESS HARDENED: robust process-lifecycle `e2e-all.ps1` ✅
- **User request**: rewrite `e2e-all.ps1` (the primary E2E PowerShell runner) to prevent terminal hangs during test execution with 5 strict requirements. All implemented + parse-verified:
  1. **Process Capture**: every background launch (`vite preview` Phase A, headless Edge Phase A, `npm run tauri dev` Phase B) now uses `Start-Process -PassThru` → held in `$previewProc` / `$edgeProc` / `$tauriProc` (the npm wrapper PID captured).
  2. **Try/Finally**: each phase's ENTIRE body (launch → wait → suite) is wrapped in `try { } finally { }`, so cleanup runs even if a test crashes (node throws, CDP times out, etc.).
  3. **Output Redirection**: node runner output (`node e2e-run.mjs`) is piped to a timestamped log `%TEMP%\opencode\e2e-run-<yyyyMMdd-HHmmss>.log` (`>> $Script:TestLog 2>&1` inside `Invoke-TestSuite`) — nothing printed to the terminal, no buffer truncation. Status/progress lines + summary still go to console.
  4. **Hard Timeout**: `Assert-NotTimedOut` checks `Script:TestStartTime` every check-in point (`≥15 min` → logs + red message + `exit 1`). Bonus: Phase B already had an independent 15-min CDP readiness deadline poll on `:9224`.
  5. **Aggressive Cleanup** in the `finally` blocks: `Stop-ProcessTree` on the captured PIDs (`$Proc.Kill($true)` — .NET tree-kill + `Stop-Process -Force` fallback), then `Remove-Orphans` (CIMInstance sweep for `*ttrpg-soundboard*`, `*vite*{preview,5173}*`, debug-port `msedge`/`msedgewebview2`), then the requested blanket `Get-Process -Name msedgewebview2 | Stop-Process -Force`, then env-var/profile cleanup (`WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS`, Edge profile dirs).
- **PS 5.1 gotcha hit**: the `≥`/`—` characters in `Assert-NotTimedOut` strings caused **parse errors** (`Unexpected token 'tests'`). Fix: ASCII `>=` / `--` in code strings only (comments with `═`/`─`/`→` are fine). Verify with `[System.Management.Automation.Language.Parser]::ParseFile(...)` → `PARSE OK`.
- **Note**: Phase A cleanup also removes the Edge profile dir (headless run leaves no junk). Known: `$Proc.Kill($true)` on the npm wrapper may not reach the Tauri-spawned `app.exe`/`msedgewebview2.exe` — that's why `Remove-Orphans` + the blanket webview kill exist as the net.

## SESSION 2026-09-11 (cont.) — E2E HARNESS MOVED INTO THE REPO → `e2e/` ✅
- **User request**: move the E2E harness out of `%TEMP%\opencode` into the project so it can be referenced when an E2E test is requested. Q&A: (1) move **all E2E files**, (2) target **`e2e/` subfolder**.
- **Now in repo** `C:\Users\emire\Projects\ttrpg-soundboard\e2e\`: `e2e-all.ps1` (primary runner — the hardened one), `e2e-run.mjs` (basic suite, env CDP_PORT/LABEL/EXPECT_TAURI/SAVE_RESTORE), `e2e-features.ps1` + `e2e-features.mjs` (deep feature suite, uses WAV upload), `e2e_silence.wav`.
- **Path fixes for relocation** (temp originals deleted — repo copy is now the single source of truth):
  - `e2e-all.ps1`: `$proj = Split-Path -Parent $PSScriptRoot`; `Invoke-TestSuite` runs `node (Join-Path $PSScriptRoot $Mjs)`. Logs/profiles/Edge-profile still go under `%TEMP%\opencode\` (runtime artifacts stay out of the repo).
  - `e2e-features.ps1`: same `$proj` derivation; `$harness = $PSScriptRoot` → `node "$harness\e2e-features.mjs"`.
  - `e2e-features.mjs`: `WAV` is now `join(dirname(fileURLToPath(import.meta.url)), 'e2e_silence.wav')` (module-relative; the script self-regenerates the WAV on each run).
  - `e2e-run.mjs`: had NO temp-path references — untouched.
- **Verified**: both ps1 `PARSE OK` (Parser::ParseFile), both mjs `node --check` OK.
- **How to run now**: `powershell -NoProfile -ExecutionPolicy Bypass -File e2e\e2e-all.ps1 -Phase web` (and/or `-Phase win`) from the project root; deep feature run = `e2e\e2e-features.ps1`.
- **Backup**: `ttrpg-soundboard-backup-20260911-153349` (made before this change; newest. Old 20260907-155920 kept — did not prune without user request).

## SESSION 2026-09-11 (cont.) — DEEP FEATURE E2E (upload/playback/theme/CRUD/persistence) — IN PROGRESS (no code changes)
- **User pushed back**: the 57-check run only proved scroll/layout. Asked whether volume, local file saves, custom icon colors etc. actually work. Task: deeper E2E without changing app code.
- **New harness** (MOST RECENT session — since moved into the repo at `e2e\`, see the "HARNESS MOVED INTO THE REPO" section above; the below describes the harness itself):
  - `e2e-features.mjs` — deep suite, env: `CDP_PORT`, `LABEL`, `EXPECT_TAURI`, `SAVE_RESTORE`. Suites: D (add sound: real WAV upload via `DOM.setFileInputFiles`, submit, color #ff0000, loop, fadeIn=2, persistence + platform file entry), E (live playback via patched `HTMLMediaElement.prototype.play/pause` → `window.__e2eAudio`; volume, fade-in ramp, manual loop rewind, Stop All), F (theme Forest F1–F3, add character + sound persistence + reload F4–F8), G (add env sound, delete sound via modal, delete character).
  - `e2e-features.ps1` — Phase A web: vite preview :5233 + headless Edge :9334 (fresh `e2e-feat-profile`, `--autoplay-policy=no-user-gesture-required`). Phase B win: `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS='--remote-debugging-port=9225 --remote-allow-origins=*'` + `npm run tauri dev`, polls `:9225/json` up to 15 min; asserts uploads-dir proof (`%APPDATA%\com.mrhorakhty.thespellcaster\uploads` — runner deletes non-e2e test files, keeps `*_e2e_silence.wav`); `SAVE_RESTORE=1` snapshots+restores localStorage; cleanup kills `*ttrpg-soundboard*`, msedgewebview2 w/ debug port, node/vite. Exit codes 0/1/2 (pass/warn/fail).
  - `e2e_silence.wav` — 20s mono 8kHz silent WAV (long enough for fade-in + loop rewind) generated for uploads.
- **Phase A first run FAILED at D3** then again at D7: root cause is a **TEST SELECTOR BUG, NOT an app bug**. The edit-bar "Add Sound"/"Add Character" buttons have NO explicit `type`, so they default to `type='submit'`; my submit-button finder (text + type=submit + first match) hit the EDIT-BAR button (styling `bg-dark-700 px-3 py-1`) BEFORE the modal's real submit (styling `bg-lime-600 px-4 py-2`). Clicking it re-ran `openAddSoundModal()` instead of submitting → modal never closed, nothing saved. Diagnosed via diag2-submit.mjs: form `checkValidity()=true`, invalid=NONE, upload label "1 file uploaded", zero React console errors — proving app side healthy. The `Toggle Edit Mode` click was ALSO wrong first time (icon-only button, no text) — fixed earlier to `button[title="Toggle Edit Mode"]` click; active styling confirmed `bg-lime-600` (App.jsx:3252).
- **Mid-run state (before this wrap)**: Phase A deep suite: PASS=9 FAIL=25 WARN=0 (F1–F3 theme PASS, F8 theme persistence PASS, real WAV upload + label PASS; everything needing a real modal submit FAILED). Phase B (win) NOT run. D2 edit-mode check now classList-scoped (`lime|lime-600|bg-lime`); volume slider selector accepts `max==='1'||max==='1.0'` (2 places); G4 clicks Characters tab first.
- **FIX APPLIED to harness only**: all 3 modal submits in e2e-features.mjs (lines ~148, ~269, ~316) now scoped `x.type==='submit' && /bg-lime-600/.test(x.className)` so the modal button is matched, not the edit-bar default-submit button. Opening the modal still via `window.__clickText('Add Sound'/'Add Character')` (edit-bar first match opens the same modal — fine).
- **Cleanup DONE**: diag scripts/profiles/logs removed; processes killed; all test ports free (5233, 9334, 9225, diag 9336/9337, old 9333/9224) confirmed via Get-NetTCPConnection; `git status` unchanged (only pre-existing `src/App.jsx` + `opencode-summary.md`). No backup needed (no repo changes).
- **NEXT (resume point)**: rerun `powershell -NoProfile -ExecutionPolicy Bypass -File e2e\e2e-features.ps1 -Phase web` (expect D→F→G to pass now that modal submit targets lime button; E tests also depend on a real sound existing), then `-Phase win` (SAVE_RESTORE + uploads-dir proof). Report PASS/FAIL/WARN per platform and append results here.

## SESSION 2026-09-11 (cont.) — COMPREHENSIVE `e2e-full.mjs` SUITE VALIDATED (web + Tauri) ✅ DONE
- **User request (resumed)**: finish hardening the E2E harness and validate the new comprehensive `e2e-full.mjs` suite in both Phase A (web) and Phase B (win).
- **Changes made this session** (test harness ONLY — no app code touched):
  - `e2e\e2e-all.ps1`: added `[string]$Suite = 'full'` param → `$Script:MjsFile = "e2e-$Suite.mjs"`; both `Invoke-TestSuite` calls now pass `-Mjs $Script:MjsFile`. Default suite is now `full` (was `run`). Parse OK.
  - `e2e\e2e-full.mjs` fixes (all `node --check` OK):
    1. **B3 `localStorage` ReferenceError (FATAL)**: line 687 called `localStorage.getItem('boxSize')` in Node context → wrapped in `evalJs`.
    2. **log() outputs status word** (`[CAT] PASS/FAIL/WARN …`) instead of glyph-only — PS5.1 log round-trip corrupts ✓/✗/⚠ (UTF-16/ANSI mix), making FAILs greppable.
    3. **E1/E2/J1/D1/D4 selector bug**: app nests edit-mode buttons as SIBLINGS of `[data-sound-card]` inside `div.group` (App.jsx:3059 closes the card div BEFORE the `{editMode && …}` buttons at 3062-3077). Fixed selectors to `c.parentElement?.querySelector('button[title="Edit Sound"/"Delete Sound"]')`. Diagnosed via E1-DIAG asserting `[data-sound-card]` texts (Smite/Shield Bash/Healing Light) vs Edit-btn ancestor chain (`button < div.group.relative.shrink-0`).
    4. **Suite L (split view)**: L4/L5/L6 detected the split sidebar by requiring `overflow-y-auto` on the panel and L6 searched for `h2` "Environment" — but the real heading is **"Environments"** (App.jsx:3249) and the sidebar lacks that scroll class. Rewrote to `findSidebar(heading)` = `h2` heading → `.closest('div[class*="bg-dark-800"]')`.
    5. **Suite X (drag reorder)**: previously skipped (`NO_RECTS`, malformed cards[3]). Now reloads page first (returns to default Paladin view, localStorage intact), re-enters edit mode, drags **last→first** card via CDP `Input.dispatchMouseEvent` (pressed → 5 moved steps → released). VERIFIED WORKING: before `["Divine Smite","Shield Bash","Healing Light","Divine Light"]` → after `["Divine Light","Divine Smite","Shield Bash","Healing Light"]`.
- **Results**: Phase A (headless Edge :9333) **PASS=99 FAIL=0 WARN=0 exit=0**; Phase B (Tauri WebView2 :9224, SAVE_RESTORE=1) **PASS=99 FAIL=0 WARN=0 exit=0**. All 16 prior FAILs resolved; 0 remaining.
- **Run commands now**: `powershell -NoProfile -ExecutionPolicy Bypass -File e2e\e2e-all.ps1 -Phase web` (and/or `-Phase win`, `-Suite run|full|features`). Log: `%TEMP%\opencode\e2e-run-<ts>.log` (note: node log lines can be UTF-8 while PS headers differ — read via .NET `[Text.Encoding]::UTF8` + strip NULs, or expect mixed glyphs).
- **Gotchas recorded**: PS `Add-Content`/`Set-Content` can write UTF-16/ANSI mixed once node output streams in → grep the log with the .NET decode recipe above; template literals inside `evalJs(...)` must avoid nested backticks (`${…}` interpolation is fine, backticks are not); pick which sound is "last" via `cards[cards.length-1]`, not hardcoded index 3.
- No backup needed (no repo fixtures changed); `git status` unchanged (only pre-existing modified files + newly added `e2e/` harness).

## SESSION 2026-09-11 (cont.) — E2E CLEANUP FIX: Tauri process tree killed properly ✅
- **Problem**: `Stop-ProcessTree` (calling `.Kill($true)` on the npm wrapper PID) didn't reach the Tauri-spawned `app.exe` or its WebView2 children, leaving a frozen black window after tests.
- **Fix in `e2e\e2e-all.ps1` Phase B finally block** (3 changes):
  1. `Stop-ProcessTree $tauriProc` → `Invoke-Expression "taskkill /PID $($tauriProc.Id) /T /F 2>&1" | Out-Null` — kills npm wrapper tree via OS taskkill.
  2. Added `taskkill /F /IM app.exe /T 2>&1 | Out-Null` — catches the Tauri binary + its process tree (actual exe name is `app.exe`, NOT `TheSpellCaster.exe`).
  3. Added CIMInstance loop to find `msedgewebview2.exe` with `--webview-exe-name=SearchHost.exe` in command line → `taskkill /F /PID <pid> /T` per match. This targets only our test's WebView2 instances, not unrelated system WebView2 (WhatsApp, Google Drive, Windows Search).
- **Verified**: 3 consecutive Phase B runs exit=0 with immediate terminal return; no orphan `app.exe` or debug-port `msedgewebview2.exe` remains. Remaining SearchHost WebView2 processes are normal Windows system instances (no `--remote-debugging-port`, parent = system SearchHost PID 15580).
- **Gotcha**: blanket `taskkill /F /IM msedgewebview2.exe /T` would kill WhatsApp/Google Drive/Windows Search WebView2 — must filter by `--webview-exe-name=SearchHost.exe` in CommandLine.
- Phase A (web) also re-run: exit=0, no changes needed (headless Edge cleanup was already working).
- **E2E full results**: Phase A PASS=99 FAIL=0 WARN=0 · Phase B PASS=99 FAIL=0 WARN=0 (all 3 runs).
- No backup needed (only `e2e/e2e-all.ps1` changed, not app code). `git status`: `e2e/e2e-all.ps1` + `opencode-summary.md` modified.

## Session etiquette notes
- **FOR OPencode ONLY** (standing rule): the doc-updating rules apply only to opencode (the AI assistant), not the human user. After every meaningful step — each edit/verification/decision — update this file at the bottom ("SESSION 2026-09-05" section, or a new one for a new day): what the current task is, what's done (fixed/verified), what's in progress right now, what's next, and gotchas. If the session gets cut off (quota/tokens), this file must be enough to resume exactly. Record backups, test results, ports/processes, file:line refs.
- **E2E TEST POLICY (standing rule)**: When asked to run E2E tests, **do NOT change any app code or harness code** — only run the tests and report results (PASS/FAIL/WARN per suite, any diagnostics). Wait for the user to tell you what needs fixing or changing.
- Backup before changes (see Backups) — newest: `ttrpg-soundboard-backup-20260911-153349` (no backup needed this session — only harness changed, not app code).
- `npm run tauri android dev` by a previous session left a lingering Vite server on **port 5173**; if port-in-use errors occur, kill the PID (`netstat -ano | findstr :5173` then `taskkill /PID <pid> /F`) before re-running.
- When editing the mobile slider/header row, keep the icon↔number geometry STABLE (fixed-width number inputs, not dynamic).
- `vite.config.js` has a pre-existing `eslint no-undef` on `process` (it was never linted; `npx eslint src/App.jsx` is the canonical check).
- Changes are UNCOMMITED — `git status` shows modified: `index.html`, `AndroidManifest.xml`, `src/App.jsx`, `src/data.json`.

## SESSION 2026-09-11 (cont.) — MOBILE (ANDROID) E2E HARNESS — IN PROGRESS
- **Request**: "Let's make sure E2E also includes mobile." Goal: run the existing E2E check suite against the Android emulator UI (tauri `android` target), not just web/Tauri-Windows.
- **NEW `e2e\e2e-mobile.mjs`** (untracked, ~46.7 KB, `node --check` exit 0): mobile-specific suite, same env protocol as `e2e-full.mjs` (`CDP_PORT`, `LABEL`, `EXPECT_TAURI`, `SAVE_RESTORE`). Suites: **S** seed integrity, **M** mobile layout (rail `div.w-14.bg-dark-800` + hamburger), **N** drawer navigation (`[role="dialog"][aria-label="Navigation"]`, backdrop `.fixed.inset-0.z-40`), **R** sound grid (`[data-sound-card]`), **E** mobile edit mode (`button[title="Enter Edit Mode"]`), **A** add sound, **J** edit sound, **C** character CRUD, **K** category CRUD, **G** group CRUD, **V** empty states, **T** settings (About version `0.1.3`), **D** delete sound + cancel. Mobile-specific behavior encoded: edit toggle lives on the grid (not header), drawer Add buttons ONLY visible while edit mode is on, per-card buttons found in `c.parentElement`. Seed data matches e2e-full (3-character seed, `ttrpg_data_version=3`; uses `e2e_silence.wav` upload + self-generated `_e2e_pixel.png`).
- **ANTIVIRUS INCIDENT (blocker for `e2e\e2e-all.ps1`)**: Kaspersky and/or Bitdefender (Defender disabled) QUARANTINED `e2e-all.ps1` while Phase C was being inserted. User whitelisted + restored, but: (1) the restored copy is byte-corrupt (UTF-16→UTF-8·no-BOM conversion, mojibake) → 4 `Parser::ParseFile` errors; (2) the AV still HARD-BLOCKS that exact filename at the filesystem-filter level even after user deleted it — `New-Item`/`git checkout`/`Set-Content` all denied for `e2e-all.ps1`, while ANY other filename in the same folder writes fine. Permanent: `e2e-all.ps1` is dead.
- **NEW `e2e\e2e-full.ps1`** (replaces `e2e-all.ps1`; ASCII-only + UTF-8 BOM added via node; PARSE-OK): param `-Phase all|web|win|android`, `-Suite full|mobile|run|features`. Phase A headless Edge :9333 (vite preview :5233), Phase B Tauri WebView2 :9224 (`WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS`), Phase C (android): AVD `Pixel_7`, `$adb="$env:ANDROID_HOME\platform-tools\adb.exe"`, boots emulator if none (`-no-snapshot-load`, wait `sys.boot_completed=1` max 5 min), launches `npm.cmd run tauri android dev` (Rust compile + install; logs `%TEMP%\opencode\e2e-android-tauri.log`/`.err.log`; its Vite server on :5173), waits app via **`adb shell pidof com.mrhorakhty.thespellcaster.debug`** (matches `^\d+$`), `adb forward tcp:9225 localabstract:webview_devtools_remote_<pid>`, verifies CDP `http://127.0.0.1:9225/json` has `webSocketDebuggerUrl`, runs default suite `e2e-mobile.mjs` (unless `-Suite` overrides) with `-Expect '1' -SaveRestore '1'`, cleanup: adb forward remove → taskkill tauri tree → taskkill app.exe → SearchHost-scoped msedgewebview2 kill → `Remove-Orphans` → `adb emu kill` ONLY if it started the emulator. `Assert-NotTimedOut` defaults 15 min (Phase C path uses -Minutes 25).
- **Playbook now**: `powershell -NoProfile -ExecutionPolicy Bypass -File e2e\e2e-full.ps1 -Phase all` (web+win+android) or `-Phase android` for mobile only. Backup of harness = git HEAD only (do NOT restore `e2e-all.ps1` from git — AV will block the create).
- **Verified so far**: `e2e-full.ps1` PARSE-OK; `e2e-mobile.mjs` node --check exit 0; ANDROID_HOME=`C:\Users\emire\AppData\Local\Android\Sdk`, adb daemon starts, NO emulator attached yet.
- **NEXT (resume point)**: `powershell -NoProfile -ExecutionPolicy Bypass -File e2e\e2e-full.ps1 -Phase android` → expect emulator boot (5 min) + Rust android build (up to 15 min) + suite run; report per-suite PASS/FAIL/WARN; on CDP/app timeout inspect `%TEMP%\opencode\e2e-android-tauri.err.log` tail. Then append results here and run a full `-Phase all` to confirm web+win still green (they passed 99/99 earlier today).
- **Gotchas**: never use `…`/em-dash in PS runner strings (ANSI fallback in PS5.1 breaks string terminators) — keep runner ASCII + UTF-8 BOM; the AV name-block on `e2e-all.ps1` is permanent even with folder whitelist + file delete, so don't retry it; `taskkill /F /IM msedgewebview2.exe` blanket would kill WhatsApp/Drive/Search WebView2 — always scope to `--webview-exe-name=SearchHost.exe`.
- **AV identity correction**: it's **Bitdefender** (not Kaspersky). Rationale for the flag: the single `e2e-all.ps1` accumulated a malware-like behavioral fingerprint — hidden `Start-Process`, `taskkill /F /T`, `Invoke-Expression`, `--remote-allow-origins=*`, and `adb forward` socket tunnelling (Phases A+B+C all in one file). The hard filename-block survives delete + whitelist because Bitdefender keeps a persistent detection fingerprint for that name/hash.
- **SPLIT DONE (Phase C → separate file)**: `e2e\e2e-full.ps1` now contains ONLY Phases A (web) + B (win); Phase C (android) is delegated to **NEW `e2e\e2e-android.ps1`** (standalone runner, owns its own adb/emulator/CDP/pidof logic + helpers `Remove-Orphans`/`Invoke-TestSuite`/`Assert-NotTimedOut`/`Wait-Cdp`; same default `Pixel_7`, CDP :9225, `pidof com.mrhorakhty.thespellcaster.debug`, `adb forward tcp:9225 localabstract:webview_devtools_remote_<pid>`; cleans adb forward → taskkill tauri tree → app.exe → orphans → `adb emu kill` only if it started the emulator). `e2e-full.ps1` pure delegator: `& "$PSScriptRoot\e2e-android.ps1" -Suite $Suite -TestLog $Script:TestLog -TestStartTime $Script:TestStartTime`. Both files ASCII-only + UTF-8 BOM. VERIFIED: `-Phase android` via delegation → `android: exit=0` (log `e2e-run-20260911-181552.log`).
- **Run commands now**: `powershell -NoProfile -ExecutionPolicy Bypass -File e2e\e2e-android.ps1` (android-only) or `… -File e2e\e2e-full.ps1 -Phase all|web|win|android` (web/win + delegated android). Suite control via `-Suite full|mobile|run|features` (default phase-C suite = mobile).
- **KNOWN ISSUE (user will request fix later — DO NOT fix proactively; E2E policy applies)**: the mobile suite `e2e\e2e-mobile.mjs` output TRUNCATES after check **A2** ("WAV uploaded") in the log — only 6 of 13 suites visible (S=10, M=7, N=6, R=6, E=5, A=2 → 36 PASS, 0 FAIL) yet node exits **0**. Suites J (edit sound), C (char CRUD), K (cat CRUD), G (group CRUD), V (empty states), T (settings), D (delete+cancel) never appear in the log. Exactly the same truncation occurred in the standalone run 18:04 AND the combined `-Phase all` run 18:20 (log `e2e-run-20260911-182022.log`). Runner/phase separation NOT at fault (Phases A + B show full 99/99; delegation works). Prime suspects: (1) Node stdout via PS 5.1 `>>`/`2>&1` buffering/truncation (known repo quirk: node log lines UTF-8 vs PS UTF-16/ANSI) causing result-loss; (2) real early-exit in suite A's A3 `submitModal` step that returns 0 without the `MOBILE E2E SUMMARY` line. Lines to inspect when fixing: `e2e-mobile.mjs:348` (submitModal) & the summary/exit at `e2e-mobile.mjs:870-875`; verify by running `node e2e-mobile.mjs` with cmd-level `> log 2>&1` redirect (bypassing PS) against a live CDP :9225, expecting all 13 suite headers + the `MOBILE E2E SUMMARY: PASS=.. FAIL=.. WARN=..` line. e2e-full.mjs/e2e-features.mjs do NOT have this issue.
