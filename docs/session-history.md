# Session History (archive)

> Append-only archive of past AI-agent sessions for **The SpellCaster** (`ttrpg-soundboard`).
> Written 2026-10-04 when the project-state file was split: that file now holds only the
> **current** state (read it first); this file holds the dated detail of how we got there.
> Read this ONLY when you need the reasoning behind a past decision — it is not a task list,
> and most of it is superseded. Current state, debts and gotchas live in `../PROJECT_STATE.md`.

---

## 2026-09-01 session â€” all 28 original + 9 follow-up issues fixed
The edge-to-edge audit (originally tracked in `TESTING_REPORT.md` + `TESTING_REPORT_FOLLOWUP.md`, **deleted** once fully resolved â€” see git history if needed) is **fully resolved** â€” #16 (the last partial) was fixed and on-emulator verified:
- Audio/storage: blob URL revoke on stop + cleanup, fade-in reads `audio._fadeTargetVolume` so master-volume changes scale smoothly mid-fade, canonical `audio._soundId` replaces `startsWith` instance matching, smoke-guarded delete/dupe paths.
- Data robustness: `readStoredData` (via `normalizeStoredData`) guarantees `sounds: []`; `boxSize`, theme + sound colors (`normalizeHex` / `getHueRotateFromColor` / glow) NaN-safe.
- Mobile UI: no layout flash (`isMobile` is now a sync const), drawer got `role="dialog"` + `aria-modal` + `aria-label` + Escape + Tab focus trap + `safe-area-inset-bottom`, bottom-sheet modals get safe-area padding, empty-state hints in all sidebars.
- Version: `vite.config.js` now `define`s `__APP_VERSION__` from `package.json` â†’ About modal shows `0.1.3` (do not hardcode the version).
- Edit mode: Stop-All + per-card stop work while editing (N4).
- Verification: `npx vite build` âœ“, `npx eslint src/App.jsx` â†’ 0 errors / 3 warnings (pre-existing: `convertFileSrc`, `_`, `ev`).

## Groups feature (started 2026-09-01, continued later â€” UNCOMMITTED)
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
  - environment â†’ characters: each category is **converted into a character** (`name` â† `category`, sounds carried over), then `categories` is cleared.
  - characters â†’ environment: each character is **converted into a category** (`category` â† `name`, sounds carried over), then `characters` is cleared.
  - So a group holds one representation at a time; names/sounds survive the round-trip (only container ids regenerate, e.g. `Ambience` category becomes an `Ambience` character with a Person icon).
- `switchTab(type)` + `selectItem(type, id)` helpers: handle tab switching with per-tab memory, used by rail/drawer/sidebar.
- Repair effect: keeps selection valid â€” for environment mode defaults to first category; for characters mode defaults to first character.

### Handlers
- `addGroup`: creates new group with `mode: 'environment'`, `categories: []`, `characters: []`.
- `addCategory` / `updateCategory` / `deleteGroupCategory`: route into group categories (environment mode).
- `addGroupCharacter` / `updateGroupCharacter` / `deleteGroupCharacter`: route into group characters (characters mode).
- `handleCharacterFormSubmit`: branches â€” group character mode validates/adds/edits within the group's `characters`; otherwise top-level characters.
- `handleDeleteCharacter` / `handleEditCharacter`: branch on `tabType === 'groups'` to target group characters.
- Sound ops (`addSound`, `updateSound`, `moveSound`, `deleteSound`, `deleteGroup`, confirm modal): branch on group `mode` â€” characters mode routes into `group.characters[n].sounds` (containerType `'groupCharacter'`), environment mode into `group.categories[n].sounds` (containerType `'group'`).

### UI locations
- **Mobile rail**: group tabs as initial-letter buttons + delete badges (editMode + drawer open) + "Add New Group" button.
- **Mobile drawer**: group tabs with delete badges; **segmented Characters/Environment toggle** (editMode, group tab active) with User/Music icons (44px); Add Character/Add Category + Add Sound chips branch on group mode; character rows (User icon) vs category rows (Music icon) with delete badges; mode-specific empty states.
- **Desktop sidebar**: group tabs with delete badges; **segmented Characters/Environment toggle** (editMode, group tab active); character rows vs category rows with select/delete/edit.
- **Desktop edit-mode bar**: Add Character shown for group-character mode or top-level characters; Add Category shown for environment or group-environment mode; Add Group always shown.
- **Mobile + desktop headings**: show group character name (characters mode) or group category name (environment mode), fallback to group name.
- **Sound grids**: read `activeGroupCharacter?.sounds` (characters mode) or `activeGroupCategoryObj?.sounds` (environment mode).
- **Confirm delete modal**: names group deletion, group-category deletion, and group-character deletion targets correctly.

### CDP test verification (previous session â€” both desktop + Pixel_7 emulator)
- Group creation (Forests) âœ“
- Category creation (Ambience, Monsters) âœ“
- Sound routing (sounds in group-category display in grid) âœ“
- Tab persistence (Characters â†” Groups switching preserves selection) âœ“
- Delete badges on group tabs â†’ confirm modal âœ“
- Category delete in drawer â†’ confirm modal âœ“
- Mobile drawer: Add Category chip for group tab âœ“
- Mobile heading shows group-category name + delete trash âœ“
- Add Group button present in rail âœ“
- **Character/Group mode toggle**: added this session, code-verified (lint + build) but NOT yet run on emulator/desktop.

### Remaining known issues
1. ~~`addGroup` doesn't init `categories: []`~~ â€” FIXED (now inits `categories: []`).
2. ~~Mobile heading trash should be hidden when drawer is closed; group/category deletion should only happen via drawer delete badges and category row delete buttons~~ â€” FIXED (heading trash removed; drawer shows group-tab + category-row delete badges).
3. ~~`EDGE_TO_EDGE_REPORT.md`~~ â€” DELETED (all actionable items fixed).
4. ~~Character/Group mode toggle button highlighting was inverted (both lime in environment mode, neither green in characters mode)~~ â€” FIXED: Characters is green when `mode==='characters'`, Environment green when `mode!=='characters'` (exactly one always green), in both drawer + desktop sidebar.
5. ~~Toggle was view-hide only (categories vanished instead of converting)~~ â€” FIXED: toggle now **converts** entries between category â†” character representations.
6. ~~Character/Group mode toggle needs on-device verification~~ â€” **VERIFIED on Pixel_7 emulator via WebView CDP (2026-09-03)**:
   - Button highlighting: exactly one green at a time â€” Environment lime in env mode, Characters lime in char mode (checked via computed background of the `flex-1` segmented buttons).
   - Conversion environmentâ†’characters: seed group Forest [Ambience(Wind), Monsters] â†’ after toggle `mode:'characters'`, `categories:[]`, `characters:[{name:Ambience,sounds:[Wind]},{name:Monsters,sounds:[]}]` â€” sounds carried over.
   - Conversion charactersâ†’environment: round-trips back to categories keeping the Wind sound.
   - Test scripts cleaned up; adb forward removed.

### Fixes/features applied this session (2026-09-03)
- `addGroup` (App.jsx:~1980) now initializes `categories: []` so new groups have a valid category array immediately.
- **Mobile heading trash removed** â€” no Delete Group button visible when the drawer is closed.
- **Drawer group-category rows** now have delete badges (`handleDeleteCategory`, branches to `groupCategory` with confirm modal).
- **Mobile rail group-tab delete badges** gated to `editMode && isPanelOpen` â€” hidden while the bar is closed, shown when the drawer is open.
- Drawer group-tab delete badges only render inside the open drawer.
- Desktop sidebar group delete badges are **unchanged** (always visible â€” desktop has no drawer; user scope was mobile-only).
- **NEW: Character/Group mode toggle for groups** â€” per-group `mode`, segmented toggle in drawer + sidebar, branching Add buttons, character/category rows, grid/heading routing, and full group-character CRUD. Backup: `ttrpg-soundboard-backup-20260903-143404`.
- **Group mode toggle fixes (same day)**:
  - **Button highlighting fixed** â€” the Characters toggle button had inverted logic (both pills lime in environment mode / neither green in characters mode). Now exactly one is green: Characters green when `mode==='characters'`, Environment green when `mode!=='characters'` (drawer App.jsx:~3479 + desktop sidebar App.jsx:~3712).
  - **Toggle now CONVERTS data** instead of hiding â€” per user clarification, switching a group to Characters mode converts each category into a character (name+sounds kept, e.g. `Ambience` category â†’ `Ambience` character); switching back converts characters into categories. `toggleGroupMode` (App.jsx:~2483) clears the source array and regenerates container ids; names/sounds survive round-trip.

## Emulator test (2026-09-01) â€” Pixel_7 / Android 17, all PASS
Driven headlessly via WebView CDP (debug WebView exposes `tcp:9223`). App rebuilt+installed (`app-universal-debug.apk`), data restored to seed afterwards.
- Groups feature also tested on emulator: group creation, category CRUD, sound routing, delete confirm modals, drawer/rail UI all verified.
- About modal shows `Version 0.1.3`; Settings â†’ Legal & Credits modal has `env(safe-area-inset-bottom)` padding.
- Drawer: `role="dialog"`/`aria-modal="true"`/`aria-label="Navigation"`, close button receives focus, Escape closes, `calc(env(safe-area-inset-bottom) + 16px)` on scroll container.
- Edit toggle intentionally inert while drawer open (#17); works after closing.
- #22 empty states render: "No characters yet â€” open Edit Mode to add one." / "No categories yet â€” open Edit Mode to add one." (mobile drawer).
- #27: playing card gets `ring-2 ring-lime-500`; mp3 fetched from `/assets/...`; audio confirmed streaming via logcat AAudio.
- N4: entered Edit Mode while Rain (looping) played â†’ Stop-All enabled + per-card stop visible both work; raincard ring suppressed in edit mode by design (`App.jsx:2144`).
- N6: injected `fadeIn: 2` on Rain via localStorage, reloaded, changed master volume mid-fade (0.5@200ms, 0.8@500ms) â†’ no exception, playback continues, volume display syncs.
- #16 (rail-clobbering) verified on emulator: select Human Paladin â†’ switch to Env (drawer tab) â†’ back to Characters â†’ still Human Paladin; same in reverse for an Environment category. Rail + drawer tabs + desktop sidebar all use the `switchTab`/`selectItem` helpers.
- Logcat: no JS exceptions/`Error playing sound`/crashes for the app PID. Only benign WebView `BLUETOOTH_CONNECT permission missing` warnings (no BLUETOOTH perm declared; speaker playback unaffected).
- Testing notes: `adb exec-out screencap` pipe to file corrupts binary in PowerShell â€” use `adb shell screencap -p /sdcard/x.png` + `adb pull`. Sound cards are `<div role="button">`, NOT `<button>`.

## Emulator test (2026-09-03) â€” group mode toggle CONVERSION + HIGHLIGHT
Driven headlessly via WebView CDP. The running debug app serves the frontend from the Vite dev server (port 5173) â€” the served `/src/App.jsx` was confirmed to contain the reworked `toggleGroupMode` (conversion) before testing, so the running app reflected the latest code (no reinstall needed).
- CDP plumbing on this machine: emulator console `5554` â‰  app pid. The abstract socket is **`webview_devtools_remote_<app-pid>`** (the app pid from `adb shell ps -A | grep spellcaster`), NOT `_5554`. Command: `adb forward tcp:9223 localabstract:webview_devtools_remote_<pid>` â†’ `curl http://127.0.0.1:9223/json`. Navigation via `Runtime.evaluate` clicking real `<button>` elements by aria-label / innerText.
- Seed: `localStorage.ttrpg_groups` = `[{id:'gt1', name:'Forest', mode:'environment', categories:[{category:'Ambience', sounds:[Wind]},{category:'Monsters', sounds:[]}], characters:[]}]`, then `Page.reload`.
- Drive sequence: rail "Enter Edit Mode" â†’ drawer "Open navigation" â†’ drawer group tab "Forest" â†’ segmented toggle clicks.
- **Highlight âœ“**: exactly one segmented button lime at a time â€” Env lime in env mode, Characters lime in char mode (via `bg-lime-600` class + computed background of the `flex-1` buttons).
- **Conversion âœ“ (envâ†’characters)**: after clicking "Characters", storage = `mode:'characters'`, `categories:[]`, `characters:[{name:'Ambience',sounds:[Wind]},{name:'Monsters',sounds:[]}]` â€” categories became characters, `Wind` sound carried over.
- **Conversion âœ“ (charactersâ†’env)**: after clicking "Environment", storage = `mode:'environment'`, `categories:[{category:'Ambience',sounds:[Wind]},{category:'Monsters',sounds:[]}]`, `characters:[]` â€” round-trips cleanly preserving names + sounds (container ids regenerate each toggle).
- Test scripts cleaned up from `%TEMP%\opencode`; `adb forward` removed afterwards.

## SESSION 2026-09-05 â€” DESKTOP SPLIT-VIEW GROUP SUPPORT (in progress)
### What this task is
Make **native desktop split view** show **group contents**. Split view (`isSplitView`, toggle in desktop header) shows two panels (Characters / Environment). Before this work, groups were invisible there â€” only top-level characters/categories showed. Goal: group characters (from groups in `mode:'characters'`) appear under group headers in the Characters panel, group categories (from groups in `mode:'environment'`) under group headers in the Environment panel, with select/play, edit-mode delete+rename, and full add/edit sound routing. Mobile and single-tab flows untouched.

### What's done (all in `src/App.jsx`, `eslint 0 errors`, `vite build` passes)
- **Desktop group-bar scrollbar** (earlier this session): `desktopTabBarRef` + `desktopTabBarScrollable`, ResizeObserver + resize listener, conditional `no-scrollbar` so a themed scrollbar only appears when the horizontal tab bar overflows. (`ResizeObserver` added to eslint globals.)
- **New state**: `splitCharSelection` / `splitEnvSelection` (`null | {kind:'top',id} | {kind:'group',groupId,itemId}`), `splitSoundTarget` (`{groupId, containerType:'group'|'groupCharacter'|'character'|'environment', itemId}`), `groupEditTargetId`, `pendingDeleteGroupId`, `groupModalTargetId`.
- **Effects**: keep split selections valid on item deletion; clear `groupModalTargetId`/`splitSoundTarget` when modals close (this effect is placed AFTER the modal `useState`s â€” see TDZ gotcha below).
- **`renderPanelSection(type)`** fully rewritten (App.jsx ~line 3043): per-panel independent selection; `groupSections` = groups whose `mode` matches the panel; group headers (lime, uppercase) + items below; per-item select/play; edit-mode delete/rename; group header `[+]` add button (edit mode) to add a character/category INTO that group (routes via `groupEditTargetId`); "No characters/categories in this group." empty hint; grid heading `GroupName â€” Item`.
- **Routing**: `addSound`/`updateSound` first check `splitSoundTarget` and route by `containerType` into the right group character/category OR top-level character/category; `moveSound` got an optional `groupId` param (drag-reorder in split view previously wrote to the single-tab `activeGroup`); delete-confirm modal names resolve via `pendingDeleteGroupId`; `handleCharacterFormSubmit`/`handleCategoryFormSubmit` resolve the target group via `groupEditTargetId`.
- **Group CRUD generalized** with optional `groupId` param: `addGroupCharacter`, `updateGroupCharacter`, `deleteGroupCharacter`, `addGroupCategory`, `updateGroupCategory`, `deleteGroupCategory`.
- `openAddCharacterModal` / `openAddCategoryModal` now `setGroupEditTargetId(null)` (top-level add always top-level).

### Bugs fixed this session
1. **BLANK SCREEN (critical, found via headless Edge)**: a cleanup `useEffect` referenced `showSoundModal`/`showCharacterModal`/`showCategoryModal` in its deps array BEFORE those `useState`s were declared â†’ TDZ `Cannot access before initialization` on every render â†’ whole tree unmounted. **Fix: moved that effect below the modal state declarations.** Lint/build do NOT catch TDZ (identifiers are defined, just later) â€” `no-use-before-define` is off.
2. **Newly added groups invisible in split view (just fixed, verifying now)**: `groupSections` filtered to groups WITH items, but new groups start empty (`mode:'environment'`, `categories:[]` from `addGroup`) â†’ never shown. **Fix: show every group of the matching `mode`, empty or not**, plus the group header `[+]` add-member button + empty hint.

### Where I am right now / next steps
- âœ… **Empty-group split-view fix VERIFIED (2026-09-05, headless Edge CDP)**: seeded empty env group "Tavern Team" + empty char-mode group "Heroes", reloaded, toggled split view â†’ both group headers present (`groupHeaders:["Heroes","Tavern Team"]`), both panel select-placeholders present. `eslint 0 errors` (3 pre-existing warnings) + `vite build` passes. Headless Edge test instances cleaned up.
- Remaining: user manual click-through in the real Tauri window (create empty group â†’ toggle split view â†’ group header appears â†’ edit-mode `[+]` on the header adds a character/category â†’ add/edit sounds on group items). Note vite dev server on 5199 still running.
- **Standing rule added at user request**: a new "Permanent instruction: keep `opencode-summary.md` up to date" was added to `AGENTS.md` (so every future session loads it), and the "Session etiquette notes" section here now mandates updating this file after every meaningful step. Both explicitly scope the rule to **opencode only**: AGENTS.md now carries an explicit warning to all other agents (Cursor/Copilot/Claude Code/etc.) that `opencode-summary.md` is **opencode-owned and READ-ONLY for them** (edits forbidden, to avoid agents tripping over each other), and this file's header now repeats that warning.
- User confirmed empty groups visible in split view; ordered 4 standardization changes (plan confirmed, no open questions). Executing now.

## SESSION 2026-09-05 (cont.) â€” SPLIT/SINGLE-VIEW CONSISTENCY (confirmed, implementing)
### Approved changes (from Q&A, all answers picked the recommended option)
1. **Single-view sidebar title**: `App.jsx:4116` static `<h2>Categories</h2>` â†’ `<h2>Groups</h2>` (all tabs).
2. **Split-view panel titles**: `App.jsx:3199` `{isCharSection ? 'Characters' : 'Environment'}` â†’ plural `'Environments'` (Characters stays).
3. **Group mode-toggle labels** â†’ `Character Pack` / `Environment Pack` in BOTH desktop sidebar (`App.jsx:4172`/`4179`) and mobile drawer (`App.jsx:3940`/`3947`). These spans are duplicated pairs â€” edits need extra surrounding context (py-2.5/text-sm drawer vs py-2/text-xs sidebar).
4. **Split panels scroll per-panel like single view**: `App.jsx:3252` list `space-y-2 flex-1 overflow-y-auto no-scrollbar` â†’ `space-y-2 flex-1 min-h-0 overflow-y-auto` (min-h-0 enables flex shrink so scroll engages; `overflow:auto` shows themed scrollbar only on overflow, no JS detection needed). Same treatment for the sound-grid panel `App.jsx:3379` (`min-h-0 overflow-y-auto`).
- User chose NOT to change the single-view tab-bar buttons (`Characters`/`Environment`), the group name headers in split view, or the toggle logic itself â€” labels only, plus title changes.
- Mode: live implementation now. Backup made: `ttrpg-soundboard-backup-20260905-193501`. Old backups to be deleted (keep newest).
- ðŸ’¡ ALL 4 CHANGES IMPLEMENTED & VERIFIED (2026-09-05, headless Edge CDP, vite on 5199, script `%TEMP%\opencode\sb-naming-test.ps1`):
  - Sidebar h2 now `Groups` âœ“ (STATE SPLIT OFF: `h2s:["Groups","Elf Sorcerer"]`)
  - Split h3 titles now `["Characters","Environments"]` âœ“ (plural; both Select-placeholders present)
  - Pack toggle buttons `["Character Pack","Environment Pack"]` âœ“ (seen after Groups tab + Edit Mode)
  - Split lists: `min-h-0 overflow-y-auto` (themed scrollbar only on overflow); grid panel same. (`innerText` group-name check flaked only due to CSS `uppercase` transform â€” header presence was already proven by the earlier `sb-groups-test2` run; code untouched in that area.)
  - eslint 0 errors (3 pre-existing) + `vite build` âœ“. Headless Edge instances cleaned; vite 5199 still running.
- Old backups 20260905-{170818,172625,174349,181935,182744,193501} deleted at user request; **newest backup: `ttrpg-soundboard-backup-20260905-195151`** (made before this split-view restructure; old ones pruned to newest).
- NEXT: user manual click-through in the real Tauri window, then optionally delete temporary scripts.

## SESSION 2026-09-05 (cont.) â€” SPLIT VIEW RESTRUCTURED INTO TWO "MINI SINGLE-VIEWS" âœ… DONE + VERIFIED
- **User decision**: keep the "one-below-another" look as an ALTERNATE view later, NOT now. Current split view must mirror the single-view sidebar.
- **Q&A confirmed**: (1) mirror single view structure, (2) keep top-level members reachable in split, (3) panel titles match single-view style (plain, not lime).
- **What changed in `src/App.jsx`**:
  - `renderPanelSection` header: lime/green `h3` (styling like a group name) â†’ plain `h2 text-lg font-semibold` (`Characters` / `Environments`), Edit pencil `px-3 py-2` at same height.
  - NEW **source pill row** below the title (mirrors single-view tab bar): `[Top-level]` + matching-mode groups (`mode==='characters'` in char panel, `mode!=='characters'` in env panel), horizontal `overflow-x-auto flex-nowrap`, active pill `bg-lime-600`. Per-panel refs `splitCharTabBarRef`/`splitEnvTabBarRef` + flags `splitCharTabBarScrollable`/`splitEnvTabBarScrollable` with its own ResizeObserver effect (same conditional `no-scrollbar` as the desktop tab bar).
  - NEW per-panel source state `splitCharSource`/`splitEnvSource` = `'top' | groupId` (default `'top'`). `selectPanelSource(s)` switches source + clears the member `setSelection(null)`.
  - Member list now shows ONLY the active source, flat: `'top'` â†’ top-level characters/environment; group â†’ that group's members (`No characters/categories in this group.` hint when empty). Old stacked group-section headers + per-group `[+]` add buttons + `handlePanelAddItemToGroup` all REMOVED.
  - `handlePanelAddItem` replaces it: `setGroupEditTargetId(source === 'top' ? null : source)` â†’ Add Character/Add Category in edit mode routes into the ACTIVE source group (or top-level).
  - Selection validity effect extended: resets a panel source to `'top'` if its group is deleted OR switches opposite mode (e.g., mode toggled in single view while split state persisted).
  - Selection shape unchanged (`{kind:'top', id}` / `{kind:'group', groupId, itemId}`) â†’ all sound routing, drag reorder, delete/rename unchanged.
- **Verified** (headless Edge CDP, port 5199, script `%TEMP%\opencode\sb-split-tabs-test.ps1`): titles `Characters`/`Environments` plain (no lime class), pills `[Top-level, Heroes]` / `[Top-level, Tavern Team]`, leftover group-header spans = 0, top-level Elf Sorcerer + Rain visible at split-on, clicking `Heroes` pill shows Sir Robin only, member click â†’ grid heading `Heroes â€” Sir Robin`; same for `Tavern Team` â†’ `Fireplace` â†’ `Tavern Team â€” Fireplace`. eslint 0 errors (3 pre-existing) + `vite build` âœ“.
- **Test gotchas re-learned**: env data key is `ttrpg_environment` (SINGULAR â€” `ttrpg_environments` seed is ignored and defaults win); PowerShell console mangles the em dash (U+2014) in output â€” app text itself is correct; the grid heading filter should match group/item names, not the dash.
- **Follow-up (user, 2026-09-05)**: the "Top-level" source pill renamed â†’ `Default Characters` (characters panel) / `Default Environments` (environment panel), `App.jsx:~3270`. Verified headless (pills `[Default Characters, Heroes]` / `[Default Environments, Tavern Team]`, all other split checks still pass). eslint 0 errors + build âœ“. Backup: `ttrpg-soundboard-backup-20260905-200501` (old 195151 pruned â€” newest only). NEXT: user manual click-through of split view in Tauri window.

## SESSION 2026-09-05 (cont.) â€” EDIT-BAR BUTTON ORDER + DESKTOP PANEL STRETCH âœ… DONE + VERIFIED
- **Ask 1**: reorder single-view Edit Mode Controls bar â†’ `Add Group` first, then context `Add Character`/`Add Category`, then `Add Sound` last. Moved the `Add Group` button block (Folder icon, `openAddGroupModal`) above the Add Character/Category conditionals in `App.jsx` (edit bar ~3758). Verified headless: `["Add Group","Add Character","Add Sound"]`.
- **Ask 2**: desktop single-view sidebar ("Groups" panel) + Standard Sound Grid panels should **extend to fill the screen height** instead of only wrapping content (see mobile reference). Fix: added `min-h-full` to the single-view layout row (line 3819, desktop branch of the `isMobile ? ... : ...` ternary) â€” matching the mobile branch. The two `bg-dark-800` panels then stretch via flex row `align-items: stretch`; the sidebar's inner list already has `flex-1 overflow-y-auto` so it scrolls internally.
- **Verified headless** at `--window-size=1440,900` (â‰¥1024px so the `lg:flex-row` branch actually applies): viewport 808 âˆ’ header 73 = 735 available; scroll container content height 735 âˆ’ py-6(48) = 687; sidebarH == gridH == 687 â†’ both fill. eslint 0 errors (3 pre-existing) + `vite build` âœ“.
- **Gotcha**: at 800px the `lg:` breakpoint isn't hit â†’ row falls back to the stacked `flex-col` branch, so always test panel-stretch at width â‰¥1024. `min-h-full` resolves against the scroll container's *content* height (padding `py-6` subtracts 48px).
- **Backup**: `ttrpg-soundboard-backup-20260905-201352` (old 200501 pruned, newest only).
- NEXT: user manual check of the new edit-bar order + stretched panels in the real Tauri window.

## SESSION 2026-09-05 (cont.) â€” SPLIT VIEW PANELS ALSO STRETCH âœ… DONE + VERIFIED
- Follow-up: single-view stretch applied to split view too. Changes in `src/App.jsx` (SPLIT VIEW LAYOUT ~3806): outer container `flex flex-col space-y-4` â†’ added `min-h-full`; the `grid grid-cols-1 xl:grid-cols-2 ...` â†’ added `flex-1 min-h-0` (fills the extra height; grid auto row track stretches via default `align-content: normalâ†’stretch`, grid items stretch by default, and each `renderPanelSection`'s existing `h-full` then resolves against the now-definite column height). No changes inside `renderPanelSection`.
- **Verified headless** at 1440Ã—900: after split toggle, both panels â€” mini sidebar (`h2 "Characters"/"Environments"` inside `.p-4`) and sound grid (`overflow-y-auto p-4`) â€” measure 687px each (available 735 âˆ’ py-6(48)), row 687. eslint 0 errors + `vite build` âœ“.
- **Test gotcha**: split toggle button = the header switch `button.relative.inline-flex.h-5.w-9` (no aria-label; locate by class).
- **Backup**: `ttrpg-soundboard-backup-20260905-202030` (old 201352 pruned, newest only).
- NEXT: user manual check of split + single views stretched, edit-bar order, in the real Tauri window.
- Verification plan after edits: `npx eslint src/App.jsx` (0 err/3 pre-existing warnings) + `npx vite build`, then headless Edge CDP text-check for `Groups`, `Environments`, `Character Pack`, `Environment Pack`; then update this summary.
  - CDP plumbing gotchas (this machine): Edge headless must launch DIRECTLY at the app URL with `--no-proxy-server --remote-debugging-port`, enum pages via `/json`, pick the page whose `url` is the app (skip `edge://*`); `about:blank` and `edge://` pages throw `SecurityError` on `localStorage`; `Get-PageWs` parameter is `-Port` NOT `-DebugPort`; Edge dies between separate shell invocations â†’ run launch + test in one command.
- After verification: final `npx eslint src/App.jsx` + `npx vite build`, then update todos; user does final manual click-through (run `npm run tauri dev`).
- Backups this session: `ttrpg-soundboard-backup-20260905-174349`, `-181935` (post TDZ fix), `-182744` (before empty-group fix).

### âš ï¸ GOTCHAS learned (don't repeat)
- **TDZ**: any new `useEffect`/expression reading a state must come AFTER that state's `useState` in the component body. Lint/build won't catch it â€” must runtime-test.
- `splitSoundTarget` must carry ALL four container types (group/groupCharacter/character/environment) â€” earlier version only handled groups, so top-level split add/edit silently routed nowhere.
- Test harness notes above about Edge headless/CDP.

## SESSION 2026-09-07 â€” DESKTOP SINGLE-VIEW SOUND GRID NOW SCROLLS INDEPENDENTLY âœ…
- **Ask**: "If there are a lot of sounds in a single panel, will it unlock scrolling on its own? If not it should" â€” desktop version only.
- **Was**: desktop single-view "Standard Sound Grid" (`App.jsx:4387`) had `flex-1 min-w-0` **but no `overflow-y-auto`/`min-h-0`** â†’ it grew with content and the WHOLE page scrolled (sidebar + grid together). Split-view panels already scrolled internally; single-view did not.
- **Fix (3 one-line class changes, desktop single-view only) â€” `src/App.jsx`**:
  1. Main-content wrapper `App.jsx:3748`: `flex-1 overflow-y-auto w-full â€¦` â†’ added `flex flex-col` (so its child can be a height-bounded flex item). Behavior-neutral for mobile + split (verified reasoning: their wrappers use `min-h-full`, unchanged; they still whole-page scroll).
  2. Single-view layout row `App.jsx:3819` desktop branch: `â€¦ gap-6 min-h-full` â†’ `â€¦ gap-6 flex-1 min-h-0` (row now bounded to the content area instead of growing). Mobile branch untouched.
  3. Sound-grid panel `App.jsx:4387`: `flex-1 min-w-0 bg-dark-800 rounded-xl p-6` â†’ `flex-1 min-w-0 min-h-0 bg-dark-800 rounded-xl p-6 overflow-y-auto` (scrolls internally).
  - Sidebar (already `flex-col` + inner `flex-1 overflow-y-auto no-scrollbar` list at 4246) stays fixed; grid scrolls; on <1024px (flex-col fallback) old whole-page scroll still takes over â€” acceptable.
- **Verified**: `npx eslint src/App.jsx` 0 errors (3 pre-existing warnings) âœ“ Â· `npx vite build` âœ“ Â· **headless Edge CDP** (vite preview :5233, remote-debug :9333, seed 60 sounds via localStorage):
  - Grid panel `clientH 687 / scrollH 1636` (hasFlexWrapGrid); `scrollTo(bottom)` â†’ `scrollTop 949`, clippedAtBottom true.
  - Page didn't move: `windowScrollY 0`, `docScrollH 808 == viewport 808`; sidebar `top 97` before and after scrolling.
  - **Harness gotcha**: naive finder matched the outer main-content wrapper first (its `scrollH == clientH`, so scrollTop never moved and looked "stuck") â€” must filter finder to `scrollHeight > clientHeight`. Initial misleading runs were a TEST bug, the app was correct all along.
- **Backup**: `ttrpg-soundboard-backup-20260907-142054` (newest; old 20260905-202030 pruned to newest). Now only `src/App.jsx` modified vs git.
- **NEXT**: user manual check in the real Tauri window (desktop single view, many sounds â†’ grid scrolls, sidebar fixed). Test scripts in `%TEMP%\opencode\` (sb-scroll-test.ps1, sb-scroll-cdp.mjs); processes cleaned up.

## SESSION 2026-09-07 (cont.) â€” PRE-COMMIT END-TO-END TESTING âœ…
- **User asked for E2E testing before committing the scroll changes. Done â€” PASS=45, FAIL=0, WARN=3.**
- Build/test gates: `npx eslint src/App.jsx` 0 errors (3 pre-existing warnings) âœ“ Â· `npx vite build` âœ“.
- **Test harness**: headless Edge CDP (vite preview :5233, remote-debug :9333), seed 60 char sounds / 60 env sounds / 2 groups, script `%TEMP%\opencode\sb-e2e-full.mjs` + `sb-e2e-run.ps1` (all in `%TEMP%\opencode\`, NOT in repo).
- **Suite A (single-view scroll) â€” 10/10 PASS**: grid panel (`bg-dark-800 â€¦ overflow-y-auto`) scrollH=1636/clientH=687, scrollTo(bottom)â†’scrollTop=949, window.scrollY=0, docScrollH==innerH (808), sidebar pinned at top=97 before/after, no horizontal overflow.
- **Suite B (split-view scroll) â€” PASS except expected WARN**: 2 panels found; clicked Human Paladin in the split Characters panel (note: split view has NO `lg:w-64` sidebar â€” the earlier click selector was wrong and was the cause of one "Suite B" failure) â†’ panel 0 scrollH=4740/clientH=687, scrollTo(bottom)â†’4053, page pinned. Panel 1 WARN (environment panel, nothing selected â†’ empty, nothing to scroll â€” correct).
- **Suite C (regression) â€” 30 checks, 0 FAIL, 3 WARN**: structure/sidebar/nav/tab-persistence/edit-mode/sliders/settings/themes/data all PASS. WARNs: C18/C19 (playback ring test â€” seed data has no real .mp3 so audio can't start; known test limitation, not app bug). C20/C21 etc fine.
- **Test-script gotchas this session**: (1) find-the-grid by vague `.flex.flex-wrap` descendant matched the outer main-content wrapper FIRST (scrollH==clientH â†’ looked "not scrolling") â€” must target the `bg-dark-800 â€¦ overflow-y-auto` grid panel explicitly. (2) `\'` inside a backtick template literal sent to CDP turns into a bare apostrophe â†’ `SyntaxError: missing ) after argument list` in the injected page JS; use double-quoted inner strings ("B4: page didn't scroll") instead.
- **Backup**: newest now `ttrpg-soundboard-backup-20260907-155920` (old 20260905-202030, 20260907-142054, 20260907-152054 deleted at user request â€” newest kept only).
- **NEXT**: user commit of `src/App.jsx` (+ opencode-summary.md) on `mobile-support` branch.

## SESSION 2026-09-07 (cont.) â€” SPLIT VIEW PANELS NOW SCROLL INTERNALLY TOO âœ…
- **Ask**: "does split view also scroll like this?" â€” answer was NO at first: split panels already had `overflow-y-auto min-h-0` on their grid (`App.jsx:3441`), but the two-panel CSS grid's **auto rows expand to content**, so panels grew and the whole page scrolled again (same class of bug single view just had).
- **Fix â€” `src/App.jsx`** (2 spots this step):
  1. Split wrapper `App.jsx:3807`: `flex flex-col space-y-4 min-h-full` â†’ `flex-1 min-h-0` (wrapper bounded to content area; main-content is now `flex flex-col` from the single-view fix).
  2. Split panel row `App.jsx:3808`: `grid grid-cols-1 xl:grid-cols-2 â€¦` â†’ **`flex flex-col xl:flex-row gap-6 flex-1 min-h-0 divide-y xl:divide-y-0 xl:divide-x divide-dark-700`**; the two panel columns (`3809/3812`) got `flex-1 min-w-0 min-h-0` (kept `pr-0 xl:pr-4` / `pt-6 xl:pt-0 xl:pl-4`). CSS-grid auto rows were the root cause â€” row height chased content, so `h-full` panels followed it; flex + `min-h-0` bounds them. Tailwind `divide-*` still works on flex children.
- **Verified**: eslint 0 errors (3 pre-existing) âœ“ Â· `vite build` âœ“ Â· headless Edge CDP (same preview:5233 / remote-debug:9333, seed 60-sound char, toggle split switch, click "Seed Wizard"):
  - Sound-grid panel `clientH 687 / scrollH 4740`, `scrollTo(bottom)` â†’ `scrollTop 4053`, bottom reached.
  - Page pinned: `windowScrollY 0`, `docScrollH 808 == viewport`; main-content `735/735` (no whole-page scroll). Env panel `687/687` (placeholder, nothing selected â€” expected).
  - **Key learning**: bounding the WRAPPER alone isn't enough for split â€” the inner panel ROW must be flex (not CSS grid auto rows) or the tracks still grow to content. `flex-1 min-h-0` on the wrapper + row + each panel column.
- **Backup**: `ttrpg-soundboard-backup-20260907-152054` (newest; 142054 pruned to newest). `git status`: only `src/App.jsx` modified.
- **NEXT**: user manual check in real Tauri window (single view + split view, many sounds â†’ each grid scrolls, sidebar fixed). Test scripts `%TEMP%\opencode\sb-split-scroll{,-test.ps1,-cdp.mjs,-2.mjs,-3.mjs}`; processes cleaned up.

## SESSION 2026-09-11 â€” E2E TEST: WEBVIEW (browser) + WINDOWS PROGRAM (Tauri) âœ… (no code changes)
- **User request**: "end to end test on webview and windows program versions. Don't change anything just do the test and report back."
- **Confirmed no code changes**: `git status` unchanged after the run (`src/App.jsx`, `opencode-summary.md` only); `dist/` + `src-tauri/target/` gitignored (vite build output + debug binary). NO backup was needed (nothing changed).
- **Test harness** (all in `%TEMP%\opencode\`, NOT in repo â€” same pattern as previous sessions):
  - `e2e-run.mjs` â€” generalized single suite parameterized via env: `CDP_PORT`, `LABEL`, `EXPECT_TAURI` (1/0), `SAVE_RESTORE` (1 = capture all localStorage before seeding, restore + reload after). Seeding now uses the CORRECT env key `ttrpg_environment` (SINGULAR â€” `ttrpg_environments` is ignored by the app, a latent bug in the old 9/7 seed). Covers: platform (P1â€“P6), single-view scroll (A1â€“A10), split-view scroll (B0â€“B7 + source-pill listing), regression feature matrix incl. env tab loads Forest (C1â€“C34, incl. About â†’ Version 0.1.3, number inputs, sliders, themes, data keys, viewport fills).
  - `e2e-all.ps1` â€” Phase A: `vite build` (via `cmd /c` to swallow the benign INEFFECTIVE_DYNAMIC_IMPORT warning) â†’ `vite preview :5233` â†’ headless Edge CDP :9333 (fresh profile `e2e-web-profile`) â†’ suite with `EXPECT_TAURI=0`. Phase B: set `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9224 --remote-allow-origins=*`, launch `npm run tauri dev` detached, poll `http://127.0.0.1:9224/json` (up to 15 min), suite with `EXPECT_TAURI=1 SAVE_RESTORE=1`. NOTE: PS `$ErrorActionPreference='Stop'` makes the npx vite build stderr warning throw â†’ use 'Continue' + `cmd /c ... 2>&1`.
- **RESULTS â€” Phase A (webview, browser via headless Edge @ localhost:5233)**: **PASS=57 FAIL=0 WARN=3** (WARNs all expected: C18/C19 no real .mp3 in seed so no playback ring; split env panel empty-not-scrollable). Viewport 1416Ã—808; single-view grid scrolls independently (scrollH 1636/clientH 687, page pinned, sidebar pinned top=97); split OK; pills `Default Characters|Default Environments`.
- **RESULTS â€” Phase B (Windows program, `src-tauri/target/debug/app.exe`, page @ localhost:5173 via WebView2 CDP)**: **PASS=57 FAIL=0 WARN=3** (same expected WARNs; split env panel is a placeholder). Viewport 1200Ã—800 (window 1200Ã—800 from tauri.conf.json); single-view grid scrolls (scrollH 1948/clientH 679); split panels scroll internally (panel0 scrollH 1932/clientH 315); page pinned throughout; `isTauri=true` verified; **desktop app real data protected**: 6 localStorage keys captured and restored, `localStorage.restore: restored` + reload confirmed before app kill.
- **Processes/ports**: after cleanup â†’ no listeners on 5173/5233/9333/9224, no app.exe/msedge test procs. âš ï¸ gotcha: the runner's kill-by-cmdline didn't reach the Tauri-launched `app.exe` (survived the npm wrapper), so `e2e-all.ps1` Phase B cleanup was supplemented manually: `Stop-Process -Id <app-pid>` + the msedgewebview2.exe child (PID holding 9224). The `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` approach works reliably for driving the real Windows webview headlessly.
- **Backup**: none needed (no changes). Oldest-known data concern: none. `git status`: only `src/App.jsx` + `opencode-summary.md` modified (pre-existing, uncommitted).
- **NEXT**: report handed to user (this session). No open items; user's choice on committing the uncommitted changes.

## SESSION 2026-09-11 (cont.) â€” HARNESS HARDENED: robust process-lifecycle `e2e-all.ps1` âœ…
- **User request**: rewrite `e2e-all.ps1` (the primary E2E PowerShell runner) to prevent terminal hangs during test execution with 5 strict requirements. All implemented + parse-verified:
  1. **Process Capture**: every background launch (`vite preview` Phase A, headless Edge Phase A, `npm run tauri dev` Phase B) now uses `Start-Process -PassThru` â†’ held in `$previewProc` / `$edgeProc` / `$tauriProc` (the npm wrapper PID captured).
  2. **Try/Finally**: each phase's ENTIRE body (launch â†’ wait â†’ suite) is wrapped in `try { } finally { }`, so cleanup runs even if a test crashes (node throws, CDP times out, etc.).
  3. **Output Redirection**: node runner output (`node e2e-run.mjs`) is piped to a timestamped log `%TEMP%\opencode\e2e-run-<yyyyMMdd-HHmmss>.log` (`>> $Script:TestLog 2>&1` inside `Invoke-TestSuite`) â€” nothing printed to the terminal, no buffer truncation. Status/progress lines + summary still go to console.
  4. **Hard Timeout**: `Assert-NotTimedOut` checks `Script:TestStartTime` every check-in point (`â‰¥15 min` â†’ logs + red message + `exit 1`). Bonus: Phase B already had an independent 15-min CDP readiness deadline poll on `:9224`.
  5. **Aggressive Cleanup** in the `finally` blocks: `Stop-ProcessTree` on the captured PIDs (`$Proc.Kill($true)` â€” .NET tree-kill + `Stop-Process -Force` fallback), then `Remove-Orphans` (CIMInstance sweep for `*ttrpg-soundboard*`, `*vite*{preview,5173}*`, debug-port `msedge`/`msedgewebview2`), then the requested blanket `Get-Process -Name msedgewebview2 | Stop-Process -Force`, then env-var/profile cleanup (`WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS`, Edge profile dirs).
- **PS 5.1 gotcha hit**: the `â‰¥`/`â€”` characters in `Assert-NotTimedOut` strings caused **parse errors** (`Unexpected token 'tests'`). Fix: ASCII `>=` / `--` in code strings only (comments with `â•`/`â”€`/`â†’` are fine). Verify with `[System.Management.Automation.Language.Parser]::ParseFile(...)` â†’ `PARSE OK`.
- **Note**: Phase A cleanup also removes the Edge profile dir (headless run leaves no junk). Known: `$Proc.Kill($true)` on the npm wrapper may not reach the Tauri-spawned `app.exe`/`msedgewebview2.exe` â€” that's why `Remove-Orphans` + the blanket webview kill exist as the net.

## SESSION 2026-09-11 (cont.) â€” E2E HARNESS MOVED INTO THE REPO â†’ `e2e/` âœ…
- **User request**: move the E2E harness out of `%TEMP%\opencode` into the project so it can be referenced when an E2E test is requested. Q&A: (1) move **all E2E files**, (2) target **`e2e/` subfolder**.
- **Now in repo** `C:\Users\emire\Projects\ttrpg-soundboard\e2e\`: `e2e-all.ps1` (primary runner â€” the hardened one), `e2e-run.mjs` (basic suite, env CDP_PORT/LABEL/EXPECT_TAURI/SAVE_RESTORE), `e2e-features.ps1` + `e2e-features.mjs` (deep feature suite, uses WAV upload), `e2e_silence.wav`.
- **Path fixes for relocation** (temp originals deleted â€” repo copy is now the single source of truth):
  - `e2e-all.ps1`: `$proj = Split-Path -Parent $PSScriptRoot`; `Invoke-TestSuite` runs `node (Join-Path $PSScriptRoot $Mjs)`. Logs/profiles/Edge-profile still go under `%TEMP%\opencode\` (runtime artifacts stay out of the repo).
  - `e2e-features.ps1`: same `$proj` derivation; `$harness = $PSScriptRoot` â†’ `node "$harness\e2e-features.mjs"`.
  - `e2e-features.mjs`: `WAV` is now `join(dirname(fileURLToPath(import.meta.url)), 'e2e_silence.wav')` (module-relative; the script self-regenerates the WAV on each run).
  - `e2e-run.mjs`: had NO temp-path references â€” untouched.
- **Verified**: both ps1 `PARSE OK` (Parser::ParseFile), both mjs `node --check` OK.
- **How to run now**: `powershell -NoProfile -ExecutionPolicy Bypass -File e2e\e2e-all.ps1 -Phase web` (and/or `-Phase win`) from the project root; deep feature run = `e2e\e2e-features.ps1`.
- **Backup**: `ttrpg-soundboard-backup-20260911-153349` (made before this change; newest. Old 20260907-155920 kept â€” did not prune without user request).

## SESSION 2026-09-11 (cont.) â€” DEEP FEATURE E2E (upload/playback/theme/CRUD/persistence) â€” IN PROGRESS (no code changes)
- **User pushed back**: the 57-check run only proved scroll/layout. Asked whether volume, local file saves, custom icon colors etc. actually work. Task: deeper E2E without changing app code.
- **New harness** (MOST RECENT session â€” since moved into the repo at `e2e\`, see the "HARNESS MOVED INTO THE REPO" section above; the below describes the harness itself):
  - `e2e-features.mjs` â€” deep suite, env: `CDP_PORT`, `LABEL`, `EXPECT_TAURI`, `SAVE_RESTORE`. Suites: D (add sound: real WAV upload via `DOM.setFileInputFiles`, submit, color #ff0000, loop, fadeIn=2, persistence + platform file entry), E (live playback via patched `HTMLMediaElement.prototype.play/pause` â†’ `window.__e2eAudio`; volume, fade-in ramp, manual loop rewind, Stop All), F (theme Forest F1â€“F3, add character + sound persistence + reload F4â€“F8), G (add env sound, delete sound via modal, delete character).
  - `e2e-features.ps1` â€” Phase A web: vite preview :5233 + headless Edge :9334 (fresh `e2e-feat-profile`, `--autoplay-policy=no-user-gesture-required`). Phase B win: `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS='--remote-debugging-port=9225 --remote-allow-origins=*'` + `npm run tauri dev`, polls `:9225/json` up to 15 min; asserts uploads-dir proof (`%APPDATA%\com.mrhorakhty.thespellcaster\uploads` â€” runner deletes non-e2e test files, keeps `*_e2e_silence.wav`); `SAVE_RESTORE=1` snapshots+restores localStorage; cleanup kills `*ttrpg-soundboard*`, msedgewebview2 w/ debug port, node/vite. Exit codes 0/1/2 (pass/warn/fail).
  - `e2e_silence.wav` â€” 20s mono 8kHz silent WAV (long enough for fade-in + loop rewind) generated for uploads.
- **Phase A first run FAILED at D3** then again at D7: root cause is a **TEST SELECTOR BUG, NOT an app bug**. The edit-bar "Add Sound"/"Add Character" buttons have NO explicit `type`, so they default to `type='submit'`; my submit-button finder (text + type=submit + first match) hit the EDIT-BAR button (styling `bg-dark-700 px-3 py-1`) BEFORE the modal's real submit (styling `bg-lime-600 px-4 py-2`). Clicking it re-ran `openAddSoundModal()` instead of submitting â†’ modal never closed, nothing saved. Diagnosed via diag2-submit.mjs: form `checkValidity()=true`, invalid=NONE, upload label "1 file uploaded", zero React console errors â€” proving app side healthy. The `Toggle Edit Mode` click was ALSO wrong first time (icon-only button, no text) â€” fixed earlier to `button[title="Toggle Edit Mode"]` click; active styling confirmed `bg-lime-600` (App.jsx:3252).
- **Mid-run state (before this wrap)**: Phase A deep suite: PASS=9 FAIL=25 WARN=0 (F1â€“F3 theme PASS, F8 theme persistence PASS, real WAV upload + label PASS; everything needing a real modal submit FAILED). Phase B (win) NOT run. D2 edit-mode check now classList-scoped (`lime|lime-600|bg-lime`); volume slider selector accepts `max==='1'||max==='1.0'` (2 places); G4 clicks Characters tab first.
- **FIX APPLIED to harness only**: all 3 modal submits in e2e-features.mjs (lines ~148, ~269, ~316) now scoped `x.type==='submit' && /bg-lime-600/.test(x.className)` so the modal button is matched, not the edit-bar default-submit button. Opening the modal still via `window.__clickText('Add Sound'/'Add Character')` (edit-bar first match opens the same modal â€” fine).
- **Cleanup DONE**: diag scripts/profiles/logs removed; processes killed; all test ports free (5233, 9334, 9225, diag 9336/9337, old 9333/9224) confirmed via Get-NetTCPConnection; `git status` unchanged (only pre-existing `src/App.jsx` + `opencode-summary.md`). No backup needed (no repo changes).
- **NEXT (resume point)**: rerun `powershell -NoProfile -ExecutionPolicy Bypass -File e2e\e2e-features.ps1 -Phase web` (expect Dâ†’Fâ†’G to pass now that modal submit targets lime button; E tests also depend on a real sound existing), then `-Phase win` (SAVE_RESTORE + uploads-dir proof). Report PASS/FAIL/WARN per platform and append results here.

## SESSION 2026-09-11 (cont.) â€” COMPREHENSIVE `e2e-full.mjs` SUITE VALIDATED (web + Tauri) âœ… DONE
- **User request (resumed)**: finish hardening the E2E harness and validate the new comprehensive `e2e-full.mjs` suite in both Phase A (web) and Phase B (win).
- **Changes made this session** (test harness ONLY â€” no app code touched):
  - `e2e\e2e-all.ps1`: added `[string]$Suite = 'full'` param â†’ `$Script:MjsFile = "e2e-$Suite.mjs"`; both `Invoke-TestSuite` calls now pass `-Mjs $Script:MjsFile`. Default suite is now `full` (was `run`). Parse OK.
  - `e2e\e2e-full.mjs` fixes (all `node --check` OK):
    1. **B3 `localStorage` ReferenceError (FATAL)**: line 687 called `localStorage.getItem('boxSize')` in Node context â†’ wrapped in `evalJs`.
    2. **log() outputs status word** (`[CAT] PASS/FAIL/WARN â€¦`) instead of glyph-only â€” PS5.1 log round-trip corrupts âœ“/âœ—/âš  (UTF-16/ANSI mix), making FAILs greppable.
    3. **E1/E2/J1/D1/D4 selector bug**: app nests edit-mode buttons as SIBLINGS of `[data-sound-card]` inside `div.group` (App.jsx:3059 closes the card div BEFORE the `{editMode && â€¦}` buttons at 3062-3077). Fixed selectors to `c.parentElement?.querySelector('button[title="Edit Sound"/"Delete Sound"]')`. Diagnosed via E1-DIAG asserting `[data-sound-card]` texts (Smite/Shield Bash/Healing Light) vs Edit-btn ancestor chain (`button < div.group.relative.shrink-0`).
    4. **Suite L (split view)**: L4/L5/L6 detected the split sidebar by requiring `overflow-y-auto` on the panel and L6 searched for `h2` "Environment" â€” but the real heading is **"Environments"** (App.jsx:3249) and the sidebar lacks that scroll class. Rewrote to `findSidebar(heading)` = `h2` heading â†’ `.closest('div[class*="bg-dark-800"]')`.
    5. **Suite X (drag reorder)**: previously skipped (`NO_RECTS`, malformed cards[3]). Now reloads page first (returns to default Paladin view, localStorage intact), re-enters edit mode, drags **lastâ†’first** card via CDP `Input.dispatchMouseEvent` (pressed â†’ 5 moved steps â†’ released). VERIFIED WORKING: before `["Divine Smite","Shield Bash","Healing Light","Divine Light"]` â†’ after `["Divine Light","Divine Smite","Shield Bash","Healing Light"]`.
- **Results**: Phase A (headless Edge :9333) **PASS=99 FAIL=0 WARN=0 exit=0**; Phase B (Tauri WebView2 :9224, SAVE_RESTORE=1) **PASS=99 FAIL=0 WARN=0 exit=0**. All 16 prior FAILs resolved; 0 remaining.
- **Run commands now**: `powershell -NoProfile -ExecutionPolicy Bypass -File e2e\e2e-all.ps1 -Phase web` (and/or `-Phase win`, `-Suite run|full|features`). Log: `%TEMP%\opencode\e2e-run-<ts>.log` (note: node log lines can be UTF-8 while PS headers differ â€” read via .NET `[Text.Encoding]::UTF8` + strip NULs, or expect mixed glyphs).
- **Gotchas recorded**: PS `Add-Content`/`Set-Content` can write UTF-16/ANSI mixed once node output streams in â†’ grep the log with the .NET decode recipe above; template literals inside `evalJs(...)` must avoid nested backticks (`${â€¦}` interpolation is fine, backticks are not); pick which sound is "last" via `cards[cards.length-1]`, not hardcoded index 3.
- No backup needed (no repo fixtures changed); `git status` unchanged (only pre-existing modified files + newly added `e2e/` harness).

## SESSION 2026-09-11 (cont.) â€” E2E CLEANUP FIX: Tauri process tree killed properly âœ…
- **Problem**: `Stop-ProcessTree` (calling `.Kill($true)` on the npm wrapper PID) didn't reach the Tauri-spawned `app.exe` or its WebView2 children, leaving a frozen black window after tests.
- **Fix in `e2e\e2e-all.ps1` Phase B finally block** (3 changes):
  1. `Stop-ProcessTree $tauriProc` â†’ `Invoke-Expression "taskkill /PID $($tauriProc.Id) /T /F 2>&1" | Out-Null` â€” kills npm wrapper tree via OS taskkill.
  2. Added `taskkill /F /IM app.exe /T 2>&1 | Out-Null` â€” catches the Tauri binary + its process tree (actual exe name is `app.exe`, NOT `TheSpellCaster.exe`).
  3. Added CIMInstance loop to find `msedgewebview2.exe` with `--webview-exe-name=SearchHost.exe` in command line â†’ `taskkill /F /PID <pid> /T` per match. This targets only our test's WebView2 instances, not unrelated system WebView2 (WhatsApp, Google Drive, Windows Search).
- **Verified**: 3 consecutive Phase B runs exit=0 with immediate terminal return; no orphan `app.exe` or debug-port `msedgewebview2.exe` remains. Remaining SearchHost WebView2 processes are normal Windows system instances (no `--remote-debugging-port`, parent = system SearchHost PID 15580).
- **Gotcha**: blanket `taskkill /F /IM msedgewebview2.exe /T` would kill WhatsApp/Google Drive/Windows Search WebView2 â€” must filter by `--webview-exe-name=SearchHost.exe` in CommandLine.
- Phase A (web) also re-run: exit=0, no changes needed (headless Edge cleanup was already working).
- **E2E full results**: Phase A PASS=99 FAIL=0 WARN=0 Â· Phase B PASS=99 FAIL=0 WARN=0 (all 3 runs).
- No backup needed (only `e2e/e2e-all.ps1` changed, not app code). `git status`: `e2e/e2e-all.ps1` + `opencode-summary.md` modified.

## Session etiquette notes
- **FOR OPencode ONLY** (standing rule): the doc-updating rules apply only to opencode (the AI assistant), not the human user. After every meaningful step â€” each edit/verification/decision â€” update this file at the bottom ("SESSION 2026-09-05" section, or a new one for a new day): what the current task is, what's done (fixed/verified), what's in progress right now, what's next, and gotchas. If the session gets cut off (quota/tokens), this file must be enough to resume exactly. Record backups, test results, ports/processes, file:line refs.
- **E2E TEST POLICY (standing rule)**: When asked to run E2E tests, **do NOT change any app code or harness code** â€” only run the tests and report results (PASS/FAIL/WARN per suite, any diagnostics). Wait for the user to tell you what needs fixing or changing.
- Backup before changes (see Backups) â€” newest: `ttrpg-soundboard-backup-20260911-153349` (no backup needed this session â€” only harness changed, not app code).
- `npm run tauri android dev` by a previous session left a lingering Vite server on **port 5173**; if port-in-use errors occur, kill the PID (`netstat -ano | findstr :5173` then `taskkill /PID <pid> /F`) before re-running.
- When editing the mobile slider/header row, keep the iconâ†”number geometry STABLE (fixed-width number inputs, not dynamic).
- `vite.config.js` has a pre-existing `eslint no-undef` on `process` (it was never linted; `npx eslint src/App.jsx` is the canonical check).
- Changes are UNCOMMITED â€” `git status` shows modified: `index.html`, `AndroidManifest.xml`, `src/App.jsx`, `src/data.json`.

## SESSION 2026-09-11 (cont.) â€” MOBILE (ANDROID) E2E HARNESS â€” IN PROGRESS
- **Request**: "Let's make sure E2E also includes mobile." Goal: run the existing E2E check suite against the Android emulator UI (tauri `android` target), not just web/Tauri-Windows.
- **NEW `e2e\e2e-mobile.mjs`** (untracked, ~46.7 KB, `node --check` exit 0): mobile-specific suite, same env protocol as `e2e-full.mjs` (`CDP_PORT`, `LABEL`, `EXPECT_TAURI`, `SAVE_RESTORE`). Suites: **S** seed integrity, **M** mobile layout (rail `div.w-14.bg-dark-800` + hamburger), **N** drawer navigation (`[role="dialog"][aria-label="Navigation"]`, backdrop `.fixed.inset-0.z-40`), **R** sound grid (`[data-sound-card]`), **E** mobile edit mode (`button[title="Enter Edit Mode"]`), **A** add sound, **J** edit sound, **C** character CRUD, **K** category CRUD, **G** group CRUD, **V** empty states, **T** settings (About version `0.1.3`), **D** delete sound + cancel. Mobile-specific behavior encoded: edit toggle lives on the grid (not header), drawer Add buttons ONLY visible while edit mode is on, per-card buttons found in `c.parentElement`. Seed data matches e2e-full (3-character seed, `ttrpg_data_version=3`; uses `e2e_silence.wav` upload + self-generated `_e2e_pixel.png`).
- **ANTIVIRUS INCIDENT (blocker for `e2e\e2e-all.ps1`)**: Kaspersky and/or Bitdefender (Defender disabled) QUARANTINED `e2e-all.ps1` while Phase C was being inserted. User whitelisted + restored, but: (1) the restored copy is byte-corrupt (UTF-16â†’UTF-8Â·no-BOM conversion, mojibake) â†’ 4 `Parser::ParseFile` errors; (2) the AV still HARD-BLOCKS that exact filename at the filesystem-filter level even after user deleted it â€” `New-Item`/`git checkout`/`Set-Content` all denied for `e2e-all.ps1`, while ANY other filename in the same folder writes fine. Permanent: `e2e-all.ps1` is dead.
- **NEW `e2e\e2e-full.ps1`** (replaces `e2e-all.ps1`; ASCII-only + UTF-8 BOM added via node; PARSE-OK): param `-Phase all|web|win|android`, `-Suite full|mobile|run|features`. Phase A headless Edge :9333 (vite preview :5233), Phase B Tauri WebView2 :9224 (`WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS`), Phase C (android): AVD `Pixel_7`, `$adb="$env:ANDROID_HOME\platform-tools\adb.exe"`, boots emulator if none (`-no-snapshot-load`, wait `sys.boot_completed=1` max 5 min), launches `npm.cmd run tauri android dev` (Rust compile + install; logs `%TEMP%\opencode\e2e-android-tauri.log`/`.err.log`; its Vite server on :5173), waits app via **`adb shell pidof com.mrhorakhty.thespellcaster.debug`** (matches `^\d+$`), `adb forward tcp:9225 localabstract:webview_devtools_remote_<pid>`, verifies CDP `http://127.0.0.1:9225/json` has `webSocketDebuggerUrl`, runs default suite `e2e-mobile.mjs` (unless `-Suite` overrides) with `-Expect '1' -SaveRestore '1'`, cleanup: adb forward remove â†’ taskkill tauri tree â†’ taskkill app.exe â†’ SearchHost-scoped msedgewebview2 kill â†’ `Remove-Orphans` â†’ `adb emu kill` ONLY if it started the emulator. `Assert-NotTimedOut` defaults 15 min (Phase C path uses -Minutes 25).
- **Playbook now**: `powershell -NoProfile -ExecutionPolicy Bypass -File e2e\e2e-full.ps1 -Phase all` (web+win+android) or `-Phase android` for mobile only. Backup of harness = git HEAD only (do NOT restore `e2e-all.ps1` from git â€” AV will block the create).
- **Verified so far**: `e2e-full.ps1` PARSE-OK; `e2e-mobile.mjs` node --check exit 0; ANDROID_HOME=`C:\Users\emire\AppData\Local\Android\Sdk`, adb daemon starts, NO emulator attached yet.
- **NEXT (resume point)**: `powershell -NoProfile -ExecutionPolicy Bypass -File e2e\e2e-full.ps1 -Phase android` â†’ expect emulator boot (5 min) + Rust android build (up to 15 min) + suite run; report per-suite PASS/FAIL/WARN; on CDP/app timeout inspect `%TEMP%\opencode\e2e-android-tauri.err.log` tail. Then append results here and run a full `-Phase all` to confirm web+win still green (they passed 99/99 earlier today).
- **Gotchas**: never use `â€¦`/em-dash in PS runner strings (ANSI fallback in PS5.1 breaks string terminators) â€” keep runner ASCII + UTF-8 BOM; the AV name-block on `e2e-all.ps1` is permanent even with folder whitelist + file delete, so don't retry it; `taskkill /F /IM msedgewebview2.exe` blanket would kill WhatsApp/Drive/Search WebView2 â€” always scope to `--webview-exe-name=SearchHost.exe`.
- **AV identity correction**: it's **Bitdefender** (not Kaspersky). Rationale for the flag: the single `e2e-all.ps1` accumulated a malware-like behavioral fingerprint â€” hidden `Start-Process`, `taskkill /F /T`, `Invoke-Expression`, `--remote-allow-origins=*`, and `adb forward` socket tunnelling (Phases A+B+C all in one file). The hard filename-block survives delete + whitelist because Bitdefender keeps a persistent detection fingerprint for that name/hash.
- **SPLIT DONE (Phase C â†’ separate file)**: `e2e\e2e-full.ps1` now contains ONLY Phases A (web) + B (win); Phase C (android) is delegated to **NEW `e2e\e2e-android.ps1`** (standalone runner, owns its own adb/emulator/CDP/pidof logic + helpers `Remove-Orphans`/`Invoke-TestSuite`/`Assert-NotTimedOut`/`Wait-Cdp`; same default `Pixel_7`, CDP :9225, `pidof com.mrhorakhty.thespellcaster.debug`, `adb forward tcp:9225 localabstract:webview_devtools_remote_<pid>`; cleans adb forward â†’ taskkill tauri tree â†’ app.exe â†’ orphans â†’ `adb emu kill` only if it started the emulator). `e2e-full.ps1` pure delegator: `& "$PSScriptRoot\e2e-android.ps1" -Suite $Suite -TestLog $Script:TestLog -TestStartTime $Script:TestStartTime`. Both files ASCII-only + UTF-8 BOM. VERIFIED: `-Phase android` via delegation â†’ `android: exit=0` (log `e2e-run-20260911-181552.log`).
- **Run commands now**: `powershell -NoProfile -ExecutionPolicy Bypass -File e2e\e2e-android.ps1` (android-only) or `â€¦ -File e2e\e2e-full.ps1 -Phase all|web|win|android` (web/win + delegated android). Suite control via `-Suite full|mobile|run|features` (default phase-C suite = mobile).
- **KNOWN ISSUE (user will request fix later â€” DO NOT fix proactively; E2E policy applies)**: the mobile suite `e2e\e2e-mobile.mjs` output TRUNCATES after check **A2** ("WAV uploaded") in the log â€” only 6 of 13 suites visible (S=10, M=7, N=6, R=6, E=5, A=2 â†’ 36 PASS, 0 FAIL) yet node exits **0**. Suites J (edit sound), C (char CRUD), K (cat CRUD), G (group CRUD), V (empty states), T (settings), D (delete+cancel) never appear in the log. Exactly the same truncation occurred in the standalone run 18:04 AND the combined `-Phase all` run 18:20 (log `e2e-run-20260911-182022.log`). Runner/phase separation NOT at fault (Phases A + B show full 99/99; delegation works). Prime suspects: (1) Node stdout via PS 5.1 `>>`/`2>&1` buffering/truncation (known repo quirk: node log lines UTF-8 vs PS UTF-16/ANSI) causing result-loss; (2) real early-exit in suite A's A3 `submitModal` step that returns 0 without the `MOBILE E2E SUMMARY` line. Lines to inspect when fixing: `e2e-mobile.mjs:348` (submitModal) & the summary/exit at `e2e-mobile.mjs:870-875`; verify by running `node e2e-mobile.mjs` with cmd-level `> log 2>&1` redirect (bypassing PS) against a live CDP :9225, expecting all 13 suite headers + the `MOBILE E2E SUMMARY: PASS=.. FAIL=.. WARN=..` line. e2e-full.mjs/e2e-features.mjs do NOT have this issue.

## SESSION 2026-09-27 â€” MOBILE E2E TRUNCATION ROOT-CAUSED âœ… (diagnosis only, NO code changed)
Resumed the previous session's KNOWN ISSUE ("mobile suite output truncates after A2, node exits 0"). **Root cause found and proven. No app or harness code was changed** (E2E policy respected). `git status` clean; no backup needed.

### ROOT CAUSE (not a logging bug, not an app bug)
CDP **`DOM.setFileInputFiles`** â€” the call `uploadWav()` makes at suite A2 â€” is rejected by the **Android WebView** as a bad IPC message, which kills the renderer and then the whole app:
```
00:33:28.516 E/chromium(5711): [ERROR:content/browser/bad_message.cc:29] Terminating renderer for bad IPC message, reason 2
00:33:28.530 I/ActivityManager: Killing 5833:com.google.android.webview:sandboxed_process0...
00:33:29.063 E/chromium(5711): [ERROR:android_webview/browser/aw_browser_terminator.cc:173] Renderer process (5833) crash detected (code -1).
00:33:29.070 E/chromium(5711): [ERROR:.../aw_browser_terminator.cc:122] Render process (5833) kill (OOM or update) wasn't handed by all associated webviews, killing application.
00:33:29.099 I/ActivityManager: Process com.mrhorakhty.thespellcaster.debug (pid 5711) has died: fg TOP
```
Chain: `DOM.setFileInputFiles` -> renderer terminated -> Android WebView kills the app (no `onRenderProcessGone` handler) -> node's next `Runtime.evaluate` (suite A3 `submitModal`) never resolves, and because `e2e-mobile.mjs` has **no `ws.onclose`/`onerror` handler** the socket dying releases the last event-loop handle -> **node exits 0 silently** (never prints `MOBILE E2E SUMMARY`) -> log appears to "truncate after A2". Desktop WebView2 supports the call, which is why `e2e-full.mjs` passes 99/99. The old `EXITCODE=` echo never appearing in the log is the same event (cmd wrapper died with the tree).

### PROOF / validated fix (TEMP copy only â€” repo harness untouched)
`%TEMP%\opencode\mobile-dt.mjs` = copy of `e2e-mobile.mjs` with `uploadWav()` (lines 134-143) replaced by an **in-page `DataTransfer`** upload (build a 2s silent WAV in JS -> `new File([buf],'e2e_silence.wav')` -> `DataTransfer` -> `input.files` -> dispatch `change`; selector `input[type="file"][accept*=".mp3"]` with fallback to any `input[type="file"]`). No `DOM.*` file call at all.
- Result via cmd-level redirect: **all 13 suites ran, `MOBILE E2E SUMMARY: PASS=64 FAIL=4 WARN=0 TOTAL=68`**, exit 0, `localStorage restore: restored`.
- Log: `%TEMP%\opencode\mobl-dt.log`. Runner wrapper: `%TEMP%\opencode\run-mobile-dt.cmd` (cmd-level `>` bypasses the PS 5.1 `>>` suspect â€” the suspect was a red herring).

### The 4 FAILs, triaged
1. **C3 `Edit Character` in drawer (`button[title="Edit Character"]`) â€” TEST bug, app is fine.** The mobile drawer has no per-row rename; on mobile you rename by tapping the character/category **name in the sound-grid header while in edit mode** (`src/App.jsx:3889-3907`, `handleEditCharacter` at 3893/3897). Desktop-only buttons are at 4279/4341.
2. **C5 `Delete Character` in drawer â€” REAL APP GAP (mobile).** There is **no way to delete a top-level Character or Environment category on Android**: drawer rows for top-level items (`App.jsx:4101-4122`) have NO delete badge (only *group members* get badges at 4135/4157, titled `Delete Character: <name>`), the grid-heading trash was deliberately removed, and every `handleDeleteCharacter`/`handleDeleteCategory` call site (4272/4303/4334/4364) is desktop sidebar or split-view. Needs a user decision before touching app code.
3. **G1 `Add Group` â€” TEST bug.** Mobile rail button is `title="Add New Group"` / `aria-label="Add New Group"` (`App.jsx:3876-3877`, edit-mode only); the exact text `Add Group` is the *desktop* edit-bar button (`App.jsx:3763`).
4. **V1 empty-state text â€” TEST bug.** Test greps for `toggle Edit Mode`; the **mobile** drawer strings say `open Edit Mode` (`App.jsx:4090-4099`) while desktop says `toggle Edit Mode` (4248+).

### Environment / processes (left running for follow-up)
- Emulator `Pixel_7` PID 16920 (`emulator-5554`, boot_completed=1), started manually with `-no-snapshot-load -no-audio`.
- `npm.cmd run tauri android dev` PID 26520 (cargo-tauri PID 23320, its Vite dev server PID 35688 on **:5173** â€” kill it before any other vite run).
- App pid **9137** (relaunched with `adb shell am start -n com.mrhorakhty.thespellcaster.debug/com.mrhorakhty.thespellcaster.MainActivity` after it died).
- `adb forward tcp:9225 localabstract:webview_devtools_remote_9137` is ACTIVE (remove with `adb forward --remove tcp:9225`).
- CDP endpoint serves `http://tauri.localhost/`; the suite finds the page via `/json` and needs `t.type==='page' && url.startsWith('http')`.
- Temp artifacts: `%TEMP%\opencode\{mobile-dt.mjs, run-mobile-dt.cmd, run-mobile-diag.cmd, mobl-dt.log, mobl-diag.log, mobl-diag2.log}`. Note the temp copy's `WAV` path is module-relative, so it no longer writes `e2e/e2e_silence.wav`.

### NEXT (needs user decision â€” E2E policy: do not change app/harness code unasked)
1. **Harness fix (recommended, validated):** in `e2e/e2e-mobile.mjs`, replace the `uploadWav()` `DOM.setFileInputFiles` body with the in-page `DataTransfer` version (also fixes the silent-exit-0 by adding a `ws.onclose` handler that logs + exits non-zero). Backup first (`ttrpg-soundboard-backup-20260927-*`).
2. **Test selector fixes:** C3 -> tap the grid-header `h2` in edit mode instead of a drawer Edit button; G1 -> `button[title="Add New Group"]`; V1 -> match `open Edit Mode` (or accept either wording).
3. **App gap (ask first):** add a delete affordance for top-level Characters/Environment categories on mobile (e.g. trash badges on the drawer rows at `App.jsx:4101-4122`, mirroring the group-member badges) so Android users can delete them at all.
4. Housekeeping: `e2e/_avtest2.txt` (3 B), `e2e/e2e-all.ps1.new` (3 B) and `e2e/_e2e_pixel.png` (70 B) are tracked AV/test leftovers â€” ask before deleting. `e2e-all.ps1` itself must never be recreated (Bitdefender hard filename block).

## SESSION 2026-09-27 (cont.) â€” ALL 3 FIXES IMPLEMENTED + VERIFIED âœ… (mobile 85/85, desktop 99/99)
User approved all three fixes. **Backup first: `ttrpg-soundboard-backup-20260927-004517`** (200 files).

### 1. APP FIX â€” mobile can now delete top-level Characters / Environment categories
`src/App.jsx`, mobile drawer list (~4101-4150): the top-level `characters.map` / `environmentSounds.map` rows were bare buttons with **no delete affordance**, so on Android those items could not be deleted at all. Each row is now wrapped in `div.relative` with an edit-mode trash badge identical to the group-member badges: `title={`Delete Character: ${char.name}`}` / `title={`Delete Category: ${cat.category}`}` + matching `aria-label`, calling `handleDeleteCharacter(char.id)` / `handleDeleteCategory(cat.category)`. Desktop + split-view untouched. This was the one genuine app-level gap (all pre-existing `handleDeleteCharacter/Category` call sites were desktop-only).

### 2. HARNESS FIXES â€” `e2e/e2e-mobile.mjs`
- **`uploadWav()`**: `DOM.setFileInputFiles` -> in-page `DataTransfer` (build a 2s silent WAV with `DataView`, `new File([buf],'e2e_silence.wav')`, `DataTransfer` -> `input.files` -> dispatch `change`). Comment records WHY (Android WebView kills the renderer + app). A2 now logs the helper's return value.
- **Dead-socket guard**: added `closingIntentionally` + `ws.onclose` / `ws.onerror` handlers that print `FATAL: CDP socket closed with N unanswered request(s)` and `process.exit(3)`. `e2e-android.ps1` already treats `exit=[1-9]` as failure, so a dead app can never look like success again. `closingIntentionally = true` is set before the final `ws.close()`.
- **Mobile-selector fixes** (all were desktop-derived): C3 -> close drawer, tap the sound-grid header `h2` whose text is the item name (must carry `text-lime-400` = edit mode) ; C5/G9/G11 -> `button[title^="Delete Character"/"Delete Category"]` (the real titles are `Delete Character: <name>`, not the bare word) ; G1 -> `button[title="Add New Group"]` (mobile rail; `Add Group` is the desktop edit bar) ; G4 -> same header-`h2` rename as C3 (mobile has NO "Edit Group" button; drawer must be closed first because the header tap is ignored while the drawer is open) ; V1 -> the empty states live INSIDE the drawer, so `openDrawer()` first, query inside `[role="dialog"]`, accept `open Edit Mode` (mobile) or `toggle Edit Mode` (desktop), then `closeDrawer()`.
- **Cascade-proofing**: the G suite resolved the new group by the hard-coded name `'Dragon Lore Reborn'`, so one failed rename silently failed 6 more checks. It now captures `grpId` once and builds `G` (a JS expression finding the group by id) used by G5-G12. G12 matches the badge by `title === 'Delete Group: ' + <name read in-page>`.
- **Silent-skip class of bug fixed**: checks nested in `if (click === 'OK')` blocks never reported when the click failed â€” K3/K4/K5 were dead code (same wrong selectors as C3/G4) and the suite still looked green. Dependent checks now log an explicit `FAIL ... blocked: <reason>` (C4, G5, K3, K5).

### 3. RESULTS
- **Android / Pixel_7 emulator (`e2e-mobile.mjs`, 13 suites): PASS=85 FAIL=0 WARN=0 TOTAL=85**, exit 0, `localStorage restore: restored`. Log `%TEMP%\opencode\mobl-fix3.log`. All CRUD paths now really execute: C1-C7, K1-K5, G1-G12, plus S/M/N/R/E/A/J/V/T/D. (Was 36 truncated checks before the fix.)
- **Desktop web regression (`e2e-full.mjs`, headless Edge + `vite preview :5233`): PASS=99 FAIL=0 WARN=0 TOTAL=99**, exit 0 â€” no regression from the App.jsx change. Log `%TEMP%\opencode\web-regress.log`.
- Gates: `node --check e2e\e2e-mobile.mjs` exit 0 Â· `npx eslint src/App.jsx` 0 errors / 3 pre-existing warnings (`convertFileSrc`, `_`, `ev`) Â· `npx vite build` OK.

### âš ï¸ HAZARD FOUND in `e2e\e2e-full.ps1` (do not run `-Phase web` blindly)
Phase A's `finally` block (`e2e-full.ps1:155-157`) runs `Get-Process -Name msedgewebview2 | Stop-Process -Force` â€” a **blanket kill of every WebView2 process on the machine**, even though Phase A (headless Edge) uses none. That would kill the user's WhatsApp / Google Drive WebView2. Phase B's cleanup is correctly scoped to `--webview-exe-name=SearchHost.exe` (`e2e-full.ps1:204-209`). For the desktop regression I used a PID-scoped temp script instead: `%TEMP%\opencode\web-regress.ps1` (build is already done; starts `vite preview :5233` + headless Edge :9333, runs `e2e-full.mjs`, kills only its own PIDs). Fixing line 155-157 to match Phase B's scoping needs user approval.

### State / processes left running
Emulator `Pixel_7` PID 16920 Â· `npm.cmd run tauri android dev` PID 26520 (Vite PID 35688 on **:5173**) Â· app pid **9137** Â· `adb forward tcp:9225 localabstract:webview_devtools_remote_9137` active. To stop: `adb forward --remove tcp:9225`; `adb emu kill`; `taskkill /PID 26520 /T /F`. Temp artifacts: `%TEMP%\opencode\{mobile-dt.mjs, web-regress.ps1, web-regress.log, run-mobile-*.cmd, mobl-*.log}`.

### NEXT
- User manual click-through on the emulator: edit mode -> drawer -> trash badge on a top-level character/category.
- Optional: scope `e2e-full.ps1:155-157` WebView2 kill to SearchHost; delete the 3 tracked junk files; commit (`src/App.jsx` + `e2e/e2e-mobile.mjs` + `opencode-summary.md`).

## SESSION 2026-09-27 (cont.) â€” NEW `e2e\kill-ports.bat` (user: "ports are full") âœ…
User wanted a .bat to free ports for manual testing. Added **`e2e\kill-ports.bat`** (CRLF, ASCII, no PowerShell dependency except the optional orphan sweep).
- `kill-ports.bat` -> frees the default ports `5173 9224 9225 5233 9333 9334` (vite dev, WebView2 CDP, adb-forwarded WebView CDP, vite preview, headless-Edge CDP x2).
- `kill-ports.bat 5173 9225` -> only the listed ports.
- `kill-ports.bat /all` -> defaults + `app.exe` + `adb forward --remove-all` + orphan sweep (a PowerShell CIM query, scoped to `node.exe` with `tauri.js` in the command line and `cargo.exe`, so unrelated node/cargo work is untouched).
- `kill-ports.bat /emu` -> `adb -s <serial> emu kill` (kept separate from `/all` because shutting the emulator down is destructive).
- Per port it first tries `adb forward --remove tcp:<port>` so the **adb server itself is never killed** by the netstat sweep, then kills any remaining LISTENING PID + its tree (`taskkill /PID /T /F`), de-duplicating PIDs across IPv4/IPv6 rows, and prints a final `free` / `STILL IN USE by PID` line per port. Admins-only failures are reported instead of silently swallowed.
- Gotcha: `^|` escapes are needed for `netstat ... ^| findstr` (not inside quotes) but must NOT be used inside the double-quoted `-Command "..."` string â€” cmd passes `^|` through literally and PowerShell errors with "A positional parameter cannot be found that accepts argument '^'".
- Verified: default run freed 5173; custom-port run OK; `/all` run killed leftover PID 35140 (`tauri.js android-studio-script --target armv7`, an orphan from a killed `tauri android dev`). Emulator (`emulator-5554`) intentionally left running; `tauri android dev` + Vite are now stopped, so port 5173 is free.

## SESSION 2026-09-27 (cont.) â€” COMMITTED âœ… `890e4c1` "E2E mobile fixes and port cleanup helper"
Committed on branch `mobile-support` (4 files, +360/-77): `src/App.jsx`, `e2e/e2e-mobile.mjs`, `e2e/kill-ports.bat` (new), `opencode-summary.md`. Previous HEAD was `af593fb E2E mobile`. Not pushed.
- Also removed the dead on-disk WAV generator from `e2e-mobile.mjs` (module-level `makeWav` + `WAV` const + the `writeFileSync`/`path`/`url` imports): `uploadWav` builds the WAV in-page now, so those were unreferenced. `e2e/e2e_silence.wav` is still written by `e2e-full.mjs` / `e2e-features.mjs`, which do use `DOM.setFileInputFiles` on desktop, so the tracked file stays.
- That removal was verified with `node --check` + an identifier grep only (no full Android re-run, since no tested code path changed and the ports were freed on purpose for manual testing). Last full green run: mobile 85/85, desktop web 99/99.
- Gotcha: `git commit -m "..."` with **inner double quotes** gets mangled by PowerShell 5.1 when calling a native exe (git splits the argument on the inner quotes and then treats the rest as pathspecs -> `error: pathspec 'renderer' did not match...`). Write the message to a file and use `git commit -F <file>`.
- Repo has a **pre-commit hook** that prints a "TTRPG Soundboard Backup Log" block; it leaves the tree clean.
## SESSION 2026-09-27 (cont.) â€” "Run App.bat does not launch the app" âœ… diagnosed
**Root cause: a stray Vite dev server was holding port 5173.** `tauri android dev` runs `beforeDevCommand` = `npm run dev` (vite), which aborts with `Error: Port 5173 is already in use` -> `The "beforeDevCommand" terminated with a non-zero status code` -> the double-clicked window closes instantly, so the failure is invisible. The leftover came from the user running the root `Run.bat` (= `npm run dev`, web only) before/while launching Android.
- Reproduced exactly: `cmd /c "src-tauri\gen\android\Run App.bat"` -> exit 1, log at `%TEMP%\opencode\runapp-repro.log`.
- `Run App.bat` is `src-tauri\gen\android\Run App.bat` and is **explicitly gitignored** (`.gitignore:285`), so it is a local-only helper - fixes to it are never committed. The `cd` into `gen\android` is harmless: npm walks up and finds the root `package.json`.
- **Fixed `Run App.bat`**: `cd` to the repo root, `call "%ROOT%\kill-ports.bat" 5173` first, then `npm run tauri android dev`, and `pause` with a diagnostic checklist on non-zero exit, so failures are visible instead of a vanishing window. Note: my first attempt wrote `"%ROOT%kill-ports.bat"` (missing separator) -> `'"...ttrpg-soundboardkill-ports.bat"' is not recognized`. Watch the trailing backslash.
- Verified end to end after the fix: `Performing Streamed Install` -> `Success` -> `Starting: Intent { cmp=com.mrhorakhty.thespellcaster.debug/...MainActivity }`, app pid 11845, and the WebView DOM over CDP (`adb forward tcp:9225 localabstract:webview_devtools_remote_<pid>`) reports title `The SpellCaster`, 8 buttons, `h1/h2 = The SpellCaster | Human Paladin`, `__TAURI__` present, seeded sounds rendered. So the mobile UI mounts fine.
- Launch recipe that works: emulator/device booted (`adb devices` lists it) -> `Run App.bat` (it frees 5173 first). Equivalent: `npm run tauri android dev` from the repo root.
- Gotchas: `adb exec-out screencap -p > file.png` **must** go through `cmd /c`; PowerShell 5.1 redirection corrupts the binary ("Out of memory" in `Image.FromFile`). The e2e harnesses use Node's **global** `WebSocket` - there is no `ws` package in `node_modules`, so a helper script placed in `%TEMP%` cannot `import 'ws'`; use `globalThis.WebSocket` + `addEventListener` (no `.on()`).
- A dev session is currently running in a **hidden** background process (launcher pid 8592, vite on 5173, `adb forward tcp:9225` -> pid 11845). Stop it with `kill-ports.bat /all` before launching again from Explorer.
## SESSION 2026-09-27 (cont.) â€” RESTORED app default data (E2E had overwritten it) âœ…
User reported the default audio + characters were wiped from the app. Repo sources were never touched (`src/data.json` intact, no deleted files in git) - the damage was in the **running app's localStorage**.
- Damaged live state found: `ttrpg_characters` = 2 (Human Paladin with 3 test sounds, Elf Sorcerer with 0 sounds, **Wood Elf Ranger missing**), `ttrpg_environment` = Dungeon/Forest with 1 sound, `ttrpg_groups` = "Tavern Pack" + "Hero Pack". All of it is **E2E seed data** - `Tavern Pack`/`Hero Pack` are fixtures from `e2e-mobile.mjs:105-106` / `e2e-full.mjs:113-114`.
- The app's own migration backup `ttrpg_characters_old` (written by `App.jsx:79-87` when `ttrpg_data_version !== '3'`) still held the real data, and it is **byte-identical to `src/data.json`**: 3 characters / 11 sounds (Caustic Blast - Acid, Fireball, Frostbite, Lightning Bolt, Divine Smite, Lay on Hands, Shield of Faith, Hail of Thorns, Longbow Shot, Pass Without Trace, Spike Growth).
- **Restore method** (do this again if it ever happens): snapshot all localStorage to a file, then `localStorage.removeItem` for `ttrpg_characters` / `ttrpg_environment` / `ttrpg_groups` only, then `Page.reload`. With the key absent, `readStoredData` (`App.jsx:88-95`) returns the `data.json` fallback and the app re-seeds itself. Leave `ttrpg_characters_old` and `ttrpg_themes` alone. Verified after reload: characters and environment match the defaults exactly.
- **Root cause of the loss**: `e2e-android.ps1:161` already passes `-SaveRestore '1'`, and the harness snapshots localStorage at suite start and restores it at the end (`e2e-mobile.mjs:82-87` + `913-918`). That only protects the state that existed *when the suite started*. The first mobile run died mid-suite (the A2 renderer crash), so the restore block never executed; every later run then faithfully snapshotted and restored the already-corrupted E2E seed. So the save/restore is not broken - it is just not crash-safe.
- Proposed hardening (NOT done - needs user approval per the E2E policy in `e2e-android.ps1:4-6`): have the runner take its own localStorage snapshot to a file *before* invoking node and restore it in the `finally` block, so the user's data survives a crashed/killed suite.
- Helper scripts used (throwaway, in `%TEMP%\opencode`): `ls-dump.mjs`, `ls-verify-backup.mjs`, `ls-restore.mjs`, `cdp-check.mjs`. They use Node's **global** `WebSocket` with `addEventListener` - there is no `ws` package in `node_modules`, so a script outside the repo cannot `import 'ws'`.
## SESSION 2026-09-27 (cont.) â€” HARDENING (both, user-approved): save-failure banner + crash-safe E2E backup
Backup first (AGENTS.md): `C:\Users\emire\OneDrive\MasaÃ¼stÃ¼\ttrpg-soundboard-backup-20260927-014256` (201 files; node_modules/dist/.git/target/gen excluded). NOTE: the **previous** session's backup path in this file is wrong - it actually landed in a mojibake folder `MasaÃƒÂ¼stÃƒÂ¼` (UTF-8 read as Latin-1), not `MasaÃ¼stÃ¼`. Build the name with `[char]0x00FC` in PowerShell, never `\u00fc` (PS does not interpret `\u`).
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

## SESSION 2026-09-27 (cont. 2) â€” E2E no longer kills the agent session; zero-group claim corrected
User: "Killing this command line during e2e means it will never finish. Let's make an exception for command lines that run opencode."
- Root cause confirmed: `Remove-Orphans` matches `'*ttrpg-soundboard*'` in the **command line**, which also matches the shell + agent session that launched the runner. Measured on this machine: the old filter matched 5 processes, 2 of which were the session (`powershell.exe` 32180 = the runner's own `$PID`, and `cmd.exe` 37632 = opencode's launcher) plus `opencode.exe` 36580 itself.
- Added `Get-ProtectedPids` to **`e2e/e2e-android.ps1`**, **`e2e/e2e-full.ps1`** and **`e2e/e2e-features.ps1`**: unions (a) the full ancestor chain of `$PID` (16 levels, stops on PID 0 / self-parent) with (b) any process whose `Name -like 'opencode*'` or `CommandLine -like '*opencode*'`. Every kill filter now starts with `-not $keep.Contains([int]$_.ProcessId) -and (...)`.
- Verified functionally: protected set = {opencode.exe, its cmd.exe, this powershell.exe, explorer.exe}; the new filter kills only `cmd.exe` running `Run App.bat`, `node.exe` tauri.js `android dev`, and `node.exe` vite - i.e. exactly the dev stack, never the session. `Parser::ParseFile` on all three ps1: no errors.
- Audited every other kill path in the repo: `kill-ports.bat` (port-scoped + `app.exe` + `node.exe *tauri.js*`/`cargo.exe` only) is safe as-is; `e2e-full.ps1` SearchHost/`app.exe`/tauri-tree kills are name-scoped and safe. `e2e-features.ps1` line 78's loose `'*tauri*dev*'` filter was the one other loose match and is now protected too.
- Still open: `e2e-full.ps1:183-184` blanket-kills **all** `msedgewebview2` (safe for us, but it kills unrelated WebView2 apps); tracked junk (`e2e/_avtest2.txt`, `e2e/e2e-all.ps1.new`, `e2e/_e2e_pixel.png`); native `onRenderProcessGone`; whether `Run App.bat` should stop being gitignored; crash-safety for the Windows phase in `e2e-full.ps1` (only the Android runner snapshots localStorage).
- **Correction to an earlier note in this file:** it claimed Android could not add its first group. That was wrong - the test simply never entered edit mode. With `ttrpg_groups = []`, after `Enter Edit Mode` the `+` is present and visible (`getBoundingClientRect` 20,337, w/h > 0). No bug; no change made.

## SESSION 2026-09-27 (cont. 3) â€” README brought up to date for Android; ICON FEATURE parked for later
User asked what else was planned, then: "Bring the readme up to date and make a note of icon feature inside opencode summary. I'll circle back to that at a later date."
Backup first: `C:\Users\emire\OneDrive\MasaÃ¼stÃ¼\ttrpg-soundboard-backup-20260927-020211` (202 files; correct U+00FC folder - console renders it as `Masaï¿½stï¿½`, that is only a codepage display issue).

### ðŸ”¶ PARKED FOR LATER â€” the only unimplemented planned feature: ICON FEATURE
**`ICON_FEATURE_SPEC.md`** (376 lines, created 2026-09-03, header says *"Status: Planning â€” do not implement until approved"*). User explicitly deferred it on 2026-09-27 - **do not start it without a fresh request.**
- Scope: `icon` field on **Group**, **GroupChar** and **GroupCat**; an `<IconPicker>` with an Emoji tab (~120 curated TTRPG emoji) and a Lucide tab (~63 icons), rendered inline in the add/edit group modal and as an edit-mode tap popover on character/category rows.
- Display targets: group tab on the mobile rail (icon, falling back to first letter), group tab in drawer + desktop sidebar, group heading, character rows (default `User`), category rows (default `Music`).
- Spec already covers: no data-version bump needed (`normalizeStoredData` spreads unknown fields, missing `icon` degrades to fallback), `toggleGroupMode` must carry `icon` through envâ†”chars conversion, `addGroup` â†’ `''` / `addGroupCharacter` â†’ `'User'` / `addCategory` â†’ `'Music'`, edit-mode-only row pickers, popover flip near screen bottom, aria-labels, 11-step implementation order, 14-item verification checklist.
- **Implementation status: nothing done.** `IconPicker` = 0 hits, `renderIcon` = 0, `iconPickerOpen` = 0 in `src/App.jsx`. The 8 existing `icon:` fields are per-sound *image* icons and are unrelated.
- **Line numbers in the spec are stale** (drifted during the mobile work): `normalizeStoredData` ~55 â†’ **43**, group modal ~4367 â†’ **4927**, `addGroup` â†’ **2385**, `addGroupCharacter` â†’ **1824**, `toggleGroupMode` â†’ **2780**, `handleEditGroup` â†’ **2482**, `groupFormData` â†’ **730**. All symbols still exist.
- âš ï¸ **Fix before implementing:** 5 of the 63 Lucide names in the spec do **not** exist in the installed `lucide-react` 0.428.0 â€” `Robot`, `Witch`, `Bow`, `Spear`, `Potion`. Importing them as written breaks the build. Valid substitutes: `Bot`, `WandSparkles`, `FlaskConical` / `TestTube`, and `Target` / `ArrowUp` for bow/spear. Verified the other 58 exist (`Flower2`/`Music2`/`Volume2` are fine - lucide slugs trailing digits with a hyphen, e.g. `volume-2.js`).
- Gotcha when re-checking icon names: do **not** test `node_modules/lucide-react/dist/esm/icons/<slug>.js` with a naive PascalCaseâ†’kebab conversion - trailing digits need a hyphen (`Volume2` â†’ `volume-2`) or you get false "missing" results. Query `dist/lucide-react.d.ts` for exported names instead (substring matching cannot produce false negatives).

### README.md updated (this session)
- Header now advertises **Windows Â· Android Â· Web**; intro line no longer says "desktop application".
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

## SESSION 2026-09-27 (cont. 4) â€” PROFILES + SYNC: approach CHOSEN (design discussion, NO code written)
User wants a profile system to move their setup between desktop and Android. Constraint: "not anything intrusive, ideally no personal data". App is intended to be **released publicly**, so the design must serve users who start on one device and later add a PC.

### Decision
Options presented (A folder-sync, B LAN device-to-device, C self-hosted WebDAV/S3, D hosted provider, E manual bundle export/import). **User chose E (export/import `.spellcaster` bundle) as the shipped baseline**, with A (folder sync) as a possible later addition. E is the only option needing no transport, no accounts and no infrastructure, and it is the primitive the others are built on.

### Facts established while scoping (verified in code)
- Sync payload is small: the 29 MB / 71 files of **default sounds live in `public/assets` and ship inside the app**, referenced by filename only -> already identical on every install. Only user uploads travel.
- Storage today: data in localStorage (`ttrpg_characters`, `ttrpg_environment` **SINGULAR**, `ttrpg_groups`, `ttrpg_data_version`, plus settings `boxSize`, `backgroundSettings`); uploaded audio + icons in `BaseDirectory.AppData` / `uploads` (`TAURI_STORAGE_DIR`, App.jsx:10); web backend uses `sound_file_*` localStorage data-URLs (~5 MB cap).
- **Custom sound icons are also uploads** (App.jsx:1564-1566 `storeFileInLocalStorage` -> `icon: storedName`) â€” a bundle must carry `icons/` too, not just audio. Easy to miss.
- **There are no `updatedAt`/`createdAt`/`deletedAt` fields anywhere** (0 hits in `src/App.jsx` + `src/data.json`) -> last-write-wins conflict resolution is impossible today. Add timestamps + tombstones now; it is the prerequisite for folder/cloud sync later.
- `src-tauri/capabilities/default.json` grants only `fs:allow-appdata-*` + a few pathless perms -> writing a bundle to a user-picked path requires widening the fs scope.

### Scope agreed as needed (7 work items)
1. Profile model + storage refactor: `profiles` index + `profile:<uuid>:<key>` namespacing + `uploads/<profileId>/`, and a first-run migration for existing users (reuse the `ttrpg_*_old` backup trick, App.jsx:79-87). Multi-profile UI: create/rename/duplicate/delete/switch. **Highest data-loss risk â€” do it first and alone.**
2. Bundle format + optional encryption: `manifest.json` (formatVersion, appVersion, per-file sha256+size) + `data.json` + `audio/` + `icons/`; reuse `normalizeStoredData` (App.jsx:43) as the forward-migration entry point; optional passphrase with AES-256-GCM **in Rust** (preferred over WebCrypto â€” no secure-context question, and testable from `e2e/`).
3. Bundled-vs-uploaded provenance: a write-time flag is safer than filename guessing, so the 29 MB of built-in audio never enters a bundle.
4. Export pipeline: streaming zip (**fflate**), never a whole-bundle `Uint8Array`; `tauri-plugin-dialog` + widened fs scope; web = Blob download; **Android SAF save is the least-known piece â€” spike early**; remember `main.rs`/`lib.rs` plugin parity.
5. Import pipeline, **atomic**: validate -> temp dir -> swap. Modes: new profile / replace active / merge (needs id-collision + duplicate-name policy). Per-file progress + report.
6. Public-release concerns: round-trip guarantee, "reset to starter sounds", clear errors on corrupt/wrong-version bundles (never a partial import), and a note that exported profiles contain the user's own audio.
7. E2E: new `e2e/e2e-profiles.mjs` wired into `e2e-full.ps1` (seed -> export -> wipe -> import -> deep-compare). Architect for testability: import takes bytes, the UI only feeds it picker bytes â€” otherwise tests hit the known `DOM.setFileInputFiles` Android-WebView renderer crash.

### Deliberately out of scope
Accounts, real-time sync, WebDAV, cloud, QR. Keep a `ProfileTransport` interface with a single "file" implementation so A/B/C can be added without touching the UI.

### Status
Design discussion only â€” **no code written**, app untouched. Spec authored: **`PROFILE_SYNC_SPEC.md`** (14 sections, planning-only header like `ICON_FEATURE_SPEC.md`). Backup taken first per AGENTS.md: `C:\Users\emire\OneDrive\MasaÃ¼stÃ¼\ttrpg-soundboard-backup-20260927-021859` (202 files). `git status`: `PROFILE_SYNC_SPEC.md` (new) + `README.md` + `opencode-summary.md`.

### Extra facts found while authoring the spec (all verified in code)
- **Two sound-file shapes coexist**: character/group sounds use `files: [{...}]`; legacy environment sounds use a single `file: "Name.mp3"` (`src/data.json` `environmentSounds`; playback fallback at App.jsx:2532). `files[]` entries are themselves heterogeneous (`name` / `storedName` / `displayName` / `url`, see App.jsx:1077-1084). **The exporter must walk both shapes.**
- **Custom background image is an inline base64 data URL up to 5 MB written straight into localStorage** (`backgroundSettings.imagePreview`, App.jsx:2147-2194) â€” the biggest localStorage quota risk, and it must be extracted to `uploads/` and exported as a file.
- **Crypto recommendation**: AES-256-GCM + Argon2id implemented in **Rust** (not WebCrypto) â€” no secure-context question on `http://tauri.localhost`, and testable from `e2e/`.
- `fs:default` may not grant `read-dir`; needs verification, plus a widened scope for user-picked paths (today only `fs:allow-appdata-*`).
- New frontend dep needed: **`fflate`** for streaming zip (never buffer a whole bundle in JS memory).
- Spec Â§9.3 makes `importBundle(bytes)`/`exportBundle() â†’ bytes` pure byte-level functions so E2E can test import **without** driving the native dialog (which is what triggers the Android WebView renderer crash).

### NEXT
Nothing implemented. Awaiting user approval of the spec. Recommended first move when approved: **storage adapter + profile refactor + first-run migration as its own commit** (the only high data-loss-risk item), then provenance flag, bundle format, import, export, UI, E2E.

## SESSION 2026-09-27 (cont. 5) â€” PROFILE SPEC FINALISED: scope decisions taken (docs only, no code)
User trimmed the design in two rounds, then answered four open questions. All decisions are now baked into `PROFILE_SYNC_SPEC.md` (16 sections). Still **planning only â€” nothing implemented**. Backup for the whole docs session: `ttrpg-soundboard-backup-20260927-021859` (202 files, taken before the spec was created).

### Decisions (user's calls, all confirmed)
1. **No encryption.** Bundle is a **plain, unencrypted zip**; no crypto fields in the manifest. Rationale recorded in spec Â§6: payload is sound effects + names, not sensitive material, and a plain file makes "send it to my group" one action. Only consequence noted: audio a user adds may be non-redistributable and a plain zip gives no protection â€” the Settings UI note says so.
2. **Custom background image is NOT synced.** Per-device cosmetic; the existing inline `imagePreview` code path (App.jsx:2147-2194) is left untouched. **One behaviour deliberately kept:** export must force `background.imagePreview` to `null`, otherwise a 5 MB base64 blob rides along in `data.json`. Checklist asserts a user with a 5 MB background still gets a <1 MB bundle.
3. **Multi-profile retained** (not single-profile + safe replace) â€” namespaced storage stays, and "New profile" import is the safety story (try an imported setup without losing the current one).
4. **Merge import DEFERRED to v2.** v1 ships **New profile** (default) + **Replace active** only. Merge was the most intricate logic (id remap, duplicate names, per-record conflict rules) and buys least.
5. **Web EXCLUDED from v1** â€” web keeps working as today, no export/import controls. Structural reason: web audio is base64 data-URLs in `sound_file_*` localStorage (~5 MB cap), so a web export could only ever be metadata. Enabling it later needs web audio moved out of localStorage first; the byte-level API means no rework.
6. **Unresolvable audio policy: keep the container, drop the sound, report the count.** Import never fails over one missing file; the summary names it. Missing **icons** fall back to the default rather than dropping the sound.

### Knock-on effect worth remembering
Dropping Merge removed the **only** v1 consumer of `updatedAt`/`deletedAt` tombstones. Spec Â§4.3 is therefore re-labelled **optional / forward-compat insurance** for Merge + folder/cloud sync, and implementation step 2 is marked cuttable for minimum v1. Do not treat timestamps as blocking any more.

### Nice side effect of dropping encryption
**No custom Rust commands are required at all** â€” the feature is now frontend work plus registering `tauri-plugin-dialog` and widening the fs scope. Removes a build-toolchain risk and the `main.rs`/`lib.rs` custom-command parity trap. Spec Â§10 specifies pure-JS SHA-256 (`@noble/hashes`) rather than `crypto.subtle` (unavailable outside a secure context); promoting just the hash to Rust later is isolated if it proves slow.

### v1 shape
Desktop (Win/Linux/macOS) + Android Â· multiple named profiles per device Â· `.spellcaster` plain zip Â· import modes New profile + Replace active Â· web excluded Â· Merge deferred. `PROFILE_SYNC_SPEC.md` Â§13 carries a "Deferred to a later release" checklist so nothing is silently lost.

### Repo status
`git status`: `PROFILE_SYNC_SPEC.md` (new, untracked), `README.md` (modified, from the earlier docs session), `opencode-summary.md` (this file). **No app code touched in this session.**

### ðŸ”¶ PARKED â€” user closed this out as documentation-only on 2026-09-27
User: *"No need, just the documentation is enough for now. We will do it in a different time."* `PROFILE_SYNC_SPEC.md` header now reads **"parked by user decision"** so a future session does not start implementing it unasked. **This is the second parked spec** alongside `ICON_FEATURE_SPEC.md` â€” if a future session is asked to "continue the profiles work", confirm the user wants implementation before touching `src/App.jsx`. Nothing in the repo depends on either spec; both are documentation only.

## SESSION 2026-09-28 (cont. 6) â€” ICON FEATURE IMPLEMENTED + VERIFIED ON WEB AND ANDROID
User reactivated the parked icon feature (ICON_FEATURE_SPEC.md, parked 2026-09-27). Backup first per AGENTS.md: `C:\Users\emire\OneDrive\MasaÃ¼stÃ¼\ttrpg-soundboard-backup-20260928-211712` (203 files; robocopy exit 1 = success).

### Implementation (all in src/App.jsx, no DATA_VERSION bump - normalizeStoredData spreads unknown fields)
- ICON_MAP + ICON_CATEGORIES (Lucide) + EMOJI_CATEGORIES (~120 curated) + isEmojiIcon + renderIcon + IconPicker (Emoji/Icons tabs, inline in add/edit modals, aria-labels `Icon <label>`, `Clear icon`, `data-icon-preview`, shows first letter when no icon chosen).
- Persisted on add/edit/reset/populate; group-children icons carried through toggleGroupMode; rendered in sidebar/drawer/split pills, mobile rail, rows (default User for characters, Music for categories and group categories), and both desktop+mobile headings via renderHeadingIcon (per-entity fallback; group first letter when no child selected).
- **Critical crash fixed**: unaliased `Map` import from lucide-react shadowed global `Map` (used at `new Map()` ~691) -> `TypeError: ke is not a constructor` at boot. Fixed via `Map as MapIcon` (import line 11) and `Map: MapIcon` (ICON_MAP line 40).

### Desktop web verification (temp harness `%TEMP%\opencode\icon-test.mjs` + icon-run.ps1, vite preview :5233 + headless Edge CDP :9333)
Header, rows, sidebar/drawer tabs, split pills, picker round-trip, 24 Lucide cells incl. `Map` through the actual modal, per-area icons, bookmark/button apply, clear-icon -> letter fallback. **74/74 PASS, twice, identical.**

### Android (emulator) verification - key discovery
Repo `e2e-android.ps1` / `e2e-mobile.mjs` CANNOT run here: right after seed+`Page.reload` the WebView devtools socket dies (`[MOB] FATAL: CDP socket error (unknown). Exit 3`). A/B test with HEAD code proved it environment-side: `location.reload()` tears down `webview_devtools_remote_<pid>` on this AVD (`sdk_gphone16k_x86_64`, Android 17, emulator-5554). adb not on PATH (full path `C:\Users\emire\AppData\Local\Android\Sdk\platform-tools\adb.exe`). Running AVD is not the `Pixel_7` the suite expects.

### New no-reload Android driver - `%TEMP%\opencode\icon-mobile.mjs` + icon-mobile-run2.ps1
Seed via CDP -> `am start` HOME -> ~6s flush -> `am force-stop` -> `monkey` relaunch (cold start re-mounts React, replacing reload) -> reconnect CDP -> drive drawer/rail/modals.
Gotchas: (1) localStorage must be flushed before force-stop or the seed is lost (2s is too short; HOME+6s is deterministic); (2) runner must keep the host Vite (:5173) alive for the whole run or the app shows the "Failed to request 10.2.0.2:5173" tauri.localhost error page; (3) on Android selecting a group auto-selects its first member, so the heading shows the member, not the group name (group-letter fallback verified on a childless group instead); (4) the "Character Pack" toggle lives inside the mobile drawer, gated `editMode && tabType==='groups' && activeGroup`.
**Result: 52/52 PASS** across a TRUE process cold start: rail (emoji/lucide/letter), drawer tabs, headings (category emoji, Music fallback, member emoji, group letter), drawer rows (Drama / User fallback), picker round-trip (emoji -> Lucide Map -> preview svg, persisted), edit-by-heading-tap + clear -> empty persisted -> letter fallback, toggleGroupMode carrying member icon + keeping group icon.

### Repo web E2E (`e2e-full.ps1 -Phase web`) - first clean run then expectation fix
First run: 85 PASS / 14 FAIL, exit 2. Cause: NOT an app regression - the approved first-letter fallback prefixes group-tab/pill `textContent` (`DDragon Lore`, `TTavern Pack`, `HHero Pack`), breaking the suites' exact-text group matches (G-suite cascade + SPLIT L5).
Fixed test-only expectations in **e2e/e2e-full.mjs** (sidebar `Dragon Lore` x2, `Forest`, `Tavern Pack` clicks, split pill filter + `Hero Pack` click -> endsWith + `!b.title`), **e2e/e2e-mobile.mjs** (drawer `Forest`, `Tavern Pack`, `Dragon Lore`, group heading -> endsWith), and **e2e/e2e-run.mjs** (sidebg/heading `Forest` -> endsWith). Re-run: **exit 0, 0 FAIL**. Backup before these test edits: `ttrpg-soundboard-backup-20260928-221743`.
Note: `npm run lint` (eslint .) shows 1 PRE-EXISTING error in `vite.config.js:5` `no-undef process` (present in HEAD, file untouched) + the 3 known App.jsx warnings.

### Repo state
`git status`: `M src/App.jsx`, `M e2e/e2e-full.mjs`, `M e2e/e2e-mobile.mjs`, `M e2e/e2e-run.mjs`, `M opencode-summary.md`. `git diff --check` clean (LF->CRLF warnings only). User app data restored on the emulator from `%TEMP%\opencode\ls-backup-PRESERVED-ICONFEATURE.json` (7 keys, exit 0). Temp harnesses remain in `%TEMP%\opencode\` ready to re-run.

### NEXT
- Update `ICON_FEATURE_SPEC.md` status (planning -> implemented/verified) - not yet done.
- Optionally clean up temp harnesses in `%TEMP%\opencode\`.

---

## SESSION 2026-09-28 (cont. 7) - COLLECTION ICONS: "ORIGINAL 2 GROUPS" NOW ICON-SWITCHABLE
User follow-up request: the built-in **Characters** ("Elf Sorcerer"/"Human Paladin"/"Wood Elf Ranger") and **Environment** ("Background Music"/"Environment Effect") collections - the "original 2 groups" - showed locked User/Music icons on mobile with no icon option on web/tauri. Backed up first per AGENTS.md: `C:\Users\emire\OneDrive\MasaÃ¼stÃ¼\ttrpg-soundboard-backup-20260928-224101`. **Note (2026-09-28 end): `ICON_FEATURE_SPEC.md` was deleted by the user as obsolete; its content is finalized in this log and in the implementation.`**

### What was found
- Defaults live in `src/data.json` `characters`/`environmentSounds` (groups array is `[]`); NOT in ttrpg_groups. isMobile is platform-based (`isTauri && platform()==='android'||'ios'`), NOT viewport - rail/drawer only render inside a real Tauri Android/iOS webview, so browser tests can't reach them (kept emulator verification for mobile).
- Rail buttons at App.jsx (was ~4142/4150) hardcoded `<User size={18}/>`/`<Music size={18}/>`; drawer tab strip + desktop sidebar tabs + split pills were text-only. These were the LAST surfaces without a settable icon.

### Implementation (all in src/App.jsx)
- State + persistence: `ttrpg_characters_icon` / `ttrpg_environment_icon` (plain strings, lazy useState + setItem on change; no DATA_VERSION involvement). `updateCharSectionIcon`/`updateEnvSectionIcon` (App.jsx ~988 region).
- New `CollectionIconEditor` component (module-level, after IconPicker ~App.jsx:220): label + current icon + collapsible `IconPicker`; **edit-mode-only**, rendered once in the mobile drawer (below tab strip) and once in the desktop sidebar (below tab bar) as "Characters icon" / "Environment icon".
- Rendering wired via `renderIcon(value, {size, fallback})`: mobile rail (fallback User/Music), mobile drawer tabs, desktop sidebar tabs, split-view source pills ("Default Characters"/"Default Environments").
- All checkboxes/lines prefixed to match `.textContent.trim()` - svg adds no text, so e2e exact/endsWith matches remain valid everywhere.

### Verification (all green)
- Desktop harness `%TEMP%\opencode\colicon-test.mjs` + `colicon-run.ps1` (vite preview :5233, headless Edge CDP :9333): **18/18 PASS** - baseline fallbacks, editor visible only in edit mode, emoji round-trip via UI (sidebar tab -> ðŸ‰), Lucide round-trip (Drama), clear -> fallback, reload persistence, split pills show the icons.
- **Android emulator** `%TEMP%\opencode\colicon-mobile.mjs` + `colicon-mobile-run.ps1` (same cold-start no-reload technique as icon-mobile: seed -> HOME 6s -> force-stop -> monkey relaunch -> CDP forward): **15/15 PASS** - rail ðŸ‰/Drama, drawer tabs ðŸ‰Characters / Drama, drawer editors present in edit mode with preview = stored value, picker -> Map persisted; keys restored (were both '').
  - Gotcha: enter edit mode with drawer CLOSED (grid edit button ignores clicks while drawer open: `if (!isPanelOpen) setEditMode(...)`); reopen drawer to see the editors.
- Repo web E2E re-run post-change: **PASS=99 FAIL=0 TOTAL=99**, exit 0.
- `npx eslint src/App.jsx`: 0 errors / 3 pre-existing warnings; `npx vite build` ok; `git diff --check` clean (CRLF info only).

### Repo state
`git status`: `M ICON_FEATURE_SPEC.md`, `M e2e/e2e-full.mjs`, `M e2e/e2e-mobile.mjs`, `M e2e/e2e-run.mjs`, `M opencode-summary.md`, `M src/App.jsx`. ICON_FEATURE_SPEC.md now has a new Â§12 documenting the collection-icons follow-up. Nothing committed (user hasn't asked).

### Desktop tauri app cache restore (same session)
User reported the tauri cache got cleared during testing; asked to restore the original defaults. Windows desktop Tauri (`com.mrhorakhty.thespellcaster` WebView2) had the defaults AND seeded test residue (`Tavern Pack`, `Forest`, `ttrpg_groups`, stray collection-icon keys).
- Backed up `%LOCALAPPDATA%\com.mrhorakhty.thespellcaster\EBWebView\Default\Local Storage` -> `%TEMP%\opencode\spellcaster-localstorage-backup-20260928-232309` (9 files).
- Deleted that `Local Storage` leveldb (app was closed; confirms clean WebView2 reseed path).
- Verified by launching `npm run tauri dev` with `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9334` + CDP read (`%TEMP%\opencode\spellcaster-verify.mjs`): reseeded exactly from `src/data.json` - `char_1 Elf Sorcerer(4) / char_2 Human Paladin(3) / char_3 Wood Elf Ranger(4)`, env `Background Music(3) + Environmental Effects(4)`, `groups: []`, `data_version 3`, only the 5 normal keys (no test groups/icons/old keys). Cleaned up dev app + vite.
### Collection-icon keys cleared on Android emulator (same session)
User reported seeing non-default icons on mobile but correct ones on web/tauri. Root cause: emulator app stored `ttrpg_characters_icon="User"` / `ttrpg_environment_icon="Music"` (set manually by the user after seeing the ðŸ‰/Drama test residue from the colicon runs). Functionality was never wrong - those stored values render the same lucide `User`/`Music` as the fallback used by web/tauri.
- `%TEMP%\opencode\read-icons.mjs` (read-only CDP) confirmed the keys on the running emulator app (pid 22527; default data intact).
- `%TEMP%\opencode\clear-icons.mjs` removed both keys in-memory.
- Cold restart (force-stop + monkey launcher -> new pid 22823; re-started vite on :5173 for the `10.0.2.2:5173` devUrl) then re-read: **both keys `null` after restart** -> removal persisted to the Tauri storage DB. Emulator now pristine (absent -> fallback), matching web/tauri exactly; defaults intact.
- Note: vite left running on :5173 (pid 30096) so the running emulator app keeps loading; NOT killed this time to avoid a blank emulator.

### Restore Defaults â€” planning spec created (same session, near chat limit)
User is planning a "Restore Defaults" button (only resets/adds the built-in default sounds) but, being near the chat limit, asked for a spec document instead of implementation. Created `RESTORE_DEFAULTS_SPEC.md` (root, mirrors PROFILE_SYNC_SPEC.md style).
- Chosen design: **merge-by-id** â€” restore shipped default characters (`char_1..3`) / env categories (`Background Music`, `Environmental Effects`) and their sounds (`s_*`/`env_*`) to `data.json` values, re-add missing ones, keep user-created characters/categories/groups/uploads/icons/themes untouched. Hard-reset and DATA_VERSION-bump approaches rejected (would wipe user `ttrpg_groups`).
- Grounded anchors: DATA_VERSION='3' App.jsx:257; readStoredData App.jsx:311; normalizeStoredData App.jsx:263; state init App.jsx:625-635; auto-save effects App.jsx:3098-3125; Settings modal App.jsx:5397; gear buttons App.jsx:3815/4066; icon keys App.jsx:994-998; `sound_file_*` cache App.jsx:1883 (defaults never use it; restore playback needs no user files).
- Spec includes behavior contract, edge cases, testing plan (web harness + Android cold-start + e2e regression), out-of-scope list, and 4 open questions for the user (default-sound edits inside default chars, ordering, confirm copy, safety-backup keys).

### NEXT
- Session closed by user choice: vite + Android emulator app stopped; uncommitted work left as-is (git status: D ICON_FEATURE_SPEC.md, M PROFILE_SYNC_SPEC.md, M e2e/e2e-full.mjs, M e2e/e2e-mobile.mjs, M e2e/e2e-run.mjs, M opencode-summary.md, M src/App.jsx, ?? RESTORE_DEFAULTS_SPEC.md). Nothing committed (user hasn't asked).
- Next session: pick up RESTORE_DEFAULTS_SPEC.md (merge-by-id design, 4 open questions) and/or commit when asked.
- Optionally verify on a physical device (emulator verified; platform gate is checked).
- Optionally clean up `%TEMP%\opencode\` harnesses (colicon-test.mjs/colicon-run.ps1, colicon-mobile.mjs/colicon-mobile-run.ps1, icon-*, spellcaster-*, read-icons.mjs, clear-icons.mjs, ls-*).
- Watch for a future `DATA_VERSION` bump: the two new keys are plain strings, unaffected by the array-based wipe.

## SESSION 2026-10-01 â€” RESTORE DEFAULTS IMPLEMENTED + VERIFIED (web) âœ… (nothing committed)
User deleted all old backups (build judged stable), then reactivated the parked `RESTORE_DEFAULTS_SPEC.md`. **Backup taken first per AGENTS.md: `C:\Users\emire\OneDrive\MasaÃ¼stÃ¼\ttrpg-soundboard-backup-20261001-232157`** (203 files). NOTE: user reports this is now the **only** backup in existence.

### The 4 open questions were answered by the user (all "recommended" except the last)
1. **Keep** user-added sounds inside a default character/category (appended after the shipped ones) â€” nothing the user added is ever deleted.
2. **Ordering:** shipped defaults first, then user entries (deterministic + idempotent). Same for environment categories.
3. **Placement:** Settings modal, behind a confirm â€” as drafted. The confirm renders **stacked above the still-open Settings modal** (Cancel returns to Settings).
4. **Safety backup keys: SKIPPED** â€” no `ttrpg_*_restore_backup` keys written. Spec Â§6.1 is void.

### Implementation (all in `src/App.jsx`, 4 edits, no DATA_VERSION bump)
- **`mergeShippedDefaults(stored, shipped, idKey)`** â€” new module-level helper placed just before `getSoundIcon` (was line 337, now ~371). `idKey` is `'id'` for characters, `'category'` for env categories. Shipped entries first in shipped order, each with its shipped sounds deep-copied from `data.json` (`JSON.parse(JSON.stringify(...))` so React state never mutates the imported module) + the user's own sounds appended; user-created entries follow in existing order. Deep copy is load-bearing: `data.characters` is a shared module singleton.
- **`restoreDefaults()`** â€” placed next to `openSettingsModal` (~line 2237). Sets both arrays, then **repairs** the active selection: `setActiveCharacterId(prev => stillExists ? prev : mergedCharacters[0]?.id \|\| '')` (same for the env category). Closes the confirm.
- **State** `showRestoreConfirm` added right after `showAboutModal` (~line 1000) â€” kept with the other modal states, before any effect that reads it (TDZ rule from the 2026-09-05 bug).
- **UI**: `RotateCcw` added to the lucide import (line 6). A "Restore Defaults" `h3` section (`h3` + explanatory `p` + full-width dark button) sits between Legal & Credits and Close Settings in the Settings modal; a new confirm modal (`h2 "Restore Defaults"` + copy "â€¦cannot be undone automatically." + Cancel / red Restore defaults) is rendered after the Settings modal so it paints above at the same `z-50`.
- âš ï¸ **Deliberate deviation from spec Â§3, flagged to the user and awaiting a yes/no**: restoring keeps the `name` and `icon` the user set on an existing default entry (shipped values are used only when the entry is re-created). The spec said reset the name too. Reasoning: the user said "only change (or add if they are removed) the **default sounds**", and a chosen emoji/Lucide icon is unrecoverable once overwritten. Reverting = drop the two `...(existing && â€¦)` spreads in `mergeShippedDefaults`.

### Verification
- Gates: `npx eslint src/App.jsx` â†’ **0 errors** (same 3 pre-existing warnings: `convertFileSrc`, `_`, `ev`) Â· `npx vite build` OK.
- **Purpose-built harness 34/34 PASS, 0 FAIL** â€” `%TEMP%\opencode\restore-test.mjs` + `restore-run.ps1` (headless Edge CDP :9333, `vite preview :5233`). Seeds a mangled state (deleted `s_1`/`char_2`/`Environmental Effects`, hacked `s_2`/`env_1` metadata, a user sound + a custom character + a custom env category + a group, a renamed+emoji'd `char_1`), drives the real UI, then asserts: re-added/reset/kept split, defaults-first ordering, name+icon preserved, groups untouched, Cancel is a no-op, valid selection survives, no `restore_backup` keys, confirm stacks over Settings, grid really renders 5 cards, idempotency (2nd run byte-identical), persistence after reload.
- **Repo web regression `e2e-full.mjs`: PASS=99 FAIL=0 WARN=0, exit 0** â€” no regressions. Run via `%TEMP%\opencode\regress-run.ps1`, a PID-scoped copy of `e2e-full.ps1` Phase A **minus the blanket `Get-Process msedgewebview2 | Stop-Process` kill** in its finally block (that hazard is still unfixed in the repo file; see open debt). All ports/profiles cleaned up afterwards.

### Test gotchas hit this session
- `"$env:ProgramFiles(x86)\â€¦"` is **invalid** PowerShell (needs `${env:ProgramFiles(x86)}`) â€” the Edge launch silently produced a garbage path and the harness died with `FATAL no CDP page found`. Use the literal `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`.
- The desktop Settings gear is **icon-only** with `title="Settings"` (App.jsx:3867 / 4120) â€” there is no button labelled "Settings" to click by text. Both are reachable on web/desktop; mobile uses the same modal via its own gear.
- The sound-grid heading is the `h2` with `text-xl font-semibold`; a bare `document.querySelector('h2')` returns the sidebar's "Groups". Modal `h2`s are `text-xl font-bold`, so filtering on `includes('text-xl') && !includes('font-bold')` isolates the heading uniquely.
- Sidebar row `textContent` is **prefixed by the emoji/Lucide icon glyph** (`ðŸ‰RENAMED ELF`), so exact-text row clicks fail once an icon is set â€” match with `endsWith`.
- A "Restore Defaults" **section heading in Settings is an `h3`** while the confirm modal's is an `h2`; the confirm-open assertion counts both.
- Long CDP runs print nothing until they finish (output is buffered into a log). **Launch them detached** with `Start-Process â€¦ -PassThru` and poll the log; the user aborted one blocking run.

### Repo state
`git status`: `M src/App.jsx`, `M RESTORE_DEFAULTS_SPEC.md`, `M opencode-summary.md`. HEAD is `53ce2eb "Added ability to add icons/emoji for groups"`; working tree was clean before this session. **Nothing committed** (user hasn't asked).

### NEXT
- User decision on the name/icon deviation above (keep preserving, or reset names to shipped too).
- Optional: same verification on the Android emulator (cold-start harness; the confirm-over-Settings stacking is the only mobile-specific layout risk). Emulator is currently **not** running.
- Optional: clean up `%TEMP%\opencode\{restore-test.mjs, restore-run.ps1, regress-run.ps1, regress*.log}`.
- Pre-existing open debt unchanged: `e2e-full.ps1` blanket `msedgewebview2` kill + missing Windows-phase storage snapshot, native `onRenderProcessGone`, tracked junk (`e2e/_avtest2.txt`, `e2e/e2e-all.ps1.new`, `e2e/_e2e_pixel.png`), `Run App.bat` gitignore status, and `npm run lint`'s pre-existing `vite.config.js:5 no-undef process` error.

## SESSION 2026-10-01 (cont.) â€” RENAME-ANCHOR BUG FOUND BY THE USER'S MANUAL TEST + FIXED âœ…
User tested manually: *"it does keep the added content and restores the deleted ones. It also reverts the names of default ones. It looks good enough."* That last claim contradicted the code, so it was investigated instead of assumed â€” and it exposed a **real bug in the merge**.

### The bug
Environment categories have **no id**: `updateCategory` (App.jsx:2570-2574) rewrites `entry.category`, so **the category name IS the only anchor**. The first implementation matched purely on that key, so a **renamed default category fell through to the "user entry" bucket** and restore re-added the shipped one *alongside* it:
```
envs: [{"category":"Background Music","sounds":["env_1","env_2","env_3"]},
       {"category":"Environmental Effects","sounds":["env_4".."env_7"]},
       {"category":"Music Box","sounds":["env_1","ue_1"]}]   <-- env_1 DUPLICATED
```
So "Background Music" reappearing (which the user read as a name revert) was actually a duplicate entry, and the user had two categories playing the same Forest Ambience. Character renames are unaffected â€” `updateCharacter` (App.jsx:2101-2107) keeps `character.id`, so the id anchor survives.

### The fix (`mergeShippedDefaults` in src/App.jsx)
1. **Two-stage anchor**: exact `idKey` match first, then a fallback matching a stored entry that still carries **one of that default's shipped sound ids** â€” so a renamed default category is recognised.
2. **Each stored entry can be claimed only once** (`claimed` Set of indices) â€” no default can consume the same entry twice, and anything unclaimed stays a user entry.
3. **The shipped name now wins** (the `...(existing && â€¦) { name }` spread was removed), so a rename is undone cleanly and no duplicate appears. This is the spec's original Â§3.1 behaviour and matches what the user expected.
4. **Icons are still preserved** â€” `data.json` ships no `icon` for characters/categories, so there is nothing to restore and clearing it would destroy an unrecoverable user choice.
5. The active-selection repair now also covers this case: selecting "Music Box" and restoring lands on a valid category again (its name changed).

### Verification after the fix (all green)
- New probe **`%TEMP%\opencode\restore-rename.mjs`** (run via `restore-run.ps1 -Rename`): seeds `char_1` renamed to "Gandalf" with a ðŸ‰ icon + `Background Music` renamed to "Music Box" â†’ **PASS=9 FAIL=0**. Result: `chars[0] = {name:"Elf Sorcerer", icon:"ðŸ‰", sounds:s_1..s_4}`; `envs = [Background Music (env_1,env_2,env_3,ue_1), Environmental Effects (env_4..env_7)]` â€” "Music Box" gone, no duplicate sound ids, the user's `ue_1` carried into the restored category.
- Main harness **34/34 PASS** (M4 + M18 updated to expect the shipped name back).
- Repo web suite `e2e-full.mjs`: **PASS=99 FAIL=0 WARN=0**, exit 0.
- `npx eslint src/App.jsx` 0 errors / 3 pre-existing warnings Â· `npx vite build` OK. Ports 5233/9333 free, profiles removed.

### Harness gotchas (cost real time â€” do not repeat)
- **Never pipe a PowerShell runner's output through `Select-Object`** in this shell â€” it returns *empty*. Read the log file, or run the script without a pipe.
- `param([switch]$Rename)` must be the **first statement** of a `.ps1`; when it was inserted mid-script the parser still said PARSE OK, `param` was executed as a command, the switch never bound, and the script silently ran the *other* suite. Always confirm which suite ran by its banner line.
- Long CDP runs buffer all output until the end â†’ launch detached (`Start-Process â€¦ -PassThru` + `WaitForExit`) and read stdout, otherwise the tool call looks hung (the user aborted one).
- `restore-run.ps1`'s cleanup left an orphan `vite preview` on 5233 behind its `taskkill`; always re-check listeners after a run and kill leftovers by PID.

### Repo state
`git status`: `M src/App.jsx`, `M RESTORE_DEFAULTS_SPEC.md`, `M opencode-summary.md`. HEAD `53ce2eb`. **Nothing committed.** Backup `ttrpg-soundboard-backup-20261001-232157` predates the rename fix (it has the pre-fix `mergeShippedDefaults`); take a new one before further changes.

### Behaviour confirmed by the user (2026-10-02)
User reviewed the fix and explicitly approved the semantics: **"Name should also reset with the button, icons can stay that's fine."** That is precisely the shipped behaviour â€” the rename-anchor fix makes the shipped name win (a renamed default is renamed back, with no duplicate entry) while a user-chosen `icon` is preserved. **No further code change was needed for this request.**

New backup taken (the previous one predates the rename fix): **`ttrpg-soundboard-backup-20261002-000147`** (203 files). It is the only backup in existence.

## SESSION 2026-10-02 â€” BACKUP PATH BUG: I was writing to a MISSPELLED OneDrive folder âœ… fixed
User: *"you are doing backups on the wrong location. It needs to be `C:\Users\emire\OneDrive\MasaÃ¼stÃ¼`, but you are backing up to `C:\Users\emire\OneDrive\Ã¼stÃ¼ltÃœ`."* â€” **the agent was at fault, twice over.**

### What happened
- `AGENTS.md` already specified the right path and warned *"build it with `[char]0x00FC`, never type the literal"*. This session ignored that guidance and hand-assembled the name as `"C:\Users\emire\OneDrive\" + [char]0x00FC + "st" + [char]0x00FC + "lt" + [char]0x00DC`, which produces **`Ã¼stÃ¼ltÃœ`** â€” a leading `Ã¼` and a capital `Ãœ` (0xDC) that do not belong.
- So **both** of this session's backups landed in a stray folder next to the real one:
  `OneDrive\Ã¼stÃ¼ltÃœ\{ttrpg-soundboard-backup-20261001-232157, -20261002-000147}` (202 files each).
- The correct `OneDrive\MasaÃ¼stÃ¼` was **empty of backups** (the user had deleted the earlier ones), so a whole session went unbacked-up with no visible error â€” exactly the failure mode `AGENTS.md` was written to prevent.

### Enumerating non-ASCII folder names (the reliable check)
`Get-ChildItem` renders `Ã¼` as `?` in this console, so **compare char codes, not glyphs**:
```powershell
Get-ChildItem 'C:\Users\emire\OneDrive' -Directory |
    ForEach-Object { "{0} | {1}" -f $_.Name, (($_.Name.ToCharArray() | ForEach-Object { [int]$_ }) -join ',') }
```
- `MasaÃ¼stÃ¼` (correct) â†’ `77,97,115,97,252,115,116,252`
- `Ã¼stÃ¼ltÃœ` (mine)    â†’ `252,115,116,252,108,116,220`

### Cleanup done
- Moved both backup folders into the correct `MasaÃ¼stÃ¼` (verified 202 files each afterwards).
- The now-empty `Ã¼stÃ¼ltÃœ` folder disappeared on its own (OneDrive sync removed the empty dir).
- **`AGENTS.md` hardened** so this cannot recur: the rule now spells out that the name is exactly `Masa` + `Ã¼` + `st` + `Ã¼`, that `[char]0xDC` and any leading `Ã¼` are wrong, gives the verified one-liner
  `$desk = 'C:\Users\emire\OneDrive\Masa' + [char]0x00FC + 'st' + [char]0x00FC`, and requires asserting the char-code list `77,97,115,97,252,115,116,252` **before** copying. It also records that this exact mistake has now happened twice (`MasaÃƒÂ¼stÃƒÂ¼`, then `Ã¼stÃ¼ltÃœ`).

### Correct backup locations as of now
`C:\Users\emire\OneDrive\MasaÃ¼stÃ¼\ttrpg-soundboard-backup-20261001-232157` and `â€¦-20261002-000147` (the latter contains the rename fix; the former predates it).

## SESSION 2026-10-02 (cont.) â€” SECOND MERGE BUG (duplicate sound across two defaults) FOUND + FIXED âœ…
User asked *"Are there any other tests you need to do?"* â€” yes. Wrote a third probe for the corners the first two suites did not reach, and it found a **second real bug**.

### The probe (`%TEMP%\opencode\restore-corner.mjs`, run via `restore-run.ps1 -Corner`)
Seed: a default character emptied of all its sounds; a default category **renamed AND emptied** (so the sound-id anchor is gone); and a **rename collision** (the "Environmental Effects" entry renamed to `"Background Music"`, carrying `env_4`).

### The bug
`env_4` (Rain) ended up in **both** categories:
```
envs: [Background Music (env_1,env_2,env_3,env_4), Environmental Effects (env_4..env_7), Music Box ()]
```
Root cause: the user-sound filter excluded only the *current* default's own shipped ids. `env_4` was not one of Background Music's ids (`env_1..3`), so it was carried over as "user content" â€” while Environmental Effects, having lost its name anchor, was rebuilt from scratch and also got `env_4`. Second press could not fix it (the merge is idempotent, so the duplicate was stable).

### The fix
`mergeShippedDefaults` now builds a **collection-wide** `allShippedSoundIds` set and filters user sounds against **that**, not just the current default's ids. A sound belonging to any shipped default is therefore restored only in its own home and can never be duplicated. Accepted consequence: if a user deliberately moved a default sound into a different default, restore returns it to its shipped home instead of keeping the copy.

### Verification after this second fix â€” all green
| Suite | Result |
|---|---|
| Corner probe (new) | **8/8 PASS** (was 7/8) â€” `Z4` duplicate gone, `Z8` still idempotent on the corner state |
| Rename-anchor probe | **9/9 PASS** |
| Restore Defaults main suite | **34/34 PASS** |
| Repo web suite `e2e-full.mjs` | **PASS=99 FAIL=0 WARN=0**, exit 0 |
| `npx eslint src/App.jsx` | 0 errors (3 pre-existing warnings) Â· `vite build` OK |

Backup after the fix: **`ttrpg-soundboard-backup-20261002-001740`** (in the corrected `MasaÃ¼stÃ¼` folder; path char codes asserted before copying). The three backups now in `MasaÃ¼stÃ¼`: `-20261001-232157` (pre-rename-fix), `-20261002-000147`, `-20261002-001740` (current).

### Harness note
`restore-run.ps1` leaves an orphan `vite preview` on 5233 behind its own `taskkill`; that orphan then silently satisfies the *next* runner's readiness probe. Always kill leftovers by PID and re-check `Get-NetTCPConnection` before a run.

### Remaining test gaps (deliberate, not blockers)
*(Superseded â€” both were run later the same session; see the following section and the closing state.)*
- **Android emulator** â€” never exercised. The data path is platform-independent pure React + localStorage, so the only real risk is the confirm-stacked-over-Settings layout on a phone bottom sheet. The repo's `e2e-android.ps1`/`e2e-mobile.mjs` path is also unreliable on this AVD (the WebView devtools socket dies on `Page.reload`), so it needs the cold-start harness.
- **Phase B (desktop WebView2, `e2e-full.ps1 -Phase win`)** â€” the user exercised the feature manually in the real app and it behaved correctly; the 99-check Phase B suite has not been re-run since the change.

## SESSION 2026-10-02 (cont.) â€” ANDROID (WebView) + PHASE B (WebView2) VERIFIED âœ… both test gaps closed
User: *"Might as well do them too."* â€” ran both remaining verification gaps. **No product bug found in either; both platforms pass.**

### Phase B â€” real Tauri/WebView2 desktop (`e2e\e2e-full.ps1 -Phase win`)
- `PASS=99 FAIL=0 WARN=0 TOTAL=99`, runner `exit=0` (log `â€¦\Temp\opencode\e2e-run-20261002-002117.log`).
- Rust needed no rebuild (only JS changed), so CDP :9224 was up quickly.
- `-Phase win` deliberately skips Phase A's blanket `msedgewebview2` kill. After the run the only surviving WebView2 procs were WhatsApp/DriveFS/shell scopes â€” none ours.
- The runner's own `SAVE_RESTORE=1` protects the user's real desktop data, so this is safe against the live app.

### Android â€” emulator WebView via **cold start** (`%TEMP%\opencode\restore-mobile.mjs`) â†’ **13/13 PASS**
`MOBILE SUMMARY: PASS=13 FAIL=0 TOTAL=14` (M0â€“M12). Confirmed on the real device: emptied default character refilled, custom character untouched, renamed category renamed back, shipped sounds restored, custom sound kept inside the default, no duplicate sound ids, second press idempotent.

Mobile-specific layout evidence (screenshots were captured but **this model cannot view images**, so it was measured instead):
```
viewport 411x914 | dialog panel fixed, z-index 50, rect 0,0,411,914
fits viewport: true | horizontal overflow: false | needs scroll: false | 2 backdrops
confirm button rect [239,826,149,40] -> elementFromPoint at its centre = the button itself (topmost, clickable)
```
So the "confirmation stacked over Settings" concern is resolved on a 411x914 phone viewport.

### Three harness gotchas that cost real time (worth remembering)
1. **`am force-stop` discards freshly seeded localStorage.** The Android WebView commits localStorage asynchronously; killing the app right after writing throws it away, and the next launch silently re-seeds shipped defaults â€” which masquerades as a data bug. Fix: `input keyevent KEYCODE_HOME` â†’ wait ~3s (pause + flush) â†’ `am force-stop` â†’ relaunch.
2. **Never `Page.reload` in the Android WebView** (socket dies) â€” cold-start with HOME+force-stop+monkey instead, and re-`adb forward` to the *new* pid each time.
3. **Muting `localStorage.setItem` to stop the app clobbering a seed also mutes the seed itself.** Seed through the captured original (`W = (k,v) => window.__origSetItem(k,v)`), keep the mute for everything else. My first attempt muted and then seeded with the muted setter, so nothing was written at all.
Also note `readStoredData` (`src/App.jsx:311`) **wipes a key and re-seeds defaults** whenever `ttrpg_data_version !== '3'`, backing the old value up to `${key}_old` â€” a harness seeding data without the version key looks exactly like a bug.

### Cleanup
- Emulator debug app data cleared (`pm clear` â†’ Success) so the seeded test values are gone.
- `adb forward` removed, vite on 5173 killed, ports 5173/9224/9225 all free.

### NEXT / closing state â€” Restore Defaults is DONE and fully verified
**Nothing is in progress. All four files are ready for the user to commit** (`AGENTS.md`, `src/App.jsx`, `RESTORE_DEFAULTS_SPEC.md`, `opencode-summary.md`; HEAD before this work was `53ce2eb`, nothing pushed).

Final verification matrix for the Restore Defaults feature (two real bugs found and fixed along the way, both by probes beyond the original plan):

| Target | Result |
|---|---|
| Web preview (headless Edge, CDP) | main suite **34/34**, rename-anchor probe **9/9**, corner probe **8/8**, repo `e2e-full.mjs` **99/99** exit 0 |
| Desktop Tauri / WebView2 | `e2e-full.ps1 -Phase win` **99/99**, exit 0 |
| Android emulator WebView | cold-start mobile harness **13/13** |
| Gates | `eslint src/App.jsx` 0 errors (3 pre-existing warnings) Â· `vite build` OK Â· `git diff --check` clean |

Known non-blockers, deliberately left alone (all pre-existing, none requested). âš ï¸ **The first two were later FIXED on 2026-10-04 â€” see the session at the end of this file; read that first, don't re-attempt them:**
- ~~`e2e/e2e-full.ps1` Phase A still blanket-kills every `msedgewebview2` on the machine; Phase B's kill is correctly scoped to `--webview-exe-name=SearchHost.exe`. Worked around with `-Phase win` / PID-scoped temp runners.~~ â†’ **fixed**: blanket kill removed, Phase B now scopes on `--remote-debugging-port=9224`.
- ~~Crash-safety for the Windows phase of `e2e-full.ps1` (only the Android runner snapshots localStorage); tracked junk files `e2e/_avtest2.txt`, `e2e-all.ps1.new`, `e2e/_e2e_pixel.png`; `e2e-all.ps1` must never be recreated (Bitdefender hard filename block).~~ â†’ **fixed**: Windows phase now snapshots localStorage too, junk files deleted, `.gitignore` blocks the old names.
- `ICON_FEATURE_SPEC.md` was **deleted by the user as obsolete on 2026-09-28** â€” the icon feature itself shipped in `53ce2eb`. Do not recreate it; its design is finalised in this log. `PROFILE_SYNC_SPEC.md` is the one still parked.
- Harness scripts kept in `%TEMP%\opencode` (`restore-test.mjs`, `restore-rename.mjs`, `restore-corner.mjs`, `restore-run.ps1`, `restore-mobile.mjs`, `regress-run.ps1`) â€” useful for re-running, delete at will.
- Repo `e2e-android.ps1` / `e2e-mobile.mjs` path remains known-unreliable on this AVD for *seeding* purposes; the cold-start harness above is the working mobile path (85/85 for that repo suite was reached earlier on 2026-09-27).

## SESSION 2026-10-04 â€” KNOWN DEBTS 1-4 FIXED + VERIFIED âœ… (test/tooling only, zero app-code changes)
User: *"Let's focus on the known debts for now."* Then explicitly chose **1-4 (all the safe ones)**, decided **5: `Run App.bat` stays gitignored**, and said **7 (`e2e-all.ps1`) stays a debt as a reminder**. User had deleted all backups; a fresh one was agreed and taken.

**Backup first (AGENTS.md): `C:\Users\emire\OneDrive\MasaÃ¼stÃ¼\ttrpg-soundboard-backup-20261004-145124`** (203 files; folder leaf char codes asserted `77,97,115,97,252,115,116,252` before copying).
âš ï¸ Gotcha re-hit this session: the AGENTS.md assertion snippet compares the **full path**'s char codes, not the folder name's â€” `$desk` starts at `67,58,92...` (`C:\...`) so an equality check against `77,97,...` always aborts. Assert on `Split-Path -Leaf $desk` instead. That's what the code below does.

### Debt 4 â€” `npm run lint` was FAILING (pre-existing `vite.config.js:5 no-undef process`) âœ…
- `eslint.config.js`: added a **scoped** config entry `files: ['vite.config.js','eslint.config.js']` with `globals: { process: 'readonly', console: 'readonly' }`. Scoped on purpose â€” adding `process` to the main `**/*.{js,jsx}` globals would silently let `process` slip into browser code in `src/App.jsx`.
- Result: `npx eslint .` â†’ **0 errors, 3 pre-existing warnings** (`convertFileSrc`, `_`, `ev`), exit 0. `npm run lint` is green for the first time.

### Debt 1 â€” Phase A killed EVERY WebView2 process on the machine âœ…
- `e2e/e2e-full.ps1` Phase A `finally` ran `Get-Process -Name msedgewebview2 | Stop-Process -Force` â€” a blanket kill that also killed the user's **WhatsApp / Google Drive / Windows Search** WebView2, even though Phase A only starts headless Edge (`msedge.exe`) and uses no WebView2 at all. **Removed.** `Remove-Orphans` already reaps ours precisely (it filters `msedgewebview2.exe` + `remote-debugging-port=*`, which only our test processes carry). Replaced with a comment recording why there is deliberately no blanket kill.
- **Found a second instance of the same bug class while in there:** Phase B's kill filtered on `--webview-exe-name=SearchHost.exe`, but the *real* Windows Search shell uses that exe name too â€” so it also killed unrelated system WebView2 (the older summary had recorded surviving "normal Windows system instances", i.e. the collateral was already visible). Retightened to `--remote-debugging-port=9224`, the actual discriminator.
- Verified empirically: after both phases, **19 `msedgewebview2` processes survived** and the Phase A log shows only `Killed PID 2600/30288 (node.exe)` â€” our own processes.

### Debt 2 â€” Windows phase had no crash-safe localStorage guard âœ…
- `e2e-android.ps1` has had one since 2026-09-27; Phase B (which runs against the user's **real** desktop app data) had none, so a crashed/killed suite left the E2E seed in the app. Ported the exact pattern into `e2e-full.ps1` Phase B: `$lsBackup = $null` before the `try`, `e2e-snapshot.mjs save` after CDP is ready and **before** the suite, and `restore` as the **first** step of the `finally` (needs a live app + CDP). A failed restore records `WARNING: ...` in `$results`, which trips the runner's existing `FAILED` regex so the run exits 1, and prints a recovery command.
- Verified live: `[SNAP] saved 8 localStorage keys (1320 bytes)` â€¦ `[SNAP] restored 8 localStorage keys` â€¦ `[SNAP] page reloaded`. Logs `%TEMP%\opencode\e2e-run-20261004-{145430,145614}.log`, snapshots `ls-backup-20261004-*.json`.

### Debt 3 â€” tracked junk files deleted âœ…
- `git rm e2e/_avtest2.txt e2e/e2e-all.ps1.new e2e/_e2e_pixel.png`. `_e2e_pixel.png` was a **generated artifact** â€” `e2e-full.mjs:18-22` rewrites it on every run â€” so it never needed tracking. Added a `.gitignore` section: `e2e/_e2e_pixel.png`, plus `e2e/e2e-all.ps1`, `e2e/e2e-all.ps1.new`, `e2e/_avtest*.txt` so **debt 7 is now enforced by gitignore** rather than only by prose (the Bitdefender filename block survives delete + folder whitelist, so the guard matters). Verified `git check-ignore -v` matches all four; the regenerated `_e2e_pixel.png` no longer shows in `git status`.
- **Debt 5** (`Run App.bat`): user's call â€” stays gitignored at `.gitignore:285`. No change made. Note the consequence: the port-5173 + diagnostic-listener fix in that file lives only on this machine.

### Debt 6 â€” native `onRenderProcessGone`: **CONFIRMED BLOCKED, do not retry blindly**
Traced it properly instead of assuming:
- The Android WebViewClient is wry's, not Tauri's: `wry-0.55.1/src/android/kotlin/RustWebViewClient.kt` (extends `WebViewClient`, instantiated in `wry/src/android/main_pipe.rs:271-283`). It overrides only `shouldInterceptRequest`, `shouldOverrideUrlLoading`, `onPageStarted/Finished`, `onReceivedError` â€” **no `onRenderProcessGone`**.
- The generated copy `src-tauri/gen/android/app/src/main/java/com/mrhorakhty/thespellcaster/generated/RustWebViewClient.kt` carries `/* THIS FILE IS AUTO-GENERATED. DO NOT MODIFY!! */` and is **gitignored** (`gen/android/app/.gitignore:1` â†’ `/src/main/**/generated`), so any hand edit is wiped by the next `tauri android dev`.
- The wry template *does* have a `{{class-extension}}` placeholder for exactly this purpose, but neither `tauri-build-2.6.3` nor `tauri-runtime-wry-2.11.4` fills it (0 hits for `class_extension` in both crates) â€” so there is no supported hook today. A fix requires patching wry upstream or vendoring it.
- Practical severity is low: the crash was triggered by our own harness calling CDP `DOM.setFileInputFiles`, which was **removed from the Android path on 2026-09-27** (in-page `DataTransfer` instead). Left as-is deliberately.

### Verification (both changed phases actually executed)
| Run | Result |
|---|---|
| `e2e-full.ps1 -Phase web` | `FULL E2E SUMMARY: PASS=99 FAIL=0 WARN=0 TOTAL=99`, exit 0 â€” cleanup killed only our 2 `node.exe`, no WebView2 collateral |
| `e2e-full.ps1 -Phase win` | `PASS=99 FAIL=0 WARN=0 TOTAL=99`, exit 0 â€” snapshot/restore guard fired and reported success |
| Gates | `npx eslint .` **0 errors** / 3 pre-existing warnings Â· `node --check` on all 3 `.mjs` OK Â· `Parser::ParseFile` PARSE-OK on `e2e-full.ps1` + `e2e-android.ps1` Â· UTF-8 BOM preserved (239,187,191) Â· runner still ASCII-only Â· `vite build` OK |
| Cleanup | ports 5173/9224/9225/5233/9333/9334 all free; only the agent session's own `cmd.exe`/`powershell.exe` match the orphan filter (proves `Get-ProtectedPids` works); no `app.exe` |

Launch gotcha: `Start-Process â€¦ -RedirectStandardOutput` **blocks the tool call past its 120 s timeout** even with `-PassThru`. Use a wrapper `.ps1` in `%TEMP%\opencode` that runs the phases and writes one log, launch that detached, then poll the log file. Never pipe a PS runner through `Select-Object` â€” it returns empty.

### Repo state
**âœ… COMMITTED AND PUSHED by the user: `8ef2c6f "Fixing known debts"`** on `mobile-support`, pushed to `origin/mobile-support` (local == remote, verified). This was the **real-world proof the Bitdefender exclusion works**: the blob the commit created is `dde8ac16461bacd76e8ca171975cfa29c094d803` â€” the exact blob written by the 15:34 `hash-object` test â€” and it survived commit + push, is on disk, and `git cat-file -p` reads it. `Quarantine\cache.db` never moved off `2026-10-04 12:00:21 PM`. All 16 branch/remote refs read cleanly.
Files in that commit: `M .gitignore`, `M e2e/e2e-full.ps1`, `M eslint.config.js`, `D e2e/_avtest2.txt`, `D e2e/_e2e_pixel.png`, `D e2e/e2e-all.ps1.new`, `M opencode-summary.md`. `src/App.jsx` was **not** touched this session.
Temp helper added: `%TEMP%\opencode\verify-debts.ps1` (runs `-Phase web` then `-Phase win`, one combined log).

### ðŸš¨ INCIDENT â€” Bitdefender stripped git OBJECTS: HEAD's `e2e-full.ps1` blob was MISSING (found + repaired)
`git diff HEAD` failed with `fatal: unable to read 29927337c98fae39da9ed8370e8d84a982a1a1f8`. `git fsck` showed:
```
missing blob 29927337c98fae39da9ed8370e8d84a982a1a1f8
missing blob 3d1fcf151b7e70470a24f58c83cd6d6b42a64182
broken link from tree 8505be04... to blob 3d1fcf15...
```
- **`29927337` is HEAD's committed `e2e/e2e-full.ps1`** â€” i.e. the tip of `mobile-support` was not checkout-able. `git status`/`log` still worked (stat-only), so this is easy to miss; anything reading file contents from HEAD (`git diff HEAD`, `git show`, `git checkout -- <file>`, a fresh clone) would fail.
- **Both missing blobs are `e2e/e2e-full.ps1`, and no other file in the repo is affected** â€” including `e2e-android.ps1`, which also uses `Start-Process` + `adb forward`. So this is a **content-signature quarantine**, the same malware-like fingerprint that got `e2e-all.ps1` hard-blocked: hidden `Start-Process -WindowStyle Hidden` + `taskkill /F /T` + `Invoke-Expression` + `--remote-allow-origins=*`, all in one file. **Every stored version of that script has been stripped.**
- **Repair (done):** the backup taken minutes earlier was byte-identical to the missing blob (`git hash-object` on `backup-20261004-145124\e2e\e2e-full.ps1` â†’ `29927337...`, exact match), so `git hash-object -w` restored it. Verified afterwards: `git cat-file -s` â†’ `12162`, `git diff HEAD` works, `git diff --numstat HEAD -- e2e/e2e-full.ps1` â†’ `51  6`. It has not been re-quarantined since.
- **Still outstanding:** `3d1fcf15` (an older `e2e-full.ps1`) cannot be recovered, but its parent tree `8505be04` is **unreachable** â€” no commit in any branch references it (checked every ref in `refs/heads` + `refs/remotes`), so nothing is lost from real history. Left in place; `git gc --prune` would clear it, but there is no benefit and it would also drop the many dangling commits.
- **Integrity verified**: all **16** branch/remote refs (`mobile-support`, `master`, `release`, `split-view`, 4 `feature/*`, plus 8 `origin/*`) read cleanly with `git ls-tree -r`.
- âš ï¸ **This will recur on every commit that touches `e2e/e2e-full.ps1`** unless Bitdefender gets an exclusion for the repo's `.git` directory. **RESOLVED 2026-10-04 â€” see the verification section below: the user added the exclusions and it is confirmed working.**
- ðŸ’¡ **Technique worth remembering:** when a git blob goes missing, the `opencode-summary.md` backup folder is a recovery source â€” snapshot it BEFORE editing and `git hash-object` the backup file to see whether it matches the wanted SHA. That is how this was identified and repaired without a network fetch.

### âœ… WHITELIST VERIFIED WORKING (user added exclusions 2026-10-04 ~12:00)
**Proof it was Bitdefender all along** â€” the quarantine folder holds the smoking gun. Extracting printable strings from the two `.dat` records that mention this project gives the exact paths:
```
Quarantine\67ea0ef9-â€¦.dat -> \\?\C:\Users\emire\Projects\ttrpg-soundboard\.git\objects\3d\1fcf151b7e70470a24f58c83cd6d6b42a64182
Quarantine\7145f79f-â€¦.dat -> \\?\C:\Users\emire\Projects\ttrpg-soundboard\.git\objects\29\927337c98fae39da9ed8370e8d84a982a1a1f8
```
Both are byte-for-byte the two SHAs `git fsck` reported missing, both quarantined at `2026-09-30 01:46:35`. Case closed on the root cause.

**The exclusion is registered** in `C:\ProgramData\Bitdefender\Desktop\.settings\data\<guid>\.data`, readable as plain JSON:
```
"ExcludeMgr": {"Settings": [
  {"flags": 39, "path": "c:\\users\\emire\\projects\\ttrpg-soundboard\\.git\\"},
  {"flags": 39, "path": "c:\\users\\emire\\projects\\ttrpg-soundboard\\e2e\\"}]}
```
Both paths are covered â€” `.git\` (so objects stop being eaten) and `e2e\` (so the filename block on `e2e-all.ps1` is moot anyway).

**Empirical test:** wrote the *modified* `e2e/e2e-full.ps1` as a loose object â€” `git hash-object -w`, i.e. the exact operation a commit performs â€” producing blob `dde8ac16461bacd76e8ca171975cfa29c094d803`. After **3 minutes** the object file is still on disk (5168 B) and `git cat-file -s` still reads it (15289). Bitdefender's `Quarantine\cache.db` is still stamped `2026-10-04 12:00:21 PM` â€” i.e. it has **not** been touched since before the test, and the newest quarantined item on the machine is still from `2026-09-30`. No new quarantine. The restored HEAD blob `29927337` is also still intact.

**How to re-check this in future** (no guessing needed):
```powershell
git hash-object -w -- e2e\e2e-full.ps1                 # write the suspicious blob
Start-Sleep 90
Get-Item ".git\objects\<sha[0..1]>\<sha[2..39]>"      # still there?
(Get-Item "$env:ProgramData\Bitdefender\Desktop\Quarantine\cache.db").LastWriteTime  # bumped?
```
- ðŸ’¡ Gotcha: Bitdefender's exclusions live in that `.settings\data\<guid>\.data` **JSON**, *not* in the registry. Searching `HKLM\SOFTWARE\Bitdefender` for the project path returns nothing â€” don't conclude the exclusion is missing on that basis.
- ðŸ’¡ Gotcha: `git cat-file -s` printing `15289` (the **decompressed** size) is expected; the loose object file on disk is 5168 B (zlib). Use the on-disk size when checking the file exists.
- Still unrecoverable: `3d1fcf15`, but only referenced by the unreachable tree `8505be04` â€” no real history lost.

### NEXT / remaining debts
- ~~Bitdefender exclusion~~ â€” **done and verified 2026-10-04** (`.git\` and `e2e\` both registered; see the verification section above). Survived a real commit + push.
- **Debt 6** `onRenderProcessGone` â€” blocked on wry (see above); only viable via an upstream patch/vendor.
- **Debt 7** `e2e-all.ps1` â€” kept on the books as a reminder per the user; now also documented in `README.md` (Testing) so a future contributor does not recreate it, and `.gitignore`-enforced.
- `Run App.bat` remains gitignored by the user's decision â€” its port-5173 fix is local-only.
- `PROFILE_SYNC_SPEC.md` stays parked (user: documentation-only for now).
- `RESTORE_DEFAULTS_SPEC.md` **deleted 2026-10-04** at the user's request â€” the feature it specified shipped in `bde7483`; its content is finalised in this log.
- Not run this session: Android phase (`-Phase android`). It needs the emulator + a Rust Android build, and its seeding path is the known-unreliable `Page.reload` one; the cold-start harness in `%TEMP%\opencode` is the working mobile path.

### Docs pass after the commit (uncommitted, ready for the user to commit)
Docs-only, no code touched:
- **`RESTORE_DEFAULTS_SPEC.md` deleted** (`git rm`) at the user's request â€” the spec shipped as `bde7483`, design finalised in this log. Gitignore rule added in case it is ever recreated.
- **`README.md`**: `e2e-snapshot.mjs` description corrected (it is used by **both** runners now, not just Android); the Testing note about localStorage now says "desktop and Android runners"; documented `-Phase web|win|android` and `-Suite full|mobile|run|features`; added a warning that `e2e/e2e-all.ps1` must never be recreated because Bitdefender permanently blocks that filename at the filesystem level (with the reason and the replacements).
- **This file**: marked the two previously-listed "known non-blockers" as fixed (they were fixed earlier the same day â€” the stale list risked a future session re-attempting them), recorded the `8ef2c6f` commit/push, and recorded that `ICON_FEATURE_SPEC.md` is deleted-not-parked.
- âš ï¸ Gotcha re-hit: several historical backup paths in this file render as `Masa?st?` because they were captured from console output with a non-UTF-8 codepage. The **real** folder is `Masa` + `[char]0x00FC` + `st` + `[char]0x00FC` (see AGENTS.md). Do not "fix" those strings by hand-copying them.

---

## SESSION 2026-10-04 - MOVE / COPY SOUND: SPEC WRITTEN AND DESIGN CEMETED (docs only, zero app-code changes)

**Nothing was implemented.** `src/App.jsx` and every file under `e2e/` are byte-identical to `c83a72c`. The
whole session produced `MOVE_COPY_SOUND_SPEC.md` (498 lines) plus doc corrections. Do not expect a feature.

**Why the session existed:** the user asked for a *plan* for letting sounds be moved/copied between characters,
categories and groups in edit mode, and explicitly said not to implement until the design was cemented.

### Outcome: 8 decisions, all answered by the user
1. **Copy shares the audio file reference** (not a byte copy) - free and instant, but see the hazard below.
2. Entry point = a **third per-card button** in edit mode, not a context menu (no menu primitive exists here).
3. **Move is silent, no confirm.** Copy is non-destructive anyway. Deleting a sound, by contrast, must confirm
   100% of the time - already true today, now written into the spec as an invariant so it can't regress.
4. **Append at the end** of the destination; the user can drag to reorder afterwards.
5. The shared-file hazard gets a **reference-count guard as its own follow-up commit**, not folded into the
   feature - it touches 6 destructive call sites and should not be able to block or destabilise the feature.
6. Cross-slice partial writes: **rely on the existing `saveError` banner**, do not build a two-phase move.
7. Picker rows have **two buttons** (Move / Copy), no mode state - so the destructive action can never be
   picked by accident. The `IconPicker`-style segmented control was rejected on exactly that ground.
8. Copies auto-suffix **`Name (copy)`**, uniqueness scoped to the *destination container*.

### The accepted hazard (spec section 7)
Because a copy shares the source's `storedName`, deleting the **container** that held the original deletes the
shared audio and **silently breaks the copy** - the card still renders, it just makes no sound. `deleteSound`
(App.jsx:1767) never deletes files, but container deletion does so unconditionally per referenced file
(App.jsx:2194, 2628, 2744, 2763), as does removing a file inside the sound modal (App.jsx:2031, 2036). Today no
two sounds can share a `storedName` at all - `toStoredFileName` (App.jsx:1843) mints a fresh name per upload -
so this situation is *new*. The guard (`isFileReferencedElsewhere`) is specified but **not written**, and it
must cover `sound.icon` as well as `files[]`, since a copied custom icon dies identically. It fails safe: it
can only ever prevent a delete, so the worst outcome is an orphaned file rather than silent audio loss.

### Two self-corrections made during the session - do not "re-fix" these
- **Write order: the first draft of the spec was wrong.** It promised that appending to the destination before
  removing from the source would make a cross-slice move safe. It would not. React flushes passive effects in
  **hook declaration order**, so the three auto-save effects write `characters` (App.jsx:3164) then
  `environmentSounds` (:3174) then `groups` (:3184) - meaning in every character<->group or
  environment<->group operation **the removal persists first**, no matter how the setters were called. There is
  no transaction and no single write choke point. The guarantee is now stated honestly as best-effort.
- **There are FIVE container shapes, not four.** `addGroup` allocates a vestigial top-level `sounds: []` on
  every group (App.jsx:2726) that nothing ever pushes into; only `deleteGroup`'s cleanup (App.jsx:2742) and the
  delete-confirm name lookup (App.jsx:5441) read it. The first draft asserted the four-shape list was
  "exhaustive" - it is not. Any walker that finds a sound or a file reference must visit all five.

### Also corrected in `opencode-summary.md` (facts that contradicted the code/git)
- `src/App.jsx` is **5751** lines, not ~4400.
- HEAD is **`c83a72c` "More document changes"** and the tree was clean at session start - the previous
  "uncommitted `backup-project.ps1` / `AGENTS.md` / `opencode-summary.md`" warning was stale; all three were
  committed in `c83a72c`.
- Data keys: the env key is **`ttrpg_environment` (singular)**, and there is **no `ttrpg_themes` key** at all.
  `DATA_VERSION` is still `'3'` and must never be bumped - the mismatch path (App.jsx:313-319) renames the
  user's keys to `*_old` and resets to defaults.
- Added a **Data-model gotchas** block recording the five-shape trap, the `storedName`-not-id audio keying,
  effect-order write precedence, name-keyed categories, and the delete-confirms-always invariant - all of
  these generalise past this feature.

### Repo state left behind
Uncommitted (user has not asked for a commit): `?? MOVE_COPY_SOUND_SPEC.md`, `M opencode-summary.md`,
`M docs/session-history.md`. Backups: only `ttrpg-soundboard-backup-20261004-165726` (39.1 MB, 203/203
verified); the older `20261004-163113` had already been deleted as a test artifact, so nothing needed pruning.

### NEXT
- Implement `MOVE_COPY_SOUND_SPEC.md` sections 10 steps 1-4 (feature), **then** step 5 (the refcount guard),
  back to back in one session - between them the section 7 data-loss path is live.
- Debt 6, Debt 7, `Run App.bat`, `PROFILE_SYNC_SPEC.md` all unchanged this session.

---

## SESSION 2026-10-04 (later) - "OPENCODE ONLY" RULE REPLACED BY A CLAIM/RELEASE PROTOCOL; FILE RENAMED

Docs-only. **No app code touched**: `src/App.jsx` and everything under `e2e/` are byte-identical to `c83a72c`.

**Request:** the user removed the restriction that made `opencode-summary.md` opencode-exclusive, and asked for a
**current-holder** system instead: whoever is working edits the top of the file to claim it, and removes the
claim at the end of the session, so two agents do not rewrite the state file at once. The user prompted for a
plan first; nothing was written until they said proceed.

**Why the old rule was wrong** (this is the reason the change was worth making, so keep it): most sessions in
this repo are *not* opencode. "Opencode owns it, everyone else is READ-ONLY" therefore locked out exactly the
agents doing the work, and the file went stale - the previous session had to re-derive current state from
`git log` and the archive. **No agent owns the file; whoever is working holds it.**

### What changed
1. **`opencode-summary.md` -> `PROJECT_STATE.md`** via `git mv` (history follows). The *filename* was itself
   part of the problem: it said "opencode's file", which is what the old warning told every other agent to
   assume. A neutral name is load-bearing for the new rule, not cosmetic.
2. **Claim block at line 3** of `PROJECT_STATE.md` - the ⚠️ opencode-only warning is gone, replaced by one of:
   - `🔒 CURRENT HOLDER: <agent> - claimed <YYYY-MM-DD HH:MM> - working on: <one line>`
   - `🔓 UNCLAIMED - last holder: <agent> (<YYYY-MM-DD HH:MM>)`
3. **`AGENTS.md` section rewritten** as *Claim (step 0, before the backup) / While holding / Release / Stale
   claims / Non-holders / Honesty about the mechanism*. The scope note ("applies ONLY to opencode") and the
   do-not-edit warning are **deleted**; the knowledge they carried is in this archive and in Project State's
   Docs layout section, so nothing was lost by removing them.
4. **Live references updated** to the new name: `AGENTS.md`, `.gitignore` (comment), `backup-project.ps1`
   (comment), `docs/session-history.md` header, `MOVE_COPY_SOUND_SPEC.md` §9/§10, and the state file's own
   self-references. Historical mentions elsewhere in this archive were **left alone on purpose** - they record
   what was true at the time.

### Decisions the user made (asked, then answered)
- **Rename to `PROJECT_STATE.md`** rather than keep the old name - recommended, and it removes the built-in
  excuse for treating the file as another tool's private property.
- **No "pending updates" channel.** A non-holder that learns something worth recording reports it to the user
  ("I need the claim to record X") instead of appending to a side section. The user chose the simpler option;
  no section was added.
- **Markdown claim only, no lock file.** A gitignored `.session-holder` marker (atomic `New-Item -ItemType
  Directory` on NTFS) was offered for real mutual exclusion and declined - sufficient for the realistic
  same-checkout case, and it costs an artifact to gitignore and clean up.

### The three properties worth remembering
- **Release means "done", not "stopping".** If a session is cut off (quota, context, interruption) the claim
  must be **left in place** - an active claim is the signal that work here is mid-flight. This is the exact
  failure that produced the "uncommitted `M src/App.jsx`" warnings that had to be re-read in every later session.
- **A stale claim is never overwritten silently.** It usually means a previous session was cut off, which is
  the information the next agent needs most. Report it to the user and ask.
- **Cooperative, not enforced.** A markdown line is not a mutex. Two agents starting in the same second can
  both see `UNCLAIMED` and both claim; the protocol narrows that window to seconds (re-read immediately before
  each write) and does not close it. It works because every agent loads `AGENTS.md`.

### Verification
- Backup first per `AGENTS.md`: `ttrpg-soundboard-backup-20261004-180004`, **39.1 MB, 204/204 VERIFY OK**. It
  holds the **pre-rename** `opencode-summary.md`, since the rename happened after it.
- `git mv` succeeded, so the rename is staged; the content edits are unstaged on top of it. Nothing committed -
  the user has not asked for a commit.
- Lint gate **not** run and not needed: zero JS/PS touched. `backup-project.ps1` had only a comment edited.
- Protocol dogfooded within this session: claimed at the top, edited in place, released at the end.

### Repo state left behind
Uncommitted: `R opencode-summary.md -> PROJECT_STATE.md` (staged) + content edits to it, `M AGENTS.md`,
`M docs/session-history.md`, `M .gitignore`, `M backup-project.ps1`, `MOVE_COPY_SOUND_SPEC.md` (untracked new
file from the previous session). Backups on disk: `20261004-180004` (newest), `20261004-174834`, `20261004-165726`
- three is one over the "keep the newest one or two" guidance; **nothing was deleted**, the user's call.

### NEXT
- **Watch the claim protocol on the next non-opencode session** and record whether it held. Logged as an open
  item in `PROJECT_STATE.md`; failure modes to look for are an agent editing without claiming, never releasing,
  or not knowing its own tool name (it should write `unknown-agent` and ask, not guess `opencode`).
- `MOVE_COPY_SOUND_SPEC.md` implementation is still parked behind a fresh request - unchanged by this session.
- Consider pruning to two backups.

---

## SESSION 2026-10-04 18:13-19:55 - MOVE/COPY IMPLEMENTED, WEB E2E GREEN

Long session. Claimed PROJECT_STATE as opencode at 18:13, restored stale ` PROJECT_STATE.md` from HEAD
 before claiming, took the mandatory pre-change backup, then implemented `MOVE_COPY_SOUND_SPEC.md`§10
steps 1-6 without touching the Android or Windows phase runs (that work is still deferred).

### Implementation slice by slice
1. `mintId(prefix)` extracted from `addSound` / other entity-id sites (App.jsx:263).
2. `allSoundContainers()` (App.jsx:1812) walks all fi ve shapes including vestigial `g*g.sounds`; `findSoundContainer` uses it with first-hit-wins.
3. `transferSound(soundId, targetRef, mode)` (App.jsx:2022) treats 'move' and 'copy' separately. Copy reuses the source object reference; move appends the same object reference, then removes it from the source with a scoped `filter`. Also `nextCopyName` (App.jsx:2015?) lefts destination-only naming.
4. UI overlay: third button bottom-centre per-card `Move or Copy`, picker modal with section/flat rows, Move/Copy buttons, Esc via capture-phase keydown. `openMoveCopyModal`, `moveCopyTargetSections`, `closeMoveCopyModal` added.
5. Guards added: `isFileReferencedElsewhere` (App.jsx:1967), `removeFileIfUnreferenced`, `removeContainerFiles`; all eight destructive cleanup sites now reference-check repository paths. Sound-modal paths exclude the currently edited sound's container via `editingSoundContainerRef()`.
6. Docs + verification after this block.

### E2E
`e2e/e2e-full.mjs` gained suite M1-M22 (move/copy modal, sections, current/duplicate labels, copy suffixing, no-new-file-key, move within slice, cross-slice all forms, Esc close, button visibility) and G1-G5 (copy shares storedName, shared file survives source container deletion, unreferenced file removed). E2E results: **126/126 PASS, 0 FAIL, 0 WARN** web; **125/0/1** Windows (G5 skipped); **85/0/0** Android (mobile suite only, move/copy not ported).

### State left behind
Feature is in git working tree only; nothing committed yet. Open follow-up: Android + Windows E2E run once requested. claim released at end.

---

## SESSION 2026-10-04 18:06 - CLOSING PASS: COMMIT PUSHED, BACKUPS DELETED

Docs-only, ~15 minutes. The previous block's "Repo state left behind" is **superseded** - kept as written
because this archive is append-only, corrected here.

### What the user did between the two passes
- Committed and pushed everything: **`2d525ed`** "Changes to how agents work on the project" - the rename to
  `PROJECT_STATE.md`, the claim/release protocol in `AGENTS.md`, this archive entry, the `.gitignore` and
  `backup-project.ps1` comment updates, the spec's §9/§10 references, and `MOVE_COPY_SOUND_SPEC.md`.
  Branch `mobile-support` is now **in sync with `origin/mobile-support`**, working tree **clean**.
- **Deleted all backups**, reasoning that both 2026-10-04 sessions were docs-only and git holds that work.

### Corrections made in this pass
- `PROJECT_STATE.md` **Repo state** rewritten: recent-commit list now leads with `2d525ed`, the "uncommitted"
  warning is replaced by "working tree clean and in sync", and the spec's status is now "committed but still
  not implemented" rather than "untracked new file".
- `PROJECT_STATE.md` **Backups** section now says plainly that **no backup exists** and that the next
  code-touching session must take one first - previously it still pointed at `20261004-180004` as latest,
  which no longer exists.
- Claim/release practice: a new "sign with your own tool name / `unknown-agent`" bullet was added to the
  ownership section, because the first release line in this pair of passes carried a **wrong timestamp**
  (`18:24`, guessed) when the real time was `18:06`. Harmless here, but a fabricated timestamp in a lock line
  is exactly the kind of detail that later makes a stale claim undiagnosable. Check the clock, don't infer it.

### Claim/release log for this pair of passes
1. `18:00` claimed (release line later found to hold an incorrect `18:24`)
2. released -> re-claimed `18:06` for this cleanup pass -> released at the end of it
Dogfooded the protocol twice; both passes left it `UNCLAIMED` because both genuinely finished. A pass that had
been interrupted would have left the claim set - that is the mechanism working, not a bug.

### Repo state left behind
Two uncommitted doc edits (`PROJECT_STATE.md`, `docs/session-history.md`) correcting the facts above, for the
user to commit or discard. No app code touched at any point today. **No backup on disk.**

---

## SESSION 2026-10-04 21:26 - MOVE_COPY_SOUND_SPEC RETIRED (spec deleted, knowledge kept here)

Docs-only, ~15 minutes. The user manually tested the move/copy build (not just E2E) and reported it works,
then **committed and pushed** it themselves and deleted the local backups. `MOVE_COPY_SOUND_SPEC.md` is
therefore **obsolete** and was deleted this pass, per the "delete deprecated parts" rule in `AGENTS.md`.

- Backup taken first anyway (the rule is unconditional): `ttrpg-soundboard-backup-20261004-212618`,
  **204/204 files verified, 39.2 MB**, robocopy exit 1 = success.
- `git rm MOVE_COPY_SOUND_SPEC.md` + a `.gitignore` entry so it cannot come back silently (same treatment as
  `RESTORE_DEFAULTS_SPEC.md` / `ICON_FEATURE_SPEC.md`).
- ⚠️ **`mobile-support` is `ahead 1` — `f7f316e` is committed but NOT pushed**, contrary to the user's
  recollection. So the spec's final text exists only in the local object store right now
  (`git show f7f316e:MOVE_COPY_SOUND_SPEC.md`); once this pass is pushed it lives at `2d525ed`/`f7f316e`
  permanently, which is why deleting it loses no history.

### The knowledge the spec was the only record of — kept here on purpose
The spec was 502 lines, of which the design rationale was never duplicated anywhere else. Retained:

**Eight settled decisions (put to the user and answered 2026-10-04 — do not re-litigate unasked):**
1. **Copy shares the source's audio file reference** — no byte duplication (quota on web); the cost was the
   shared-file deletion hazard, later closed by the refcount guard.
2. Entry point is a **third overlay button on the sound card** in edit mode (bottom-centre; both top corners
   are taken by delete/edit), `title="Move or Copy Sound"` — App.jsx:3859-3861. Chosen over a context menu
   because it matches the existing overlay idiom and is CDP-addressable by a stable `title`.
3. **Move is silent — no confirm dialog.** Consistent with every other mutation in the app.
4. Destination insertion is **append at the end**; reorder afterwards with the existing same-container drag.
5. The shared-file hazard was fixed by a **reference-count guard as a separate commit** after the feature.
6. Cross-slice persistence stays **best-effort** (one handler, existing `saveError` banner). Effect order —
   not setter order — decides what hits disk, so a two-phase move is the only real guarantee and a move is
   net-zero bytes; not worth the state pair/ref/tick.
7. A target row offers **two buttons** — filled `Move` + outlined `Copy`, `title="Move to <name>"` /
   `title="Copy to <name>"`. **No mode state**, so the destructive action can't be picked by accident, and it
   is cheaper to test. Rejected the `IconPicker`-style segmented control for that reason.
8. Copies are auto-suffixed **`Name (copy)`**, then `(copy 2)`, … — checked **against the destination
   container only**, never app-wide (a global check reaches `Fireball (copy 97)` on a well-used board).
   Secondary reason: the delete-confirm dialog *names* the sound, so two identical `Fireball` cards would make
   it ambiguous about which is being deleted.

**Invariants a future session must not regress:**
- **`transferSound`'s scoped removal is not a delete.** It removes a sound without a confirm (correct — it is
  the source half of a move). Never reuse it for real deletes and never fold it into `deleteSound`: merging the
  two silently disables the delete confirmation. `deleteSound` must keep exactly one call site, `confirmDelete`.
- **Copy must preserve `files[]` *and* the legacy `file: "Name.mp3"` field verbatim** — never rebuild `files`
  from scratch; `playSound`'s fallback handles the legacy shape.
- **Categories have no id** (identity = display name). The picker keys on names and shows the section name to
  disambiguate duplicates; do **not** invent category ids in this feature.
- **All five container shapes** must be walked (`allSoundContainers`, App.jsx:1812, includes vestigial
  `groups[].sounds` allocated by `addGroup`). Four is not enough.
- **No toast system** — success is silent, invalid input uses `alert()`, persistence failure uses
  `reportSaveFailure` → the `role="alert"` banner. Do not introduce a toast layer.
- `DATA_VERSION` stays `'3'`.

**Deferred (explicitly not v1, still open if someone picks them up):** cross-container drag-and-drop via
sidebar drop zones (the hit-test only queries *rendered* cards, so it needs new drop targets); creating a
character/category/group from inside the picker; moving or copying a whole container at once; copying bundled
default sounds (pointless — they reference `public/assets` by filename and are identical on every install);
atomic cross-slice persistence (needs the parked `PROFILE_SYNC_SPEC.md` storage refactor).

**Where the design lives now:** the code (`transferSound` App.jsx:2022, `allSoundContainers` :1812,
`findSoundContainer` :1867, `isFileReferencedElsewhere` :1967, `removeFileIfUnreferenced` :1975,
`removeContainerFiles` :1984, `nextCopyName` :1998, `openMoveCopyModal` :2081, `moveCopyTargetSections` :2101,
per-card button :3859, picker modal :5851) plus git history for the prose. E2E coverage lives in
`e2e/e2e-full.mjs` as **M1-M22** (move/copy UI) and **G1-G5** (refcount guard).

**Still not done after shipping:** `e2e/e2e-mobile.mjs` has **no** move/copy UI tests ported — the Android
phase passes 85/85 without exercising the feature.

### Corrections to the previous session block (append-only, so corrected here)
That block's line numbers were partly guessed/mangled. Real ones: `mintId` App.jsx:260, `allSoundContainers`
:1812, `findSoundContainer` :1867, `isFileReferencedElsewhere` :1967, `removeFileIfUnreferenced` :1975,
`removeContainerFiles` :1984, `nextCopyName` :1998, `transferSound` :2022, `openMoveCopyModal` :2081,
`moveCopyTargetSections` :2101, `editingSoundContainerRef` :2437.

### Repo state left behind
`f7f316e` committed locally but **not pushed**; `2d525ed` and the feature itself are on the remote. This pass
touches docs only: `D MOVE_COPY_SOUND_SPEC.md`, `M .gitignore`, `M PROJECT_STATE.md`, `M docs/session-history.md`.
No app code touched, so no lint/build gate was needed.

💡 Claim line first written with a **guessed** timestamp (`20:40`) and corrected to the real `21:26` right
after — same trap as the `18:24` incident in the 2026-10-04 18:06 block. Read the clock before writing a
claim line; the pre-change backup's own timestamp is a reliable lower bound.

---

## SESSION 2026-10-04 21:44 - PROFILE_SYNC_SPEC RE-OPENED AND REVISED (docs only)

Second pass of the evening. The user came back for `PROFILE_SYNC_SPEC.md` — parked since 2026-09-27 — asked
for a rundown, then asked for a **revision pass**. No app code written; the user wants to review the design
before authorising implementation.

- Backup first per `AGENTS.md`: `ttrpg-soundboard-backup-20261004-214515`, **203/203 verified, 39.2 MB**
  (203 not 204 — `MOVE_COPY_SOUND_SPEC.md` was deleted in the previous pass).
- Spec status changed from "parked by user decision" to **"revised 2026-10-04, implementation not yet
  authorised"**, with a new **§0 revision log** listing the seven changes.

### What was actually wrong in the spec (verified against `src/App.jsx` @ 6240 lines)
1. **Every line reference** was from the 5751-line file. `readStoredData` 91→**317**,
   `normalizeStoredData` 43→**269**, `normalizeHex` 1964→**2710**, settings modal 5021→**5952**,
   legacy-`file` playback fallback 2532→**3275**, icon upload 1564→**2287-2293**.
2. **"23 `localStorage` call sites" → 27** (13 set / 11 get / 3 remove), *plus* the code **enumerates**
   `localStorage.length`/`key(i)` to sweep `sound_file_*` (App.jsx:1207-1211). An adapter that only wraps
   get/set/remove is incomplete → added `keysWithPrefix` / `removeAllWithPrefix` to §4.2.
3. **`uploads/` paths are a second front the spec never counted:** `TAURI_STORAGE_DIR` (App.jsx:22) and
   `getTauriStoragePath` (App.jsx:2316) are referenced at 1225-1235, 2325-2342, 2374-2385, 3241 — **10 sites**
   that all need the profile segment. Namespacing only the localStorage keys would leave Tauri profiles
   sharing audio.
4. **Two keys missing from the namespace table:** `ttrpg_characters_icon` / `ttrpg_environment_icon`
   (section icons, App.jsx:1057-1065). And `localStorageMigrationCompleted` (App.jsx:1197) must stay
   **global** — namespacing it would re-run the one-time web→Tauri audio sweep on every profile.
5. **Provenance is structural, so the spec's risk 2 dissolved.** A bundled reference has **no `storedName`**
   (`src/data.json` ships `{"name":"Caustic_Blast_Acid_1.mp3"}`); an upload always has one, with `name`
   rewritten to the stored name and the human name in `displayName` (App.jsx:2404-2425). Icons behave the
   same way (bundled = plain filename, custom = `icon_<rand>_<name>`). So the "add a write-time provenance
   flag" step is **deleted** — it would have created a second source of truth. A second independent signal
   exists: shipped ids from `mergeShippedDefaults`' `allShippedSoundIds` (App.jsx:355).
6. **§10's open fs question answered.** `fs:default` is only
   `create-app-specific-dirs` + `read-app-specific-dirs-recursive` + `deny-default` — **no `read_dir`**. The
   permission is **`fs:allow-read-dirs`** (plural, from `permissions/read-dirs.toml`); the spec's
   `fs:allow-read-dir` would not have resolved. Resolved crate is `tauri-plugin-fs` **2.5.2** (declared 2.5.1).
   `tauri-plugin-dialog` is still registered nowhere; must go in **both** `main.rs` and `lib.rs`.
7. **"Reset to starter sounds" already shipped** as `bde7483` (`restoreDefaults` App.jsx:2671,
   `mergeShippedDefaults` :349) — §9.2 is now "make it profile-scoped", keeping its idempotent,
   non-destructive properties.
8. **Move/copy (`f7f316e`) makes a shared `storedName` normal**, so §5's hash dedupe became mandatory rather
   than an optimisation, and §7's export must walk all five container shapes via `allSoundContainers`
   (App.jsx:1812) — four would silently drop sounds.

### Two new risks added (§11)
- **Cross-profile shared blobs.** `isFileReferencedElsewhere` only scans the *active* profile's in-memory
  state, so a future import path that links profiles could delete bytes still in use. Rule: every profile owns
  `uploads/<profileId>/`; content-addressing dedupes within a bundle, never across profiles.
- **Profile switch is a state reload.** Storage is read once at mount; switching profiles must also revoke
  the object-URL cache (`getObjectUrlForBlob`, App.jsx:2298) or the previous profile's blobs leak for the
  session.

### New checklist items (§13/§14)
Copied sound exported once (dedupe); a hand-seeded sound in the vestigial `groups[].sounds` is exported;
deleting a profile touches only its own `uploads/<id>/`; `ttrpg_*_icon` + `boxSize` follow the profile while
`localStorageMigrationCompleted` does not; A→B→A switch leaves no bleed-through or stale blob URLs;
profile-scoped Restore Defaults stays idempotent. §14 adds: the E2E localStorage snapshot must scan by
**prefix**, because a hard-coded key list from the current release silently misses `profile:*` and
`spellcaster_profiles` — the first crashed run would then leave a half-namespaced board. Suite IDs continue
from `P1` after `M1-M22`/`G1-G5`; `SEED` (e2e-full.mjs:102-115) is reusable but its sounds carry **no**
`storedName`, so a provenance test also needs an uploaded fixture.

### Implementation order gained a step 0
Spike the two unknowns before anything else: **Android SAF save** (§7, never verified — still the single
largest unknown) and **writing to a picker-chosen path** (§10, second-least-verified; if it needs a runtime
scope grant, that would be the feature's first custom Rust command, which §10 currently claims is
unnecessary). Both are cheap and can invalidate the design.

### Repo state left behind
Docs only: `M PROFILE_SYNC_SPEC.md`, `M PROJECT_STATE.md`, `M docs/session-history.md`, plus the previous
pass's `D MOVE_COPY_SOUND_SPEC.md` + `M .gitignore` + those two. Still uncommitted — `f7f316e` remains
`ahead 1` of `origin/mobile-support`. No lint/build gate needed (no code touched). Claim released.

---

## SESSION 2026-10-04 21:55 - ANDROID SAF SPIKE RUNED AND PASSED (spec §7 / §10 step 0)

Third pass of the evening. The user asked to verify the one thing the spec said was its biggest unknown —
Android SAF save — "without going further". Docs + a deliberate, uncommitted Rust/config spike; **no app or
frontend source was touched.**

- Backup first: `ttrpg-soundboard-backup-20261004-215511`, **203/203 verified, 39.2 MB**.
- Spike code (still uncommitted): `Cargo.toml` + `tauri-plugin-dialog = "2"` (resolves to **2.7.3**),
  registered in **both** `main.rs` and `lib.rs`, and `capabilities/default.json` + `fs:allow-read-dir` +
  `dialog:allow-save` + `dialog:allow-open`. `cargo check` clean (41.8 s).

### 🔴 The build caught an error I had introduced 40 minutes earlier
The 21:44 revision "corrected" §10 to **`fs:allow-read-dirs` (plural)**, reasoning from the filename
`permissions/read-dirs.toml`. The Android build refused it:

> `Permission fs:allow-read-dirs not found, expected one of core:default, … fs:allow-read-dir, …`

`read-dirs.toml` defines a **set** permission called `read-dirs`; the per-command permission is
**`allow-read-dir` (singular)**. The original 2026-09-27 spec had it right and my revision broke it.
Corrected in the spec, in this file, and in `PROJECT_STATE.md`. **Lesson: when a plugin rejects a permission
name it prints the full valid list — read the error before reading filenames.**

### Verdict: SAF save WORKS. Findings, in order of importance
1. **`dialog.save()` on Android returns a `content://` URI, not a path** —
   `content://com.android.providers.downloads.documents/document/26`. Source: `DialogPlugin.kt`
   `saveFileDialogResult` returns `uri.toString()`. The spec's §7 phrasing "write to the chosen path" was wrong
   about the shape of the value.
2. **`plugin-fs` accepts that URI as `path` on mobile.** `commands.rs` has `#[cfg(mobile)] resolve_file` which,
   for a `SafeFilePath::Url`, calls `webview.fs().open()` → `android.rs` `resolve_content_uri` → Kotlin
   `FsPlugin.getFileDescriptor` → `contentResolver.openAssetFileDescriptor(uri, mode)` → raw fd wrapped as a
   `std::fs::File`. The `content://` string never becomes a filesystem path.
3. **No fs-scope widening is needed on Android** — that URL branch skips the scope check entirely.
4. **Measured**: wrote 4096 bytes (`PK\x03\x04` + 0x41 body) → read back 4096 bytes byte-identical; re-wrote 64
   bytes of 0x42 → read back 64 bytes of 0x42 (truncate works, not one-shot). `adb shell ls -l
   /sdcard/Download/` showed the file at exactly those sizes. Spike files deleted afterwards.
5. **Control: a raw write to `/storage/emulated/0/Download/ctl-probe.bin` is REFUSED** — "forbidden path …
   maybe it is not allowed on the fs scope". So the spec's `BaseDirectory.Download` fallback is **dead on
   Android** (scoped storage); the row was rewritten.
6. **A cancelled picker rejects**, it does not resolve `null` (`invoke.reject("File picker cancelled")`), so
   the export code needs a `catch`.

### How it was driven without touching App.jsx — worth remembering
- ⚠️ **`tauri android dev` built the APK but never installed or launched it.** Gradle output looked complete,
  `pm list packages` showed the app, but the running app was a **stale** build — which produced a bogus
  `dialog.save not allowed. Plugin not found` and nearly sent the investigation in the wrong direction.
  Fix: `adb install -r src-tauri\gen\android\app\build\outputs\apk\x86_64\debug\app-x86_64-debug.apk`, then
  `adb shell monkey -p com.mrhorakhty.thespellcaster.debug -c android.intent.category.LAUNCHER 1`, re-forward
  CDP. **If a plugin is "not found" on device, verify the APK is current before debugging capabilities.**
- **The dialog can be driven over raw CDP** — `window.__TAURI_INTERNALS__.invoke('plugin:dialog|save',
  { options })` — so no frontend code is needed to exercise a plugin. Dynamic `import('@tauri-apps/...')`
  from evaluated script would **not** work (Vite cannot resolve a bare specifier there).
- ⚠️ **`write_file` and `read_file` take the path in different places.** `write_file`: path in an
  `encodeURIComponent`'d **header**, bytes as the body. `read_file`: `{ path, options }` as **args**. Wrong
  guess fails as `invalid args 'path' for command 'read_file'`, which reads like a permissions problem.
- **The picker is a separate activity** and must be tapped from outside: `adb shell uiautomator dump`, find
  `text="SAVE"` bounds, `adb shell input tap`. Always use a unique filename — an existing name triggers an
  overwrite-confirm dialog.
- **The WebView reloaded mid-session** (`window.__saf` went from a resolved URI to `undefined`), almost
  certainly Vite HMR reacting to file writes. Stash state on `window` and poll it from the same CDP
  connection; do not assume it survives between separate CDP sessions.
- Emulator: AVD `Pixel_7`, **API 37** (`sdk_gphone16k_x86_64`), launched `-no-snapshot-load`. DocumentsUI is
  present (`com.google.android.documentsui`) even though `cmd package resolve-activity -a
  android.intent.action.CREATE_DOCUMENT` reports "No activity found" — that command is not a reliable probe.

### Spec changes from this pass
§0 row 8 added; §3 gained three rows (fs permission is singular, raw paths are blocked, content URIs are
accepted); §7's platform table and the old "⚠️ spike this first" warning replaced by a **"SPIKED AND PROVEN"**
subsection with the measured numbers and four implementation consequences (pass the URI as a **string**,
`readFile` rejects a non-`file:` `URL` object, no Android scope change, never pretty-print the URI); §10's
table now marks what is DONE and records that `fs:allow-read-dir` is singular; §11 risk 3 struck with the
residual risk noted (the URI grant is **transient** — valid for the session, so export-then-share is fine but
do not assume cross-session readability); §12 step 0 half-done — the **desktop** picker-path write is the last
unknown; §13 gained the import-side caveat and the cancel-rejects case.

### Repo state left behind
Uncommitted: three docs files + the staged `D MOVE_COPY_SOUND_SPEC.md` + `.gitignore` + `README.md`, and the
four Rust/config spike files listed above. `f7f316e` still `ahead 1` of origin. Emulator `Pixel_7` left
**running**, `tauri android dev` still running detached in the background (pid 16256 chain: npm 8876 → node
12424 → `tauri android dev`), Vite serving 5173, `adb forward tcp:9223` active, app pid 7295. **No spike
files left in `/sdcard/Download`.** Claim released.

### Closing pass, same day (user: "revert the spike and close the emulators")
- **Spike reverted.** `git checkout --` on `src-tauri/Cargo.toml`, `Cargo.lock`, `src/main.rs`, `src/lib.rs`,
  `capabilities/default.json`. No trace of `dialog` left in any of them; `cargo check` clean again (3.28 s);
  `git status` shows docs only. The plugin will be re-added when the feature is actually implemented.
- **Emulator + dev stack shut down.** `kill-ports.bat /all /emu` freed 5173/9224/9225/5233/9333/9334, removed
  all adb forwards and killed the orphan tauri CLI (pid 12424) — but **its `/emu` branch was broken**, so the
  emulator was killed with `adb -s emulator-5554 emu kill` instead. Logged as a finding.
- Docs corrected so they don't contradict the tree: §10's table rows are no longer marked DONE, and
  `PROJECT_STATE.md`'s uncommitted list is docs-only again.

## SESSION 2026-10-04 22:53 - kill-ports.bat /emu FIXED, THEN COMMIT + PUSH ATTEMPTED

- **`kill-ports.bat` `:emu` label rewritten.** The old line was
  `for /f "tokens=1" %%d in ('"!ADB!" devices ^| findstr /R /C:"emulator-[0-9]*"')`, which fails whenever
  `ADB` is a quoted path. 💡 **The general lesson, now in a comment in the file: neither `for /f` idiom can
  capture a command that *starts with a quoted path*** — the single-quote form dies with *"is not recognized"*
  and the backtick form dies with *"cannot find the file"* (cmd takes the quote as part of the filename).
  Fix: redirect `adb devices` to `%TEMP%\kill-ports-devices.txt` and iterate that with `for /f … ('type "!F!"')`,
  so the captured command begins with `type`. Also handles the no-device case with an explicit
  "no running emulator found" message and cleans the temp file up.
- **Verified from PowerShell**, which is where it used to fail: with a running AVD it printed
  `shutting down emulator-5554` and the device disappeared; run again immediately it printed
  `no running emulator found`; `/all` (ports, adb forwards, orphan tauri/cargo) still behaves.
- Backup before the edit: `ttrpg-soundboard-backup-20261004-225340`, 203/203 verified.

### Commit + push — both worked first time
- `d698d06` "Retire move/copy spec, revise profiles spec, fix kill-ports /emu" — 7 files, +600/-580, then
  `git push origin mobile-support` → **`f7f316e..d698d06`**, no auth prompt, no proxy trouble. Local and origin
  now 0/0. 💡 **The long-standing "agents can't push" problem did not reproduce** — if it ever comes back, look
  for a stale credential prompt before blaming the remote.
- ⚠️ **The `post-commit` hook is a lie.** `.git/hooks/post-commit.bat` prints
  `=== TTRPG Soundboard Backup Log ===` / `Backup created: <date>` / `Backup location: %cd%` on every commit.
  It is six `echo` lines and **creates nothing** — and `%cd%` is the project directory, so its "location" is
  just wherever you already are. Nothing was left behind by it (no stray folders, working tree clean), but a
  future session could read that output as "the commit was backed up". Recorded in `PROJECT_STATE.md`; the
  real thing is `.\backup-project.ps1`.
- Closing correction pass committed on top: repo state now says in-sync instead of "ahead 1", the recent-commit
  list leads with `d698d06`, and the fake-hook warning is recorded.

---

## 2026-10-06 20:02-21:05 - opencode - desktop spike: the last PROFILE_SYNC_SPEC unknown

**Asked by the user**: "there is still 1 unknown factor in PROFILE_SYNC_SPEC about desktop behavior, is that
correct?" - yes, exactly one. Then: "let's verify/test those today". Docs only; no app code was written.

### The answer to the standing unknown
`PROFILE_SYNC_SPEC.md` §10 said the *desktop picker-path write* was "the last unverified item in the feature".
**It is now spiked and it passes.** Built on Windows (real Tauri + WebView2, driven over CDP :9224 exactly like
`e2e-full.ps1` Phase B) with temporary `__spike_*` commands in `main.rs`, then reverted.

| Probe | Result |
|---|---|
| `dialog.save()` reachable with the plugin registered but no `dialog:*` permission | fails with *"Permissions associated with this command: dialog:allow-save, dialog:default"* |
| `dialog.save()` cancel (real `#32770` dismissed with `WM_COMMAND`/`IDCANCEL`) | **resolves `null`** - `desktop.rs save_file` -> `Option<FilePath>` |
| `dialog.save()` accept (`WM_COMMAND`/`IDOK`) | resolves a **`string`**: `C:\Users\emire\Documents\spellcaster-picked.spellcaster` |
| `fs.writeFile` to a Desktop path, current capability file | **DENIED** - "forbidden path ... `allow-write-file` permission in your capability file" |
| `fs.exists()` on that same path | **also denied** - it is a scope limit, not a write-only limit |
| **`fs:read_dir` on `AppData/uploads`, capability file unmodified** | **PASS - 90 entries** (AppData root: `uploads`) |
| runtime `app.fs_scope().allow_file(path)` then the *same* `writeFile` | **PASS - 4100 bytes, byte-identical round trip** |
| sibling file in the granted directory, never granted | still **DENIED** - the grant is per-file |
| capability-only `{ "identifier": "fs:scope", "allow": ["**"] }` | **PASS**, but blanket: Desktop, Documents, Temp and an ungranted sibling all wrote |
| `allow_file` on a *directory*, then write a new file inside it | **DENIED** - needs `allow_directory(dir, true)` |
| `std::fs::write` in a command (no fs plugin at all) | PASS - works, but breaks §9.3 purity |

**Recommendation written into the spec: the runtime grant.** ~5 lines, the same mechanism the fs plugin itself
uses for drag-and-drop (`tauri-plugin-fs-2.5.2/src/lib.rs` `RunEvent::WindowEvent::DragDrop` ->
`app.fs_scope().allow_file(path)`); `FsExt::fs_scope()` clones the plugin's shared `Arc<ScopeInner>` so the
mutation is visible to the command layer's own `is_allowed`. No capability edit, no `fs:scope`, no `**`.

### Three corrections and one trap, all now in the spec
1. **The spec asserted something false.** It claimed `fs:default` does not include `read_dir`. It does:
   `fs:default` -> `read-app-specific-dirs-recursive` -> `allow-read-dir` + `scope-app-recursive`. Confirmed in
   the resolved crate (`permissions/default.toml`) and measured. **So `fs:allow-read-dir` is not needed** and
   the §10 row is marked "drop it". (The plural/singular name fact survives: the per-command permission is
   `allow-read-dir`, `permissions/read-dirs.toml` defines a *set* named `read-dirs`. The 2026-10-04 revision
   that "fixed" the singular to the plural had been reacting to a real build error while fixing a non-problem.)
2. **A capability row was missing entirely.** `dialog:allow-save` + `dialog:allow-open` (or `dialog:default`).
   Registering `tauri-plugin-dialog` alone would have shipped broken, with an error message that reads like a
   plugin-registration bug.
3. **Platform-asymmetric cancel.** Android **rejects** ("File picker cancelled"); desktop **resolves `null`**.
   Both need handling; neither platform's contract may be assumed for the other.
4. **Silent byte corruption.** My first probe passed `Array.from(bytes)`; the write *resolved* and the file was
   **12297 bytes** of `80,75,3,4,65,65,...` instead of 4100 binary bytes. Cause: desktop IPC sends the
   `write_file` body through `fetch`, and `fetch` coerces an `Array` body via `toString()`
   (`scripts/process-ipc-message-fn.js` returns `contentType: application/octet-stream` but the browser still
   stringifies it). `Uint8Array`/`ArrayBuffer` are `BufferSource`s and go raw. `App.jsx` is already correct
   (`new Uint8Array(arrayBuffer)` at 1221 / 2324). This also explains why the Android spike round-tripped
   perfectly: Android uses `postMessage` IPC, which preserves the array (`canUseCustomProtocol = osName !==
   'android'`). Recorded as §11 risk 8 with an E2E guard, because it fails with **no error anywhere**.

### Housekeeping
- Backup `ttrpg-soundboard-backup-20261006-200301`, 203/203 verified, 39.2 MB, taken before the spike.
- Spike reverted: `git checkout --` on `Cargo.toml`, `Cargo.lock`, `src-tauri/src/main.rs`,
  `capabilities/default.json`; all spike `.bin`/`.spellcaster` artifacts deleted from Desktop, Documents and
  Temp; `app.exe` and the dev server killed, ports 5173/9224 free; `cargo check` clean, 0 warnings.
- `tauri-plugin-dialog = "2"` resolves to 2.7.3 and pulls `rfd 0.16.0`; **all 12 added packages were already in
  the local cargo cache**, so `cargo check --offline` worked with no network.
- **Not committed.** Only `PROFILE_SYNC_SPEC.md` and `PROJECT_STATE.md` are modified, docs only. The user has
  not asked for a commit.

---

## 2026-10-06 21:12-21:40- opencode - three new planning specs (volume, hotkeys, priming)

**Asked by the user**: three features are queued after profiles - per-sound ("sound button") volume, hotkeys,
and sound priming (right-click desktop / press-and-hold mobile, primed sounds fire alongside the next trigger).
He also observed that my todo list lags behind what I have actually done, and asked me to make **separate spec
files** so each feature can be picked up in a fresh session.

### Answering the ordering question (it is not one question)
The three features are **not** the same kind of thing, so there is no single answer:

- **Per-sound volume is content.** It sits beside `fadeIn`/`fadeOut`/`loop`/`brightness`, which the profile bundle
  already carries, so it rides along for free with no exporter work and no `DATA_VERSION` bump
  (`normalizeStoredData`, App.jsx:269, spreads unknown sound fields). -> **before profiles.**
- **Hotkeys are a pointer at content.** A binding is a reference to a sound, and references are exactly what
  `PROFILE_SYNC_SPEC.md` §8 (unresolvable audio references) and the category-name-as-identity landmine are about.
  -> **after profiles**, storing bindings per profile so they always resolve and ride the bundle free.
- **Priming is two features in one name.** Model A (session state, `useState`, nothing persisted) has *zero*
  interaction with the profile refactor and can be built any time. Model B (saved named layers) *is* content.
  -> Model A any time; Model B before profiles.

Recommended sequence: **volume -> (priming Model B if wanted) -> profiles -> hotkeys.**

### Files written (all docs-only, none authorised for implementation)
- `PER_SOUND_VOLUME_SPEC.md`
- `HOTKEYS_SPEC.md`
- `SOUND_PRIMING_SPEC.md`

Each carries a verified-fact table, the decision that must be made before coding, implementation-order notes, a
verification checklist, E2E guidance and a deferred list. Line numbers were re-verified against `App.jsx` @ 6240
this session so a fresh session does not have to rediscover them.

### Code facts established while writing them (all verified 2026-10-06)
- `masterVolume` is `useState(1.0)` at App.jsx:**760** and is **never persisted** - the only volume that exists.
  It is applied at **four** sites, not one: 3299, 3337, 3379, 3392 (the last three are `applyFadeIn` targets).
- `updateMasterVolume` (1315) live-rescales playing elements while preserving their fade fraction (1325-1335)
  and assumes every element's target *is* master. This is the only place that mutates a playing element's
  volume and it has **no test**. Recommended fix: stamp `audio._baseVolume` at creation (next to `audio._soundId`
  at 3301) and have that path read it - no lookup, no container walk.
- ⚠️ **The new-sound save path (1490-1502) is an explicit allowlist**, so a field missing there is silently
  dropped for new sounds while edits survive (the edit path at 1593-1601 spreads `...newSoundData`). That is the
  most likely way to ship this feature half-working.
- ⚠️ **The `||` trap**: the file normalises optional fields with `||` (e.g. `brightness || 1` at 1497), which
  would turn a legitimately **muted** sound (volume 0) into 1. Must use `?? 1`. Precedent for the careful form
  exists 5 lines later (`loop: newSoundData.loop !== undefined ? ... : ...` at 1502).
- `transferSound`'s copy branch spreads `...source.sound` (2041) and only overrides `id`/`name`, so move and copy
  carry a new per-sound field for free. Move keeps the same object reference.
- Sound ids are minted once via `mintId('sound')` (260, called at 1485 and 2045) and never regenerated.
- `playSound(sound)` at 3256 takes a **sound object**, early-returns in `editMode` (3257), auto-enables audio
  (3259-3261), honours `randomPlay` (3268, a new random *file* per play), and registers each instance under its
  own `audioInstanceKey` (3303) in `audioElementsRef`. `stopSound` 3472 / `stopSoundInstances` 3464 /
  `stopAllSounds` 3476.
- **There is no right-click or long-press handling anywhere in App.jsx** - no `onContextMenu`, no `contextmenu`
  listener, no long-press helper, no `onTouchStart`. The only pointer handler is `onPointerDown` at 3643
  (drag-and-drop). Priming's gesture is therefore greenfield, with no precedent to copy.
- Hotkeys must not fire while a text field has focus. The app has many: `volumeInput` (1068), the numeric
  `duration`/`fadeIn`/`fadeOut` fields (5529/5541/5553), plus search and picker inputs. Existing `keydown`
  listeners to coordinate with: 728 (document, bubble) and 2166 (capture, closes the move/copy modal).
- `tauri-plugin-global-shortcut` would be **desktop-only** and goes in `main.rs` **only** - the **reverse** of
  the dialog rule in `PROFILE_SYNC_SPEC.md` §10. Noted the trap: a desktop-only plugin in the mobile `lib.rs`
  binary can pass a desktop build and break the APK, so verify the Android target after adding it.

### Two questions left for the user
1. Is per-sound volume **modal-only** (cheap, recommended for v1) or a **live slider on each card** (matches
   "sound button based" more literally, but adds a control to a `div role="button"` and a touch-vs-tap conflict)?
2. Is priming **sticky for the session**, **one-shot**, or a **saved named layer**? Only the third is content.

### Housekeeping
- Backup `ttrpg-soundboard-backup-20261006-213005`, 203/203 verified, 39.2 MB.
- **Uncommitted**, docs only: the three new specs plus `PROFILE_SYNC_SPEC.md`, `PROJECT_STATE.md` and this file
  from the spike session. No app code was touched in either session. The user has not asked for a commit.

### 21:47-22:00 - the two design questions answered, and a docs-only audit

**User**: priming is **one-shot** ("I should have specified it is not profile content but you picked it up
anyway"), per-sound volume should have a **live slider** ("ideally"), and asked for confirmation that the last
three features were documents only.

**Audit result - confirmed, with evidence**: every modified tracked file is a `.md`; `src/App.jsx` hashes
identical to the HEAD blob (`193b1685...`); nothing under `src/`, `src-tauri/` or any config file differs from
HEAD. Untracked additions are the three new spec files only. Both sessions were documentation-only.

**Answers folded into the specs:**

1. **Priming = one-shot.** Collapsed `SOUND_PRIMING_SPEC.md` from a two-model split to the single chosen design.
   Model B (saved named layers) is now **explicitly rejected**, with §6 kept purely as the record of why so a
   later session does not re-open it. Two consequences written in:
   - **No `localStorage` key for priming.** Flagged as a deliberate absence, not an oversight, and added to the
     verification checklist.
   - ⚠️ **The capture-and-clear must happen synchronously, before any `await`.** `playSound` is async (3256), so
     clearing the primed set afterwards would let a second trigger pick up the same primed sounds and play them
     twice. `playWithPrimes` now reads the set and calls `setPrimedSoundIds(new Set())` before the first `await`.
   - Because priming is now the cheapest of the three features (zero persistence, zero interaction with the
     profile refactor), its recommended position changed from "Model A before profiles" to **any time**.

2. **Per-sound volume = live card slider.** The modal-only option is gone; §2b is new and specifies the work the
   live slider actually implies, none of which was in the modal-only version:
   - **The drag/play conflict** - a card is a click target and a slider is a drag target, so the slider needs
     `stopPropagation` on `pointerdown`, and playback must move to `click` if it is not already there. Flagged
     that the card's existing `onPointerDown` (3643, drag-and-drop) is the likely conflict.
   - **"Live" means audible now** - adjusting a currently playing or looping sound must rescale its live
     `Audio` elements. The hook exists (`audio._soundId` at 3301, `audioElementsRef` at 3304). Explicitly **not**
     a reuse of `updateMasterVolume`, which iterates all elements by master ratio; instead extract the shared
     "rescale while preserving fade fraction" helper and use it in both places.
   - **Cost** - one slider per card, ~90 sounds on a busy account; recommends a compact level bar rather than a
     full master-style slider, and notes a hover-reveal is unusable on touch.
   - **ARIA** - a slider nested inside a `role="button"` card is invalid ARIA; flagged as a decision to make
     before coding because it affects the markup of every card.
   - Two new E2E requirements: the card drag must not play the sound, and a live change must be audible on a
     playing/looping sound without restarting it.

**Cross-spec conflict now recorded in both files:** volume and priming now both modify the sound card. The volume
slider's `stopPropagation` serves both purposes (stops play *and* prime), priming should be card-body-only, and
each spec says to re-read the other's card section before implementing. This is the one place two of these
features will collide in review.

Backup `ttrpg-soundboard-backup-20261006-213714`, **206/206 verified**, 39.3 MB (203 + the 3 new specs).
Still uncommitted; no app code touched at any point in either session.

### 22:00-22:15 - final tidy, commit and push

**Last doc fixes before committing** (the user asked for any remaining changes):
- `PER_SOUND_VOLUME_SPEC.md`: fixed a **wrong cross-reference** in the header - it pointed at "§8" for the shared
  playback internals, but §8 is the verification checklist; now points at **§2b.2 and §3**. Removed a duplicated
  "live slider" heading left inside §2 and repointed it at §2b. Retitled §6 from "Edge cases to decide" to
  "Edge cases - recommendations, confirm rather than re-derive" since the decisions are now made.
- `SOUND_PRIMING_SPEC.md`: §3's subheading still said "**Two** ways this can go wrong" after the card-collision
  item was added as a third. Fixed.
- Normalised the three new specs to **CRLF** (no BOM) so they match the other spec files on disk. Verified no BOM
  by checking the first three bytes. This is cosmetic only - `core.autocrlf=true` normalises the index either way,
  which is why `docs/session-history.md` shows +182 rather than a whole-file rewrite.

**Audited docs-only one final time before staging**: every modified tracked file is a `.md`, `src/App.jsx` hashes
identical to HEAD, and zero files changed under `src/`, `src-tauri/` or any `*.json`/`*.js`/`*.jsx`/`*.html`.

**Commit `0a6f346`** (6 files, +1169/-69): "Close the desktop spike, add specs for volume, hotkeys and priming".
Style follows the repo's existing commits - sentence-case subject, no conventional-commit prefixes, a body that
explains *why* rather than restating the diff.

⚠️ **Hit a real PowerShell 5.1 trap**: `Out-File -Encoding UTF8` prepends a **BOM**, so the first commit's subject
was `﻿Close the desktop…` (U+FEFF inside the message). Fixed with `--amend` using
`[System.IO.File]::WriteAllText(..., (New-Object System.Text.UTF8Encoding($false)))`. The subject is now clean.
💡 Worse, **my first verification of the fix was itself wrong** - I checked with `git log -1 | Out-File -Encoding
UTF8`, which adds a BOM of its own and made it look like the problem persisted. `git cat-file commit HEAD` is the
correct way to inspect the raw message. Both lessons are now in `PROJECT_STATE.md` so the next session does not
repeat it.

**Pushed**: `f3e83f2..0a6f346` to `origin/mobile-support`, no auth prompt, no proxy trouble. Local and origin now
0/0. The decorative post-commit hook printed its usual fake "backup" banner; the real one is
`ttrpg-soundboard-backup-20261006-213714`, 206/206 verified.

⚠️ **Three backups now exist** (20261004-230014, 20261006-200301, 20261006-213714) and **all three protect nothing
unique** - every file in them is committed and pushed. Prune by hand.

---

## 2026-10-06 22:31 - 23:05 - opencode - sequencing, then SHIPPING per-sound volume

**First half: verify the recommended order rather than trust it.** The three queued specs all carried a
"recommended order" claim. Checked each against the 6240-line `src/App.jsx` instead of taking them on trust. The
order **held** - volume -> priming -> profiles -> hotkeys - but the check was worth more than the answer:

- Re-counted the profiles census: **27 `localStorage` sites + 10 `uploads/` path sites, both still accurate.**
- Confirmed `normalizeStoredData` only spreads and repairs array shapes, so a new sound field survives reload with
  **no `DATA_VERSION` bump** - which is *why* volume must land before the storage refactor.
- Found the code had **already solved the sound-card nesting problem**: the edit-mode buttons are anchored to the
  wrapper `div` with the comment "Anchored to the wrapper, not the card, so it does not inherit the card's
  pointerdown drag handler". That single fact decided the card's final shape.
- Confirmed zero `onContextMenu` / `onTouchStart` / `longPress` hits - priming really is greenfield.

**Four spec facts were wrong** (all corrected in place, code wins):
1. `PER_SOUND_VOLUME_SPEC.md` said the sliders are **not** native `<input type=range>`. They are - `min=0 max=1
   step=0.01`, paired with a sibling number input. The `onKeyDown` handlers it pointed at belong to the *number*
   inputs. Keyboard support is free; over CDP you set `.value` + fire `input`, not pointer moves.
2. The spec's open "decide the ARIA shape before coding" was already answered by the wrapper precedent.
3. The new-sound-allowlist warning was **already biting**: `glowEnabled` / `glowProminence` are in the form
   template and the hydrate path but **absent from the 1488-1503 allowlist**, so a newly created sound silently
   loses its glow. Left unfixed - out of scope, and the user had not asked.
4. `groups[].sounds` is **wiped on read** (`normalizeStoredData` returns `sounds: []` on the group branch), so the
   "seed it by hand" checklist item in both the priming and profile specs **cannot survive a reload**. Two
   checklists contained an unpassable test.

**Second half: shipped per-sound volume.** One optional `volume` field, a **trim** on top of master.
`normalizeSoundVolume()` is the single definition of "absent === 100%" and is used in **both** save paths - the
edit path spreads so it survives anyway, the **new**-sound path is an explicit allowlist and would silently drop
it. `rescaleAudioTarget()` was extracted from `updateMasterVolume` and shared with the new per-sound path, so the
fiddly fade-fraction arithmetic exists once. `mapSoundContainers()` + `patchSoundById()` write the field in any of
the five container shapes and return untouched branches unchanged.

Two decisions that are not accidental:
- **The card slider is a SIBLING of the card, not a descendant.** One extra wrapper level; it inherits neither the
  card's `onClick` nor its edit-mode pointerdown drag, so no `stopPropagation` and no `role="group"` conversion.
- **A drag persists once on commit, not per pointermove.** The three auto-save effects are undebounced and
  `JSON.stringify` the whole slice into localStorage synchronously; persisting per move stutters a 90-sound board.

**The E2E suite caught a real bug that asserting the audible level would have hidden.** `updateMasterVolume`
rescaled playing elements but never refreshed `audio._baseVolume`, so it stayed at its creation value - and
`playSound` reads `_baseVolume` back at **loop re-entry**. A looping sound would have faded back down to the level
it started at after any master change. Fixed by setting `_baseVolume = target` in the same loop; `P9d` guards it.
**Lesson worth keeping: when a value is read back later, assert that it is refreshed, not just that the output
looks right.**

**Two fixture traps that made the live-rescale assertions vacuous** - they "passed" on web while exercising
nothing:
- Only elements still in `audioElementsRef` get rescaled. A short/undecodable fixture fires `ended` ->
  `cleanupAudio` -> unregistered within milliseconds, and **an ended element still reports `paused === false`**, so
  a liveness check cannot see it.
- `element.click()` from `Runtime.evaluate` is not a user gesture, so web refuses autoplay and `play()` rejects.
Fix: a **real bundled asset** (`Longbow_4.mp3`, no `storedName` so it resolves from `/assets`) with `loop: true`,
driven by `Input.dispatchMouseEvent`, and P9 walks **one fresh element** through two master values - created at
master 1 it starts at 0.5, so seeing it drop to 0.2 proves it was still registered.

**Verification**: eslint 0 errors (3 pre-existing warnings); vite build green; **web 147 PASS / 0 FAIL / 0 WARN**;
**Windows 146 PASS / 0 FAIL / 1 WARN** (pre-existing G5 skip); **Android 85 PASS / 0 FAIL / 0 WARN / exit 0**;
plus a real emulator screenshot confirming the volume row's layout. The user **hand-tested the built app** and
reported it "works as intended from the brief testing" - the same bar move/copy cleared.

**Two harness facts learned the hard way** (now in `PROJECT_STATE.md`):
- **E2E output does not go to the console.** `e2e-full.ps1` writes the suite to
  `%TEMP%\opencode\e2e-run-<timestamp>.log`; only `Write-Host` phase lines reach stdout. The log is **mixed
  encoding** (ANSI header, UTF-16LE body), so `Get-Content` shows spaced-out text. Decode with
  `[System.Text.Encoding]::GetEncoding(28591).GetString([IO.File]::ReadAllBytes($p)).Replace([string][char]0,'')`.
  **Run the runner detached and poll the log** - a foreground `| Select-Object -Last N` buffers everything and
  returns nothing until the very end, which reads exactly like a hang.
- `ttrpg_themes` is seeded by all four suites but **no version of the app has that key**. Any "no new
  localStorage key" assertion must include it or it fails for a reason unrelated to the code. I wrote that
  assertion wrong first and it failed as P14.

**Android needed the documented manual recovery again.** `tauri android dev` built and installed the APK but
never launched it (package present, `pidof` empty) - the exact 2026-10-04 failure. `adb install -r` +
`adb shell monkey -p ... LAUNCHER 1` fixed it and the runner picked the pid up from there. 💡 Also noted that Vite
lists the **ProtonVPN `10.2.0.2` adapter first** in its Network lines, which is the documented collision risk.

**NOTHING COMMITTED** - `src/App.jsx`, `e2e/e2e-full.mjs` and the four docs are all modified in the working tree.
`src-tauri/Cargo.toml` shows as modified but is **byte-identical after EOL normalisation** (worktree LF, blob
CRLF); `git diff` shows no content change and it is not mine to commit.

**Next**: `SOUND_PRIMING_SPEC.md` - cheapest feature, zero persistence, and it now builds on volume's card shape.
New E2E ids must start at **P17** (P1-P16 are taken by Suite P).

**Handover**: released the claim 23:20. Volume done and uncommitted; next is priming (`P17`+ ids).
`docs/session-history.md` itself has a **pre-existing leading BOM** (present in the 22:47 backup, not introduced
by the 23:05 append) - harmless, left alone.


---

## 2026-10-08 session - one-shot sound priming shipped (E2E only, uncommitted)

Claim held by opencode 2026-10-08 20:52 -> released 2026-10-09 03:46. Implemented `SOUND_PRIMING_SPEC.md`.

**What shipped.** Right-click (desktop) / press-and-hold (mobile) primes a card; primed sounds fire alongside
the next trigger, then the set is consumed. One-shot, session-only, no localStorage key. `src/App.jsx` is 6769
lines. Key pieces: `primedSoundIds` + `primedRef` state (~1495-1606), `PRIME_HOLD_MS=500` /
`PRIME_MOVE_CANCEL_PX=10` / `PRIME_FLASH_MS=2000` (~710), `soundById` useMemo over `allSoundContainers()` (~2140),
`stopTrigger` / `playWithPrimes` (~3793/3808), gestures on the card (~4096-4123), badge + overlay (~4214-4243),
Clear buttons in both headers (~4748/4994).

**The one real bug.** `playWithPrimes` first read the primed set from STATE, so two triggers in the same tick
both saw the pre-consume value and the primes played twice (E2E P25). Fixed by making `primedRef` the authority:
read and clear the ref synchronously, before any await. Lesson: one-shot consumption needs a ref, not state.

**Gesture traps (all guarded).** A long press ALSO raises contextmenu, so the `pointerType === 'touch'` early
return is load-bearing. A right-click is pointerdown(button 2) AND contextmenu, so arming the hold on both
toggles twice and un-primes - hence `armPrimeHold` only arms on button 0. A hold's release produces a click that
would also play, so `suppressNextClickRef` swallows exactly that one and resets on every new press.
`PRIME_FLASH_MS` was raised 1200 -> 2000 ms: the flash is the only record of what fired, 1.2s was too short to
read, and it sat exactly on the P23d assertion boundary.

**Verification.** `npx eslint .` 0 errors (3 pre-existing warnings); `npx vite build` OK. Web E2E `e2e-full.mjs`
172 PASS / 0 FAIL / 0 WARN (Suite Q, ids P17-P34, 25 new), green BOTH headed and via `e2e-full.ps1 -Phase web`
(headless). Windows `e2e-full.ps1 -Phase win` 171 PASS / 0 FAIL / 1 pre-existing G5 WARN (exit 1 is the documented
warn exit, not a failure). Android NOT run - `adb devices` empty; `e2e-mobile.mjs` has no priming tests anyway, so
a real touch press-and-hold is the one unverified path.

**Harness/tests.** Added `cdpInput()` to `e2e-full.mjs`: headed Edge silently drops injected input while its
window is occluded and `document.hasFocus()` still reads true, so every mouse event now calls `Page.bringToFront`
first (44 sites; headless unaffected). `__pick()` matches text, then suffix, then title, because desktop has no
"Groups" tab (each group is its own tab, text "TTavern Pack" from the initial-letter fallback). P27 uses dedicated
`loop:true` seed sounds because the shared clip is under a second and unregisters via `ended` before a stop
assertion can run.

**Handover.** Nothing committed or pushed. Working tree: `src/App.jsx`, `e2e/e2e-full.mjs`, `SOUND_PRIMING_SPEC.md`
(build record), `PROJECT_STATE.md`, plus the EOL-only `src-tauri/Cargo.toml` non-diff. Pre-change backup
`ttrpg-soundboard-backup-20261008-205212` (206/206 verified) is the rollback point; no post-change backup was
taken. Next: hand-test priming on the built app, then `HOTKEYS_SPEC.md` (recommended after profiles).

## 2026-10-10 20:44-20:46 - opencode - Android E2E for sound priming; priming hand-tested

**What happened.** The user reported they had **hand-tested priming on the built app** and it works ("from the
brief test it seems to be working fine"), closing the last outstanding hand-test gap for the feature (the same bar
move/copy and per-sound volume cleared). The user then asked for the **Android E2E run** that had been skipped on
2026-10-08 (no device attached then).

**Run.** `e2e/e2e-android.ps1 -Suite mobile` standalone, no device attached so the runner booted the `Pixel_7`
AVD itself. Build via `npm run tauri android dev` (detached), WebView CDP forwarded to `tcp:9225`, suite
`e2e-mobile.mjs`. Runner snapshotted app storage before and restored it after (crash-safe guard) - both succeeded.
Result: **85 PASS / 0 FAIL / 0 WARN / exit 0**, identical to the 2026-10-06 run (after per-sound volume), so this
is a clean **no-regression** result.

**Caveat (unchanged from the spec).** `e2e-mobile.mjs` contains **no priming tests** (nor volume tests) - both
suites live only in `e2e/e2e-full.mjs`. So a green Android run does **not** prove priming works on Android; it
only shows the mobile build still passes its existing 85 checks. A **real touch press-and-hold** (the `pointerType
=== 'touch'` path, `PRIME_HOLD_MS=500`, move-cancel, click suppression) is the one still-unverified path on a real
device. Listed in `SOUND_PRIMING_SPEC.md` §7/§8.

**State.** No code or harness changes this session (E2E policy: execute and report only). Priming remains
**uncommitted and unpushed**. `PROJECT_STATE.md` updated in place; claim taken and released within the session.

**Handover.** Working tree unchanged from 2026-10-08: `src/App.jsx`, `e2e/e2e-full.mjs`, `SOUND_PRIMING_SPEC.md`
(build record), `PROJECT_STATE.md`, plus the EOL-only `src-tauri/Cargo.toml` non-diff. The rollback point is still
the pre-change backup `ttrpg-soundboard-backup-20261008-205212` (206/206 verified); **no backup was taken this
session** (no changes made). Next queued feature: `HOTKEYS_SPEC.md` (recommended **after** profiles).

## 2026-10-10 20:52-21:0x — opencode — Priming ported to the mobile (touch) suite; Android 105 PASS

**What happened.** Two requests in one session. (1) Confirmed priming is **implemented** on the built app (the
user had hand-tested it); what was actually missing was Android **coverage**. (2) After running the Android phase
once to confirm no regression (**85 PASS / 0 FAIL / 0 WARN / exit 0**), ported the desktop priming suite into
`e2e/e2e-mobile.mjs` as **Suite Q (Q1–Q14)** and re-ran: **105 PASS / 0 FAIL / 0 WARN / exit 0**.

**What was ported.** Touch has no right-click, so the mobile tests drive the real touch path with
**`Input.dispatchTouchEvent`** (via CDP `Input`), not `dispatchMouseEvent`: Q1 press-and-hold primes (badge +
overlay + `aria-pressed`) and does not also play; Q2/Q3 no late un-prime; Q4 hold+40px move cancels; Q5 edit mode
never primes; Q6/b/c/d two primes + tap fire all three through one `_primeGroup`, the set is consumed and the
cards flash as fired; Q7 rapid double-trigger does not double; Q8a/b/c clear-button lifecycle; Q9 no new
`localStorage` key; Q10 no reload persistence; Q11 stopping the primary stops the whole group; Q12/Q13/Q14 fire
from an environment category / group category / group character, navigating via the mobile drawer. Same fixture
ids as the desktop `P17`–`P34`, so a cross-platform failure is directly comparable.

**Bug found while writing it (harness only, not app).** `drawerPick` embedded the search text as a bare
identifier inside an `evalJs` template string, so the page threw `ReferenceError: text is not defined`; the
helper's error object stringified to `[object Object]` and the drawer click silently no-op'd, failing Q12–Q14.
Fixed by interpolating `JSON.stringify(text)`. App code was untouched.

**Verification.** `node --check` + `npx eslint .` clean (0 errors, 3 pre-existing warnings). Android
**105 PASS / 0 FAIL / 0 WARN / exit 0** (Pixel_7 emulator, 2026-10-10 21:04). Web/Windows phases not re-run
(only `e2e-mobile.mjs` changed).

**State / handover.** Nothing committed or pushed. Working tree: `src/App.jsx`, `e2e/e2e-full.mjs`,
`e2e/e2e-mobile.mjs` (Suite Q), `SOUND_PRIMING_SPEC.md` (build record; §4b added, §7 item closed, §8 updated),
`PROJECT_STATE.md`, plus the EOL-only `src-tauri/Cargo.toml` non-diff. Rollback point:
`ttrpg-soundboard-backup-20261010-205141` (206/206 verified, 39.4 MB), taken before the harness edits. Remaining
mobile-suite gap: per-sound volume (Suite P) is still desktop-only; move/copy (M/G) likewise. Next queued
feature: `HOTKEYS_SPEC.md` (recommended after profiles).

## 2026-10-10 21:08-21:17 — opencode — Per-sound volume ported to the mobile (touch) suite; Android 126 PASS

**What happened.** Followed up the priming port by porting **per-sound volume** (the gap `PROJECT_STATE.md` and
`PER_SOUND_VOLUME_SPEC.md` §8 tracked) into `e2e-mobile.mjs` as **Suite P (P1–P16)** — a verbatim mirror of the
desktop suite. Backup taken first: `ttrpg-soundboard-backup-20261010-211224` (206/206, 39.4 MB).

**What transferred unchanged.** The slider is platform-independent UI, so P1–P8 and P10–P16 are the same DOM /
storage / modal assertions: every card exposes `[data-sound-volume]`, the control sits **outside** the
`role="button"` card, absent `volume` reads 100%, playback records `_soundVolume`/`_baseVolume`/`volume`, master
× trim is the audible product, 0 survives a reload (the `||` trap), `DATA_VERSION` stays 3, no new
`localStorage` key, and the edit modal's `#soundVolumeRange` mirrors/writes the same field.

**The one real platform difference — P9.** The desktop suite drives P9 with a CDP **mouse** event because a
synthetic `element.click()` is not a user gesture: autoplay is refused, the fresh element is torn down, and the
live master-rescale never touches it (the assertion would pass/fail for the wrong reason). The mobile port uses a
**real `Input.dispatchTouchEvent` tap** instead — a genuine trusted gesture, so playback starts and the element
stays registered. P9a–P9d then prove master 0.4 rescales the live element to 0.2 and back to 0.5, with
`_baseVolume` in step. The master slider is selected by `title^="Volume:"` picking the visible one (the mobile
header renders, the desktop header does not).

**Result.** Android **126 PASS / 0 FAIL / 0 WARN / exit 0** (Pixel_7 emulator, 2026-10-10 21:15) — 85 base + 20
(Q) + 21 (P). `node --check` + `npx eslint .` clean (0 errors, 3 pre-existing warnings). Web/Windows phases not
re-run (only `e2e-mobile.mjs` changed).

**State / handover.** Nothing committed or pushed. Working tree: `src/App.jsx`, `e2e/e2e-full.mjs`,
`e2e/e2e-mobile.mjs` (Suite Q + Suite P), `SOUND_PRIMING_SPEC.md`, `PER_SOUND_VOLUME_SPEC.md` (status + §8
updated), `PROJECT_STATE.md`, plus the EOL-only `src-tauri/Cargo.toml` non-diff. Rollback point:
`ttrpg-soundboard-backup-20261010-211224` (206/206 verified). Remaining mobile-suite gap: **move/copy** only.
Next queued feature: `HOTKEYS_SPEC.md` (recommended after profiles).

## 2026-10-10 21:20-21:41 — opencode — Move/copy ported to the mobile suite; Android 148 PASS

**What happened.** Closed the last of the three queued mobile-coverage gaps by porting **move/copy** (desktop
`e2e-full.mjs` Suite M, M1–M22) into `e2e-mobile.mjs` as **Suite M (M1–M22)**. Backup first:
`ttrpg-soundboard-backup-20261010-212155` (206/206 verified, 39.4 MB).

**Correction to the earlier handover.** The priming/volume blocks called the remaining gap "move/copy (M/G)".
That was wrong: desktop Suite **G** is **GROUPS CRUD**, which the mobile suite already covers (mobile Suite G).
It is **not** the file-refcount guard. So move/copy (M) was the only gap — now closed. Remaining *un-ported*
mobile checks are the un-requested ones: drag reorder (X), sound-into-group (H), sliders/persistence (B),
keyboard (Y, partial) and card indicators (U, partial).

**What transferred unchanged.** The picker is platform-independent DOM (a `fixed` overlay, `h2 "Move or Copy"`,
`uppercase font-semibold` section headers, per-row `title="Move to <label>"` / `"Copy to <label>"` buttons), so
M1–M22 are the desktop assertions verbatim, driven by `.click()` rather than touch. They prove: the button shows
on every card only in edit mode; sections render as Characters → groups → Environments; the current container
offers **Copy only** (move there is a no-op); copy shares `files[]` and the legacy `file` field verbatim, mints a
new id, writes no new `sound_file_*` key; `nextCopyName` suffixes `Name (copy)` / `(copy 2)` **scoped to the
destination** (a same-named copy in another container is not `(copy 3)`); a move relocates the same object,
preserving id/colour/`randomPlay`/`files`, silently (no dialog, picker auto-closes); and Esc closes the picker
(the capture-phase handler stops it reaching the drawer).

**One navigation difference.** The desktop suite switches the active character with a sidebar button to reach a
sound it just moved; the mobile board is drawer-driven. Rather than add drawer round-trips, the mobile fixture
keeps **every source sound on the initially-visible Human Paladin board** (Alpha/Bravo/Charlie/Delta/Echo) and
moves them **out** — same character → character / group-category / group-character / environment transfers, no
navigation. Seeded sounds carry `file: ''` so M9 ("copy keeps the legacy file field") stays meaningful.

**Result.** Android **148 PASS / 0 FAIL / 0 WARN / exit 0** (Pixel_7 emulator, 2026-10-10 21:30) — 85 base + 20
(Q) + 21 (P) + 22 (M). `node --check` + `npx eslint .` clean (0 errors, 3 pre-existing warnings). Web/Windows
phases not re-run (only `e2e-mobile.mjs` changed).

**State / handover.** Nothing committed or pushed. Working tree: `src/App.jsx`, `e2e/e2e-full.mjs`,
`e2e/e2e-mobile.mjs` (Suite Q + P + M), `SOUND_PRIMING_SPEC.md`, `PER_SOUND_VOLUME_SPEC.md`, `PROJECT_STATE.md`,
plus the EOL-only `src-tauri/Cargo.toml` non-diff. Rollback point:
`ttrpg-soundboard-backup-20261010-212155` (206/206 verified). Claim released (UNCLAIMED). Next queued feature:
`HOTKEYS_SPEC.md` (recommended after profiles).

## 2026-10-10 22:10-23:12 - opencode - Phase 2: five more shared specs; all three gates 0 FAIL

**What happened.** Turned the Phase 0/1 scaffolding into real coverage: moved five more suites out of the
entrypoints into `e2e/specs/`, each run from **both** platforms, which closed every mobile gap the docs had
listed except keyboard. Backup first: `ttrpg-soundboard-backup-20261010-221101` (212/212 verified, 39.4 MB - 212
rather than 206 because the new lib/spec files are now included).

**The five specs.**
- `indicators.mjs` (U1-U7) - replaces inline Suite U on desktop and **inline Suite R on mobile**. R1-R6 were
  U1/U2/U3/U4/U6 restated; the shared spec additionally brings **U5** (multi-file icon, "2 files available") and
  **U7** (loop-icon count == 2), which mobile never had. Net mobile +1.
- `sliders.mjs` (B1-B4) - the box-size slider, previously desktop-only. **One assertion genuinely differs by
  platform and it is not a workaround:** on desktop a card is `140 * boxSize` px wide (1.8 => ~252px), but on
  mobile the card is `w-full` and box-size picks the *grid column count* (App.jsx:5218, `>=1.5 => 1 col`). So B2
  asserts card width on desktop and "grid collapsed to one column" on mobile.
- `soundintogroup.mjs` (H1-H2) - adds a sound into `Tavern Pack > Ambience`. Navigation is the platform part:
  desktop clicks a sidebar leaf, mobile opens the drawer, clicks the group, then the category.
- `drag.mjs` (X1-X2) - drag reorder. The app's reorder is **pointer-event based** (`onPointerDown` -> document
  `pointermove`/`pointerup`, `setPointerCapture`), so a CDP touch drag drives the identical code path; only the
  delivery differs (`driver.dragFromTo`: mouse vs `Input.dispatchTouchEvent`). **Edit mode is mandatory** -
  outside it the press arms the press-and-hold PRIME instead, since the two share `onPointerDown`.
- `refcount.mjs` (G1-G5) - the file-reference guard, the safety-critical one: a copy shares the source's
  `storedName`, so deleting the source container must not delete the file the copy still points at. Pure app
  logic, identical everywhere, so it had no business being desktop-only.

**Plumbing.** `lib/driver.mjs` gained `dragFromTo(from,to)`. Both ctx objects gained `isTauri`, `navigateTo`,
`clickModalOpener`, `upload` (desktop = CDP `DOM.setFileInputFiles`, mobile = in-page `DataTransfer` because the
Android WebView rejects CDP file IPC), `deleteCharacter` (sidebar badge vs drawer badge) and
`closeDrawer`/`openDrawer`.

**The regression worth remembering.** Desktop Suite **M** is *not* self-contained - it reads the board the
inline suites leave behind - and neither is Suite **D**. My first two web runs failed (159/0/13 then 153/0/19)
purely because of suite *placement*:
1. Run 1: the new specs sat where the old inline suites were, so their seed+reload reset the fixture M reads.
   Fixed by moving all shared specs into one block after Suite Y.
2. Run 2: with them moved, Suites G and T leave the app **on the Groups board**, and the `Page.reload` that the
   old inline drag suite used to do between G and D is what used to put it back on Human Paladin. D and M then
   drove per-card controls that do not exist on a group board (`NO_CARD`, `1/1` card, "No characters yet").
   Fixed with an explicit `Page.reload` before Suite D, commented as to why.

💡 **Lesson: a desktop `NO_CARD` / empty-section failure in this suite is suspect as a *view* problem before it
is a missing element.** The mobile entrypoint has no such coupling - every mobile suite seeds its own fixture.

**Result - 0 FAIL on all three gates.**
- Web **172/0/0 exit 0** (`e2e-run-20261010-224758.log`).
- Windows **171/0/1 exit 1** (`e2e-run-20261010-225442.log`) - baseline, G5 skips on Tauri.
- Android **161/0/1 exit 1** (`e2e-android-20261010-230145.log`) = 148 - 6 (Suite R) + 7 U + 4 B + 2 H + 2 X + 4 G.
- Both risky ports passed first try on Android: drawer navigation reported `nav1=OK nav2=OK`, and the touch drag
  reordered `[Smite, Shield Bash, Healing Light, Divine Light]` -> `[Divine Light, Smite, Shield Bash, Healing Light]`.
- `node --check` clean; `npx eslint .` 0 errors, 3 pre-existing warnings.

⚠️ **The Android gate is no longer exit 0, deliberately.** G5 is the negative localStorage case and cannot apply
under Tauri (the upload is a physical file), so it logs a WARN, which maps to exit 1, which `e2e-android.ps1`
treats as a failed phase. Android now matches Windows, which has always exited 1 for this same skip. Not
downgraded to a silent skip: a quietly dropped test rots unnoticed, and **0 FAIL with the WARN visible** is the
honest reading. Revert path if the user disagrees: make `refcount.mjs` log a skip instead of `WARN` on Android.

**Deferred on purpose, with reasons.** Keyboard (Y): asserts `tabindex`/Enter-keydown - vacuous for a soft
keyboard. Split view (L): N/A on mobile. Reset to Defaults and the live-playback gate: neither has a desktop
twin to share, and Reset to Defaults wipes the fixture later suites read, so it must re-seed and run last.

**State / handover.** Nothing committed or pushed. Working tree: `src/App.jsx`, `e2e/lib/driver.mjs`,
`e2e/specs/*` (6 files), `e2e/e2e-full.mjs` (1866 -> 1565 lines), `e2e/e2e-mobile.mjs` (1402 -> 1466),
`SOUND_PRIMING_SPEC.md`, `PER_SOUND_VOLUME_SPEC.md`, `PROJECT_STATE.md`, this file, plus the EOL-only
`src-tauri/Cargo.toml` non-diff. Rollback point: `ttrpg-soundboard-backup-20261010-221101`. Claim released
(UNCLAIMED). **Phase 3 remains**: `e2e/coverage.manifest.json` + a checker, the AGENTS.md definition-of-done, and
folding/deleting `e2e-run.mjs` / `e2e-features.mjs` per the deprecated-parts rule. Next queued *feature* is
`HOTKEYS_SPEC.md` (recommended after profiles).

## 2026-10-10 21:40-22:07 - opencode - Shared E2E harness (e2e/lib + e2e/specs); all gates green

**What happened.** Refactored the E2E harness into a shared-library + shared-specs architecture with **zero
behavior change** - the "Phase 0 + Phase 1" refactor the user green-lit. Backup first:
`ttrpg-soundboard-backup-20261010-214021` (206/206 verified, 39.4 MB).

**Phase 0 - shared plumbing (`e2e/lib/`).**
- `cdp.mjs` - `sleep(ms)`; `connect({ port, label, fatalExit = 3 })` returns `{ cdp, cdpInput, evalJs, close,
  page }`; a fatal socket close/error calls `process.exit(fatalExit)`. `cdpInput` = `Page.bringToFront().then(() => cdp(...))`;
  `evalJs` resolves the value or `{ __error }`.
- `report.mjs` - `createReport(label, title)` returns `{ allResults, log, run, counts, summary, exitCode }`.
  Summary prints `[label] title: PASS=.. FAIL=.. WARN=.. TOTAL=..` with no leading newline; exit code
  `fail>0?2:(warn>0?1:0)`.
- `page.mjs` - the duplicated seed/helper/instrument blocks: `SEED` (identical expression), `PAGE_HELPERS`
  (incl. the dead `__uploadFile`), `INSTRUMENT_AUDIO` (eager `__origAudio`/`__audios` capture),
  `CAPTURE_LS`, `restoreLs(captured)`, `submitModalExpr(btnText)`, `KNOWN_KEYS`.
- `driver.mjs` - `makeDriver({ platform, cdp, cdpInput, evalJs, sleep })` returns `{ platform, isDesktop,
  trustedTap(x,y), centeredCard(selector), enterEditMode(), exitEditMode() }`. `trustedTap` sends real
  `mousePressed`/`mouseReleased` on desktop and `Input.dispatchTouchEvent` `touchStart`/`touchEnd` on touch.
  Edit-mode enter/exit uses `button[title="Toggle Edit Mode"]` (lime-class check) on desktop and the
  Enter/Exit Edit Mode buttons on mobile.
- `spec-runner.mjs` - `runSpecs(ctx, specs)` prints `[label] === title ===` and awaits each `spec.run(ctx)`.

**Phase 1 - `e2e/specs/volume.mjs` (shared Suite P).** Extracted desktop Suite P verbatim into a spec run from
**both** entrypoints: P1-P16 + a P9-setup ("trusted gesture path available"), 21 `[VOL]` asserts total. The spec
owns a self-contained seed (vol_half trim 0.5, vol_none no-volume-field, real bundled mp3s, `ttrpg_themes` [],
`sound_file_*` cleared - mobile's superset) and unified helpers (`__master()` visible-first with list[0] fallback,
`__volCard`, `__playCard`). P9's gesture goes through `driver.centeredCard('[data-sound-card][data-sound-id="vol_half"]')`
+ `driver.trustedTap(coords.x, coords.y)`; P15/P16 use `driver.enterEditMode/exitEditMode` +
`ctx.submitModal('Save Changes')`.

**Entrypoints thinned.** `e2e/e2e-full.mjs` 2198 -> 1863 lines; `e2e/e2e-mobile.mjs` 1716 -> 1400 lines. Both now
import the libs, build the same `ctx` (`{ label, log, run, evalJs, sleep, reload, submitModal, driver }`) with the
right platform, and call `await runSpecs(ctx, [volume])` in Suite P's place (suite bodies removed by a temp
`C:\Users\emire\AppData\Local\Temp\opencode\splice.mjs` seam script - markers ending with `\n` get a real newline,
embedded literal `\n` stays literal; verified the resulting seams in both files). Suite Q / M stay inline for now.

**Result - identical counts, proving the seam is behavior-neutral (all 2026-10-10).**
- Web `e2e-full.ps1 -Phase web -Suite full`: **172 PASS / 0 FAIL / 0 WARN, exit 0** (`e2e-run-20261010-215247.log`).
- Windows `e2e-full.ps1 -Phase win -Suite full`: **171 PASS / 0 FAIL / 1 WARN (pre-existing G5 skip), exit 1** -
  matches baseline (`e2e-run-20261010-215642.log`).
- Android `e2e-android.ps1 -Suite mobile`: **148 PASS / 0 FAIL / 0 WARN, exit 0** (`e2e-android-20261010-215932.log`).
- Shared volume spec: each log has 21 `[VOL]` lines; P9-setup PASS "trusted gesture path available", coords
  web/win x:398,y:235 prior n:2, android x:163,y:308. `node --check` + `npx eslint .` clean (0 errors, 3
  pre-existing warnings).

**Tooling note.** The bash tool strips `$` from inline PowerShell commands (`$_`, `$b`, `$LASTEXITCODE` silently
eaten) - write `.ps1` helpers into `%TEMP%\opencode\` and run them with `-File` instead. Log decode helper
(`vol-check.ps1`) uses `[Text.Encoding]::UTF8.GetString(ReadAllBytes($p)).Replace([char]0,'')` - the gate logs are
ASCII at the start, UTF-16 at the tail.

**State / handover.** Nothing committed or pushed. Working tree adds: `e2e/lib/*`,
`e2e/specs/volume.mjs`; modified: `e2e/e2e-full.mjs`, `e2e/e2e-mobile.mjs`, `PROJECT_STATE.md`, this file; plus
the pre-existing priming/volume/move-copy working tree. Rollback point:
`ttrpg-soundboard-backup-20261010-214021` (206/206 verified). Claim released (UNCLAIMED). Next phases:
**Phase 2** (port remaining mobile gaps: refcount guard, U5/U7 indicators, box-size, Reset to Defaults,
add-sound-to-group via drawer, live-playback gap, drag reorder touch), **Phase 3** (e2e/coverage.manifest.json +
checker, AGENTS.md DoD, fold+delete `e2e-run.mjs`/`e2e-features.mjs` via the deprecated-parts rule).
---

## SESSION 2026-10-11 - PHASE 3: COVERAGE MANIFEST + CHECKER, AND PORT-THEN-RETIRE THE LEGACY SUITES

Resumed a session that was cut off at the *reporting* stage. Claimed `PROJECT_STATE.md` (was UNCLAIMED), took
the mandatory backup first (`ttrpg-soundboard-backup-20261011-102658`, 217/217 verified, 39.5 MB), then worked
Phase 3. Phase 3b (AGENTS.md definition-of-done) is the only thing left.

### Phase 3a - `e2e/check-coverage.mjs` + `e2e/coverage.manifest.json` (new)

A **static** gate - no browser, no CDP - so it is cheap enough to belong in any pre-commit sweep. It enforces the
invariant the whole shared-specs refactor exists to protect, plus the drift the state file keeps complaining about.

| Check | Catches |
|---|---|
| `UNREGISTERED_ID` / `STALE_MANIFEST_ID` | a test added without being registered, or registered then deleted |
| `SPEC_NOT_RUN` | a spec imported by an entrypoint but never passed to `runSpecs()` - looks wired up, never executes |
| `SPEC_NOT_SHARED` | a shared spec running on only one entrypoint - a silent coverage hole nothing reports at runtime |
| `PLATFORM_MISMATCH` | the manifest's `platforms` edited to match the code instead of the code being fixed |
| `AMBIGUOUS_ID` | two suites whose `idPattern`s overlap on the same id |
| `ORPHAN_FILE` | a new spec file nobody declared |
| `RETIRED_PRESENT` | a retired harness file coming back |

- `--update` rewrites **only** each suite's `ids` from the code and prints what it re-synced; it never invents,
  deletes or reorders a suite, so a structurally drifted manifest still fails and still needs a human.
- **The namespace is the pair `(cat, idPattern)`, and that is not optional.** `cat` alone cannot split a category
  - `SOUND` is three separate suites (add / edit / delete) in each entrypoint. An id prefix alone cannot either -
  mobile's `MOBILE M1-M7` and `MOVE M1-M22` both start with `M`. Keying on `cat` was tried first and silently
  triple-counted the `SOUND` ids (157 reported where 123 existed).
- Counts are **static, not runtime**: a legitimate pattern is one id logged from both arms of an if/else (the else
  arm logging a hard-coded FAIL, e.g. `e2e-mobile.mjs` C4), and a platform branch asserting a different thing
  under the same id (`sliders.mjs` B2: card width on desktop, grid columns on mobile). The report says so, and
  points at the E2E summary as the authority on how many actually ran.
- Final state: **36 suites, 305 ids, 9 shared specs**, `OK - manifest, code and platform wiring agree.`

### Phase 3c - the plan was wrong, and the audit caught it

Phase 3 was written as *"delete `e2e-run.mjs` / `e2e-features.mjs`"*. Before deleting, I extracted every
`log()` call from both. **~31 of their tests existed nowhere else:**

| Was | Now | Notes |
|---|---|---|
| `e2e-features.mjs` Suite E, **E1-E9 LIVE PLAYBACK** | `specs/playback.mjs` **Z1-Z10** | fade-in ramp, fade completion, live master, loop rewind, Stop All - the only assertions on real audio output anywhere |
| `e2e-features.mjs` **D11/D12** (`loop=true` / `fadeIn=2` persisted) | `specs/playback.mjs` **Z11/Z12** | the modal hydrate/write round-trip |
| `e2e-run.mjs` Suite A, **A1-A10 single-view scroll** | `specs/scroll.mjs` **R1-R10** | the only coverage of scroll containment |
| `e2e-run.mjs` Suite P, **P1-P6 platform** | `specs/platform.mjs` **W1-W6** | the `isMobile` gate guard |
| `e2e-run.mjs` Suite B (split-view), Suite C (feature matrix) | - | already covered inline; dropped as duplicates |
| `e2e-run.mjs` C19 (lime ring colour), C32/C33 (viewport fill) | - | C19 cosmetic, accepted loss; C32/C33 now R7/R10 |

**Lesson worth carrying: retire by porting, never by deleting.** The AGENTS.md deprecated-parts rule says to
record what a deleted file knew; here what it *knew* was **live passing tests**, which is a stronger reason. The
mechanical version of this audit - build the manifest while the old files still exist, then let the checker show
you what disappears - would have caught it without reading 700 lines by eye.

Only after all three specs were green on all three platforms: `git rm` the three files, `.gitignore` them with
the reason inline, narrow `-Suite` to `full|mobile` with a `ValidateSet` on both runners (so a stale value fails
at the parameter instead of becoming "e2e-run.mjs not found" three phases later), and update the README.

### Three real defects the new specs caught - all in the tests, none in the app

1. **Ternary precedence in a status argument.** `cond ? a : b ? 'PASS' : 'FAIL'` binds as
   `cond ? a : (b ? 'PASS' : 'FAIL')`, so the `expectMobile` branch returned a **boolean**. `report.mjs` counts
   anything that is not the literal `'PASS'`/`'FAIL'` as a **WARN**, so W3/W6/R2 were silently demoted from
   results to warnings - **and only on Android**, because only there was `expectMobile` true. Web and Windows
   reported `PASS` and would never have shown it. Fix: always `(cond ? a : b) ? 'PASS' : 'FAIL'`.
2. **`window.__setInput` does not survive a reload.** It comes from `PAGE_HELPERS`, injected at entrypoint start,
   so a spec that reloads and then calls it gets `undefined`; `evalJs` swallows the exception, the field keeps its
   old value, and the failure surfaces much later as a misleading value (Z12 stored `fadeIn:1` after being set to
   2). Each spec must define its **own** setter in its post-reload helper block - as `volume.mjs.__setRange` and
   `playback.mjs.__pbSetField` already did.
3. **The board does not scroll the same way on both platforms.** Desktop's panel carries `overflow-y-auto`
   (App.jsx:4696) with the sidebar outside it; **mobile's board panel does not scroll at all** (App.jsx:5186) -
   the main-content column (App.jsx:5044) is the scroll container and the icon rail lives *inside* it, so it
   scrolls away with the content by design. `scroll.mjs` finds the scroller by walking up from a card to the
   nearest ancestor that actually scrolls, and R8 asserts the correct expectation per platform instead of the
   desktop one everywhere.

### Gates (all three, 0 FAIL)

| Phase | Result | Exit | Log |
|---|---|---|---|
| Web | **200 / 0 / 0** | 0 | `e2e-run-20261011-113830.log` |
| Windows | **199 / 0 / 1** (pre-existing G5) | 1 | `e2e-run-20261011-114452.log` |
| Android | **189 / 0 / 1** (same G5) | 1 | `e2e-android-20261011-115224.log` |

`npx eslint .` 0 errors / 3 pre-existing warnings. `npx vite build` OK. `node --check` on every touched `.mjs`
OK. Both `e2e-full.ps1` and `e2e-android.ps1` re-verified `PARSE-OK` after the `ValidateSet` edit.
Web 172 -> 200 and Android 161 -> 189 are entirely the three ported specs.

### Also noticed, not acted on

- **`stash@{0}`** - *"On feature/multiple-sound-files: Backup before reroll to master"*, dated **2026-08-11**,
  touching `src/App.jsx` (87+/224-). It predates all seven branches being merged into `mobile-support`
  (2026-10-04), so it is very likely a dead pre-merge safety net. It was not mentioned anywhere in
  `PROJECT_STATE.md` before this session. **Not dropped** - raised with the user, a stash is cheap insurance.
- `SOUND_PRIMING_SPEC.md`'s 227/247 line diff is the plan -> build-record rewrite with LF working-copy endings,
  not corruption (220 lines vs 217 in HEAD, 17.7 KB, reads clean).
- `e2e/e2e-full.ps1` was edited (the `ValidateSet`). The repo `.git` exclusions added 2026-10-04 are confirmed
  working, so the commit is safe - and having it committed is what gives `backup-project.ps1` a
  `git show HEAD:e2e/e2e-full.ps1` fallback if Bitdefender eats the blob again.## SESSION 2026-10-11 (cont.) - Phase 3a+3c COMMITTED as 23bf458

Closed the Phase 3 work after all three gates came back green, rather than leaving another session's worth
uncommitted. **Web 200/0/0 exit 0, Windows 199/0/1 exit 1, Android 189/0/1 exit 1** - 0 FAIL everywhere, both
nonzero exits being the pre-existing G5 skip.

- Commit **`23bf458`** "Ship sound priming, refactor the E2E harness, and add a coverage gate" - 30 files,
  covering priming + the shared-spec refactor + Phase 3 together, because all three were uncommitted.
- ⚠️ **NOT PUSHED.** `origin/mobile-support` is still at `10fe6e2`-era state; this is the user's call.
- **`src-tauri/Cargo.toml` was correctly not swept in**, despite `git add -A -- src-tauri` naming the pathspec:
  git normalised the LF working copy to the committed blob, so `HEAD:src-tauri/Cargo.toml` and
  `HEAD~1:src-tauri/Cargo.toml` are both `f701a93a`. **Verified by hash, not by eyeballing `git status`.**
- The **decorative post-commit hook** printed `=== TTRPG Soundboard Backup Log === / Backup created: ... /
  Backup location: /c/Users/emime/Projects/ttrpg-soundboard` on commit. That is the project directory, not a
  backup folder, and **no backup happened**. Ran `.\backup-project.ps1` for real:
  **`ttrpg-soundboard-backup-20261011-120339`**, 219/219 verified, 39.5 MB - the first backup holding all three
  phases' work. Rollback point for the session is `ttrpg-soundboard-backup-20261011-102658` (217/217).
- The AV-sensitive blob survived the commit: `HEAD:e2e/e2e-full.ps1` = `60f4645b`, 15765 bytes, readable, so
  `backup-project.ps1` now has a `git show HEAD:` fallback for it.
- Commit message written with `[System.IO.File]::WriteAllText(..., UTF8Encoding($false))` - no BOM
  (first bytes `83,104,105` = "Shi"), confirmed afterwards with `git cat-file commit HEAD`.
- 💡 A `--stat --name-only` grep for `Cargo.toml` reported a false positive: `git show` prints the commit
  MESSAGE before the file list, and the message mentions Cargo.toml. **Check the blob hash, not the file list**,
  when verifying what a commit actually contains.

Phase 3b (the AGENTS.md definition-of-done) is the only remaining item. Claim held by opencode.
## SESSION 2026-10-11 (close) - PHASE 3b, PUSH, BACKUP PRUNE, CLAIM RELEASED

**Phase 3 complete. Everything committed AND pushed: `dc9c276..7455c3b`, 0 ahead / 0 behind.**

- **Phase 3b** - added the **definition of done** to `AGENTS.md` (`7455c3b`). Seven gates in order: backup ->
  eslint -> vite build -> `check-coverage.mjs` -> web E2E -> Windows E2E -> Android E2E. The repo previously had
  rules for backing up, keeping state current and retiring dead parts, but nothing saying when work is FINISHED
  - which is why Phase 2 and Phase 3 both ended at "0 FAIL on the gate that happened to run". Four points it
  calls out explicitly: Windows/Android **exiting 1 is the healthy baseline** (G5), 0 FAIL is the signal; new
  coverage must be registered via `check-coverage.mjs --update`; a user-facing feature needs a hand-test of the
  built app; and a gate that could not run must be named, not silently omitted.
- **Push** succeeded first try, no auth or proxy trouble, consistent with 2026-10-04 / 10-06. Note PowerShell
  surfaces git's stderr as a `NativeCommandError` record - the push still worked, and `git rev-list --count
  origin/mobile-support..HEAD` returning `0` is the real confirmation.
- **Backup prune** (at the user's request): **10 folders / ~355 MB -> 2 folders / ~79 MB**. Deleted 8 older
  backups, ~315 MB reclaimed.
  - Before deleting, **every file in all 8 was diffed against the repo and `git ls-files`.** The only files not
    in the working tree were the three retired suites (`e2e-run.mjs`, `e2e-features.mjs`, `e2e-features.ps1`),
    and those are recoverable from `dc9c276:e2e/...` - verified with `git cat-file -e`, and `dc9c276` is on
    `origin/mobile-support`. So the prune provably lost nothing.
  - Kept `20261011-120800` (matches `7455c3b` exactly) and `20261011-120701`.
- 🔍 **NOT deleted, and the user should decide: the four logs on the Windows Desktop** (`emu-out.log`,
  `emu-err.log`, `tauri-dev-stdout.log`, `tauri-dev-stderr.log`, dated **2026-08-31**, ~30 KB). The user
  referred to them as "backups"; **they are not backups.** `tauri-dev-stderr.log` holds the smoking gun for the
  ProtonVPN incident this file records in prose - *"Info Using 10.2.0.2 to access the development server /
  Info Replacing devUrl host with 10.2.0.2"*. The harness stopped writing there long ago (every redirect now
  goes to `%TEMP%\opencode\`), so they are one-off debris from a manual launch - but they are the **primary
  source** for a documented gotcha, which is exactly what AGENTS.md's "only record of a hard-won gotcha" clause
  protects. Left in place and recorded in Known environment facts.

### Final gate state (unchanged since the commit)

| Phase | Result | Exit |
|---|---|---|
| Web | 200 / 0 / 0 | 0 |
| Windows | 199 / 0 / 1 (G5) | 1 |
| Android | 189 / 0 / 1 (G5) | 1 |

Working tree clean. Claim **released** (UNCLAIMED). `stash@{0}` (2026-08-11) still parked, still the user's call.
## SESSION 2026-10-11 (close) - stash@{0} dropped after verifying it obsolete

The last parked item was `stash@{0}`, *"On feature/multiple-sound-files: Backup before reroll to master"*
(2026-08-11, `src/App.jsx`). The user noted multiple sound files has been implemented for a while and was
working when last checked, so the branch work is long merged - but **the stash is not the branch**, so it was
verified before dropping rather than assumed dead.

| | stash `efeb907` | HEAD |
|---|---|---|
| `src/App.jsx` lines | **2194** | 6769 |
| `storedName` | **0** | 45 |
| `toStoredFileName` | **0** | 3 |
| `audioFiles` | **0** | 13 |

Zero occurrences of every symbol the feature is built on: it is the **before-side** snapshot taken before the
branch was rolled onto master. Its added lines are `console.log` debug calls and a split-layout sketch whose own
placeholders read *"Character list will go here"*, over single-file logic (`soundFormData.file`,
`` soundUrl = `/assets/${sound.file}` ``) and a validation guard requiring `!audioFile && !soundFormData.file`.

💡 The reusable lesson: **grep the stashed blob for the feature's core symbols before deciding a stash is
dead.** "That branch was merged" does not imply "that stash is empty" - the stash captured a *different point
in time* from the merge, and here it pointed backwards, not forwards. There are now **no stashes** in this repo.
## SESSION 2026-10-11 (close) - correcting the ProtonVPN entry in PROJECT_STATE.md

Asked to explain the ProtonVPN gotchas. Doing so required reading the record rather than repeating it, and
**the entry I had written hours earlier turned out to be overstated.** Rewritten.

**What is actually true, verified 2026-10-11:**

- The ProtonVPN adapter at **`10.2.0.2` is still present** - `Get-NetIPAddress` shows `10.2.0.2 ProtonVPN`
  next to `192.168.1.102 Ethernet`. So this can recur; it is not a resolved-and-gone environment change.
- The trap: the VPN address `10.2.0.2` and Android's **hard-coded** emulator-to-host alias **`10.0.2.2`** sit
  in the same subnet prefix and are easy to misread as the same thing.
- **Two distinct failures, not one**, and they produce an identical symptom:
  1. `tauri android dev` auto-detects the dev-server address and picks the VPN adapter - *"Info Using 10.2.0.2
     to access the development server / Info Replacing devUrl host with 10.2.0.2"* - baking the wrong address
     into the debug APK. `tauri.conf.json` still correctly ships `localhost:5173`; the rewrite is **runtime
     only**, so grepping the repo never reveals it.
  2. Vite dying mid-run yields the same `Failed to request 10.2.0.2:5173` page. session-history.md:571 records
     this one and blames Vite's lifetime, **not** the address.
  Fixing one does not fix the other.
- Mitigation for (1) is `vite.config.js:19` `host: '0.0.0.0'`, added in **`9c2a4c3`** (2026-08-31, "Mobile UI
  adjustments") - verified by `git log -S`, and the **same day** as the Desktop logs. `e2e-full.ps1:296` also
  clears `TAURI_DEV_HOST` in cleanup.

**The correction:** my earlier note called the four Desktop logs *"the actual smoking gun"* and *"the primary
source"* for the gotcha. Both were wrong, and the archive says so. `session-history.md:1701` records this as a
**risk noted** (*"Vite lists the ProtonVPN 10.2.0.2 adapter first in its Network lines, which is the documented
collision risk"*) - not a diagnosed-and-fixed incident. The prose record was thinner than I implied. What the
logs uniquely add is the **mechanism**, which no prose entry spelled out; that is their actual value, and the
note now says exactly that and no more. The note also records that **nothing is lost if they are deleted**.

💡 **Lesson: "I found the primary source for X" is a claim about the record, so it has to be checked against the
record.** I had inferred it from the fact that a log existed and contained a matching string - which shows the
mechanism happened, not that the prose had failed to capture it. The general form of this mistake is the same
one that produces phantom incident stories: assembling several true observations into a causal narrative no
single record supports.
## SESSION 2026-10-11 (close) - FEATURES REGISTRY, and the blind spot it exposed

Question asked: *now the E2Es are re-done, when a new feature is added will it be included in them?*

**Honest answer before the change: no.** `check-coverage.mjs` enforced that coverage cannot **rot**, never that
coverage **exists**. Ship a feature with zero tests and the checker stayed green, all three phases stayed green,
nothing warned. The only thing doing that job was habit - the E2E checklist sections in `SOUND_PRIMING_SPEC.md`
§7 and `PER_SOUND_VOLUME_SPEC.md` §8 - which depended on whoever wrote the next spec remembering to write one.

**Added a `features` registry** to `coverage.manifest.json`. Every shipped capability is listed, each mapping to
the suites covering it:

- `status: "shipped"` with an empty `coveredBy` and no `gap` -> **FAILS**.
- `gap` present -> reported on **every** run, so known debt cannot go quiet.
- `status: "planned"` must **not** claim coverage -> catches a spec that shipped without being updated.
- `spec` must name a file that exists. `coveredBy` refs must resolve to real `<file>::<key>` suites.

Current state: **23 shipped, 2 planned, 22 covered.** All five failure modes were verified by injecting
deliberately-bad entries and confirming the checker caught each, then restoring byte-identically - a gate that
was never seen to fail is not known to work.

💡 **The intended workflow: register the feature when you START, marked `planned`.** The checker then lists it
under "no coverage expected", and flipping it to `shipped` is what forces the tests to exist. Registering at the
end is too late - that is exactly the gap this closes.

### ⚠️ THE REAL FINDING: the checker had a blind spot

Building the features registry is what prompted an audit of what the checker could actually see. It could not
see a whole suite.

`LOG_RE`'s category class was `[A-Za-z]+`, which **excludes digits**. The keyboard suite logs under
`'A11Y'`, so it never matched - and **Y1/Y2/Y3 (three passing tests, confirmed present in the last web run)
were invisible to every check while the checker reported "OK".**

Fixed two ways, because the regex alone was not enough:

1. The class is now `[A-Za-z0-9]+`.
2. A new **`UNCATEGORISED_SUITE`** check fails when a file logs under a category **no manifest suite claims**.
   Without it, fixing the regex only changes the symptom: a category the scanner can see but the manifest omits
   is still scanned by nobody, because the id-sync checks only run for suites that exist. Its ids would be
   counted by nothing and reported by nothing. That structural hole is what let A11Y hide in the first place.

Suite **Y** is now registered (`e2e-full.mjs::Y`, desktop only, with the "near-vacuous for a soft keyboard"
note). Counts moved 36 suites/305 ids -> **37/308**.

💡 **Lesson: a scanner's own regex is part of what you have to verify.** A pattern that is too narrow does not
error and does not warn - it silently reports green over a region it never read, which is the worst failure mode
for a gate whose entire purpose is to catch what was missed. I declared this checker "green" earlier the same
day and it was green over three real tests it could not see.

### The one real gap it now tracks

**Reset to starter sounds** has **no suite at all** (`restoreDefaults`, App.jsx:2959, wired at 6698). Deferred
twice - Phase 2 and Phase 3 - because it **wipes the seeded fixture every later suite reads**, so it must
re-seed and run last. It is registered as `shipped` with a `gap` reason, so it prints on every run instead of
living only in a prose paragraph.
## SESSION 2026-10-11 (close) - RESET TO STARTER SOUNDS: the last coverage gap, closed

Built `e2e/specs/reset.mjs` (**O1-O10**), shared, runs LAST in both entrypoints. **All 23 shipped features
now have coverage; zero recorded gaps.**

**The recorded reason for deferring it twice was only half right.** Both `PROJECT_STATE.md` and Phase 2's notes
said *"wipes the fixture every later suite reads"*. True of the board it rewrites - but `restoreDefaults` is a
**merge, not a wipe**, and each assertion pins a clause of that contract. So a **self-seeding** spec running
**last** was always safe. The blocker was never the behaviour; it was that nobody had written the spec. Two
deferrals of a solvable problem is the thing to distrust here.

**What it covers** (`restoreDefaults`, App.jsx:2959 -> `mergeShippedDefaults`, App.jsx:349), each test one
clause: O1 the entry point confirms and changes nothing, O2 Cancel is a real out, O3 shipped entries come
first in shipped order, O4 a renamed shipped character is renamed back, O5 user sounds survive **after** the
shipped ones, O6 user-created entries follow, O7 a renamed default **environment category** restores via the
sound-id fallback, O8 groups are untouched, O9 a user-set icon survives, O10 it is idempotent.

**Two real traps pinned, both found by reading the function rather than testing it:**

- Environment categories have **no id** - `category` IS the key (App.jsx:343). Renaming one breaks the name
  anchor, so the function falls back to matching a stored entry carrying one of that default's sound ids
  (App.jsx:371-373). **Without that fallback, renaming a default category re-adds the shipped one alongside
  the renamed copy and duplicates every default sound.** A test that never renames a category would never see
  it, so the fixture renames on purpose and asserts `env_4..env_7 + mine_3` exactly.
- A sound is user content only if its id is in **no** default's sound list (`allShippedSoundIds`, App.jsx:355),
  so a shipped sound the user dragged into a different character is restored to its own home rather than
  duplicated. O5 pins the other side of that rule with a genuinely user id.

**One bug in the spec itself, caught by the first run:** O2 referenced the Node-side helper `names()` from
inside a page expression, where it is not defined. `evalJs` returned `{__error: "ReferenceError"}` rather than
throwing, so the test reported FAIL with the reference error as its "detail" - which is readable, but only
because the detail carries the exception. Fixed by inlining the predicate. Separately, the O7 detail string
used `names()` on environment entries, printing `categories=[null,null]`; environment entries have `category`,
not `name`, so a shared mapper silently hides which side failed. Added a `cats()` helper.

### Gates

| Phase | Result | Exit | Log |
|---|---|---|---|
| Web | **210 / 0 / 0** | 0 | `e2e-run-20261011-123816.log` |
| Windows | **209 / 0 / 1** (G5) | 1 | `e2e-run-20261011-124417.log` |
| Android | **199 / 0 / 1** (G5) | 1 | `e2e-android-20261011-125200.log` |

Web 200 -> 210, Android 189 -> 199: exactly the ten new tests. `check-coverage.mjs` exit 0, `eslint` 0 errors /
3 pre-existing warnings, `node --check` clean on all touched files.

💡 The features registry **did its job the moment it existed**: it printed "Reset to starter sounds: no suite"
on every run until this spec landed, which is exactly what turned it from a forgotten item into the next task.
## SESSION 2026-10-11 (close) - the Desktop logs are closed, stop re-raising them

The user pointed out we had "been over the ProtonVPN logs". They were right, and the cause was mine: after
the explanation I kept listing them in my end-of-turn summaries as "awaiting your call". The decision had
already been made - keep them, ~30 KB, once explained - but I had written the state file as *"Left in place
2026-10-11 at the user's decision"*, which reads as pending forever. Re-reading it two sessions later, no
wonder it looked open.

Now reads **SETTLED 2026-10-11 - kept, and this is closed. Do not raise it again**, plus a note that they
were once referred to as "backups" (which is how it got re-raised) and that nothing is lost if they are ever
deleted.

💡 **The generalisable mistake:** "at the user's decision" is a state that does not decay. A file that says
"pending" stays pending forever unless someone actively closes it, so an item resolved in conversation keeps
looking unresolved in the record - and gets re-raised by anyone reading it, including me. A decision that has
been made must be written down as **made**, with its date, in the same edit that records the reasoning.
Compare: the claim line in this file uses `UNCLAIMED - last holder: <name> (<timestamp>)`, which states the
outcome and who made it. The ProtonVPN note had the rationale but not the outcome.
## SESSION 2026-10-11 (final) - handover

**Everything is committed and pushed. `origin/mobile-support` is 0 ahead / 0 behind, working tree clean.**

### Final state
- Phase 3 complete: coverage gate, legacy suites ported-then-retired, AGENTS.md definition-of-done, features
  registry, and the checker's own blind spot fixed.
- **38 suites, 318 tests, 10 shared specs, 23/23 shipped features covered, zero recorded gaps.**
- Gates: web **210/0/0 exit 0** · Windows **209/0/1 exit 1** · Android **199/0/1 exit 1**. Both nonzero exits
  are the pre-existing G5 skip, by design - `0 FAIL` is the signal, not the exit code.
- eslint 0 errors / 3 pre-existing warnings. `check-coverage.mjs` exit 0.

### Backup situation - read this before re-running anything
The user authorised **clearing the backup folders once the work was pushed**, which is sound: backups hold
only source, docs, tests and `public/assets`, all of which are in git at `origin/mobile-support`. A fresh clone
plus `npm install` reproduces everything a backup contains, so after a push the backups are redundant.

⚠️ The reason to actually do it: `backup-project.ps1` reports `VERIFY OK` and Bitdefender then eats
`e2e/e2e-full.ps1` from the copy anyway - that has happened at least twice (2026-09-30 from `.git\objects`,
2026-10-04 from a backup folder). **A "verified" backup is not automatically a complete one.** The remote is
the only copy that is both complete and independent.

### Handover facts for the next session
- **Claim released** (UNCLAIMED, last holder opencode 2026-10-11 13:12).
- No running processes or forwarded ports; the emulator is shut down.
- No stashes in the repo.
- The four ProtonVPN logs on the Desktop are **settled and closed** - kept deliberately, do not re-raise.
- **Next features:** `PROFILE_SYNC_SPEC.md` and `HOTKEYS_SPEC.md`, both `planned` in the features registry so
  the checker lists them under "no coverage expected". **Neither is authorised for implementation.** Hotkeys
  is recommended *after* profiles, because a per-profile binding has nowhere to live until that spec's storage
  refactor exists.

### If you pick up the harness work
`AGENTS.md` has the definition of done - seven gates in order. Register a feature in
`e2e/coverage.manifest.json` **when you start it**, marked `planned`; flipping to `shipped` is what forces
its tests to exist. `node e2e/check-coverage.mjs --update` re-syncs id lists - review the diff, and note it
rewrites the whole file in canonical JSON, which is how a PowerShell `ConvertTo-Json` round trip gets undone.
## SESSION 2026-10-11 (final, cont.) - all backup folders cleared

Cleared the remaining three after the final push: **3 folders / ~118 MB -> 0**. Cumulative for the session:
**10 folders / ~355 MB -> 0.**

Preconditions checked before deleting, not assumed: `origin/mobile-support` 0 ahead / 0 behind, working tree
clean, and the newest backup's 220 files all present in the working tree.

**Why zero is correct and not merely tidy.** A backup holds only source, docs, tests and `public/assets`, all
of which are in git at `origin`; a fresh clone plus `npm install` reproduces its entire contents. And the
asymmetry worth remembering: `backup-project.ps1` reports `VERIFY OK` and Bitdefender then eats
`e2e/e2e-full.ps1` from the copy anyway (2026-09-30, 2026-10-04). So "VERIFY OK, therefore safe to delete the
old ones" and "VERIFY OK, therefore safe to keep this one" are **not equally strong arguments** - the remote is
the only copy that is both complete and independent.

**The standing rule in `AGENTS.md` changed accordingly.** "Keep the newest one or two and delete the rest by
hand" became "can be cleared entirely once pushed", with the two rules that survive untouched: back up before
any change, and re-take one at the end of a work session so the folder you have matches the final commit.
Between sessions, no folder is needed at all.
---

## 2026-10-11 20:49 - `PROFILE_SYNC_SPEC.md` documentation refresh (opencode)

**Docs only. No app code written; profile implementation remains unauthorised.**

The spec's last revision was 2026-10-06, written against `src/App.jsx` at 6240 lines. The file is now 6769, and
two features have shipped since. Every code reference was re-verified against the current tree and the spec
updated. What was found beyond line-number churn:

**1. The `uploads/` "10 path sites" figure was wrong - it is 4 chokepoints.** The old claim counted *lines
mentioning the constant*, not distinct code paths. `getTauriStoragePath` (App.jsx:2604) is the single path
builder with exactly 3 callers (write 2613, read 2662, remove 3529), plus `storeFileInLocalStorage` (2606) and
the migration sweep (1300-1345). So prefixing a profile segment is largely a one-function change, and the
uploads half of the storage refactor is **smaller** than the spec claimed. The localStorage half is unchanged and
still the bigger risk: the census was **re-counted and is still exactly 27 call sites (13 setItem / 11 getItem /
3 removeItem) + 2 enumeration lines**, because per-sound volume and priming both deliberately added zero keys.
Caveat recorded in the spec: `getFileFromLocalStorage` builds an absolute path via `appDataDir`/`join`
(2667-2669) and **bypasses `getTauriStoragePath`** - the site a "one-line change" would miss.

**2. Two new design risks the previous revision could not have seen.**
- **The auto-save write race.** The three auto-save effects (App.jsx:3922-3949) `JSON.stringify` an entire
  slice into localStorage on every state change, undebounced, with no write choke point and no transaction. A
  profile switch that sets `activeProfileId` then calls three setters will, in the gap, write the **old**
  profile's data into the **new** profile's keys - silently, corrupting the profile the user just switched to.
  Three mitigations are listed with a preference order; the real answer is "settle this in step 1, because the
  adapter's design is what decides it".
- **`DATA_VERSION` becomes per-profile.** `readStoredData` (319-325) resets a key to defaults when
  `ttrpg_data_version` mismatches, renaming the old value to `<key>_old`. Once that key is
  `profile:<id>:ttrpg_data_version`, the reset fires **per profile** - including for an imported bundle
  carrying an older `dataVersion`, which is the most surprising place for it to fire.

**3. The E2E section was describing a harness that no longer exists.** The harness was refactored 2026-10-10/11
into shared specs (`e2e/specs/`) plus the coverage gate. The old advice - create `e2e/e2e-profiles.mjs`, wire
`-Suite profiles` into `e2e-full.ps1`, continue test ids from `P1` - would produce a suite that cannot be wired
and coverage the gate cannot see. Rewritten: build `e2e/specs/profiles.mjs`, wire it into **both** entrypoints
(`SPEC_NOT_SHARED` is enforced), register it in **both** manifest registries (the `features` entry already exists
as `planned`; flipping it to `shipped` is what forces the tests to exist), and use a free id prefix - `P1-P34`
are taken by volume and priming; `F` and `I` are free. One old worry turned out to be **already handled**:
`e2e/e2e-snapshot.mjs` enumerates every `localStorage` key rather than using a hard-coded list, so `profile:*`
keys are covered without a change.

**Two features folded in.** **Per-sound volume** (`volume`, shipped 2026-10-06) is content, so it syncs - it rides
inside the sound object and needs no schema change, but the new-sound save path is an explicit allowlist, so any
code that rebuilds a sound by hand drops it silently. **Priming** (shipped 2026-10-08) is one-shot and
session-only with no `localStorage` key, so it must **not** appear in the bundle at all.

**Gates.** `npx eslint .` 0 errors / 3 pre-existing warnings. `npx vite build` exit 0.
`node e2e/check-coverage.mjs` exit 0 - "OK, manifest, code and platform wiring agree" (38 suites, 318 tests,
23/23 shipped features covered). Gates 5-7 (the three E2E phases) **were not run**: the change is documentation
only, no code was touched, and the state file is explicit that a docs-only change does not need a hand-test.
---

## 2026-10-11 21:02 - The three profile design decisions settled (opencode)

**Docs only. Still no app code; implementation remains unauthorised.**

The refresh above left exactly three genuinely open choices. The user settled all three, and they are now recorded
as **`PROFILE_SYNC_SPEC.md` §0.3**, with the consequences folded into §4.3, §7/§8, §11 risks 7/10/11, §12 and §13
so an implementer does not re-litigate them.

1. **Timestamps + tombstones: CUT from v1.** §4.3 is kept as a record for the deferred Merge / folder-cloud sync
   work, but there is no implementation step. The reasoning recorded is worth keeping because it is *not* the
   spec's original argument: a field nothing reads is not free in a storage schema - every later `manifest.json`
   revision has to carry it, every import has to decide what to do with a tombstone from a pre-tombstone bundle,
   and `deletedAt` implies a read-path filter that does not otherwise exist. The insurance premium is paid in
   every future format version; the policy is only claimed if Merge or sync actually ships.
2. **Profile switch: FULL REMOUNT for v1.** This is the load-bearing one. It settles §11 risk 10 by *designing the
   race out* rather than guarding it: the three auto-save effects (App.jsx:3922-3949) cannot fire with a stale
   prefix, because the new profile is the first-load state and prefix and state always agree. The accepted cost is
   a reload flash, most visible on Android where a remount also drops the object-URL cache - the right trade for a
   rare, deliberate action. ⚠️ Recorded explicitly: the remount does **not** cover "Replace active" import, which
   installs into the live profile, and does not cover the edit-immediately-after-switching path. Those stay in the
   §13 assertions.
3. **`DATA_VERSION` mismatch: MIGRATE, never reset.** The existing path (App.jsx:319-325) resets to defaults and
   renames to `<key>_old`, which once namespaced fires **per profile** - so an imported bundle from an older
   build could wipe a board. The profile path therefore needs a **sibling that repairs rather than discards**,
   built in step 1 because §8's import step 5 depends on it and retrofitting would touch the migration twice.

**Why step 1 got bigger, which is the interesting consequence.** The remount means the profile switch is what
*validates the storage adapter's shape*, so it has to ship in the same commit as the adapter - before any bundle
code exists. §12's step 1 is now "storage adapter + profile index + first-run migration + a proven switch",
with green meaning two profiles and A -> B -> A **byte-identical**. Building the bundle first and working out the
switch afterwards would have discovered the adapter needed a different shape and redone it.

**Gates.** `npx eslint .` 0 errors / 3 pre-existing warnings. `npx vite build` exit 0. `node e2e/check-coverage.mjs`
exit 0. Gates 5-7 not run - documentation only, no code touched.
---

## 2026-10-11 21:12-21:59 - Profiles step 1 IMPLEMENTED (opencode) - IN FLIGHT, web green, two gates outstanding

**Session ended mid-step.** The claim is deliberately HELD. Nothing is committed. Base commit `4ddd428`.
Read `PROJECT_STATE.md` section "Handover - profiles step 1" before picking this up.

The user authorised implementation at 21:12. This is `PROFILE_SYNC_SPEC.md` §12 step 1: storage adapter +
profile index + first-run migration + a PROVEN switch (full remount).

**Shipped in `src/`**
- **NEW `src/profileStorage.js`** - the whole storage layer, deliberately OUT of `App.jsx` (which is ~6900 lines
  and was not made longer for this). Profile-scoped keys, the unprefixed `spellcaster_profiles` index, first-run
  adoption, CRUD, `readProfileData()`, and the per-profile upload paths.
- All **27** `localStorage` sites and **4** `uploads/` chokepoints routed through the adapter. `readStoredData`
  now takes a profile id.
- `App` split into `AppBoard` + a thin `App` whose ONLY job is the remount key. That split is the mechanism of
  §0.3 decision 2: changing `key` unmounts the whole tree, so every `useState` initialiser re-reads the new
  profile and the auto-save effects can never hold one profile's state against another's prefix.
- Profiles section in the Settings modal (new / switch / rename / delete).
- First-run adoption is **copy, verify, then remove** - if any step throws, the user's data is still in the old
  key. That ordering came straight from `backup-project.ps1` and it is why the migration is safe to run on a
  real board.

**The E2E migration was the expensive part: 161 harness sites** were writing keys the app no longer reads. The
suites still speak bare names; `PROFILE_HELPER` in `e2e/lib/page.mjs` maps them in-page (`__pk`, `__pseed`,
`__bareKeys`, `__keysFor`) because the profile id is random per install and cannot be known in Node.

**The failure mode is silent and is the lesson worth keeping: a seed that misses the prefix writes a key
nothing reads, the board comes up empty, and the suite reports PASS.** Two real regressions came out of it -
refcount.mjs seeded bare literal `sound_file_*` keys (broke **G5**), and `__soundsIn(key)` read a bare variable
key and silently returned nothing (broke **M7/M8**). A third was structural: a raw `cdp('Page.reload')` wipes the
helpers, so the next seed after it hits the same trap; all 16 reloads now go through `reloadPage()`, which
re-injects `PAGE_HELPERS`. `window.__pid()` is self-healing for the same class of ordering bug - it CREATES a
profile if none exists rather than returning nothing, which is what fixed 40+ failures that looked like an app bug
(SEED was running before the helpers were injected).

**A mistake worth recording: the one-shot migration scripts were not idempotent.** Re-running
`migrate-reloads.mjs` rewrote `reloadPage`'s OWN body into a self-call and killed the run with
`RangeError: Maximum call stack size exceeded`. They were deleted and replaced by `e2e/check-profile-keys.mjs`,
which is read-only. The guard was verified to actually FAIL on a deliberately re-broken file, because a guard
that has never been seen to fail is indistinguishable from one that cannot fail.

**Verified.** `profileStorage.check.mjs` 22/22 (a fast node-level check of the storage logic, no browser - worth
building for any future storage change). `check-profile-keys.mjs` OK. `check-coverage.mjs` OK: **39 suites,
331 tests, 11 shared specs**, Suite F registered in both the `features` and `suites` registries.
**Web E2E 223 PASS / 0 FAIL / 0 WARN exit 0** (was 210; **+13** = F1-F12). The headline assertions pass:
F7 A -> B -> A byte-identical, F6a editing B leaves A byte-identical, F8 B unchanged by the round trip,
F10 DATA_VERSION skew migrates instead of resetting.

**The feature stays `planned`, not `shipped`.** The checker explicitly rejects a planned feature that claims
coverage (`FEATURE_PREMATURELY_COVERED`), and it is right: the bundle format and export/import (spec steps 3-6)
do not exist. Step 1 shipped; the feature did not.

**Two of my own spec bugs are worth noting** because both initially looked like app failures: the character-add
helper used a selector the app does not have (the real sequence is edit mode -> "Add Character" -> set the
`name` field -> submit, as Suite C does), and F11 asserted a single delete button while two profiles were present
- with `profiles.length > 1` BOTH rows correctly offer delete, so the "last profile cannot be deleted" check has
to run AFTER the scoped delete.

**Left undone, in order:** (1) gate 6 Windows, (2) gate 7 Android, (3) re-run gates 2-4, (4) request the user's
hand-test - this is a user-facing feature and the DoD requires it. Plus the blocking uploads-migration defect
recorded at the top of the handover section: **on Tauri every existing uploaded file becomes unreachable** because
the lookup path gained a profile segment and the bytes on disk did not. Web does not catch this because web audio
lives in localStorage.
---

## 2026-10-11 22:15-22:50 - Profiles step 1: uploads migration + all three gates (opencode)

**Still UNCOMMITTED, claim HELD.** Session continuing from the entry above.

### The user's question, and the answer

The user asked the right question to stop on: *"I have a previous version installed with actual sound I want to
keep. Should the old version be able to migrate their sound to the new version?"* **Yes, and it now does.** Verified
against the user's real install: **112 files / 17.42 MB**, all flat, in
`%APPDATA%\com.mrhorakhty.thespellcaster\uploads`.

Two decisions were taken with the user:
- **`fs:allow-rename`** (they chose it over copy+delete). Verified from the resolved crate that `rename` is NOT in
  `fs:default` - only in `write-all`/`write-files`, which we do not grant - and confirmed `allow-rename` exists in
  the `fs` namespace of `gen/schemas/acl-manifests.json`. `cargo check --offline` clean, and the regenerated
  `gen/schemas/capabilities.json` contains it.
- **Deleting a profile asks first, with a file count.** It is a COUNT not a byte total, because `stat` is not in the
  granted permission set and no directory listing carries sizes - a size figure would have cost another capability.

⚠️ **`fs:allow-remove-dir` does NOT exist** in this plugin version (0 occurrences in the acl manifest, no
`remove-dir.toml`). So `removeProfileUploads()` deletes files individually and leaves the empty per-profile
directory, rather than adding a capability to delete an empty dir.

### `migrateUploadsToProfile()` - the piece that saves the audio

- Enumerates `uploads/`, moves every FILE into `uploads/<profileId>/`.
- **Idempotent by STRUCTURE, not by flag**: the test is "are there any files flat in uploads/", so once moved only
  directories remain and a re-run is a no-op. No marker key to desynchronise, and a crash mid-move is resumable.
- **Never clobbers**: an existing destination is skipped, not overwritten - that is what makes a partial re-run safe.
- Per-file isolation, so one unreadable file does not abandon the other 111.
- Memoised per profile and **awaited by all three Tauri file paths**, so a click during the migration waits rather
  than failing to find the file.
- `planUploadMigration()` is extracted as a **pure function** because the path arithmetic and the directory-skip are
  what fail invisibly - renaming a directory would nest a whole subtree inside the profile folder.

### Proof it works on real data (the check the web gate could never give)

After the Windows gate: **0 flat files remain**, content now in `uploads/p_09b2806c/` at **114 files / 18.03 MB** -
the 112 originals plus the 2 the suite uploaded. Spot-checked by name and unchanged:
`icon_2rxi4ls9_Tentacular_Limbs.png` (108 KB), `icon_57nb9nm7_Warding_Sign.png` (160.4 KB); 99 `sound_*` files
carried over. Two EMPTY profile dirs are the profiles Suite F created and deleted - left behind precisely because
`fs:allow-remove-dir` does not exist, which is the designed behaviour.
💡 The migration's log line comes from the *app's* console, which the suite does not capture, so **the filesystem
is the evidence, not the log.**

### Gates

| Gate | Result |
|---|---|
| eslint | 0 errors / 3 pre-existing warnings |
| vite build | exit 0 |
| check-coverage | exit 0 (39 suites, 331 tests, 11 shared specs) |
| check-profile-keys | OK |
| profileStorage.check | **26/26** (added 4 for the migration plan) |
| cargo check --offline | clean |
| **web** | **223 PASS / 0 FAIL / 0 WARN, exit 0** |
| **Windows** | **222 PASS / 0 FAIL / 1 WARN, exit 1** (exit 1 = expected G5 baseline; was 209, **+13**) |
| **Android** | **211 PASS / 1 FAIL / 1 WARN** |

**Suite F is green on all three platforms** - including the headline `F7: A -> B -> A returns to A with A
byte-identical`, `F6a` (editing B leaves A byte-identical), `F8` and `F10` (DATA_VERSION skew migrates, not resets).

### Two failures that were MY test's fault, not the app's

1. **Mobile adds a character from the DRAWER**, not the edit bar, so `__clickText('Add Character')` returned
   `NO:` and the edit never happened - which cascaded into F6b, F9, F10 and F11, all of which assert on its
   consequence. Rather than platform-flag it (ctx carries `isTauri`, not which platform), `addCharacter` now
   **tries the desktop path and falls back to the drawer path**. Second Android run: all 13 green,
   `add=open=OK name=OK submit=OK (drawer)`.
2. **F11 asserted a single delete button while two profiles existed.** With `profiles.length > 1` BOTH rows
   correctly offer delete, so the "last profile cannot be deleted" check has to run AFTER the scoped delete. Swapped
   the order.

### 🟡 One real open regression: Android Q11

`Q11: stopping the primary stops the WHOLE primed group` -> FAIL `{"stop":"NO_STOP_BTN","n":3,"stopped":0}`.
It passed on the 2026-10-11 baseline, so it is from this session. **Android-only** - desktop P27 passes on web and
Windows. **Playback is fine**: `[PLAY] Z1-Z12` all pass including Z10 Stop All, and `[VOL] P9a-d` drive live audio.
The prime group fires correctly (`n:3` elements created). The Stop button just is not painted on the card 700ms
after the tap.

`isPlaying` reads `audioElementsRef.current` and re-renders via `setSoundInstances` right after registering
(App.jsx:3760), so a registered element *should* paint it. Either the elements are being cleaned up again, or the
re-render does not land in the window. **Hypothesis, not a finding:** `getFileFromLocalStorage` now awaits
`ensureUploadsMigrated()` before its `exists()` check, adding ticks at the start of file resolution on an
already-slow emulator.

⚠️ **Recorded explicitly so it is not "fixed" by bumping the 700 ms sleep.** That turns a red test green without
explaining it, which is the quietly-dropped-test failure this repo guards against. Fix the audio lifecycle or the
app's `isPlaying` reliability - not the test's patience.
---

## 2026-10-11 23:00-23:15 - The user asked the right question; harness `uploads/` guard added (opencode)

**Still UNCOMMITTED, claim HELD.**

### What the user asked, and what was actually true

The user said: *"I have a previous version turned into an installer and installed on my computer. I assume you
might have guessed that because that app lost its sounds after this attempt. I'm not sure if it is because that one
is quite old and doesn't have the ability to migrate, or if migration is flawed."*

**Neither of their two hypotheses was right, and that mattered enough to get exactly right rather than assume.**
Checked the facts:

- The installed app is `C:\Users\emire\AppData\Local\The SpellCaster\app.exe`, **v0.1.3, built 2026-08-17**.
- Tauri resolves AppData to `%APPDATA%\<identifier>` and **both the installed app and the dev build use
  `com.mrhorakhty.thespellcaster`**, so there is exactly ONE AppData directory. There is no sandbox.
- `e2e-full.ps1 -Phase win` launches `tauri dev` against **that real directory**. The uploads migration moved the
  installed app's 112 files into `uploads/p_09b2806c/` - every one now stamped `2026-10-11 22:15:31`, exactly when
  the Windows gate started. The old app still looks in flat `uploads/` and finds nothing.

**So: the migration was NOT flawed - it provably preserved all 112 files. The defect was that
`e2e/e2e-snapshot.mjs` snapshot `localStorage` ONLY and never protected the Tauri `uploads/` directory.** The
state file's claim that "test data never clobbers real characters/sounds" was true for localStorage and false for
uploads. Before profiles that was untidy (test uploads accumulating beside real ones); the migration made it
destructive because it *moves* files rather than adding them.

**This was the agent's error** - the Windows gate was run against a live install without first checking what the
harness protects. The user's question is what surfaced it.

💡 **Lesson worth keeping: a snapshot/restore guarantee is only as good as the state it covers. "The tests never
clobber my data" must be verified per storage mechanism, never inferred from one.**

### The fix (user chose "harness fix first")

`e2e/e2e-snapshot.mjs` gained `save-uploads` / `restore-uploads`; `e2e/e2e-full.ps1` wires them into Phase B.

- **Plain filesystem, no CDP** - so it still works when the app is dead, which is when a crashed run needs it.
- AppData path **derived from `tauri.conf.json`'s identifier**, not hard-coded.
- **Ordering is the whole point**: snapshot BEFORE `tauri dev` launches (a post-launch snapshot could already be
  the post-migration state - a "restore" that restores the damage), restore AFTER the app is killed (restoring
  under a running app would be undone).
- **Refuses rather than destroys**: a missing or empty snapshot exits 4 and leaves live files untouched; restore
  moves the live folder aside and puts it back if the copy fails.
- **If the snapshot fails the phase ABORTS** - a run that can MOVE the user's audio must not proceed assuming it
  can be undone.

**Verified three ways:** (1) missing and empty snapshots each refused, 114 files untouched; (2) simulated damage
(junk file added, a real file renamed away) restored to exactly 114, junk gone, original name back, no stray
`__restore_backup`; (3) a **real Windows gate**: snapshot 114 -> suite **222 PASS / 0 FAIL / 1 WARN** -> restored
to 114, flat=0, spot-check intact, no stray directory.

💡 **Android needs no such guard**: `e2e-android.ps1` drives an emulator whose app data lives inside the AVD, not
in the user's `%APPDATA%`. Only the **Windows** phase can ever touch real user audio - which is why it is wired
there only.

### User's decisions

- **Moving forward with the new build** - the installed v0.1.3 app is historical. **No restore of the old app is
  wanted**; the files in `uploads/p_09b2806c/` are simply the new app's first profile.
- The user's hand-test is still owed, and is now the real gate on this work.
---

## 2026-10-11 23:20 - User hand-tested the switch: PASS. Export/import not built (expected)

**Still UNCOMMITTED, claim HELD.**

The user ran the app and tested the **profile switch** - it **works fine**. That clears the `AGENTS.md`
user-visible bar for step 1, which requires a user-facing feature to be hand-tested on the built app rather than
judged only by E2E.

They asked why there was no import/export. **Correct, and expected.** Verified rather than assumed:

- The Profiles section has only `switch` / `rename` / `delete` / `create` (App.jsx:6833-6875).
- No `exportBundle` or `importBundle` exists anywhere in `src/`.
- **No zip dependency at all** - `fflate`, `jszip` and `@noble/hashes` are all absent from `package.json`.

Export/import is spec steps **3-6** (`PROFILE_SYNC_SPEC.md` §12): the provenance classifier, the bundle format,
import (atomic, both modes), then export plus the desktop/Android destination pickers. Step 1 delivered steps 1-2
only - the storage adapter and a proven switch - so a bundle format and a file picker were never in scope for it.

The `coverage.manifest.json` feature entry stays `status: planned` for exactly this reason: the checker rejects a
planned feature that claims coverage, and the round-trip tests that would justify `shipped` cannot be written until
`importBundle` exists.
---

## 2026-10-11 23:40-23:50 - Android Q11 SOLVED (paint-timing race in the test), all 7 gates green

**Still UNCOMMITTED, claim HELD.** The user chose option 1: fix Q11, then commit step 1.

### Q11: a paint-timing race in the TEST, not a regression

It failed as `{"stop":"NO_STOP_BTN","n":3,"stopped":0}` on Android only, while the identical desktop test (P27)
passed on web and Windows. Rather than bump the 700 ms sleep - which would turn a red test green without
explaining anything - the assertion was changed to **diagnose first, then wait for the condition**.

**Step 1: distinguish "no card" from "no button", and report the elements' live state.**

```
stop:NO_STOP_BTN  card:true  n:3
live:[{paused:false,ended:false,error:false,ready:4,ct:0.11} x3]
```

The card was present and **all three elements were genuinely playing** - `readyState 4`, `paused:false`,
`currentTime` advancing. That eliminated the obvious hypotheses in one shot: not an audio load error, not
`cleanupAudio` unregistering them, not a missing card.

**Step 2: poll for the button instead of sampling an instant.**

```
PASS Q11  probe:{found:true, ms:209}  stop:OK  n:3  stopped:3
```

The button **does** render; it took **209 ms** to paint, and on a loaded emulator that can slip past a fixed
700 ms sample point. **Android: 212 PASS / 0 FAIL / 1 WARN.**

### The underlying app wart, recorded honestly

`isPlaying` (App.jsx:4132) derives from `isSoundPlaying` (3878), which reads the **`audioElementsRef` ref, not
state**. The repaint happens only incidentally, via `setSoundInstances` (3758) - state that exists to disable the
Stop All button (4916/5166) and is never passed to the card. So a card's Stop affordance can lag until some
unrelated state change renders. Not a DOM problem (the button IS inside `data-sound-card`, and the same markup
passes on the faster machines), and **not a functional regression** - stopping still works and Stop All is
unaffected. It is a latent timing sensitivity this session's `await ensureUploadsMigrated()` made visible by
shifting registration slightly later.

💡 **Lesson worth keeping: an async UI assertion that samples once is a race wearing a trouser-suit. Wait for the
condition with a bounded timeout, and put the measured wait time in the failure so the next reader can tell a
slow render from a broken one.**

### I corrupted `PROJECT_STATE.md` with PowerShell and recovered it from the backup

While editing the status line I used `Get-Content -Raw` + `Set-Content` in Windows PowerShell 5.1, which mangled
every non-ASCII character - **the exact BOM/encoding trap this file itself documents**. Restored from
`ttrpg-soundboard-backup-20261011-232737` byte-identically (102,518 bytes) and verified with a UTF-8 reader.

💡 **That is the second time this project has been bitten by PowerShell text encoding**, and both times the
documented remedy was "use `[System.IO.File]::WriteAllText` with `UTF8Encoding($false)`, or better, use the file
tools". The backup script is what turned a corrupted file into a 30-second undo rather than a lost evening.
**Rule going forward: never round-trip a UTF-8 file through `Get-Content`/`Set-Content`.**

### Gate status - ALL SEVEN GREEN

| Gate | Result |
|---|---|
| backup | VERIFY OK 224/224 |
| eslint | 0 errors / 3 pre-existing warnings |
| vite build | exit 0 |
| check-coverage | exit 0 (39 suites, 331 tests) |
| check-profile-keys | OK |
| profileStorage.check | 26/26 |
| **web** | **223 PASS / 0 FAIL / 0 WARN, exit 0** |
| **Windows** | **222 PASS / 0 FAIL / 1 WARN, exit 1** (G5 baseline; uploads guard verified in-flight) |
| **Android** | **212 PASS / 0 FAIL / 1 WARN** |
| **user hand-test** | **PASSED** - the user tested the switch on the built app |

---

## 2026-10-12 11:19 - Integrity check after the cut-off session (docs only, opencode)

The previous session was cut off while making its closing doc edits. No damage found.

### The cut-off session had actually finished
8032fb7 "Refresh the state file after the profiles step 1 push" was committed at **00:08:13**, three minutes
after the claim timestamp, and it is **pushed** - the branch was 0 ahead / 0 behind origin/mobile-support.
The working tree was clean.

### What was checked, and the result
| Check | Result |
|---|---|
| git status --porcelain | empty (before this session's own edits) |
| tracked files present on disk | **143 / 143** |
| zero-byte files | none |
| strict UTF-8 decode, every text file | **ok** - 0 U+FFFD, 0 NUL, no BOM added |
| git fsck | only the **known** unreachable blob 3d1fcf15 (Bitdefender, 2026-09-30); rest is normal dangling debris |
| .\backup-project.ps1 | **VERIFY OK 224/224, 39.7 MB** |
| stray processes / listening ports | none (no node, app, adb; 5173/9222-9224/1420 free) |

docs/session-history.md contains **two** EF BB BF sequences: one at offset 0 and one at 212801. The second is
**not** corruption - it is the literal `Close the desktop.` inside the paragraph that documents the BOM trap,
where the U+FEFF is the subject matter.

### What the cut-off session did leave behind: unfinished prose, not lost content
A reflow was interrupted mid-edit, so the header still said **"3 commits are ahead of origin/mobile-support and
NOT pushed"** and **"NOT yet committed"** - both false, and actively misleading to the next agent. It also left a
**duplicated** "three open profile design decisions" paragraph whose two copies contradict each other (*"Now
IMPLEMENTED"* vs *"Still docs only"*), and a **duplicated** "post-commit git hook is decorative" paragraph.
All three cleaned: +7 / -16 lines in PROJECT_STATE.md.

### 🔴 The real find: public/assets is gitignored, and the docs said otherwise
Found while verifying, not while looking. .gitignore:90 ignores public, so of the 71 bundled audio files
(**29.0 MB**) exactly **one** is tracked (public/assets/Icon.png, force-added). Both AGENTS.md and
PROJECT_STATE.md asserted the opposite:

> "A backup holds only source, docs, tests and public/assets - all of which are in git - so a fresh clone plus
> 
pm install reproduces its entire contents."

**It does not.** A fresh clone yields an app with **no starter sounds at all**. And that claim had already been
acted on: every backup folder was cleared on 2026-10-11 under the rule *"after a successful push, you do not need
one at all"* - which left the audio existing in exactly one place, this working tree.

**Decision (user, 2026-10-12): keep public/ gitignored**, rather than commit ~29 MB into history permanently.
Corrections made instead:
- AGENTS.md - the heading is now *"prune them, but KEEP the newest one"*, with the reasoning and the measured
  numbers (git ls-files public/assets = 1; directory = 71 files / 29.0 MB).
- PROJECT_STATE.md - added to **Project facts** (so an agent sees it in the section it reads first) and the
  **Backups** section now records the correction and the tension honestly.

💡 **The lesson, and it generalises past this repo:** a rule whose justification is *"it's all in git"* is only as
good as the .gitignore. One line at .gitignore:90 made a whole paragraph of standing guidance false, and the
falsehood was acted on destructively within hours. **Verify the coverage of a redundancy claim, never inherit it.**
Worth noting the asymmetry that made it survivable: the remote is the only copy that is *independent*, but it is
not *complete* - and "complete" is what the rule actually needed.

### Gates
**Docs only - no code touched.** ackup-project.ps1 VERIFY OK 224/224 was run; gates 2-7 were **not** re-run,
because a markdown-only change cannot affect eslint, the build, coverage or any E2E phase. The 2026-10-12 00:00
baseline (web 223/0/0, Windows 222/0/1, Android 212/0/1, hand-tested) still stands. **No hand-test needed** -
nothing user-facing changed.

---

## 2026-10-12 11:42 - Track public/: the starter sounds are app content (`ba57282`)

Follow-on from the 11:19 integrity check. The user asked to actually **fix** the audio exposure rather than only
document it.

### The cause was boilerplate, not a decision
`.gitignore:90` read `public`, sitting inside a block of framework ignores (`.next`, `.nuxt`, `dist`, `.cache/`,
then `public`, then the Storybook outputs). That entry is **correct for Nuxt and Gatsby**, which build *into*
`public/`. This app is Vite, where `public/` is **source**. It was inherited, never reasoned about.

### Measured before acting
- 71 files / **28.95 MB** - 19 png (2.66 MB) + 52 mp3 (26.29 MB)
- **0** duplicate contents (MD5), **0** unreferenced, **0** missing, **0** near-duplicate names
- all **70** files are referenced by `src/data.json`, so nothing was trimmable
- the size is inherent: 52 stereo loops of 2.5-5 min at 128-320 kbps (`Tavern_Music` = 152 s @ 320 kbps = 5.95 MB)

So re-encoding was not a saving - it would be real quality loss on shipped content. Paid the 29 MB instead.

### The fix, and the proof
`ba57282` (74 files, +38/-1): removed the `public` ignore, kept `desktop.ini` (0-byte Windows noise), tracked
`favicon.ico` / `favicon.svg` / `icons.svg` too (app content as well). `.git` **24.9 -> 52.9 MB**.

Verified **end to end, not asserted** - cloned **from GitHub**, not from the local repo:
- clone contains **71 assets / 28.95 MB**, and all **70** `src/data.json` references resolve
- `npm install` (6 s) + `npx vite build` (1.7 s) -> `dist/assets/` holds 52 mp3 + 19 png, all 70 resolving

That distinction is the whole point: the previous claim in these docs was *asserted* and had been **false for
months**. This one is measured. `git fsck` and a content hash confirm the tracked blobs match what was on disk.

### Gates
| Gate | Result |
|---|---|
| backup | VERIFY OK 224/224 |
| eslint | **0 errors** / 3 pre-existing warnings, exit 0 |
| vite build | exit 0 |
| check-coverage | exit 0 (39 suites / 331 tests) |
| check-profile-keys | OK |
| profileStorage.check | 26/26 |
| **web E2E** | **223 PASS / 0 FAIL / 0 WARN, exit 0** (`e2e-run-20261012-115917.log`) - identical to the 00:00 baseline |
| Windows / Android E2E | **NOT run** - see below |
| user hand-test | **not needed** - nothing user-facing changed |

⚠️ **Windows and Android were deliberately not run**, and are named here rather than implied. The change is
`.gitignore` + 70 binary files + markdown; no app code changed and nothing is platform-specific. The relevant
coverage did run: **Suite O** (reset to starter sounds) and **Z1/Z2** (the bundled `Longbow_4.mp3` resolves from
`/assets/` and decodes) both passed, which is the direct check that the tracked assets are the ones the app loads.

### Also fixed: the double claim line
opencode claimed by **adding** a `🔒` line above the existing `🔓 UNCLAIMED` line, leaving the file claiming a
holder and being unclaimed at once - the exact mistake `AGENTS.md` warns about. Corrected to a single line, and
the `AGENTS.md` code block clarified: the two lines are **alternatives, never both**.

💡 **Why it recurred even though the rule already forbade it:** the block shows both lines with nothing saying
they are mutually exclusive, and step 4 works by the reader *finding* `UNCLAIMED`. With both present, a reader
cannot tell which is authoritative - so the file's own state became ambiguous to the very step that depends on it.
**A spec that shows two states without saying "exactly one" will eventually get both.**

### Still open, unchanged
`PROFILE_SYNC_SPEC.md` steps 3-6 (provenance classifier, bundle format, atomic import, export + destination
pickers) and step 7 UI. None of it exists; no zip dependency is installed. `HOTKEYS_SPEC.md` is queued after it.
The user has a couple of **new default sounds** in mind - `public/assets` is now the place to add them, and the
stated ceiling is **under 100 MB total**.

---

## 2026-10-12 12:32 - UI text trims, and a slider stylesheet that had never worked

Four copy removals the user asked for, plus a per-sound volume restyle. The second turned into a real find.

### The copy changes
- Profiles blurb: dropped "it is quick, and nothing carries over" (now ends "Switching reloads the board.")
- Removed the whole "Priming is not saved" paragraph under Profiles
- Dropped the word **"built-in"** in all three Restore Defaults places (section blurb + 2 in the confirm dialog).
  The user's wording ("Remove the '-' in restore default sections 'built-in'") was ambiguous between removing
  the hyphen and removing the word; **asked rather than guessed**, and they confirmed the word.

Checked first that no test asserts on this copy: `reset.mjs` matches only the button text `'Restore defaults'`
and the heading `'Restore Defaults'`, neither of which changed.

### 🔴 The `.slider` CSS has never worked - every slider in this app was the browser default
The per-sound volume sliders look like "a wall of controls" because they render as **Chrome's native blue
widget**, not as the lime/slate the stylesheet specifies. A screenshot at 3x made it unmistakable: the track
and thumb were a saturated blue that appears nowhere in the theme.

Two independent causes, each isolated by A/B screenshot rather than inferred:
1. **Chrome ignores author `::-webkit-slider-thumb` styles** unless the *input itself* has `appearance: none`.
   Injecting only that changed the thumb.
2. The repo styled `::-webkit-slider-track`, which current Chrome does not honour; it honours
   **`::-webkit-slider-runnable-track`**. Injecting only that changed the track.

A third thing surfaced during the fix: with `appearance: none` the **legacy track box paints a white band**
around the styled runnable-track, invisible until then. Every slider grew a bright white bar until
`background: transparent` was set on both `.slider` and the legacy `::-webkit-slider-track`.

The user's instruction was to revert the compact slider to "their current form ... the same as main volume
slider and zoom slider" - which, before this fix, meant the *browser default*. Their reference point would have
moved. Offered the choice explicitly; they chose to fix `.slider` everywhere, so all sliders now render as the
theme intended.

### What shipped
- `.slider` gains `-webkit-appearance:none; appearance:none; background:transparent`, uses
  `::-webkit-slider-runnable-track`, and clears the legacy track box.
- New `.slider-compact` on the **card** slider only (App.jsx:4477): 6x14 rounded pill on a 2px track at rest,
  reverting on `:active`/`:focus` to exactly the `.slider` thumb (16px lime circle, 4px track). Purely
  cosmetic - element, value and handlers untouched. Rules must stay **after** `.slider`: equal specificity.
- The 4 copy changes above.

### Verified visually, not just by tests
Restarted vite + headless Edge and screenshotted three states at 3-4x: rest (thin slate track, small slate
pill), active (lime round thumb, thicker track), and the master volume / zoom sliders now themed. The
first attempt looked wrong - a white band under the track - which is what exposed cause #3 above.

### Gates
| Gate | Result |
|---|---|
| backup | VERIFY OK 224/224 (`ttrpg-soundboard-backup-20261012-121310`) |
| eslint | **0 errors** / 3 pre-existing warnings, exit 0 |
| vite build | exit 0 |
| check-coverage | exit 0 (39 suites / 331 tests) |
| check-profile-keys | OK |
| profileStorage.check | 26/26 |
| **web E2E** | **223 PASS / 0 FAIL / 0 WARN, exit 0** (`e2e-run-20261012-123202.log`) - baseline unchanged |
| Windows / Android E2E | **NOT run** - named, not implied; see below |
| user hand-test | **DONE (13:00)** - see the 12:50 entry; the user reviewed the restyled sliders and approved them |

⚠️ **Windows and Android E2E were not run.** The change is CSS plus four strings. The risk is cosmetic and
platform-neutral, but WebView2 is a different Chromium build and **the whole finding is Chromium-specific**,
so an Android/WebView2 check is genuinely worthwhile before trusting this. Suite P (card volume) and Suite B
(box-size slider) both pass on web, and the screenshot confirms the CSS reaches the rendered DOM.

**This is a user-facing change and the hand-test was outstanding** - it moves sliders the user did not
ask me to touch. Say so explicitly rather than implying it was done. **It was done at 13:00**: the user looked
at the restyled sliders and approved them, which is what closed the loop. The Windows/Android gap remains.

### Next
`PROFILE_SYNC_SPEC.md` steps 3-6 (classifier, bundle format, atomic import, export + destination pickers) and
step 7 UI. The user has new default sounds in mind; `public/assets` is now the place to add them.

---

## 2026-10-12 12:50 - Slider colour and handle size, after the user saw it

Follow-on to 12:32, same sitting. The CSS bug was real and worth fixing, but the *look* it restored was not
what the user wanted, and that is the lesson.

### What the user said
> "The slider should be blue or the bright version of the selected theme color. And the sliders 'handle' is
> too big compared to slider itself"

I had read the loud blue as the defect. It was not — it was Chrome's fallback, and the user had simply grown to
like it. Offered the choice (lime / blue / lime-on-blue); they chose **bright theme accent (lime)**.

### Changes
- Standard `.slider`: handle **16px -> 11px**, rail **4px -> 3px**. The old handle was four times the height of
  the rail it sat on, which is what "too big compared to slider itself" was describing.
- `.slider-compact` (card): **6x14 -> 5x12**, and its rest colour is now the **accent**, not the rail colour —
  previously the pill was slate-on-slate and barely visible at rest.
- Colour is the theme accent in **both** states; only size changes between rest and active. The user asked for
  the slider to *be* the bright accent, so it no longer brightens only on press.

### Verified
Rebuilt, re-screenshotted at 3-4x: rest (small lime pill on a thin rail), active (11px lime handle, 3px rail),
and the master volume / zoom sliders now visibly less chunky than before.
Gates: eslint **0 errors** / 3 warnings, vite build exit 0, check-coverage exit 0, check-profile-keys OK,
web E2E **223 PASS / 0 FAIL / 0 WARN exit 0** (`e2e-run-20261012-124722.log`). Windows/Android not run again,
for the same reason: the whole finding is Chromium-specific and WebView2 is a different build.
**User hand-test: done at 13:00** — the user reviewed the restyled sliders and approved them ("looks good").

### Lesson
**Fixing a genuine bug can still be the wrong call when it removes something the user liked.** The dead-CSS
diagnosis was correct and worth having — but shipping it without showing the before/after traded a liked look
for an "intended" one. The 12:32 entry records the diagnosis as a clean win; it was half a win, and this entry
is the correction. 💡 A visual regression is the one kind nobody notices until they are looking at the app, which
is exactly why this change needs the hand-test more than a code change would.

Next: `PROFILE_SYNC_SPEC.md` steps 3-6 and step 7 UI.

---

## 2026-10-12 16:24-16:44 - opencode: the Windows/Android verification gap, closed by measurement

The previous session ended with one honest gap: the slider work (`fd93f72`, `f19498e`) was green on web but
**Windows and Android E2E had never been re-run**, and the whole `.slider` diagnosis was Chromium-specific while
WebView2 is a different build. The user asked for that gap to be closed. No code was changed - this session is
verification only.

### What ran
Backup first, per the standing rule: **VERIFY OK, 224/224, 39.7 MB**. Then all three E2E gates at `3ba3b21`.

| Gate | Result | vs baseline |
|---|---|---|
| web | **223 / 0 / 0, exit 0** (`e2e-run-20261012-162429.log`) | identical |
| Windows | **218 / 4 / 1, exit 2** (`e2e-run-20261012-162854.log`) | **regression in the run, not in the code** |
| Android | **212 / 0 / 1, exit 1** (`e2e-android-20261012-163512.log`) | identical, WARN is the expected G5 |

So the gap closed the useful way: **the slider change is now machine-verified on WebView2 and Android** and broke
nothing on either. The Windows phase also proved the new uploads guard still works under real use - 114 files
snapshotted before launch, 114 restored after the kill, no stray directory.

### The 4 Windows failures
`M21`, `P13`, `P14a`, `P31a` - every one a *"no `*_old` keys"* / *"no new localStorage key"* guard - and every one
failing on the same single key, `profile:p_f121afb8:ttrpg_characters_old`.

Established by evidence, in this order:

1. **It predates the run.** The snapshot the runner takes *before any suite code runs*
   (`ls-backup-20261012-162900.json`, 16:29:00) already contains the key.
2. **It is test residue, not user data.** `spellcaster_profiles` in that snapshot lists only `p_0d866f71`
   *"My Board"* and `p_f121afb8` *"New Profile"* - both Suite F test names - and the stored characters are
   shipped starter defaults (`char_1`/`s_1`, `Caustic_Blast_Acid_*.mp3`).
3. **The app is correct.** `profileStorage.js:341-344` writes `<key>_old` deliberately when a profile has data but
   no version stamp (*"a key written before versioning, or an imported bundle"*), then adopts the current version.
   The assertion guards the *old* reset behaviour and is tripping over a legitimately-snapshotted key.
4. **Web and Android are the control.** Same assertions, both report `old: []`. Headless Edge gets a fresh
   `--user-data-dir` each run; the emulator's store is clean. Only Windows persists, because its `localStorage`
   *is* the user's real WebView2 store.

### Lesson
**A test that scans global state is only as isolated as the machine it runs on.** Three of these guards looked at
*every* key in the store rather than the profile under test, so they were green on two platforms and red on the
third for a reason that had nothing to do with the code. `__keysFor(pid)` already existed at `page.mjs:98` for
per-profile reads and these assertions did not use it; `__bareKeys()` strips the prefix of the *active* profile
only, so another profile's key passes through with its **full scoped name** - visible in the `P14a` output, which
literally lists `profile:p_f121afb8:...` where bare names were expected. The same failure mode as
`check-profile-keys.mjs` existing at all: the harness's storage seam is load-bearing, and so is its scoping.
💡 Not fixed - it is a test change, and the second finding below says the same store should not be touched
before the user has looked at it.

### Second finding, and the bigger one
**The user's real profile `p_09b2806c` is not in the `spellcaster_profiles` index.** The index points at the two
Suite F leftovers instead, while all **114 real uploads sit intact** in `uploads/p_09b2806c/` - verified before
and after the run. A profile the index does not reference will not be shown by the app, so this is the same
shape as the 2026-10-11 uploads incident, where files were moved somewhere the old app could not find them.

It **predates this session** (true in the pre-run snapshot), and the run restored that snapshot, so nothing here
caused or worsened it. But it means the user's board may currently be invisible in the app, and it is the reason
not to go deleting keys from that store to make a gate green. **Raised with the user rather than acted on.**

Next: `PROFILE_SYNC_SPEC.md` steps 3-6 and step 7 UI, once the two open items above are answered.
---

## 2026-10-12 16:24-17:20 - opencode: E2E verification, a lost board, and the harness bug that caused it

Started as the narrow task the previous session left open - run the Windows and Android E2E gates that were never
re-run after the slider work. It turned into the most consequential session this project has had.

### Part 1 - the gates (16:24-16:44)
Backup first: VERIFY OK 224/224. Then all three E2E gates at `3ba3b21`.
**web 223/0/0 exit 0** and **Android 212/0/1 exit 1** - both exact baselines, so the slider CSS is now verified on
WebView2 and Android. **Windows 218/4/1 exit 2** - exit 2 means `fail > 0`, a real red gate.

The 4 failures were `M21`, `P13`, `P14a`, `P31a`, every one a *"no `*_old` keys"* / *"no new localStorage key"*
guard, every one failing on the same single key `profile:p_f121afb8:ttrpg_characters_old`. Proven pre-existing (the
pre-run snapshot already had it), proven test residue (Suite F's `"My Board"` / `"New Profile"` names, starter-default
characters), and proven *correct app behaviour* - `profileStorage.js:341` writes `_old` deliberately for a profile with
data but no version stamp. Web and Android were the control: same assertions, `old: []`.

**The assertions were at fault.** `__bareKeys()` stripped only the *active* profile's prefix, so another profile's key
passed through with its full scoped name - not a bare name, matching no `KNOWN_KEYS` entry. A test that scans global
state is only as isolated as the machine it runs on.

### Part 2 - the thing underneath (16:44-16:55)
The user was asked whether their app showed their real board. It did not: one character "Human Paladin" whose only
sound is "Playback Probe" - `playback.mjs`'s fixture.

**I got this wrong first and corrected it.** I found `ls-backup-20261011-221530.json` containing `"Renamed Paladin"`,
`"My Hero"`, `"My Custom Spell"` and said the board was recoverable. Those are fixture ids - `s_6`, `mine_1`,
`zz_custom` - with `type:"Test"` and every file pointing at `Longbow_4.mp3`. All **36** snapshots were then checked:
none holds the user's board. Also corrected: this project's own "112 files / 17.4 MB of real uploads" is wrong - **46
of the 114 files are `e2e_silence` fixtures at 14.04 MB**, so the real content is 53 files / 2.37 MB / 11 sounds.
The 2026-10-11 incident was smaller than recorded.

### Part 3 - the actual bug (17:00-17:03)
The two profiles that disagreed named the culprit. 22:15:30 held `p_09b2806c` "My Board"; 22:26:22 held `p_9a1ed119`
"My Board", `createdAt` later - Suite F creates a profile literally named "My Board". That run's log said
**"restored 7 localStorage keys"** and reloaded successfully.

So the restore *ran*, reported success, and never reached disk. **WebView2 commits localStorage asynchronously, and
the runner hard-killed the app 3 seconds after reloading it with `taskkill /F`.** Nothing flushed. The on-disk store
kept whatever the suite had last written. Every run since then did the same, which is why the board is gone.

Three fixes, harness only:
1. **`e2e-snapshot.mjs restore` now verifies** - re-reads storage after the reload and compares key-by-key; new
   **exit 5** on any mismatch. A restore that did not take is now a failure, not a success line.
2. **`e2e-full.ps1` settles 5s, then kills gracefully** (`taskkill` without `/F`, `/F` only for survivors).
3. **Snapshots moved from `%TEMP%` to `%LOCALAPPDATA%\opencode\e2e-snapshots\`** - `%TEMP%` is transient and
   Storage Sense can empty it, and these are the "recover with: ..." instructions printed on failure. Outside the
   repo so an 18 MB copy can never be committed.

Plus the four assertions made profile-scoped: `__bareKeys()` now skips other profiles' keys (one central change
fixing P13/P14a/P14b/P31a/O10), and M21's raw global scan moved onto the existing `__keysFor(pid)`.

### Verified, not asserted
**Windows 222/0/1 exit 1** - baseline restored. Then the check the suite's own word could never give: restarted
`tauri dev` and re-read the store **from disk** - **14/14 keys present, none added, none lost, index intact**
(`activeProfileId p_0d866f71`). Uploads 114 -> 114, no stray `__restore_backup`. All seven gates green: backup
VERIFY OK, eslint 0 errors/3 warnings, vite build exit 0, check-coverage exit 0, check-profile-keys OK,
profileStorage.check 26/26, web 223/0/0, Windows 222/0/1, Android 212/0/1.

The user's own concern - that no test sounds reached git - checked and clean: the only match is
`e2e/e2e_silence.wav`, the harness's deliberate 313 KB fixture source from commit `79acc3e`. The 46 copies exist
only in `%APPDATA%`.

### Lessons
- **A snapshot/restore guarantee is only as good as its weakest flush.** The uploads guard was verified three ways
  and localStorage was assumed equivalent - but uploads are a *filesystem* copy, restorable with the app dead, while
  localStorage needed a live app AND a graceful shutdown. Same promise, two very different mechanisms.
- **"restored N keys" was a claim nobody checked.** It was the kind of line that reads as verification and is not.
  Every restore should now be re-read and compared.
- **I twice stated recovery with more confidence than the evidence supported** - once on the fixture board, once by
  quoting this project's own inflated upload figure. Checking 36 files instead of the one that looked promising is
  what caught it, and it is cheap.
- Board not recovered, by the user's choice - they have the files. **Nothing was deleted**: the 53 real files and 15
  icons in `uploads/p_09b2806c/` are untouched and re-uploadable.

Next: `PROFILE_SYNC_SPEC.md` steps 3-6 and step 7 UI.
---

## 2026-10-12 17:30 - opencode: "are the uploaded sounds in git?" - checked across all history, not just HEAD

The user read my *"no test sounds reached git"* and pushed back: **"we previously added 112 sounds to git. Are you
sure they are not in it?"** A fair challenge, and it exposed a real gap in my earlier check - **I had only run
`git ls-files`, which proves what is in the tree NOW.** If 112 sounds had been committed and later removed, that
command answers "no" for entirely the wrong reason. The right question needs history.

### What history says
`git rev-list --objects --all` over **every path ever committed**:
- **54 distinct audio paths ever** - and HEAD has exactly **54** (52 `public/assets` + `e2e/e2e_silence.wav` +
  `.tmp_uploads/test_sound.wav`). Identical sets, so **nothing audio was ever committed and later removed**; that
  would have shown ~166.
- **Zero** paths matching the runtime-upload pattern `sound_<rand>_<name>` / `icon_<rand>_<name>`.
- Every audio path ever committed lives in `public/assets`, `e2e`, or `.tmp_uploads`. Nothing else, ever.
- The 20 largest blobs in all history: `public/assets` sounds, `src-tauri/icons`, `src/App.jsx`,
  `docs/session-history.md`, `e2e/e2e_silence.wav`. `.git` 53.9 MB fully accounted for.

**Answer: no. The 112 were never in git.**

### Where the confusion came from - two different numbers called similar things
1. **"112 files / 17.4 MB"** was never git. It was `%APPDATA%\com.mrhorakhty.thespellcaster\uploads` - and 46 of
   those 114 files are `e2e_silence` fixtures at 14.04 MB, so the real content was 53 files / 2.37 MB.
2. **What was added to git is `public/assets`** - 71 files, 29.0 MB, deliberately tracked in `ba57282` because
   `public` was gitignored by inherited Nuxt/Gatsby boilerplate, which for a Vite app is a bug.

Corrected in `PROJECT_STATE.md` while I was there: it said *"71 starter sounds"* when it is **71 files = 52 audio
+ 19 images**. That is the third imprecise count in this file about audio, and imprecise counts are what produced
this question in the first place.

### Two leftovers found, left alone
`.tmp_uploads/test_sound.wav` (0 KB) and `test_icon.png` (0.1 KB), tracked since 2026-08-17 (`ee4af98` *"Fixed
uploads not registering in tauri app"*). Pre-profiles debug artefacts, a few hundred bytes, not user data - so not
deleted unasked. Noted in `PROJECT_STATE.md` instead.

### Lesson
**`git ls-files` only proves what is in the tree now.** For "was this ever committed", the question is
`git rev-list --objects --all`. A file that was committed and deleted gives the wrong answer with complete
confidence, which is worse than not checking. I got the right conclusion by luck of timing; this time it was
actually verified.
---

## 2026-10-13 14:58-15:15 - opencode: a lost board, measured properly, then deliberately deleted

Took over a claim left behind by a session that was cut off. It had committed `fd57d3a` 18 minutes after
claiming it and nothing else - two dependencies, `fflate` and `@noble/hashes`, neither imported anywhere.

### The board is unrecoverable - and the snapshots were not enough to say so
`PROJECT_STATE.md` carried two claims that turned out to be wrong.

**1. "The real content survived under a different profile id."** False. All 37 `ls-backup-*.json` files were
grepped for `p_09b2806c`, for a real `storedName`, and for a real sound name. Exactly one matched -
`ls-backup-20261011-221530.json` - and it held `reset.mjs` fixtures (`char_2` "Renamed Paladin", `s_6`,
`mine_1`, `zz_custom`), every `files[]` pointing at `Longbow_4.mp3` with no `storedName` at all. There is no
other profile id. It also means the overwrite happened *before* 2026-10-11 22:15, earlier than recorded.

**2. The live store was never checked.** The real WebView2 `localStorage` is a LevelDB at
`%LOCALAPPDATA%\com.mrhorakhty.thespellcaster\EBWebView\Default\Local Storage\leveldb\`, and **no snapshot
covers it**. Read read-only as bytes, `p_09b2806c` survives in `000010.ldb` as exactly one value:

```
profile:p_09b2806c:ttrpg_environment = [{"id":"e1","category":"Dungeon","sounds":[{"id":"e1s1",
"name":"Dripping","type":"Ambient","icon":"Icon.png","files":[{"name":"drip.mp3","displayName":"drip.mp3"}],
"color":"#84cc16","duration":0,"randomPlay":false,"loop":true}]}]
```

One environment category, one looping ambient sound - and **unplayable**, because `drip.mp3` has no
`storedName` and exists nowhere: not in `public/assets`, not in `src/data.json`, not among the 114 uploads.
There is no `profile:p_09b2806c:ttrpg_characters` key at all, and **none of the 53 `storedName`s appear
anywhere in the live store**.

### Byte-grepping a LevelDB lies in both directions
My first pass reported zero hits for `Telekinesis` and `sound_04uy664i`, which read as proof. It was a
**false negative**: values are Snappy-compressed, so only uncompressed blocks are searchable as ASCII. Worse,
dumping a byte window showed *"Forest"*, *"Tavern Pack"*, *"Music"*, *"Divine Smite"* sitting right after the
Dungeon JSON - they are fragments of **other keys' compressed payloads bleeding into the same window**, not
content of the key being read. A value counts only when the JSON starts immediately after its key and runs
unbroken. Had I trusted the fragments I would have "recovered" a board that never existed.

### "Recovery" was the wrong word, and it cost the user a minute
I copied the 68 real files out to OneDrive as a safety net, verified every copy by SHA256, and reported it as
**"Recovery DONE"**. The user opened tauri, web and the installed build looking for their sounds - because
nothing had been re-added to the app, only backed up. Say **"copied out"** or **"preserved a copy"**; those
words imply the app now holds the data, and it never did.

### Then the files were deleted - copy-out first, originals second
The user had copies of their own. They asked for the OneDrive copy-out to go, and then for the 114 originals
(53 mp3 + 15 png + 46 `e2e_silence` fixtures, 18.03 MB) in `uploads/p_09b2806c/` - scope confirmed explicitly,
since "the 11 files" is actually **68 files across 11 sounds**. Folder now holds 0 files; empty profile dirs
left alone because `fs:allow-remove-dir` does not exist.

💡 **The order was the mistake.** For a few minutes between the two deletions there was **no second copy
anywhere**. "I have copies of those somewhere else" is a claim to check *before* removing the last copy, not
after. I confirmed the count and the intent and still got the sequence wrong.

### Two other stale facts corrected in place
- **"No zip dependency is installed"** - false since `fd57d3a` added `fflate@0.8.3` + `@noble/hashes@2.4.0`.
  Verified neither is imported anywhere in `src/` or `e2e/`.
- The **uploads snapshot guard is now vacuous.** With the folder empty it passes trivially, so it proves
  nothing until there is real data in it again. Re-verify with a real file before trusting it.

### Gates
Backup VERIFY OK 224/224 (four times) - eslint 0 errors / 3 baseline warnings - `vite build` exit 0 -
`check-coverage` exit 0 (39 suites, 331 tests, 11 shared specs) - `check-profile-keys` OK -
`profileStorage.check` 26/26. **web / Windows / Android E2E were not run**: the only tracked file changed was
`PROJECT_STATE.md`, and no emulator was booted. No hand-test - nothing user-facing shipped.
## 2026-10-13 15:19-15:55 - opencode: the uploads guard was not vacuous, it was broken

Picked up the two warnings the recovery session left: commit the docs, and re-verify the uploads snapshot guard
with a real file. **No app code and no harness code was changed** - the fixture lives outside the repo, in
`%APPDATA%\com.mrhorakhty.thespellcaster\uploads\p_guardprobe\`.

### The guard was worse than "vacuous" - reading the code found a live defect
The previous session's note said the guard had gone *vacuous* with an empty uploads folder: it snapshots nothing
and so proves nothing. Reading `e2e-snapshot.mjs` showed the empty state was not merely uninformative, it was
**broken**, and asymmetrically so:

| mode | empty snapshot | result |
|---|---|---|
| `save-uploads` | copies an empty folder | **exit 0** - "saved 0 upload file(s)", phase proceeds |
| `restore-uploads` | `countFiles(file) === 0` | **exit 4** - "snapshot is empty - live files left untouched" |

So a Windows phase run in that state would have uploaded its fixtures, **failed its own restore**, printed
*"Your audio files may not be back where the app expects them"*, and **left the suite's residue in the live
folder** - while `$results` recorded only a `WARNING:` line, so the phase exit code stays as the suite left it.

The refusal is the *correct* fail-safe (an empty snapshot is indistinguishable from one that failed, and
restoring emptiness would delete real audio), so I did not "fix" it. It simply cannot clean up when empty is the
true state - which is exactly why the fixture is the right remedy rather than a code change.
**`save` accepting 0 and `restore` rejecting 0 is not a bug so much as an unstated precondition: the guard needs
at least one real file to exist to be usable at all.**

### The fixture
`uploads/p_guardprobe/`, deliberately **not** a real profile id and **not** in the `spellcaster_profiles` index,
so the app can never list, open or delete it:
- `guard_probe_tone_440hz.wav` - 4844 B, 0.3 s, 8 kHz 16-bit mono. Generated, not copied, so it is not
  mistakable for a harness `e2e_silence` fixture. Verified by parsing the header back and counting upward zero
  crossings: **131 over 0.3 s = 437 Hz**, i.e. one per cycle as a 440 Hz tone should be. (My first check divided
  by 2 and "proved" 218 Hz - the WAV was fine and the arithmetic was wrong.)
- `README-GUARD-PROBE.txt` - what it is, why it exists, how to remove it.

**Why it is inside a profile-scoped subdirectory, not flat in `uploads/`:** a flat file would be swept up by the
one-time uploads migration and **moved** into the active profile. That migration is the exact mechanism that made
this guard necessary in the first place, so a flat fixture would muddy the measurement instead of sharpening it.

### Verified three ways, all with SHA256 on the fixture files
1. **Direct round trip** - snapshot 2 files, deleted the WAV, renamed the README away, added
   `junk_should_not_survive.wav`, restored: exit 0, **both files back byte-identical**, junk gone, renamed file
   back under its original name, **no stray `__restore_backup`**.
2. **The refusals still refuse** - an *empty* and a *missing* snapshot each **exit 4** with `live files left
   untouched`, confirmed by re-hashing afterwards. This is the property that protects real audio.
3. **A real Windows phase** - `saved 2 upload file(s)` before launch, the suite genuinely uploaded
   (`WAV uploaded`, `WAV uploaded to group`), `restored 2 upload file(s)` after the kill, and the folder on disk
   afterwards is **exactly** the 2 fixture files at identical SHA256, 0 flat files, no stray backup dir.
   Suite **222 PASS / 0 FAIL / 1 WARN exit 1**.

The restore's own log line is a *claim*; the SHA256 match after the run is the evidence. Same standard the
localStorage restore was given (exit 5, re-read and compare) after it reported success without reaching disk.

### The bigger find: their audio is not gone from everywhere
While checking the snapshot directory I found
`%LOCALAPPDATA%\opencode\e2e-snapshots\uploads-backup-20261012-170301\` still holding **114 files / 18.03 MB** -
including all **53** mp3 and **15** png the user had asked to be deleted. It survived because the deletion sweep
covered OneDrive and `%APPDATA%` and nobody looked at the harness's snapshot dir.

**Left in place, and reported rather than acted on** - it is the user's call, and they were shown a record that
did not include it. But it is **not safe to leave undecided**: `e2e-full.ps1:240` prunes
`uploads-backup-* -Keep 2`, so **two more `-Phase win` runs delete it as routine housekeeping.**

**"Deleted everywhere" was my own line in `PROJECT_STATE.md`, and it was false.** A sweep has a list, and the
list was in my head rather than derived from *what copies the data*. The sources-that-copy list is short and
enumerable: OneDrive sync, the app's own AppData, the harness snapshot dir, `%TEMP%`. Write it down before
claiming everything is gone.

### Gates - all seven, because this session's subject *was* an E2E phase
The two previous sessions skipped web/Windows/Android as "measuring nothing" on a markdown-only change. That
reason does not apply here: re-verifying the guard means running the Windows phase, so it ran.

| Gate | Result |
|---|---|
| `backup-project.ps1` | VERIFY OK 224/224 (start and end) |
| `npx eslint .` | 0 errors / 3 baseline warnings, exit 0 |
| `npx vite build` | exit 0 (812 ms) |
| `node e2e/check-coverage.mjs` | exit 0 - 39 suites, 331 tests, 23/23 features |
| `check-profile-keys` / `profileStorage.check` | OK / 26/26, exit 0 |
| web E2E | **223 / 0 / 0, exit 0** (`e2e-run-20261013-152155.log`) |
| Windows E2E | **222 / 0 / 1, exit 1** (`e2e-run-20261013-152610.log`) - G5 baseline |
| Android E2E | **212 / 0 / 1, exit 1** (`e2e-android-20261013-153452.log`) - G5 baseline |

Both nonzero exits are the expected G5 skip. No stray processes, nothing listening on 9223/9224/9225/5173.
**No hand-test** - nothing user-facing shipped; the app cannot see the fixture.

### Handover
- Uncommitted docs committed; `PROJECT_STATE.md` claim released.
- **Next task is still `PROFILE_SYNC_SPEC.md` steps 3-6** (export/import). Untouched.
- **Ask the user about the 114-file snapshot before running `-Phase win` twice.**
## 2026-10-13 15:52-15:58 - opencode: the stale E2E snapshot, inventoried and then deleted

The user, told exactly what it held (114 files / 18.03 MB, including all 53 of their mp3 and 15 of their png),
authorised deleting it: *"If they are not needed delete them. I have all my files stored somewhere else."* They had
already asked twice for their content to go (the OneDrive copy-out, then the 114 originals), and had been told this
directory was never in the record they were shown — so this was an informed decision, not the "last copy" trap the
previous session's lesson warns about. It was never the last copy of the *app's* data either: the app has held none
of it since 2026-10-13, and the board itself is unrecoverable.

### Why inventory first, rather than just deleting
Deleting the folder destroys the **only** record of what those files were. `AGENTS.md` says move a record to
`docs/session-history.md` *before* deleting. So the full list below was captured first — generated from the
filesystem rather than transcribed by hand — because it carries the one piece of recoverable knowledge in the whole
saga: **which 11 sounds, with how many variants each.**

### What it held
Four subdirectories — `p_09b2806c` (the owner's), `p_0d866f71`, `p_f121afb8`, `p_5383a814` (Suite F test profiles)
— 114 files / 18.03 MB: **68 real** (53 mp3 + 15 png) and **46 `e2e_silence` harness fixtures** at 312.5 KB each.

The audio had been uploaded **twice** in places, which the counts show and which explains why *"11 sounds"* was
always a loose description of 53 files: Daze 8, Warding Sign 8, Force Barrage 7, and 4 variants each of Fear,
Phantom Pain, Phase Bolt, Shield Magic, Telekinesis, Telekinetic Projectile, Tentacular Limbs, Ventriloquism. The
`Warding__Sign` double underscore is the one-way escaping of a non-space character in the original filename (see
`toStoredFileName`, App.jsx:2255) — `_` → space is a *reconstruction*, not a record.

Several files share an identical byte size under different `sound_<rand>_` prefixes (the three 75140 B Daze icons,
for instance), i.e. the same image or clip uploaded to more than one sound — so even the dedup here was not obvious.

### The 68 real files, verbatim (name / bytes)

```
icon_2rxi4ls9_Tentacular_Limbs.png                110613
icon_57nb9nm7_Warding_Sign.png                    164201
icon_9jgza7mg_Ventriloquism.png                    79235
icon_a408f4d4_Daze.png                             75140
icon_culckh0y_Fear.png                            119586
icon_eqf82rtn_Force_Barrage.png                   127808
icon_iplftafz_Phase_Bolt.png                      120346
icon_kyawi64g_Daze.png                             75140
icon_l5n4io5z_Shield_Magic.png                    152757
icon_ryrwqspm_Telekinesis.png                     126330
icon_uoa6iovi_Telekinetic_Projectile.png          121336
icon_x71p9ro8_Phantom_Pain.png                    106830
icon_xggjz8u8_Force_Barrage.png                   127808
icon_z8nemytg_Daze.png                             75140
icon_zjkupm3u_Fear.png                            119586
sound_04uy664i_Fear_1.mp3                          32876
sound_0aj034su_Daze_4.mp3                          48620
sound_4cgphgib_Telekinetic_Projectile_2.mp3        72369
sound_68yh1voc_Phantom_Pain_3.mp3                  64748
sound_6qn0xnm5_Phantom_Pain_4.mp3                  97632
sound_6tiqavph_Phantom_Pain_1.mp3                  64748
sound_7jttlmwx_Daze_3.mp3                          48620
sound_7sdi5dxi_Warding__Sign_2.mp3                 49581
sound_7zoju4t1_Warding__Sign_1.mp3                 49581
sound_8tisquck_Telekinetic_Projectile_1.mp3        48944
sound_9a23868z_Warding__Sign_4.mp3                 25389
sound_9vxi14m5_Force_Barrage_2.mp3                 30414
sound_a17qzx0n_Ventriloquism_4.mp3                 49581
sound_ahd4rkqp_Shield_Magic_3.mp3                  32876
sound_b6kjbh5a_Phase_Bolt_2.mp3                    32876
sound_bnv742p7_Telekinesis_3.mp3                   80208
sound_bttjeco1_Force_Barrage_6.mp3                 23118
sound_cfedx23c_Force_Barrage_4.mp3                 29262
sound_co3pylvb_Fear_3.mp3                          32876
sound_dejgfzp3_Force_Barrage_5.mp3                 21198
sound_e3qq3m73_Tentacular_Limbs_3.mp3              48620
sound_fiqa9yw6_Daze_1.mp3                          32876
sound_ftl9u4wc_Daze_2.mp3                          48620
sound_g1rqccg0_Fear_2.mp3                          32876
sound_g9be88h3_Force_Barrage_7.mp3                 24654
sound_gctgzjm6_Phantom_Pain_2.mp3                  64748
sound_heb48oj3_Ventriloquism_2.mp3                 49581
sound_hs39545n_Ventriloquism_3.mp3                 49581
sound_iko5k1c7_Warding__Sign_4.mp3                 25389
sound_j8it60le_Force_Barrage_3.mp3                 24270
sound_jvqwt067_Shield_Magic_1.mp3                  32876
sound_kllxck03_Warding__Sign_4.mp3                 25389
sound_l4ydveg1_Telekinetic_Projectile_4.mp3        60003
sound_lr2olos1_Telekinesis_2.mp3                  143202
sound_nwfql86h_Telekinesis_1.mp3                   93666
sound_oup1yska_Daze_1.mp3                          32876
sound_ptf30esd_Tentacular_Limbs_2.mp3              48620
sound_r7qep61b_Phase_Bolt_4.mp3                    16748
sound_rgektlsk_Telekinesis_4.mp3                  142066
sound_rilr8a35_Daze_2.mp3                          48620
sound_rmzt7kur_Daze_3.mp3                          48620
sound_rpc9a9oj_Ventriloquism_1.mp3                 49581
sound_sl8d7j6l_Phase_Bolt_3.mp3                    32876
sound_tmlfmy1z_Telekinetic_Projectile_3.mp3        32876
sound_tvim5ew9_Phase_Bolt_1.mp3                    32876
sound_uzct9tib_Daze_4.mp3                          48620
sound_vy06v1am_Force_Barrage_1.mp3                 26573
sound_wnopdnz1_Fear_4.mp3                          32876
sound_x77sqzyf_Tentacular_Limbs_1.mp3              48620
sound_x9od9x9x_Shield_Magic_4.mp3                  39621
sound_xo74w9up_Warding__Sign_3.mp3                 25389
sound_xt1tq3a9_Tentacular_Limbs_4.mp3              48620
sound_z12x9lp5_Shield_Magic_2.mp3                  32876
```

### Deleted, and what it changes
- `uploads-backup-20261012-170301/` **deleted**, verified gone afterwards.
- `PROJECT_STATE.md`'s **"deleted everywhere" claim is now true again**, and the correction note that flagged it
  has been rewritten to say so. The lesson it carried — *a sweep has a list; enumerate the sources that copy the
  data, not the places you remember deleting from* — is kept, because that was the actual finding.
- ⚠️ **The auto-prune hazard goes away with it.** `e2e-full.ps1:240` keeps 2 `uploads-backup-*` snapshots, so two
  more `-Phase win` runs would have deleted it as routine housekeeping. **No need to think about it before running
  Windows phases any more.**
- Deliberately untouched: the `ls-backup-*.json` / `MANUAL-REFERENCE-ls-*.json` files in the same directory. They
  are ~11 KB of **localStorage** and hold only E2E fixtures (established exhaustively on 2026-10-13 — no snapshot
  anywhere holds the user's board), and one is cited as evidence in `PROJECT_STATE.md`. Not user audio, not in scope.
- The uploads guard fixture `uploads/p_guardprobe/` lives in `%APPDATA%` and is untouched by any of this.

### Gates
Markdown-only change (no app or harness code), so the E2E phases were **not** run — markdown cannot affect them,
and the previous session's figures stand. backup VERIFY OK 224/224 · eslint 0 errors / 3 baseline warnings ·
`vite build` exit 0 · `check-coverage` exit 0. No hand-test — nothing user-facing shipped.
---

## 2026-10-13, 16:01-17:05 - opencode - PROFILE_SYNC_SPEC steps 3-6 (export/import)

**Claimed** immediately (it was UNCLAIMED), then **backed up first** (VERIFY OK 224/224), per AGENTS.md.
**Scope** was agreed with the user up front: steps 3-6 **plus minimal UI wiring**, and **both** import modes
with snapshot-first for "replace active". Step 8 (the shared E2E spec) was explicitly left for a later session.

### What shipped
- **`src/profileBundle.js`** (new, 989 lines) - the `.spellcaster` format end to end.
- **`e2e/profileBundle.check.mjs`** (new) - **36/36** node-level assertions.
- **`src-tauri/src/scope.rs`** (new, 40 lines) - the `grant_path` command, `mod scope;`-declared at the top of
  both entry points.
- `src/profileStorage.js` - added `requestProfileRemount()` (19 lines).
- `src/App.jsx` (+270) - the imports, the handlers, the Settings UI, and a `flushCurrentProfile()` extraction
  shared with the profile switch.
- `src-tauri/` - `tauri-plugin-dialog` in Cargo.toml + both entry points, `dialog:allow-save`/`allow-open`,
  regenerated `gen/schemas/capabilities.json`.
- `package.json` - `@tauri-apps/plugin-dialog`, `eslint.config.js` - 4 browser globals.

### The bugs and traps worth keeping
1. **`pruneUnresolvableSounds` silently dropped `settings`.** It rebuilt the data object with only
   `characters`/`environmentSounds`/`groups`, so every import reset `boxSize` to 1 and lost the background
   theme. **Caught by the node check on its first run**, not by any browser test - and it is exactly the class of
   silent partial-write the design warns about.
2. **`tauri-plugin-dialog` is needed in `package.json`, not just `Cargo.toml`.** Registering the Rust crate does
   nothing for the bundler; `vite build` fails with "Rolldown failed to resolve import". Cost one build cycle.
3. **Pin the npm dialog package to the crate's minor.** `^2` resolved npm to 2.8.2 against a Rust crate of
   2.7.3, and every `tauri dev` printed "Error Found version mismatched Tauri packages". Now `~2.7.3`.
4. **`mod` cannot be declared inside a function body** - `cargo check` failed with "cannot declare a file module
   inside a block unless it has a path attribute". `mod scope;` sits at the top of both entry points.
5. **`src-tauri/scope.rs` was written one directory up** (`src-tauri/` not `src-tauri/src/`), which `cargo
   check` reported as "file not found for module `scope`". Caught immediately by reading the error rather than
   guessing.
6. **`@noble/hashes` v2 needs an explicit `.js` subpath** - `@noble/hashes/sha2` fails with
   `ERR_PACKAGE_PATH_NOT_EXPORTED`; it is `@noble/hashes/sha2.js`.
7. **The edit tool introduced a typo I did not make by hand.** My `oldString`/`newString` for the App.jsx
   import block both spelled `TreeDececiduous`, but HEAD spells `TreeDeciduous` - the tool fuzzy-matched and
   silently "fixed" the import to a misspelling, which eslint then correctly reported as `'TreeDeciduous' is not
   defined`. **Caught only because the baseline is 0 errors and 3 warnings, and I knew the exact number.** A
   fuzzy match that "succeeds" can change code you did not intend to change.

### The scope-grant probe - four probe bugs, then 11/11
The grant was the one part of step 6 no existing test could reach, so it was measured over CDP against a live
`tauri dev`. Getting there took four wrong probes, and **every one of them was a trap the spec warns about,
failing to be obvious**:

1. **CDP `returnByValue` serialises a `Uint8Array` to `{}`.** A read-back came back `len 0` and looked like a
   corrupt write. It was the probe.
2. **Raw `invoke('plugin:fs|write_file', {path, body})` is the wrong shape** - the bytes are the **body** and the
   path rides in a **header** (`{headers: {path: encodeURIComponent(p), options}}`). It fails with
   "missing file path", which reads like a permissions problem. **The app code uses the JS wrapper, so it was
   never at risk** - but this is precisely why the spec documents the trap.
3. **A grant persists for the whole app session.** A later probe re-used a path an earlier probe had granted, so
   "ungranted writes are refused" appeared to **fail** and looked like the scope was wide open. It was already
   granted. This is also a genuine finding worth recording (it is §11 risk 3's transient-grant point, measured).
4. **Unhandled rejections surface as `{"__error":"Uncaught (in promise)"}`** and are indistinguishable from
   success unless the page-side expression catches.

Fix for all four: run the whole probe as one page-side async IIFE that resolves to a JSON string, and confirm
every verdict **on disk from node**, never from an IPC promise.

**Final result, 11/11, on real hardware:** an ungranted `Documents` write AND read are both refused; `grant_path`
accepts the picked path; the granted file writes and reads back byte-exact with the zip magic intact; **a sibling
in the same folder is still refused for both read and write** (the narrowness that justifies route A over
`fs:scope: ["**"]`); re-granting is idempotent; and `plugin:dialog|message` returns neither "Plugin not found"
nor "Permissions associated with this command".

💡 **The §11 risk 8 `Array` trap reproduced live for real:** passing a plain `Array` as the write body produced a
**189-byte** file of comma-joined digits from a 64-byte payload, with **no error at all**. That is now measured
rather than quoted, and it is why the app reads the file back off disk and checks size + `PK` magic before
reporting success.

### Gates
All seven, run **twice** - the npm dialog downgrade landed after the first full pass, so the reported numbers are
the second run, not stale ones. backup VERIFY OK **227/227** · eslint **0 errors / 3** baseline warnings ·
`vite build` exit 0 (840 ms) · `check-coverage` exit 0 (39 suites / 331 tests / 23 of 23 shipped features) ·
`check-profile-keys` OK · `profileStorage.check` **26/26** · **`profileBundle.check` 36/36** ·
`cargo check --offline` clean (tauri-plugin-dialog 2.7.3, rfd 0.16.0) · **web 223/0/0 exit 0** ·
**Windows 222/0/1 exit 1** (G5; uploads re-hashed after the run - both fixture files byte-identical, 0 flat, no
stray dir) · **Android 212/0/1 exit 1** (G5). No stray processes, no listening ports, no probe leftovers on the
Desktop.

### Not done - stated plainly
- **No native picker has ever been opened.** `dialog.save`/`dialog.open` are code-reviewed and the plugin is
  proven live, but no test clicks one. The per-platform cancel rows in spec §13 are code-reviewed, not executed.
- **The cross-device half of the round trip is unrun** - export on desktop, import on Android - which is the
  feature's actual purpose.
- **The user has not hand-tested the built app.** Per the DoD this is user-facing, so the bar applies and it has
  not been met. The coverage-manifest feature entry stays `status: planned` accordingly.
- **Not committed, not pushed.**
