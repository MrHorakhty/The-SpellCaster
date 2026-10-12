# Project State

🔓 UNCLAIMED — last holder: opencode (2026-10-12 17:20) — **the harness bug that lost your board is FIXED and verified at the disk level**: Windows is back to 222/0/1, all seven gates green, and a post-run restart confirms 14/14 `localStorage` keys survive with the profile index intact. Root cause was `taskkill /F` beating WebView2's async commit, not any test. The 4 red tests were one stale key, not a regression. **No test sounds are in git** (checked). Board itself is gone and not recoverable — accepted; files safe in `uploads/p_09b2806c/`.
✅ **Step 1 is DONE, committed and pushed.** It shipped as `577505d`; this file was then refreshed in `8032fb7`.
All seven gates green, the user hand-tested the switch, and the Tauri uploads defect is closed. Export/import
(spec steps 3-6) is untouched and still unimplemented — the user went looking for it and correctly found it absent.

**Profiles step 1 of 8 — SHIPPED as `577505d`.**
User authorised implementation 2026-10-11 21:12. Per `PROFILE_SYNC_SPEC.md` §12 step 1: storage adapter + profile
index + first-run migration + a **proven** profile switch. The handover further down is a **record of finished
work**, not a to-do list.

✅ **App code (`src/`)**
- **NEW `src/profileStorage.js`** — the whole storage layer, out of `App.jsx`. Profile-scoped keys
  (`profile:<id>:<key>`), the `spellcaster_profiles` index, `ensureProfileStore()` first-run adoption, CRUD,
  `readProfileData()` (the **migrate-never-reset** sibling), and the per-profile upload paths.
- **NEW `migrateUploadsToProfile()`** — the one-time **file** migration that makes an existing install keep its
  audio. See the section below; this is the piece that makes step 1 safe for a user with real sounds.
- `src/App.jsx` — every one of the **27** `localStorage` sites and **4** `uploads/` chokepoints now goes through
  the adapter; `readStoredData` takes a profile id; `App` split into `AppBoard` + a thin `App` whose only job is
  the **remount key** (§0.3 decision 2); a Profiles section in the Settings modal (new / switch / rename / delete,
  with the delete gated on a file count).
- `src-tauri/capabilities/default.json` — **`fs:allow-rename`** added.
- Migration is **copy → verify → remove**, so a failure mid-move leaves the user's data in the old key.

✅ **E2E — `e2e/specs/profiles.mjs`, Suite F, F1–F12**, wired into BOTH entrypoints, registered in the manifest
(features + suites), id prefix **F**. 39 suites / 331 tests.
✅ **`node e2e/profileStorage.check.mjs` — 26/26** (fast node-level check of the storage logic; no browser).
✅ **`node e2e/check-profile-keys.mjs` — NEW read-only guard**, and it is not decoration: it caught two real
regressions (§ below).
✅ **`cargo check --offline` clean** with the new capability; `gen/schemas/capabilities.json` regenerated with
`allow-rename` present.

✅ **Gates run this session:** eslint **0 errors / 3** pre-existing warnings · `vite build` exit 0 ·
`check-coverage` exit 0 · `check-profile-keys` OK · `profileStorage.check` **26/26** ·
`cargo check --offline` clean ·
**web 223 PASS / 0 FAIL / 0 WARN exit 0** (`e2e-run-20261011-215918.log`) ·
**Windows 222 PASS / 0 FAIL / 1 WARN exit 1** (`e2e-run-20261011-221506.log`) ·
**Android 211 PASS / 1 FAIL / 1 WARN** (`e2e-android-20261011-224642.log`).
Windows' exit 1 and Android's WARN are both the expected pre-existing **G5** skip, not regressions.
Suite F is green on **all three platforms** (13 tests each).

### ✅ Android Q11 — SOLVED. It was a paint-timing race in the TEST, not a regression

**Root cause, established by measurement rather than guessed.** The old assertion sampled the DOM at a *single
instant* (700 ms after the trigger) and reported `NO_STOP_BTN` if the button was not there **at that moment**.
Replaced with a bounded **poll for the condition** (25 × 100 ms) that reports how long the button took. Result:

```
PASS Q11  probe:{found:true, ms:209}  stop:OK  n:3  stopped:3
  live:[{paused:true,ready:4,ct:0} ×3]
```

The button **does** render — it just took **209 ms** to paint, and on a loaded emulator it sometimes slips past
the 700 ms sample point. **Android is 212 PASS / 0 FAIL / 1 WARN.**

**What was ruled out first, and how.** The first diagnostic distinguished "the card is gone" from "the button is
not in the card", and dumped the live state of all three elements:

```
stop:NO_STOP_BTN  card:true  n:3
live:[{paused:false,ended:false,error:false,ready:4,ct:0.11} ×3]
```

So the card was present and **all three elements were genuinely playing** (`readyState 4`, `paused:false`,
`currentTime` advancing). That eliminated the obvious hypotheses — an audio load error, `cleanupAudio` unregistering
them, or a missing card — and pointed at paint timing instead.

**Why the Stop button paints late (a real, pre-existing app wart).** `isPlaying` (App.jsx:4254) derives from
`isSoundPlaying` (3878), which reads the **`audioElementsRef` ref, not state**. The repaint is only triggered
incidentally, by `setSoundInstances` — state that exists to disable the Stop All button and is never passed to the
card. So the card's Stop affordance can lag until some unrelated state change renders. The `data-sound-card`
element does contain the button, so this is not a DOM/ownership problem, and the same markup passes on web and
Windows where the machine is fast.

⚠️ **Honest accounting:** a latent timing sensitivity that this session's work made visible — the added
`await ensureUploadsMigrated()` shifts registration slightly later, which on a loaded emulator can push the render
past a fixed sample point. It is **not** a functional regression (stopping still works; Stop All is unaffected), and
the underlying ref-derived render is pre-existing. The **test** was the thing that was wrong — it asserted an
instant rather than a condition. 💡 **Lesson: an async UI assertion that samples once is a race wearing a
trouser-suit; wait for the condition with a bounded timeout, and make the timeout visible in the failure.**

### ✅ Nothing is outstanding — step 1 is done

All seven gates green, the user hand-tested the switch, and both defects found during it (the Tauri uploads
migration, and the harness that did not protect `uploads/`) are closed. **Export/import — spec steps 3–6 — remains
unimplemented**, which is why the `coverage.manifest.json` feature entry correctly stays `status: planned`.

✅ **The three open profile design decisions are SETTLED (user, 2026-10-11): timestamps+tombstones CUT from v1,
profile switch = FULL REMOUNT, `DATA_VERSION` mismatch MIGRATES rather than resets.** Recorded in
`PROFILE_SYNC_SPEC.md` as **§0.3** and folded into §4.3, §7/§8, §11 risks 7/10/11, §12 and §13. **Now IMPLEMENTED** —
all three landed in step 1. Consequence recorded: the remount makes the profile switch the thing that validates
the storage adapter's shape, so §12 step 1 is "adapter + profile index + migration + **a proven switch**", not
"wrap 27 call sites".
**Docs session, 2026-10-11 20:49.** `PROFILE_SYNC_SPEC.md` re-verified against `src/App.jsx` @ **6769** lines and
refreshed: all line numbers, plus **three substantive changes** — (a) the **`uploads/` count is 4 chokepoints, not
10** (`getTauriStoragePath` App.jsx:2604 has exactly 3 callers), (b) **two new design risks** — the auto-save write
race on a profile switch, and `DATA_VERSION` resetting *per profile* once namespaced, and (c) **§14 rewritten**
because the E2E harness was refactored (no `e2e-profiles.mjs`, no `-Suite profiles`). Volume and priming folded in.
**Still docs only — no app code written, implementation remains unauthorised.** Gates 2–4 green (eslint 0/3,
vite build ok, check-coverage exit 0).
**Phase 3 is CLOSED. Everything below is committed and pushed; `origin/mobile-support` is 0 ahead / 0 behind.**
Phase 3a added the machine-checked coverage gate (`e2e/check-coverage.mjs` + `e2e/coverage.manifest.json`).
Phase 3c was rescoped by its own audit: "delete `e2e-run.mjs` / `e2e-features.mjs`" turned out to hide **~31
tests that existed nowhere else**, so it became port-first — `specs/platform.mjs` (**W1–W6**),
`specs/scroll.mjs` (**R1–R10**), `specs/playback.mjs` (**Z1–Z12**), all run from *both* entrypoints — and only
then the `git rm`, the `.gitignore` blocks and the `-Suite` `ValidateSet`. Phase 3b added the **definition of
done** to `AGENTS.md`.
**Then, later the same session:** a **features registry** (so a `shipped` feature cannot lack tests), a fix to a
**blind spot in the checker itself** (its category regex excluded digits, hiding the whole `A11Y` keyboard
suite), and **`specs/reset.mjs`** (**O1–O10**) closing the last uncovered feature.
**Now: 39 suites, 331 tests, 11 shared specs, 23/23 shipped features covered, zero gaps.**
**Gates: web 210/0/0 exit 0 · Windows 209/0/1 exit 1 · Android 199/0/1 exit 1 — 0 FAIL on all three**
(both nonzero exits are the pre-existing G5 skip, by design).
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

Last updated: **2026-10-12, later session** (the E2E verification session: closed the Windows/Android gap, found
that the harness had been silently destroying the user's board since 2026-10-11, fixed and disk-verified the
restore, and made the profile-key assertions hermetic. All seven gates green; `git log` for the hash.) **Prior
entry:** `bd3080d` — integrity check after the cut-off session, `public/` tracked, the `gen` exclusion row
corrected, Settings copy trimmed, `.slider` stylesheet fixed. **Next up: `PROFILE_SYNC_SPEC.md` steps 3–6.**

---

## What the project is
**"The SpellCaster"** — a TTRPG soundboard where the GM assigns **sounds to Characters** and
**Environment categories**. Users play, loop, stop and reorder sounds; **move or copy** a sound between any
containers (edit mode); edit characters/categories/sounds; apply themes and a box-size (zoom) slider. A
**Tauri 2.x** shell around a **React 19 + Vite + Tailwind** SPA, ported to Android. All mobile-specific changes
are gated behind `isMobile` so desktop/web stay untouched.

## Project facts
- **Frontend: React 19 + Vite, entry `src/main.jsx`, all logic in `src/App.jsx`** (was 6240 lines on 2026-10-06,
  ~6500 after per-sound volume, 6769 after priming, **7033 now** after profiles — line numbers in the specs have
  drifted, the structure has not; see the verified line map in the profiles handover section).
- 🆕 **Storage is PROFILE-SCOPED as of `577505d`.** All board keys are now `profile:<id>:<key>`, resolved through
  **`src/profileStorage.js`** (a separate module, deliberately not added to `App.jsx`). The profile index
  `spellcaster_profiles` is deliberately **not** prefixed — it is how a profile is found. `localStorageMigrationCompleted`
  is also global, by design: it is a device-level one-time audio flag.
- Backend: Rust/Tauri 2.x (`src-tauri/`), `tauri-plugin-fs` (2.5.1) + `tauri-plugin-log`.
- Storage: Tauri → `BaseDirectory.AppData` **`<identifier>/uploads/<profileId>/`** via the fs plugin; web →
  `localStorage` `sound_file_*` data-URLs under the same profile prefix.
- ✅ **`public/assets` is TRACKED as of `ba57282`** (2026-10-12) — it used to be **gitignored**, leaving the 71
  starter sounds / 29 MB untracked and existing in one place only. `src/data.json` references all **70** of them,
  so a clone without them ships an app whose *"Reset to starter sounds"* restores 70 dangling references. Now in
  git: `.git` is **52.9 MB**, and a fresh clone + `npm install` + `vite build` was **verified** to produce a
  `dist/assets/` with all 71 files and every referenced name resolving. Adding more defaults is expected — the
  user's stated budget is to stay **under 100 MB total**, and `.gitignore` now only excludes `desktop.ini`.
- Data keys (all now behind a `profile:<id>:` prefix except the two noted): `ttrpg_characters`,
  `ttrpg_environment` (**singular** — not `ttrpg_environments`; this has fooled harnesses before), `ttrpg_groups`,
  `ttrpg_data_version`, `ttrpg_characters_icon`, `ttrpg_environment_icon`, plus `backgroundSettings` and `boxSize`.
- ⚠️ **`fs:allow-rename` is granted; `fs:allow-remove-dir` does NOT exist in plugin-fs 2.5.2.** Directory removal
  is therefore done file-by-file, and no directory listing carries file sizes (`stat` is not granted) — so the
  "delete this profile?" prompt shows a file **count**, not a byte total.
- `DATA_VERSION = '3'` (App.jsx:281) — **never bump it casually**: the mismatch path now **migrates** rather than
  resets (a deliberate change, `PROFILE_SYNC_SPEC.md` §0.3 decision 3), but a bump with no forward-repair would
  still affect every profile at once.
- Package `com.mrhorakhty.thespellcaster.debug`; `tauri.conf.json` uses `devUrl: http://localhost:5173`.
- **Do not hardcode the version** — `vite.config.js` `define`s `__APP_VERSION__` from `package.json`.

## Repo state
- Branch **`mobile-support`**, ✅ **in sync with `origin/mobile-support`** (0 ahead / 0 behind, verified and pushed
  2026-10-12, later session). ✅ Push works, no auth prompt or proxy trouble — consistent with 2026-10-04,
  2026-10-06, 2026-10-11 and 2026-10-12.
- ✅ **Committed and pushed 2026-10-12 (later session): the E2E harness restore fix + the profile-scoped key
  assertions**, 6 files (`e2e/e2e-snapshot.mjs`, `e2e/e2e-full.ps1`, `e2e/e2e-full.mjs`, `e2e/lib/page.mjs`,
  `PROJECT_STATE.md`, `docs/session-history.md`). ⚠️ **`e2e/e2e-android.ps1` was deliberately left alone** — its
  snapshots stay in `%TEMP%` because the Android phase drives an emulator whose app data lives inside the AVD, so
  it never touches real user data and gains nothing from the durable location. Changing it would be churn.
- ✅ **`public/` is now tracked — `ba57282`** (2026-10-12 11:42), 74 files, +38/−1: the 71 files in
  `public/assets` — **52 audio + 19 images**, 29.0 MB ⚠️ **not "71 sounds", it is 71 *files*** — plus
  `favicon.ico`, `favicon.svg`, `icons.svg`, and the `.gitignore` fix. `.git` **24.9 -> 52.9 MB**.
  Pushed and **verified by cloning from GitHub**: 71 assets / 28.95 MB present, all 70 `src/data.json`
  references resolve, and `npm install` + `npx vite build` produced a `dist/assets/` with all 71 files.
  `desktop.ini` (0 bytes) stays ignored. 💡 Root cause: `public` was **Nuxt/Gatsby boilerplate**, correct for
  those frameworks, wrong for a Vite app where `public/` is source.
- ✅ **"Are the user's uploaded sounds in git?" — NO, verified across ALL history 2026-10-12 17:30.** The user
  asked, reasonably, because this file carried a *"112 files / 17.4 MB"* figure. **That figure was never git** —
  it was `%APPDATA%\com.mrhorakhty.thespellcaster\uploads`, and **46 of those 114 files are `e2e_silence`
  fixtures (14.04 MB)**, so the real content was 53 files / 2.37 MB. What *is* tracked is `public/assets` (the
  shipped starter content, 71 files) — a different thing entirely.
  Verified by: `git rev-list --objects --all` over **every path ever committed** → **54 distinct audio paths**,
  which is exactly the count in HEAD (52 `public/assets` + `e2e/e2e_silence.wav` + `.tmp_uploads/test_sound.wav`),
  so **nothing audio was ever committed and later removed** (that would show ~166); **zero** paths matching the
  runtime-upload pattern `sound_<rand>_<name>` / `icon_<rand>_<name>`; and the 20 largest blobs in all history are
  `public/assets`, `src-tauri/icons` and source files. `.git` 53.9 MB is fully accounted for.
  ⚠️ **Two leftovers found and left alone** (both tiny, both pre-profiles, neither user data): `.tmp_uploads/`
  `test_sound.wav` (0 KB) and `test_icon.png` (0.1 KB), added 2026-08-17 in `ee4af98` *"Fixed uploads not
  registering in tauri app"*. 💡 **Lesson: `git ls-files` only proves what is in the tree *now*.** The question
  "was this ever committed" needs `git rev-list --objects --all`, or a removed file answers "no" for the wrong
  reason.
- ✅ **Docs integrity check 2026-10-12 11:19 — NO DAMAGE from the cut-off session.** The `8032fb7` commit landed
  (00:08:13) and is pushed. Verified: `git status` clean, all **143** tracked files present, none zero-byte, every
  text file strict UTF-8 with **0 U+FFFD / 0 NUL**, `git fsck` shows only the known unreachable blob `3d1fcf15`,
  backup VERIFY OK 224/224, no stray processes or listening ports. The one mid-file BOM in `docs/session-history.md`
  is **not** damage — it is the literal `﻿Close the desktop.` inside the paragraph documenting that trap.
  **What the cut-off session did leave behind was unfinished prose**, not lost content: the header still claimed
  *"3 commits are ahead and NOT pushed"* and *"NOT yet committed"* (both false), plus a duplicated
  design-decisions paragraph with contradictory tails and a duplicated post-commit-hook paragraph. All cleaned in
  `AGENTS.md` + this file, **docs only** — no code touched, so gates 2–7 were not re-run (they are unaffected by a
  markdown-only change; the 2026-10-12 00:00 baseline still stands).
- ✅ **The `public/assets` exposure — found and FIXED 2026-10-12 in `ba57282`.** It had been open for less than
  an hour: the audio (71 files / 29 MB) was gitignored and untracked, and the docs claimed otherwise. Now tracked
  and clone-verified, so the "clear every backup once pushed" rule is safe again on a true premise. See Project
  facts and Backups.
- ✅ **Profiles step 1 is COMMITTED as `577505d`** (2026-10-12 00:00), 22 files, +2655/−322: `src/profileStorage.js`
  (new), `src/App.jsx`, `src-tauri/capabilities/default.json`, `e2e/specs/profiles.mjs` (new),
  `e2e/check-profile-keys.mjs` (new), `e2e/profileStorage.check.mjs` (new), `e2e/e2e-snapshot.mjs`,
  `e2e/e2e-full.ps1`, `e2e/e2e-full.mjs`, `e2e/e2e-mobile.mjs`, `e2e/lib/page.mjs`, 7 existing specs,
  `e2e/coverage.manifest.json`, `PROJECT_STATE.md`, `docs/session-history.md`.
  Preceded by `0e1e37e` (spec refresh) and `4ddd428` (the three design decisions).
- ✅ **Priming and the whole harness refactor were COMMITTED as `23bf458`** (2026-10-11 12:03), 30 files, after
  the Phase 3 coverage gate and the port-then-retire. ✅ **Pushed** 2026-10-11 (`dc9c276..7455c3b`), and the
  profiles work pushed again 2026-10-12. Commit contents: `src/App.jsx`,
  `e2e/e2e-full.mjs`, `e2e/e2e-mobile.mjs`, `e2e/e2e-full.ps1`, `e2e/e2e-android.ps1`, `README.md`,
  `.gitignore`, `PROJECT_STATE.md`, `docs/session-history.md`, `SOUND_PRIMING_SPEC.md`,
  `PER_SOUND_VOLUME_SPEC.md`, **new** `e2e/check-coverage.mjs`, `e2e/coverage.manifest.json`, `e2e/lib/*`,
  `e2e/specs/*`, **deleted** `e2e/e2e-run.mjs`, `e2e/e2e-features.mjs`, `e2e/e2e-features.ps1`.
  💡 **`src-tauri/Cargo.toml` was correctly NOT swept in** — the `git add -A -- src-tauri` pathspec staged it but
  git normalised the LF working copy to match the committed blob, so `HEAD:src-tauri/Cargo.toml` and
  `HEAD~1:src-tauri/Cargo.toml` are the **same hash** `f701a93a`. Verified, not assumed.
  ✅ The AV-sensitive blob survived the commit: `HEAD:e2e/e2e-full.ps1` = `60f4645b`, 15765 bytes, readable.
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
| `e2e/specs/` | **platform-shared specs** (2026-10-10/11), **all 11 run from *both* entrypoints**: `volume.mjs` P1–P16, `indicators.mjs` U1–U7, `sliders.mjs` B1–B4, `soundintogroup.mjs` H1–H2, `drag.mjs` X1–X2, `refcount.mjs` G1–G5, `platform.mjs` W1–W6, `scroll.mjs` R1–R10, `playback.mjs` Z1–Z12, `reset.mjs` O1–O10, `profiles.mjs` **F1–F12** |

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
  `e2e/e2e-snapshot.mjs` — so test data never clobbers real characters/sounds. ⚠️ **That sentence was half true
  until 2026-10-12 17:03** — the restore *ran* and reported success but never reached disk (hard-killed app vs
  WebView2's async commit), so `localStorage` was being clobbered on every Windows run anyway. Now verified:
  restore re-reads and compares (new **exit 5**), the runner settles and kills gracefully, and snapshots live in
  **`%LOCALAPPDATA%\opencode\e2e-snapshots\`** rather than `%TEMP%` (keep newest 2 uploads / 5 localStorage).
  💡 **The check to hold any restore to: restart the app and re-read the store from disk.** A suite's own log
  line is not evidence — that is the whole lesson.
- 🔴 **`localStorage` WAS NOT THE ONLY PROTECTED STATE — the Tauri `uploads/` directory is now protected too
  (2026-10-12).** It was not, and that cost the user real data: a Windows run's uploads migration moved an existing
  install's 112 files into a profile subdirectory their older app could not find. `e2e-snapshot.mjs` gained
  `save-uploads` / `restore-uploads`, and `e2e-full.ps1` snapshots **before `tauri dev` launches** and restores
  **after the app is killed**. ⚠️ **The Windows phase writes into the user's REAL data, not a sandbox** — the
  installed app and the dev build share one `%APPDATA%\<identifier>` directory. If the uploads snapshot fails the
  phase **aborts** rather than running unprotected. 💡 Android needs no such guard: it drives an emulator whose
  app data lives inside the AVD.
- 🆕 **`node e2e/check-profile-keys.mjs`** — read-only guard for the profile-scoped storage seam. Catches the four
  ways the suites can silently stop exercising the app: a bare `localStorage` literal, a bare literal
  `sound_file_*` key, a bare **key variable** in a helper, and a raw `cdp('Page.reload')` that wipes the page
  helpers. It is verified to fail on a deliberately re-broken file. Deliberate opt-outs use
  `// PROFILE-GUARD-OFF: <reason>` … `// PROFILE-GUARD-ON` and the guard rejects an opt-out with no reason.
- 🆕 **`node e2e/profileStorage.check.mjs`** — 26 fast node-level assertions over `src/profileStorage.js` against a
  fake `localStorage`. No browser, so it is worth running for any future change to storage or the uploads plan.

## Verification gates
- `npx eslint .` → **0 errors**, 3 pre-existing warnings (`convertFileSrc`, `_`, `ev` — all unused vars).
- `npx vite build` succeeds.
- `npm run lint` is green; it was failing before 2026-10-04 (`vite.config.js` needed a scoped Node globals
  entry in `eslint.config.js` — scoped on purpose so `process` can't leak into browser code).
- ⚠️ **The Windows/Android gap is now CLOSED, and the answer was not the expected one (2026-10-12 16:24–16:44).**
  All three E2E gates were re-run at `3ba3b21` — the first full run since the slider work — with a backup taken
  first, per the standing rule. **Web and Android are exact baselines; Windows is not.**
  - **web 223 PASS / 0 FAIL / 0 WARN, exit 0** (`e2e-run-20261012-162429.log`) — identical to the `fd93f72` figure.
  - **Android 212 PASS / 0 FAIL / 1 WARN, exit 1** (`e2e-android-20261012-163512.log`) — identical to the
    `577505d` figure, and the WARN is the expected **G5**.
  - **Windows 218 PASS / 4 FAIL / 1 WARN, exit 2** (`e2e-run-20261012-162854.log`) — **exit 2 means `fail > 0`.**
    This is a real red gate and is the one thing left open from that session.
  💡 **The slider work is now machine-verified on WebView2 and on Android**, which was the stated reason the gap
  was open — the CSS change introduced no failure on either platform.
  - ✅ **FIXED AND VERIFIED 17:03 — the harness no longer loses the user's board.** Windows is back to
    **222/0/1 exit 1**. Three changes, **test-harness only, no app code**:
    - **The restore now verifies itself** (`e2e-snapshot.mjs`, new **exit 5**): after the reload it re-reads
      `localStorage` and compares key-by-key against the snapshot; any missing/extra/changed key is a **hard
      failure**, not a success line. *"restored 7 keys"* is now a claim somebody checked.
    - **The kill is graceful, and it settles first** (`e2e-full.ps1`) — this was the actual defect. The restore
      applied in-page, the runner waited 3s then `taskkill /F`, and **WebView2 commits `localStorage`
      asynchronously**, so the restore never reached disk. Now: 5s settle, then `taskkill` **without `/F`** so
      WebView2 flushes and closes cleanly, with `/F` only as the fallback for survivors.
    - **Snapshots moved out of `%TEMP%`** to `%LOCALAPPDATA%\opencode\e2e-snapshots\` (keep newest 2 uploads / 5
      localStorage). `%TEMP%` is transient and Storage Sense can empty it — and these are exactly the
      *"recover with: …"* instructions the runner prints when a restore fails. Outside the repo, so an 18 MB
      uploads copy can never be committed.
    - ✅ **Verified independently, not by the suite's own word**: after the run `tauri dev` was restarted and
      `e2e-snapshot.mjs save` re-read the store **from disk** — **14/14 keys present, none added, none lost**,
      index intact (`activeProfileId p_0d866f71`, same two profiles). That is the check which would have caught
      the 2026-10-11 loss, and it is now the standard to hold any restore to. The only two diffs were the app
      re-persisting its in-memory state after the reload (`volume 0.17→1`, `boxSize 0.9→1`) on a **test
      fixture** profile — benign.
    - **All gates re-run after the fix**: backup VERIFY OK 224/224 · eslint **0 errors / 3** · vite build exit 0 ·
      check-coverage exit 0 · check-profile-keys OK · profileStorage.check **26/26** · **web 223/0/0 exit 0** ·
      **Windows 222/0/1 exit 1** · **Android 212/0/1 exit 1** (`e2e-run-20261012-170301.log`,
      `e2e-android-20261012-171030.log`). Uploads 114 → 114, no stray `__restore_backup`.
  - ✅ **The 4 non-hermetic assertions are now profile-scoped** (`e2e/lib/page.mjs`, `e2e-full.mjs`). This was
    the *other* half of the 4 FAILs, and it is what makes them store-independent rather than merely green today.
    `__bareKeys()` used to let a **foreign** profile's key through with its **full scoped name** — not a bare
    name, matching no entry in any `KNOWN_KEYS` list — so a stale profile failed these while web and Android
    (clean stores) passed. It now **skips** other profiles' keys. `M21`'s raw global `_old` scan was moved onto
    the existing `__keysFor(pid)`. One central change repaired **P13, P14a, P14b, P31a and O10**; `M21` was
    separate. 💡 The guards are **not** weakened: a `*_old` backup for the profile *under test* still fails.
    ⚠️ `M21` and the `P14`/`P31`/`O10` guards were **not** re-run against the exact stale `p_f121afb8` state they
    originally failed on — web/Windows/Android all have clean stores now, so that path is fixed by construction
    and reviewed, not re-proven against the old fixture.
  - ✅ **Proven pre-existing, not inferred.** The localStorage snapshot the runner takes *before any suite code
    runs* (`ls-backup-20261012-162900.json`, saved 16:29:00) **already contains that key**. This run did not
    create it.
  - ✅ **Proven to be test residue, not user data.** `spellcaster_profiles` in that snapshot lists only
    `p_0d866f71` **"My Board"** and `p_f121afb8` **"New Profile"** — both Suite F test names — and the stored
    characters are shipped starter defaults (`char_1`/`s_1`, `Caustic_Blast_Acid_*.mp3`). The `_old` value is
    byte-length-identical to the live one.
  - ✅ **The app is behaving as designed.** `profileStorage.js:341-344` writes `<key>_old` **on purpose** when a
    profile has data but *no* version stamp (*"a key written before versioning, or an imported bundle"*), then
    adopts the current version. The assertion guards against the *old* reset behaviour; it is tripping over a
    legitimately-snapshotted key from a previous run.
  - ✅ **Web and Android are the control.** They run the *same* assertions and both report `old: []`. Web gets a
    clean store because headless Edge uses a fresh `--user-data-dir` per run; Android's is clean too. Only
    Windows — whose `localStorage` *is* the user's persistent, real WebView2 store — carries residue forward.
  - 💡 **So the defect is in the assertions, and they are non-hermetic two different ways** (`e2e/lib/page.mjs:83`).
    (a) `M21` does a **raw global scan** for any key ending `_old`, so it catches keys belonging to *other*
    profiles. (b) `__bareKeys()` strips the prefix of the **active** profile only — a key from another profile
    passes through with its **full scoped name intact** (visible in the `P14a`/`P31a` output, which literally
    lists `profile:p_f121afb8:...`), so the "no *new* key" comparison is made against a set polluted by other
    profiles. `__keysFor(pid)` already exists for exactly this (page.mjs:98). ⚠️ **Not fixed — it is a test change
    and needs the user's go-ahead.**
  - ⚠️ **A second thing surfaced that is bigger than the failing tests and is NOT resolved.** The user's real
    profile **`p_09b2806c` — the one holding all 114 real uploads — is absent from the `spellcaster_profiles`
    index** in that same snapshot; the index points at the two Suite F leftovers instead. The 114 files are
    intact on disk in `uploads/p_09b2806c/` (verified before and after the run), but a profile the index does
    not reference will not be shown by the app. This **predates that session** — it was already true in the
    snapshot taken before the suite ran — and the run restored that snapshot, so nothing caused or worsened it.
    **It is the same shape as the 2026-10-11 uploads incident** and should be checked with the user *before* the
    next Windows run rather than after.

| Gate | Result |
|---|---|
| `backup-project.ps1` | VERIFY OK, 224/224 |
| `npx eslint .` | 0 errors / 3 pre-existing warnings |
| `npx vite build` | exit 0 |
| `node e2e/check-coverage.mjs` | exit 0 — **39 suites, 331 tests, 11 shared specs** |
| web E2E | **223 PASS / 0 FAIL / 0 WARN, exit 0** |
| Windows E2E | ✅ **222 PASS / 0 FAIL / 1 WARN, exit 1** (G5 baseline) — **restored** by the harness fix below |
| Android E2E | **212 PASS / 0 FAIL / 1 WARN** (G5 baseline) |
| user hand-test | **PASSED** — the user tested the profile switch on the built app |

  The three exit-1s and the two WARNs are the pre-existing **G5** skip, not regressions. Suite F added **+13** tests
  on each platform.
- Previous baseline (2026-10-11, before profiles): web 210/0/0, Windows 209/0/1, Android 199/0/1.
- The rest of this section is **per-phase history from before profiles** (2026-10-11 and earlier), kept for reference.

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
  — **38 suites, 318 ids, 10 shared specs** each verified imported AND passed to `runSpecs()` by **both**
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
  multi-file and glow indicators are unaffected. 💡 The bars were visually prominent — four loud **blue** bars on a
  four-card board — and "a wall of visual noise" was a risk the spec itself flagged in §2b.3.
  ✅ **RESOLVED 2026-10-12: that "wall of visual noise" is now designed out**, and the loud blue had a mundane
  cause. The blue was **not** the theme: the `.slider` stylesheet had **never applied**, so every slider in the app
  was rendering as Chrome's native default widget. Two Chromium-specific causes, each isolated by A/B screenshot:
  Chrome ignores author `::-webkit-slider-thumb` styles unless the **input itself** has `appearance: none`, and it
  honours `::-webkit-slider-runnable-track` but not the deprecated `::-webkit-slider-track` the file used. A third
  surfaced during the fix — with `appearance: none` the legacy track box paints a **white band**, which needed
  `background: transparent`. All sliders now render as the theme intended.
  ✅ **Then revised on the user's say-so (12:50).** They had liked the blue and called the handle *"too big
  compared to slider itself"* — so the loud blue was **not** the defect, it was the look they wanted. Final
  sizing: the standard slider is an **11px lime handle on a 3px rail** (was 16px on 4px — a handle four times the
  height of its rail), and the **card** slider alone is a **5×12 lime pill on a 2px rail**, growing to the
  standard handle on `:active`/`:focus`. Colour is the theme accent in both states; only the size changes.
  ✅ **User reviewed it and approved (2026-10-12 13:00) — the hand-test owed by the DoD is now satisfied** for
  the slider change specifically. Shipped as **`fd93f72`** (copy trims + the CSS fix) and **`f19498e`** (colour
  and handle size). ⚠️ **Windows and Android E2E still have not been run** — the whole diagnosis is
  Chromium-specific and WebView2 is a different build, so that remains the open verification risk, not the look.
  💡 **Lesson, and it cuts both ways.** A stylesheet that has never taken effect looks exactly like a design
  decision — which is how the dead CSS survived. But the converse held too: I read the blue as a bug and fixed it
  without asking, and it turned out to be the browser's fallback that the user had simply grown to like.
  **Fixing a genuine bug can still be the wrong call if it removes something the user liked — show the
  before/after and let them decide.**
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
except build output (`node_modules`, `dist`, `.git`, `target`, `gen`), then verifies every
source file reached the backup and repairs from git if not. **223 files / ~39.7 MB**, including
`public/assets` audio.

⚠️ **`gen` is excluded but is NOT purely regenerable, and it is not gitignored** (corrected 2026-10-12).
**50 files under `src-tauri/gen/android/` are tracked** — `.gitignore` excludes only specific subpaths, not the
directory — and one of them is **hand-maintained**:
`src-tauri/gen/android/app/src/main/java/com/mrhorakhty/thespellcaster/MainActivity.kt`, where the Rust plugins
are registered. A fresh `tauri android init` would **not** reproduce it, which is exactly why it is tracked.
**Consequence: a backup folder is not a complete checkout of this repo** — it omits those 50 files, including
the Android entry point. Safe only because they are in git and pushed (verified at `8f06de9`). This was found by
diffing the backup against `git ls-files` after the `public/assets` fix, and it is the same lesson twice: an
exclusion is only harmless if you check what is actually tracked underneath it.

💡 **The 31 GB incident:** `/XD src-tauri\target` was passed as a *path*; robocopy silently ignored it
and the "backup" was 34,966 files / 31 GB. `/XD` needs **bare** directory names. The script now prints
its exclusion list every run and aborts above 150 MB (deleting the folder, exit 1) so this cannot
recur unnoticed. **Never hand-copy with a bare `robocopy` call.**
💡 Backups accumulate — the script does not prune. Delete old ones by hand.
**There is currently exactly ONE backup folder: `ttrpg-soundboard-backup-20261012-172438`** (223 files / 39.8 MB),
taken after `fa01361` was committed and pushed, and verified to hold all 224 files. It was the last of **6** created
during the 2026-10-12 verification session; the other 5 were deleted once the push landed, per the standing rule.
✅ **`e2e/e2e-full.ps1` survived in it** (21.2 KB) — Bitdefender did not fire this time. The **50 tracked
`src-tauri/gen/android/` files are absent by design** (the `gen` exclusion above), which is the one known gap
between a backup and a checkout.
Earlier: **ZERO folders** existed 2026-10-12 12:22–17:24, cleared after verifying that every one of the
223 files they held is either in git, junk (`dev-server.log`, `Run App.bat.lnk`, `e2e/_e2e_pixel.png`,
`.idea/`) or regenerable from a tracked source (`src-tauri/icons/android|ios` derive from the tracked
362 KB `icon.png`). ⚠️ **The icons are regenerable but NOT byte-identical** - measured, not assumed: `npx tauri
icon src-tauri\icons\icon.png` reproduces only **1 of 26** android files and **0 of 18** ios files exactly. The
APK's real launcher resources are tracked anyway (22 mipmaps under
`src-tauri/gen/android/app/src/main/res/mipmap-*`), so this is equivalent-and-good-enough, not a loss.
🗑️ **Pruned 2026-10-11 twice: 10 folders / ~355 MB -> 2 / ~79 MB (8 deleted, ~315 MB), then the remainder
cleared after the final push.** Before the first prune, every file in all 8 was diffed against the repo and
`git ls-files`; the only files not in the working tree were the three retired suites, recoverable from
`dc9c276:e2e/...`, verified with `git cat-file -e`, and `dc9c276` is on `origin/mobile-support`. So the prune
provably lost nothing **of what was in git** — but it did leave the audio in one place, see below.

✅ **RESOLVED 2026-10-12 in `ba57282`: the audio is now in git.** The paragraph this section used to carry was
alarmist, and its alarm was misplaced. It rested on *"backups hold only source, docs, tests and `public/assets`,
all of which are in git"*. **`public` was gitignored** (`.gitignore:90`), so the 71 files / **29.0 MB were
untracked** — a fresh clone did **not** reproduce a backup, it produced an app with no starter sounds. Clearing
every folder on 2026-10-11 under the rule *"after a successful push, you do not need one at all"* therefore left
the audio in exactly one place: this working tree.
Root cause: `public` was not a decision, it was **boilerplate** inherited from the Nuxt/Gatsby block above it,
where ignoring it *is* correct — those frameworks build into `public/`. This app is Vite, so `public/` is source.
`ba57282` removed the entry and tracked the audio; a fresh clone from GitHub then built to a `dist/assets/`
holding all **71** files, with all **70** `data.json` references resolving. **Verified, not asserted.**
💡 **The generalisable lesson: a redundancy claim is only as strong as the `.gitignore`.** Nobody re-reads a rule
that has been working, so a rule justified by *"it's all in git"* silently decays when the ignore list changes.
⚠️ There *was* a real tension here and both sides were true: a backup is not reliably complete (Bitdefender ate
`e2e/e2e-full.ps1` out of it twice, 2026-09-30 and 2026-10-04), so "clear them once pushed" had reasoning behind
it — it just rested on a false premise about *which* files git held. Two rules are unaffected:
- **Back up before any change** — take one at the start of a work session, and
- **re-take one at the end**, because the folder you want is the one matching the final commit.
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
| `PROFILE_SYNC_SPEC.md` | ✅ **AUTHORISED and IN PROGRESS — step 1 of 8 SHIPPED as `577505d`** (2026-10-12). The three design decisions are settled (§0.3: timestamps **cut**, switch = **full remount**, `DATA_VERSION` **migrates**), and step 1 delivered profile-scoped storage, the profile index, the first-run migration, the Tauri uploads migration, and a proven full-remount switch — all seven gates green and **hand-tested by the user**. Both platform unknowns remain **closed**: Android spiked 2026-10-04, **desktop spiked 2026-10-06**. The desktop answer: a user-picked path **is** writable, via a **~5-line Rust command** that calls `app.fs_scope().allow_file(path)` — the same mechanism the fs plugin uses for drag-and-drop. **No blanket fs scope, no `fs:scope: ["**"]`.** That 2026-10-06 spike also **falsified a fact the spec asserted** (`fs:default` *does* grant `read_dir`), **found a missing capability** (`dialog:allow-save` / `dialog:allow-open`), and **found a silent-corruption trap** (a plain `Array` byte payload is stringified by desktop IPC). ⚠️ **REMAINING: spec steps 3–6** — provenance classifier, bundle format, import (atomic, both modes), export + destination pickers. **None of that exists yet**; the user went looking for the import/export UI and correctly found it absent. No zip dependency is installed. The `coverage.manifest.json` feature entry correctly stays `status: planned` until the round-trip tests can be written. |
| `MOVE_COPY_SOUND_SPEC.md` | **Retired 2026-10-04** — shipped, user-tested, committed as `f7f316e`, spec deleted. Its 8 settled decisions, invariants and deferred list are preserved in `docs/session-history.md`; the design now lives in `src/App.jsx`. See Retired files. |

## ✅ Handover — profiles step 1 (opencode, COMMITTED as `577505d`, 2026-10-12 00:00)

**This section is now a RECORD of finished work, not a to-do list.** Everything described here shipped, is
committed, and passed all seven gates. It is kept because it records the traps, not just the outcome.

### 📍 Verified line map — `src/App.jsx` is **7033 lines** (was 6769 before profiles)

Every reference below was re-checked on 2026-10-12. ⚠️ **Line numbers elsewhere in this file and in
`PROFILE_SYNC_SPEC.md` are pre-profiles and have drifted** — the spec says so explicitly ("treat every
`App.jsx:NNNN` as roughly right, verify before you rely on it"), and that is now true of this file too. The map
below is the one to trust.

| What | Line |
|---|---|
| `DATA_VERSION` | 281 |
| `normalizeStoredData` | 289 |
| `readStoredData` (takes a profile id) | 348 |
| `mergeShippedDefaults` | 363 |
| `function AppBoard` (the board; everything below is inside it) | 782 |
| profile handlers — `handleSwitchProfile` / `handleDeleteProfile` | 826 / 862 |
| the three auto-save effects (`ttrpg_characters`/`environment`/`groups`) | 4081 / 4091 / 4101 |
| section icons | 1263 / 1267 |
| `allSoundContainers` | 2219 |
| `isFileReferencedElsewhere` | 2387 |
| `getTauriStoragePath` / `ensureUploadDir` | 2740 / 2743 |
| `storeFileInLocalStorage` / `getFileFromLocalStorage` | 2760 / 2803 |
| `openSettingsModal` / `restoreDefaults` | 3101 / 3111 |
| `removeFileFromLocalStorage` | 3676 |
| `isSoundPlaying` | 3878 |
| Profiles UI section in Settings | 6809 |
| `function App` (owns the remount key) | 7023 |

### What shipped

### 🔴 The harness does NOT protect the Tauri `uploads/` directory — and profiles turned that into data loss

**The user's installed v0.1.3 app lost its sounds. The migration is NOT at fault — it worked exactly as designed
and provably preserved all 112 files.** What happened is worse, and it is a harness defect:

- The installed app (`C:\Users\emire\AppData\Local\The SpellCaster\app.exe`, v0.1.3, built 2026-08-17) and the
  dev/test build **share one AppData directory**. Tauri resolves AppData to `%APPDATA%\<identifier>` and **both
  use `com.mrhorakhty.thespellcaster`** (`tauri.conf.json`), so there is exactly one
  `%APPDATA%\com.mrhorakhty.thespellcaster` on this machine.
- `e2e-full.ps1 -Phase win` launches `tauri dev` against **that real directory**. The uploads migration moved the
  installed app's 112 files into `uploads/p_09b2806c/` — every one now has `LastWriteTime` 2026-10-11 22:15:31,
  which is exactly when the Windows gate started. The **old app still looks in flat `uploads/`**, so it finds
  nothing.
- **Nothing was deleted.** The files are intact in `uploads/p_09b2806c/`.

⚠️ **The real defect: `e2e/e2e-snapshot.mjs` snapshots `localStorage` ONLY.** It never protected the Tauri
`uploads/` folder, so every Windows/Android run has been writing into the user's real audio directory all along.
This file's claim that *"test data never clobbers real characters/sounds"* was true for `localStorage` and **was
never true for uploads**. Before profiles the damage was untidy (test uploads accumulating beside real ones); the
migration made it destructive, because it *moves* files rather than adding them.

**This was the agent's error**: the Windows gate was run against the user's live install without first checking
what the harness actually protects.
💡 **Lesson: a snapshot/restore guarantee is only as good as the state it covers — "the tests never clobber my
data" must be verified per storage mechanism, never assumed from one.**

**Fix — IMPLEMENTED AND PROVEN (23:09–23:14).** `e2e/e2e-snapshot.mjs` gained `save-uploads` / `restore-uploads`
modes, and `e2e/e2e-full.ps1` now snapshots `uploads/` **before `tauri dev` launches** and restores it **after the
app is killed**. Design points that matter:
- The uploads dir is a **plain filesystem** copy — **no CDP** — so it can be restored when the app is already dead,
  which is exactly when a crashed run needs it.
- The AppData path is **derived from `tauri.conf.json`'s `identifier`**, not hard-coded, so an identifier change
  cannot silently point the snapshot at the wrong folder.
- **Ordering is the whole point**: snapshot *before* launch (a post-launch snapshot could already be the
  post-migration state, i.e. a "restore" that restores the damage) and restore *after* the kill (restoring under a
  running app would be undone).
- **Refuses rather than destroys**: a missing or empty snapshot exits 4 and leaves the live files untouched.
  Restore moves the live folder aside first and puts it back if the copy fails.
- ⚠️ **If the snapshot itself fails, the phase ABORTS** — a run that can *move* the user's audio must not proceed on
  the assumption it can be undone.

**Verified three ways:** (1) a missing snapshot and an empty snapshot each refused with all 114 files untouched;
(2) simulated damage (added a junk file, renamed a real one away) restored back to exactly 114 with the junk gone
and the original name back, no stray `__restore_backup`; (3) a **real Windows gate** — snapshot 114 → suite
**222 PASS / 0 FAIL / 1 WARN** → uploads restored to 114, flat=0, spot-check intact, no stray directory.

💡 **Android does not need this.** `e2e-android.ps1` drives an emulator, whose app data lives inside the AVD
(`/data/data/…`), not in the user's `%APPDATA%`. The user's real audio is only ever at risk from the **Windows**
phase, which is why the guard is wired there only.

### ✅ The Tauri uploads blocker is FIXED (22:14) — was the reason step 1 was not shippable

**The problem.** `getTauriStoragePath` gained the `uploads/<profileId>/` segment, but the bytes on disk were still
at `uploads/<file>`. A user with existing uploads kept their board — the `storedName` references survived — while
every file became unreachable. **The web gate could not catch this**: web audio lives in `localStorage` and *was*
migrated correctly, so web being green proved nothing about Tauri.

**The user's requirement, confirmed explicitly:** a previous version with real sounds **must** be able to migrate
them forward. Their live install has **112 files / 17.4 MB**, all flat, in
`%APPDATA%\com.mrhorakhty.thespellcaster\uploads`.

**The fix — `migrateUploadsToProfile(profileId)` in `src/profileStorage.js`:**
- Enumerates `uploads/`, moves every **file** into `uploads/<profileId>/`. `planUploadMigration()` is extracted as
  a **pure function** because the path arithmetic and the directory-skip are what can go wrong invisibly —
  renaming a directory would nest a whole subtree inside the profile folder.
- **Idempotent by structure, not by flag.** The test is "are there any *files* flat in `uploads/`?" — once moved,
  only per-profile directories remain, so a re-run finds nothing. No marker key to get out of step with reality,
  and a crash mid-move is resumable because the leftovers are still flat.
- Per-file isolation: one unreadable file does not abandon the other 111. Counts `{moved, skipped, failed}`.
- **Never clobbers**: a destination that already exists is `skipped`, not overwritten — that is what makes a
  partial re-run safe.
- Memoised per profile and **awaited by all three Tauri file paths** (`getFileFromLocalStorage`,
  `storeFileInLocalStorage`, `removeFileFromLocalStorage`), so a click during the migration waits rather than
  failing to find the file.

**Decisions the user made, and why they matter:**
- **`fs:allow-rename` added** to `capabilities/default.json`. Verified from the resolved crate that `rename` is
  **not** in `fs:default` — only in `write-all`/`write-files`, which we do not grant — and confirmed
  `allow-rename` exists in the `fs` namespace in `gen/schemas/acl-manifests.json`. `cargo check --offline` is
  clean and the generated `capabilities.json` now contains it.
- **Deleting a profile asks first, with a file count** (`profileUploadFileCount`). ⚠️ It is a **count, not a byte
  total**, because `stat` is not in the granted permission set and there is no directory listing with sizes —
  a size figure would have cost another capability for little gain.

⚠️ **`fs:allow-remove-dir` does NOT exist** in this plugin version (verified: 0 occurrences in the acl manifest,
and no `remove-dir.toml` in `permissions/`). So `removeProfileUploads()` deletes **files individually** and
leaves the now-empty per-profile directory in place, rather than adding a capability just to remove an empty dir.

✅ **PROVEN ON REAL DATA — the Windows gate moved the user's actual uploads.** After `e2e-full.ps1 -Phase win`:
`%APPDATA%\com.mrhorakhty.thespellcaster\uploads` went from **112 flat files / 17.42 MB** to **0 flat files**, with
the content now in `uploads/p_09b2806c/` at **114 files / 18.03 MB** — the 112 originals plus the 2 the suite
uploaded (`sound_*_e2e_silence.wav`, an icon). Spot-checked by name: `icon_2rxi4ls9_Tentacular_Limbs.png` (108 KB)
and `icon_57nb9nm7_Warding_Sign.png` (160.4 KB) are present and unchanged; 99 `sound_*` files carried over. Two
**empty** profile directories (`p_0d866f71`, `p_5383a814`) are the profiles Suite F created and deleted — left
behind precisely because `fs:allow-remove-dir` does not exist, which is the designed behaviour.
💡 **This is the check the web gate could never have given.** The migration log line
(`[profiles] uploads -> …`) comes from the *app's* console, which the suite does not capture — so the filesystem
is the evidence, not the log.

### What the E2E migration cost, and the two bugs the guard caught

Moving every key to `profile:<id>:<key>` meant **161 harness sites** were writing keys the app no longer reads.
The suites still talk in bare names; `e2e/lib/page.mjs` exports `PROFILE_HELPER` defining `window.__pk`,
`__pseed`, `__bareKeys`, `__keysFor`, which map bare → scoped **in the page** (the profile id is random per
install, so the harness cannot know it in Node).

⚠️ **The failure mode here is silent and it is worth remembering: a seed that misses the prefix writes a key
nothing reads, the board comes up empty, and the suite still reports PASS.** Four ways to hit it, all now
guarded by `e2e/check-profile-keys.mjs`:
1. a bare `localStorage.setItem('ttrpg_characters', …)` literal;
2. a bare **literal** `sound_file_foo.mp3` (refcount.mjs had two — this is what broke **G5**);
3. a **variable** key — `__soundsIn(key)` read a bare key and silently returned nothing, which broke **M7/M8**;
4. a raw `cdp('Page.reload')` — a page load wipes the helpers, so the *next* seed hits (1). All 16 are now routed
   through `reloadPage()`, which re-injects `PAGE_HELPERS`.

💡 `window.__pid()` is **self-healing**: if no profile exists it creates one (`p_e2e`) rather than returning
nothing. A suite may seed before the app has booted, and the original ordering bug (SEED ran *before* helpers
were injected) is what produced 40+ failures that looked like an app bug.

⚠️ **The one-shot migration scripts were deleted on purpose.** `migrate-profile-keys.mjs`,
`migrate-profile-enum.mjs` and `migrate-reloads.mjs` had been run once; re-running one of them **rewrote
`reloadPage`'s own body into a self-call** and the suite died with `RangeError: Maximum call stack size
exceeded`. `check-profile-keys.mjs` is read-only and replaces them. **Do not resurrect the writers.**

### Verified this session
- `node e2e/profileStorage.check.mjs` → **22/22**.
- `node e2e/check-profile-keys.mjs` → OK (and verified it FAILS on a deliberately re-broken file, so it is not
  decoration).
- `node e2e/check-coverage.mjs` → OK, 39 suites / 331 tests / 11 shared specs.
- **Web E2E → 223 PASS / 0 FAIL / 0 WARN, exit 0** (`e2e-run-20261011-215918.log`). Was 210 before Suite F, so
  **+13** are F1–F12. The headline ones pass: **F7 "A → B → A returns to A with A byte-identical"**,
  **F6a "editing B leaves A byte-identical"**, **F8** (B unchanged by the round trip), **F10** (`DATA_VERSION`
  skew migrates rather than resetting).

### Ordering constraint if you edit the suites
Suite F **clears storage** and creates/deletes profiles, so it runs **before** `refcount` (G) and `reset` (O) —
both of which re-seed for themselves. O must stay last of all.

## Open items
- 🔴 **URGENT (2026-10-12 16:56) — the user's real board is missing from `localStorage`, and the Windows E2E
  phase is what displaces it. Do NOT run `-Phase win` again until the harness stops writing to the real store.**
  - **What the user sees**: the app opens on a profile called "My Board" containing one character, "Human Paladin",
    whose only sound is **"Playback Probe"**, and an empty Environments tab. That is **E2E fixture content, not
    their board and not the shipped defaults** — `playback.mjs`'s fixture. The user confirmed this on 2026-10-12.
  - **The user's real profile `p_09b2806c` is not in the `spellcaster_profiles` index.** Their board used to be
    reachable; it is not now.
  - ⚠️ **Correction to an earlier statement in this session: the board is NOT recoverable from the snapshots.** I
    first read `ls-backup-20261011-221530.json`, saw `"Renamed Paladin"` / `"My Hero"` / `"My Custom Spell"` and
    called it the user's board. **It is not.** Those are fixture ids — `s_6`, `mine_1`, `mine_2`, `zz_custom` from
    `reset.mjs` — with `type:"Test"` and every file pointing at `Longbow_4.mp3`, the test asset. Every one of the
    **36** `ls-backup-*.json` files was then checked: they contain empty state, shipped defaults
    (`char_1`/`s_1` Elf Sorcerer), or E2E fixtures. **No snapshot holds the user's board.**
  - **What *is* intact, measured** — `uploads/p_09b2806c/`, 114 files / 18.03 MB, and the split matters:
    | | files | size | what it is |
    |---|---|---|---|
    | real audio | **53** | **2.37 MB** | **11 distinct sounds**: Daze, Fear, Force Barrage, Phantom Pain, Phase Bolt, Shield Magic, Telekinesis, Telekinetic Projectile, Tentacular Limbs, Ventriloquism, Warding Sign |
    | icons | 15 | 1.62 MB | Tentacular Limbs, Warding Sign, Ventriloquism, Daze x3, Fear x2, Force Barrage x2, Phase Bolt, Shield Magic, Telekinesis, Telekinetic Projectile |
    | `sound_*_e2e_silence.wav` | **46** | **14.04 MB** | **E2E test fixtures** — 312.5 KB each |
    💡 **So this file's older figure — "112 files / 17.4 MB of real uploads" — is wrong.** ~78% of that bulk is
    suite fixtures that accumulated in the user's real uploads directory across many runs. The 2026-10-11
    incident was therefore smaller than recorded, and the recovery is bounded by **11 sounds, not 112 files**.
  - **Recoverable in principle, not automatically**: the original filename is embedded in `storedName`
    (`sound_<rand>_<safeName>`), so the audio and its names can be re-linked mechanically. **What is lost is the
    board structure** — which character/category each sound sat in, and its type/colour/loop/fade settings. That
    exists nowhere in any snapshot. A rebuild is a *guess* at grouping, not a restore.
  - **Why the harness did this** (mechanism, partially established): the Windows phase writes into the user's real
    WebView2 `localStorage`, and the end-of-run restore is **not faithful** — it writes the saved keys back but the
    suite-created profiles outlive it and one ends up `activeProfileId`. Evidence: `p_09b2806c` is present in the
    22:15:30 pre-run snapshot and absent from the 22:26:22 one, with the real content surviving *under a different
    profile id*. The `uploads/` snapshot added 2026-10-12 23:09 works (verified 114 → 114 again today) — **`localStorage`
    was never given the equivalent protection.**
- ✅ **RESOLVED 2026-10-12 17:03 — the harness no longer writes the user's board away**, and both items below
  were then answered by the user. Fixed and independently verified; see Verification gates for the three changes
  and the disk-level proof. **`-Phase win` is safe to run again.** What is *not* resolved is the board itself.
- ✅ **No data recovery wanted (user, 2026-10-12)** — they have the source files and will re-upload. So the 53 real
  files / 11 sounds and 15 icons in `uploads/p_09b2806c/` were **left untouched**; nothing was deleted or rewritten.
- ✅ **The user's explicit concern — "none of the test sounds were uploaded to git" — CHECKED AND CLEAN.**
  `git ls-files` matched exactly one test-sound name, `e2e/e2e_silence.wav`, and that is the harness's **own
  fixture source** (referenced by both entrypoints, committed in `79acc3e`) — a single 313 KB file. The **46**
  `sound_*_e2e_silence.wav` copies exist **only** in `%APPDATA%\…\uploads\p_09b2806c\`, never in the repo. No
  runtime upload (`sound_<rand>_<name>` / `icon_<rand>_<name>`) is tracked; the only large tracked files are
  `public/assets` (the 71 shipped sounds, deliberately tracked in `ba57282`), `src-tauri/icons`, and the
  `gen/android` launcher icon. 💡 The new snapshot directory is deliberately **outside the repo** for the same
  reason — an 18 MB uploads copy per run must never be committable.
- 🔴 **Still true, and worth re-reading before the next Windows run: the user's board is gone from `localStorage`
  and only test-fixture content remains.** The app opens on `p_0d866f71` "My Board" holding one character
  "Human Paladin" whose only sound is "Playback Probe" — `playback.mjs`'s fixture. Their real profile `p_09b2806c`
  is not in the index. The **files** are safe in `uploads/p_09b2806c/`; the **board structure** is not recoverable
  from any of the 36 `ls-backup-*.json` files (all hold empty state, shipped defaults, or fixtures). Accepted by
  the user — but a restore from a snapshot will **not** bring the board back, and a future reader should not
  assume otherwise.
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
- 🔜 **`PROFILE_SYNC_SPEC.md` steps 3–6 is the next task, and the user is starting it fresh (2026-10-12).**
  Step 1 of 8 shipped as `577505d`, all seven gates green, hand-tested. **Nothing of steps 3–7 exists yet** — no
  provenance classifier, no bundle format, no import, no export, no UI, and **no zip dependency is installed**.
  Starting points, so the next session does not re-derive them:
  - **Storage is already profile-scoped** (`src/profileStorage.js`, `profile:<id>:<key>`, uploads at
    `uploads/<profileId>/`), so export/import is a read-and-write over an existing adapter rather than a refactor.
    The profile switch is a **full remount** and a `DATA_VERSION` mismatch **migrates** (§0.3 decisions 2 and 3).
  - **The destination-picker write is already spiked and passing** on both platforms: desktop needs the ~5-line
    `app.fs_scope().allow_file(path)` runtime grant (**no** blanket scope), and Android takes a `content://` URI
    that `plugin-fs` resolves. Pass **`Uint8Array`, never `Array`** — desktop IPC stringifies an `Array` body.
  - **Provenance is structural, not a flag**: a reference with no `storedName` is a bundled asset.
    `localStorageMigrationCompleted` and the `spellcaster_profiles` index must **stay global**.
  - ⚠️ **Register the feature as `planned` in `e2e/coverage.manifest.json` when you *start*, not when you finish**
    — flipping it to `shipped` is what forces the tests to exist.
  - ⚠️ **Facts re-verified and WRONG in older notes:** `localStorage` call sites are still **27**, but the
    `uploads/` count is **4 chokepoints, not 10** — `getTauriStoragePath` (App.jsx:2740) is the
    single path builder with 3 callers, and `getFileFromLocalStorage` bypasses it via `appDataDir`/`join`. Prefix
    *enumeration* is real. `localStorageMigrationCompleted` **must stay global** (prefixing it would re-run the
  one-time web→Tauri audio sweep) — as must the `spellcaster_profiles` index. Provenance is **structural, not a
  flag**: a reference with no `storedName` is a bundled asset. "Reset to starter sounds" shipped as `restoreDefaults`
  (App.jsx:3111) and now needs profile-scoping. Two risks remain on the board: cross-profile shared blobs (never
  hardlink between profiles) and the object-URL cache on switch (App.jsx `objectUrlCache`). 💡 **The design also
  changed in three places during step 1**: timestamps were **cut**, the switch became a **full remount** rather
  than an in-place reload, and a `DATA_VERSION` mismatch now **migrates** instead of resetting.
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
