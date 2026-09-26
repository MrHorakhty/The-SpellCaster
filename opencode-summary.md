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

## SESSION 2026-09-27 — MOBILE E2E TRUNCATION ROOT-CAUSED ✅ (diagnosis only, NO code changed)
Resumed the previous session's KNOWN ISSUE ("mobile suite output truncates after A2, node exits 0"). **Root cause found and proven. No app or harness code was changed** (E2E policy respected). `git status` clean; no backup needed.

### ROOT CAUSE (not a logging bug, not an app bug)
CDP **`DOM.setFileInputFiles`** — the call `uploadWav()` makes at suite A2 — is rejected by the **Android WebView** as a bad IPC message, which kills the renderer and then the whole app:
```
00:33:28.516 E/chromium(5711): [ERROR:content/browser/bad_message.cc:29] Terminating renderer for bad IPC message, reason 2
00:33:28.530 I/ActivityManager: Killing 5833:com.google.android.webview:sandboxed_process0...
00:33:29.063 E/chromium(5711): [ERROR:android_webview/browser/aw_browser_terminator.cc:173] Renderer process (5833) crash detected (code -1).
00:33:29.070 E/chromium(5711): [ERROR:.../aw_browser_terminator.cc:122] Render process (5833) kill (OOM or update) wasn't handed by all associated webviews, killing application.
00:33:29.099 I/ActivityManager: Process com.mrhorakhty.thespellcaster.debug (pid 5711) has died: fg TOP
```
Chain: `DOM.setFileInputFiles` -> renderer terminated -> Android WebView kills the app (no `onRenderProcessGone` handler) -> node's next `Runtime.evaluate` (suite A3 `submitModal`) never resolves, and because `e2e-mobile.mjs` has **no `ws.onclose`/`onerror` handler** the socket dying releases the last event-loop handle -> **node exits 0 silently** (never prints `MOBILE E2E SUMMARY`) -> log appears to "truncate after A2". Desktop WebView2 supports the call, which is why `e2e-full.mjs` passes 99/99. The old `EXITCODE=` echo never appearing in the log is the same event (cmd wrapper died with the tree).

### PROOF / validated fix (TEMP copy only — repo harness untouched)
`%TEMP%\opencode\mobile-dt.mjs` = copy of `e2e-mobile.mjs` with `uploadWav()` (lines 134-143) replaced by an **in-page `DataTransfer`** upload (build a 2s silent WAV in JS -> `new File([buf],'e2e_silence.wav')` -> `DataTransfer` -> `input.files` -> dispatch `change`; selector `input[type="file"][accept*=".mp3"]` with fallback to any `input[type="file"]`). No `DOM.*` file call at all.
- Result via cmd-level redirect: **all 13 suites ran, `MOBILE E2E SUMMARY: PASS=64 FAIL=4 WARN=0 TOTAL=68`**, exit 0, `localStorage restore: restored`.
- Log: `%TEMP%\opencode\mobl-dt.log`. Runner wrapper: `%TEMP%\opencode\run-mobile-dt.cmd` (cmd-level `>` bypasses the PS 5.1 `>>` suspect — the suspect was a red herring).

### The 4 FAILs, triaged
1. **C3 `Edit Character` in drawer (`button[title="Edit Character"]`) — TEST bug, app is fine.** The mobile drawer has no per-row rename; on mobile you rename by tapping the character/category **name in the sound-grid header while in edit mode** (`src/App.jsx:3889-3907`, `handleEditCharacter` at 3893/3897). Desktop-only buttons are at 4279/4341.
2. **C5 `Delete Character` in drawer — REAL APP GAP (mobile).** There is **no way to delete a top-level Character or Environment category on Android**: drawer rows for top-level items (`App.jsx:4101-4122`) have NO delete badge (only *group members* get badges at 4135/4157, titled `Delete Character: <name>`), the grid-heading trash was deliberately removed, and every `handleDeleteCharacter`/`handleDeleteCategory` call site (4272/4303/4334/4364) is desktop sidebar or split-view. Needs a user decision before touching app code.
3. **G1 `Add Group` — TEST bug.** Mobile rail button is `title="Add New Group"` / `aria-label="Add New Group"` (`App.jsx:3876-3877`, edit-mode only); the exact text `Add Group` is the *desktop* edit-bar button (`App.jsx:3763`).
4. **V1 empty-state text — TEST bug.** Test greps for `toggle Edit Mode`; the **mobile** drawer strings say `open Edit Mode` (`App.jsx:4090-4099`) while desktop says `toggle Edit Mode` (4248+).

### Environment / processes (left running for follow-up)
- Emulator `Pixel_7` PID 16920 (`emulator-5554`, boot_completed=1), started manually with `-no-snapshot-load -no-audio`.
- `npm.cmd run tauri android dev` PID 26520 (cargo-tauri PID 23320, its Vite dev server PID 35688 on **:5173** — kill it before any other vite run).
- App pid **9137** (relaunched with `adb shell am start -n com.mrhorakhty.thespellcaster.debug/com.mrhorakhty.thespellcaster.MainActivity` after it died).
- `adb forward tcp:9225 localabstract:webview_devtools_remote_9137` is ACTIVE (remove with `adb forward --remove tcp:9225`).
- CDP endpoint serves `http://tauri.localhost/`; the suite finds the page via `/json` and needs `t.type==='page' && url.startsWith('http')`.
- Temp artifacts: `%TEMP%\opencode\{mobile-dt.mjs, run-mobile-dt.cmd, run-mobile-diag.cmd, mobl-dt.log, mobl-diag.log, mobl-diag2.log}`. Note the temp copy's `WAV` path is module-relative, so it no longer writes `e2e/e2e_silence.wav`.

### NEXT (needs user decision — E2E policy: do not change app/harness code unasked)
1. **Harness fix (recommended, validated):** in `e2e/e2e-mobile.mjs`, replace the `uploadWav()` `DOM.setFileInputFiles` body with the in-page `DataTransfer` version (also fixes the silent-exit-0 by adding a `ws.onclose` handler that logs + exits non-zero). Backup first (`ttrpg-soundboard-backup-20260927-*`).
2. **Test selector fixes:** C3 -> tap the grid-header `h2` in edit mode instead of a drawer Edit button; G1 -> `button[title="Add New Group"]`; V1 -> match `open Edit Mode` (or accept either wording).
3. **App gap (ask first):** add a delete affordance for top-level Characters/Environment categories on mobile (e.g. trash badges on the drawer rows at `App.jsx:4101-4122`, mirroring the group-member badges) so Android users can delete them at all.
4. Housekeeping: `e2e/_avtest2.txt` (3 B), `e2e/e2e-all.ps1.new` (3 B) and `e2e/_e2e_pixel.png` (70 B) are tracked AV/test leftovers — ask before deleting. `e2e-all.ps1` itself must never be recreated (Bitdefender hard filename block).

## SESSION 2026-09-27 (cont.) — ALL 3 FIXES IMPLEMENTED + VERIFIED ✅ (mobile 85/85, desktop 99/99)
User approved all three fixes. **Backup first: `ttrpg-soundboard-backup-20260927-004517`** (200 files).

### 1. APP FIX — mobile can now delete top-level Characters / Environment categories
`src/App.jsx`, mobile drawer list (~4101-4150): the top-level `characters.map` / `environmentSounds.map` rows were bare buttons with **no delete affordance**, so on Android those items could not be deleted at all. Each row is now wrapped in `div.relative` with an edit-mode trash badge identical to the group-member badges: `title={`Delete Character: ${char.name}`}` / `title={`Delete Category: ${cat.category}`}` + matching `aria-label`, calling `handleDeleteCharacter(char.id)` / `handleDeleteCategory(cat.category)`. Desktop + split-view untouched. This was the one genuine app-level gap (all pre-existing `handleDeleteCharacter/Category` call sites were desktop-only).

### 2. HARNESS FIXES — `e2e/e2e-mobile.mjs`
- **`uploadWav()`**: `DOM.setFileInputFiles` -> in-page `DataTransfer` (build a 2s silent WAV with `DataView`, `new File([buf],'e2e_silence.wav')`, `DataTransfer` -> `input.files` -> dispatch `change`). Comment records WHY (Android WebView kills the renderer + app). A2 now logs the helper's return value.
- **Dead-socket guard**: added `closingIntentionally` + `ws.onclose` / `ws.onerror` handlers that print `FATAL: CDP socket closed with N unanswered request(s)` and `process.exit(3)`. `e2e-android.ps1` already treats `exit=[1-9]` as failure, so a dead app can never look like success again. `closingIntentionally = true` is set before the final `ws.close()`.
- **Mobile-selector fixes** (all were desktop-derived): C3 -> close drawer, tap the sound-grid header `h2` whose text is the item name (must carry `text-lime-400` = edit mode) ; C5/G9/G11 -> `button[title^="Delete Character"/"Delete Category"]` (the real titles are `Delete Character: <name>`, not the bare word) ; G1 -> `button[title="Add New Group"]` (mobile rail; `Add Group` is the desktop edit bar) ; G4 -> same header-`h2` rename as C3 (mobile has NO "Edit Group" button; drawer must be closed first because the header tap is ignored while the drawer is open) ; V1 -> the empty states live INSIDE the drawer, so `openDrawer()` first, query inside `[role="dialog"]`, accept `open Edit Mode` (mobile) or `toggle Edit Mode` (desktop), then `closeDrawer()`.
- **Cascade-proofing**: the G suite resolved the new group by the hard-coded name `'Dragon Lore Reborn'`, so one failed rename silently failed 6 more checks. It now captures `grpId` once and builds `G` (a JS expression finding the group by id) used by G5-G12. G12 matches the badge by `title === 'Delete Group: ' + <name read in-page>`.
- **Silent-skip class of bug fixed**: checks nested in `if (click === 'OK')` blocks never reported when the click failed — K3/K4/K5 were dead code (same wrong selectors as C3/G4) and the suite still looked green. Dependent checks now log an explicit `FAIL ... blocked: <reason>` (C4, G5, K3, K5).

### 3. RESULTS
- **Android / Pixel_7 emulator (`e2e-mobile.mjs`, 13 suites): PASS=85 FAIL=0 WARN=0 TOTAL=85**, exit 0, `localStorage restore: restored`. Log `%TEMP%\opencode\mobl-fix3.log`. All CRUD paths now really execute: C1-C7, K1-K5, G1-G12, plus S/M/N/R/E/A/J/V/T/D. (Was 36 truncated checks before the fix.)
- **Desktop web regression (`e2e-full.mjs`, headless Edge + `vite preview :5233`): PASS=99 FAIL=0 WARN=0 TOTAL=99**, exit 0 — no regression from the App.jsx change. Log `%TEMP%\opencode\web-regress.log`.
- Gates: `node --check e2e\e2e-mobile.mjs` exit 0 · `npx eslint src/App.jsx` 0 errors / 3 pre-existing warnings (`convertFileSrc`, `_`, `ev`) · `npx vite build` OK.

### ⚠️ HAZARD FOUND in `e2e\e2e-full.ps1` (do not run `-Phase web` blindly)
Phase A's `finally` block (`e2e-full.ps1:155-157`) runs `Get-Process -Name msedgewebview2 | Stop-Process -Force` — a **blanket kill of every WebView2 process on the machine**, even though Phase A (headless Edge) uses none. That would kill the user's WhatsApp / Google Drive WebView2. Phase B's cleanup is correctly scoped to `--webview-exe-name=SearchHost.exe` (`e2e-full.ps1:204-209`). For the desktop regression I used a PID-scoped temp script instead: `%TEMP%\opencode\web-regress.ps1` (build is already done; starts `vite preview :5233` + headless Edge :9333, runs `e2e-full.mjs`, kills only its own PIDs). Fixing line 155-157 to match Phase B's scoping needs user approval.

### State / processes left running
Emulator `Pixel_7` PID 16920 · `npm.cmd run tauri android dev` PID 26520 (Vite PID 35688 on **:5173**) · app pid **9137** · `adb forward tcp:9225 localabstract:webview_devtools_remote_9137` active. To stop: `adb forward --remove tcp:9225`; `adb emu kill`; `taskkill /PID 26520 /T /F`. Temp artifacts: `%TEMP%\opencode\{mobile-dt.mjs, web-regress.ps1, web-regress.log, run-mobile-*.cmd, mobl-*.log}`.

### NEXT
- User manual click-through on the emulator: edit mode -> drawer -> trash badge on a top-level character/category.
- Optional: scope `e2e-full.ps1:155-157` WebView2 kill to SearchHost; delete the 3 tracked junk files; commit (`src/App.jsx` + `e2e/e2e-mobile.mjs` + `opencode-summary.md`).

## SESSION 2026-09-27 (cont.) — NEW `e2e\kill-ports.bat` (user: "ports are full") ✅
User wanted a .bat to free ports for manual testing. Added **`e2e\kill-ports.bat`** (CRLF, ASCII, no PowerShell dependency except the optional orphan sweep).
- `kill-ports.bat` -> frees the default ports `5173 9224 9225 5233 9333 9334` (vite dev, WebView2 CDP, adb-forwarded WebView CDP, vite preview, headless-Edge CDP x2).
- `kill-ports.bat 5173 9225` -> only the listed ports.
- `kill-ports.bat /all` -> defaults + `app.exe` + `adb forward --remove-all` + orphan sweep (a PowerShell CIM query, scoped to `node.exe` with `tauri.js` in the command line and `cargo.exe`, so unrelated node/cargo work is untouched).
- `kill-ports.bat /emu` -> `adb -s <serial> emu kill` (kept separate from `/all` because shutting the emulator down is destructive).
- Per port it first tries `adb forward --remove tcp:<port>` so the **adb server itself is never killed** by the netstat sweep, then kills any remaining LISTENING PID + its tree (`taskkill /PID /T /F`), de-duplicating PIDs across IPv4/IPv6 rows, and prints a final `free` / `STILL IN USE by PID` line per port. Admins-only failures are reported instead of silently swallowed.
- Gotcha: `^|` escapes are needed for `netstat ... ^| findstr` (not inside quotes) but must NOT be used inside the double-quoted `-Command "..."` string — cmd passes `^|` through literally and PowerShell errors with "A positional parameter cannot be found that accepts argument '^'".
- Verified: default run freed 5173; custom-port run OK; `/all` run killed leftover PID 35140 (`tauri.js android-studio-script --target armv7`, an orphan from a killed `tauri android dev`). Emulator (`emulator-5554`) intentionally left running; `tauri android dev` + Vite are now stopped, so port 5173 is free.

## SESSION 2026-09-27 (cont.) — COMMITTED ✅ `890e4c1` "E2E mobile fixes and port cleanup helper"
Committed on branch `mobile-support` (4 files, +360/-77): `src/App.jsx`, `e2e/e2e-mobile.mjs`, `e2e/kill-ports.bat` (new), `opencode-summary.md`. Previous HEAD was `af593fb E2E mobile`. Not pushed.
- Also removed the dead on-disk WAV generator from `e2e-mobile.mjs` (module-level `makeWav` + `WAV` const + the `writeFileSync`/`path`/`url` imports): `uploadWav` builds the WAV in-page now, so those were unreferenced. `e2e/e2e_silence.wav` is still written by `e2e-full.mjs` / `e2e-features.mjs`, which do use `DOM.setFileInputFiles` on desktop, so the tracked file stays.
- That removal was verified with `node --check` + an identifier grep only (no full Android re-run, since no tested code path changed and the ports were freed on purpose for manual testing). Last full green run: mobile 85/85, desktop web 99/99.
- Gotcha: `git commit -m "..."` with **inner double quotes** gets mangled by PowerShell 5.1 when calling a native exe (git splits the argument on the inner quotes and then treats the rest as pathspecs -> `error: pathspec 'renderer' did not match...`). Write the message to a file and use `git commit -F <file>`.
- Repo has a **pre-commit hook** that prints a "TTRPG Soundboard Backup Log" block; it leaves the tree clean.
## SESSION 2026-09-27 (cont.) — "Run App.bat does not launch the app" ✅ diagnosed
**Root cause: a stray Vite dev server was holding port 5173.** `tauri android dev` runs `beforeDevCommand` = `npm run dev` (vite), which aborts with `Error: Port 5173 is already in use` -> `The "beforeDevCommand" terminated with a non-zero status code` -> the double-clicked window closes instantly, so the failure is invisible. The leftover came from the user running the root `Run.bat` (= `npm run dev`, web only) before/while launching Android.
- Reproduced exactly: `cmd /c "src-tauri\gen\android\Run App.bat"` -> exit 1, log at `%TEMP%\opencode\runapp-repro.log`.
- `Run App.bat` is `src-tauri\gen\android\Run App.bat` and is **explicitly gitignored** (`.gitignore:285`), so it is a local-only helper - fixes to it are never committed. The `cd` into `gen\android` is harmless: npm walks up and finds the root `package.json`.
- **Fixed `Run App.bat`**: `cd` to the repo root, `call "%ROOT%\kill-ports.bat" 5173` first, then `npm run tauri android dev`, and `pause` with a diagnostic checklist on non-zero exit, so failures are visible instead of a vanishing window. Note: my first attempt wrote `"%ROOT%kill-ports.bat"` (missing separator) -> `'"...ttrpg-soundboardkill-ports.bat"' is not recognized`. Watch the trailing backslash.
- Verified end to end after the fix: `Performing Streamed Install` -> `Success` -> `Starting: Intent { cmp=com.mrhorakhty.thespellcaster.debug/...MainActivity }`, app pid 11845, and the WebView DOM over CDP (`adb forward tcp:9225 localabstract:webview_devtools_remote_<pid>`) reports title `The SpellCaster`, 8 buttons, `h1/h2 = The SpellCaster | Human Paladin`, `__TAURI__` present, seeded sounds rendered. So the mobile UI mounts fine.
- Launch recipe that works: emulator/device booted (`adb devices` lists it) -> `Run App.bat` (it frees 5173 first). Equivalent: `npm run tauri android dev` from the repo root.
- Gotchas: `adb exec-out screencap -p > file.png` **must** go through `cmd /c`; PowerShell 5.1 redirection corrupts the binary ("Out of memory" in `Image.FromFile`). The e2e harnesses use Node's **global** `WebSocket` - there is no `ws` package in `node_modules`, so a helper script placed in `%TEMP%` cannot `import 'ws'`; use `globalThis.WebSocket` + `addEventListener` (no `.on()`).
- A dev session is currently running in a **hidden** background process (launcher pid 8592, vite on 5173, `adb forward tcp:9225` -> pid 11845). Stop it with `kill-ports.bat /all` before launching again from Explorer.
## SESSION 2026-09-27 (cont.) — RESTORED app default data (E2E had overwritten it) ✅
User reported the default audio + characters were wiped from the app. Repo sources were never touched (`src/data.json` intact, no deleted files in git) - the damage was in the **running app's localStorage**.
- Damaged live state found: `ttrpg_characters` = 2 (Human Paladin with 3 test sounds, Elf Sorcerer with 0 sounds, **Wood Elf Ranger missing**), `ttrpg_environment` = Dungeon/Forest with 1 sound, `ttrpg_groups` = "Tavern Pack" + "Hero Pack". All of it is **E2E seed data** - `Tavern Pack`/`Hero Pack` are fixtures from `e2e-mobile.mjs:105-106` / `e2e-full.mjs:113-114`.
- The app's own migration backup `ttrpg_characters_old` (written by `App.jsx:79-87` when `ttrpg_data_version !== '3'`) still held the real data, and it is **byte-identical to `src/data.json`**: 3 characters / 11 sounds (Caustic Blast - Acid, Fireball, Frostbite, Lightning Bolt, Divine Smite, Lay on Hands, Shield of Faith, Hail of Thorns, Longbow Shot, Pass Without Trace, Spike Growth).
- **Restore method** (do this again if it ever happens): snapshot all localStorage to a file, then `localStorage.removeItem` for `ttrpg_characters` / `ttrpg_environment` / `ttrpg_groups` only, then `Page.reload`. With the key absent, `readStoredData` (`App.jsx:88-95`) returns the `data.json` fallback and the app re-seeds itself. Leave `ttrpg_characters_old` and `ttrpg_themes` alone. Verified after reload: characters and environment match the defaults exactly.
- **Root cause of the loss**: `e2e-android.ps1:161` already passes `-SaveRestore '1'`, and the harness snapshots localStorage at suite start and restores it at the end (`e2e-mobile.mjs:82-87` + `913-918`). That only protects the state that existed *when the suite started*. The first mobile run died mid-suite (the A2 renderer crash), so the restore block never executed; every later run then faithfully snapshotted and restored the already-corrupted E2E seed. So the save/restore is not broken - it is just not crash-safe.
- Proposed hardening (NOT done - needs user approval per the E2E policy in `e2e-android.ps1:4-6`): have the runner take its own localStorage snapshot to a file *before* invoking node and restore it in the `finally` block, so the user's data survives a crashed/killed suite.
- Helper scripts used (throwaway, in `%TEMP%\opencode`): `ls-dump.mjs`, `ls-verify-backup.mjs`, `ls-restore.mjs`, `cdp-check.mjs`. They use Node's **global** `WebSocket` with `addEventListener` - there is no `ws` package in `node_modules`, so a script outside the repo cannot `import 'ws'`.
## SESSION 2026-09-27 (cont.) — HARDENING (both, user-approved): save-failure banner + crash-safe E2E backup
Backup first (AGENTS.md): `C:\Users\emire\OneDrive\Masaüstü\ttrpg-soundboard-backup-20260927-014256` (201 files; node_modules/dist/.git/target/gen excluded). NOTE: the **previous** session's backup path in this file is wrong - it actually landed in a mojibake folder `MasaÃ¼stÃ¼` (UTF-8 read as Latin-1), not `Masaüstü`. Build the name with `[char]0x00FC` in PowerShell, never `\u00fc` (PS does not interpret `\u`).
### 1. App: save failures are now visible (`src/App.jsx`)
- `describeSaveFailure(scope, err)` (module level, after `safeParse`) turns a failed write into actionable text; detects `QuotaExceededError` / `NS_ERROR_DOM_QUOTA_REACHED` / `code 22|1014` and says storage is full.
- `const [saveError, setSaveError] = useState(null)` + `function reportSaveFailure(scope, err)` declared as a **function declaration** so it is hoisted and usable by the earlier file-upload helper.
- Wired into: characters auto-save, environment auto-save, groups auto-save (each now also `setSaveError(null)` on success, so a later good save clears the banner), and the web `sound_file_*` localStorage fallback in the FileReader path. The Tauri/desktop+Android path writes audio to the filesystem, so the quota risk is mainly the web build.
- Red `role="alert"` banner with `AlertTriangle` + dismiss `X` (touch-sized 44px) rendered as the first child of the root container, so it shows on mobile and desktop. `AlertTriangle` added to the lucide import.
- **Verified live on the emulator**: patched `Storage.prototype.setItem` to throw `QuotaExceededError`, deleted a character through the new drawer badge, and the banner appeared in the viewport with the right copy while the store correctly did NOT change; after reload the defaults returned and the banner was gone. eslint 0 errors (same 3 pre-existing warnings), `vite build` ok.
### 2. E2E: crash-safe storage guard (user explicitly approved E2E changes)
- New **`e2e/e2e-snapshot.mjs`** - `node e2e-snapshot.mjs save|restore <file>` over CDP (global `WebSocket`, same env contract: `CDP_PORT`/`LABEL`). Exit 0 ok, 3 app unreachable, 4 bad usage/unusable snapshot. `save` refuses to write an empty snapshot; `restore` **never** clears storage unless the file exists, parses, and is a non-empty object - then it clears, re-sets every key and reloads the page.
- `e2e/e2e-android.ps1`: `$lsBackup` initialised to `$null`; after CDP is ready and **before** the suite, snapshot to `$tmp\ls-backup-<stamp>.json` (warns and continues with no guard if it fails); in the `finally` block the restore runs **first, before the adb forward is removed and the tauri tree is killed** (it needs a live app). A failed restore prints the recovery command, records `WARNING: ... snapshot at <path>` in `$results` (which trips the runner's existing `FAILED` regex, so the run exits 1) and keeps the snapshot file.
- **Verified**: save (7 keys / 10105 bytes) -> clobbered storage via CDP (`E2E JUNK` + `junk_key`) -> restore returned the exact 7 keys, `junk_key` gone, characters/UI intact; missing-file and empty-file restores both exit 4 with storage untouched. `Parser::ParseFile` on the ps1: no errors; `node --check` ok.
- NOT run end to end: the full `e2e-android.ps1`. Its `Remove-Orphans` finally step kills every process whose command line contains `*ttrpg-soundboard*`, which would kill this session's own shell. The ps1 glue is verified by parse + by running the exact snapshot/restore command sequence it issues.
- Still outstanding (not requested): same crash-safety for the Windows phase in `e2e-full.ps1:196`; the `e2e-full.ps1:155-157` blanket `msedgewebview2` kill; tracked junk (`e2e/_avtest2.txt`, `e2e/e2e-all.ps1.new`, `e2e/_e2e_pixel.png`); native `onRenderProcessGone`; whether `Run App.bat` should stop being gitignored.
- Also observed (not fixed): with **zero** groups the mobile drawer's *tab strip* only offers Characters/Environment - correct, since the group tabs are `groups.map(...)`. The rail's "+" (`title="Add New Group"`, `src/App.jsx:3919`) is rendered whenever `editMode` is on regardless of group count, so adding the first group on Android does work.

## SESSION 2026-09-27 (cont. 2) — E2E no longer kills the agent session; zero-group claim corrected
User: "Killing this command line during e2e means it will never finish. Let's make an exception for command lines that run opencode."
- Root cause confirmed: `Remove-Orphans` matches `'*ttrpg-soundboard*'` in the **command line**, which also matches the shell + agent session that launched the runner. Measured on this machine: the old filter matched 5 processes, 2 of which were the session (`powershell.exe` 32180 = the runner's own `$PID`, and `cmd.exe` 37632 = opencode's launcher) plus `opencode.exe` 36580 itself.
- Added `Get-ProtectedPids` to **`e2e/e2e-android.ps1`**, **`e2e/e2e-full.ps1`** and **`e2e/e2e-features.ps1`**: unions (a) the full ancestor chain of `$PID` (16 levels, stops on PID 0 / self-parent) with (b) any process whose `Name -like 'opencode*'` or `CommandLine -like '*opencode*'`. Every kill filter now starts with `-not $keep.Contains([int]$_.ProcessId) -and (...)`.
- Verified functionally: protected set = {opencode.exe, its cmd.exe, this powershell.exe, explorer.exe}; the new filter kills only `cmd.exe` running `Run App.bat`, `node.exe` tauri.js `android dev`, and `node.exe` vite - i.e. exactly the dev stack, never the session. `Parser::ParseFile` on all three ps1: no errors.
- Audited every other kill path in the repo: `kill-ports.bat` (port-scoped + `app.exe` + `node.exe *tauri.js*`/`cargo.exe` only) is safe as-is; `e2e-full.ps1` SearchHost/`app.exe`/tauri-tree kills are name-scoped and safe. `e2e-features.ps1` line 78's loose `'*tauri*dev*'` filter was the one other loose match and is now protected too.
- Still open: `e2e-full.ps1:183-184` blanket-kills **all** `msedgewebview2` (safe for us, but it kills unrelated WebView2 apps); tracked junk (`e2e/_avtest2.txt`, `e2e/e2e-all.ps1.new`, `e2e/_e2e_pixel.png`); native `onRenderProcessGone`; whether `Run App.bat` should stop being gitignored; crash-safety for the Windows phase in `e2e-full.ps1` (only the Android runner snapshots localStorage).
- **Correction to an earlier note in this file:** it claimed Android could not add its first group. That was wrong - the test simply never entered edit mode. With `ttrpg_groups = []`, after `Enter Edit Mode` the `+` is present and visible (`getBoundingClientRect` 20,337, w/h > 0). No bug; no change made.

## SESSION 2026-09-27 (cont. 3) — README brought up to date for Android; ICON FEATURE parked for later
User asked what else was planned, then: "Bring the readme up to date and make a note of icon feature inside opencode summary. I'll circle back to that at a later date."
Backup first: `C:\Users\emire\OneDrive\Masaüstü\ttrpg-soundboard-backup-20260927-020211` (202 files; correct U+00FC folder - console renders it as `Masa�st�`, that is only a codepage display issue).

### 🔶 PARKED FOR LATER — the only unimplemented planned feature: ICON FEATURE
**`ICON_FEATURE_SPEC.md`** (376 lines, created 2026-09-03, header says *"Status: Planning — do not implement until approved"*). User explicitly deferred it on 2026-09-27 - **do not start it without a fresh request.**
- Scope: `icon` field on **Group**, **GroupChar** and **GroupCat**; an `<IconPicker>` with an Emoji tab (~120 curated TTRPG emoji) and a Lucide tab (~63 icons), rendered inline in the add/edit group modal and as an edit-mode tap popover on character/category rows.
- Display targets: group tab on the mobile rail (icon, falling back to first letter), group tab in drawer + desktop sidebar, group heading, character rows (default `User`), category rows (default `Music`).
- Spec already covers: no data-version bump needed (`normalizeStoredData` spreads unknown fields, missing `icon` degrades to fallback), `toggleGroupMode` must carry `icon` through env↔chars conversion, `addGroup` → `''` / `addGroupCharacter` → `'User'` / `addCategory` → `'Music'`, edit-mode-only row pickers, popover flip near screen bottom, aria-labels, 11-step implementation order, 14-item verification checklist.
- **Implementation status: nothing done.** `IconPicker` = 0 hits, `renderIcon` = 0, `iconPickerOpen` = 0 in `src/App.jsx`. The 8 existing `icon:` fields are per-sound *image* icons and are unrelated.
- **Line numbers in the spec are stale** (drifted during the mobile work): `normalizeStoredData` ~55 → **43**, group modal ~4367 → **4927**, `addGroup` → **2385**, `addGroupCharacter` → **1824**, `toggleGroupMode` → **2780**, `handleEditGroup` → **2482**, `groupFormData` → **730**. All symbols still exist.
- ⚠️ **Fix before implementing:** 5 of the 63 Lucide names in the spec do **not** exist in the installed `lucide-react` 0.428.0 — `Robot`, `Witch`, `Bow`, `Spear`, `Potion`. Importing them as written breaks the build. Valid substitutes: `Bot`, `WandSparkles`, `FlaskConical` / `TestTube`, and `Target` / `ArrowUp` for bow/spear. Verified the other 58 exist (`Flower2`/`Music2`/`Volume2` are fine - lucide slugs trailing digits with a hyphen, e.g. `volume-2.js`).
- Gotcha when re-checking icon names: do **not** test `node_modules/lucide-react/dist/esm/icons/<slug>.js` with a naive PascalCase→kebab conversion - trailing digits need a hyphen (`Volume2` → `volume-2`) or you get false "missing" results. Query `dist/lucide-react.d.ts` for exported names instead (substring matching cannot produce false negatives).

### README.md updated (this session)
- Header now advertises **Windows · Android · Web**; intro line no longer says "desktop application".
- New **Platform Support** table: per-platform feature matrix + the verified fact that **Split View is desktop/web only** (confirmed empirically - the toggle is not rendered on the Android app at a 411x914 viewport) and that web storage is localStorage-only.
- Features list: Split View marked desktop-only; added Android drawer/rail + edit-mode delete badges and the visible save-failure banner.
- Tech stack: added Tauri Android target (Kotlin/Gradle, SDK 36) and `@tauri-apps/plugin-os` `isMobile` gating.
- New **Android App Development** section: rustup targets, `npm i -g @tauri-apps/cli`, `adb devices`, `npm run tauri android dev`, `npm run tauri android init` (only if `src-tauri/gen/android` is missing), Android Studio / `Run App.bat`, plus the `kill-ports.bat` tip for `Port 5173 is already in use`. Device notes: app id `com.mrhorakhty.thespellcaster` (+`.debug`), minSdk 24, compile/target SDK 36, only INTERNET permission, keep mobile edits in `gen/android` or `isMobile`-gated.
- Production builds: added `npm run tauri android build` with APK output path `src-tauri/gen/android/app/build/outputs/apk/`.
- Project structure: added `src-tauri/capabilities/`, `src-tauri/gen/android/`, and the whole `e2e/` tree.
- New **Testing** section documenting `e2e-full.ps1`, `e2e-android.ps1`, `e2e-snapshot.mjs`, `kill-ports.bat`, and the crash-safe localStorage snapshot behaviour.
- No code was touched in this session - docs only, so no lint/build re-run was needed. `npm run lint` / `vite build` were already green after the hardening commit.

### Repo status
- All work is committed by the user as **9b47061 "More bugfixes"** (on top of 890e4c1). Working tree was clean before this docs-only session.
- All 7 branches are fully merged into `mobile-support`; there is no unmerged work on any branch. No TODO/FIXME in `src/` or Rust sources. `ICON_FEATURE_SPEC.md` is the only spec/planning doc in the repo.
- Remaining known debt (unchanged): native `onRenderProcessGone` recovery, storage-snapshot safety for the Windows E2E phase, `e2e-full.ps1:183-184` blanket `msedgewebview2` kill, tracked junk (`e2e/_avtest2.txt`, `e2e/e2e-all.ps1.new`, `e2e/_e2e_pixel.png`), and whether `Run App.bat` should stop being gitignored.

## SESSION 2026-09-27 (cont. 4) — PROFILES + SYNC: approach CHOSEN (design discussion, NO code written)
User wants a profile system to move their setup between desktop and Android. Constraint: "not anything intrusive, ideally no personal data". App is intended to be **released publicly**, so the design must serve users who start on one device and later add a PC.

### Decision
Options presented (A folder-sync, B LAN device-to-device, C self-hosted WebDAV/S3, D hosted provider, E manual bundle export/import). **User chose E (export/import `.spellcaster` bundle) as the shipped baseline**, with A (folder sync) as a possible later addition. E is the only option needing no transport, no accounts and no infrastructure, and it is the primitive the others are built on.

### Facts established while scoping (verified in code)
- Sync payload is small: the 29 MB / 71 files of **default sounds live in `public/assets` and ship inside the app**, referenced by filename only -> already identical on every install. Only user uploads travel.
- Storage today: data in localStorage (`ttrpg_characters`, `ttrpg_environment` **SINGULAR**, `ttrpg_groups`, `ttrpg_data_version`, plus settings `boxSize`, `backgroundSettings`); uploaded audio + icons in `BaseDirectory.AppData` / `uploads` (`TAURI_STORAGE_DIR`, App.jsx:10); web backend uses `sound_file_*` localStorage data-URLs (~5 MB cap).
- **Custom sound icons are also uploads** (App.jsx:1564-1566 `storeFileInLocalStorage` -> `icon: storedName`) — a bundle must carry `icons/` too, not just audio. Easy to miss.
- **There are no `updatedAt`/`createdAt`/`deletedAt` fields anywhere** (0 hits in `src/App.jsx` + `src/data.json`) -> last-write-wins conflict resolution is impossible today. Add timestamps + tombstones now; it is the prerequisite for folder/cloud sync later.
- `src-tauri/capabilities/default.json` grants only `fs:allow-appdata-*` + a few pathless perms -> writing a bundle to a user-picked path requires widening the fs scope.

### Scope agreed as needed (7 work items)
1. Profile model + storage refactor: `profiles` index + `profile:<uuid>:<key>` namespacing + `uploads/<profileId>/`, and a first-run migration for existing users (reuse the `ttrpg_*_old` backup trick, App.jsx:79-87). Multi-profile UI: create/rename/duplicate/delete/switch. **Highest data-loss risk — do it first and alone.**
2. Bundle format + optional encryption: `manifest.json` (formatVersion, appVersion, per-file sha256+size) + `data.json` + `audio/` + `icons/`; reuse `normalizeStoredData` (App.jsx:43) as the forward-migration entry point; optional passphrase with AES-256-GCM **in Rust** (preferred over WebCrypto — no secure-context question, and testable from `e2e/`).
3. Bundled-vs-uploaded provenance: a write-time flag is safer than filename guessing, so the 29 MB of built-in audio never enters a bundle.
4. Export pipeline: streaming zip (**fflate**), never a whole-bundle `Uint8Array`; `tauri-plugin-dialog` + widened fs scope; web = Blob download; **Android SAF save is the least-known piece — spike early**; remember `main.rs`/`lib.rs` plugin parity.
5. Import pipeline, **atomic**: validate -> temp dir -> swap. Modes: new profile / replace active / merge (needs id-collision + duplicate-name policy). Per-file progress + report.
6. Public-release concerns: round-trip guarantee, "reset to starter sounds", clear errors on corrupt/wrong-version bundles (never a partial import), and a note that exported profiles contain the user's own audio.
7. E2E: new `e2e/e2e-profiles.mjs` wired into `e2e-full.ps1` (seed -> export -> wipe -> import -> deep-compare). Architect for testability: import takes bytes, the UI only feeds it picker bytes — otherwise tests hit the known `DOM.setFileInputFiles` Android-WebView renderer crash.

### Deliberately out of scope
Accounts, real-time sync, WebDAV, cloud, QR. Keep a `ProfileTransport` interface with a single "file" implementation so A/B/C can be added without touching the UI.

### Status
Design discussion only — **no code written**, app untouched. Spec authored: **`PROFILE_SYNC_SPEC.md`** (14 sections, planning-only header like `ICON_FEATURE_SPEC.md`). Backup taken first per AGENTS.md: `C:\Users\emire\OneDrive\Masaüstü\ttrpg-soundboard-backup-20260927-021859` (202 files). `git status`: `PROFILE_SYNC_SPEC.md` (new) + `README.md` + `opencode-summary.md`.

### Extra facts found while authoring the spec (all verified in code)
- **Two sound-file shapes coexist**: character/group sounds use `files: [{...}]`; legacy environment sounds use a single `file: "Name.mp3"` (`src/data.json` `environmentSounds`; playback fallback at App.jsx:2532). `files[]` entries are themselves heterogeneous (`name` / `storedName` / `displayName` / `url`, see App.jsx:1077-1084). **The exporter must walk both shapes.**
- **Custom background image is an inline base64 data URL up to 5 MB written straight into localStorage** (`backgroundSettings.imagePreview`, App.jsx:2147-2194) — the biggest localStorage quota risk, and it must be extracted to `uploads/` and exported as a file.
- **Crypto recommendation**: AES-256-GCM + Argon2id implemented in **Rust** (not WebCrypto) — no secure-context question on `http://tauri.localhost`, and testable from `e2e/`.
- `fs:default` may not grant `read-dir`; needs verification, plus a widened scope for user-picked paths (today only `fs:allow-appdata-*`).
- New frontend dep needed: **`fflate`** for streaming zip (never buffer a whole bundle in JS memory).
- Spec §9.3 makes `importBundle(bytes)`/`exportBundle() → bytes` pure byte-level functions so E2E can test import **without** driving the native dialog (which is what triggers the Android WebView renderer crash).

### NEXT
Nothing implemented. Awaiting user approval of the spec. Recommended first move when approved: **storage adapter + profile refactor + first-run migration as its own commit** (the only high data-loss-risk item), then provenance flag, bundle format, import, export, UI, E2E.

## SESSION 2026-09-27 (cont. 5) — PROFILE SPEC FINALISED: scope decisions taken (docs only, no code)
User trimmed the design in two rounds, then answered four open questions. All decisions are now baked into `PROFILE_SYNC_SPEC.md` (16 sections). Still **planning only — nothing implemented**. Backup for the whole docs session: `ttrpg-soundboard-backup-20260927-021859` (202 files, taken before the spec was created).

### Decisions (user's calls, all confirmed)
1. **No encryption.** Bundle is a **plain, unencrypted zip**; no crypto fields in the manifest. Rationale recorded in spec §6: payload is sound effects + names, not sensitive material, and a plain file makes "send it to my group" one action. Only consequence noted: audio a user adds may be non-redistributable and a plain zip gives no protection — the Settings UI note says so.
2. **Custom background image is NOT synced.** Per-device cosmetic; the existing inline `imagePreview` code path (App.jsx:2147-2194) is left untouched. **One behaviour deliberately kept:** export must force `background.imagePreview` to `null`, otherwise a 5 MB base64 blob rides along in `data.json`. Checklist asserts a user with a 5 MB background still gets a <1 MB bundle.
3. **Multi-profile retained** (not single-profile + safe replace) — namespaced storage stays, and "New profile" import is the safety story (try an imported setup without losing the current one).
4. **Merge import DEFERRED to v2.** v1 ships **New profile** (default) + **Replace active** only. Merge was the most intricate logic (id remap, duplicate names, per-record conflict rules) and buys least.
5. **Web EXCLUDED from v1** — web keeps working as today, no export/import controls. Structural reason: web audio is base64 data-URLs in `sound_file_*` localStorage (~5 MB cap), so a web export could only ever be metadata. Enabling it later needs web audio moved out of localStorage first; the byte-level API means no rework.
6. **Unresolvable audio policy: keep the container, drop the sound, report the count.** Import never fails over one missing file; the summary names it. Missing **icons** fall back to the default rather than dropping the sound.

### Knock-on effect worth remembering
Dropping Merge removed the **only** v1 consumer of `updatedAt`/`deletedAt` tombstones. Spec §4.3 is therefore re-labelled **optional / forward-compat insurance** for Merge + folder/cloud sync, and implementation step 2 is marked cuttable for minimum v1. Do not treat timestamps as blocking any more.

### Nice side effect of dropping encryption
**No custom Rust commands are required at all** — the feature is now frontend work plus registering `tauri-plugin-dialog` and widening the fs scope. Removes a build-toolchain risk and the `main.rs`/`lib.rs` custom-command parity trap. Spec §10 specifies pure-JS SHA-256 (`@noble/hashes`) rather than `crypto.subtle` (unavailable outside a secure context); promoting just the hash to Rust later is isolated if it proves slow.

### v1 shape
Desktop (Win/Linux/macOS) + Android · multiple named profiles per device · `.spellcaster` plain zip · import modes New profile + Replace active · web excluded · Merge deferred. `PROFILE_SYNC_SPEC.md` §13 carries a "Deferred to a later release" checklist so nothing is silently lost.

### Repo status
`git status`: `PROFILE_SYNC_SPEC.md` (new, untracked), `README.md` (modified, from the earlier docs session), `opencode-summary.md` (this file). **No app code touched in this session.**

### 🔶 PARKED — user closed this out as documentation-only on 2026-09-27
User: *"No need, just the documentation is enough for now. We will do it in a different time."* `PROFILE_SYNC_SPEC.md` header now reads **"parked by user decision"** so a future session does not start implementing it unasked. **This is the second parked spec** alongside `ICON_FEATURE_SPEC.md` — if a future session is asked to "continue the profiles work", confirm the user wants implementation before touching `src/App.jsx`. Nothing in the repo depends on either spec; both are documentation only.
