# Project State

🔓 UNCLAIMED — last holder: opencode (2026-10-11 12:15) — **Phase 3 complete, all work committed AND pushed**
**Phase 3 is CLOSED and pushed as `dc9c276..7455c3b`.** Phase 3a added the machine-checked coverage gate
(`e2e/check-coverage.mjs` + `e2e/coverage.manifest.json` — 36 suites, 305 ids). Phase 3c was rescoped by its own
audit: "delete `e2e-run.mjs` / `e2e-features.mjs`" turned out to hide **~31 tests that existed nowhere else**, so
it became port-first — `specs/platform.mjs` (**W1–W6**), `specs/scroll.mjs` (**R1–R10**),
`specs/playback.mjs` (**Z1–Z12**), all three run from *both* entrypoints — and only then the `git rm`, the
`.gitignore` blocks and the `-Suite` `ValidateSet`. Phase 3b added the **definition of done** to `AGENTS.md`.
**Gates: web 200/0/0 exit 0 · Windows 199/0/1 exit 1 · Android 189/0/1 exit 1 — 0 FAIL on all three.**
Commits: `23bf458` (priming + harness refactor + Phase 3a/3c), `8a2d900` (state record), `7455c3b` (DoD).
Previous (Phase 2, opencode, claimed 2026-10-10 22:10, released 23:12): **closed the mobile coverage gaps** by moving five
more suites out of the entrypoints and into shared specs run from *both* platforms. New:
`e2e/specs/indicators.mjs` (U1–U7), `sliders.mjs` (B1–B4 box-size), `soundintogroup.mjs` (H1–H2),
`drag.mjs` (X1–X2), `refcount.mjs` (G1–G5). `lib/driver.mjs` gained `dragFromTo` (mouse vs
`Input.dispatchTouchEvent`); both ctx objects gained `isTauri`, `navigateTo`, `clickModalOpener`, `upload`,
`deleteCharacter`, `closeDrawer`/`openDrawer`. `e2e-full.mjs` 1866 → **1565** lines, `e2e-mobile.mjs` 1402 →
**1466**. **Web 172/0/0 exit 0; Windows 171/0/1 exit 1 (G5); Android 161/0/1 exit 1 (G5) — 0 FAIL on all three.**
⚠️ **The Android gate is no longer exit 0** — it now carries the same Tauri G5 WARN the Windows phase always
had, so `e2e-android.ps1` returns 1. Deliberate, not a regression; see Verification gates.
⚠️ **Not committed, not pushed.** Phase 3 (coverage manifest/checker, AGENTS.md DoD, retire `e2e-run.mjs` /
`e2e-features.mjs`) is the remainder.
This session (opencode, claimed 2026-10-10 20:44, released 2026-10-10 21:41): ported **priming**, **per-sound
volume** and **move/copy** to the mobile suite across three sub-sessions. Added **Suite Q (Q1–Q14)** to
`e2e-mobile.mjs`, driven by **`Input.dispatchTouchEvent`** (hold / hold+move cancel / edit-mode / consumption /
clear / reload persistence / three container shapes) — the item `SOUND_PRIMING_SPEC.md` §7 had left open;
Android → **105 PASS / 0 FAIL / 0 WARN / exit 0**. Then added **Suite P (P1–P16)** (touch, with a real
`Input.dispatchTouchEvent` tap as P9's trusted gesture) — the gap `PER_SOUND_VOLUME_SPEC.md` §8 tracked;
Android → **126 PASS**. Then added **Suite M (M1–M22)**, a port of desktop `e2e-full.mjs` Suite M: copy shares
`files[]`/legacy `file`, ids differ, `Name (copy)` / `(copy 2)` scoped to the destination, move relocates the
same object and preserves id/settings/files silently, and cross-slice moves into a group category, a group
character and an environment — all in edit mode via the picker modal; Android now **148 PASS / 0 FAIL / 0 WARN /
exit 0**. The user **hand-tested priming** on the built app. ⚠️ **Still not committed and not pushed.** Working
tree: `src/App.jsx`, `e2e/e2e-full.mjs`, `e2e/e2e-mobile.mjs`, `SOUND_PRIMING_SPEC.md`,
`PER_SOUND_VOLUME_SPEC.md`, `PROJECT_STATE.md`.
Latest session (opencode, claimed 2026-10-10 21:40, released 2026-10-10 22:07): **refactored the E2E harness
into a shared-library + shared-specs architecture with zero behavior change.** Phase 0 created `e2e/lib/`
(`cdp.mjs` CDP connect/sleep/evalJs with fatal socket-exit 3, `report.mjs` createReport/exit-code 2>1>0,
`page.mjs` SEED/PAGE_HELPERS/INSTRUMENT_AUDIO/CAPTURE_LS/restoreLs/submitModalExpr, `driver.mjs` makeDriver
`trustedTap`/`centeredCard`/edit-mode enter-exit for mouse and touch, `spec-runner.mjs` runSpecs). Phase 1
extracted desktop Suite P into `e2e/specs/volume.mjs` (P1–P16 + P9-setup "trusted gesture path available", 21
`[VOL]` asserts, self-contained seed/helpers) and both `e2e-full.mjs` (~2198→1863 lines) and `e2e-mobile.mjs`
(~1716→1400 lines) now call `runSpecs(ctx, [volume])`. **Re-verified green on all three gates 2026-10-10
21:52–21:59: web 172/0/0 exit 0, Windows 171/0/1 (pre-existing G5) exit 1 baseline, Android 148/0/0 exit 0** —
counts identical to pre-refactor. `npx eslint .` 0 errors/3 pre-existing warnings. ⚠️ **Not committed, not
pushed.** Working tree adds: `e2e/lib/*`, `e2e/specs/volume.mjs`; modified: `e2e/e2e-full.mjs`,
`e2e/e2e-mobile.mjs`. Phase 2 (mobile gap ports) and Phase 3 (coverage manifest + AGENTS.md DoD + retire
legacy suites) remain.
Previous session (opencode, claimed 2026-10-08 20:52, released 2026-10-09 03:46): implemented **one-shot sound
priming** (`SOUND_PRIMING_SPEC.md`, E2E ids `P17`–`P34`). **Web E2E 172 PASS / 0 FAIL / 0 WARN; Windows 171 PASS
/ 0 FAIL / 1 pre-existing `G5` WARN.** ⚠️ **Not committed, not pushed, not hand-tested; Android not run** (no device
attached). Working tree changes: `src/App.jsx`, `e2e/e2e-full.mjs`, `SOUND_PRIMING_SPEC.md` (now a build record),
`PROJECT_STATE.md`, plus the usual EOL-only `src-tauri/Cargo.toml` non-diff. Full handover in the *Sound priming*
section under Verification gates.
Previous holder: opencode, released 2026-10-06 23:32. **Per-sound volume is DONE and pushed as `10fe6e2`**:
shipped, hand-tested by the user, and green on all three gates (web 147, Windows 146, Android 85). Profiles and
hotkeys remain **unauthorised** pending the user's review.
(Two sessions before that: opencode, docs only, released 2026-10-06 22:18. 20:02-21:00: spiked and closed the last
open unknown in `PROFILE_SYNC_SPEC.md` §10 — the **desktop** picker-path write — which passes via a ~5-line runtime
`fs_scope().allow_file` grant, no blanket scope; also falsified the spec's `fs:default`/`read_dir` claim, found
the missing `dialog:allow-save` capability, and found a silent byte-corruption trap (`Array` vs `Uint8Array`).
21:12-22:00: wrote three specs for queued features and folded in the user's answers — **priming is one-shot and
explicitly not profile content**, **per-sound volume is a live card slider**. Pushed as `0a6f346` + `a1f0e8b`.)

**Read this file first.** It holds only the *current* state. Dated session-by-session detail lives in
[`docs/session-history.md`](docs/session-history.md) — read that only when you need the reasoning behind a
past decision.

**Any AI agent may edit this file, but only while holding the claim** (see *Permanent instruction: keep
`PROJECT_STATE.md` up to date* in `AGENTS.md`). Claim it as your first action; release it when the work is
genuinely finished.

Last updated: **2026-10-11** (Phase 3 complete — coverage gate, legacy suites ported then retired, AGENTS.md
definition-of-done; committed and pushed `7455c3b`; all three gates 0 FAIL)

---

## What the project is
**"The SpellCaster"** — a TTRPG soundboard where the GM assigns **sounds to Characters** and
**Environment categories**. Users play, loop, stop and reorder sounds; **move or copy** a sound between any
containers (edit mode); edit characters/categories/sounds; apply themes and a box-size (zoom) slider. A
**Tauri 2.x** shell around a **React 19 + Vite + Tailwind** SPA, ported to Android. All mobile-specific changes
are gated behind `isMobile` so desktop/web stay untouched.

## Project facts
- **Frontend: React 19 + Vite, entry `src/main.jsx`, all logic in `src/App.jsx`** (was 6240 lines on 2026-10-06,
  **~6500** after per-sound volume; **6769 now** after priming — line numbers in the specs have drifted, the
  structure has not).
- Backend: Rust/Tauri 2.x (`src-tauri/`), `tauri-plugin-fs` (2.5.1) + `tauri-plugin-log`.
- Storage: Tauri → `BaseDirectory.AppData` via the fs plugin; web → `localStorage` `sound_file_*` data-URLs.
- Data keys: `ttrpg_characters`, `ttrpg_environment` (**singular** — not `ttrpg_environments`; this has fooled
  harnesses before), `ttrpg_groups`, `ttrpg_data_version`, plus `backgroundSettings` and `boxSize`.
  `DATA_VERSION = '3'` (App.jsx:263) — **never bump it**: the mismatch path (App.jsx:322) renames the
  user's keys to `*_old` and resets to defaults.
- Package `com.mrhorakhty.thespellcaster.debug`; `tauri.conf.json` uses `devUrl: http://localhost:5173`.
- **Do not hardcode the version** — `vite.config.js` `define`s `__APP_VERSION__` from `package.json`.

## Repo state
- Branch **`mobile-support`**, ✅ **in sync with `origin/mobile-support`** (0 ahead / 0 behind, verified
  2026-10-11 12:10 after `git push` succeeded as `dc9c276..7455c3b`). ✅ Push works, no auth prompt or proxy
  trouble — consistent with 2026-10-04, 2026-10-06 and 2026-10-11.
- ✅ **Priming and the whole harness refactor are COMMITTED as `23bf458`** (2026-10-11 12:03), 30 files, after
  the Phase 3 coverage gate and the port-then-retire. **⚠️ Still not pushed.** Commit contents: `src/App.jsx`,
  `e2e/e2e-full.mjs`, `e2e/e2e-mobile.mjs`, `e2e/e2e-full.ps1`, `e2e/e2e-android.ps1`, `README.md`,
  `.gitignore`, `PROJECT_STATE.md`, `docs/session-history.md`, `SOUND_PRIMING_SPEC.md`,
  `PER_SOUND_VOLUME_SPEC.md`, **new** `e2e/check-coverage.mjs`, `e2e/coverage.manifest.json`, `e2e/lib/*`,
  `e2e/specs/*`, **deleted** `e2e/e2e-run.mjs`, `e2e/e2e-features.mjs`, `e2e/e2e-features.ps1`.
  💡 **`src-tauri/Cargo.toml` was correctly NOT swept in** — the `git add -A -- src-tauri` pathspec staged it but
  git normalised the LF working copy to match the committed blob, so `HEAD:src-tauri/Cargo.toml` and
  `HEAD~1:src-tauri/Cargo.toml` are the **same hash** `f701a93a`. Verified, not assumed.
  ✅ The AV-sensitive blob survived the commit: `HEAD:e2e/e2e-full.ps1` = `60f4645b`, 15765 bytes, readable.
- ⚠️ **The `post-commit` git hook is decorative and prints a false "backup" message.** On every commit it
  echoes `=== TTRPG Soundboard Backup Log ===` with `Backup location: %cd%` — i.e. the *project directory*, not
  a backup folder. **No backup is created.** `.git/hooks/post-commit.bat` is 6 lines of `echo` and nothing
  else. Do not read that output as "the commit was backed up" — use `.\backup-project.ps1`, which really does
  copy and verify.
- ✅ **The 2026-08-11 stash is gone** — `stash@{0}` (*"On feature/multiple-sound-files: Backup before reroll to
  master"*, touching `src/App.jsx`) was **dropped 2026-10-11** after the user confirmed multiple sound files has
  shipped and been working for a while. Verified obsolete before dropping, not assumed: the stash's `App.jsx` is
  **2194 lines with 0 occurrences of `storedName`, `toStoredFileName` or `audioFiles`** — the before-side
  snapshot taken before the branch was rolled onto master. HEAD is 6769 lines with 45 / 3 / 13 respectively.
  Its "added" lines are `console.log` debug calls and a split-layout sketch whose own placeholder text reads
  *"Character list will go here"*, plus single-file logic (`soundFormData.file`, `!/assets/${sound.file}`).
  **There are now no stashes in this repo.** 💡 If a `feature/*` stash reappears, the same test applies: grep
  the stashed blob for the feature's core symbols before deciding.
- All 7 branches were fully merged into `mobile-support` as of 2026-10-04; no unmerged feature work anywhere.
- The move/copy feature is **shipped and user-tested by hand** (2026-10-04), committed as `f7f316e`.
- Recent commits: `10fe6e2` "Add per-sound volume, with a live slider on every sound card" ·
  `c96193c` "Release the claim with a session summary for 2026-10-06" ·
  `a1f0e8b` "Record post-push state after the desktop spike and the three new specs" ·
  `0a6f346` "Close the desktop spike, add specs for volume, hotkeys and priming" ·
  `d698d06` "Retire move/copy spec, revise profiles spec, fix kill-ports /emu" ·
  `f7f316e` "Added ability to move or copy sounds…".
- ✅ `backup-project.ps1`, `AGENTS.md` and the state file are committed.
- ✅ **Working tree clean and in sync with origin** as of 2026-10-06 23:31 — with **one expected exception**:
  `src-tauri/Cargo.toml` shows as modified while containing **no content change**. Its working copy has LF
  endings and the committed blob has CRLF, so `git diff` reports nothing and a normalised hash confirms the
  content is identical. **Do not "fix" it by sweeping it into a commit**; if you want a clean `git status`,
  change the EOL deliberately and say so in the commit message.
- ⚠️ **The `post-commit` git hook is decorative and prints a false "backup" message.** On every commit it
  echoes `=== TTRPG Soundboard Backup Log ===` with `Backup location: %cd%` — i.e. the *project directory*, not
  a backup folder. **No backup is created.** `.git/hooks/post-commit.bat` is 6 lines of `echo` and nothing
  else. Do not read that output as "the commit was backed up" — use `.\backup-project.ps1`, which really does
  copy and verify.
- 💡 **Writing a multi-line git message from PowerShell 5.1**: `Out-File -Encoding UTF8` prepends a **BOM**, which
  lands inside the commit subject (`﻿Close the desktop…`). Use
  `[System.IO.File]::WriteAllText($p, $msg, (New-Object System.Text.UTF8Encoding($false)))` instead. To check for
  a BOM afterwards, read the object with `git cat-file commit HEAD` — **not** `git log | Out-File`, which adds a
  BOM of its own and fakes the problem.
- `git fsck` reports one **unreachable** missing blob `3d1fcf15` under the unreachable tree `8505be04`
  (Bitdefender ate it on 2026-09-30). No branch or remote references it, so **no real history is lost** —
  ignore it. All 16 refs read cleanly.

## Architecture gotchas — do not regress these
- **Two Rust entry points.** `src-tauri/src/main.rs` is desktop-only; `src-tauri/src/lib.rs` is Android/iOS
  (`#[cfg_attr(mobile, tauri::mobile_entry_point)]`). Plugins registered only in `main.rs` are **silently
  missing on mobile** (`plugin fs not found`). Keep both in sync.
- **`platform()` from `@tauri-apps/plugin-os` is synchronous** — it returns a string, it is not a promise.
  `.then()`-ing it caused `TypeError` → unmount → blank screen. It has been reverted once already.
- **Debug builds load the frontend from the Vite dev server**, so `npm run tauri android dev` must stay
  running or the installed APK shows a blank screen. `vite.config.js` sets `host: '0.0.0.0'` so the emulator
  reaches it via `10.0.2.2`. The HMR-websocket warning is cosmetic.
- **Card `borderRadius` is a static `12px`** and deliberately does *not* scale with `boxSize`.
- Sound cards are `<div role="button">`, **not** `<button>` — matters for CDP-driving tests.

### Data-model gotchas (found 2026-10-04 while planning move/copy, then shipped)
- **There are FIVE container shapes for sounds, not four.** `characters[].sounds`,
  `environmentSounds[].sounds`, `groups[].categories[].sounds`, `groups[].characters[].sounds` — **plus
  `groups[].sounds`, a vestigial array that `addGroup` allocates on every group (App.jsx:3137) and nothing ever
  pushes into.** Only `deleteGroup`'s cleanup (App.jsx:3155) and the delete-confirm name lookup
  (App.jsx:5930) read it. **Any code that walks containers to find a sound or a file reference must walk all
  five** — the four-shape assumption looks correct and is not. `allSoundContainers` (App.jsx:1812) is the one
  walker that gets it right; prefer it over a hand-rolled loop.
- **Audio bytes are keyed by `storedName`, never by sound id.** `toStoredFileName` (App.jsx:2255) mints
  `sound_<rand>_<safeName>`; the sound object holds only a *reference* in `files[].storedName`. Consequences:
  `deleteSound` (App.jsx:2179) never deletes files, but deleting a
  **container** deletes every file it references *unconditionally* via
  `removeContainerFiles` (App.jsx:1984, call sites App.jsx:2615, 2630, 3041, 3155, 3173), and so
  does removing a file in the sound modal via `removeFileIfUnreferenced` (App.jsx:1975, call sites
  App.jsx:2454, 2459, 2468). **Any feature that lets two sounds share a
  file must add the reference-count guard** — `isFileReferencedElsewhere` (App.jsx:1967) now provides it.
- **Effect declaration order decides `localStorage` write order, not setter order.** The three auto-save
  effects are declared `characters` (App.jsx:3164) → `environmentSounds` (App.jsx:3174) → `groups`
  (App.jsx:3184). A mutation spanning two slices therefore persists **the `characters`/`groups` side first,
  always** — so in any character↔group or environment↔group operation, the *removal* lands before the *append*.
  There is **no transaction and no single write choke point**; a quota failure mid-operation leaves partial
  state, surfaced only by the `role="alert"` banner via `reportSaveFailure` (App.jsx:3158). Do not assume
  "I called the append first, so it saves first".
- **Categories have no id — identity is the display name.** `cat.category` is the key everywhere
  (App.jsx:1737, 2802-2814). Duplicate category names across groups therefore collide as map keys.
- **Deleting a sound must always confirm, and today it does.** `handleDeleteSound` (App.jsx:2224) only opens
  the dialog; `deleteSound` has exactly one call site, `confirmDelete` (App.jsx:2230). Keep it that way — a
  second unconfirmed sound-removal path is a regression. ⚠️ **`transferSound`'s removal (App.jsx:2070) is
  deliberately *not* a delete** — it is the source half of a silent move, scoped to the single source
  container instead of `deleteSound`'s global sweep. Never reuse it for real deletes and never merge it into
  `deleteSound`; the two look alike and merging them silently disables the confirmation. The reasoning is in
  the comment at App.jsx:2060-2069.

## ⚠️ Operational warnings for agents
- **`npm run tauri android dev` never exits** (watches for rebuilds, streams logcat). It will hang the tool
  call. Use `adb shell logcat` / `adb devices` for read-only checks, or launch it detached via `Start-Process`.
- **Never create `e2e/e2e-all.ps1`.** Bitdefender permanently hard-blocks that exact filename at the
  filesystem-filter level. It is `.gitignore`-d and documented in `README.md`. Use `e2e/e2e-full.ps1`
  (web + Windows, delegates Android) and `e2e/e2e-android.ps1`.
- **Mobile WebView CDP socket is `webview_devtools_remote_<app-pid>`**, *not* `_5554`. Get the pid from
  `adb shell ps -A | grep spellcaster`, then `adb forward tcp:9223 localabstract:webview_devtools_remote_<pid>`.
- **`adb exec-out screencap` corrupts binary in PowerShell** — use `adb shell screencap -p /sdcard/x.png` then `adb pull`.
- **Do not use `Page.reload` to seed mobile `localStorage`** — it is unreliable on this AVD. Cold-start the app with
  the storage already in place (see `%TEMP%\opencode\restore-mobile.mjs`).
- **Back up before every change** — run `.\backup-project.ps1` (see the Backups section below). Do not
  hand-type the accented OneDrive folder name in it; it has been created wrong twice.
- **To drive the desktop Tauri app over CDP for a spike** (no app-code changes needed): set
  `$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = '--remote-debugging-port=9224 --remote-allow-origins=*'`, start
  `npm run tauri dev` detached (or just call the plugin over `window.__TAURI_INTERNALS__.invoke`), and talk to
  `http://127.0.0.1:9224/json`. This is what `e2e-full.ps1` Phase B does. `tauri dev` rebuilt in 17-34 s per
  change with the cargo cache warm, and re-restarts automatically when `capabilities/*.json` changes.
  💡 A **native file dialog** cannot be dismissed from the webview: it is a Win32 `#32770` owned by `app.exe`,
  and with `tauri dev` running hidden it is **not** the foreground window (polling `GetForegroundWindow` sees
  `Program Manager` forever). Enumerate windows by PID + class and `PostMessage(hwnd, WM_COMMAND, IDCANCEL)` to
  cancel, `IDOK` to accept the `defaultPath`.

## ⚠️ Antiviral: `e2e\e2e-full.ps1` gets quarantined
Bitdefender detects it as `CMD:Heur.BZC.PZQ.Boxter.949` and deletes the **copy** in the OneDrive backup
folder. It has hit twice: 2026-09-30 (ate git objects, silently corrupting the repo) and 2026-10-04 (ate
the backup copy, leaving a 199-file backup that looked complete).

**Contained, not solved** — the repo copy survives because the user excluded
`c:\users\emire\projects\ttrpg-soundboard\e2e\` from scanning. The **backup folder is still not excluded**,
and the user declined excluding all of OneDrive. `backup-project.ps1` verifies after copying and repairs
from the working tree / `git show HEAD:` instead. Accepted mitigation while the e2e files are final.

**Trigger, narrowed by controlled test** (variants written to `%TEMP%`, which is not excluded):
| Variant | Result |
|---|---|
| original | eaten |
| all `taskkill` / `Invoke-Expression` / `Stop-Process` stripped | **eaten** |
| only `Remove-Item $profile -Recurse -Force` removed | **survived** |
| kill commands only, no recursive delete | **survived** |
| original + that one line restored | eaten |
| `-Recurse -Force` → `-Recurse` (no `-Force`) | eaten |
| `-Recurse -Force` → `-Force` (no `-Recurse`) | **survived** |
| bare `Remove-Item … -Recurse -Force`, 46 bytes | **survived** |

So: **`-Recurse` is the trigger, and only in combination with the rest of the file.** Not `-Force`, not the
process kills, and the pattern alone is harmless. Fixing it would mean replacing that one line — the user
declined for now since the e2e files are final. 💡 Also disproved: the original theory that it was the
*bundling* of kill commands. The `rca_insight` log confirms a stable content-based detection
(`attack_types: ["Malware"]`), which is why a fixed file always or never trips it.

## Test harnesses
| Harness | Runs |
|---|---|
| `e2e/e2e-full.ps1` | Phase A `web` (headless Edge/CDP) + Phase B `win` (real Tauri/WebView2) |
| `e2e/e2e-android.ps1` | Android emulator/device phase |
| `e2e/e2e-full.mjs`, `e2e/e2e-mobile.mjs` | the two entrypoints the phases drive |
| `e2e/check-coverage.mjs` | **static coverage gate (2026-10-11)** — no browser, no CDP. Two layers: a **suite** registry (ids cannot drift or rot, shared specs must run on both entrypoints) and a **features** registry (a `shipped` feature with no covering suite is an error). `--update` re-syncs the id lists and nothing else |
| `e2e/lib/` | **shared plumbing** (2026-10-10): `cdp.mjs` (CDP connect + `sleep` + `evalJs`, fatal socket-exit 3), `report.mjs` (`createReport`, same exit-code contract), `page.mjs` (`SEED`/`PAGE_HELPERS`/`INSTRUMENT_AUDIO`/`CAPTURE_LS`/`restoreLs`/`submitModalExpr`), `driver.mjs` (`makeDriver`: `trustedTap` mouse+touch, `centeredCard`, `dragFromTo`, edit-mode enter/exit), `spec-runner.mjs` (`runSpecs`) |
| `e2e/specs/` | **platform-shared specs** (2026-10-10/11), **all 10 run from *both* entrypoints**: `volume.mjs` P1–P16, `indicators.mjs` U1–U7, `sliders.mjs` B1–B4, `soundintogroup.mjs` H1–H2, `drag.mjs` X1–X2, `refcount.mjs` G1–G5, `platform.mjs` W1–W6, `scroll.mjs` R1–R10, `playback.mjs` Z1–Z12, `reset.mjs` O1–O10 |

- Flags: `-Phase web|win|android|all` (default `all`), `-Suite full|mobile`. ⚠️ `run|features` were removed
  2026-10-11 when those suites were retired; both runners now carry a `ValidateSet`, so a stale `-Suite` value
  fails at the parameter instead of becoming "e2e-run.mjs not found" three phases later.
- 🏗️ **Architecture (2026-10-10):** entrypoints are thin — libs + ctx (`{ label, log, run, evalJs, sleep,
  reload, submitModal, upload, navigateTo, clickModalOpener, deleteCharacter, isTauri, driver }`) +
  `runSpecs(ctx, [specs])`. Each spec owns its seed/helpers and is platform-driven through the ctx (shared Suite
  P runs `driver.trustedTap` as mouse on desktop and `Input.dispatchTouchEvent` on touch; Suite X runs
  `driver.dragFromTo` the same way). LocalStorage snapshot/restore stays in the runners' tails. New gates bolt on
  via suite tags, not new files.
- ⚠️ **Two suites in `e2e-full.mjs` are NOT self-contained** (2026-10-10, found the hard way): Suites **D** and
  **M** read the board the earlier inline suites leave behind, so they break if a shared spec seeds and reloads
  in front of them. That is why all shared specs run in one block *after* Suite Y, and why there is an explicit
  `Page.reload` before Suite D — Suite G/T can leave the app on the Groups board, and D/M drive per-card
  controls that only exist on a sound board. `e2e-mobile.mjs` has no such coupling: every mobile suite seeds its
  own fixture. 💡 Treat a desktop "NO_CARD"/empty-section failure as *possibly a view problem*, not a missing
  element.
- 🆕 **Suite order inside the shared block matters too.** **W** leads — it asserts the app is at rest (no drawer
  open, the right chrome for this phase) and every spec below seeds and reloads on top of it. **R** seeds 60
  sounds, so it must stay *after* the inline desktop suites that still need the small board. **Z** runs last
  (just before `refcount`, which re-seeds after it) because it samples a fade ramp over ~2s and leaves the master
  volume where Z7 put it.
- Run `kill-ports.bat` first if a run fails to start; `/all` also clears app processes and adb forwards, `/emu` shuts down the emulator.
- **Both** runners snapshot `localStorage` before the suite and restore it afterwards, even on crash, via
  `e2e/e2e-snapshot.mjs` — so test data never clobbers real characters/sounds.
- Windows Phase A/B cleanup is PID/port-scoped on `--remote-debugging-port=9224`. It deliberately does **not**
  blanket-kill `msedgewebview2` (that killed the agent's own session once).
- Scratch harnesses from past sessions are in `%TEMP%\opencode` — delete at will, not part of the repo.

## Verification gates
- `npx eslint .` → **0 errors**, 3 pre-existing warnings (`convertFileSrc`, `_`, `ev` — all unused vars).
- `npx vite build` succeeds.
- `npm run lint` is green; it was failing before 2026-10-04 (`vite.config.js` needed a scoped Node globals
  entry in `eslint.config.js` — scoped on purpose so `process` can't leak into browser code).
- Web E2E suite `e2e/e2e-full.mjs` → **210 PASS / 0 FAIL / 0 WARN, exit 0** as of 2026-10-11 12:41
  (`e2e-run-20261011-123816.log`). Was 172 before Phase 3; **+38** are the four ported/added specs
  (W1–W6, R1–R10, Z1–Z12, O1–O10).
- Windows phase → `e2e-full.ps1 -Phase win -Suite full`: **209 PASS / 0 FAIL / 1 WARN, exit 1** (2026-10-11
  12:48, `e2e-run-20261011-124417.log`). The WARN is the pre-existing **G5** skip — Tauri uses physical uploads,
  not a localStorage seed. Exit is **1** because of that warn, not a failure.
- Android phase → **199 PASS / 0 FAIL / 1 WARN / exit 1** on 2026-10-11 12:56 (`e2e-android-20261011-125200.log`,
  Pixel_7 emulator). Same **G5** skip and the same deliberate exit-1 as Windows. Was 161 before Phase 3.
  ⚠️ Emulator touch pipeline, **not a physical device**.
- ✅ **`node e2e/check-coverage.mjs` is green** (2026-10-11): *"OK — manifest, code and platform wiring agree"*
  — 37 suites, 308 ids, 9 shared specs each verified imported AND passed to `runSpecs()` by **both**
  entrypoints. It is **static** (no browser, no CDP), so it belongs in any pre-commit sweep. Run
  `node e2e/check-coverage.mjs --update` after adding/renaming a test and review the id diff.
- 🆕 **The features registry — this is what answers "will my new feature be tested?"** (added 2026-10-11).
  The suite registry could only enforce that coverage does not **rot**; it said nothing about coverage
  **existing**. Ship a feature with zero tests and every check still passed. `coverage.manifest.json` now
  carries a `features` array: **23 shipped, 2 planned, and all 23 shipped features covered — zero recorded
  gaps.** A `shipped` feature with an empty `coveredBy` **fails** unless it carries an explicit `gap` reason,
  which then prints on every run. `planned` features must *not* claim coverage (catches a spec that shipped
  without being updated).
  💡 **Register the feature when you START it, marked `planned` — not when you finish it.** That is the
  moment the question should be asked; flipping to `shipped` is what forces the tests to exist. All five
  failure modes were verified with deliberately-injected bad entries, not assumed.
- ✅ **The last coverage gap is CLOSED — Reset to starter sounds now has a suite.** `e2e/specs/reset.mjs`
  (**O1–O10**), shared, runs last in both entrypoints. It ships as `restoreDefaults` (App.jsx:2959 →
  `mergeShippedDefaults`, App.jsx:349), which is a **merge, not a wipe**, and each assertion pins one clause of
  that contract: the entry point confirms and changes nothing (O1), Cancel is a real out (O2), shipped entries
  come first in shipped order (O3), a renamed shipped character is renamed back (O4), the user's own sounds
  survive *after* the shipped ones (O5), user-created entries follow (O6), a renamed default **environment
  category** is restored via the sound-id fallback (O7), groups are untouched (O8), a user-set icon survives
  (O9), and it is idempotent (O10).
  ⚠️ **The reason it was deferred twice was only half right.** It was recorded as "wipes the fixture every later
  suite reads" — true of the board it rewrites, but it does not destroy user content, so a **self-seeding** spec
  running **last** was always safe. The blocker was never the behaviour; it was that the spec had not been
  written. 💡 Two traps it pins, both from reading `mergeShippedDefaults`: environment categories have **no id**
  — `category` IS the key (App.jsx:343) — so renaming a default breaks the name anchor and the function falls
  back to matching a stored entry carrying one of that default's sound ids (App.jsx:371-373); without the
  fallback, renaming a default category duplicates every default sound. And a sound is user content only if its
  id is in **no** default's sound list (App.jsx:355), so a shipped sound dragged into another character is
  restored home rather than duplicated.
- ⚠️ **The checker had a blind spot, found while building the features registry.** Its category regex was
  `[A-Za-z]+`, which excludes digits, so the keyboard suite's `'A11Y'` category **never matched** — its three
  passing tests (Y1–Y3) were invisible to every check while the checker still reported green. Fixed two ways:
  the class is now `[A-Za-z0-9]+`, and a new `UNCATEGORISED_SUITE` check fails when a file logs under a category
  **no manifest suite claims** (without it, a category the scanner sees but the manifest omits is scanned by
  nobody — its ids are never counted, never registered, never reported). Suite **Y** is now registered
  (`e2e-full.mjs::Y`, 126 desktop tests). 💡 **Lesson: a scanner's own regex is part of what you have to verify.**
  A pattern that is too narrow does not error — it silently reports green over a region it never read.
- ⚠️ **Three real defects the new specs caught, all in the tests rather than the app** — keep them in mind,
  they are the same three traps the next port will hit:
  1. **Ternary precedence in a status argument.** `cond ? a : b ? 'PASS' : 'FAIL'` binds as
     `cond ? a : (b ? 'PASS' : 'FAIL')`, so the `expectMobile` branch returned a **boolean**. `report.mjs` counts
     anything that isn't the literal `'PASS'`/`'FAIL'` as a **WARN**, so W3/W6/R2 were silently demoted from
     results to warnings — and only on Android, because only there was `expectMobile` true. Always parenthesise
     the whole conditional: `(cond ? a : b) ? 'PASS' : 'FAIL'`.
  2. **`window.__setInput` does not survive a reload.** It is injected by `PAGE_HELPERS` at entrypoint start, so
     any spec that reloads and then calls it gets `undefined`; `evalJs` swallows the exception and the field
     keeps its old value, so the save looks fine and the assertion fails much later with a misleading value. Each
     spec must define its **own** setter in its post-reload helper block (as `volume.mjs.__setRange` and
     `playback.mjs.__pbSetField` do).
  3. **The board does not scroll the same way on both platforms.** Desktop's panel carries `overflow-y-auto`
     (App.jsx:4696) and the sidebar sits outside it; **mobile's board panel does not scroll at all**
     (App.jsx:5186) — the main-content column (App.jsx:5044) is the scroll container and the icon rail lives
     *inside* it, so it scrolls away with the content by design. `scroll.mjs` therefore finds the scroller by
     **walking up from a card to the nearest ancestor that actually scrolls**, and R8 asserts the *correct*
     expectation per platform rather than the desktop one everywhere.
- ✅ **Shared-harness refactor re-verified green on all three gates (2026-10-10 21:52–21:59)** — counts
  identical to the pre-refactor baseline: web **172/0/0 exit 0** (`e2e-full.ps1 -Phase web -Suite full`),
  Windows **171/0/1 (pre-existing G5) exit 1** (`-Phase win -Suite full`), Android **148/0/0 exit 0**
  (`e2e-android.ps1 -Suite mobile`). The shared `e2e/specs/volume.mjs` ran all 21 `[VOL]` asserts on each
  platform — P9-setup PASS "trusted gesture path available" (coords web/win x:398,y:235 prior n:2; android
  x:163,y:308). Proves the spec+ctx seam is behavior-neutral.
- ✅ **Phase 2 gap ports — all three gates, 0 FAIL (2026-10-10 22:48–23:11).** Web **172/0/0 exit 0**
  (`e2e-run-20261010-224758.log`), Windows **171/0/1 exit 1** (`e2e-run-20261010-225442.log`), Android
  **161/0/1 exit 1** (`e2e-android-20261010-230145.log`). Android count = 148 − 6 (inline Suite R, folded into
  Suite U) + 7 U + 4 B + 2 H + 2 X + 4 G. New mobile coverage that did not exist before: **U5/U7** multi-file
  icon and loop-icon count, **box-size slider** (grid collapses to 1 column at 1.8 — mobile cards are `w-full`,
  so box-size changes grid columns, not card width), **sound-into-group via the drawer**, **touch drag
  reorder** (pointer-event drag, works from a synthesized touch), and the **file-reference guard**.
- ⚠️ **The Android gate's exit code changed from 0 to 1, deliberately.** Suite G's negative check (G5) asserts a
  `sound_file_*` localStorage key disappears with its last owner; under Tauri the upload is a physical file in
  the app's uploads dir, so that check cannot apply and logs a WARN — which `report.exitCode()` maps to 1.
  `e2e-android.ps1` treats any nonzero suite exit as a failed phase, so Android now matches the Windows phase,
  which has always exited 1 for this same skip. **0 FAIL on every platform is the signal to read; the exit code
  alone is not a regression.** Revert by having `refcount.mjs` log `PASS`-style skip instead of `WARN` on
  Android — deliberately NOT done, because a silently skipped test rots unnoticed.
- ✅ **Layout confirmed by screenshot, not just by tests.** Pulled a real Pixel-class screenshot after the run: the
  volume row renders as a `100%` label + native slider **below** each card, cards keep their square aspect, and the
  multi-file and glow indicators are unaffected. 💡 The bars are visually prominent — four loud blue bars on a
  four-card board. That follows the spec's decision (live slider on every card, always visible, because
  hover-reveal is unusable on touch), but "a wall of visual noise" was a risk the spec itself flagged in §2b.3.
  Worth a design opinion from the user; shrinking the control is purely cosmetic and no logic depends on its size.
- ✅ **Move/copy verified by hand** — the user tested the built app (not just E2E) on 2026-10-04 and reported it
  works. Mobile-suite coverage added 2026-10-10 (**Suite M** in `e2e-mobile.mjs`, Android green).
- ✅ **Per-sound volume hand-tested too** — the user booted the built app on 2026-10-06 and reported it "works as
  intended from the brief testing", so it clears the same bar move/copy did. Remaining gaps are *coverage*, not
  known defects, and are listed in `PER_SOUND_VOLUME_SPEC.md` §8: the mid-fade branch of the rescale, a
  mid-fade-out level change, and a real loop-boundary crossing are not yet automated.
- 💡 **E2E output does not go to the console.** `e2e-full.ps1` writes the suite to
  `%TEMP%\opencode\e2e-run-<timestamp>.log`; only the `Write-Host` phase lines reach stdout. The log is **mixed
  encoding** (ANSI header, UTF-16LE body), so `Get-Content` shows spaced-out text. Decode it with
  `[System.Text.Encoding]::GetEncoding(28591).GetString([System.IO.File]::ReadAllBytes($p)).Replace([string][char]0,'')`
  and then grep for `FULL E2E SUMMARY`. **Run the runner detached** (`Start-Process ... -WindowStyle Hidden`) and
  poll the log — a foreground `| Select-Object -Last N` buffers everything and returns nothing until the end.
- 💡 **`ttrpg_themes` is seeded by the suites but no version of the app has that key** (`docs/session-history.md`:
  *"there is no `ttrpg_themes` key at all"*). Any "no new localStorage key" assertion must include it in the
  expected set or it will fail for a reason that has nothing to do with the code.

## Known environment facts
- Rust 1.97.1; SDK `C:\Users\emire\AppData\Local\Android\Sdk`; NDK `30.0.16138531`; JDK = Android Studio
  JBR (21), `JAVA_HOME` points there. AVDs: `Pixel_7`, `Pixel_Tablet`, `Small_Phone`.
- ⚠️ **Two ProtonVPN `10.2.0.2` gotchas, not one — they produce the same symptom and are easy to conflate.**
  The adapter is **still present** (verified live 2026-10-11: `Get-NetIPAddress` shows `10.2.0.2 ProtonVPN`
  alongside `192.168.1.102 Ethernet`), so either can recur. The trap is that the VPN address `10.2.0.2` and
  Android's **hard-coded** emulator-to-host alias `10.0.2.2` sit in the same subnet prefix and look alike.
  1. **Wrong host baked into the debug APK.** `tauri android dev` auto-detects the dev-server address and picks
     the VPN adapter: *"Info Using 10.2.0.2 to access the development server / Info Replacing devUrl host with
     10.2.0.2"*. `tauri.conf.json` still correctly ships `"devUrl": "http://localhost:5173"` — the rewrite
     happens **at runtime in the debug build**, so grepping the repo never shows it.
  2. **Vite not staying alive for the whole run.** Independently of the address, the app shows
     `Failed to request 10.2.0.2:5173` (tauri.localhost error page) if :5173 dies mid-run —
     `docs/session-history.md:571` records this one and attributes it to Vite's lifetime, not to the address.
     **Fixing one does not fix the other**, and the symptom is identical for both.
  ✅ **Mitigation for (1)**: `vite.config.js:19` binds `host: '0.0.0.0'`, so Vite answers on `10.0.2.2`,
  `10.2.0.2` and `192.168.1.102` alike and the wrong guess stops mattering. Added in **`9c2a4c3`**
  (2026-10-11-verified: *"Mobile UI adjustments"*, 2026-08-31). `e2e-full.ps1:296` additionally clears
  `TAURI_DEV_HOST` in cleanup so detection cannot leak between runs.
- 💡 **The raw logs of (1) are still on the Desktop and are NOT junk** — `~/Desktop/emu-out.log`,
  `emu-err.log`, `tauri-dev-stdout.log`, `tauri-dev-stderr.log`, all dated **2026-08-31**, ~30 KB total, i.e.
  the same day as the `9c2a4c3` fix. `tauri-dev-stderr.log` holds the detection lines quoted above and
  `emu-out.log` shows `IPv4 server found: 10.2.0.1`.
  ⚠️ **They corroborate this entry; they are not the only record of it.** An earlier version of this note called
  them "the smoking gun" and "the primary source" — that overstated them. `docs/session-history.md:1701` logs
  the same thing as a *risk noted* ("Vite lists the ProtonVPN `10.2.0.2` adapter first in its Network lines"),
  not as a diagnosed-and-fixed incident, so the prose record was thinner than this note implied. What the logs
  add is the **mechanism**, which no prose entry spells out.
  The harness no longer writes there — every redirect now goes to `$tmp` = `%TEMP%\opencode\`
  (`e2e-android.ps1:152-153`, `e2e-full.ps1:165-221`) — so these are one-off debris from a manual launch.
  ✅ **SETTLED 2026-10-11 — kept, and this is closed. Do not raise it again.** The user's call was to leave
  them in place once they were explained: ~30 KB, and they would show a recurrence immediately. **Nothing is
  lost if they are ever deleted** — the mechanism is written out above and the finding survives in
  `docs/session-history.md`. They were referred to as "backups" once, which is how this got re-raised twice;
  they are not backups and there is no decision outstanding.

## Backups
Run `.\backup-project.ps1` (root) **before any change** — full rules in `AGENTS.md`. Copies everything
except regenerable build output (`node_modules`, `dist`, `.git`, `target`, `gen`), then verifies every
source file reached the backup and repairs from git if not. ~203 files / ~39 MB, complete by the user's
choice (including `public/assets` audio).

💡 **The 31 GB incident:** `/XD src-tauri\target` was passed as a *path*; robocopy silently ignored it
and the "backup" was 34,966 files / 31 GB. `/XD` needs **bare** directory names. The script now prints
its exclusion list every run and aborts above 150 MB (deleting the folder, exit 1) so this cannot
recur unnoticed. **Never hand-copy with a bare `robocopy` call.**
💡 Backups accumulate — the script does not prune. Delete old ones by hand.
Latest: **`ttrpg-soundboard-backup-20261011-120800`** (219/219 verified, 39.5 MB) — taken **after** the push, so it
is the only backup matching `7455c3b` exactly. Also kept: **`ttrpg-soundboard-backup-20261011-120701`**
(219/219, 39.5 MB), taken just before the AGENTS.md edit.
🗑️ **Pruned 2026-10-11 at the user's request: 8 older backups deleted, ~315 MB reclaimed** (10 folders / ~355 MB
→ 2 folders / ~79 MB). Before deleting, every file in all 8 was checked against the repo and `git ls-files`;
the only files not present in the working tree were the three retired suites, and those are recoverable from
`dc9c276:e2e/e2e-run.mjs` etc. — `dc9c276` is on `origin/mobile-support`, verified with `git cat-file -e`.
Previous (all now deleted): `20261011-120339`, `20261011-102658`, `20261010-221101`, `20261010-214021`,
`20261010-212155`, `20261010-211224`, `20261010-205141`, `20261008-205212`.
Previous: **`ttrpg-soundboard-backup-20261010-221101`** (212/212 verified, 39.4 MB) — taken **before** the Phase 2
shared-spec work. (212 rather than 206 because the `e2e/lib` + `e2e/specs` files from Phase 0/1 are now included.)
Previous: **`ttrpg-soundboard-backup-20261010-214021`** (206/206 verified, 39.4 MB) — taken **before** the
shared-harness refactor edits, per the "back up before any change" rule.
Previous: **`ttrpg-soundboard-backup-20261010-212155`** (206/206 verified, 39.4 MB) — taken **before** the mobile
move/copy-port edits, per the "back up before any change" rule. Priming is **not committed**, so a pre-change
backup is the clean rollback point.
Previous: **`ttrpg-soundboard-backup-20261010-211224`** (206/206 verified, 39.4 MB) — taken before the mobile
volume-port edits.
Previous: **`ttrpg-soundboard-backup-20261010-205141`** (206/206 verified, 39.4 MB) — taken before the mobile
priming-port edits.
Previous: **`ttrpg-soundboard-backup-20261006-224711`** (206/206 verified, 39.3 MB) — taken **after** per-sound
volume shipped, so it is the only backup holding that work. ⚠️ **It saved a session**: a stray
`Add-Content -Encoding UTF8` (which injects a BOM mid-file) was followed by a `.Replace()` overload error that
made a variable `$null`, and the next `WriteAllText` **wiped `PROJECT_STATE.md` to 0 bytes**. Restored from this
backup in one step. 💡 **Lessons**: in PowerShell 5.1 `"str".Replace([char]0xFEFF, '')` throws (it wants a
`char`, not a `string`) — use `[regex]::Replace` or the `string,string` overload; and never chain a write onto a
variable that a failed command may have left `$null`. Verify a file's length after any bulk rewrite.
Older: `ttrpg-soundboard-backup-20261006-215129` (206/206, before the volume changes),
`20261006-213714`, `20261006-200301`, `20261004-230014`. ⚠️ **These older ones have since been pruned** — as of
2026-10-08 the OneDrive backup folder holds **only the current one**; nothing here needs deleting.
✅ The accented path check passes: `Masaüstü` char codes are `77,97,115,97,252,115,116,252`.

### Bitdefender quarantined the backup folder itself?
Not excluded, but it also did not fire again during the final runs — the several test backups taken after
the first deletion all kept `e2e-full.ps1`. Likely AV caching from the re-scan of identical content, not
safety. Assume it *will* be eaten again; `backup-project.ps1` is the mitigation, not a fix.

## Docs layout (changed 2026-10-04)
This file was split from a 1000-line `opencode-summary.md` — it had grown so large that future sessions had
to dig through dated history to find current state. It now holds **current state only**; the 35 dated session
logs moved to `docs/session-history.md` (append-only). Same for `AGENTS.md` (standing rules).
**Do not merge them back.** Read this file first, the archive only when you need past reasoning.

Then, later the same day, it was **renamed `opencode-summary.md` -> `PROJECT_STATE.md`** (`git mv`, so history
follows) because the old name was itself the problem: it said "opencode's file", which is what the previous
ownership rule told every other agent. The new name is deliberately agent-neutral.

### Ownership: claim / release, not "opencode only"
The old rule was *"opencode owns this file; all other agents treat it as READ-ONLY"*. It was **replaced**
2026-10-04 at the user's request — the reasoning and the old rule text are in `docs/session-history.md`.

Why it was wrong: most sessions here are **not** opencode (Cursor, Copilot, Claude Code, mobile app, browser),
so the file was read-only for exactly the agents doing the work, and it went stale. Now **no agent owns it** —
whoever is working **claims** it, edits it, and **releases** it. Full protocol in `AGENTS.md`; the claim is
line 3 of this file.

Three properties worth remembering:
- **Release means "done", not "stopping".** A session cut off mid-work must leave the claim in place — that is
  the signal that work here is in flight.
- **A stale claim is never overwritten silently.** It usually means a cut-off session, which is exactly the
  information the next agent needs. Report it and ask the user.
- **Cooperative, not enforced.** A markdown line is not a mutex; two agents starting in the same second can
  both claim. The protocol works because every agent loads `AGENTS.md`. No lock file was added — the user
  chose the markdown-only version as sufficient for same-checkout use.

### Standing rules in `AGENTS.md`
- **Back up before any change** — `.\backup-project.ps1` (copy + verify + auto-repair).
- **Delete deprecated parts** — retired files get `git rm`'d *and* a `.gitignore` entry *and* a line in
  this file's Retired files section. ⚠️ **A retired TEST file is a different act from a retired doc**: it loses
  passing coverage that nothing will ever report, so **port the unique coverage first, then delete**. The
  2026-10-11 Phase 3c audit found ~31 tests living only in the two legacy suites; delete-only would have passed
  every gate at 0 FAIL while quietly gutting a third of the suite.
- **Keep `PROJECT_STATE.md` up to date** — claim, edit in place, release.
- **Definition of done** (added 2026-10-11, `7455c3b`) — the **seven gates in order**: backup → `npx eslint .`
  (0 errors) → `npx vite build` → `node e2e/check-coverage.mjs` → web E2E → Windows E2E → Android E2E. ⚠️ It
  spells out that **Windows and Android exiting `1` is the healthy baseline** (the G5 file-reference WARN), that
  **0 FAIL is the signal and the exit code is not**, that new coverage must be registered with
  `check-coverage.mjs --update`, that a **user-facing** feature needs the user to hand-test the built app, and
  that a gate which could not run must be named rather than quietly omitted.

### Planning specs in the repo root
**Three specs were written 2026-10-06** for features the user queued; each is meant to be picked up **one per
fresh session**. They were written against `src/App.jsx` @ 6240 lines — **re-verify the line numbers**, they
drift. **Two are now shipped** (per-sound volume, priming) and remain in the root as **records of what was
built**; only `HOTKEYS_SPEC.md` is still an unbuilt plan, and it is **not authorised for implementation**.

| Spec | What it is | Recommended order |
|---|---|---|
| `PER_SOUND_VOLUME_SPEC.md` | ✅ **SHIPPED 2026-10-06** (E2E only, **not** hand-tested). Now a record of what was built, with the four wrong spec facts corrected in place. Card control is a **sibling of the card**, not a descendant — no `stopPropagation`, no `role="group"`. ⚠️ **`P1`-`P16` are taken**; priming and hotkeys must not reuse them. Traps recorded: the `\|\|` → `??` coercion that would revive a **muted** sound; `updateMasterVolume` must refresh `_baseVolume` or loop re-entry snaps back; and a slider drag persists **once on commit**, not per move | **DONE** |
| `HOTKEYS_SPEC.md` | Keyboard shortcuts to trigger sounds. In-app tier (a `keydown` listener) vs global (`tauri-plugin-global-shortcut`, desktop-only, `main.rs` only — the **reverse** of the dialog rule). ⚠️ a hotkey is a *reference*, and `PROFILE_SYNC_SPEC.md` §8 plus the category-name-as-identity landmine are what make that hard. ⚠️ it must not fire while a text field has focus — this app has many | **AFTER profiles** — inherit the reference story instead of solving it twice |
| `SOUND_PRIMING_SPEC.md` | ✅ **SHIPPED 2026-10-08**, **hand-tested 2026-10-10**, **Android-covered 2026-10-10** (Suite Q in `e2e-mobile.mjs`). Now a record of what was built. Right-click (desktop) / press-and-hold (mobile) primes a card; the primed set fires alongside the next trigger and is consumed. One-shot, session-only, **explicitly no `localStorage` key** (the absence is deliberate, asserted by `P31a`). ✅ **`P17`–`P34`** are now taken by priming; hotkeys must not reuse them. ⚠️ Traps recorded: a **stale-closure double-consume** fixed by making `primedRef` the authority; a long press *also* raising `contextmenu`; a right-click being `pointerdown`+`contextmenu` both; and a hold's release click needing suppression. | **DONE — next is `HOTKEYS_SPEC.md` after profiles** |

✅ **Both open questions are answered (2026-10-06) — no decisions are pending.** Priming is **one-shot**: the
primed set is consumed by the next trigger, nothing is persisted, and it is **explicitly not profile content** —
so **do not add a `localStorage` key for priming**; that absence is deliberate. Per-sound volume gets a **live
slider on the sound card**, not modal-only (the modal keeps one too). ⚠️ The two features now share the card
element: the volume slider must `stopPropagation` (to stop play *and* prime), so prime on the card body only.

### ✅ Sequence re-verified against the code 2026-10-06 22:40 — **confirmed, not changed**
The recommended order below was checked line-by-line against `src/App.jsx` (6240 lines) rather than taken on
trust. **It holds: volume → priming → profiles → hotkeys.** What the check added:

- **Hard constraint, hotkeys last.** `PROFILE_SYNC_SPEC.md` §4.2 puts every existing key behind a
  `profile:<id>:` prefix and `uploads/` behind `uploads/<profileId>/` (27 `localStorage` sites + 10 path sites,
  both **re-counted and still accurate**). A per-profile binding has nowhere to live until that refactor exists,
  and the alternative — global bindings over per-profile content — breaks silently on every profile switch.
- **Volume before profiles, for a stronger reason than the specs give.** `normalizeStoredData` (App.jsx:269) only
  spreads (`...entry`) and repairs `sounds`/`files` array shapes, so an unknown sound field genuinely survives a
  reload with **no `DATA_VERSION` bump**. Volume is the *last* content field that can be added before the storage
  refactor turns adding one into a two-step job.
- **Volume before priming, because volume settles the card.** Both nest controls in the sound card, and the
  nesting problem is **already solved in-repo**: the edit-mode buttons are anchored to the **wrapper** div
  (App.jsx:3838-3866) with the comment *"Anchored to the wrapper, not the card, so it does not inherit the card's
  pointerdown drag handler"*. That settles `PER_SOUND_VOLUME_SPEC.md` §2b.4's open ARIA decision — **no
  `role="group"` conversion; wrap the slider the same way.**
- **Priming's greenfield claim holds.** A scan for `onContextMenu` / `contextmenu` / `onTouchStart` / `longPress`
  returns **zero hits** in `App.jsx`. The only pointer handler is the edit-mode drag at 3643.
- **Volume also forces a test where none exists.** `updateMasterVolume` (App.jsx:1315-1335) is the only code that
  mutates a playing element's volume and has no coverage. Volume refactors it; the regression test comes free.
- **The card plays on `onClick` (3727), not `onPointerDown`** — `onPointerDown` (3643) arms a drag **only** when
  `editMode`. So outside edit mode the conflict is pure `click` bubbling from the slider to the card; **inside**
  edit mode the card does `preventDefault()` + `setPointerCapture` on pointerdown, so the slider must
  `stopPropagation` on `pointerdown` too or dragging it starts a sound drag.

⚠️ **Four spec facts are wrong and will cost time if not fixed before the work starts.** Verified this session;
none of them change the order:

| Spec claim | Reality |
|---|---|
| `PER_SOUND_VOLUME_SPEC.md` §7 + §2b.4: *"sliders in this app are **not** native `<input type=range>` — the master ones are custom divs with `onKeyDown`"* | **Wrong.** The master slider **is** native `<input type="range" min=0 max=1 step=0.01>` (App.jsx:4342-4351, again at 4432-4440), paired with a sibling `input[type=number]`. The `onKeyDown` at 4333 belongs to the **number** input. Keyboard support is therefore **free** (arrow keys), and over CDP you drive it by setting `.value` + dispatching `input`, **not** by dispatching pointer moves. This removes most of §2b.4's accessibility work and simplifies its E2E notes |
| `PER_SOUND_VOLUME_SPEC.md` §2b.4: *"decide the ARIA shape before coding — it affects markup for every card"* | **Already answered by precedent** — the wrapper-anchoring bullet above. Nested controls already exist inside the card (the stop button, App.jsx:3824, with `e.stopPropagation()`), so invalid ARIA is the shipped status quo, not a new problem |
| `PER_SOUND_VOLUME_SPEC.md` §4 warns the new-sound allowlist *"silently drops"* an unlisted field | **True and already biting.** `glowEnabled` / `glowProminence` are in the form template (975-976) and hydrate-for-edit (1439-1440) but are **absent from the 1488-1503 allowlist**, so a newly created sound silently loses its glow. An existing latent bug, not in scope — but it proves the trap is real and `volume` will hit it on the first save test. Use `?? 1`, never `|| 1` |
| `SOUND_PRIMING_SPEC.md` §8 and `PROFILE_SYNC_SPEC.md` §13 both say to seed the vestigial `groups[].sounds` by hand and assert it | **That array is wiped on read** — `normalizeStoredData`'s group branch returns `sounds: []` (App.jsx:306) and folds a legacy array into a `Default` category (307-309). The assertion **cannot survive a reload**; it must be made in-session or via the `Default` category. As written, both checklists contain an unpassable test |

⚠️ **If profiles are implemented after any of these, re-run the §3/§4.2 census in `PROFILE_SYNC_SPEC.md`
first** — 27 storage sites, 10 `uploads/` path sites, the two `ttrpg_*_icon` keys. Those numbers have gone stale
twice already (that is what the 2026-10-04 revision log exists for), and one new `localStorage` key makes them
wrong immediately. ✅ **Per-sound volume did not add a key** (asserted by test `P14a`/`P14b`), so the census is
still accurate.

### ✅ Per-sound volume — **SHIPPED and HAND-TESTED 2026-10-06**
`PER_SOUND_VOLUME_SPEC.md` is now a **record of what was built**, not a plan. Implementation lives in `src/App.jsx`
(~6500 lines now; the spec's line numbers have drifted, its structure has not):

- One optional sound field, `volume`, a **trim on top of** master — never an absolute, never a replacement.
  `normalizeSoundVolume()` is the single definition of "absent === 100%": it coerces the range input's **string**
  to a number and clamps 0–1. It is used in **both** save paths.
- ⚠️ **The new-sound save path is an explicit allowlist** (App.jsx ~1590) and a field missing there is dropped for
  every newly created sound while edits survive it, because the edit path spreads. `volume` is in it. Use
  `?? 1`, never `|| 1` — `0` is a legitimate level (test `P11` is the regression guard).
- Playback records `audio._soundVolume` (the trim) and `audio._baseVolume` (master × trim) at creation; the **four**
  volume applications and all three `applyFadeIn` calls use the combined target.
- `rescaleAudioTarget()` is the fade-preserving rescale, **extracted from `updateMasterVolume` and shared** with
  the new per-sound path — one copy of that arithmetic, deliberately.
- `mapSoundContainers()` + `patchSoundById()` write the field in **any of the five container shapes**, returning
  untouched branches unchanged so a drag does not re-render the board. Do not hand-roll per-slice setters.
- 💡 **Two behaviours that are decisions, not accidents.** (a) A card-slider drag updates local state + live audio on
  every pointermove but **persists once on commit** (`cardVolumeDraft`), because the three auto-save effects are
  undebounced and `JSON.stringify` the whole slice into localStorage synchronously — persisting per move stutters a
  90-sound board. (b) Loop re-entry reads `_baseVolume` back off the element, which is why the master path must keep
  it fresh (see the bug below).
- 💡 **The card gained one wrapper level.** Outer div = grid cell + the volume row; inner `relative` div = the card
  + the edit-mode buttons. The volume slider is a **sibling of the card, not a descendant**, so it inherits neither
  the card's `onClick` nor its edit-mode `onPointerDown` drag, and **no `stopPropagation` is needed**. This also
  settles `SOUND_PRIMING_SPEC.md` §3's "hold on the slider" warning — it is moot as built.

⚠️⚠️ **The E2E suite caught a real bug that asserting the audible level would have hidden.** `updateMasterVolume`
rescaled playing elements but did **not** refresh `_baseVolume`, so it stayed at its creation value — and
`playSound` reads `_baseVolume` back at **loop re-entry**, meaning a looping sound would have faded back down to
the level it started at after any master change. Fixed by setting `_baseVolume = target` inside the same loop.
**Lesson: when a value is read back later, assert that it is refreshed, not just that the output looks right.**

⚠️ **Two test-fixture traps, both of which made the live-rescale assertions vacuous** (they "passed" on web while
exercising nothing). (a) Only elements still in `audioElementsRef` get rescaled; a short or undecodable fixture
fires `ended` → `cleanupAudio` → unregistered within milliseconds, and an `ended` element still reports
`paused === false`, so a liveness check **cannot** see it. (b) `element.click()` from `Runtime.evaluate` is not a
user gesture, so web refuses autoplay and `play()` rejects. Shipped fixture: a **real bundled asset**
(`Longbow_4.mp3`, no `storedName` so it resolves from `/assets`) with `loop: true`, driven by
`Input.dispatchMouseEvent`, and P9 walks **one fresh element** through two master values — created at master 1 it
starts at 0.5, so observing it drop to 0.2 proves it was still registered.

### ✅ Sound priming — **SHIPPED, user hand-tested 2026-10-10**
`SOUND_PRIMING_SPEC.md` is now a **record of what was built**, not a plan. Right-click (desktop) / press-and-hold
(mobile) primes a card; primed sounds fire alongside the next trigger, then the set is consumed. Implementation is
in `src/App.jsx` (6769 lines; the spec's line numbers have drifted, its structure has not):

- **One-shot, session-only, no `localStorage` key** — the absence is deliberate. `primedSoundIds` (Set) is UI
  state; **`primedRef` is the authority** (see the bug below). `PRIME_HOLD_MS=500`, `PRIME_MOVE_CANCEL_PX=10`,
  `PRIME_FLASH_MS=2000` (App.jsx ~710).
- **`soundById`** is a `useMemo` Map over **`allSoundContainers()`** (App.jsx ~2140) — resolves from **all five**
  container shapes; never hand-roll a four-shape walker.
- **One chokepoint** `playWithPrimes` (App.jsx ~3808); card click, `Enter`/`Space` and any future hotkey all route
  through it. `stopTrigger` (App.jsx ~3793) stops the **whole** prime group via a `_primeGroup` token stamped on
  every element one trigger started, falling back to `stopSound` for a solo play.
- **Gestures**: right-click = `onContextMenu` (always `preventDefault`; returns early on `editMode ||
  e.pointerType === 'touch'`). Hold = `armPrimeHold` first in `onPointerDown`, **`button === 0` only**, document-
  level move/up/cancel listeners, and `suppressNextClickRef` to swallow the click the release produces.
- **Visuals**: `[data-prime-badge]` (amber `Zap`, top-left), `[data-prime-overlay]` (a **separate element**, not a
  ring class — the card already has lime rings for play/drag and two ring classes resolve by stylesheet order),
  `data-primed` / `data-fired` / `aria-pressed`, and a **Clear N primed sound(s)** header button shown only while
  something is primed.

⚠️ **The E2E suite caught the one real bug: a stale-closure double-consume.** `playWithPrimes` first read the
primed set from **state**, so two triggers in the same tick both saw the pre-consume value and the primes played
**twice** (test `P25`). Fixed by making **`primedRef` the authority** — read and clear the ref synchronously,
before any `await`; state now only drives the re-render. **Lesson: one-shot consumption needs a ref, not state.**

⚠️ **Three gestures traps, all guarded, all worth keeping.** (a) A long press *also* raises `contextmenu`, so the
`pointerType === 'touch'` guard is load-bearing — without it the hold primes and the menu event un-primes. (b) A
right-click is a `pointerdown` with `button 2` *and* a `contextmenu`; arming the hold on both toggles twice, which
un-primes — hence `button === 0` in `armPrimeHold`. (c) A hold's release produces a click that would also play the
sound; `suppressNextClickRef` swallows exactly that one, and is **reset on every new press** so it cannot swallow
an unrelated click.

⚠️ **`PRIME_FLASH_MS` was raised 1200 → 2000ms.** The flash is the *only* record of what fired (the primed set is
already gone), so it must stay up long enough to read. It also sat exactly on the `P23d` assertion boundary.
Re-triggering replaces the flash rather than stacking, so it cannot go stale.

📱 **Mobile / touch is now covered on Android (2026-10-10).** `e2e-mobile.mjs` **Suite Q (Q1–Q14)** mirrors the
desktop `P17`–`P34` set using **`Input.dispatchTouchEvent`** — hold primes without also playing, a 40px move
cancels, edit mode does not prime, a tap fires the primed set and consumes it, the clear-button lifecycle, no
`localStorage` key, no reload persistence, whole-group stop, and the three reload-surviving container shapes
(environment category / group category / group character), navigating via the mobile drawer. **+20 tests, Android
105 PASS / 0 FAIL / 0 WARN / exit 0** at that step (148 after the later volume and move/copy ports). This closes
`SOUND_PRIMING_SPEC.md` §7's one open item (⚠️ it is the emulator's touch pipeline, not a physical device).

| Spec | Status |
|---|---|
| `PROFILE_SYNC_SPEC.md` | **Revised again 2026-10-06** — docs only. Both platform unknowns are now **closed**: Android spiked 2026-10-04, **desktop spiked 2026-10-06**. The desktop answer: a user-picked path **is** writable, via a **~5-line Rust command** that calls `app.fs_scope().allow_file(path)` — the same mechanism the fs plugin uses for drag-and-drop. **No blanket fs scope, no `fs:scope: ["**"]`.** That 2026-10-06 spike also **falsified a fact the spec asserted** (`fs:default` *does* grant `read_dir`, so `fs:allow-read-dir` is not needed), **found a missing capability** (`dialog:allow-save` / `dialog:allow-open` — registering the plugin alone would have shipped broken), and **found a silent-corruption trap** (a plain `Array` byte payload is stringified by desktop IPC; a 4100-byte payload landed as 12297 bytes of comma-separated digits with **no error**). **Implementation is still not authorised** — the user wants to review the design first. Do not write app code for it unasked. |
| `MOVE_COPY_SOUND_SPEC.md` | **Retired 2026-10-04** — shipped, user-tested, committed as `f7f316e`, spec deleted. Its 8 settled decisions, invariants and deferred list are preserved in `docs/session-history.md`; the design now lives in `src/App.jsx`. See Retired files. |

## Open items
- **The claim/release protocol is unproven with a second agent.** Installed 2026-10-04; only opencode has
  used it, and only within the session that wrote it. Watch for the failure modes on the next non-opencode
  session: an agent that edits without claiming, an agent that never releases, or an agent that cannot tell
  which tool it is (the protocol tells it to write its own name — if an agent can't identify itself it
  should write `unknown-agent` and ask the user rather than guessing).
- ✅ **Push works from this session** (2026-10-04 23:00): `git push origin mobile-support` succeeded with no
  auth prompt or proxy trouble — `f7f316e..d698d06`. Previous sessions' push trouble is not reproducing; if it
  returns, check for a stale credential prompt rather than assuming the remote is at fault.
- **Antiviral quarantine of the backup** — contained via `backup-project.ps1` (verify + repair), not
  prevented. If the e2e harness is ever edited again, expect the file to be eaten from each backup and
  re-check a fresh backup with the script rather than trusting the robocopy exit code.
- **Debt 6 — native `onRenderProcessGone`.** Confirmed **blocked**: the Android WebView client is
  auto-generated by `wry 0.55.1` (`RustWebViewClient.kt` under `src-tauri/gen/`, which is gitignored), so
  there is no supported hook. Only viable via an upstream wry patch or vendoring it. Do not retry blindly.
- **Debt 7 — `e2e-all.ps1`.** Kept on the books as a reminder (user's decision). Enforced by `.gitignore`
  and documented in `README.md`.
- `src-tauri/gen/android/Run App.bat` stays gitignored (user's decision) — its port-5173 fix is local-only.
- `PROFILE_SYNC_SPEC.md` — **re-opened 2026-10-04, design revised, awaiting the user's go-ahead.** Profiles +
  export/import as a `.spellcaster` zip. Revised for real code drift, not cosmetics: `localStorage` call sites
  went 23→**27** and there are **10** `uploads/` path sites, both key sets needing the profile prefix, plus
  prefix *enumeration*; `ttrpg_characters_icon` / `ttrpg_environment_icon` were missing from the namespace
  table; **`localStorageMigrationCompleted` must stay global** (prefixing it would re-run the one-time web→Tauri
  audio sweep). Provenance turned out to be **structural, not a flag** — a reference with no `storedName` is a
  bundled asset, so the old "add a write-time provenance flag" risk is gone. "Reset to starter sounds" already
  shipped as `restoreDefaults` (App.jsx:2671), so it only needs profile-scoping. Two new risks added:
  cross-profile shared blobs (never hardlink between profiles) and profile-switch state reload (revoke the
  object-URL cache at App.jsx:2298).
- ✅ **Per-sound volume is complete and committed** (2026-10-06): shipped, **hand-tested by the user** ("works as
  intended from the brief testing"), and green on web / Windows / Android. ✅ Suite P is **now ported** to
  `e2e-mobile.mjs` (2026-10-10) and passes on Android — **148 PASS / 0 FAIL / 0 WARN**. Still uncovered: the
  mid-fade rescale branch and a real loop-boundary crossing (`PER_SOUND_VOLUME_SPEC.md` §8).
- ✅ **Phase 3 is DONE except for Phase 3b (the AGENTS.md definition-of-done) — the only remainder.** Added the
  machine-checked coverage gate (`e2e/check-coverage.mjs` + `e2e/coverage.manifest.json`), and retired the two
  legacy suites **by porting first**: `platform.mjs` W1–W6, `scroll.mjs` R1–R10, `playback.mjs` Z1–Z12, each run
  from both entrypoints. Gates **web 200/0/0 exit 0 · Windows 199/0/1 exit 1 · Android 189/0/1 exit 1** — 0 FAIL on
  all three, the two nonzero exits both being the pre-existing G5 skip. ✅ **Committed as `23bf458`** (2026-10-11
  12:03), 30 files, and ✅ **pushed as `dc9c276..7455c3b`** (0 ahead / 0 behind, verified after push).
  💡 **The lesson worth keeping: "delete the legacy suites" was wrong as written, and the audit is what caught
  it.** ~31 tests lived only in those two files. Any future retirement should start by diffing what a file
  uniquely covers — `check-coverage.mjs --update` on a manifest built while they still exist would have surfaced
  it mechanically.
- ✅ **Live playback is now automated on all three platforms** — this was the single biggest hole Phase 2 had
  deferred ("no desktop suite to share"). `PER_SOUND_VOLUME_SPEC.md` §8's *"a real loop-boundary crossing"* is
  closed by **Z8/Z9**: Z8 detects the rewind as a drop in `currentTime` across the app's own
  `timeupdate` threshold `max(duration - 0.25, duration * 0.98)`, and Z9 asserts the re-entry fade returns to
  the **current** master level, which is the `_baseVolume`-is-read-back regression guard. The mid-fade rescale
  branch and a mid-fade-out level change remain uncovered.
- ✅ **All five mobile coverage gaps are CLOSED (2026-10-10, Phase 2).** Card indicators (U5/U7, as
  `e2e/specs/indicators.mjs`), sliders/persistence (`sliders.mjs`), sound-into-group (`soundintogroup.mjs`,
  drawer-navigated), drag reorder (`drag.mjs`, real touch drag) and the file-reference guard (`refcount.mjs`)
  now all run on Android. **Only keyboard (Y) remains unported, on purpose:** it asserts
  `tabindex`/Enter-keydown on a card, which is meaningful for a physical keyboard and near-vacuous for the
  Android soft keyboard. Split view (L) is likewise N/A on mobile. **Reset to Defaults** was also considered and
  deliberately deferred: it wipes the fixture every later suite reads, so it would have to re-seed and run last.
  ⚠️ The live-playback gate was deferred for the same reason back then, but that reason evaporated in Phase 3 —
  it is now covered by `playback.mjs` on all three platforms.
- ✅ **Move/copy now has mobile-suite coverage** — `e2e-mobile.mjs` **Suite M (M1–M22)** ports the desktop suite
  (2026-10-10, Android **148 PASS / 0 FAIL**). The feature itself was already shipped (`f7f316e`) and
  hand-tested; this closes the last *coverage* gap for the three queued features. Still uncovered on mobile:
  keyboard (Y) and split view (L) only — both N/A or near-vacuous on touch, see above.
- ✅ **Sound priming is implemented, hand-tested, and E2E-green on all three platforms** — web **172 PASS / 0 FAIL**
  and Windows **171 PASS / 0 FAIL / 1 pre-existing WARN** (2026-10-08); Android **148 PASS / 0 FAIL / 0 WARN / exit
  0** (2026-10-10, after all three mobile ports). The user **hand-tested it on the built app** ("from the brief test
  it seems to be working fine"). ⚠️ **Still not committed and not pushed.** ✅ `e2e-mobile.mjs` **Suite Q (Q1–Q14)**
  now covers touch priming via `Input.dispatchTouchEvent`, closing `SOUND_PRIMING_SPEC.md` §7's open item (⚠️
  emulator touch pipeline, not a physical device). ✅ Per-sound volume (Suite P) and move/copy (Suite M) are **now
  ported** too; the remaining mobile gaps are the un-requested drag reorder / sound-into-group / sliders-keyboard /
  card-indicator items listed above. `HOTKEYS_SPEC.md` is the next queued feature (recommended **after** profiles).
- ✅ **The desktop picker-path write — DONE, PASSES** (2026-10-06, Windows, real Tauri/WebView2 over CDP :9224).
  `dialog.save()` returns a **plain absolute path string** (not a URL, not an object); **cancel resolves `null`**
  (the opposite of Android, which rejects). `writeFile` to that path is **denied today** — "forbidden path", and
  `exists()` is denied too, so it is a scope limit, not a write-only limit. **Two fixes, both built and measured:**
  (A) **runtime grant** — `app.fs_scope().allow_file(path)` via `tauri_plugin_fs::FsExt`, then the *same*
  `writeFile` succeeds byte-identically, and a **sibling file in the same directory stays denied** ✅ recommended;
  (B) `{"identifier":"fs:scope","allow":["**"]}` in `capabilities/default.json` — works with zero Rust but is
  blanket-wide (Desktop, Documents, Temp and ungranted siblings all wrote). ⚠️ `allow_file` is **exact-file
  only**; a granted *directory* does not cover new files inside it (that needs `allow_directory(dir, true)`).
- ✅ **The Android SAF spike (spec §7/§10 step 0) is DONE and PASSES** — run 2026-10-04 on an API 37 emulator.
  `dialog.save()` returns a **`content://` URI, not a path**; `plugin-fs` accepts that URI as `path` on mobile
  (`#[cfg(mobile)] resolve_file` → `android.rs` `resolve_content_uri` → `getFileDescriptor` →
  `openAssetFileDescriptor`), so a 4 KiB write + read round-tripped byte-identical and re-write truncates.
  **No fs-scope change is needed on Android.** A raw `/sdcard/Download/…` write is **refused** ("forbidden
  path"), so the spec's old `BaseDirectory.Download` fallback is dead. (This used to end "Remaining unknown: the
  desktop picker-path write" — that is now closed too, see above.)
- ⚠️ **Pass `Uint8Array`, never `Array`, to `writeFile`** (found 2026-10-06). Desktop IPC sends the `write_file`
  body via `fetch`, and `fetch` coerces an `Array` body to `toString()`: the write **resolves**, and the file is
  ~3× too large and unopenable. `Uint8Array`/`ArrayBuffer` are `BufferSource`s and go raw. `App.jsx` already
  does it right (`new Uint8Array(arrayBuffer)` at App.jsx:1221 and 2324). 💡 This is why the Android spike
  round-tripped perfectly and desktop did not: Android uses `postMessage` IPC, which preserves the array
  (`canUseCustomProtocol = osName !== 'android'`).
- ⚠️ **`fs:default` DOES include `read_dir`** — the 2026-10-04 revision of `PROFILE_SYNC_SPEC.md` claimed it did
  not and was wrong. `fs:default` → `read-app-specific-dirs-recursive` → `allow-read-dir` + `scope-app-recursive`.
  Verified in the resolved crate and measured: `readDir('uploads', AppData)` → 90 entries with the **unmodified**
  capability file. **No `fs:allow-read-dir` needed.** (The plural-vs-singular fact stays true: the per-command
  permission is `allow-read-dir`; `permissions/read-dirs.toml` defines a *set* named `read-dirs`.)
- ⚠️ **Registering `tauri-plugin-dialog` is not enough** — `capabilities/default.json` also needs
  `dialog:allow-save` + `dialog:allow-open` (or `dialog:default`), else the call fails with *"Permissions
  associated with this command: dialog:allow-save, dialog:default"*, which reads like a plugin-registration bug.
- ⚠️ **On Android the fs commands take the path in different places**: `write_file` expects it in a
  `encodeURIComponent`'d **header** with bytes as the body, `read_file` expects `{ path, options }` as **args**.
  Getting it wrong fails as `invalid args 'path' for command 'read_file'`, which looks like a permissions
  problem and is not.
- ⚠️ **`tauri android dev` built the APK but never installed or launched it** (2026-10-04). The Gradle output
  appeared complete and `pm list packages` showed the app, but the install step never ran — the app on the
  device was a **stale** build, which produced a false "Plugin not found". Recovery: `adb install -r
  src-tauri\gen\android\app\build\outputs\apk\x86_64\debug\app-x86_64-debug.apk`, then `adb shell monkey -p
  com.mrhorakhty.thespellcaster.debug -c android.intent.category.LAUNCHER 1`. **If a plugin "is not found" on
  device, verify the APK is current before debugging the capability file.**
- ✅ **`kill-ports.bat /emu` is fixed** (2026-10-04, found broken the same day). Its `for /f` line
  double-quoted the adb path, so cmd failed with *'"…adb.exe" devices | findstr…' is not recognized*, and the
  backtick variant fails differently (*cannot find the file* — cmd looks for a name starting with a quote).
  **Neither `for /f` idiom can capture a command that starts with a quoted path.** The fix redirects
  `adb devices` to a temp file and iterates that, so the captured command starts with `type`. Verified from
  PowerShell on a running emulator (killed it) and with none running ("no running emulator found").
- **Move/copy feature — shipped 2026-10-04, user hand-tested, committed as `f7f316e`, spec retired.** Settled
  behaviour, do not change unasked: copy **shares** the audio file reference (no byte duplication);
  entry is a third per-card button in edit mode; **move is silent with no confirm**; append at end of target;
  picker rows have **two** buttons and **no mode state**; copies auto-suffix `Name (copy)`, uniqueness checked
  against the **destination container only**. Because a copy shares the source's `storedName`, every destructive
  file cleanup is guarded by `isFileReferencedElsewhere` (App.jsx:1967) — container deletes at
  App.jsx:2615/2633/3041/3155/3173, sound-modal paths at App.jsx:2454/2459/2468. Partial cross-slice writes
  still rely on the existing save-error banner (not atomic — see the write-order gotcha above).
- ~~**Move/copy is not ported to the mobile E2E suite.**~~ **RESOLVED 2026-10-10** — this line was stale for
  the whole second half of the day. `e2e-mobile.mjs` **Suite M (M1–M22)** has covered move/copy on Android
  since 21:30, and the file-reference guard it depends on now runs there too (`e2e/specs/refcount.mjs`,
  G1–G5 with the Tauri G5 skip). Priming (Q), per-sound volume (P) and move/copy (M) are all covered.
- Deferred from the feature's design, still open if anyone picks them up: cross-container drag-and-drop
  (needs new sidebar drop zones — the existing hit-test only sees *rendered* cards), creating a
  character/category/group from inside the picker, moving or copying a whole container at once, and atomic
  cross-slice persistence (needs the parked `PROFILE_SYNC_SPEC.md` storage refactor).
- Not yet done: release APK (needs a signing keystore), wake lock, fullscreen guard, iOS (needs macOS).

## Retired files
Delete-then-ignore, so they cannot come back:
- `e2e/e2e-run.mjs`, `e2e/e2e-features.mjs`, `e2e/e2e-features.ps1` — **retired 2026-10-11**, `git rm`'d and
  `.gitignore`d. These were the legacy pre-refactor suites (`-Suite run|features`). ⚠️ **They were NOT deleted on
  sight** — the Phase 3 plan said "delete them", and auditing first showed **~31 tests that existed nowhere
  else**, so they were ported into shared specs *before* the delete: `specs/platform.mjs` W1–W6 (was Suite P),
  `specs/scroll.mjs` R1–R10 (was Suite A), `specs/playback.mjs` Z1–Z12 (was Suite E plus D11/D12). That is the
  whole point: **retire by porting, never by deleting.** The few genuinely duplicated checks were dropped
  (Suite B split-view, Suite C's feature matrix — both already covered inline) and two cosmetic ones were
  accepted as lost (the lime play-ring *colour*, and `viewport fills` which R7/R10 now cover).
- `MOVE_COPY_SOUND_SPEC.md` — shipped as `f7f316e` (created in `2d525ed`), **user hand-tested**, then deleted
  2026-10-04 at the user's request as obsolete. Its design record — the 8 settled decisions, the
  do-not-regress invariants, the deferred list and the real App.jsx line numbers — was moved into
  `docs/session-history.md` (session 2026-10-04 21:26) before deletion; the prose also stays in git history
  (`git show f7f316e:MOVE_COPY_SOUND_SPEC.md`).
- `RESTORE_DEFAULTS_SPEC.md` — shipped as `bde7483`, deleted 2026-10-04.
- `ICON_FEATURE_SPEC.md` — shipped as `53ce2eb`, deleted by the user 2026-09-28.
- `e2e-all.ps1` / `e2e-all.ps1.new` — replaced by `e2e-full.ps1`; filename is AV-blocked.
- `TESTING_REPORT.md`, `TESTING_REPORT_FOLLOWUP.md`, `EDGE_TO_EDGE_REPORT.md` — resolved, deleted; git history has them.

---

## Dated session detail
→ [`docs/session-history.md`](docs/session-history.md)
