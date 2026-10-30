# Project State

🔓 UNCLAIMED — last holder: Codex (2026-10-30 23:19)

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

## Android release preflight

`android-preflight.ps1:1` works on Windows PowerShell 5.1 and PowerShell 7.
Default inspection needs no Studio/device and changes no configuration. Explicit
`-Build` (line 99) runs the local Tauri ARM64 release build, refuses concurrent
Android pipelines, saves live stdout/stderr, retains native exit status and stops
only its own process tree on timeout (900s default). `-ApkPath` verifies package,
version and signature/certificate (line 146); it never reads signing credentials.
README.md:122 documents use; e2e/android-preflight.check.ps1:1 is registered as
an additional AGENTS.md gate. App UI/runtime code and existing Android edits unchanged.

Verification (all completed 2026-10-30):
- Pre-change backup 20261030-224554 VERIFY OK 452/452,54.5 MB (0).
- Lint 0 errors/2 baseline WARN (0); Vite build PASS (0), existing import warning.
- Coverage OK, 28 shipped features covered (0); --update reviewed: 0 suite ID changes.
- Node: profileBundle 46/46, profileStorage 35/35, bundleGuard 20/20, keys OK,
  fadeMath 46/46, soundFiles 32/32, iconPrep 35/35, snapshotUploads 19/19 (all 0).
  Snapshot check needed a host retry after the sandbox failure.
- Web 316 PASS/0 FAIL/0 WARN (0); Windows 333/0/3 expected WARN (1);
  Android 323/0/3 expected WARN (1). Windows six keys verified FROM DISK and zero
  uploads restored; Android 28 keys restored/verified. Native gates ran via Explorer.
- Checker default 24/0/1 (1); explicit release 27/0/1 (1), native build exit 0.
  APK output: src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release-unsigned.apk,
  SHA256 9FE054E480EE7F281C479354555D1BECACB98C7A7EEDD039E1A4BD89A7A91374.
  Identity/version match; explicit signature inspection correctly rejects unsigned
  output: 26/1/0 (2). No signed release was produced or signing credentials accessed.
- Extended fault tests 16/16 (0) on BOTH PowerShell 5.1 and 7: original exit/error,
  zero-exit/no-artifact refusal and hung-build timeout. Basic suite is 9/9 (0).
  Initial 5.1 extended attempt was correctly blocked by active Android E2E;
  rerun after pipelines finished passed. A sandbox 5.1 attempt was policy-blocked.
- Initial unbounded probe was manually stopped during Rust compilation (native 1,
  checker 2); it was not proof of a build defect. Added timeout/live logs; final
  bounded probe succeeded. Separate reported Android problem is not declared fixed.
Evidence: logs/keep/android-preflight-20261030/. No user hand-test required for
internal tooling. No task-owned emulator/pipeline or listeners on 5173/5183/5233/
9222/9224/9225 remain. Unrelated Android gradlew.bat/settings.gradle and untracked
.gitattributes remain untouched. Final backup 20261030-231749 VERIFY OK 749/749,55.9 MB (0). Implementation baa1dea43e69de9d06c99a2710eaa64774d91bc2 pushed to origin/mobile-support; git ls-remote matched. Audited older backups against tracked paths and working tree including untracked files; preserved 10 differing entries under logs/keep/android-preflight-prune-20261030-231846/, removed two older backups, and rehashed all 749 keeper files. Only newest 231749 remains. Subject complete; final housekeeping postdates keeper intentionally and is committed separately.
## Mobile sizing parity

Mobile cards now use the same 140 * boxSize width and flex wrapping as desktop/web,
including split view (src/App.jsx:4840,5466,6063). Mobile edit buttons use
round(max(22,26*boxSize)), icons round(max(8,10*boxSize)) (4815–4820): default
26/10, minimum 22/8, no upper cap. Desktop/web retain their existing size limits.
Mobile actions remain always visible. User hand-tested and accepted both card
sizing and the final smaller mobile edit-button proportions.

Shared B6 verifies eight card/volume-row widths; B2 measures 252px at size 1.8;
B5/H11 check platform button proportions; mobile M6/scroll R2 expect wrapping.
Manifest reviewed: only B6 added. Latest verification:
- Lint 0 errors/2 baseline warnings (0); build PASS (0); coverage OK (0).
- Eight Node checks: 46/46,35/35,20/20,keys OK,46/46,32/32,35/35,19/19 (all 0).
- Web 316 PASS/0 FAIL/0 WARN (0); Windows 333/0/3 expected WARN (1).
- Android 323/0/3 expected WARN (1). Initial IP18 crop-save failure passed on
  unchanged retry; evidence retained. Windows six keys/uploads restored and
  verified FROM DISK; Android 28 keys restored/verified.
Evidence: logs/keep/mobile-button-proportions-20261030/ and mobile-sizing-20261030/.
Native suites launch through Explorer desktop shell to avoid inherited MSIX
zero-byte native-upload failures, as documented in session history.

Implementation 95c67e6c50c06b0aa83eacbeca3ad520989671b2 pushed to origin/mobile-support;
git ls-remote matched. Final backup 20261030-034838 VERIFY OK 412/412,47.5 MB (0);
all 412 keeper hashes verified after pruning. Only the backup command's own
in-progress capture differs from its finished working-tree capture, as expected.
After verified push, audited all eight older backups against working-tree files
(including untracked) and tracked Git content; preserved 35 unique versions in
logs/keep/mobile-sizing-prune-20261030/ with manifest, reverified redundancy before
each deletion, and removed eight backups. Only newest 034838 remains.
Final bookkeeping postdates keeper intentionally; no recursive backup cycle.
Subject complete; final bookkeeping commit follows. Unrelated Android gradlew.bat,
settings.gradle and untracked .gitattributes remain untouched/uncommitted.
Existing emulator preserved; no listeners on 5173/5183/5233/9222/9224/9225.

## Log housekeeping

Manual captures belong in ignored `logs/`, with timestamped names (AGENTS.md:5,
docs/logs.md). 22 root logs moved to `logs/keep/legacy-root/`, SHA256 verified;
zero original logs deleted. `clean-logs.ps1:1` previews direct .log files older
than 30 days; -Apply deletes candidates. It never traverses subfolders or links.
Latest verification evidence is protected in `logs/keep/verification-20261030/`.
Preview/-WhatIf/apply retention checks passed (old removed, recent preserved).
No app UI changed; user hand-test is not required for this housekeeping.

Pre-change backup 20261030-012248: VERIFY OK 265/265, 40.8 MB (0).
Lint 0 errors/2 baseline warnings (0); build PASS (0); coverage OK (0).
Node checks: profileBundle 46/46, profileStorage 35/35, bundleGuard 20/20,
keys OK, fadeMath 46/46, soundFiles 32/32, iconPrep 35/35,
snapshotUploads 19/19 (all exit 0; snapshot needed host retry after EPERM).
Final E2E: web 315/0/0 (0), Windows 332/0/3 (1), Android 322/0/3 (1).
Windows six storage keys restored and verified FROM DISK; uploads restored.
Android 28 keys restored/verified. Sandbox/host attempts failed or were interrupted;
Explorer sequential web/Windows retries passed without app/harness changes.
Their failed logs and diagnostic detail are retained in session history/logs.
Only preview listener 5233 remains (HTTP 200, PID 40516; launcher PID 41876).
Existing emulator preserved; test ports 5173/5183/9222/9224/9225 closed.

Final backup 20261030-020121: VERIFY OK 284/284, 43.4 MB (0), hashes verified.
Implementation 97145201df514da27929c5fd39d03c5b4616a857 pushed to origin/mobile-support;
git ls-remote matched. Removed both older backups only after verified push and
content audit. Kept newest 20261030-020121. Preservation manifest maps 52 differing
paths; six unique older contents saved under logs/keep/backup-prune-history-20261030/.
Audit caught a post-audit history change and paused before deleting that backup;
additional content was preserved/reverified before the second deletion. Audit
manifest, preview runtime captures and final bookkeeping postdate keeper by design.
Unrelated Android gradlew.bat/settings.gradle and untracked .gitattributes remain
untouched/uncommitted. Subject complete; final bookkeeping commit follows.

## Android release workflow

Signed APK generation previously succeeded. The previously recorded signed APK path is currently absent; the preflight section above records the current unsigned output. Previously verified APK package `com.thespellcaster.mrhorakhty` and v2
signature verified by aapt2/apksigner (exit 0), file `app/universal/release/app-universal-release.apk`.
User added its actual signing certificate to the registered package; Google Play Console
reports **In review**. No further key/account action by this agent is pending; do not
change keys to make an existing APK match a different certificate. APK certificate:
`6E:E2:C6:2B:43:4B:A6:A6:A1:D6:63:A0:60:D4:A1:56:49:41:26:A2:5D:CF:55:48:0A:78:3E:D2:0C:3C:F3:C8`.
AAB package-only status and APK certificate-aware registration are different checks.
No private keys/passwords were read, changed or uploaded by the agent.

`Open Android Release.bat` (CRLF, root) refuses an existing Studio (host --check exit 2)
and refuses an unsuccessful process check (sandbox --check exit 4). It prepares release
APK/AAB and opens Studio through Tauri; leave its console open through signing.
Do not repeatedly auto-launch Studio from Codex or reset settings/delete IDE locks.
The observed DirectoryLock/CannotActivate error did NOT prove a hung IDE: PID 27324
was responding normally; an additional instance failed to activate it. Healthy Studio
was preserved; agent-owned companions were stopped. Computer Use was user-stopped.

`BuildTask.kt:20` prefers npm.cmd on Windows, retries failures to START only, and
propagates nonzero exits outside fallback handling. Previously a real CLI/linker error
was hidden by a later missing npm.bat. Verified helper compile and real failed Gradle
handoff preserved linker cc-not-found; full CLI release builds succeeded for four ABIs.
No application UI/playback/permission code changed. User confirmed signed generation;
launcher guards checked, but no claim of an additional launcher hand-test.

Finishing explicitly requested. Verified changes: helper, launcher, README, release-output
ignore rule, state/history; unrelated .gitattributes excluded. Signed APK/artifacts remain
on disk, ignored against accidental commit. No signing session/test-port listeners at
fresh gate dispatch. Pre-finish backup …-20261028-004605: VERIFY OK 260/260, 40.8 MB (0).
Fresh lint 0 errors/3 accepted warnings (0), build PASS (0), coverage OK (0);
eight Node checks 46/46, 32/32, 20/20, keys OK, 46/46, 32/32, 35/35, 19/19 (each 0).
Fresh full gates completed in order via existing Explorer desktop outside Codex MSIX virtualization:
Web **290/0/0** (0), Windows **307/0/3** (1), Android **297/0/3** (1).
Logs: e2e-run-20261028-004702.log, e2e-run-20261028-005309.log,
e2e-android-20261028-010009.log. Windows uploads restored (zero original files), six
localStorage keys restart-verified; Android restored/verified 30 keys. Expected native
WARNs retain their assertions; no failures. Runner-owned app/emulator/forwards cleaned up.
Process/port audit and helper-recovery SHA check clean. Studio is user-owned and untouched.
Focused real-Gradle regression PASS: invalid target produced expected Gradle exit 1,
original CLI error preserved without npm.bat fallback. Initial scratch probe applied to
buildSrc incorrectly; corrected before successful verification; temporary init removed.
No new test IDs; coverage manifest/code wiring remains OK. No app UI/playback/permission
change, so no new app-feature hand-test was required. User signed-generation confirmation
and APK signature verification are the relevant manual result.
Final backup …-20261028-011044 verified 265/265 files, 40.8 MB (exit 0). Final metadata notes postdate keeper. Studio PID 7948 remains responding and untouched. Implementation bd219b9 pushed and remote-verified; six older folders audited/pruned, preserving 26 versions/11 contents. Keeper 265 hashes rechecked; no backup-only path. Final bookkeeping notes postdate it.

## Application identity

Application ID is `com.thespellcaster.mrhorakhty`; Android debug adds `.debug`.
Display name remains **The SpellCaster**. Old native installs/data remain under
`com.mrhorakhty.thespellcaster`; no automatic migration or deletion was performed.
Web localStorage remains under its browser origin; user confirmed it is intact.
User manually verified the renamed app opens and plays correctly on 2026-10-27.
Android Studio was resynced with Gradle on 2026-10-27; Modules → app → Default Config
visibly shows the new ID. User confirmed the delayed sync resolved their signed AAB/APK concern.
Fresh release APK/AAB use the new ID; user signed APK verified. Actual certificate registration is in Google review.
Debug output metadata has the new .debug ID. No app code/config changes were needed for Studio sync.

Sources: `src-tauri/tauri.conf.json:5`; Android `app/build.gradle.kts:18,21`;
`app/src/main/java/com/thespellcaster/mrhorakhty/MainActivity.kt:1`; both buildSrc
helpers moved to matching paths; `Run Android.bat:48`; `e2e/e2e-android.ps1:32`.
Old source-package paths are ignored against revival. Historical old-ID references stay in session history.

## Sound editor and live reordering — complete and user accepted

- User accepted the prior editor UI batch on 2026-10-30, then requested these
  follow-ups. All are implemented: Animate Sound Reordering is now a title-cased
  switch, desktop/web action buttons scale with box size (22–44px, icons 12–24px),
  mobile retains 26px/10px, and a lifted sound follows mouse/finger while its
  same-board neighbors move aside. The app animation preference is unchanged,
  default ON and global across profiles, independent of OS motion preferences.
- Live drag uses an inert clone and destination placeholder, with DOM transforms
  for preview only. The persisted order changes once on valid release. Escape,
  pointer cancellation, blur, resize, leaving the source board and unmount cancel
  safely. Wrapped rows and edge auto-scroll are covered. No per-pointer writes;
  only affected neighbors animate. With animation OFF, following and immediate
  repositioning still work. Cross-container dragging remains excluded.
  Code: src/App.jsx:4681 (drag lifecycle), :2589 (drop commit), :4815 (action sizes),
  :7484 (switch). Obsolete drag-target ring state/listeners removed; unused ev
  warning disappeared with them. AGENTS lint baseline is now 2 warnings.
- Prior accepted controls remain: Random/Loop above file list, Glow below Tint,
  independent optional glowColor with legacy tint fallback and native bundle
  persistence, hue picker, Use as is wording. No dependency/data-version change.
- Tests: shared X6–X14 + B5 added to the prior H9–H13/X3–X5/IP29 UI coverage.
  New Live sound reordering feature registered. Cancellation labels were made
  literal so X9–X11 are inventoried; ID diff reviewed. Final inventory is 42 suites,
  447 IDs, 28 shipped features covered (0). Focused mouse (X1–X14/B1–B5) and touch
  (X1–X14) checks both had 0 failures. Existing checks remain intact.
- Final gates: lint 0 errors/2 accepted warnings (0); build PASS with known
  dynamic-import warning (0); coverage OK (0). Eight Node counts: profileBundle
  46/46, profileStorage 35/35, bundleGuard 20/20, keys OK (0 problems), fadeMath
  46/46, soundFiles 32/32, iconPrep 35/35, snapshotUploads 19/19 (each exit 0).
  Web 315 PASS/0 FAIL/0 WARN (0), Windows 332/0/3 (1), Android 322/0/3 (1).
  Expected native WARNs are retained. Logs in Windows Temp/opencode:
  e2e-run-20261030-002656.log, e2e-run-20261030-003416.log,
  e2e-android-20261030-005957.log. Windows original zero-file uploads restored;
  9 keys verified after restart. Android original 27 keys restored/verified.
- Android startup race fixed in e2e/e2e-android.ps1:169/:186: record previous app
  PID and wait for a fresh PID before snapshot/seeding; polling also clears stale
  PID values. Actual regression: old PID6246 was attached before installPackageLI
  replaced it after seeding. Original 27-key snapshot was restored and independently
  read back exactly before retry. Recovery file is under LOCALAPPDATA/opencode/
  e2e-snapshots/android-recovery-20261030-004209.json (SHA256
  5FE976593DFBAF7C11D4116B9B0B017E0223826FDAE6667F4CAACD9A393B8968).
  Fresh-PID guard was exercised with existing PID10851 → new11186. Runner syntax
  parse passes. Failed attempts are archived, not counted as successful gates.
- One Android retry had IP20/IP21 icon assertion failures. Added pixel/reference
  diagnostics without changing either assertion, timeout or icon implementation.
  Focused native icon suite then passed 0 FAIL, restored original 27 keys in finally;
  final full Android also passes both. Their earlier cause was not established.
- Final review removed an inert leftover CSS class token; no behavior changed.
  Lint/build/coverage/eight Node checks repeated successfully after that cleanup.
  Visual QA inspected live-drag and switch screenshots in this chat's visualization
  directory (live-sound-drag-20261030.png, reorder-switch-20261030.png).
- Pre-follow-up backup 20261030-000804: VERIFY OK 265/265, 40.8 MB (0). Final backup 20261030-011253: VERIFY OK 265/265, 40.8 MB (0). Backup-result notes postdate the snapshot. User confirmed all follow-ups work on 2026-10-30. All gates and both hand-tests are complete. Acceptance backup 20261030-011909: VERIFY OK 265/265 files, 40.8 MB (exit 0). Implementation 49b7da0333cb304634407026347a468bde72d4a3 pushed to origin/mobile-support; exact remote SHA verified. Six older backups audited/pruned, preserving 60 differing versions as 32 unique contents; zero backup-only paths. Sole keeper 20261030-011909 reverified across all 265 hashes. Recovery ZIP and audit/result manifests: C:/Users/emire/AppData/Local/opencode/backup-prune-history/*49b7da0-20261030-ui*. ZIP SHA256 8b200ddd7981528c414839f13d9e5a11b22d88f85336094e46df4a8092fd8dd1. Final bookkeeping notes postdate keeper; no additional backup needed solely for pruning notes.
- Only intentional built preview 127.0.0.1:5233 remains (PID39848, exec session49112,
  host HTTP200). QA browsers/recovery servers/owned port mappings removed. Existing
  emulator-5554 was already running before tests and is left untouched. Unrelated
  Android gradlew.bat/settings.gradle and untracked .gitattributes remain preserved.
  The separate Android release/build issue has NOT been declared resolved.

## Maintenance — complete and user accepted

- Git integrity repaired by refetching `origin/mobile-support` objects: historical blob
  `3d1fcf151b7e70470a24f58c83cd6d6b42a64182` (old e2e-full.ps1) restored exactly.
  Repair verification: `git fsck --full --no-dangling` exit 0; rev-list traversed 1538 objects. No history rewrite.
- New sounds now retain `glowEnabled`/`glowProminence` in `src/App.jsx:2317`.
  Numeric zero remains zero in glow rendering (:691) and editor hydration (:2216).
  Shared `e2e/specs/soundintogroup.mjs:80` onward adds H3–H8; registered and linked
  to the existing Card indicators feature. No new persisted keys or dependencies.
- Web E2E setup `e2e/e2e-full.mjs:76` bypasses network cache only for the isolated web
  session after CDP captured `net::ERR_CACHE_READ_FAILURE` on bundled MP3 HTTP 206.
  Assertions retained; native behavior unchanged. Earlier failed attempts and diagnosis
  are archived in session history. Final web 296 PASS/0 FAIL/0 WARN (suite/wrapper 0),
  Windows 313/0/3 (1), Android 303/0/3 (suite/script 1; parent capture hung after child exit).
  Logs: e2e-run-20261028-020137.log, e2e-run-20261028-013701.log,
  e2e-android-20261028-014424.log under normal Windows Temp/opencode.
- Lint 0 errors/3 baseline warnings (0); build PASS (0); coverage 42 suites/428 IDs,
  26 shipped features covered (0). Node checks: 46/46, 32/32, 20/20, keys OK,
  46/46, 32/32, 35/35, 19/19 (each 0). Intended-file diff whitespace check passes.
  Windows original uploads restored (zero files), six keys verified after restart;
  Android original 30 keys restored/verified. Runner emulator/forward cleanup completed.
  Temporary parent launcher 42912 was stopped after native children exited and ports closed. Final audit identified initial headless test Edge 42972 (started 01:23) still alive after runner cleanup; exact test-profile command verified and its tree stopped. Sandbox preview 36320 replaced by host preview; only 5233 listens, no 5173/5183/9224/9225/9333 listeners.
- Pre-change backup 20261028-012115: VERIFY OK 265/265, 40.8 MB (0).
  Keeper backup 20261028-022427: VERIFY OK 265/265, 40.8 MB (0), all 265 hashes rechecked after pruning. Earlier 020925 backup was verified then audited/pruned. Final housekeeping metadata postdates keeper. Built web preview intentionally running on 127.0.0.1:5233
  (PID 7816, exec session 19934, HTTP 200 from host) for manual testing. User confirmed the web build retains glow on 2026-10-28 at this finishing turn.
  Subject and hand-test complete. Implementation ba2c64adf087ede47dabe05f19c1fe5bb484af29 pushed to origin/mobile-support and remote SHA verified. Three older backups audited/pruned after preserving 14 differing versions as 10 unique contents; zero backup-only paths. Sole keeper 20261028-022427 reverified. Recovery ZIP and audit/result manifests: %LOCALAPPDATA%/opencode/backup-prune-history/*ba2c64a-20261028-maintenance*. Final bookkeeping follows in a docs commit.
- Preserve/exclude unrelated `.gitattributes` and user-confirmed concurrent edits to
  Android `gradlew.bat` / `settings.gradle` (ANDROID_PREFS_ROOT handling). Native E2E ran
  with those edits present. User explicitly says their separate Android build problem
  STILL EXISTS despite a supplied report claiming resolution; do not claim it fixed or
  pursue that subject here. Android edits under gen remain outside project backups.

## Open items

No export/import defect remains open from the fade work: the user confirmed export and re-import work on
2026-10-25. Per-file fades, Play Until, loop seams, volume, priming, move/copy and profiles v1 are shipped.

| Priority | Work | Status / constraint |
|---|---|---|
| 1 | [Hotkeys](HOTKEYS_SPEC.md) | Planned, **not authorized for implementation**. Bindings belong to profiles; use the profile reference rules and route triggers through `playWithPrimes`. Suppress shortcuts while editing text. |
| Deferred chain | [Profile sync §13](PROFILE_SYNC_SPEC.md) | **Timestamps + tombstones → Merge import → folder/WebDAV/cloud sync** behind `ProfileTransport`. Timestamps were deliberately cut from v1; merge/sync are unsafe without them. Do not reorder or implement unasked. |
| Independent deferral | Web export/import | First move web audio out of localStorage into real file storage; current base64 storage is quota-limited. Native export/import does not imply web support. |
| Other deferred work | Wake lock; fullscreen guard; iOS | iOS needs macOS. Signed APK generation is verified; developer-verification certificate review is pending externally. No additional implementation authorization implied. |
| Other deliberate exclusions | Cross-container drag, whole-container move/copy, creating containers from the transfer picker, atomic cross-slice persistence | Existing move/copy does not include these. Atomic persistence requires storage design work. |
| Other deliberate exclusions | Per-container/group default volume, pan/balance, MIDI/CC; expanded priming | A group default volume needs a profile-storage census. Priming exclusions and rejected saved layers are below. |
| Native debt | Android `onRenderProcessGone` | Previous investigation found no supported hook in the generated wry WebView client; an upstream change or vendoring would be needed. Do not repeatedly edit generated code expecting a lasting fix. |

`PROFILE_SYNC_SPEC.md` remains live because it holds future scope and hotkey dependencies.
Its **v1 §13 checklist is complete**, including native pickers and Android same-device round trip;
older state notes claiming otherwise are superseded. `FADE_SPEC.md` is a shipped design record, not work waiting to be built.
The playback gaps once listed for Z13–Z21 are closed; Z22 covers the loop fade-out ramp.

## Repository and working tree

- Current sound-editor/live-drag work is complete and user accepted; implementation 49b7da0 pushed/remote-verified, final verified backup retained and six older folders audited/pruned. See current section above. Preserve the two user-owned Android files and .gitattributes.


- Current maintenance implementation ba2c64a is pushed and remote-verified: App.jsx, shared soundintogroup tests, web E2E cache setup, coverage manifest, state/history. Final housekeeping is a following docs commit; use git log for latest HEAD. User-owned Android build edits and .gitattributes excluded.


- Branch `mobile-support`; previous identity/sync work through `02ae174` is pushed.
  Completed changes: Gradle error propagation fix, guarded root release launcher,
  README workflow, signed-output ignore rule, state/history. All applicable gates passed;
  implementation commit `bd219b9e788bd9f69a4237d6749b0cfdb9e42a59` is pushed to origin/mobile-support and remote SHA verified.
  Final housekeeping is a following docs commit; use git log for latest HEAD.
- **Unrelated untracked `.gitattributes` is preserved and excluded.** It contains only
  `*.bat text eol=crlf`; do not sweep it into this commit or broaden it casually.
- Signed APK `src-tauri/gen/android/app/universal/release/app-universal-release.apk`
  stays on disk and is now ignored. No keystore, credential or signed artifact is staged.
- Personal `/scripts/` remains user-retired/ignored; recovery archives below are retained.
- User prefers root BAT launchers. `Open Android Release.bat` is guarded and CRLF;
  existing Build/Run Android scripts remain available. No Studio reset or lock deletion.

## Finishing status

Current UI follow-ups complete: automated gates and user hand-test pass. Implementation 49b7da0 pushed/remote-verified; final keeper 20261030-011909 (265 files, 40.8 MB), six older folders audited/pruned with differing versions archived. User-owned Android files/.gitattributes remain uncommitted. Built preview on 5233 and pre-existing emulator remain available. Claim released; final bookkeeping committed separately. Earlier maintenance results follow.


Earlier maintenance complete: all automated gates pass and user confirmed glow retention in the web build. Implementation ba2c64a pushed/remote-verified. Three older backups audited/pruned, keeper 20261028-022427 (265 files, 40.8 MB). Unrelated Android edits/.gitattributes remain; preview stays on 5233. Claim released. Previous Android release finishing result follows.


Local signing/build subject is complete: user generated a signed APK; package and v2
signature verified. Actual certificate registration is **In review** externally in Play
Console, per user report. Do not change keys or claim Google review has completed.

Fresh gates: lint 0 errors/3 warnings, build/coverage PASS, eight Node checks all pass;
Web 290/0/0 (0), Windows 307/0/3 (1), Android 297/0/3 (1). Windows disk restoration
verified six keys; Android restoration verified 30 keys. Tests clean up their own app,
emulator and mappings; existing Studio is preserved. Implementation commit `bd219b9` is pushed to `origin/mobile-support` and remote-verified.
Six older backups removed after audit and preservation of 26 differing versions as 11 unique
contents. Zero backup-only paths. Sole keeper …-20261028-011044 rechecked: 265 files, 40.8 MB.
Only unrelated .gitattributes remains untracked. Final bookkeeping is a following docs commit.

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
| Icon preparation | `src/iconPrep.js` (pure segmentation/crop + canvas wrapper), `src/IconPrepDialog.jsx` (staged upload dialog) |
| Native entry points | Tauri 2 / Rust: `src-tauri/src/main.rs` (desktop), `lib.rs` (mobile), shared `scope.rs` |
| Android entry/config | 50 tracked files under `src-tauri/gen/android/`, including hand-maintained `MainActivity.kt`, Gradle config and manifest |
| App identifiers | Windows/native storage: `com.thespellcaster.mrhorakhty`; Android debug: `com.thespellcaster.mrhorakhty.debug`. |
| Version | App version comes from `package.json` via `__APP_VERSION__` in `vite.config.js`; do not hardcode it. |
| Useful current symbols | `mapSoundContainers` App.jsx:827; `patchSoundById`:1938; `allSoundContainers`:2632; `removeFileIfUnreferenced`:2818; `playWithPrimes`:4447. Re-find symbols before editing; old spec line numbers drift. |

## Architecture gotchas — do not regress these

### Profiles, storage and ownership

- Board keys are `profile:<id>:<key>`. Use `profileStorage.js` for reads, writes, removal **and enumeration**.
  Board keys include `ttrpg_characters`, **`ttrpg_environment` (singular)**, `ttrpg_groups`,
  `ttrpg_data_version`, the two `ttrpg_*_icon` keys, `boxSize`, `backgroundSettings` and web `sound_file_*` keys.
- **Five global keys are intentional**: `spellcaster_profiles` (index), `localStorageMigrationCompleted`
  (device migration), `spellcaster_import_backups` (last 3 replace snapshots), and `spellcaster_import_notice`
  (read-and-removed after remount; an import may create its target profile). Keep the shared
  `KNOWN_KEYS` in `e2e/lib/page.mjs` current. `spellcaster_reorder_animation` is the fifth global key: an app-installation UI preference shared by profiles and excluded from bundles. The harness's `ttrpg_themes` seed is not an app storage feature.
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

### Icon preparation — shipped and user accepted 2026-10-27

- Sound-icon upload only: three opt-in choices, no default — Use as-is / Crop to square / Make silhouette.
  Selections/previews stay temporary; Confirm awaits successful storage before updating the editor.
  Save commits the reference and removes an old upload only if no other sound refers to it. Cancel keeps the saved sound.
  No persisted sound fields were added; iconDisplayName continues to mark uploaded provenance for bundles.
- Use-as-is preserves exact bytes/type. Crop makes a 256px PNG with original colours. Silhouette uses border-median
  distance, Otsu/smoothstep and four-neighbour components ≥2% of the largest, neutral RGB 106 and 20px padding.
  Respect existing alpha; transparent borders reuse it. A valid empty result is still confirmable; no quality gate.
- Crop draws a persistent canvas from one decoded File; no decode/PNG encode during gestures, no preview unmount
  or dialog-height jump. Encode only on Confirm. Dimmed crop exclusions plus a 48px card-size result preview.
  Zoom 100–800% shares one state across slider, buttons, wheel/pinch and keyboard. No inherited card drag/prime behavior.
- Weak per-File cache handles StrictMode replay. Silhouette output is reused after Back and URLs revoked on unmount.
  Initial silhouette generation still performs pixel processing/encoding; user observed and accepted the mobile wait.
  Desktop synthetic segmentation median 45.87 → 6.38 ms (7.19×), 17 masks unchanged; no phone multiplier promised.
- Code: src/iconPrep.js:71 (segmentation), :130 (decode cache), :152 (crop drawing), :161 (wrapper);
  src/IconPrepDialog.jsx:4; App.jsx:3115 (confirm) / :3169 (strict storage). ICON IP0–28 and iconPrep 35/35 cover it.
- Two 256px example inputs cost 18,448 bytes. Shipped icons were not reprocessed; the user retains the batch pipeline as a separate personal tool; the former scripts/ copy is removed. Group-nested tint/load coverage remains a pre-existing gap. Existing-icon editing, gradient
  removal, classifiers, algorithm-tuning controls and bulk conversion remain outside this feature.
- Complete design and measurements: docs/session-history.md, “Accepted icon preparation: final design archive”.
  ICON_PREP_SPEC.md is retired and ignored; do not resurrect it. Coverage manifest spec is null.

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
  Upload-time icon preparation addresses this with an opt-in silhouette; user accepted 2026-10-27.
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
  Entry points: `e2e-full.mjs` / `e2e-mobile.mjs`; 14 shared specs plus `e2e/lib/` plumbing.
  Old `run` / `features` suite flags are retired.
- Coverage has **suite and feature registries**. Register new work as planned when starting;
  shipped features need coverage or an explicit visible gap. After test-ID edits run
  `node e2e/check-coverage.mjs --update` and review the ID diff. Check used prefixes before choosing new ones.
  Add new Node checks to AGENTS gate 5 in the same change.
- Run all eight Node checks, even if one fails. Browser specs cannot cover a never-settling post-picker promise
  or a cancel after completion; `bundleGuard.check` supplies that coverage.
- **Windows tests touch the user's real storage and uploads**, shared by installed/dev app.
  Runner snapshots uploads before launch, restores afterward, gracefully closes WebView2, restarts
  and compares the store **from disk**. A page-level “restored” log is not disk persistence.
  Upload snapshots must abort safely on failure. Unmarked empty/missing/corrupt snapshots refuse restore (exit 4).
  New snapshots have a `.state.json` sidecar recording original absence/existence and file count; validated
  empty snapshots restore the original empty/absent state. `snapshotUploads.check.mjs` covers 19 cases.
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

Commands and reporting rules live in [AGENTS.md](AGENTS.md). Results below freshly verify the release-helper/launcher follow-up before the requested finishing workflow.

| Gate | Release follow-up result | Exit |
|---|---|---|
| Final backup | `…-20261028-011044`, VERIFY OK 265/265 files, 40.8 MB; final notes postdate keeper | 0 |
| Lint | 0 errors / 3 accepted warnings | 0 |
| Build | Success; existing ineffective-dynamic-import warning | 0 |
| Coverage | 42 suites / 422 registered IDs; 26/26 implemented features covered; one planned, no gaps | 0 |
| Node checks | profileBundle 46/46; profileStorage 32/32; bundleGuard 20/20; profile keys OK; fadeMath 46/46; soundFiles 32/32; iconPrep 35/35; snapshotUploads 19/19 | Each 0 |
| Web E2E | **290 PASS / 0 FAIL / 0 WARN**; `e2e-run-20261028-004702.log` | 0 |
| Windows E2E | **307 PASS / 0 FAIL / 3 baseline WARN**, restore restart-verified; `e2e-run-20261028-005309.log` | 1 |
| Android E2E | **297 PASS / 0 FAIL / 3 baseline WARN**; `e2e-android-20261028-010009.log`; 30 keys restored and verified | 1 |
| User verification | Signed APK generated by user; package/signature verified (apksigner 0). No app UI feature changed; no additional UI hand-test required | PASS |

Focused ICON: **28 PASS / 0 FAIL**, exit 0. IP23–28 cover the reported regressions: slider synchronization,
stable canvas/dialog dimensions, zero encode/decode during slider gestures, card-size preview/dimmed crop frame,
and reusing decoded/prepared images. Pixel-loop optimization matched 17 old masks exactly; desktop median
45.87 → 6.38 ms on the same synthetic 512px workload, not a claim about phone speed.
Native G5/G6b/G7b warnings remain expected; **0 FAIL** is the healthy signal.

## Operational warnings and known environment facts

- Use UTF-8 explicitly when reading/writing. Older PowerShell BOM-less defaults corrupted Unicode in App.jsx.
  Prefer edit tools or explicit `ReadAllText`/UTF-8 `WriteAllText`; do not bulk round-trip source through default
  Get-Content/Set-Content. Check diffs and encoding after edits. BAT working files must remain CRLF.
- Native dev commands watch indefinitely: launch hidden/detached and inspect logs.
  Desktop user launch: `Run Tauri.bat`; web: `Run.bat`; `Build.bat` builds web.
  `Build Android.bat` builds/reinstalls/runs; `Run Android.bat` opens the installed app and starts Vite if needed.
  Both are tracked root scripts; do not use the retired generated `Run App.bat`.
- Android dev apps need Vite alive on **5173**. A standalone `tauri android build --debug` instead bundles assets.
  The E2E runner uses `--host 127.0.0.1` and ADB reverse **5173/5183** for frontend/HMR.
  It preserves compatible existing mappings and removes only mappings it creates. Avoid `--host 10.0.2.2`:
  that address exists inside the emulator, cannot bind Windows HMR, and stalls the CLI frontend probe.
  No VPN or persistent environment changes were made.
- **Codex MSIX virtualization can invalidate Windows native test results.** Its child processes may see
  profile directories canonicalized into `OpenAI.Codex.../LocalCache/Roaming` while the AppData scope resolves
  to ordinary Roaming. This caused permission errors and icon/bundle failures; normal user BAT launch worked.
  Run the gate from the existing Explorer desktop object (`Shell.Application.Windows().FindWindowSW`
  with SWC_DESKTOP=8, then `Document.Application.ShellExecute`), hidden. A newly instantiated Shell.Application
  alone still inherited package context. Do not widen app permissions to mask this environment problem.
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
- The real Windows localStorage is under `%LOCALAPPDATA%/com.thespellcaster.mrhorakhty/EBWebView/Default/Local Storage/leveldb/`.
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

- **Keeper: `…-20261028-011044`, 265/265 files, 40.8 MB, VERIFY OK (exit 0).** Six older backups removed after verified push and audited preservation; exactly one remains, all 265 hashes rechecked. Final housekeeping notes postdate keeper. Includes helper recovery log; gen itself excluded.
- **Release-workflow recovery archive**: `%LOCALAPPDATA%/opencode/backup-prune-history/preserved-before-prune-bd219b9-20261028-release.zip`.
  26 differing older versions / 11 unique contents, all entries round-trip/hash verified.
  SHA256 `2e56a8e66272e1ef6429844667c92942293c0a935040ab158ae724b5ed38a4a6`.
  Adjacent audit-before-prune/prune-result JSON files and audit script retain complete inventories,
  Git-tracked/working-tree membership and final verification. Keep all recovery archives.
- **Studio-sync recovery archive**: `%LOCALAPPDATA%/opencode/backup-prune-history/preserved-before-prune-9c2dfcf-20261027-studio.zip`,
  two differing doc versions, all ZIP entries verified; SHA256
  `ef38d09d5b5354f8211391dbb90acd9a57d0910804fb95e4dd75d3df1804c111`.
  Docs commit `9c2dfcf` was pushed/remote-verified before removing one older backup.
- **Rename recovery archive**: `%LOCALAPPDATA%/opencode/backup-prune-history/preserved-before-prune-6805cef-20261027.zip`.
  38 older versions / 19 distinct contents; all ZIP entries round-trip/hash verified.
  SHA256 `33983ee80b948c818da517c2e36e9d3ba81a119433aeebe9a058db7898e00d1e`.
  Adjacent `audit-before-prune-6805cef-20261027.json` and `prune-result-6805cef-20261027.json`
  retain inventories, Git/working-tree membership, remote SHA and final folder inventory. Keep this archive.
- Use **`backup-project.ps1`**, never bare robocopy. It copies + verifies + repairs, prints exclusions/counts,
  and enforces the 150 MB ceiling. Run before code edits and at completion; full rules are in AGENTS.
- Includes source/docs/tests and `public/assets`; excludes node_modules, dist, .git, target and gen.
  **gen is not wholly regenerable**: backups omit 50 tracked Android files, including MainActivity.
  Git/pushed copies protect them; do not put new hand-maintained files only in generated/ignored locations.
- `public/assets` has **73 tracked files (52 audio / 21 images)**, ~29 MB. They were clone/build-verified after
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
- **Personal-tool/research recovery archive**: `%LOCALAPPDATA%/opencode/backup-prune-history/personal-pipeline-cleanup-3f2d84c-20261027-220711/preserved-before-prune.zip`
  (**24,094,933 bytes**), SHA256 `66cc21785cb754ff76d44f6177c51a8828af761ce93eefdf6e2897aa887cc904`.
  **23 distinct contents / 42 references**, including all **18 retired scripts/ paths** (23,438,950 bytes).
  Objects and manifest round-trip/hash verified before pruning. The manifest maps names to objects for restoration
  outside the app. Adjacent audit-before-prune.json / prune-result.json retain full inventories and evidence.
  Two old backups removed (132,131,353 logical file-content bytes). Keep this archive as research/tool recovery.
- **Icon-work recovery archive**: `%LOCALAPPDATA%/opencode/backup-prune-history/icon-prep-4b37c6c-20261027-211228/preserved-before-prune.zip`
  (**2,800,327 bytes**), SHA256 `1fd70c1817ab53c61df8e959931eb8dfb5b3a5fed93760ed0c9fd67aad5249cc`.
  Holds **36 distinct contents / 58 historical references**, including the retired spec (the sole backup-only path).
  Every ZIP object and manifest round-trip/hash verified. Adjacent audit-before-prune.json / prune-result.json record
  the path union, all file hashes, remote verification and final inventory. Removed file contents total 462,165,302 bytes
  (~440.76 MiB); this byte summary was corrected from stored per-file lengths after Measure-Object returned zero for
  ordered dictionaries. Counts, content preservation and SHA256 deletion guards were unaffected. Keep this archive.
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
| `ICON_PREP_SPEC.md` | User accepted 2026-10-27; complete final design archived in session history; modules/tests own the shipped behavior. |
| `RESTORE_DEFAULTS_SPEC.md`, `ICON_FEATURE_SPEC.md` | Shipped starter-merge and icon behavior; implementation/history retain design. |
| `TESTING_REPORT.md`, `TESTING_REPORT_FOLLOWUP.md`, `EDGE_TO_EDGE_REPORT.md` | Resolved audit records in git/history. |
| Old Android Java paths under `com/mrhorakhty/` (app and buildSrc) | Renamed to `com/thespellcaster/mrhorakhty/`; three tracked files moved; old paths ignored. |
| Personal `/scripts/` folder | Removed at user request 2026-10-27; app has no dependency. User keeps pipeline elsewhere; measurements/design in session history and verified recovery archive. |
| Untracked `scripts/Sound Normalizer/` | Deleted at user's request; playback volume trim supplies the wanted behavior. Do not resurrect a duplicate loudness key/feature without a new design. User retained source copies. |

The claim on line 3 is cooperative, not a mutex. Re-read before every write, never silently take another agent's
claim, release only when complete, and leave it in place on interruption. Follow AGENTS for the full protocol.
