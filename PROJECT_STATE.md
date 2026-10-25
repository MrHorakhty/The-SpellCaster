# Project State

🔓 UNCLAIMED — last holder: Codex (2026-10-25 20:59)

Current handover for **The SpellCaster**. Read this with [AGENTS.md](AGENTS.md), which owns the
standing rules and definition of done. Its session finishing workflow runs once the subject is complete
(including required verification/hand-test), or on an explicit user request: commit intended changes,
push and verify, then audit/prune older backups while keeping the newest verified backup. It does not
run at intermediate checkpoints or on interruption; installing the rule is not a trigger. Keep current facts here; append past investigations to
[session history](docs/session-history.md). Do not append session logs or completed tasks to the open list.

The complete state file before this cleanup is preserved in
[the 2026-10-25 snapshot](docs/session-history.md#project-state-snapshot-2026-10-25),
including every old decision, measurement, correction and retired-file explanation.
That snapshot is historical and contains contradictions; current code, this handover and live specs take precedence.

## Open items

No export/import defect remains open from the fade work: the user confirmed export and re-import work on
2026-10-25. Per-file fades, Play Until, loop seams, volume, priming, move/copy and profiles v1 are shipped.

| Priority | Work | Status / constraint |
|---|---|---|
| 1 | [Icon preparation](ICON_PREP_SPEC.md) | Planned, **not authorized for implementation**. Opt-in use-as-is / crop-to-square / silhouette, with preview and confirmation. Use the measured adaptive algorithm in the spec, not the old Python thresholding. Colour/photo art is not silhouetted. |
| 2 | [Hotkeys](HOTKEYS_SPEC.md) | Planned, **not authorized for implementation**. Bindings belong to profiles; use the profile reference rules and route triggers through `playWithPrimes`. Suppress shortcuts while editing text. |
| Repository health | Missing historical local Git blob | `git rev-list --objects origin/mobile-support` fails on `3d1fcf151b7e70470a24f58c83cd6d6b42a64182`; host-side cat-file confirms it is missing locally. Current commit archives and coverage validate, and push is verified. Audit/repair historical objects separately; no history was rewritten. Backup pruning did not rely on the missing history: every differing older version was preserved. |
| Separate defect | New-sound glow persistence | Earlier investigation remains valid: `addSound` at `src/App.jsx:2297` omits `glowEnabled` and `glowProminence` from its explicit save allowlist, although the editor carries them. Verified from source during cleanup; not fixed or newly exercised in the UI. |
| Deferred chain | [Profile sync §13](PROFILE_SYNC_SPEC.md) | **Timestamps + tombstones → Merge import → folder/WebDAV/cloud sync** behind `ProfileTransport`. Timestamps were deliberately cut from v1; merge/sync are unsafe without them. Do not reorder or implement unasked. |
| Independent deferral | Web export/import | First move web audio out of localStorage into real file storage; current base64 storage is quota-limited. Native export/import does not imply web support. |
| Other deferred work | Signed release APK; wake lock; fullscreen guard; iOS | APK signing needs a keystore; iOS needs macOS. No implementation authorization implied. |
| Other deliberate exclusions | Cross-container drag, whole-container move/copy, creating containers from the transfer picker, atomic cross-slice persistence | Existing move/copy does not include these. Atomic persistence requires storage design work. |
| Other deliberate exclusions | Per-container/group default volume, pan/balance, MIDI/CC; expanded priming | A group default volume needs a profile-storage census. Priming exclusions and rejected saved layers are below. |
| Native debt | Android `onRenderProcessGone` | Previous investigation found no supported hook in the generated wry WebView client; an upstream change or vendoring would be needed. Do not repeatedly edit generated code expecting a lasting fix. |

`PROFILE_SYNC_SPEC.md` remains live because it holds future scope and hotkey dependencies.
Its **v1 §13 checklist is complete**, including native pickers and Android same-device round trip;
older state notes claiming otherwise are superseded. `FADE_SPEC.md` is a shipped design record, not work waiting to be built.
The playback gaps once listed for Z13–Z21 are closed; Z22 covers the loop fade-out ramp.

## Repository and working tree

- Branch `mobile-support`. Completed fix/handover commit **`8eda985`** was pushed and independently
  verified on `origin/mobile-support`. Final finishing records are committed separately; use `git log`
  for the latest bookkeeping commit rather than treating an embedded hash as the current HEAD.
- Fix, regression tests, state consolidation and permanent finishing instructions are committed.
  `ICON_PREP_SPEC.md` is now tracked because the manifest requires it; implementation remains unauthorized.
- **Remaining untracked work**: `.gitattributes` and `scripts/`. They were intentionally excluded.
  No unrelated changes were discarded.
- `.gitattributes` contains only `*.bat text eol=crlf`, user-authorized but still untracked.
  It overrides `core.autocrlf` locally; other clones get no protection until it is committed.
  Existing committed BAT blobs are LF, so this rule did not need renormalization.
  Do not broaden to `* text=auto` casually or claim that “LF breaks goto” is a proven universal mechanism.
- `scripts/` currently contains **18 untracked files / 23,438,950 bytes**: the Image Pipeline, two
  original example images, and `output/` (13 files, including measurement reports and five preserved samples).
  This on-disk inventory supersedes older claims that every preserved sample was deleted. The complete
  51-image corpus is not here; re-running its full measurements needs the originals. Keep these files in
  the verified project backup; do not commit them accidentally. Downscale future in-app example assets
  to 256 px before committing them. The working batch pipeline is not retired.
- The user's preferred local launch is the root BAT files. No standalone EXE was requested or built for the fix.
  Do not make an installer merely to enable a hand-test.

## Project and code map

**The SpellCaster** is a local TTRPG soundboard for Windows, Android and web. Characters, environment
categories and groups contain editable/reorderable sound cards with multi-file/random playback, loops,
per-file fades/Play Until, volume trims and one-shot priming. Desktop/web also have split view.
There is no account, server or automatic cloud sync.

| Area | Current source |
|---|---|
| UI and playback | React 19, Vite, Tailwind; `src/main.jsx` → `src/App.jsx` (about 7,800 lines). Most app logic remains in App.jsx. |
| Starter data | `src/data.json`, `public/assets/` |
| Profile index, scoped keys, uploads migration | `src/profileStorage.js` |
| Bundle format, validation, export/import, replace snapshots | `src/profileBundle.js` (`fflate`, `@noble/hashes/sha2.js`; the explicit `.js` import matters) |
| Post-picker timeout/cancel | `src/bundleGuard.js` |
| Fade model and wording | `src/fadeMath.js` |
| File normalization and bundled-provenance recovery | `src/soundFiles.js` |
| Native entry points | Tauri 2 / Rust: `src-tauri/src/main.rs` (desktop), `lib.rs` (mobile), shared `scope.rs` |
| Android entry/config | 50 tracked files under `src-tauri/gen/android/`, including hand-maintained `MainActivity.kt`, Gradle config and manifest |
| App identifiers | Windows/native storage: `com.mrhorakhty.thespellcaster`; Android debug: `com.mrhorakhty.thespellcaster.debug`. |
| Version | App version comes from `package.json` via `__APP_VERSION__` in `vite.config.js`; do not hardcode it. |
| Useful current symbols | `mapSoundContainers` App.jsx:827; `patchSoundById`:1938; `allSoundContainers`:2632; `removeFileIfUnreferenced`:2818; `playWithPrimes`:4447. Re-find symbols before editing; old spec line numbers drift. |

## Architecture gotchas — do not regress these

### Profiles, storage and ownership

- Board keys are `profile:<id>:<key>`. Use `profileStorage.js` for reads, writes, removal **and enumeration**.
  Board keys include `ttrpg_characters`, **`ttrpg_environment` (singular)**, `ttrpg_groups`,
  `ttrpg_data_version`, the two `ttrpg_*_icon` keys, `boxSize`, `backgroundSettings` and web `sound_file_*` keys.
- **Four global keys are intentional**: `spellcaster_profiles` (index), `localStorageMigrationCompleted`
  (device migration), `spellcaster_import_backups` (last 3 replace snapshots), and `spellcaster_import_notice`
  (read-and-removed after remount; an import may create its target profile). Keep the shared
  `KNOWN_KEYS` in `e2e/lib/page.mjs` current. The harness's `ttrpg_themes` seed is not an app storage feature.
- Profile switching is a **full remount**, preventing old auto-save effects from writing into the next profile.
  New/adopted/imported profiles must be stamped with **`DATA_VERSION = '3'`** from birth.
  A version mismatch **repairs forward, never resets**; casually bumping it affects every profile.
- Native uploads live in `AppData/uploads/<profileId>/`; web uses scoped localStorage data-URLs.
  Never share/hardlink blobs across profiles. Account for object-URL caches during profile switch.
- There are **five sound-container shapes**: characters, environments, group categories, group characters,
  and vestigial `groups[].sounds`. Use the shared walkers. Group normalization migrates a legacy top-level
  array into a Default category and returns `sounds: []`; a manually seeded legacy array will not survive reload.
- Categories have no ID: their name (`category`) is their identity. Names can collide across groups.
- Cross-slice writes are **not atomic**. Auto-save effect declaration order (characters → environments → groups),
  not setter-call order, controls persistence. Quota failures can leave a partial transfer; preserve the visible save-error banner.
- `addSound` is an explicit property allowlist; `updateSound` spreads. Every new field needs both paths checked.
- Copies share file references, not duplicated bytes. Cleanup must check all other owners, including siblings
  in the same container. Audio removal in the editor releases bytes **on Save**, not on row removal or Cancel.
  Exclude only the edited sound for that check; exclude a whole container only when deleting that container.
- Real sound deletion requires confirmation. Transfer removal is the scoped half of a **silent move**;
  do not merge these paths. Copies append to the destination and get “(copy)” names unique within that destination.

### Per-sound volume

- Effective level = **master × sound trim**. Normalize 0–1 and preserve a legitimate zero (`?? 1`, never `|| 1`).
- Live rescaling must preserve fade progress and update `audio._baseVolume`; loop re-entry reads it back.
  `rescaleAudioTarget` is shared by master and per-sound changes.
- Card slider movement updates local draft + live audio; persist once on commit to avoid synchronous
  whole-board JSON writes on every pointermove.
- The volume row is a **sibling** of the card, not a child; it does not inherit card play/drag/prime handlers.
  Card radius remains 12 px independently of box size. Cards are `div[role=button]`, not native buttons.

### Sound priming

- Priming is **one-shot, session-only**, consumed by the next trigger. No persisted key or bundle content.
  Saved named layers (“Model B”) were **rejected by the user**; do not reintroduce them.
- `primedRef` is authoritative: read and clear synchronously before any await to prevent double-consumption.
  React state drives display. Every card/keyboard/future hotkey trigger goes through `playWithPrimes`.
  A `_primeGroup` token lets Stop stop the complete triggered group.
- Desktop right-click / mobile 500 ms hold prime a card; 10 px movement cancels; fired flash lasts 2,000 ms.
  Touch `contextmenu` must not toggle again; arm holds only for button 0; swallow exactly the release click
  and reset its suppression on each new press. Priming is disabled in edit mode.
- Whole-container priming, offsets, sticky priming, priming from a hotkey picker and undo remain out of scope.
  Clear-all is the shipped answer to a mistaken prime.

### Fades, files and export/import

- File entries own `fadeIn`, `fadeOut`, `playUntil`; sound-level duration/fades are retired.
  Legacy shared fades migrate to **every** file. `playUntil = 0` means whole file;
  audible end is capped at the measured length. With looping, Play Until is the loop point.
- Fade-in runs at every seam; fade-out ramps into it. The rewind uses a **50 ms watchdog**, not
  `timeupdate` (~4 Hz), to avoid naturally ending/pausing before a short loop rewinds.
- One red state: combined fades meet/exceed audible end. The timeline shows ramps, plateau, unplayed tail and stop marker.
  Unknown metadata stays “Measuring…” until a real audio error; do not mislabel slow loading as unmeasurable.
- Number boxes must not carry HTML `min`, `max` or `step`: off-grid fade values otherwise silently block form submission.
  Keep the percentage boxes readable with `.no-spin`.
- Legacy `file` gets synthesized only when `files[]` is empty. Deduplicate by file identity;
  once a modern list is saved, drop the legacy field instead of accumulating duplicate rows.
- **Provenance is copied, never invented**: audio `storedName` and icon `iconDisplayName` mark uploads.
  Bundled assets have no upload marker and must not be copied into bundles.
  On load, the exact older bad markers are repaired only against the shipped audio/icon catalogue;
  unknown/missing user uploads remain uploads. See `soundFiles.js:32`, `:38` and `App.jsx:2203`.
- Icon recolouring happens at render time and preserves lightness/alpha; it cannot remove an opaque background.
  This is the limitation the planned icon-preparation workflow addresses.
- The fade-edit export defect is fixed and **user accepted** (2026-10-25). FADE14/15 cover saving edits and
  repairing affected profiles; native phases perform actual export. The user's current board also exported
  and parsed in memory: **366,906 bytes / 19 sounds / 7 uploaded files / format 1**.
- `.spellcaster` is a plain zip with manifest/checksums, content-hash dedupe, uploaded files and profile settings.
  Native-only v1 offers New profile / Replace active. Replace snapshots metadata first, writes blobs before
  committing keys, and retains old bytes for recovery. Missing exports refuse an incomplete bundle;
  unresolved imported sounds are dropped and reported. Custom background images and priming do not travel.
- The per-file import report survives remount via the global one-shot notice. A separate progress dialog was
  declined by the user. The picker has **no timeout**; steps after it have a 30 s bound + Stop waiting.
  A timeout/cancel stops waiting, not native work; never promise that nothing was written.
- Desktop picker paths need the **single-file** `grant_path` runtime grant; siblings must remain denied.
  Never replace it with blanket `fs:scope: ["**"]`. Android uses `content://` SAF URIs directly.
  Desktop picker cancel resolves null; Android rejects with a cancel message. Handle both.
- Pass **Uint8Array**, never Array, to native `writeFile`; desktop otherwise stringifies bytes without failing.
  Keep read-back size/PK-magic validation. `fs:default` already includes read-dir; stat is not granted,
  so deletion confirmation counts files. `fs:allow-remove-dir` does not exist in the investigated plugin version:
  delete files individually; `fs:allow-rename` is granted.
- Register plugins/commands in **both Rust entry points**, plus required capabilities
  (`dialog:allow-save` / `dialog:allow-open`). `platform()` is synchronous.
  A “plugin not found” on Android can also mean a stale APK; verify actual install/build freshness first.
- Restore starter sounds is a **merge**, not a wipe: shipped ordering restored, user sounds/icons preserved,
  groups untouched, idempotent and scoped to the active profile.

## Test harnesses

- `e2e/e2e-full.ps1 -Phase web|win -Suite full`; `e2e/e2e-android.ps1 -Suite mobile`.
  Entry points: `e2e-full.mjs` / `e2e-mobile.mjs`; 13 shared specs plus `e2e/lib/` plumbing.
  Old `run` / `features` suite flags are retired.
- Coverage has **suite and feature registries**. Register new work as planned when starting;
  shipped features need coverage or an explicit visible gap. After test-ID edits run
  `node e2e/check-coverage.mjs --update` and review the ID diff. Check used prefixes before choosing new ones.
  Add new Node checks to AGENTS gate 5 in the same change.
- Run all six Node checks, even if one fails. Browser specs cannot cover a never-settling post-picker promise
  or a cancel after completion; `bundleGuard.check` supplies that coverage.
- **Windows tests touch the user's real storage and uploads**, shared by installed/dev app.
  Runner snapshots uploads before launch, restores afterward, gracefully closes WebView2, restarts
  and compares the store **from disk**. A page-level “restored” log is not disk persistence.
  Upload snapshots must abort safely on failure; empty snapshots refuse restore (exit 4).
  `uploads/p_guardprobe/` is an inert restore-test fixture, not a real profile or recovered user content.
- Durable Windows snapshots: `%LOCALAPPDATA%/opencode/e2e-snapshots/` (newest 2 uploads / 5 localStorage).
  Android snapshots stay in `%TEMP%/opencode/`, because they protect an emulator, not the real Windows store.
  Runner/snapshot errors: storage mismatch 5, reload failure 6, snapshot comparison mismatch 7; CDP loss is fatal.
- Preserve desktop inline D/M fixture dependencies. Shared block follows inline tests; platform W leads,
  scroll follows the small-board inline tests, playback precedes fade, profiles precede bundle/refcount,
  reset runs last. Use self-seeding specs, `reloadPage`/post-reload helpers and `awaitBoard`, not fixed paint sleeps.
- `bundle.mjs` must not click native export/import picker buttons; immutable IPC hooks prevent stubbing them.
  It drives the actual bundle/file operations below the picker. Pickers are human-tested.
- Profile tests: creation already switches/remounts; active rows lack Switch; select rows by ID, not name;
  stub confirm in the same expression as clicking; remove every profile the spec creates.
- CDP `element.click()` is not a playback user gesture: use trusted mouse/touch input.
  A live fixture must stay registered in `audioElementsRef`; `paused === false` alone does not prove liveness.
  Bring headed Edge to front before injected input. Define helpers again after reload.
  Parenthesize whole ternaries before converting boolean conditions to PASS/FAIL; other statuses count as WARN.
- Mobile scroller differs from desktop; find the nearest actually scrolling card ancestor.
  Keyboard (Y) and split-view (L) are deliberately not mobile coverage gaps.

## Verification gates

Full ordered commands and reporting rules live in [AGENTS.md](AGENTS.md). Latest app-changing validation
is **2026-10-25**, after the fade-export repair; the user's export/re-import hand-test also passed.

| Gate | Latest result | Exit |
|---|---|---|
| Backup before fix (historical; later pruned) | 255/255 verified, 62.9 MB (`…-20261025-194436`) | 0 |
| Lint | 0 errors / 3 accepted warnings: `convertFileSrc`, `_`, `ev` | 0 |
| Vite build | Success; existing ineffective-dynamic-import warning | 0 |
| Coverage | 41 suites / 393 registered tests; 25/25 shipped features covered, 0 gaps; 2 planned | 0 |
| Node checks | profileBundle 46/46; profileStorage 32/32; bundleGuard 20/20; profile keys OK; fadeMath 46/46; soundFiles 32/32 | All 0 |
| Web E2E | 262 PASS / 0 FAIL / 0 WARN | 0 |
| Windows E2E | 280 PASS / 0 FAIL / 3 baseline WARN | 1 |
| Android E2E | 270 PASS / 0 FAIL / 3 baseline WARN | 1 |

Native warnings are G5/G6b/G7b localStorage checks inapplicable to physical Tauri files.
**0 FAIL is the healthy signal**; retain explicit WARNs rather than silently skipping.
Logs in `%TEMP%/opencode/`: `e2e-run-20261025-195615.log` (web),
`e2e-run-20261025-200236.log` (Windows), `e2e-android-20261025-201046.log`.
Windows restore was restart-verified; Android restore verified 9 keys and completed cleanup.
No app/test code changed in this documentation cleanup; runtime gates are not re-run for prose edits.
Do not represent prior passing counts as new executions.

Cleanup checks: the complete archived snapshot matches the pre-cleanup backup (SHA256 recorded in history);
253/253 non-documentation files match it; 7/7 document links resolve; exactly one claim line;
static coverage check exit 0 and diff whitespace check exit 0. No test/development processes were started
by the cleanup. Lint, build, six Node checks and all three E2E phases were not repeated for documentation-only changes.

## Operational warnings and known environment facts

- Use UTF-8 explicitly when reading/writing. Older PowerShell BOM-less defaults corrupted Unicode in App.jsx.
  Prefer edit tools or explicit `ReadAllText`/UTF-8 `WriteAllText`; do not bulk round-trip source through default
  Get-Content/Set-Content. Check diffs and encoding after edits. BAT working files must remain CRLF.
- Native dev commands watch indefinitely: launch hidden/detached and inspect logs.
  Desktop user launch: `Run Tauri.bat`; web: `Run.bat`; `Build.bat` builds web.
  `Build Android.bat` builds/reinstalls/runs; `Run Android.bat` opens the installed app and starts Vite if needed.
  Both are tracked root scripts; do not use the retired generated `Run App.bat`.
- Native debug apps need the Vite server alive on **5173**; Vite binds `0.0.0.0`.
  Emulator host alias is **10.0.2.2**, not ProtonVPN's **10.2.0.2**.
  VPN routing can swallow the latter even when Vite binds all interfaces.
  The Android runner uses `--host 10.0.2.2`; HMR socket warnings are cosmetic.
- On 2026-10-25 the CLI's Windows-side server check stalled on the emulator alias despite localhost HTTP 200.
  A **process-only** `TAURI_CLI_NO_DEV_SERVER_WAIT=true` on its replacement launcher let compile/install/tests finish.
  No harness or persistent environment change was made. Check server health and a single running CLI before using this workaround.
- Last recorded toolchain: Rust 1.97.1; Android SDK `%LOCALAPPDATA%/Android/Sdk`, NDK `30.0.16138531`,
  Android Studio JBR 21. AVDs: Pixel_7, Pixel_Tablet, Small_Phone; runner uses Pixel_7.
  Treat historical version numbers as recorded environment, not fresh probes.
- Desktop CDP: **9224** with `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9224 --remote-allow-origins=*`.
  Android runner: **9225**; manual examples used 9223. Forward
  `webview_devtools_remote_<actual-app-pid>`, never assume emulator serial is the socket suffix.
- Raw `Page.reload`/mobile storage seeding is unreliable; use runner reload helpers or a cold start.
  For screenshots use `adb shell screencap -p /sdcard/x.png` + `adb pull`;
  PowerShell binary piping of `adb exec-out screencap` can corrupt PNGs.
- Native dialogs are Win32 `#32770` windows; a hidden app may not be foreground.
  Manual probes should locate PID/class rather than rely on focus. Android `read_file` path is an argument;
  `write_file` passes an encoded path header and binary body.
- Mixed-encoding E2E logs may require reading bytes as Latin-1 and removing NULs; bound output to avoid
  printing audio data-URLs. Open active logs with read/write sharing.
- CMD pitfalls: unescaped `)` in a parenthesized echo ends the block; quoted executable paths inside
  `for /f` command capture can fail (redirect to a temp file); quoted file paths need `usebackq`.
  Verify by running the script, not by quoting theory.
- The real Windows localStorage is under `%LOCALAPPDATA%/com.mrhorakhty.thespellcaster/EBWebView/Default/Local Storage/leveldb/`.
  Never substitute a fixture snapshot for the user's board.
- Raw LevelDB byte searches cannot prove missing profile data: values can be Snappy-compressed,
  and readable fragments need not belong to the preceding key. Preserve raw storage before investigation.
- The 2026-10-11/13 board-loss incident is historical, not the current board.
  Its profile structure was not recoverable from E2E fixtures; the old uploads and copy-outs were later
  explicitly deleted by the user, who held source files elsewhere. Do not claim those copies still exist.
  A copy-out is not a restore into the app. Full inventory/evidence remain in session history.
- Old Desktop emulator/tauri logs (~30 KB, 2026-08-31) were deliberately kept by the user.
  They are diagnostic records, not backup folders or an outstanding cleanup decision.

## Backups

- Use **`backup-project.ps1`**, never bare robocopy. It copies + verifies + repairs, prints exclusions/counts,
  and enforces the 150 MB ceiling. Run before code edits and at completion; full rules are in AGENTS.
- Includes source/docs/tests and `public/assets`; excludes node_modules, dist, .git, target and gen.
  **gen is not wholly regenerable**: backups omit 50 tracked Android files, including MainActivity.
  Git/pushed copies protect them; do not put new hand-maintained files only in generated/ignored locations.
- `public/assets` has **71 tracked files (52 audio / 19 images)**, ~29 MB. They were clone/build-verified after
  the ignore fix `ba57282`. Runtime user uploads are not tracked. User's shipped-content budget is under 100 MB.
- Bitdefender can quarantine `e2e/e2e-full.ps1` from backup folders even after a successful copy.
  The repo e2e folder is excluded from scanning; OneDrive is not (user declined a broad exclusion).
  Verify/repair mitigates this; it does not stop later quarantine. A write-lock can precede removal.
  Never resurrect the hard-blocked filename `e2e-all.ps1`.
- Correct OneDrive desktop path must be constructed as
  `'C:\Users\emire\OneDrive\Masa' + [char]0x00FC + 'st' + [char]0x00FC`;
  do not type/guess accented characters or use capital Ü. Count hidden files with `-Force`.
- Backups accumulate; prune only after verified push. Keep the newest.
  Before later pruning, compare **git tracked paths ∪ working-tree paths**, including untracked files;
  preserve backup-only orphans first. Check what remains after a failed deletion. Sort backup names, not OneDrive mtimes.
  Take the final backup before pruning; do not create another just for the prune's documentation.
- **Current keeper: `…-20261025-204821`, VERIFY OK 255/255, 62.9 MB, exit 0**; every file SHA256-checked
  against the working tree before pruning and rechecked against the audit afterward. Only final finishing
  documentation postdates it. **8 older folders removed, 1 remains; 527,461,955 bytes (~503 MiB) freed.**
- **Preserved older versions**: `%LOCALAPPDATA%/opencode/backup-prune-history/preserved-before-prune-8eda985.zip`
  (2,702,716 bytes). It holds 23 distinct file contents representing 38 older versions; `manifest.json`
  maps original folder/path to each `objects/<sha256>` entry. All entries round-trip/hash verified.
  ZIP SHA256: `9036930ba1b369e1e6816288f743069b141d766de2824323f83e285d36312951`.
  Adjacent `audit-before-prune-8eda985.json` and `prune-result-8eda985.json` retain the complete audit.
  The audit found zero path orphans; it conservatively preserved changed versions instead of relying on
  incomplete local historical Git objects. Do not delete this recovery archive as ordinary backup clutter.
- Raw pre-fade-repair user storage + uploads: `%LOCALAPPDATA%/opencode/e2e-snapshots/pre-fade-repair-20261025-195722`,
  **25 SHA256-verified files**. Keep it as the rollback point preceding startup normalization.
  It is separate from project backups and ordinary runner retention.

## Retired files

Keep these retired; .gitignore guards tracked replacements where applicable.
Detailed designs, decisions and inventories are preserved in session history and the pre-cleanup snapshot.

| Retired | Replacement / retained knowledge |
|---|---|
| `opencode-summary.md` | Agent-neutral `PROJECT_STATE.md`; AGENTS owns the cooperative claim protocol. |
| `e2e/e2e-all.ps1`, `e2e-all.ps1.new` | Current full/Android runners; AV-blocked name. |
| `e2e/e2e-run.mjs`, `e2e/e2e-features.mjs`, `e2e/e2e-features.ps1` | Shared platform/scroll/playback specs; unique coverage was ported **before deletion**. Repeat that audit for future test retirement. |
| Generated `src-tauri/gen/android/Run App.bat` | Root Build Android / Run Android scripts. Old generated path stays ignored. |
| `MOVE_COPY_SOUND_SPEC.md` | Shipped behavior above; full design in history (`f7f316e`). |
| `PER_SOUND_VOLUME_SPEC.md`, `SOUND_PRIMING_SPEC.md` | Current sections above; complete prose at `git show c60a355:<file>`. Their manifest `spec` fields are null; deleting a named spec without updating the registry fails coverage. |
| `RESTORE_DEFAULTS_SPEC.md`, `ICON_FEATURE_SPEC.md` | Shipped starter-merge and icon behavior; implementation/history retain design. |
| `TESTING_REPORT.md`, `TESTING_REPORT_FOLLOWUP.md`, `EDGE_TO_EDGE_REPORT.md` | Resolved audit records in git/history. |
| Untracked `scripts/Sound Normalizer/` | Deleted at user's request; playback volume trim supplies the wanted behavior. Do not resurrect a duplicate loudness key/feature without a new design. User retained source copies. |

The claim on line 3 is cooperative, not a mutex. Re-read before every write, never silently take another agent's
claim, release only when complete, and leave it in place on interruption. Follow AGENTS for the full protocol.
