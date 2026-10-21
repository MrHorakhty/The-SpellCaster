# Project State

🔒 CURRENT HOLDER: opencode — claimed 2026-10-21 02:05 — working on: the hand-test found four gaps in a row (the mock's timeline, the unreadable percentage box, the loop's fade-out, environment sounds having no fade controls) and then the export refusal caused by removing audio. All are fixed and green; **waiting on the user's re-test, and on their recovery of the two sounds whose audio is already gone from disk.**

✅ **`FADE_SPEC.md` IS SHIPPED (2026-10-21) — per-file fades, Play Until and seam fades, green on all three platforms.**
- `src/fadeMath.js` (NEW, pure model: `normalizeFadeSeconds`, `fadeStep`, `audibleEnd`, `fadeWarning`,
  `formatLength`, `fullVolumeSentence`, `seamSentence`) + `e2e/fadeMath.check.mjs` (**43/43**, gate 5's fifth check).
- `e2e/specs/fade.mjs` (NEW, shared Suite FADE — FADE1, FADE2, FADE3a, FADE3b, FADE4–FADE10) runs after `playback` in
  both entrypoints; `coverage.manifest.json` registers the suite and flips feature **Per-file fades** to `shipped`.
- `App.jsx`: `files[]` entries own `fadeIn`/`fadeOut`/`playUntil`; `migrateSoundFades` copies a legacy sound-level
  fade onto **every** file entry (behaviour-preserving); sound-level `duration`/`fadeIn`/`fadeOut` are gone from the
  schema and the UI. The modal row has a timeline scrubber that doubles as the Play Until control, a range + number
  box per field clamped to the measured file length, one red state (`fadeIn + fadeOut >= audibleEnd`), and a
  "Measuring this file..." state that only becomes the unmeasurable warning on a real `error` event (§9).
- `App.jsx` loop seam: the rewind is now a **50 ms watchdog**, not `timeupdate`. `timeupdate` fires ~4x/s, so a 0.58 s
  loop reached its natural `ended` first; resuming from `ended` needs a `play()` that can be refused, and a refused
  resume left the element **paused** while the fade-in ramped to target - Z9 read a flat `0.2` once for exactly that
  reason. The watchdog rewinds inside continuous playback, so the seam and its per-seam fade-in are deterministic.
  `firstLoopPlay` is **removed**; `Z9` was rewritten in the same commit to assert the per-seam contract.
- 🔴 **The timeline is the MOCK's timeline now.** The first build shipped a plain scrubber; the hand-test showed the
  bar did not draw the fades. It is now one 34 px bar carrying the fade-in ramp, the full-volume plateau, the
  fade-out ramp, the hatched never-played tail and the stop marker, with the caption `0s | never - whole file plays
  | 2m 32s`, and the three controls as label | slider | number rows. FADE9 pins the segments. The mock is still at
  `%TEMP%\opencode\fade-mock.html`.
- 🔴 **A number box must carry no `min`, `max` or `step`.** They are HTML5 validation attributes: a value the slider
  cannot represent (`0.5` on a file whose step is `1`) is a **step mismatch**, and the browser then **silently
  refuses to submit the form** - the sound never saves, the modal never closes, and every suite after it runs
  against stacked modals. It cost a whole E2E run (42 failures that had nothing to do with fades). FADE10 pins it.
- 🔴 **The loop's fade-out now really ramps into the seam** (§7.2): `fadeOut` measures back from the loop point and
  re-arms every cycle, `fadeIn` ramps back up after the rewind. The first build forced the volume to 0 and ignored
  the fade-out, which made §7.4's "add a fade-out to soften the seam" advice the code did not honour. The seam
  sentence now has **two** directions (a fade-in without a fade-out, and a fade-out without a fade-in). Z22 pins the
  ramp; FADE8 pins both sentences.
- The percentage number boxes lost the browser's spin buttons (`.no-spin` in `index.css`): the spinner ate the
  width of the 3-character box and the digits spilled past the modal's edge, unreadable.
- 🔴 **ENVIRONMENT (and group) sounds now get the same per-file row.** The user found that only CHARACTER sounds
  had fade and Play Until controls. The cause was not the fades: every shipped environment sound is stored in the
  **legacy single-`file` shape**, and the modal's rows come from `files[]`, so those sounds opened with no file
  rows at all - and no file rows means no per-file controls. `openEditSoundModal` now synthesises the entry the
  legacy shape implies (`legacyFileEntry`, no `storedName`), and the legacy `file` field survives the save.
- 🔴 **The PROVENANCE rule is fixed: `storedName` is COPIED, never derived.** The normaliser used to copy `name`
  into `storedName`, and `storedName` means "this is an UPLOAD" - so **editing any sound with bundled files turned
  those bundled assets into fake uploads**, and the profile bundle export then tried to carry them, could not find
  them, and **refused to export**. A board that had been edited could no longer be backed up. The normalisers moved
  to `src/soundFiles.js` so a node check can pin the rule: `e2e/soundFiles.check.mjs` (**20/20**, gate 5's sixth
  check). FADE10b pins the end-to-end case (an edited character sound stays bundled) and FADE11 pins the
  environment sound (gets a row, saves its fades, stays bundled).
- 🔴 **A legacy sound no longer grows a copy of itself on every save.** The synthesis above synthesised the legacy
  entry **even when the sound already had a `files[]` entry for the same file**, and the save kept the legacy
  `file` field *and* wrote a `files[]` entry - so the same file was described twice, the modal opened with a second
  row for it (one edited, one vanilla), and every save appended another row. Now: the legacy entry is synthesised
  **only when the sound has no `files[]` at all**; the modal keeps **one row per file** (the first wins, so a board
  already corrupted by the bug self-heals on the next save); and a save **retires the legacy `file` field** once a
  `files[]` list exists. FADE12 and FADE13 pin it. 💡 `M9` ("copy keeps legacy file field") was asserting the
  presence of an empty `file: ""` key - an artifact of the old save, not a contract - and now asserts that the copy
  MIRRORS the source.
- 🔴 **Removing audio no longer orphans a sound's file (the export error the user hit).** The bytes were released in
  two wrong ways. (a) The reference check excluded the whole **CONTAINER** of the sound being edited, so a **sibling
  copy in the same container** - what the copy feature produces - was invisible to it, and the bytes were deleted
  while the sibling still pointed at them. (b) The bytes were deleted the moment **Remove** was clicked, before
  anything was saved, so closing the modal without saving left the sound pointing at a file that no longer existed.
  Either way the sound went silent and the profile bundle **refused to export** ("those files not being present").
  Now the check excludes the edited **SOUND** (by id) so siblings count, and the bytes are released when the change
  is **committed** (Save), not when the row is removed. G6–G7b in `specs/refcount.mjs` pin it, using **real uploaded
  files** so the guard runs on all three platforms (under Tauri the audio is a physical file, and a seeded
  localStorage key proves nothing there).
- 🔴 **The E2E harness now waits for the page instead of sleeping a fixed time.** The Android phase produced **15
  failures** in the scroll and sliders suites ("0 cards on the page") on an app that was fine - every other suite in
  the same run passed. `reloadPage()` slept 3.5 s and then measured, and the Android WebView can take longer than
  that; a page that has not painted looks exactly like an empty board. `reloadPage()` now waits for the app to
  **mount** (`#root` has children), and the new `awaitBoard()` (`lib/page.mjs`) waits for the expected cards and
  re-seeds once if they never arrive. R0 and B0 report it when the board does not come up.
- Gate results, 2026-10-21/22: lint **0 errors / 3 baseline warnings** · build exit 0 · coverage **OK** (41 suites,
  391 tests) · gate 5 **46/46, 32/32, 20/20, OK, 46/46, 20/20** · **web 260/0/0 exit 0** ·
  **Windows 278/0/3 exit 1 (G5/G6b/G7b WARN)** · **Android 257/0/3 exit 1 (same WARNs)**. The exit 1s are the
  documented healthy baseline, not a regression.
- ⚠️ **The hand-test of the built app is still PENDING** — per-file fades are user-facing, so the feature is not
  "done" until the user has used it. **The first hand-test (2026-10-21) found three real gaps**, all now fixed and
  green: the timeline was a plain scrubber instead of the mock's segmented bar, the percentage box was unreadable,
  and the loop's fade-out had never been built. **The user has not re-tested yet.**
- ⚠️ `.gitattributes` (`*.bat text eol=crlf`) is **still untracked**; the user has not asked for it to be committed.

## 🔜 What is left, in recommended order

**This list is the single source of truth for "what's left".** Every row is unfinished work or a known gap, not
a bug report. Ordered by **unblocking value**, not by size:

| # | Item | Why here |
|---|---|---|
| 1 | ~~🆕 **`FADE_SPEC.md` — build it**~~ ✅ **BUILT AND GREEN 2026-10-21** — per-file fades, Play Until, seam fades; `specs/fade.mjs` (FADE1–FADE8) + `fadeMath.check.mjs`; web 247/0/0, Windows 267/0/1, Android 257/0/1 | It fixed the defect it was written for: `fadeOut` used to be scheduled off user-typed `duration`, which produced **four** silent no-ops that `Z15` now pins. **Only the user's hand-test of the built app is outstanding** — until that happens the feature is green in tests, not done. |
| 2 | 🆕 **`ICON_PREP_SPEC.md` — build it.** Written and registered `status: planned` 2026-10-18. **NOT authorised for implementation** | Two **opt-in** operations on sound-icon upload — **Make silhouette** and **Fit to square** (interactive crop) — so nobody needs Python installed. It fixes the measured weakness of `recolorImageToColor` (`App.jsx:536`), which **preserves alpha and can never create it**, so a backgrounded icon becomes a solid block of colour. 💡 **It is second because it is onboarding, not a defect** — unlike row 1. 🔴 **The Python script's algorithm is deliberately NOT reused**: measured on three of the user's own dark-background images it produces an **80% grey slab**. The spec uses an adaptive method chosen by measurement, and colour/photo art is **not** silhouetted at all |
| 3 | ~~**Promote the four node checks into the DoD gate table**~~ ✅ **DONE 2026-10-17** — `AGENTS.md` is now **eight** gates, with gate 5 named and its command given as one line | It had **already bitten twice**, and it **had**: this session listed it as open item #1 and then did not do it, which the user caught. Gate 5 is seconds, and it now carries the four counts. 💡 **Listing a debt is not paying it.** |
| 4 | ✅ **The playback gaps are CLOSED — 9 ids, `Z13`–`Z21`, built and green on all three platforms 2026-10-18** | `fadeOutAudio`'s ramp **and** its `onComplete` teardown (`Z13`/`Z14`), the fade scheduled off user-typed `duration` (`Z15`), `rescaleAudioTarget`'s fade branch + a level change mid-fade (`Z16`/`Z17`), and `randomPlay`'s behaviour with a negative control (`Z18`–`Z21`). Two inherited premises turned out **wrong**: the "every fixture finishes before a fade completes" blocker was never measured, and the claimed need for a two-blob Tauri seed helper was false — **two bundled assets give two `src`s with no upload at all**. See Verification gates. ⚠️ **The limitation `Z15` pins is now designed for, not merely recorded** — see `FADE_SPEC.md` §1 |
| 5 | **`HOTKEYS_SPEC.md`** — still `status: planned`, **NOT authorised for implementation** | Deliberately last. It depends on `PROFILE_SYNC_SPEC.md` §8, inherits the reference story rather than solving it twice, and a hotkey **must** fire the primed set through `playWithPrimes`. |
| 6 | **`PROFILE_SYNC_SPEC.md` §13 deferred, in its own dependency order: timestamps (§4.3) → Merge import (§8) → sync behind `ProfileTransport` (§2)** | Out of v1 by design. ⚠️ **Timestamps come first because Merge and sync are both unsafe without them.** Do not reorder this row. |

⚠️ **Adding to this list is expected. Letting it rot is not.** When a row is finished, delete it here and record
the outcome in `docs/session-history.md` — do not tick it in place, which is how the old header grew to 33 KB.

**Repo:** branch `mobile-support`, HEAD **`f6c3fe1`**, **0 ahead / 0 behind**. 🔴 **Working tree is NOT clean:**
**uncommitted** are `.gitattributes` (new, one line, added 2026-10-18 after the user authorised it — ⚠️ **the
protection does nothing for anyone until it is committed**, and the user has not asked for that yet),
`ICON_PREP_SPEC.md` (new), `PROJECT_STATE.md` (this file), `docs/session-history.md` and
`e2e/coverage.manifest.json`; plus the deliberately untracked `scripts/` (now 5 files, 1.7 MB).
✅ **Pruned 7 → 1 on 2026-10-18**, keeping **`…-20261018-131235`** (VERIFY OK
**236/236**, 40.3 MB) — the only backup, taken last so it matches the pushed HEAD. The audit was
`git ls-files` **∪** the working tree (286 entries) and returned **0 apparent orphans in all seven**; the keeper was
then proved good separately, not assumed: **all 236 files SHA256-identical to the committed tree**, `e2e/e2e-full.ps1`
present, `FADE_SPEC.md` present, **both `scripts/` files present**, old pre-rename Android names absent, **0
zero-byte**, no stray `__restore_backup`. 💡 **236 rather than 229 because `scripts/` arrived this session** — see
Repo state. 🗑️ Gone: `…-20261017-015650`, `…-20261018-103626`, `…-20261018-112859`, `…-20261018-123721`,
`…-20261018-124257`, `…-20261018-130808` (**~241 MB** freed, 281 MB → 40.3 MB). See Backups.
💡 **And the prune rule caught me re-creating a folder.** Recording the prune meant editing this file, which is
exactly the *docs-only touch-up* the rule says **not** to re-back-up for — so a second folder (`…-131350`) appeared
after the prune. Deleted it and kept the older keeper, because **one markdown edit behind is a perfectly good
rollback point and an unbounded folder count is not.** The state file in the working tree is therefore **one edit
ahead of the keeper**, and that is the intended end state rather than an oversight. 💡 **A prune that ends with a
backup is not a prune** — the whole point of taking the backup first is so the record can be written afterwards
without touching the count.

**Read this file first.** It holds only the *current* state. Dated session-by-session detail lives in
[`docs/session-history.md`](docs/session-history.md) — read that only when you need the reasoning behind a
past decision.

**Any AI agent may edit this file, but only while holding the claim** (see *Permanent instruction: keep
`PROJECT_STATE.md` up to date* in `AGENTS.md`). Claim it as your first action; release it when the work is
genuinely finished.

**The block that used to sit here** was a `Last updated:` dated session log, ~100 lines, and it closed with a
**"Next up: `PROFILE_SYNC_SPEC.md` steps 3–6"** that had shipped four days earlier. It was archived verbatim into
[`docs/session-history.md`](docs/session-history.md) on 2026-10-17. **The current "what is left" list is the table
at the top of this file.** 💡 A stale "Next up" is worse than no "Next up".

---

## What the project is
**"The SpellCaster"** — a TTRPG soundboard where the GM assigns **sounds to Characters** and
**Environment categories**. Users play, loop, stop and reorder sounds; **move or copy** a sound between any
containers (edit mode); edit characters/categories/sounds; apply themes and a box-size (zoom) slider. A
**Tauri 2.x** shell around a **React 19 + Vite + Tailwind** SPA, ported to Android. All mobile-specific changes
are gated behind `isMobile` so desktop/web stay untouched.

## Project facts
- **Frontend: React 19 + Vite, entry `src/main.jsx`, all logic in `src/App.jsx`** (was 6240 lines on 2026-10-06,
  ~6500 after per-sound volume, 6769 after priming, 7033 after profiles, **7300 now** after steps 3–6 — line
  numbers in the specs have drifted, the structure has not; see the verified line map in the profiles handover
  section, which is now pre-steps-3-6 and itself drifted).
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
- Data keys (all now behind a `profile:<id>:` prefix except the globals noted): `ttrpg_characters`,
  `ttrpg_environment` (**singular** — not `ttrpg_environments`; this has fooled harnesses before), `ttrpg_groups`,
  `ttrpg_data_version`, `ttrpg_characters_icon`, `ttrpg_environment_icon`, plus `backgroundSettings` and `boxSize`.
- 🆕 **Three keys are GLOBAL by design, not by oversight**: `spellcaster_profiles` (the index — it is how a
  profile is found), `localStorageMigrationCompleted` (a device-level one-time audio flag), and
  **`spellcaster_import_notice`** (2026-10-15 — the one-shot import summary, parked by `importBundle` because the
  remount destroys the modal that would report it, and read-and-removed on the next mount). The third is global
  for a sharper reason than consistency: **an import can CREATE the profile the notice is about**, so a scoped key
  would be unreadable by the very mount it exists for. ⚠️ All three must be listed in `KNOWN_KEYS`
  (`e2e/lib/page.mjs`) or the "no new key" assertions fail — and that list is a **single** list `P14a`, `P31a` and
  `Q9` all import, deliberately: two copies of it is how `spellcaster_import_backups` was missed on 2026-10-14.
- ⚠️ **`fs:allow-rename` is granted; `fs:allow-remove-dir` does NOT exist in plugin-fs 2.5.2.** Directory removal
  is therefore done file-by-file, and no directory listing carries file sizes (`stat` is not granted) — so the
  "delete this profile?" prompt shows a file **count**, not a byte total.
- `DATA_VERSION = '3'` (App.jsx:281) — **never bump it casually**: the mismatch path now **migrates** rather than
  resets (a deliberate change, `PROFILE_SYNC_SPEC.md` §0.3 decision 3), but a bump with no forward-repair would
  still affect every profile at once.
- Package `com.mrhorakhty.thespellcaster.debug`; `tauri.conf.json` uses `devUrl: http://localhost:5173`.
- **Do not hardcode the version** — `vite.config.js` `define`s `__APP_VERSION__` from `package.json`.
- 🆕 **The repo has a `.gitattributes`: one line, `*.bat text eol=crlf`** (added 2026-10-18, user-authorised). It
  makes CRLF `.bat` files a property of **the repo** instead of a property of one machine's `core.autocrlf`. ⚠️
  **Three facts that are easy to get wrong and were measured:**
  1. **Every `.bat` blob in git is bare LF** (`git ls-files --eol` → `i/lf`). CRLF has only ever existed in working
     trees. Before this file, a clone with `core.autocrlf=false`/`input`, or any Linux/macOS clone, received
     **bare-LF scripts containing `goto`** — the 2026-10-17 failure.
  2. **The attribute beats `core.autocrlf`.** Proven in-repo by deleting `Run Android.bat` and re-checking it out with
     `-c core.autocrlf=false`: `CRLF=0 bareLF=245` with the attribute aside, `CRLF=245 bareLF=0` with it in place.
  3. **It changed no blob and made nothing dirty** — all 8 blobs were already LF, so `git add --renormalize` is not
     needed. 💡 In a repo whose blobs were stale-CRLF the same line **would** leave files modified until renormalised,
     so **check the committed form before assuming a `.gitattributes` line is free.**
  ⚠️ **Do not cite "LF breaks `goto`" as a proven mechanism.** It did **not** reproduce in three minimal variants; the
  real-script failure is better explained by offset sensitivity. What the attribute fixes is the *class*.
  ⚠️ Only `*.bat` was given a rule — `* text=auto` was deliberately **not** added, to keep the effect narrow.

## Repo state
- ✅ **COMMITTED AND PUSHED as `81abd2e`** (2026-10-14 20:19), 25 files, +3373/−209 — steps 3–6 **and** step 8
  together, because today's changes interleave with 2026-10-13's in the same files and a split would have been
  cosmetic. New: `e2e/specs/bundle.mjs`, `e2e/profileBundle.check.mjs`, `src/profileBundle.js`,
  `src-tauri/src/scope.rs`. Modified: `src/App.jsx`, `src/profileStorage.js`, `eslint.config.js`,
  `package.json`/`package-lock.json`, `src-tauri/Cargo.toml`/`Cargo.lock` (the dialog plugin — a **real** change
  this time, not the EOL-only case the old note described), `src-tauri/src/{main,lib}.rs`,
  `src-tauri/capabilities/default.json`, `e2e/{e2e-full.mjs,e2e-mobile.mjs,e2e-snapshot.mjs,
  check-profile-keys.mjs,coverage.manifest.json}`, `e2e/lib/page.mjs`, `e2e/specs/playback.mjs`,
  `PROFILE_SYNC_SPEC.md`, `PROJECT_STATE.md`, `docs/session-history.md`, `README.md`.
- Branch **`mobile-support`**, ✅ **in sync with `origin/mobile-support`** as of HEAD **`81abd2e`** (0 ahead /
  0 behind, verified after the push). `git cat-file -e HEAD:e2e/e2e-full.ps1` passes — the AV-sensitive file
  survived the commit.
- ✅ **Committed and pushed 2026-10-13: `d63095c` (guard re-verified against a live fixture + the "deleted
  everywhere" correction) and `a75ce40` (the stale 114-file E2E snapshot deleted, inventory archived first)** —
  docs only, no app or harness code. `fd57d3a` is no longer HEAD; it remains the last commit that touched
  `package.json` (`fflate` + `@noble/hashes`, neither imported yet).
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
  ⚠️ **Those 114 files no longer exist** — the user deleted `uploads/p_09b2806c/` on 2026-10-13, the last on-disk
  copy of the 53 real audio files. The figures above are a **2026-10-12 measurement**, kept because they are what
  the git audit rested on; see Open items.
  ⚠️ **Two leftovers found and left alone** (both tiny, both pre-profiles, neither user data): `.tmp_uploads/`
  `test_sound.wav` (0 KB) and `test_icon.png` (0.1 KB), added 2026-08-17 in `ee4af98` *"Fixed uploads not
  registering in tauri app"*. 💡 **Lesson: `git ls-files` only proves what is in the tree *now*.** The question
  "was this ever committed" needs `git rev-list --objects --all`, or a removed file answers "no" for the wrong
  reason.
- ✅ **`scripts/` IS UNTRACKED, AND IT IS NOW MOSTLY GONE — deliberately, at the user's instruction.** 🔴 **The 51-file
  test corpus was DELETED on 2026-10-18** (`scripts/Test Images/`, ~50 MB) once its measurements were recorded, and
  so were the 5 preserved test images in `Masaüstü\output\preserved-test-images\`. **The user holds the originals
  elsewhere.** ⚠️ **Re-validation is no longer possible from this repo** — tuning `≥2%` (§15) needs the images back.
  **What survives is the point:** every figure lives in `ICON_PREP_SPEC.md` §6, and `Masaüstü\output\` holds the
  contact sheets, the per-image tables (`03`, `04`) and `generate_outputs.py`, which reruns against any folder.
  💡 **It was never committable anyway** — 51 files, ~50 MB, two near-identical 6.6 MB PNGs among them.
  | Still in `scripts/` | Why |
  |---|---|
  | `Image Pipeline/` (3 files, 3.8 KB) | **KEPT, provisionally.** The reference to port from, until `src/iconPrep.js` is validated. ⚠️ It can no longer be diffed against the corpus — only against the two examples |
  | `Light Background Example.jpeg`, `Dark Background Example.png` (1.7 MB) | **KEPT** — these are the in-app example assets (§7.4). 🔴 **Commit them downscaled to 256px (~16 KB), not as-is** |
  ⚠️ **Everything under `scripts/` is untracked, so git holds none of it and a backup is the only copy.** With the
  corpus gone a backup is ~40 MB again rather than 91.8 MB.
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
- ✅ **Branch `mobile-support`, in sync with `origin/mobile-support` at `25ac19a`** (pushed 2026-10-17 02:38,
  **0 ahead / 0 behind** verified by comparing `git rev-list --left-right --count origin/mobile-support...HEAD`).
  `25ac19a` is the whole 2026-10-17 body: the Settings copy changes, the Android banner safe-area fix + `I23`,
  the slider handle centring, the DoD's new **gate 5**, and the rename of the two Android scripts. The previous
  one, `085a2b5`, was the step 7 body: the agreed plan, the per-file import report, the one-shot notice, the
  `missingBlobsMessage` export fix, the version-stamp fix, `O11`–`O14`, `I18`–`I22`, and the 8 node assertions.
  ✅ **The tree is clean and everything is pushed** — the long-standing *"PROJECT_STATE.md is MODIFIED and
  UNCOMMITTED"* warning on this bullet is **resolved**, and is left struck through on purpose rather than deleted,
  because the recurring failure it describes was **real three times** and a reader should still see it.
  💡 **Check the subject for a BOM with `git cat-file commit HEAD`, not `git log`** — `git log | Out-File` adds a
  BOM of its own and fakes the problem.
- ⚠️ **`src-tauri/Cargo.toml` can show as modified while containing NO content change.** Its working copy has LF
  endings and the committed blob has CRLF, so `git diff` reports nothing and a normalised hash confirms the
  content is identical. **Do not "fix" it by sweeping it into a commit**; if you want a clean `git status`, change
  the EOL deliberately and say so in the commit message.
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
- 🔴 **Never edit a source file with PowerShell `Get-Content`/`Set-Content`.** On this machine `Get-Content`
  reads a UTF-8 file **without a BOM as Windows-1252**, and `Set-Content -Encoding UTF8` writes the mojibake back -
  so every em dash, ellipsis and curly quote in the file becomes `â€”`, `â€¦`. It happened to `src/App.jsx` on
  2026-10-21 and silently rewrote 657 characters. The repair is a round trip: read as UTF-8, encode with
  `[System.Text.Encoding]::GetEncoding(1252)`, decode as UTF-8, write **without** a BOM.
  💡 **Use the edit/write tools for source files.** For a surgical multi-file rewrite, use
  `[System.IO.File]::ReadAllText`/`WriteAllText` with an explicit encoding - and check the first bytes afterwards
  (`EF BB BF` is a BOM, `69 6D 70` is `imp`).
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
| `e2e/specs/` | **platform-shared specs** (2026-10-10/11, + bundle 2026-10-14, + step 7 2026-10-15/16), **all 12 run from *both* entrypoints**: `volume.mjs` P1–P16, `indicators.mjs` U1–U7, `sliders.mjs` B1–B4, `soundintogroup.mjs` H1–H2, `drag.mjs` X1–X2, `refcount.mjs` G1–G5, `platform.mjs` W1–W6, `scroll.mjs` R1–R10, `playback.mjs` Z1–Z12, `reset.mjs` **O1–O14**, `profiles.mjs` **F1–F12**, `bundle.mjs` **I0–I23**. 🔴 **`bundle.mjs` must never click `[data-profile-export]` or `[data-profile-import]`** — the native picker cannot be stubbed (every `__TAURI_INTERNALS__` member is immutable) and a `#32770` dialog wedges the run. It drives the app's `grant_path`/`writeFile`/`readFile` sequence directly, and only clicks the mode buttons and the confirm gate, which never reach the picker. ⚠️ **Four traps a spec that creates a profile will hit**, all learned on 2026-10-15: (1) **creating a profile already switches and remounts**, so the modal you were driving is gone — re-open it; (2) **the active profile's row renders no Switch button**, so select the row you are switching *away from*; (3) **rows must be selected by `data-profile-row={id}`**, never by name — more than one profile can be called "My Board"; (4) **`window.confirm` must be stubbed in the SAME expression as the click**, because `handleDeleteProfile` awaits a file count first and a real native confirm **blocks the page**. And **delete any profile the spec creates** (`O14`) — otherwise the next run reads it while it is still unstamped.

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
- 🆕 **`node e2e/profileBundle.check.mjs`** — **46 fast node-level assertions** over `src/profileBundle.js`
  (36 as of 2026-10-13, **+6 on 2026-10-15** for the per-file report and the parked notice), against a fake
  `localStorage` **and a fake blob store**. It covers the whole `.spellcaster`
  pipeline: provenance, all five container shapes, a full export → wipe → import → deep-compare round trip,
  dedupe-by-hash, both import modes, the snapshot/restore path, the atomicity ordering, and every refusal
  (corrupt payload, newer `formatVersion`, unreadable blob, failed blob write). ⚠️ **It is not a substitute for the
  shared browser spec** — it never opens a picker and never touches Tauri.
- 🆕 **`node e2e/profileStorage.check.mjs`** — 32 fast node-level assertions over `src/profileStorage.js` against a
  fake `localStorage`. No browser, so it is worth running for any future change to storage or the uploads plan.

## Verification gates
- ✅ **Gates 2026-10-18 13:55-14:25 (`ICON_PREP_SPEC.md` + retiring the Sound Normalizer) — gates 1, 4 run; 2, 3,
  5, 6–8 NOT run, named.** The diff is **one new markdown spec, one `coverage.manifest.json` feature entry, one
  deleted untracked folder, and this file.** No `src/`, no `e2e/`, no app code.
  | Gate | Result |
  |---|---|
  | `backup-project.ps1` | **VERIFY OK, 250/250** (66.3 MB — up from 40.3 MB because the user's test corpus arrived) **before the first edit**, and again at the end. Re-verified afterwards that it still holds the deleted `normalize_sounds.py` |
  | `npx eslint .` | ⚠️ **NOT RUN, and stated rather than implied.** No JavaScript changed. The 2026-10-18 10:36 baseline (**0 errors / 3 warnings**) still stands |
  | `npx vite build` | ⚠️ **NOT RUN.** No app code changed, so there is nothing new to build. Last real figure stands: **exit 0** |
  | `node e2e/check-coverage.mjs` | ✅ **exit 0 — 40 suites, 368 tests, 12 shared specs, 24/24 shipped features covered, 0 gaps. 3 planned** (was 2: the new `Icon preparation` entry is listed as *"planned, no coverage expected"*). ⚠️ **This gate is the one that mattered** — registering the feature as `planned` is what stops it shipping with no tests and the gate still green |
  | node checks (gate 5) | ⚠️ **NOT RUN.** None of the four read `coverage.manifest.json` or any changed file. Last real figures stand: **46/46 · 32/32 · 20/20 · OK** |
  | web / Windows / Android E2E | ⚠️ **NOT RUN.** A markdown spec cannot be observed by three phases that drive the built app over CDP. Last real figures stand: **238 / 258 / 248, 0 FAIL each** |
  | user hand-test | **N/A — nothing user-facing shipped.** The app is byte-identical. No feature was implemented |
- 🔴 **THE ALGORITHM WAS CHOSEN BY MEASUREMENT ON THE USER'S OWN IMAGES, AND THE SCRIPT'S OWN METHOD LOSES.**
  Coverage = **opaque pixel fraction of the finished 256x256 canvas** (including the 20px transparent margin).
  **The corpus grew from 11 files to 51 real icons** when the user supplied 40 more on 2026-10-18.
  | Input class | n | Script's method | **Chosen (adaptive)** |
  |---|---|---|---|
  | line art, **light** background | **40** | **9.8-31.9%** | **6.7-34.4%** — agrees within ~6 points |
  | light art, **dark** background | **11** | 🔴 **41.3-63.2%** | ✅ **4.7-30.7%** |
  | colour/photo render | 3 | 25.0-26.8% | **15.6-28.3%** — **not servable at all** |
  | desktop screenshot | 2 | 18.4-21.7% | **11.4-12.1%** — incoherent |
  ⚠️ **These five files were removed from the working tree and existed ONLY in backups.** They were **preserved to
  `Masaüstü\output\preserved-test-images\` before the prune**, with `06_unserved_inputs.png` showing input beside
  result. **They are the only remaining copies on this machine.** 🔴 **This section quoted them as 60-62% and 38-57%
  — the wrong basis, the same error corrected once already.** **Twice in one document is why the basis is now stated
  once at the top of §6 instead of left implicit per table. The verdict never changed; the figures did.**
  💡 **The chosen method costs nothing on the happy path and is decisive on the dark one** — on a light background the
  two are interchangeable, so no accuracy is traded for the polarity fix. The dark case is the user's own *"a couple
  with darker bg that I did not implement"*, now **n=11, not n=3**. Mechanism: the script hardcodes *"background is
  light"*, so a black background inverts to ~254 and **stays opaque**. The chosen method asks only *"does this pixel
  differ from the border colour"* and lets a histogram pick the split, so **there is no light/dark branch in it.**
- 🔴 **THE "80% SLAB" FIGURE I QUOTED WAS THE WRONG BASIS — AND THE CORRECTION MATTERS MORE THAN THE NUMBER.**
  The table above is measured on the **finished canvas**; the earlier one was measured on the **intermediate 512
  silhouette, before crop and letterbox**. Those differ by exactly `x (216/256)^2 = 0.711` for a square image.
  Reconciled directly on `_OLD_Murloc`: intermediate **82.1%**, finished **57.1%** — and the two code paths produce
  **byte-identical alpha**, so it was never a code difference, only me quoting one quantity as the other. Both bases
  are internally consistent. 💡 **A metric is only meaningful next to the stage it was taken at**, and 🔴 **a number
  that survives several sessions unchallenged is not evidence of correctness** — only of nobody re-running the thing
  that would have broken it. The *conclusion* held; the figure was mislabelled.
- ✅ **THE COMPONENT THRESHOLD IS NOW VALIDATED, NOT GUESSED.** Across **51 images**: **3334 connected components**
  found, `≥2%` keeps **552**; mean coverage **18.3% -> 19.5%**. A visual pass over **13** images spanning the range
  found **keep-largest wrong on 8, dramatically wrong on 4, and never better** — worst three:
  `_OLD_They Came From BEHIND` (99 comps: amorphous blob -> full emblem), `Soothe` (44: a blob -> hands cradling the
  swirl), `Light Background Example` (111: the shell -> the whole coral).
  💡 **The pattern is exact: keep-largest fails precisely when the artwork is multi-part**, and is identical when it is
  one connected mass — which is why it looked fine on the first examples tried and broke later, and why **the first
  examples chosen were the wrong ones to validate it on.**
  ⚠️ **Not proven: that 2% is optimal**, only that it beats largest-only decisively; `≥5%` and `≥10%` are
  near-identical across the corpus, so the real decision is **largest-only vs any threshold**. ⚠️ **Coverage cannot
  rank thresholds**, because keeping more components widens the bbox and scales everything down, making the metric
  **non-monotonic in the threshold** — only looking can rank them.
- 🔴 **TWO METHODS I BUILT FAILED, AND BOTH PRODUCED CONVINCING-LOOKING WRONG OUTPUT.** Recorded because each is easy
  to re-attempt by mistake.
  1. **Contiguous magic-wand flood, bug 1 — tolerance drift.** Comparing each candidate to *the pixel that reached it*
     lets tolerance accumulate along the path, so the fill random-walks across the whole image. Coverage collapsed to
     **0-5% on every input**. A correct magic wand compares against **one fixed seed colour**.
  2. **The same flood, fixed, bug 2 — and this one is a real design flaw, not a typo.** Taking the **median** of the
     border ring breaks when the artwork **touches the border**: `Spike_Growth_1`'s spikes reach the top edge, so the
     median becomes *navy*, the algorithm deletes the artwork and keeps the background. **Coverage went up and the
     result got worse** — 33.5% where the script managed 24.6% on a good input.
  💡 **Only the coverage number caught either bug.** Both thumbnails looked like plausible icons. **Measure the
  output; a thumbnail proves nothing.**
- 🔴 **A THIRD FAILURE, AND IT IS THE ONE THE METRIC MISSED — read this before implementing.** The component-cleanup
  step kept **only the largest blob**, to kill JPEG speckle. Run against the two images chosen as in-app examples it
  **destroyed one of them**: the coral has **111 connected components** (body, tentacles, wisps), so keeping one
  deleted **110 legitimate parts** and left a smudge.
  | example | components | keep-largest | keep **≥2% of largest** |
  |---|---|---|---|
  | `Light Background Example.jpeg` | **111** | 🔴 **16.0% — a single blob** | ✅ **12.6% — the whole creature** |
  | `Dark Background Example.png` | 5 | 25.3% | 25.8% (unchanged) |
  - 💡 **The coverage numbers are the lesson.** Keep-largest scored **16.0%**, comfortably inside the plausible 10-30%
    band, because the surviving blob was tiny and got **magnified** to fill the canvas. The *good* output scored a
    **lower 12.6%** while containing far more of the image. 🔴 **The metric rated the broken output as healthier than
    the good one, and only looking at it caught the bug.** **A coverage number can be satisfied by scaling a remnant.**
  - ⚠️ **The `≥2%` threshold is reasoned, not tuned**, and 🔴 **the §6 coverage table was measured with keep-largest, so
    it no longer describes the algorithm and must be re-measured.** Reporting it unchanged would be a stale number
    wearing a current label.
- ✅ **THE FLOW IS THREE CHOICES IN TWO STEPS, AND NOTHING IS BLOCKED.** Settled by the user 2026-10-18:
  **Use as-is / Crop to square / Make silhouette**; then **preview → confirm or cancel**; cancel discards.
  - 💡 **Use-as-is is not padding** — without it, uploading an unmodified colour icon becomes **impossible**, which
    would be a regression on what works today.
  - 💡 **The user's own reasoning for not defaulting**: icons are square and an upload will usually be fitted inside
    one, so *crop* is probably what most people want — **but defaulting to it would override the agency the flow
    exists to protect.**
  - 🔴 **My earlier draft made the opposite call on guard rails and was wrong.** It proposed *refusing to save* on bad
    coverage. Overruled, and rightly: **the disclaimer plus the preview is the safeguard, and the user keeps agency.**
    Someone may want to silhouette a screenshot on purpose. **No quality threshold blocks a save;** only *operational*
    failures (not decodable as an image, or processing threw) produce an error — and `accept` is only a hint with no
    validation today, so that case is reachable.
- ✅ **THE EXAMPLE IMAGES COST ~16 KB, NOT 1.7 MB.** Measured: `Light Background Example.jpeg` is **805 KB** as-is,
  **9.6 KB** at 256px JPEG q85; `Dark Background Example.png` is **900 KB**, **6.4 KB** at 256. 🔴 **Commit the
  downscaled versions** — shipping them raw is a 50x waste. 💡 I had earlier proposed using the already-committed
  shipped icons instead, on cost grounds; that was **wrong**, because they are the pipeline's **output** — they show
  what you *get*, not what you *upload*. The dark example is a **scrapped icon, never shipped**, kept deliberately as
  a demonstration asset.
- ✅ **THE SHIPPED ICONS ARE THE SCRIPT'S OUTPUT — so the repo contains ground truth for the target look.** Measured,
  not inferred: **17 of 19** files in `public/assets` have opaque colour exactly **`(106,106,106)`** (the script's
  `target_color`), all are **512x512 RGBA**, transparent corners, and a **20px** margin (= art constrained to
  `512-40`, then centred, exactly as the script does). `Hail_of_Thorns` is `(113,113,113)`, one near-miss.
  - Two uses: **regression ground truth** (the pipeline is near-idempotent on its own output, so a reimplementation
    can be fed the shipped icons and compared numerically), and **a worked example** of what "correct" means.
  - ⚠️ **`public/assets/Icon.png` is NOT pipeline output** (dark navy `(29,17,53)`, no padding) — it is the app icon.
    Any future bulk operation over `public/assets` must exclude it by name or it will be destroyed.
- 🔴 **THE TINT IS RENDER-TIME AND CANNOT CREATE ALPHA — which is the entire reason this feature exists.**
  `recolorImageToColor` (`App.jsx:536`) preserves each pixel's lightness and swaps hue/saturation, but it **keeps the
  existing alpha and never manufactures one** (`if (data[i + 3] === 0) continue`, `App.jsx:577`). It is applied in a
  `useEffect` at **`App.jsx:1616-1643`**, keyed `icon|color|brightness`, and **skipped entirely** when
  `sound.color === '#84cc16'` (`App.jsx:1622`) — the *untinted* sentinel. Three consequences, all verified:
  - A white-background icon arrives opaque, and every one of those pixels is lightness 1.0, so it becomes **a solid
    block of the target colour**. No amount of tinting fixes that.
  - **The stored icon's own colour is what an untinted sound displays**, which is why the silhouette output must be
    neutral grey.
  - ⚠️ **The tint covers only 2 of the 5 container shapes** — the effect collects `characters[].sounds` and
    `environmentSounds[].sounds` (`App.jsx:1619`) and **never walks groups**. A **pre-existing gap, out of scope for
    `ICON_PREP_SPEC.md`**, recorded so a future session does not assume group sounds are tinted.
- ⚠️ **SCOPE IS SMALLER THAN IT LOOKS, AND THAT IS A FINDING.** `handleIconUpload` has **exactly one call site**,
  `App.jsx:6348`, inside the sound modal. Characters, categories and groups use **emoji or Lucide names** via
  `renderIcon` (`App.jsx:115`), never uploaded images. So this is **not** a cross-container feature and it never
  touches the five-container-shape problem.
- ⚠️ **THE PIXEL-ACCESS WALL IS WHY BOTH OPERATIONS MUST BE UPLOAD-TIME.** A stored icon is a *filename reference*;
  its bytes live in `uploads/<profileId>/` or `localStorage`, and an `<img>` renders them but **cannot read their
  pixels back** (Tauri's `asset://` URLs taint the canvas). `recolorImageToColor` already works around it by
  fetching to a blob (`App.jsx:538-550`) — **reuse that verbatim.** But "fit to square" needs the image *in memory as
  pixels* to crop it, so it **cannot** be an edit action on an existing icon. Putting both at upload keeps the model
  simple and the workaround in one place.
- ✅ **Gates 2026-10-18 13:16–13:25 (`.gitattributes`: `*.bat text eol=crlf`) — gates 1–5 run, 6–8 NOT run, named.**
  Authorised by the user after being shown the measurements. The diff is **one new root file, one line**; no `src/`,
  no `e2e/`, and **not one existing `.bat` was touched**.
  | Gate | Result |
  |---|---|
  | `backup-project.ps1` | **VERIFY OK, 236/236** (40.3 MB) before the first edit, and again at the end |
  | `npx eslint .` | **0 errors / 3** pre-existing warnings (`convertFileSrc`, `_`, `ev`) — the accepted baseline |
  | `npx vite build` | **exit 0** (827 ms; the `INEFFECTIVE_DYNAMIC_IMPORT` notice is pre-existing) |
  | `node e2e/check-coverage.mjs` | **exit 0 — 40 suites, 368 tests**, 12 shared specs, **24/24 shipped features covered, 0 gaps** |
  | node checks (gate 5) | **`profileBundle.check` 46/46** · `profileStorage.check` **32/32** · `bundleGuard.check` **20/20** · `check-profile-keys` **OK** |
  | web / Windows / Android E2E | ⚠️ **NOT RUN, and the reason is that they cannot observe this change.** The three phases drive the built app through CDP; `.gitattributes` decides how `.bat` files are *materialised in a working tree*, and the decisive evidence is a checkout A/B (below), not an app assertion. **Named, not implied.** Last real figures stand: **238 / 258 / 248, 0 FAIL each** |
  | user hand-test | **N/A — nothing user-facing shipped.** No app behaviour changed. ⚠️ Worth knowing what this file *does* change for a user: on **every machine but this one**, the seven root `.bat` files are now guaranteed CRLF, so the 2026-10-17 `goto` failure cannot recur there |

- 🔴 **THE ATTRIBUTE IS PROVEN BY AN IN-REPO A/B, NOT BY THE ATTRIBUTE EXISTING.** Both arms ran here, by deleting
  `Run Android.bat` and re-checking it out with `core.autocrlf=false` forced — i.e. exactly what an LF machine does.
  | Working tree | Result |
  |---|---|
  | `.gitattributes` moved aside | 🔴 **`CRLF=0, bareLF=245`** — the 2026-10-17 failure condition, reproduced on demand |
  | `.gitattributes` in place | ✅ **`CRLF=245, bareLF=0`** |
  💡 **`eol=crlf` beats `core.autocrlf`, and that ordering is the whole point of the line.** A config setting is a
  property of one machine; an attribute is a property of the repo.
- ✅ **IT COST NOTHING IN THIS REPO, MEASURED BOTH WAYS.** Because all **8** `.bat` blobs are *already* LF
  (`git ls-files --eol` → `i/lf` for every one), there is no renormalisation to do:
  - `git hash-object --path <f> <f>` equals `git rev-parse HEAD:<f>` for **all 8** → **no blob would change**, so
    **`git add --renormalize` is not needed** and no `.bat` shows as modified.
  - In a scratch repo shaped like a *stale-CRLF-blob* repo the same attribute left the file **dirty** until
    `git add --renormalize` was run. 💡 **That is the case to check before assuming a `.gitattributes` line is free**
    — the cost depends on whether the committed form already matches. Measured, not assumed.
  ⚠️ **`git add --renormalize --dry-run .` is a useless probe here** — it lists *every* path in the repo, so it
  looks like "the whole tree needs renormalising". Use `git status` plus `hash-object`, which is what was used.
- ⚠️ **THE "LF BREAKS `goto`" STORY DID NOT REPRODUCE IN ISOLATION — the trigger is narrower than recorded.** Three
  variants, all bare LF, all **exit 0**: a plain `goto`; `call :sub` followed by `goto`; and `call :sub` inside a
  3-iteration loop with `Run Android.bat`'s own `netstat`/`for /f` pipeline copied in. So LF alone does **not** break
  a label jump, and the "N bare LF" count is a **risk indicator, not a cause**. The 2026-10-17 observation on the
  real file is real and the file was genuinely `245 bare LF / 0 CRLF`; its own recorded explanation — *the rename
  shifted byte offsets and cmd's label scan stopped resolving* — points at **offset sensitivity**, which none of the
  three variants provoked. 🔴 **What this does and does not change:** the item was still worth doing, because the
  attribute removes the **class** and the failure was observed on the real script. But **do not cite "LF breaks
  `goto`" as a proven mechanism** — it is a hypothesis that fits one observation. 💡 The general lesson: an A/B on
  the *real* file can be reproducible when the same A/B on a *minimal* file is not, and the difference is usually
  where the actual variable lives.
- ⚠️ **`.gitattributes` itself will warn on commit** (`LF will be replaced by CRLF`) because `core.autocrlf=true`
  with no rule for the file. That is **cosmetic** — git parses attributes line-wise and both endings work. Only
  `*.bat` was given a rule, deliberately: `* text=auto` was **not** added, to keep the effect narrow and reviewable.
- ✅ **Gates 2026-10-18 10:36–11:30 (the playback coverage gaps, `Z13`–`Z21`) — ALL EIGHT GREEN, every platform
  exactly +9.** The change is **test-only** (`e2e/specs/playback.mjs`, `e2e/coverage.manifest.json`); **no app
  code was touched**, so nothing was exempt — all three E2E phases ran.
  | Gate | Result |
  |---|---|
  | `backup-project.ps1` | **VERIFY OK, 229/229** (40.2 MB) before the first edit, and again at the end |
  | `npx eslint .` | **0 errors / 3** pre-existing warnings (`convertFileSrc`, `_`, `ev`) — the accepted baseline |
  | `npx vite build` | **exit 0** (1.34 s; the `INEFFECTIVE_DYNAMIC_IMPORT` notice is pre-existing) |
  | `node e2e/check-coverage.mjs` | **exit 0 — 40 suites, 368 tests** (was 359; **+9**), 12 shared specs, 24/24 shipped features, 0 gaps |
  | node checks (gate 5) | **`bundleGuard.check` 20/20** · `profileBundle.check` **46/46** · `profileStorage.check` **32/32** · `check-profile-keys` **OK** |
  | **web E2E** | **238 PASS / 0 FAIL / 0 WARN, exit 0** (`e2e-run-20261018-104335.log`) — **+9** on the 229 baseline |
  | **Windows E2E** | **258 PASS / 0 FAIL / 1 WARN, exit 1** (`e2e-run-20261018-105121.log`) — **+9** on the 249 baseline; WARN is G5. **`Restore verified FROM DISK`** again |
  | **Android E2E** | **248 PASS / 0 FAIL / 1 WARN, exit 1** (`e2e-android-20261018-111604.log`) — **+9** on the 239 baseline; WARN is G5. **Store restored cleanly** |
  | user hand-test | **N/A — not applicable.** Nothing user-facing shipped: the app is byte-identical. The DoD hand-test bar applies to user-facing *features*, so say that plainly rather than implying one happened. ⚠️ **What does need the user is a DECISION, not a test** — see `Z15` below |

- 🔴 **TWO INHERITED PREMISES WERE WRONG, AND BOTH CHEAPENED THE WORK RATHER THAN BLOCKING IT.** This is the
  third time in this project that a blocker turned out to be a story (the others: `reset.mjs`'s "wipes the fixture
  every later suite reads", and `Run Android.bat`'s "refuses when nothing serves the UI, which is honest").
  1. 🔴 **"Every fixture finishes before a fade completes" — never measured.** It was inherited from the
     per-sound-volume work, which picked a 0.6 s clip *because it registers reliably*. `ffprobe` on the shipped
     assets: **`Tavern_Music.mp3` 152.4 s**, `Forest_Ambience.mp3` 285.9 s, `Wind.mp3` 304.1 s. All three are
     referenced by `src/data.json`, so none is an orphan fixture that could be pruned later — **verified, not
     inherited**, since a fixture nothing ships is a liability.
  2. 🔴 **"A two-blob seed helper that works under Tauri is the only genuinely new code in this whole list" —
     false, and it cost the estimate its only hard part.** `normalizeStoredFileEntry` (`App.jsx:2940`) copies
     `name` into `storedName`, but with **no bytes under that key** the lookup misses and `playSound` falls back
     to `/assets/${displayName}` (`App.jsx:3991-3994`). So **two bundled assets give two distinct `src`s with no
     upload, no CDP file dialog and no per-platform helper** — and it is the *same* branch under test, because the
     random pick happens on the normalised file **list**, before any blob lookup.
  💡 **A cost estimate that names a hard part is worth re-deriving even when the rest of it is right.** The estimate
  was correct about the cheap 80% and wrong about the part that decided whether it was cheap at all.
- ⚠️ **`Z13`'s ramp is the proof the fixture is long enough, and it is exact.** web read
  `longestStrictDropRun=20` with samples `1 ×11, then 0.95, 0.90 … 0.05, 0`, and Android read `19` with the same
  ladder. **20 is `fadeOutAudio`'s hardcoded `steps = 20`**, so the descent is the function's own arithmetic and
  not an artefact of sampling. Android's 19 is a coarser sample cadence on a slower WebView, not a different ramp —
  every ladder value still lands.
- ✅ **`Z16`/`Z17` pin `rescaleAudioTarget`'s fade branch to the number.** `before=0.05 after=0.01 expected~0.0100`
  on all three platforms — the ramp **position** (5% of the old target) carried across to the new one, not a snap
  to 0.2. That is the whole point of the branch: the `else` would have read `0.2`. And `Z17` then confirms the ramp
  **lands** on the new target (`vol:0.2, base:0.2, cleared:true`), which is the `_fadeTargetVolume` retarget — the
  same staleness class of bug as the loop re-entry guard `Z9` exists for on the other path.
- ✅ **The `randomPlay` negative control is what makes `Z18` mean anything.** `Z18` saw **both** files across 12
  triggers; `Z19` ran the **same 12 triggers** with `randomPlay:false` and saw **exactly one** — and on every
  platform it was `Longbow_4.mp3`, i.e. `files[0]`. 💡 **The two runs also disagree about which file came first**
  (web/Android saw `Longbow_3` first, Windows saw `Longbow_4`), which independently rules out the harness
  observing an alternation or a default rather than a real random draw. 12 draws over 2 files gives
  P(all identical) = 2⁻¹¹ ≈ **0.05%**, and the control is deterministic, so **neither assertion can flake.**
- 🔴 **`Z15` PINS A REAL LIMITATION, IT DOES NOT FIX ONE — and it is the one thing here that needs the user.**
  The fade is scheduled off `sound.duration` (`App.jsx:4053`), which is **user-typed metadata**. A duration longer
  than the real file means the non-looping `ended` handler wins the race, `cleanupAudio` clears the timer
  (`App.jsx:4029`) and **the fade silently never happens**. Measured: `Longbow_4.mp3` (0.6 s) with
  `duration:5, fadeOut:2` → fade due at 3 s, file over at `ct=0.576`, `fadeOutInterval:false`. **The app has no way
  to know the real file length**, so this is a design question, not an oversight:
  - is `duration` meant to be *the file's length* (in which case a fade-out is redundant when it is right)?
  - or a *playback window* (in which case a fade-out past the end is arguably meaningless and should be silent)?
  💡 **It is also the negative half of `Z13`/`Z14`.** Without it those two could pass on a ramp that had nothing to
  do with `fadeOutAudio`; with it, `Z13`'s 20-step ladder and `Z15`'s `ct=0.576` together prove the ramp is the
  scheduled fade and not the natural end of a short clip.
- ⚠️ **A stale "it re-fades on every loop" claim is WITHDRAWN — the code already prevents it.** The 2026-10-17
  analysis said `App.jsx:4093`/`:4109` re-run `applyFadeIn` on **every** loop re-entry, "so a looping sound with
  `fadeIn > 0` pulses from silence on every single loop". **That is wrong:** a **`firstLoopPlay`** flag
  (`App.jsx:4077`) guards both call sites and flips to `false` on the first crossing (`:4089`, `:4105`), with the
  comment *"Fade-in is applied only on the initial play to avoid a volume dip at every loop boundary."* So the fade
  runs **once**, on the first boundary, not on every one. 💡 **What is actually true** is narrower and was left
  unpinned: on that **first** boundary the element drops from full volume to 0 and ramps back up, i.e. a
  **one-time** dip. `Z9` already asserts where that ramp lands. **No id was added for the wrong premise** — a test
  written against it would have encoded a bug that does not exist. If the first-boundary dip is worth changing, that
  is a **decision for the user**, not a coverage gap.
- 🔴 **The first Android attempt CRASHED (exit 3) and was NOT in my change — the recovery is the part to keep.**
  `e2e-android.ps1` died at **Suite J (EDIT SOUND)**, the **8th** of 20 suites, with
  `[MOB] FATAL: CDP socket error (unknown). Exit 3.` — the guard's *"the app most likely died"*. **`playback` is
  the 14th suite (`e2e-mobile.mjs:1505`), so `Z13`–`Z21` never executed**, and the module parsed fine or nothing
  before J would have run at all.
  - **Consequence 1, and it is the rule in `PROJECT_STATE.md`'s own history:** the dead app meant the store was
    **not restored**, so the run's fixture residue would have poisoned the *next* run — the exact 2026-10-15
    `O14` failure, one suite in a different file, a day later. Recovered per the script's own printed instructions:
    booted `Pixel_7`, launched the app, `adb forward tcp:9225`, `e2e-snapshot.mjs restore` → **`11 keys match the
    snapshot exactly`** and `page reloaded (marker gone)`. Then a clean re-run gave the green figure above.
  - **Consequence 2, which is the reassuring half:** ⚠️ **the user's data was never at risk.** The Android phase
    drives an AVD whose app data lives inside it; only the **Windows** phase writes to the real `%APPDATA%`. So an
    Android crash is an emulator problem, never a data-loss event — worth stating because the same message on the
    Windows phase would be the opposite.
  - 💡 **The runner's own recovery command was correct and complete.** Nothing had to be invented; follow what it
    prints. Also: I lost the first run by pointing my own stdout redirect at **the same path the runner computes for
    its own test log** (`e2e-full.ps1:24`, `%TEMP%\opencode\e2e-run-<ts>.log`) — every `Add-Content` failed with
    *"being used by another process"* and the phase exited with an empty summary. **Redirect to a different
    filename, not one shaped like the runner's.**
- 🔴 **A BARE-LF `.bat` BREAKS `goto`, AND IT ONLY SHOWED UP BECAUSE OF A RENAME. Proven by A/B.**
  The user renamed the two Android scripts on 2026-10-17; running `Run Android.bat` immediately after produced
  **`The system cannot find the batch label specified - waitport`** — for a label that is plainly present 6 lines
  above the jump. The cause was the **line endings**: the file was **245 bare LF / 0 CRLF**, and it was the
  **only** LF-only `.bat` in the repo (`Build Android.bat`, `kill-ports.bat`, `Run.bat`, `Build.bat`,
  `Run Tauri.bat` are all CRLF), because my earlier edits to it had been written with LF.
  | Same bytes, endings only | Result |
  |---|---|
  | **CRLF** | ✅ exit 0 — server started (pid 19068), app launched |
  | **bare LF** | 🔴 exit 1 — `cannot find batch label specified - waitport` |
  💡 **The rename is what exposed it, and that is the part worth keeping.** The rename shortened every
  cross-reference by 4–7 characters and so **shifted the file's byte offsets**; with LF endings cmd's label scan
  stopped resolving. The file had been working minutes earlier. 💡 **A latent encoding fault can sit under a
  passing test and surface on an unrelated change — which means the fix belongs to the whole class, not to the
  commit that happened to trip it.** ⚠️ **Check line endings on every `.bat` you touch, not just on the ones that
  misbehave**; a script that merely *runs* is not proof, because cmd carries on past a failed `goto`.
- ✅ **Gates 2026-10-17 02:10–02:30 (the user's rename of the two Android scripts) — gates 1–5 run, 6–8 NOT run,
  named.** The rename touched `.bat`, `.gitignore`, `AGENTS.md`, `README.md`, `PROJECT_STATE.md`;
  `docs/session-history.md` keeps the old names **on purpose**, being an archive.
  | Gate | Result |
|---|---|
| `backup-project.ps1` | **VERIFY OK, 229/229** |
| `npx eslint .` | **0 errors / 3** pre-existing warnings — the accepted baseline |
| `npx vite build` | **exit 0** |
| `node e2e/check-coverage.mjs` | **exit 0 — 40 suites, 359 tests, 24/24 shipped features, 0 gaps** (unchanged: no ids touched) |
| node checks (gate 5) | **`bundleGuard.check` 20/20** · `profileBundle.check` **46/46** · `profileStorage.check` **32/32** · `check-profile-keys` **OK** |
| web / Windows / Android E2E | ⚠️ **NOT RUN**, same exemption and same reason as the two entries below: no `src/` or `e2e/` file moved. **Named, not implied.** Last real figures: **229 / 249 / 239, 0 FAIL each** |
| user hand-test | 🔴 **NOT DONE for this rename, and it is the one thing I cannot substitute for.** `Run Android.bat`'s self-sufficient path and `Build Android.bat`'s port guard were both **executed and observed** (exit codes above), but **double-clicking them from Explorer is a different code path** — Explorer does not set `%~dp0` the same way a shell does, and that is precisely the sort of thing that only shows up outside a terminal. **Say so rather than implying it happened** |
| 🔴 **But the rename was caught by testing, not by shipping it.** A grep of the repo found **16 stale
  references** across 5 files, and both scripts' own user-facing messages named the *old* sibling. ⚠️ **Renaming
  a file is not renaming a thing** — and in this repo the cross-references lived in **four** places: the script
  bodies, `README.md`, `PROJECT_STATE.md` and `.gitignore`. The sweep deliberately **excluded** `Run App.bat`,
  a retired dead file of confusingly similar name, and the `npm run tauri android dev` script calls, which are
  a different thing entirely and must keep their name |

- ✅ **Gates 2026-10-17 01:45–02:05 (`Run Android.bat` made self-sufficient, user-decided) — gates 1–5 run,
  6–8 NOT run, named.** The diff is **one root `.bat`**; nothing under `src/` or `e2e/` moved.
  | Gate | Result |
|---|---|
| `backup-project.ps1` | **VERIFY OK, 229/229** at session start and again at the end |
| `npx eslint .` | **0 errors / 3** pre-existing warnings — the accepted baseline |
| `npx vite build` | **exit 0** (850 ms) |
| `node e2e/check-coverage.mjs` | **exit 0 — 40 suites, 359 tests, 24/24 shipped features, 0 gaps** (unchanged: no ids touched) |
| node checks (gate 5) | **`bundleGuard.check` 20/20** · `profileBundle.check` **46/46** · `profileStorage.check` **32/32** · `check-profile-keys` **OK** |
| web / Windows / Android E2E | ⚠️ **NOT RUN.** Same exemption as the entry below and for the same reason: the three phases drive the built app over CDP and cannot observe a Windows batch file, so they would measure nothing. **Named, not implied.** Last real figures: **229 / 249 / 239, 0 FAIL each** |
| user hand-test | ✅ **The decision is the hand-test here** — the user chose self-sufficiency explicitly. ⚠️ The *first* double-click on a real machine is still theirs to do; what is proven is that it works from this checkout |
- 🔴 **`Run Android.bat` IS NOW SELF-SUFFICIENT — and it was built by running it, not by reasoning about it.**
  The previous version refused when nothing served the UI, which was honest but left the script useless unless
  you had *already* started a dev server — which is the redundancy the user spotted: *"if that's the case just
  running the later would work too no?"* **It now starts one itself**, so double-clicking it works.
  | Path | Behaviour | Verified |
|---|---|---|
| nothing on 5173 | starts `node node_modules/vite/bin/vite.js` detached + hidden, waits for the port, launches | ✅ **exit 0, app rendered on the emulator** (screenshot) |
| something already on 5173 | reuses it, starts nothing | ✅ listeners stayed at 1 |
| `node_modules` absent | explains, points at `Build Android.bat` | ✅ exit 1 |
| Vite starts but never binds | **bounded** wait (~30 s), then explains | ✅ exit 1 at 34 s |
  💡 **Three of the four bugs in this script were found only by running it**, exactly as the `cmd` traps recorded
  on 2026-10-16 were: (1) a `|` inside `for /f` backticks needs `^|`, and **the caret then reaches PowerShell as a
  literal argument** — `Start-Process : A positional parameter cannot be found that accepts argument '^'`. The
  fix is `@(Start-Process …).Id` with no pipe, the form `Build Android.bat` already used. (2) A `goto haveServer`
  whose label I had deleted — cmd **prints the error and carries on**, so the script silently ran the wrong path.
  (3) Two `echo.` lines written as `echo]`, printing **`ECHO is off.`** into the middle of user-facing text.
  💡 **A missing batch label is not a stop, it is a suggestion.**
- ✅ **Why "detached + hidden" rather than `start /b`.** `Start-Process -WindowStyle Hidden` gives Vite its own
  console, so closing the launcher window does not take the server down — which is the whole difference between
  the app working after you dismiss the script and stopping the instant you do. The script prints the PID and the
  exact `taskkill /PID … /T /F` to stop it, and says so **only when it started one**: when it reused an existing
  server it prints "it is using the dev server that was already running" instead. 💡 **Saying which of the two
  things happened is the difference between a script you can trust and one you have to reason about.**
- ⚠️ **What the script still cannot do, and says so rather than implying.** A dev server on *another machine* is
  invisible to a local `netstat`, so it would start a second one. And it can confirm the app was **launched**, not
  that it **rendered** — only a human or a CDP probe can, the same limit as `I23`. ⚠️ **The launch is refused, not
  performed, whenever the UI cannot possibly load.** That is the whole lesson of the original bug: *"Done. The app
  is starting on the emulator."* was true and useless.

- ✅ **Gates 2026-10-17 01:11–01:35 (`Run Android.bat` + the DoD gate table) — gates 1–5 run, 6–8 NOT run, and
  named.** 🔴 **The session's other lesson is the one that matters: I listed "promote the node checks to gates" as
  open item #1 in my very first summary and then never did it. The user asked.** A debt that is written down is
  not paid; it has now actually been changed.
  | Gate | Result |
|---|---|
| `backup-project.ps1` | **VERIFY OK, 229/229** at session start and again at the end |
| `npx eslint .` | **0 errors / 3** pre-existing warnings — the accepted baseline |
| `npx vite build` | **exit 0** (864 ms) |
| `node e2e/check-coverage.mjs` | **exit 0 — 40 suites, 359 tests, 24/24 shipped features, 0 gaps** (unchanged: no ids touched) |
| node checks (🆕 now **gate 5**) | **`bundleGuard.check` 20/20** · `profileBundle.check` **46/46** · `profileStorage.check` **32/32** · `check-profile-keys` **OK** |
| web / Windows / Android E2E | ⚠️ **NOT RUN, and here is why: nothing under `src/` or `e2e/` changed.** The diff is one root `.bat`, `AGENTS.md`, and this file. The three E2E phases drive the built app through CDP and cannot observe a Windows batch file, so running them would measure nothing — the same category the DoD exempts. **Stated rather than implied.** The last real figures are 2026-10-17 00:22 in the entry below: **229 / 249 / 239, 0 FAIL each** |
| user hand-test | ✅ **PASSED for the 2026-10-17 00:22 changes** — the user confirmed *"Android banner fix is working and other changes are covered as well."* 🔴 **Not applicable to this session's diff** (a script and a docs table) |
- 🔴 **`Run Android.bat` WAS NOT BROKEN. IT WAS LAUNCHING A BUILD THAT CANNOT WORK, AND SAYING "DONE".**
  The user reported *"Run Android.bat doesn't work I had to use Build Android.bat instead."* Run rather
  than reasoned, and it **exits 0 and the app comes to the foreground** — `mCurrentFocus` was
  `…thespellcaster.MainActivity`, the process was alive, `monkey` reported `Events injected: 1`. The app then
  showed this, and only this:
  ```
  Failed to request http://10.2.0.2:5173/: error sending request for url (http://10.2.0.2:5173/)
  ```
  **The installed APK is a DEBUG build and a debug build does not contain the UI** — it fetches it from the Vite
  dev server at run time. With no server listening the app *cannot* load, so launching it opens a window that is
  guaranteed to fail, and the script then printed *"Done. The app is starting on the emulator."* 💡 **The script
  did its job and the user was right not to trust it: "started" was true and useless.** This is the same shape as
  the Android stall of 2026-10-16 — **a cheerful success line over an outcome nobody had checked** — and the
  whole point of `bundleGuard`'s *"does not respond within 30 s, so the app stopped waiting"* is that the failure
  this script could not see is exactly the one it now refuses in advance.
  **Fixed by refusing rather than launching.** A pre-flight checks for a listener on `DEVPORT` (5173, from
  `tauri.conf.json`'s `devUrl`) and, with none, exits **1** explaining what a debug build is and pointing at
  `Build Android.bat`. It still starts nothing: the "open only" contract is unchanged. **Both paths tested for
  real** — no server → the new message, exit 1; server present → launches, exit 0 — and then **proven end to end**:
  with a plain `npx vite` on 5173 (no `tauri android dev` at all) the script opened the app and the board
  rendered fully on the emulator. 💡 **The check survives `Build Android.bat` too**, which is the point: a
  pipeline already running means the port is open, which is exactly the case the old script handled correctly.
  ⚠️ **Two things this cannot do, and they are not bugs.** A dev server on *another machine* is invisible to a
  local `netstat`, and the message says so and tells the reader how to dismiss it. And the script cannot tell
  you the app actually rendered — only a human or a CDP probe can, which is the same limit as `I23`.
- ✅ **The slider centring got an independent confirmation on a real Android WebView.** The screenshot taken to
  prove the `.bat` fix shows the card sliders at 100% with their handles visibly centred on their rails, and the
  header's master handle likewise. That is the second A/B (the first was desktop Chromium at 6×), and it is the
  one that matters, since **WebView2 and the Android WebView are different Chromium builds.**
- 💡 **A PowerShell trap caught me mid-investigation, in the one place it is hardest to see.** `& $adb shell
  monkey … >nul` is fine in cmd and **wrong in PowerShell**, which tries to open a real file named `nul`:
  *"FileStream was asked to open a device that was not a file."* It failed the **relaunch** after my
  `am force-stop`, so the app was left stopped and the first "it works" screenshot showed the **home screen**.
  💡 **The same class of silent-wrong-thing as the UTF-8 trap: the command reports success, the outcome is
  something else.** Always `cmd /c` a `.bat`, and never use `>nul` from PowerShell.

- ✅ **Gates 2026-10-17 00:22–01:05 (Settings UI polish, slider alignment, the Android banner) — ALL SEVEN GREEN.**
  Every gate was run: the change is **app code**, so nothing was exempt. **Web is back to the exact 2026-10-16
  baseline; Windows and Android are baseline +1 each, which is the new `I23`.**
  | Gate | Result |
  |---|---|
| `backup-project.ps1` | **VERIFY OK, 229/229** (40.1 MB) at session start, and again at the end. 229 rather than 228 because `src/bundleGuard.js` and `e2e/bundleGuard.check.mjs` exist now |
| `npx eslint .` | **0 errors / 3** pre-existing warnings (`convertFileSrc`, `_`, `ev`) — the accepted baseline |
| `npx vite build` | **exit 0** (852 ms; the `INEFFECTIVE_DYNAMIC_IMPORT` notice is pre-existing) |
| `node e2e/check-coverage.mjs` | **exit 0 — 40 suites, 359 tests** (was 358; `I23` registered), **12 shared specs, 24/24 shipped features, 0 gaps** |
| node checks | **`bundleGuard.check` 20/20** · `profileBundle.check` **46/46** · `profileStorage.check` **32/32** · `check-profile-keys` **OK** |
| **web E2E** | **229 PASS / 0 FAIL / 0 WARN, exit 0** (`e2e-run-20261017-004206.log`) — **exact baseline** |
| **Windows E2E** | **249 PASS / 0 FAIL / 1 WARN, exit 1** (`e2e-run-20261017-004643.log`) — baseline **+1** (`I23`); WARN is G5. **`Restore verified FROM DISK`** again |
| **Android E2E** | **239 PASS / 0 FAIL / 1 WARN, exit 1** (`e2e-android-20261017-005214.log`) — baseline **+1** (`I23`); WARN is G5 |
| user hand-test | 🔴 **NOT DONE, and it is required.** Three of these four changes are user-visible and only a human can confirm they *feel* right: the slider handles now sit centred on their rails, Legal & Credits is at the foot of Settings, and on Android the import banner's Dismiss button is now pressable instead of sitting under the status bar. What *was* verified mechanically is listed below; say so rather than implying a hand-test happened |
- 🔴 **THE ANDROID BANNER DEFECT, MEASURED RATHER THAN GUESSED.** "The import/export message goes to an
  un-touchable part of the screen and can't be closed" was **not** a mystery: on Android the webview is **edge to
  edge** (`build.gradle.kts` `targetSdk = 36`), so whatever renders **first** in the app's flex column is drawn
  **under the status bar**, which swallows touches. Every other edge of the app compensates for this (the mobile
  header's `max(env(safe-area-inset-top), 12px)`, both scroll containers' bottom inset, added in `9c2a4c3`);
  **the import banner and the save-error banner were the only two that did not.**
  `I23` now measures it on the real device: **`safeTop=52` and the dismiss button at `top: 54`** — clear of the
  strip. On Windows the same assertion reports **`safeTop=0`, `top: 2`**, which is the pre-fix geometry and is
  correct there because desktop has no inset. 💡 **The fix is on a single wrapper around both banners**, not on
  either one, because "which banner is first" is a runtime fact (an import shows the summary with no save error;
  a failed write shows the alert with no summary) and a wrapper is the only place that question is asked once.
  ⚠️ **What the automated test can and cannot prove.** `I23` is a **geometry** assertion, and that is deliberate:
  `I21`'s synthetic `element.click()` dispatches into the DOM and cannot see the system UI, and
  `Input.dispatchTouchEvent` goes *into the webview*, so it would have **passed against the broken layout too**.
  Only a real thumb on a real device closes that gap, which is the hand-test above.
- ✅ **The slider fix was proven by A/B screenshot, not by trusting the arithmetic.** With `appearance: none`,
  Chrome lines the thumb's **top** edge up with the runnable track's top edge rather than centring it, so an
  11px handle on a 3px rail hangs 4px low — exactly the "hanging down" reported. The fix is the arithmetic the
  browser will not do: **`margin-top: (rail − handle) / 2`** → `-4px` on `.slider` (3px rail, 11px handle),
  `-1.5px` on `.slider-compact` (2px rail, 5px handle), and `-4px` again on `.slider-compact:active/:focus`, whose
  rail thickens to 3px. Both were screenshotted at 6× before and after: **before**, the rail cuts across the top
  of the handle; **after**, the rail passes through its centre. ⚠️ **The margin is the whole fix and it is
  invisible in code review** — a pseudo-element cannot be measured from JS (`getComputedStyle(el,
  '::-webkit-slider-thumb')` silently returns the *input's* own values: it reported `masterThumb: "3px"` for an
  11px handle), so **a screenshot is the only verification that exists.** Firefox centres the thumb itself, so
  the `-moz` rules deliberately carry no margin.
- ⚠️ **A copy change failed a test, and the test was the thing that was wrong.** Suite **V1** asserted the
  empty-state copy by substring: `t.includes('toggle Edit Mode')`. Rewording "No characters yet — toggle Edit Mode
  to add one." to "No characters yet. Toggle Edit Mode to add one." failed **V1 on web** while the app was
  behaving correctly. Both entrypoints now match on the **invariant** (`/^No (characters|categories) yet/` plus
  `Edit Mode`) rather than the verb, because there are two variants in the app ("Toggle" for an empty section,
  "Open" for an empty container) and the mobile copy already had to enumerate both by hand. 💡 **The first
  honest sign that a prose assertion is a liability is that it fails the moment you fix the prose.**
- 🚫 **Em dashes are out of the app's user-facing copy, by the user's instruction (2026-10-17).** All **11** real
  em dashes (U+2014) went from `src/App.jsx` strings, plus the **ASCII ` - ` separators that read identically on
  screen**: `App.jsx` `bundleNotice` ("Export cancelled, nothing was saved."), the `Exported "X": …` summary,
  the `N sounds skipped: …` clause, the eight empty-state sentences (now a full stop, because a comma there is a
  splice), the sound-picker label `${groupName}, ${displayName}`, `bundleGuard`'s timeout text, and two
  `profileBundle` messages. **A colon, not a comma, in the two label→value cases** ("Exported \"X\": …",
  "skipped: …") — a comma would have produced a run-on and the user's instruction was about *dashes*, not about
  forcing commas everywhere. ⚠️ **Scope was agreed explicitly: app UI copy only.** `PROJECT_STATE.md` itself still
  contains ~519 of them; the markdown was left alone.
- ✅ **What changed in Settings, verified by screenshot rather than by reading the diff:** the Export & Import
  block is now *heading, one sentence, Export, Create/Replace, Import* and nothing else — the `Importing a file
  will:` label, the per-mode description and the zip/priming paragraph are all gone (the user asked for all
  three) — the sentence reads "Nothing is uploaded anywhere, the file goes wherever you save it.", and
  **Legal & Credits is last, below Close Settings** (it carries `data-settings-legal` now, so the position is
  assertable). ⚠️ That screenshot was taken with `isTauri` forced true in a plain browser, because the section is
  gated on it; **the native pickers were not opened and neither button was clicked.**

- ✅ **Gates 2026-10-16 22:50–23:20 (the import latch fix + the two Android scripts) — ALL SEVEN GREEN, every count
  identical to baseline.** The change is **app code** (`src/App.jsx`, new `src/bundleGuard.js`) plus two new root
  scripts, so nothing was exempt.
  | Gate | Result |
  |---|---|
| `backup-project.ps1` | **VERIFY OK, 226/226** at session start, and again at the end |
  | `npx eslint .` | **0 errors / 3** pre-existing warnings (`convertFileSrc`, `_`, `ev`) — the accepted baseline |
  | `npx vite build` | **exit 0** (827 ms) |
  | `node e2e/check-coverage.mjs` | **exit 0 — 40 suites, 358 tests, 12 shared specs, 24/24 shipped features, 0 gaps** (unchanged: no E2E ids added or removed) |
  | node checks | 🆕 **`bundleGuard.check` 20/20** · `profileBundle.check` **46/46** · `profileStorage.check` **32/32** · `check-profile-keys` **OK** |
  | **web E2E** | **229 PASS / 0 FAIL / 0 WARN, exit 0** (`e2e-run-20261016-230023.log`) |
  | **Windows E2E** | **248 PASS / 0 FAIL / 1 WARN, exit 1** (`e2e-run-20261016-230459.log`) — WARN is G5. **`Restore verified FROM DISK`** again |
  | **Android E2E** | **238 PASS / 0 FAIL / 1 WARN, exit 1** (`e2e-android-20261016-231024.log`) — WARN is G5 |
  | user hand-test | 🔴 **NOT DONE, and for the timeout path it is not practically possible** — exercising a 30 s timeout needs a real hang, which reproduced twice and then never again. **Say so plainly.** What *is* cheaply confirmable by hand: the amber **"Still working"** strip appears during a normal import and clears afterwards — one import, one look |
  ⚠️ **The new `bundleGuard` path is covered by a node check, not by Suite I** — Suite I drives `exportBundle`/
  `importBundle` *directly*, below the UI, so it never touches the React wiring. That is why the race was extracted
  into `src/bundleGuard.js` rather than left inline in `App.jsx`: **the two paths that matter (a promise that never
  settles, and a cancel after completion) are exactly the ones a browser spec cannot reach**, and a node check
  asserts both in under a second.
- ✅ **Gates 2026-10-16 18:52–19:12 (retiring the two shipped specs) — ALL SEVEN GREEN, counts identical to the
  2026-10-16 baseline.** Nothing shipped and nothing user-facing changed: the diff is two deleted `.md` files, one
  machine-checked JSON field per feature, three **comment-only** edits in `e2e/`, and this file. All three E2E gates
  were run anyway, because `e2e/coverage.manifest.json` and three harness files were touched — that is exactly the
  case the DoD's "docs-only, gates 5–7 would be measuring nothing" exemption does *not* cover.
  | Gate | Result |
  |---|---|
  | `backup-project.ps1` | **VERIFY OK, 228/228** (228 files, 40.1 MB), taken before the first edit — and again at the end |
  | `npx eslint .` | **0 errors / 3** pre-existing warnings (`convertFileSrc`, `_`, `ev`) — the accepted baseline |
  | `npx vite build` | **exit 0** (1.40 s; the `INEFFECTIVE_DYNAMIC_IMPORT` notice is pre-existing) |
  | `node e2e/check-coverage.mjs` | **exit 0 — 40 suites, 358 tests, 12 shared specs, 24/24 shipped features covered, 0 gaps** (exit 0 is the point of clearing the two `spec` fields) |
  | node checks | `profileBundle.check` **46/46** · `profileStorage.check` **32/32** · `check-profile-keys` **OK** |
  | **web E2E** | **229 PASS / 0 FAIL / 0 WARN, exit 0** (`e2e-run-20261016-185605.log`) — identical to baseline |
  | **Windows E2E** | **248 PASS / 0 FAIL / 1 WARN, exit 1** (`e2e-run-20261016-190047.log`) — identical to baseline; WARN is G5. **`Restore verified FROM DISK`** again |
  | **Android E2E** | **238 PASS / 0 FAIL / 1 WARN, exit 1** (`e2e-android-20261016-190619.log`) — identical to baseline; WARN is G5 |
  | user hand-test | **N/A — not applicable.** Nothing user-facing shipped: the app is byte-identical. The DoD hand-test bar applies to user-facing *features*; say that plainly rather than implying one happened |
  ⚠️ **Not committed, not pushed** — the user has not asked. Working tree: `.gitignore`, `HOTKEYS_SPEC.md`,
  `e2e/coverage.manifest.json`, `e2e/e2e-mobile.mjs`, `e2e/specs/{playback,volume}.mjs`, `PROJECT_STATE.md` modified;
  `PER_SOUND_VOLUME_SPEC.md` + `SOUND_PRIMING_SPEC.md` `git rm`'d (staged).
  🔴 **The retirement rule earned a new clause: a feature's `spec` path is load-bearing in a machine-checked file.**
  `check-coverage.mjs:306` fails `FEATURE_SPEC_MISSING` when a `features[]` entry names a spec that is not on disk,
  so deleting the markdown alone turns **gate 4 red**. Both fields went to `null` in the same commit — the convention
  Move/copy had been using since 2026-10-04 with nothing documenting it; `$featuresComment` now documents it.
  💡 **And the selection itself was the interesting part.** `PROFILE_SYNC_SPEC.md` looked identical from the outside
  (every step checked off, hand-tested, green), and deleting it would have looked just as reasonable. It is not the
  same: **"every step is done" is not the test for whether a spec is obsolete — the unchecked boxes are.** Its §13
  deferred list is live scope, and `HOTKEYS_SPEC.md` depends on it.
  ⚠️ **A pre-existing defect noticed, not fixed (out of scope):** `coverage.manifest.json`'s `$comment` and
  `$featuresComment` carry **mojibake** — `§` became `ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬…`, i.e. double-encoded UTF-8, on the two
  em-dash/§ lines. It predates this session and was left alone rather than silently widening the diff. It is only
  prose inside a JSON comment, so no check reads it.
- ✅ **Gates 2026-10-15/16 (step 7 + the hand-test's two findings) — ALL SEVEN GREEN.** The user **hand-tested
  export/import and saw the new banner**, so the DoD user-visible bar is now **met** for this feature.
  | Gate | Result |
  |---|---|
  | `backup-project.ps1` | **VERIFY OK, 228/228** at session start, mid-session and end |
  | `npx eslint .` | **0 errors / 3** pre-existing warnings (`convertFileSrc`, `_`, `ev`) |
  | `npx vite build` | **exit 0** |
  | `node e2e/check-coverage.mjs` | **exit 0 — 40 suites, 358 tests, 12 shared specs, 24/24 shipped features, 0 gaps** (8 new ids) |
  | node checks | `profileBundle.check` **46/46** (was 36) · `profileStorage.check` **32/32** (was 26) · `check-profile-keys` OK |
  | **web E2E** | **229 PASS / 0 FAIL / 0 WARN, exit 0** (`e2e-run-20261016-000441.log`) — **+4**; Suite I is I1 + I2 only |
  | **Windows E2E** | **248 PASS / 0 FAIL / 1 WARN, exit 1** (`e2e-run-20261016-000911.log`) — **+9**; WARN is G5. **`Restore verified FROM DISK`** again |
  | **Android E2E** | **238 PASS / 0 FAIL / 1 WARN, exit 1** (`e2e-android-20261015-235809.log`) — **+9**; WARN is G5. **Restore succeeded with no warning** |
  | user hand-test | ✅ **PASSED** — the user exported and imported on the built app, **saw the new green summary banner**, and confirmed it works |
- 🔴 **THE HAND-TEST FOUND A REAL DEFECT THAT 249 AUTOMATED TESTS COULD NOT.** The user hit it on 2026-10-15 and
  described it as *"it first threw errors because of a test 'sound' you uploaded… I assume that's why the error
  triggered"* — i.e. **the message left them unable to tell which sound it was**, and the fix was trial and error.
  A board reference whose file had been deleted made `exportBundle` refuse the whole bundle naming
  `sound_9wy7vtpo_e2e_silence.wav`. Refusing is **correct** (§7: never ship a bundle with a hole in it); naming an
  internal identifier with a random prefix was not. **Fixed** — `collectProfileUploads` now carries `soundName` +
  `where` (and the group name, because two groups can both have a "Forest"), and the new exported
  **`missingBlobsMessage()`** says *"1 sound has an audio file that is no longer on disk… "Uploaded Roar" (Hero) -
  its audio file is missing. Delete it, or upload the audio again, then export."* Covered by **4 node assertions**
  plus **`I22`**, which reproduces the exact state against the real store by deleting a blob the spec itself
  uploaded.
  💡 **Why no test found it:** every existing assertion checked the *code* (`missing-blobs`) and never the *text*,
  and the one thing a human reads was the one thing nobody asserted.
- 🔴 **THE ANDROID RESTORE GUARD (exit 5) FOUND A REAL, EVERY-USER BUG.** It fired on a **correct** restore with
  `extra: profile:p_0f23bbd8:ttrpg_characters_old, profile:p_0f23bbd8:ttrpg_data_version` — the app had recreated
  both **on boot**. 💡 **Every one of the 239 suites was green; the store guard was the only thing looking**, and it
  is the guard added on 2026-10-12 to answer a different question. **The bug:** `ensureProfileStore()` and
  `createProfile()` created a profile with **no `ttrpg_data_version`**. The app then remounts onto it, the
  auto-save effect writes the shipped defaults into it, and nothing writes the stamp — so the **next** read takes
  the `storedVersion === null` branch in `readProfileData` and leaves a `<key>_old` backup of the app's own
  defaults behind, permanently. **This is the first-run path, so it affected every user on their second launch.**
  **Fixed**: both functions take `dataVersion`; all four App.jsx call sites pass `DATA_VERSION`; 6 new node
  assertions, including that the *existing* migration path still self-heals an already-unstamped profile.
  ⚠️ **The user's own store was checked and has no `_old` keys.**
- 🔴 **MY OWN TEST POISONED THE NEXT RUN, AND `O14` IS THE FIX.** `O11` creates a profile called "Other Board" and
  left it **active**. Windows hid that (its restore is verified from disk); Android's phase keeps snapshots in
  `%TEMP%` and restored less well, so "Other Board" survived — and on the **following** run its first read wrote
  `ttrpg_characters_old`, failing **Q9, P13, P14a and M21**: four suites in a different file, one day later.
  💡 **The 2026-10-11 lesson in a new hat — the cost was not in the suite that broke something, it was in the one
  that left the state behind.** `O14` now switches back and deletes the profile, asserting `leftoverKeys=[]`.
- ⚠️ **Three mistakes of mine in this stretch, all recorded because the pattern repeats:**
  1. **`ReferenceError: ok is not defined`** killed the whole Android run at `reset.mjs:408`. `O14` called an `ok()`
     helper that `reset.mjs` never had (only `bundle.mjs` defines it). **eslint cannot see this** — the reference
     lives inside a spec object — and it aborts `main()`, so it costs the whole run.
  2. **Clicked, slept 600 ms, then stubbed `window.confirm`.** `handleDeleteProfile` *awaits a file count* before
     asking, and a real native `confirm` **blocks the page** — so the stub arrives too late and the run wedges
     rather than failing. Suite F's pattern (`profiles.mjs:296`) is the working one: **stub and click in the same
     expression, never restore.**
  3. **Selected profile rows by name** (`textContent.includes('My Board')`) when the Android store has **three**
     profiles with that name, so `find` could return the wrong one. Rows carry `data-profile-row={id}` — select by
     id, always.
- ⚠️ **The PowerShell UTF-8 trap fired AGAIN, second occurrence.** `Get-Content -Raw | … | Set-Content -Encoding
  UTF8` on `e2e/specs/bundle.mjs` re-encoded the file: `§` became `Â§` (U+00C2 U+00A7), and a BOM was added.
  **Recovered** with `git checkout HEAD --` plus re-applying four edits through the editor, which is the safe path.
  💡 **The failure is silent** — no error, no replacement character, eslint clean, Node parses it. The only tells
  were a § count that *dropped* and a BOM on a file that never had one. **Never round-trip a tracked UTF-8 file
  through `Get-Content`/`Set-Content`.**
- ⚠️ **The three "My Board" profiles are reproduced by the suite itself, every run** — each spec that clears
  localStorage (`profiles.mjs` F1, `bundle.mjs`'s fixture) lets `ensureProfileStore()` create one. They do not
  *grow* past the number of clearing specs, and Windows restores faithfully, but nothing shrinks them either. The
  user removed their own duplicates by hand.
- ✅ **Gates 2026-10-14 (step 8 session) — ALL SEVEN GREEN.** Named individually, with real numbers and
  exit codes. The Android re-run that was outstanding has since passed.
  | Gate | Result |
  |---|---|
  | `backup-project.ps1` | **VERIFY OK, 228/228** at session start, and again at the end |
  | `npx eslint .` | **0 errors / 3** pre-existing warnings (`convertFileSrc`, `_`, `ev`) |
  | `npx vite build` | **exit 0** |
  | `node e2e/check-coverage.mjs` | **exit 0 — 40 suites, 356 tests, 12 shared specs, 24/24 shipped features covered, 0 gaps** (6 new ids registered) |
  | `check-profile-keys` / `profileBundle.check` / `profileStorage.check` | **OK** / **42/42** (was 36) / **26/26** |
  | **web E2E** | **228 PASS / 0 FAIL / 0 WARN, exit 0** (`e2e-run-20261015-211840.log`) — **+3**, `O11`–`O13`; Suite I is I1 + I2 only |
  | **Windows E2E** | **246 PASS / 0 FAIL / 1 WARN, exit 1** (`e2e-run-20261015-205303.log`) — **+7**; the WARN is G5, by design. **All 21 Suite I ids and all 13 Suite O ids green** |
  | **Android E2E** | **236 PASS / 0 FAIL / 1 WARN, exit 1** (`e2e-android-20261015-205902.log`) — **+7**; the WARN is G5, by design |
  | user hand-test | 🔴 **NOT DONE — and the import banner is user-facing, so the DoD bar is NOT met.** Say so plainly; only the user can confirm the banner reads well and that it appears after a real picker-driven import |
- 🔴 **THE SUITE FOUND NOTHING NEW IN THE APP, AND THAT IS THE FINDING.** Three of the six new ids failed on
  their first runs and **every one was the test's fault, not the app's** — which is the first time in this project
  that the story has gone that way, so the failures are recorded in full rather than as a count:
  1. **`O11` drove a switch button that is correctly not there.** `handleCreateProfile` already calls
     `handleSwitchProfile` (App.jsx:892-899), and the remount takes the Settings modal with it, so
     `querySelector('[data-profile-row]')` found nothing and returned `NO_ROW`. 💡 **A remount deletes the UI you
     were driving** — re-open the modal after any step that can switch profiles.
  2. **`O12` compared against a capture taken before the switch's flush.** `handleSwitchProfile` calls
     `flushCurrentProfile()` on the way out, so A's bytes were always going to be rewritten. Capturing A *after*
     the create/remount is the only comparison that isolates the restore press.
  3. **`I19`/`I20` asserted the wrong thing about the notice, twice.** The first version reloaded and expected the
     parked key to still be there; the app had already consumed it, because `requestProfileRemount` is
     **synchronous** — the banner was on screen before the test's next line ran. The second version used
     `setActive:false` to observe the key, but the engine **deliberately parks nothing** when nothing will remount
     to show it. `I19` now pins that negative rule, which is the more valuable half.
  4. **`I21` clicked Dismiss and read the DOM in the same expression** — a React state update had not flushed, so
     it reported `STILL_THERE` for a dismissal that had worked. Click, **sleep**, then read.
- ⚠️ **The user's live store holds THREE profiles all named "My Board"**, each with the same 8 keys and a
  one-character "Hero" board — all fixture, none of it the user's (their board was lost 2026-10-11 and is
  unrecoverable). **Measured, not guessed:** identical in every retained `ls-backup-*.json`, the oldest being
  `ls-backup-20261014-203303.json`, so it predates this session. 💡 **It is the fingerprint of the restore bug
  closed on 2026-10-14 23:20** — a cleared store plus a killed app committed a fresh `ensureProfileStore()`
  "My Board", and the restore that should have replaced it never reached disk. **No new ones appeared today**,
  which is the post-fix behaviour working. The user can delete the two extras in Settings > Profiles; **nobody has
  deleted them for them.**
- ✅ **Gates 2026-10-14 (step 8 session) — ALL SEVEN GREEN.** Named individually, with real numbers and
  exit codes. The Android re-run that was outstanding has since passed.
  | Gate | Result |
  |---|---|
  | `backup-project.ps1` | **VERIFY OK, 228/228** (`…-20261014-200929`), taken at the end so it matches the final state |
  | `npx eslint .` | **0 errors / 3** pre-existing warnings (`convertFileSrc`, `_`, `ev`) |
  | `npx vite build` | **exit 0** (783 ms) |
  | `node e2e/check-coverage.mjs` | **exit 0 — 40 suites, 349 tests, 12 shared specs, 24/24 shipped features covered, 0 gaps** |
  | `check-profile-keys` / `profileBundle.check` / `profileStorage.check` | **OK** / **36/36** / **26/26** |
  | **web E2E** | **225 PASS / 0 FAIL / 0 WARN, exit 0** (`e2e-run-20261014-192405.log`) — Suite I contributes I1 + I2 |
  | **Windows E2E** | **239 PASS / 0 FAIL / 1 WARN, exit 1** (`e2e-run-20261014-191900.log`) — the WARN is G5, by design. **All 17 Suite I ids green** |
  | **Android E2E** | **229 PASS / 0 FAIL / 1 WARN, exit 1** (`e2e-android-20261014-201224.log`) — the WARN is G5, by design. **All 17 Suite I ids green** |
  | user hand-test | ✅ **PASSED 2026-10-14** — the user tested export/import on the built app, **desktop → Android** (⚠️ corrected 2026-10-16; this said "web build", which has no export/import at all) |
- 🔴 **THE SUITE FOUND A REAL BUG THE HAND-TEST COULD NOT.** `src/profileBundle.js` called
  `dirname(fullPath)` without `await`; `dirname` is async, so `exists()` got a Promise and the IPC rejected
  with *"invalid args `path` for command `exists`: invalid type: map"*. **Every import carrying an uploaded audio
  file failed on desktop AND Android.** A bundle of shipped sounds has no blobs, so the loop never ran. Fixed;
  see the header for the full account.
- ⚠️ **`playback.mjs` Z1 and Z2 sampled a single instant against a 0.576s asset** (`Longbow_4.mp3`), and `z1` is
  taken ~2.3s after the trigger — the Android Q11 race again ("a race wearing a trouser-suit"). Z2 now polls for
  `readyState >= 2` with a bounded timeout and reports how long it waited; Z1 accepts "still running
  (`paused === false`) **or** demonstrably ran (`currentTime > 0`)". **Both unverified on Android.**
- 🔴 **`e2e-snapshot.mjs` was reporting a reload it could not prove.** It did
  `await cdp('Page.reload').catch(() => {})` and then logged "page reloaded" unconditionally, while the verify
  beneath it only re-reads `localStorage` — which is **correct even when no navigation happened**. With no reload
  the app keeps its boot-time board in React state and re-persists it over the restore. It now stamps a marker,
  reloads, and requires the marker to be gone (**new exit 6**), telling the user to close the app by hand if not.
  💡 **This is the check the 2026-10-11 data loss needed and never had.**
- ⚠️ **The user's board was displaced once today and restored.** The first Suite I version **threw** on a null
  `manifest`, which unwound `main()` and **skipped the entrypoint's localStorage restore**, leaving the E2E
  fixture (`Hero` / `Uploaded Roar` / `Uploaded Roar (copy)`) as the live board. Recovered from the intact
  `ls-backup-20261014-181642.json` and **verified: all 15 keys match.** The only residue is an empty
  `uploads/p_6fd7a1c1/` directory, which the app cannot remove (`fs:allow-remove-dir` does not exist).
  💡 **A spec must never throw.** Suite I's `run()` is wrapped, every page result is dereferenced defensively,
  and a failed prerequisite FAILs the dependent ids by name (`I0` logs only when the catch fires).
- 🔴 **The restore-to-disk doubt is CLOSED (2026-10-14 23:20).** It was **not** a flush delay and **not** the app
  re-persisting its boot state. Proven by a controlled A/B: `taskkill` on the tree loses the write, `WM_CLOSE`
  to the window keeps it. WebView2 commits `localStorage` on window close and commits nothing on a kill, so the
  runner's "graceful" kill was the whole bug. `Close-AppGracefully` now closes the window and waits for the CDP
  page target to disappear; `e2e-snapshot.mjs compare` then reads the store back from a fresh start and fails
  hard (exit 7) on any difference. **Verified:** `Restore verified FROM DISK - the store matches the pre-run
  snapshot exactly`, with the suite at 239 PASS / 0 FAIL / 1 WARN in the same run, and `uploads/` pruned to just
  `p_guardprobe/` (2 files).
- ⚠️ **PROJECT_STATE.md was briefly corrupted by a PowerShell line-range rewrite** that read the file as ANSI and
  re-encoded it, and the `git checkout` used to undo that also discarded the **uncommitted 2026-10-13** edits to
  this file. Both were recovered: the corrupt write was reverted and this file was restored from the
  `…-20261014-175940` backup (strict UTF-8, 87 arrows intact). 💡 **Never rewrite a tracked UTF-8 file with
  `Get-Content`/`WriteAllLines` in PowerShell 5.1 — use the editor, and never `git checkout` a file whose
  changes are uncommitted and not backed up.**
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

- ✅ **Gates 2026-10-13 (guard session) — ALL SEVEN RUN, all green.** Unlike the previous two sessions, the E2E
  gates were **not** skipped as "measuring nothing": this session's whole purpose was to re-exercise the Windows
  phase, which **is** the thing under test.
  - `backup-project.ps1` → **VERIFY OK, 224/224** (session start and again at the end)
  - `npx eslint .` → **0 errors / 3** pre-existing warnings (`convertFileSrc`, `_`, `ev`)
  - `npx vite build` → **exit 0** (812 ms; the `INEFFECTIVE_DYNAMIC_IMPORT` notice is pre-existing)
  - `node e2e/check-coverage.mjs` → **exit 0** — 39 suites, 331 tests, 11 shared specs, 23/23 shipped features
  - `node e2e/check-profile-keys.mjs` → **OK**, exit 0 · `node e2e/profileStorage.check.mjs` → **26/26**, exit 0
  - **web 223 PASS / 0 FAIL / 0 WARN, exit 0** (`e2e-run-20261013-152155.log`)
  - **Windows 222 PASS / 0 FAIL / 1 WARN, exit 1** (`e2e-run-20261013-152610.log`) — exact baseline; the WARN is
    G5, and **uploads were snapshotted (2 files) and restored (2 files)** with SHA256 verified on disk after
  - **Android 212 PASS / 0 FAIL / 1 WARN, exit 1** (`e2e-android-20261013-153452.log`, `Pixel_7` booted by the
    script) — exact baseline
  - ⚠️ **Windows/Android exit 1 is the expected G5 skip**, not a regression. **No stray processes and no listening
    ports** (9223/9224/9225/5173) were left behind.
  - **No user hand-test** — nothing user-facing shipped. The fixture is an inert file outside the repo; the app
    cannot see it. Per the DoD the hand-test bar applies to *user-facing* features, so it does not apply here.
- ✅ **Gates re-run 2026-10-13 (recovery session) — named individually, because not all seven ran.** The only
  tracked file changed was **this markdown file**; no `src/` code was touched, so the three E2E gates would be
  measuring nothing.
  - `backup-project.ps1` → **VERIFY OK, 224/224**, twice (start and end of session)
  - `npx eslint .` → **0 errors / 3** pre-existing warnings (`convertFileSrc`, `_`, `ev`) — the accepted baseline
  - `npx vite build` → **exit 0** (1.44 s; the `INEFFECTIVE_DYNAMIC_IMPORT` notice is pre-existing)
  - `node e2e/check-coverage.mjs` → **exit 0** — 39 suites, 331 tests, 11 shared specs, 23/23 shipped features
  - `node e2e/check-profile-keys.mjs` → **OK**, exit 0 · `node e2e/profileStorage.check.mjs` → **26/26**, exit 0
  - ⚠️ **web / Windows / Android E2E were NOT run** — no emulator or device booted, and a markdown-only change
    cannot affect them. The 2026-10-12 figures above stand unchanged.
  - **No user hand-test** — nothing user-facing shipped, so the DoD hand-test bar does not apply.
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

✅ **Pruned 2026-10-14 23:58, 6 → 1, keeping `…-20261014-235700`** (at the user's request, after the push) —
**~200 MB freed** (240 MB → 40 MB). Safety was **proven before deleting**, not assumed: every file in all five
folders was matched against `git ls-files` ∪ the working tree, and **all five returned 0 orphans**. The keeper was
taken last, so it matches the final state rather than something a correction re-created afterwards.
⚠️ **Order matters and the two rules interact:** take the final backup FIRST, then delete the rest, then **do not
re-back-up for a docs-only touch-up** — otherwise each correction re-creates a folder and the session never
converges on one.
🗑️ Gone: `…-20261013-172917`, `…-20261014-175940`, `…-200929`, `…-20261014-202032`, `…-232715`.
⚠️ **`e2e/e2e-full.ps1` was Bitdefender-quarantined out of `…-20261013-172917`** (226 files, not 227) — the same
containment failure recorded above, and the reason the keeper was taken fresh rather than kept.
ℹ️ **The keeper is `…-20261017-015650`** (VERIFY OK **229/229**, 40.2 MB, `e2e/e2e-full.ps1` **present**, **72**
files in `public/assets` = the 71 tracked plus `desktop.ini`, `src-tauri\gen` absent by design), taken **last** so it
matches pushed HEAD `25ac19a`.
✅ **Pruned 7 → 1 on 2026-10-17**, after the push, freeing **~241 MB** (281.3 MB → 40.2 MB). 🔴 **The first orphan
audit was WRONG and said "DO NOT PRUNE"**, which is the correct behaviour of a check that is wrong: it compared each
backup against `git ls-files` **alone**, and so labelled **every untracked-but-real file** as an orphan — 411 of
them. The rule is `git ls-files` **∪** the working tree. Redone correctly, the only apparent orphans were **12**,
and each was resolved by hand rather than waved through:
| apparent orphan | verdict |
|---|---|
| 10 × `.idea/**` | **Not orphans.** They are on disk and gitignored (`.gitignore:193`); the audit's own walk had skipped `.idea`. A false positive caused by the checker, not by the backup |
| `Launch App Android.bat`, `Run Tauri Android.bat` | **Not orphans, and worth the check.** These are the **pre-rename** names and they existed only in the six older folders. Their content was compared against `HEAD:Run Android.bat` and `HEAD:Build Android.bat` **after un-renaming**: **byte-identical in both cases**, so the backups held nothing git lacks |
⚠️ **A rename makes the prune audit do real work that it never had to do before.** Six folders held files whose
names no longer exist in the tree, and the audit is right to call them orphans until someone proves otherwise —
"it is obviously just the old filename" is exactly the reasoning that deletes the only copy of something.
⚠️ **Prune by NAME, never by `LastWriteTime`:** all five reported the *same* mtime (`2026-10-14 20:07`), because
OneDrive stamps the folder, not the copy. Sorting on mtime would have kept an arbitrary one.
✅ **Earlier prune: 5 → 1 on 2026-10-16**, after the push, freeing ~120 MB. **0 orphans proven in all four** — every
file matched against `git ls-files` **∪** the working tree. Gone: `…-20261015-000122` (the previous keeper),
`…-20261015-201927`, `…-20261015-212503`, `…-20261016-001542`.
🗑️ **Gone 2026-10-17:** `…-20261016-233323`, `…-20261017-002244`, `…-20261017-010318`, `…-20261017-011104`,
`…-20261017-012240`, `…-20261017-014433`. ⚠️ **A prune is not a no-op when it fails** — Bitdefender's write-lock
left four partially-deleted shells on 2026-10-13 — so the keeper was re-verified afterwards as a *kept* artifact:
both renamed scripts present **and CRLF**, both old names absent, `e2e-full.ps1` survived, 0 zero-byte files.
⚠️ **Two of the seven were taken during this session** (`…-002244`, `…-010318`, `…-011104`, `…-012240`, `…-014433`
and `…-015650` = six of the seven), which is why the count grows during a long session even though the script
never prunes.

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
  🔴 **But the 0.0.0.0 mitigation does NOT cover the VPN address after all** (2026-10-22): the emulator's
  traffic to `10.2.0.2` is swallowed by the VPN, so the app loads nothing - *Failed to request
  http://10.2.0.2:5173/* - and **dies before the suite starts** (the phase reports `exit=3`, app not reachable
  on :9225). It looks like a crash and is not one: the tauri log shows a clean install and launch, and Vite was
  up and bound to every interface. The address DOES matter, because of the VPN.
  **Fix: `e2e-android.ps1` now starts the CLI with `--host 10.0.2.2`** - Android's hard-coded
  emulator-to-host alias, which the VPN does not touch. 💡 `TAURI_DEV_HOST=192.168.1.105` does **not** help:
  the CLI rewrites the devUrl from its OWN detection, and the HMR host is a different thing.
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

⚠️ **THE AV CONTAINMENT HAS REGRESSED — `e2e/e2e-full.ps1` was quarantined from ALL FIVE backup folders on
2026-10-13, including the surviving one.** This contradicts the *"it did not fire again during the final runs"*
line this section used to carry; that was true through 2026-10-13 15:00 and false by 17:45. Measured, not assumed:
five backups existed at 21 741 B each, the file was present and the right size, it was **locked and unreadable**
("being used by another process" — Bitdefender scanning), and ~30 minutes later it was **gone from all five**.
  - **No data was lost, and that is the part worth stating precisely.** The repo copy survives (the project's
    `e2e\` directory is excluded from scanning), it is **committed and pushed** — verified `HEAD == origin/mobile-support`
    at `48ad37de` with `git cat-file -e HEAD:e2e/e2e-full.ps1` passing — and `git show HEAD:e2e/e2e-full.ps1`
    returns the blob. So the file exists in **three** places and the backups are the one that is degraded.
  - ⚠️ **The surviving backup is therefore 226 files, not 227.** It is the newest and it matches the working tree
    (226/226 byte-identical by SHA256), so it is a sound rollback point for everything git does not already hold.
    **It was deliberately NOT re-taken:** the repair would just re-copy a file the AV removes again, and the
    standing rule is to prune last and not re-backup after it.
  - 💡 **The lock is the leading indicator, and it is worth knowing before the file vanishes.** During the prune,
    `Remove-Item` failed on all four folders with *"the process cannot access the file … being used by another
    process"*, leaving four **partially deleted shells** (183–185 files each) rather than clean deletions. So the
    AV holds a write lock for several minutes *before* it quarantines. A prune that fails this way is not a
    no-op — it has already destroyed most of each folder. **Verify what is left before assuming a failed prune
    deleted nothing.**

## Backups
🔴 **ONE folder, as of 2026-10-21.** The prune is **done**, and it was done in the correct order: the final backup was
taken **first**, then the rest were deleted. **Ten folders (~603 MB) were pruned to one on 2026-10-21**, at the
author's request, after the work was pushed. One markdown edit behind is a perfectly good rollback point; an
unbounded folder count is not.

⚠️ **The audit found real orphans and would have destroyed them.** Before deleting, every folder was checked against
**`git ls-files` ∪ the working tree** — *not* `git ls-files` alone, which is the check that wrongly cried
"DO NOT PRUNE" on 2026-10-17. Every folder being deleted had orphans:
- **5 test images** (3 golden-armour renders, 2 screenshots) existed **only** in backups, since they had been removed
  from the working tree. 🔴 **They were preserved to `Masaüstü\output\preserved-test-images\` before the prune**, and
  the author has since deleted those copies too. `06_unserved_inputs.png` is now the only record of them.
- **3 Sound Normalizer files** — expected, deleted at the author's instruction with their own copies elsewhere.

| Folder | Files | Note |
|---|---|---|
| **`.-20261021-223728`** | **255** (VERIFY OK, 62.8 MB) | **the keeper** as of 2026-10-21, taken after `01c8440` so it matches the pushed HEAD. Count it with `Get-ChildItem -Recurse -File -Force`: without `-Force` the hidden `public/assets/desktop.ini` is missed and you get 254 |
| ~~10 folders~~ | 253-255 | deleted 2026-10-21, **~603 MB freed** (603 MB -> 62.8 MB) |

**Keeper verified as a kept artifact, not assumed:** `e2e/e2e-full.ps1` present (the AV-sensitive one),
`ICON_PREP_SPEC.md`, `.gitattributes`, `scripts/Image Pipeline/image_pipeline.py` and both example images present,
**0 zero-byte**, no stray `__restore_backup`.

💡 **A prune is not a no-op when it fails** — Bitdefender's write-lock left four partially-deleted shells on
2026-10-13 — so what remained was **re-counted after deleting**, not assumed to have worked.

Run `.\backup-project.ps1` (root) **before any change** — full rules in `AGENTS.md`. Copies everything
except build output (`node_modules`, `dist`, `.git`, `target`, `gen`), then verifies every
source file reached the backup and repairs from git if not. **224 files / ~39.8 MB**, including
`public/assets` audio. (Was recorded as "223 files / ~39.7 MB" — stale since 2026-10-12.) ⚠️ **When counting
files yourself, use `Get-ChildItem -Recurse -File -Force`** — without `-Force` the hidden files (`.gitignore`,
`.oxlintrc.json`) are missed and you get 223 instead of 224, which looks like a missing file and is not.

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
**There were NINE project backups in `Masaüstü` when this session pruned them — not two, as this file claimed.**
All 9 were taken on 2026-10-13 between 14:58 and 15:52, all `VERIFY OK` 224 files / ~39.8 MB:
`145839`, `150318`, `150957`, `151308`, `151535`, `151927`, `154824`, `155152`, `155220`.
💡 **The count in this file was wrong by 7** — it listed only the two the previous session knew about, because
`backup-project.ps1` **prints its folder name and nothing prunes it**, so a session that takes several backups
(two at the start/end of a change, more after each commit) leaves the record out of date silently. **Count the
folders on disk before writing the number down** — `Get-ChildItem $desk -Directory -Filter 'ttrpg-soundboard-backup-*'`.
✅ **Pruned again 2026-10-13 at 17:45, 5 → 1** (at the user's request), keeping **`…-172917`** — **~159 MB freed**
(199.3 MB → 39.89 MB). All five were taken this session plus the last one: `155810` (pre-session survivor),
`160137`, `161425`, `172435`, `172917`. Safety was proven **before** deleting, not assumed: every file in all five
was matched against **git `ls-files` ∪ the working tree**, and **all five returned 0 orphans**. The survivor was
then re-checked as a *kept* artifact: **226/226 files byte-identical to the working tree by SHA256**, 0 zero-byte,
all three new files present (`src/profileBundle.js`, `src-tauri/src/scope.rs`, `e2e/profileBundle.check.mjs`),
71 files in `public/assets`. ⚠️ **It is 226 and not 227** — `e2e/e2e-full.ps1` was quarantined by Bitdefender; see
the AV section above. That is one file behind HEAD, recoverable from git, and deliberately not re-taken.
⚠️ **The `Launch Opencode - ttrpg soundboard.bat.lnk` shortcut on the desktop was left alone** — it is a launcher,
not a backup.
💡 **The surviving folder is `…-155810`, not the one first kept — and that is the rule working, not churn.**
Pruning ran against `…-155220`, then the standing *"re-take one at the end so it matches the final state"* rule
produced `…-155810`, so the stale one was deleted and the newest kept. **The two rules interact, and the fix is to
prune last:** take the final backup, then delete the rest, then **do not re-backup for a docs-only touch-up** —
otherwise each correction re-creates a folder and the session never converges on one. One markdown edit behind HEAD
is a perfectly good rollback point; an unbounded folder count is not.
⚠️ **Do not confuse these with `ttrpg-soundboard-recovered-20261013`, which existed earlier today and is DELETED.**
It was a one-off copy-out of the user's own upload files, not a backup of the project; gone at their instruction.
✅ **`e2e/e2e-full.ps1` survived in it** — Bitdefender did not fire. The **50 tracked `src-tauri/gen/android/`
files are absent by design** (the `gen` exclusion above), which is the one known gap between a backup and a
checkout.
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
**It fired on 2026-10-13 and the containment has regressed** — see the ⚠️ note immediately above this heading.
`e2e/e2e-full.ps1` was quarantined from **all five** backup folders this session, where it had survived every run
through 2026-10-13 15:00. The repo copy is excluded from scanning and is committed and pushed, so this is a
backup-folder problem only. `backup-project.ps1` remains the mitigation, not a fix — but note that a *repair* now
restores a file the AV deletes again, so a repaired backup can report `VERIFY OK` and still be one file short by
the time it is used.

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
**Three specs are waiting to be built**, each meant to be picked up in a fresh session. They were written against
different revisions of `src/App.jsx` (`HOTKEYS_SPEC.md` at 6240 lines, `FADE_SPEC.md` and `ICON_PREP_SPEC.md` at
7448) — **re-verify any line number you inherit**, they drift. **None is authorised for implementation.**

| Spec | What it is | Recommended order |
|---|---|---|
| `FADE_SPEC.md` | **Per-file fades.** Replaces the sound-level `Duration (s)` / `Fade In (s)` / `Fade Out (s)` number boxes (`App.jsx:6500-6533`) with **per-file** sliders capped by the real audio length, a **per-row timeline that also scrubs Play Until**, and exactly **one** red state. **The one-line model: `audibleEnd = min(fileLength, playUntil)`, and both fades measure back from their end of that.** Fixes the four silent no-ops `Z15` pins. ⚠️ **A persisted-shape change**, not just UI — the fields move off the sound onto each file entry | **Now.** It fixes a real defect and its cost was measured, not guessed |
| `ICON_PREP_SPEC.md` | **Icon preparation, in-app.** Two **opt-in** operations on sound-icon upload — **Make silhouette** (background removal → flat grey → tints cleanly) and **Fit to square** (interactive crop, colours kept) — so no Python is needed. Replaces `scripts/Image Pipeline/image_pipeline.py` for anyone who lacks it; the script is **not** retired. 🔴 **It does not reuse the script's algorithm**: measured on three of the user's own dark-background images that produces an **80% grey slab**, so the spec uses an adaptive Otsu-on-distance-from-border-colour method picked by measurement. Colour/photo art is **deliberately not** silhouetted. **Adds no persisted shape**; replaces the icon on confirm, with a warning | **After fades.** Onboarding, not a defect |
| `HOTKEYS_SPEC.md` | Keyboard shortcuts to trigger sounds. In-app tier (a `keydown` listener) vs global (`tauri-plugin-global-shortcut`, desktop-only, `main.rs` only — the **reverse** of the dialog rule). ⚠️ a hotkey is a *reference*, and `PROFILE_SYNC_SPEC.md` §8 plus the category-name-as-identity landmine are what make that hard. ⚠️ it must not fire while a text field has focus — this app has many. ⚠️ It must route through `playWithPrimes` so a hotkey also fires the primed set. ⚠️ `P1`–`P16` (volume), `P17`–`P34` (desktop priming) and `Q1`–`Q14` (mobile priming) are all taken | **Last** |

🗑️ **The two shipped specs are gone** (`PER_SOUND_VOLUME_SPEC.md`, `SOUND_PRIMING_SPEC.md`, deleted 2026-10-16 at
the user's request). What replaced them: the **per-sound volume** and **Sound priming** sections below, which now
carry each one's residue; the `Retired files` list; and `git show c60a355:<file>`. The traps they recorded —
`||` → `??` for a legitimate muted sound, `_baseVolume` refresh or loop re-entry snaps back, persist-once-on-commit,
the `primedRef` stale-closure double-consume, the three gesture traps — are all still in those sections.

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

📌 **`PER_SOUND_VOLUME_SPEC.md` was DELETED 2026-10-16** (its residue is here and in Open items). Two coverage gaps
it tracked are still open and are now recorded in Open items: the **mid-fade rescale branch** and a **mid-fade-out**
whose slider moves — the shared `rescaleAudioTarget` arithmetic is covered for the non-fade branch only, because
every fixture finishes before a fade completes, so closing them needs a long-`fadeIn` sound. 💡 Its
*"a real loop-boundary crossing"* row **is** closed, by `Z8`/`Z9` in `specs/playback.mjs`.
🚫 **Deferred and NOT built** (deferred is not the same as abandoned — do not build these unasked): a **per-container
or per-group default level** ("new sounds in this group start at 80%"), which is the one that would need a new
persisted structure and therefore a **`PROFILE_SYNC_SPEC.md` §4.2 census re-run**; per-sound **pan/balance**, which
reuses the same four call sites and the same card control; and MIDI/CC-style external control, ruled out of scope.
The full prose is in git: **`git show c60a355:PER_SOUND_VOLUME_SPEC.md`** (284 lines — `c60a355` is the last
commit that contains it, so it is the stable citation; the file shipped as `10fe6e2`, and `23bf458` last touched it).

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

📌 **`SOUND_PRIMING_SPEC.md` was DELETED 2026-10-16** — it had already been rewritten as a build record, so the
section above plus this note is what it held. Three things it said that must not be lost:
- 🚫 **Saved named layers ("Model B") were REJECTED by the user on 2026-10-06.** Priming is one-shot and is **not**
  profile content. **Do not build it, and do not add a `localStorage` key for it** — the absence is deliberate and
  `P31a` asserts it. A bundle must never carry priming state.
- 🚫 **Still out of scope, deliberately:** priming **whole containers**, timing offsets, sticky priming, priming
  *from* a hotkey picker, and undo for a mis-prime. The clear-all button is the v1 answer for a mis-prime.
- ⚠️ **Binding requirement on the queued hotkeys feature:** a hotkey **must** fire the primed set through
  `playWithPrimes`. Two triggers with different semantics is the thing to avoid. Carried in `HOTKEYS_SPEC.md` §5.
- 💡 Its harness traps survive in `e2e/lib/cdp.mjs` (`cdpInput` does `Page.bringToFront` first — a headed,
  occluded Edge window receives **no** `Input.dispatchMouseEvent` while `document.hasFocus()` still reads true) and
  in this section (the untrusted-click rule). Full prose: **`git show c60a355:SOUND_PRIMING_SPEC.md`** (220 lines).

| Spec | Status |
|---|---|
| `PROFILE_SYNC_SPEC.md` | ✅ **steps 1, 3–6, 7 AND 8 SHIPPED; step 2 (cut) was the only one never built.** Step 1 shipped as `577505d` (2026-10-12) and is covered by `specs/profiles.mjs` (F1–F12). Steps 3–6 shipped 2026-10-13. **Step 8 shipped 2026-10-14** as `specs/bundle.mjs` (**I0–I17**, since **I0–I21**), the shared browser spec, and the `coverage.manifest.json` feature entry is `status: shipped` — the flip is what forced the round-trip tests to exist. The user **hand-tested export/import on 2026-10-14** (**desktop → Android** ⚠️ corrected 2026-10-16 — this said web, which cannot have it). **Step 7 shipped 2026-10-15**: Restore Defaults proven profile-scoped (**O11–O13**, *no app code needed* — `activeProfileId` is fixed per mount) and the import's per-file report + one-shot notice (**I18–I21**, `profileBundle.check` 46/46). Design decisions settled (§0.3: timestamps **cut**, switch = **full remount**, `DATA_VERSION` **migrates**). The desktop `app.fs_scope().allow_file(path)` route is shipped and measured (11/11 on real hardware, per-file narrowness confirmed) — **no blanket fs scope, no `fs:scope: ["**"]`.** ⚠️ **The only thing left is the native picker**, which no test can drive. |
| 🆕 **`fflate@0.8.3` (zip) and `@noble/hashes@2.4.0` ARE installed and NOW IMPORTED** — added by `fd57d3a` (2026-10-12 17:46) but **dead weight until 2026-10-13**, when `src/profileBundle.js` became their first consumer. ⚠️ `@noble/hashes` v2 has an **explicit-`.js` exports map**: the import is `@noble/hashes/sha2.js`, and the bare `@noble/hashes/sha2` fails with `ERR_PACKAGE_PATH_NOT_EXPORTED`. The `coverage.manifest.json` feature entry stays `status: planned` until the shared browser spec exists. |
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

## ✅ AGREED PLAN 2026-10-14 — DONE. The root cause was not a flush delay; it was the kill.

**The user's proposal.** After every E2E run the boards should return to their shipped state — not merely via the
app's *Restore Defaults* button, which is a **merge** and therefore leaves sounds the user added. The user also
suggested this would fix the restore-to-disk gap.

**What actually turned out to be wrong, and what was right.** Writing a clean state is still a `localStorage`
write inside the process being shut down, so on its own it would **not** have fixed the gap — but the gap turned
out to have a single, provable cause, and closing it made the clean state stick for free.

### 🔴 THE ROOT CAUSE, PROVEN BY A CONTROLLED A/B
Write one marker key in the page, close the app two different ways, then start it fresh and read the store back:

| how the app was closed | did the write survive? |
|---|---|
| `taskkill` on the process tree | **NO** — 27 keys, marker gone |
| `WM_CLOSE` to the app window, then wait | **YES** — 28 keys, marker present |

**WebView2 commits `localStorage` when the window closes, and commits NOTHING when the process is killed.** So
every "restored and verified" this harness ever printed was true *of the page* and silent *about the disk*,
because the page's data died with the process. The runner's "graceful" `taskkill` without `/F` was not graceful
at all for a GUI process — it terminated it. 💡 This is the whole answer to a question that had been open across
three sessions and two data-loss incidents.

### Part 1 — residue sweep ✅
`restore-uploads` now removes every **empty** directory under `uploads/` and reports the count. Safe
unconditionally: an empty directory holds no bytes and the app mkdirs on demand, so nothing can miss it. This is
also why `uploads/` used to fill with shells — `fs:allow-remove-dir` does not exist, so the app creates
`uploads/<profileId>/` on demand but can never remove one. **Verified: `uploads/` now holds only
`p_guardprobe/` (2 files), which is what a fresh install looks like.**

### Part 2 — prove the restore from disk ✅
`e2e-snapshot.mjs` gained a **`compare <expected> <actual>`** mode: pure Node, no CDP (it has to work when the
app is dead), key-by-key, **exit 7** on any difference. `e2e-full.ps1` now, after a Windows phase: restores the
store, closes the app, restarts it, snapshots again, and compares against the pre-run snapshot. A mismatch is a
**hard failure** with both file paths and the recovery command printed — never a green "restored and verified"
line. **It fired correctly the first time it ran** and reported `missing (24) / extra (24) / changed (2)` —
the whole fixture store, proving the restore had not survived at all.

### Part 3 — the fix that makes both work ✅ `Close-AppGracefully`
The runner no longer kills the app at the end of a phase. It posts **`WM_CLOSE`** to the app's visible window(s)
and waits for the **CDP page target to disappear** — that is the signal the WebView2 profile has been disposed
and the store committed. Only then does it clear up the leftover processes, which can no longer lose anything.
⚠️ **Waiting for the PROCESS to exit is the wrong signal**: after `WM_CLOSE` the Tauri process lingers for tens
of seconds while the window and its profile are already gone. The first version waited for the process and
"hung" for 30s on every run.
**Verified end to end 2026-10-14 23:20:** `App closed cleanly - the store was committed.` →
`Restore verified FROM DISK - the store matches the pre-run snapshot exactly.` with **web-suite 239 PASS /
0 FAIL / 1 WARN** in the same run.

⚠️ **Part 3 was not in the original plan** — it is the thing the other two were waiting on, and it is the
actual fix for the gap that has been open since 2026-10-11.

### The residue fallout — ✅ DONE 2026-10-14 23:40 (`c7b967a`)
With a verified-clean store, the two `<knownKey>_old` exclusions added earlier the same day were **reverted**
and the guards put back at full strictness. All three E2E gates re-run: web **225/0/0 exit 0** · Windows
**239/0/1 exit 1** · Android **229/0/1 exit 1** — **0 FAIL everywhere**, and the Windows run again reported
`Restore verified FROM DISK`. 💡 **That re-run is the proof, not a formality:** had the store still been dirty,
removing the exclusions would have brought P14a/P31a/M21 straight back. 0 FAIL says the *environment* was fixed;
it does not say the assertions were quiet. `spellcaster_import_backups` **stays** in `KNOWN_KEYS` — a real app key
that arrived late, correctly listed.

⚠️ **A trap in `e2e/lib/page.mjs` worth knowing: the whole `PROFILE_HELPER` block lives inside a JS template
literal, so a BACKTICK in a comment terminates the string and Node evaluates the rest as code.** It has now bitten
that file twice on 2026-10-14 (`ReferenceError: knownKey is not defined`), each time costing a four-minute run
before the failing phase was even reached. There is a warning in the file; read it before editing that block.

**Not in scope:** step 7 (Restore Defaults profile scoping, import progress UI) and promoting the node checks to
gates.
## Open items

⚠️ **The `Z15` limitation now has a DESIGN, agreed 2026-10-18, and it is not merely recorded.** `FADE_SPEC.md` §1
enumerates all **four** ways `fadeOut` is silently inert today (`duration: 0` · `duration` past the file ·
`fadeOut > duration` · `loop: true`), and §2 gives the model that makes three of them unrepresentable:
**`audibleEnd = min(fileLength, playUntil)`, with all three values per-file and both fades measured back from
their end of that.**
🔴 **The fourth changed shape on 2026-10-18 and is now a bigger, better feature than was first drafted.** Looping is
**segment looping + seam fades, built together** (§7): `playUntil: N` with `loop: true` **loops 0…N forever**, with
`loop: false` it **stops at N** — one control, two coherent meanings, no new field. `fadeOut` positions the seam and
`playUntil` positions the loop point, and `audibleEnd` is already the loop point so **no extra rule is needed**.
**The mechanism is cheaper than "problematic in the past" suggests**: the rewind threshold
(`max(duration - 0.25, duration * 0.98)`, `App.jsx:4085`) becomes `min(playUntil, duration)`.
⚠️ **Two consequences a future session must not miss.** (1) **`firstLoopPlay` (`App.jsx:4077`) is REMOVED** — a
fade-in must run at *every* seam, so the guard's premise is gone. (2) 🔴 **`Z9` must be rewritten deliberately in
the same commit**, because its fixture assumes once-only behaviour and **will keep passing** on a short clip while
asserting the old contract. `stopAfter` was renamed **`playUntil`** — free, since nothing shipped under the old
name. All three values **travel in a bundle**; the timeline draws the **whole file**; ARIA on the bar is **built
properly**, not deferred. Still **NOT authorised to build**.

- ✅ **Consider the node checks gates — DONE 2026-10-17, and it is gate 5 of the DoD.** This row is deleted rather
  than ticked: gate 5 exists in `AGENTS.md`, its one-line command carries the four counts, and the row would have
  sat here claiming open work that has been finished for a day. The reason it is still worth remembering: it
  **bit twice** — the node checks are what found the `bundleGuard` latch and are the only coverage the post-picker
  guard has. See the top table, row 1.
- ✅ **A NEW PROFILE MUST BE VERSION-STAMPED FROM BIRTH — FIXED, and re-verified on a real import 2026-10-16.**
  `ensureProfileStore()` and `createProfile()` take `DATA_VERSION`. Without it the profile is written unversioned by
  the auto-save effect on mount, and the **next** read takes `readProfileData`'s `storedVersion === null` branch and
  leaves a `<key>_old` backup of the app's own shipped defaults behind. **That was the first-run path, so it affected
  every user on their second launch**, and it was found by the Android restore guard (exit 5) reporting
  `extra: ...ttrpg_characters_old` **after a correct restore** — with all 239 suites green. All four App.jsx call
  sites pass `DATA_VERSION`; 6 node assertions pin it. ✅ **And the fix held on the Android round trip**: the
  imported profile carries `ttrpg_data_version: 3` with **no `*_old` keys**, read back from the live store.
- ✅ **Step 7 is DONE (2026-10-15), hand-tested, and step 8 shipped 2026-10-14** — `O11`–`O13` prove Restore
  Defaults is profile-scoped (no app code needed), `I18`–`I21` give the per-file report with a real `skipped` plus
  the one-shot notice that survives the remount, and `I22` + `missingBlobsMessage` make the export refusal name the
  sound. ⚠️ **§9.2's progress dialog was declined by the user and deliberately not built** — the notice replaces it.
- ✅ **The native picker is hand-verified, and that was always going to need a human.** It cannot be driven from CDP
  (every `__TAURI_INTERNALS__` member is immutable; the writable `chrome.webview.postMessage` is bypassed because
  Tauri's injected `ipc` captures it in a closure), so every automated check drives *below* it (`bundle.mjs`).
  **The user opened and used both pickers on both platforms on 2026-10-16** — cancel *and* accept, export *and*
  import. **This item is closed.** Re-verifying costs a human clicking two dialogs, which is the correct price.
- ✅ **The restore-to-disk gap is CLOSED** — see the AGREED PLAN section above. Root cause proven by A/B
  (WebView2 commits only on window close, never on a kill), `compare` added and fired correctly on its first run,
  and `Close-AppGracefully` now closes the window and waits for the commit.
- ✅ **"A successful import shows no confirmation" — RESOLVED, and the fix was the notice, not a dialog.** The old
  reasoning was that both modes remount, so the Settings modal unmounts with any message set in it. The resolution
  shipped 2026-10-15 anyway, via `spellcaster_import_notice`: a **global** one-shot key read-and-removed on the next
  mount, because an import can create the very profile the notice is about. Verified consumed after the round trip.
- ✅ **RESOLVED 2026-10-13 15:56 — the 114-file E2E snapshot is deleted, at the user's explicit instruction.** It
  held **114 files / 18.03 MB** (all **53** mp3 + **15** png of theirs, plus 46 `e2e_silence` fixtures) in
  `%LOCALAPPDATA%\opencode\e2e-snapshots\uploads-backup-20261012-170301\`, having survived the earlier sweep. They
  were told exactly what it contained and answered *"If they are not needed delete them. I have all my files stored
  somewhere else"* — an informed decision, and not the "delete the last copy" trap, since the app has held none of
  it since 2026-10-13 and the board itself is unrecoverable. **The inventory was archived to
  `docs/session-history.md` first**, because deleting the folder also destroyed the only record of which 11 sounds
  existed. Verified gone afterwards.
  - 💡 **What the inventory showed that the earlier notes had not:** the audio had been uploaded **twice** in
    places — Daze **8**, Warding Sign **8**, Force Barrage **7**, 4 each of the other eight. So "11 sounds" was
    always a loose description of 53 files, and several share an identical byte size under different
    `sound_<rand>_` prefixes (the same clip uploaded to more than one sound). Even the dedup was not obvious.
  - ⚠️ **The auto-prune hazard is gone with it** — `e2e-full.ps1:240` keeps 2 `uploads-backup-*`, so two more
    `-Phase win` runs would have deleted it as routine housekeeping. **No need to think about that before running
    Windows phases any more.**
  - Left alone on purpose: the `ls-backup-*.json` / `MANUAL-REFERENCE-ls-*.json` files beside it (~11 KB each).
    They are **localStorage**, not audio, hold only E2E fixtures (no snapshot anywhere holds the user's board), and
    one is cited as evidence elsewhere in this file.
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
  - **Why the harness did this** (mechanism, now **corrected** 2026-10-13 — see the next bullet): the Windows
    phase writes into the user's real WebView2 `localStorage`. ⚠️ **This bullet previously claimed the real
    content "survived under a different profile id". That is FALSE, and I have now checked it.** The `uploads/`
    snapshot added 2026-10-12 23:09 works — **`localStorage` was never given the equivalent protection**, and
    the overwrite is why the board is gone.
- ✅ **RESOLVED 2026-10-12 17:03 — the harness no longer writes the user's board away**, and both items below
  were then answered by the user. Fixed and independently verified; see Verification gates for the three changes
  and the disk-level proof. **`-Phase win` is safe to run again.** What is *not* resolved is the board itself.
- ✅ **No *structural* recovery is possible** — the user's answer holds ("I already have the files"), and nothing in
  `uploads/p_09b2806c/` was undisturbed by it at the time, but see below — the files were **deleted on
  2026-10-13**. The copy-out that briefly existed has also been deleted; the bullet below records what it
  established, not where anything is.
- ✅ **The user's explicit concern — "none of the test sounds were uploaded to git" — CHECKED AND CLEAN.**
  `git ls-files` matched exactly one test-sound name, `e2e/e2e_silence.wav`, and that is the harness's **own
  fixture source** (referenced by both entrypoints, committed in `79acc3e`) — a single 313 KB file. The **46**
  `sound_*_e2e_silence.wav` copies exist **only** in `%APPDATA%\…\uploads\p_09b2806c\`, never in the repo. No
  runtime upload (`sound_<rand>_<name>` / `icon_<rand>_<name>`) is tracked; the only large tracked files are
  `public/assets` (the 71 shipped sounds, deliberately tracked in `ba57282`), `src-tauri/icons`, and the
  `gen/android` launcher icon. 💡 The new snapshot directory is deliberately **outside the repo** for the same
  reason — an 18 MB uploads copy per run must never be committable.
- ✅ **Copy-out was made and then DELETED at the user's instruction (2026-10-13) — as were the originals.** They
  authorised a copy on the condition it not be destructive, and at the time
  `%APPDATA%\com.mrhorakhty.thespellcaster\uploads` was left alone; **a few minutes later they asked for the
  originals to go too** and the scope was confirmed explicitly before anything was removed. What the copy
  established, and what is still worth knowing:
  - It held **53** mp3 + **15** png = **3.99 MB**, every copy **SHA256-verified** against source (0 mismatches),
    with the source's newest write still **2026-10-11 22:17:04**. The user's own source copies already cover
    these, so the folder was removed rather than kept as a redundant third copy.
  - **11 sounds**, derived from the `safeName` half of `sound_<rand>_<safeName>`: Daze (8), Force Barrage (7),
    Warding Sign (6), and 4 variants each of Fear, Phantom Pain, Phase Bolt, Shield Magic, Telekinesis,
    Telekinetic Projectile, Tentacular Limbs, Ventriloquism. All **15** icons matched a sound name.
  - ⚠️ **The escaping is one-way** — `toStoredFileName` (App.jsx:2255) maps every char outside `[a-zA-Z0-9._-]`
    to `_`, so `_` → space is a *reconstruction*. `Warding__Sign` → "Warding  Sign" (double space) is the visible
    mark that the original filename held a non-space character.
  - 💡 **Wording lesson, and it cost the user a confusing minute.** This was a *copy-out of their files*, not a
    restore into the app, and reporting it as "**Recovery DONE**" sent them opening three builds hunting for
    sounds that had never been re-added. **Say "copied out" / "preserved a copy". Never "recovered" or
    "restored"** — those words imply the app now contains the data.
  - 💡 **Deliberately NOT done:** writing a rebuilt board back into the live `localStorage`. **Moot now** — with
    the audio deleted there is nothing left for a rebuilt board to reference. Had it been wanted, it would have
    needed a full LevelDB snapshot first and the user's decision on a guessed grouping.
- 🔴 **CONFIRMED GONE, exhaustively (2026-10-13) — the board *structure* is unrecoverable.** I re-checked this
  rather than trusting the note, and **all 37** `ls-backup-*.json` files (not 36 — one more has appeared since)
  were grepped for `p_09b2806c`, for a real `storedName`, and for a real sound name. **Exactly one** file matches,
  `ls-backup-20261011-221530.json`, and it is **fixture content**: `char_2` "Renamed Paladin", `s_6`,
  `mine_1`, `mine_2`, `zz_custom` from `reset.mjs`, every `files[]` entry pointing at `Longbow_4.mp3` with **no
  `storedName` field at all**. There is **no different profile id** holding the real board — the earlier claim of
  one was wrong, and it now means **the board was overwritten *before* 2026-10-11 22:15**, earlier than this file
  recorded. The app still opens on `p_0d866f71` "My Board" = `playback.mjs`'s "Human Paladin"/"Playback Probe"
  fixture, and `p_f121afb8` = shipped defaults. ⚠️ **A restore from any snapshot will not bring the board back**,
  and a future reader must not assume otherwise.
  - ⚠️ **CORRECTED 2026-10-13, later — the snapshots were not the whole store, and I checked too late.** The
    **live** WebView2 `localStorage` is a LevelDB at
    `%LOCALAPPDATA%\com.mrhorakhty.thespellcaster\EBWebView\Default\Local Storage\leveldb\`, and **no snapshot
    covers it**. Read **read-only** as bytes: `p_09b2806c` survives there in `000010.ldb`, and its one surviving
    value is
    `profile:p_09b2806c:ttrpg_environment` = `[{"id":"e1","category":"Dungeon","sounds":[{"id":"e1s1",
    "name":"Dripping","type":"Ambient","icon":"Icon.png","files":[{"name":"drip.mp3","displayName":"drip.mp3"}],
    "color":"#84cc16","duration":0,"randomPlay":false,"loop":true}]}]`
    — a single environment category with one looping ambient sound. ⚠️ **And it is unplayable**: it references
    `drip.mp3` with **no `storedName`**, and no `drip*` file exists in `public/assets`, in `src/data.json`, or
    among the 114 uploads. So the last real board entry left is a dangling reference.
    **There is no `profile:p_09b2806c:ttrpg_characters` key in the live store at all**, and **none of the 53
    recovered `storedName`s appear anywhere in it** — the characters that held them are gone for good.
  - ⚠️ **Why raw byte-grepping this store gives FALSE NEGATIVES.** Values are **Snappy-compressed**; only
    uncompressed blocks are searchable as ASCII. A search for `Telekinesis` returned zero — but nearby dumps show
    the strings *"Forest"*, *"Tavern Pack"*, *"Music"*, *"Divine Smite"* interleaved in the same byte window.
    Those are fragments of **other keys' compressed payloads bleeding into the window**, not content of the key
    being read. 💡 **Do not conclude a key is absent from one byte window, and do not treat a readable fragment as
    belonging to the key above it.** Take a value only when the JSON starts immediately after its key and runs
    unbroken — which is how the Dungeon entry was confirmed.
  - 🗑️ **The 11 sounds' files were DELETED at the user's instruction on 2026-10-13 — they are GONE, not preserved.**
  `uploads/p_09b2806c/` went from **114 files / 18.03 MB to 0**, i.e. **53 mp3 (2.37 MB) + 15 png (1.62 MB) of
  the user's own content, plus 46 `e2e_silence` harness fixtures (14.04 MB)**. The empty profile directory was left
  in place (the app cannot remove dirs — `fs:allow-remove-dir` does not exist). The user stated they hold their own
  copies elsewhere and asked for this twice, the second time with the scope confirmed explicitly.
  ⚠️ **So the corrected facts below are now historical, not current.** They record what was *true when measured*;
  nothing on disk backs them any more. 💡 **The sequence is the lesson:** the OneDrive copy-out was deleted first,
  and only afterwards the in-app original — so for a period there was no second copy anywhere. When the user says
  "I have copies of those somewhere else", **that is a claim to check before deleting the last copy**, not after.
- ✅ **The 53 audio + 15 icons were intact on disk until 2026-10-13, when they were deleted (see above).** They
    were **orphaned** throughout: no surviving localStorage content referenced them, so the app never showed them.
    What the copy-out established, and what is still worth knowing:
- ✅ **The uploads snapshot guard is RE-VERIFIED 2026-10-13 — it had gone stale *and* broken, not just vacuous.**
  A live fixture now lives in `uploads/p_guardprobe/` and a **real Windows phase was run against it**.
  - 🔴 **The emptied folder left the harness in a broken state, which was not obvious from "vacuous".**
    `save-uploads` snapshots an empty folder and **exits 0** (`e2e-snapshot.mjs:77`), so `e2e-full.ps1` proceeded —
    but `restore-uploads` **exits 4** on an empty snapshot (`e2e-snapshot.mjs:92`). So a Windows phase run in that
    state would upload its fixtures, **fail its own restore**, print *"Your audio files may not be back where the
    app expects them"*, and **leave the suite's residue in the live folder** with the phase exit code untouched.
    The refusal is the *correct* fail-safe — an empty snapshot is indistinguishable from a snapshot that failed —
    but it cannot clean up when "empty" is the true state.
  - ✅ **Fixture placed: `uploads/p_guardprobe/`** — `guard_probe_tone_440hz.wav` (4844 B, 0.3 s, 8 kHz 16-bit mono,
    437 Hz measured) and `README-GUARD-PROBE.txt` (what it is, why, how to remove it). Inert by construction:
    `p_guardprobe` is **not** in the `spellcaster_profiles` index, so the app never lists or deletes it, and it is
    **inside a profile-scoped subdirectory on purpose** — a file *flat* in `uploads/` would be swept up by the
    one-time uploads migration and **moved** into the active profile, which is the very mechanism that made this
    guard necessary, so a flat fixture would muddy the measurement. The profile id is deliberately **not** a real
    one (`p_09b2806c` is the owner's). Safe to delete; nothing references it.
  - ✅ **Proven three ways, 2026-10-13, all with SHA256 on the fixture files:**
    1. **Direct round trip** — snapshot 2 files → deleted the WAV, renamed the README away, added
       `junk_should_not_survive.wav` → `restore-uploads` exit 0 → **both files back byte-identical** (`4901390C…`,
       `55E27DE5…`), junk gone, renamed file back under its original name, **no stray `__restore_backup`**.
    2. **The refusals still refuse** — an *empty* snapshot and a *missing* snapshot each **exit 4** with
       `live files left untouched`, verified afterwards by re-hashing. 💡 This is the property that protects real
       audio, so it is worth re-checking whenever the guard is touched.
    3. **A real Windows phase** — `e2e-full.ps1 -Phase win -Suite full`: `saved 2 upload file(s)` before launch,
       the suite genuinely uploaded (`WAV uploaded`, `WAV uploaded to group`), `restored 2 upload file(s)` after
       the kill, and the folder on disk afterwards is **exactly** the 2 fixture files with **identical SHA256**,
       0 flat files, no stray backup dir. Suite **222 PASS / 0 FAIL / 1 WARN exit 1** (G5 baseline).
  - 💡 **The check to hold this guard to: re-hash the live folder after the run, not the restore's own log line.**
    "restored 2 upload file(s)" is a claim; the SHA256 match is the evidence. Same lesson as the localStorage
    restore, which had to be given a verifying re-read (exit 5) after reporting success without reaching disk.
  - ⚠️ **`uploads/` now legitimately holds 2 files, all fixture.** Do not read a file count there as "the user's
    audio is back" — their content was deleted on 2026-10-13 and is not coming back (see above).
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
- ✅ **`Build Android.bat` and `Run Android.bat` replace it (2026-10-16) — two TRACKED root scripts.**
  🔴 **RENAMED BY THE USER 2026-10-17**: `Run Tauri Android.bat` → **`Build Android.bat`**,
  `Launch App Android.bat` → **`Run Android.bat`**. ⚠️ **Every reference in this file uses the NEW names, so
  searching for the old ones here finds nothing** — they live in `docs/session-history.md`, which is the right
  place for them.
  `Build Android.bat` **builds + reinstalls + runs** (and *refuses to start* if another `tauri android dev` is
  already running, and **asks before** freeing port 5173); `Run Android.bat` **opens the installed app and is
  SELF-SUFFICIENT** — it starts a Vite dev server itself when nothing is serving 5173, because the installed APK
  is a **debug build** and a debug build carries no UI at all. The old `.gitignore` entry stays, because
  `tauri android init` regenerates the file — the rule is what stops a regenerated copy appearing as untracked.
  ⚠️ **Do not confuse either of them with the retired `Run App.bat`**, a different and dead file under
  `src-tauri/gen/android/` that is gitignored. ⚠️ **All the other `.bat` files here are CRLF and must stay that
  way** — bare LF breaks `goto`, proven by A/B below.
  💡 **Three `cmd` traps hit while writing these, all worth remembering because two are documented in this file
  already:** (1) **an unescaped `)` inside `echo` text silently ends an `if (...)` block** — `process(es) found.`
  produced *"found. was unexpected at this time"*; the fix is **`goto` labels**, which cannot be broken that way.
  (2) **a quoted path inside a ``for /f`` backtick command cannot be captured** — the same trap `kill-ports.bat` was
  fixed for; adb output now goes through a temp file. (3) ⚠️ **`for /f` without `usebackq` reads a quoted path as a
  literal STRING**, so `skip=1` then skips the only iteration and the loop silently runs **zero** times — that is
  why device detection found nothing on the first attempt. All three were caught only by **running** the scripts.
- ✅ **CLOSED 2026-10-14/15 — step 8 shipped as `e2e/specs/bundle.mjs`** (Suite **I**, now **I0–I23**), wired into
  **both** entrypoints, registered in the manifest with the feature flipped `planned` → `shipped`. It found a real
  shipping bug on its first run (the missing `await` on `dirname`). `F` and `I` are both taken as id prefixes;
  `F1`–`F12` (profiles) and `I0`–`I22` (bundles) — check `coverage.manifest.json` before picking another, and keep
  `idPattern` non-overlapping (`AMBIGUOUS_ID`).
  - 💡 **§9.3 is what made it possible.** `exportBundle`/`importBundle` take and return **bytes**, so the spec drives
    the whole round trip in-page and **never opens a native dialog** — the only way it could be tested on Android at
    all (`DOM.setFileInputFiles` kills the Android WebView).
  - ⚠️ **A spec that reloads constantly needs its OWN post-reload helpers.** `window.__setInput` does not survive a
    reload and `evalJs` swallows the exception, so the failure surfaces much later with a misleading value.
- ✅ **The user HAS hand-tested export/import — three times**, and ⚠️ **an earlier entry here recorded the wrong
  direction.** The user's correction, 2026-10-16: the first test was **Desktop → Android**, *not* "web build →
  Android". **Web has no export/import at all** — the section is gated on `isTauri` (§7), so a web-build round trip
  was never possible and any note claiming one was wrong. Three tests: 2026-10-14 (**Desktop → Android**), 2026-10-15
  after step 7 (**they saw the new summary banner**), and 2026-10-16 (**Android → Desktop, plus deleting an
  imported profile on Desktop — see the next bullet**). The 2026-10-15 hand-test is what found the export refusal
  naming a `storedName` instead of the sound — see Verification gates.
  ✅ **Consequence: `PROFILE_SYNC_SPEC.md` §13's desktop→Android row is now covered by a hand-test**, and its
  *"⚠️ Desktop-only so far; the Android half is unverified"* caveat is **stale — deleted 2026-10-16**. What is
  *still* only a human can confirm: a **cross-\*device\*** round trip (a third machine), **Android export → import
  on the same device** (§13's remaining unchecked row, `:805` — a *different* round trip from the cross-device one),
  and **"Replace active" under a real board**.
- ✅ **§13:790 IS NOW CLOSED BY HAND — deleting an imported profile.** The row's entire caveat was *"covered by
  Suite F, ⚠️ but not re-run against a profile that came from an import"*, and the user did exactly that on
  2026-10-16: imported a **mobile** board into the **Desktop** app (worked first try) and deleted it. 💡 **The
  assertion to hold a delete to is a restart, not a disappearing row** — the standing lesson from the 2026-10-11
  data loss. Asked of the user as a checklist: the original profile is still listed and active, **every sound in it
  with an uploaded file still plays** (the delete must sweep only `uploads/<deletedId>/`, and a blob shared with a
  surviving profile would surface here as a dead sound), a **restart** reloads the same board with no `<key>_old`
  keys, and the profile count dropped by exactly one. ⚠️ **Their answer is not recorded yet** — ask for it before
  treating the row as closed.
- ✅ **§13:806 IS CLOSED BY HAND-TEST (2026-10-16).** The user cancelled **both** the export and the import picker
  **on both platforms**, and the expected messages appeared every time. That was the last unchecked picker row and
  the **last thing in the feature only a human could check** — the native dialog cannot be driven from CDP, and the
  contract is asymmetric (desktop resolves `null`; Android rejects with `"File picker cancelled"`,
  `DialogPlugin.kt:98`/`:237`, matched by `/cancel/i` at `App.jsx:977,992`). 💡 **Worth knowing what it was guarding:**
  a missed `/cancel/i` would have rethrown and shown the user **"Import failed: File picker cancelled"** — an
  alarming error for a deliberate action. It does not happen. **The picker is now hand-verified on both platforms for
  both operations, cancel and accept.**
- ✅ **"Stuck at importing" on Android — CLOSED as a mystery, and the diagnosis is the interesting part.**
  **The facts, once established:** the picker opened, the file was tapped, the button latched on **"Importing…"**
  forever with no error and no way out, and **nothing was imported**. **Five candidate causes were tested and
  rejected — four of them mine** (cloud provider blocking; a running `tauri android dev`; `readFile` on a
  `content://` URI, which **rejects in 4–53 ms**; `dialog.open()` never returning, which it did; and the app's own
  lazy `import()`, which settles in 1012 ms cold). **It never reproduced in a clean environment**, and it did not
  reproduce in a clean same-device round trip on 2026-10-16 either. **So there is no cause, and none is recorded.**
  ⚠️ **`adb logcat` CANNOT diagnose this one — that advice is WITHDRAWN.** The pipeline's stream ran throughout a
  successful round trip and contains **no** `dialog`, `plugin:fs`, `grant_path` or `content://` output at all:
  neither plugin logs there. Any future stall must be diagnosed **in the app**.
  🔴 **What did ship, and it is the part that mattered:** `src/bundleGuard.js` bounds every step **after** the
  picker (30 s) and adds a **Stop waiting** button, so a hung IPC can no longer latch the UI with no escape. The
  **picker itself is deliberately not timed out** — the user controls how long they browse. `bundleGuard.check` **20/20**.
  💡 **The lesson that cost most, keep it:** a hand-test run against a **polluted** dev environment (two stale
  `tauri android dev` instances, a dead Vite) produced a **false defect report** that sent five rounds of
  investigation at a call that rejects in 4 ms. **Check Vite is alive and only one CLI instance runs before
  trusting any "the app hangs" report** — two seconds of work. 💡 And a *specific-sounding* detail carries no
  information: "it said importing" is printed **before** the picker even opens, so it cannot localise a hang.
  Full narrative: `docs/session-history.md`, 2026-10-16 21:20–23:30.
- ✅ **Steps 3–6 shipped 2026-10-13.** What follows is what the next session should NOT have to re-derive:
  - **The bundle engine is `src/profileBundle.js`**, a pure-bytes module (§9.3) — `exportBundle(options)` returns
    `{bytes, manifest, data}` and `importBundle(bytes, options)` returns a report. Both take injectable `store` /
    `normalize` so `e2e/profileBundle.check.mjs` drives them in node against a fake localStorage (**36/36**).
  - **Provenance is structural, not a flag**: a reference with no `storedName` is a bundled asset, and bundled
    assets never enter a bundle. `localStorageMigrationCompleted` and the `spellcaster_profiles` index **stay
    global**.
  - **Pass `Uint8Array`, never `Array`** — desktop IPC stringifies an `Array` body. This was **reproduced live**
    (64 bytes → a 189-byte file of digits, no error), which is why the app also reads the file back off disk and
    checks its size and `PK` magic before reporting success.
  - **The destination-picker write needs no new capability** — just the ~5-line `app.fs_scope().allow_file(path)`
    runtime grant, **measured working and per-file** (11/11). Android takes a `content://` URI that `plugin-fs`
    resolves, with no scope change at all.
  - ⚠️ **Facts re-verified and WRONG in older notes:** `localStorage` call sites are still **27**, but the
    `uploads/` count is **4 chokepoints, not 10** — `getTauriStoragePath` is the single path builder with 3
    callers, and `getFileFromLocalStorage` bypasses it via `appDataDir`/`join`. Prefix *enumeration* is real.
    "Reset to starter sounds" shipped as `restoreDefaults` (App.jsx:3111) and now needs profile-scoping. Two risks
    remain on the board: cross-profile shared blobs (never hardlink between profiles) and the object-URL cache on
    switch (App.jsx `objectUrlCache`). 💡 **The design changed in three places during step 1**: timestamps were
    **cut**, the switch became a **full remount** rather than an in-place reload, and a `DATA_VERSION` mismatch now
    **migrates** instead of resetting.
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
- `scripts/Sound Normalizer/` — **retired 2026-10-18 at the user's instruction**, all three files
  (`normalize_sounds.py`, `run_normalizer.bat`, `How it works.txt`). 💡 **Why: the app already does this, better.**
  Loudness balancing is a *playback* property, and the app has had a **per-sound volume trim** (`_soundVolume`,
  `App.jsx:4008`) since 2026-10-06. 🔴 **The decisive reason is that the script's product cannot be built in a
  browser at all**: it re-encodes to **MP3 at -16 LUFS**, and **no browser has an MP3 encoder** — the measurement is
  feasible (`decodeAudioData` + K-weighting) but the output format is a wall. Its only unique value is *"the file is
  genuinely -16 LUFS in other software"*, which is worth nothing for a soundboard at the table.
  ⚠️ **Deletion was safe because it was ordered, not lucky**: a backup was taken **first** (`…-20261018-142328`,
  VERIFY OK 250/250, confirmed still holding `normalize_sounds.py` afterwards), and **the user holds their own copies
  elsewhere**. `scripts/` is **untracked**, so there is no `git rm` and no `.gitignore` entry to add — the files
  existed in exactly two places, and the copy that remains is the user's.
  🚫 **Do not resurrect it as a `.localStorage` key or a per-sound "loudness" field.** If a future spec wants true
  LUFS normalisation it must answer the encoder question first; re-measuring and storing a compensating trim is the
  cheap alternative and is **already what the volume slider does**.
  💡 **A real bug found in it, moot now but worth not re-introducing**: `normalize_sounds.py:56` was
  `normalize_sounds.vpy = normalize_folder()` — leftover junk that *calls* the function, so the whole normaliser ran
  **twice** and asked for the folder path twice (harmless output, second pass used `--force`).
- `PER_SOUND_VOLUME_SPEC.md`, `SOUND_PRIMING_SPEC.md` — **retired 2026-10-16** at the user's request, `git rm`'d
  and `.gitignore`'d. Both had **shipped and been hand-tested**, and both had already been rewritten as records of
  what was built rather than plans, which is what made them retirable. ⚠️ **They were NOT deleted on sight** — the
  residue that existed nowhere else was archived **first**, into the *Per-sound volume* and *Sound priming*
  sections of this file: the **rejected "Model B" saved named layers** (priming is one-shot, is **not** profile
  content, and **no `localStorage` key** may be added for it — the absence is deliberate and `P31a` asserts it), the
  priming items still deliberately out of scope (whole containers, offsets, sticky, from a hotkey picker, undo), the
  **binding requirement that a hotkey must fire the primed set through `playWithPrimes`**, the **per-container /
  per-group default level** deferral and its `PROFILE_SYNC_SPEC.md` §4.2 census re-run, and the two still-open fade
  coverage gaps. Full prose: `git show c60a355:<file>`.
  ⚠️ **`e2e/coverage.manifest.json` had to change in the same commit.** `check-coverage.mjs:306` fails
  `FEATURE_SPEC_MISSING` when a `features[]` entry names a `spec` that is not on disk, so both `"spec"` fields went
  to `null` — the same convention Move/copy used. 💡 **A feature's spec is a load-bearing path in a machine-checked
  file**: deleting the markdown alone turns gate 4 red, which is the only reason this was caught rather than
  discovered later.
- `e2e/e2e-run.mjs`, `e2e/e2e-features.mjs`, `e2e/e2e-features.ps1` — **retired 2026-10-11**, `git rm`'d and
  `.gitignore`'d. These were the legacy pre-refactor suites (`-Suite run|features`). ⚠️ **They were NOT deleted on
  sight** — the Phase 3 plan said "delete them", and auditing first showed **~31 tests that existed nowhere
  else**, so they were ported into shared specs *before* the delete: `specs/platform.mjs` W1–W6 (was Suite P),
  `specs/scroll.mjs` R1–R10 (was Suite A), `specs/playback.mjs` Z1–Z12 (was Suite E plus D11/D12). That is the
  whole point: **retire by porting, never by deleting.** The few genuinely duplicated checks were dropped
  (Suite B split-view, Suite C's feature matrix — both already covered inline) and two cosmetic ones were
  accepted as lost (the lime play-ring *colour*, and `viewport fills` which R7/R10 now cover).
- ⚠️ **`PROFILE_SYNC_SPEC.md` was considered for retirement on 2026-10-16 and KEPT.** Every step is built (1, 3–6,
  7, 8; step 2 was cut), so it looks the same as the two above — but it is **not** the same. §13 carries a
  **"Deferred to a later release"** list that is live scope, not history: **merge import** (§8), **web
  export/import** (§7), **timestamps + tombstones** (§4.3, kept deliberately as the record *for* merge/sync), and
  **folder / WebDAV / cloud sync** behind the `ProfileTransport` boundary (§2). Two §13 rows are also still
  unverified (the Android SAF **import** half; profile-from-import uploads deletion). And `HOTKEYS_SPEC.md` — still
  `planned` — cites it in ~10 places and leans on §8, §9.2, §9.3 and §10. 💡 **"Every step is checked off" is not
  the test for whether a spec is obsolete; the unchecked boxes decide it.**
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
| **`.-20261021-223728`** | **255** (VERIFY OK, 62.8 MB) | **the keeper** as of 2026-10-21, taken after `01c8440` so it matches the pushed HEAD. Count it with `Get-ChildItem -Recurse -File -Force`: without `-Force` the hidden `public/assets/desktop.ini` is missed and you get 254 |
