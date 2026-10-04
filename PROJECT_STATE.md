# Project State

🔓 **UNCLAIMED** — last holder: opencode (2026-10-04 23:00). Session log: `docs/session-history.md`.
(Session ran 21:44-23:00: retire `MOVE_COPY_SOUND_SPEC.md`, revise `PROFILE_SYNC_SPEC.md`, run and revert the
Android SAF spike, fix `kill-ports.bat /emu`, commit + push. Everything finished and pushed; a shorter closing
pass 22:42-22:47 ran without re-claiming, which was a small protocol slip — docs-only, no conflict possible.)

**Read this file first.** It holds only the *current* state. Dated session-by-session detail lives in
[`docs/session-history.md`](docs/session-history.md) — read that only when you need the reasoning behind a
past decision.

**Any AI agent may edit this file, but only while holding the claim** (see *Permanent instruction: keep
`PROJECT_STATE.md` up to date* in `AGENTS.md`). Claim it as your first action; release it when the work is
genuinely finished.

Last updated: **2026-10-04**

---

## What the project is
**"The SpellCaster"** — a TTRPG soundboard where the GM assigns **sounds to Characters** and
**Environment categories**. Users play, loop, stop and reorder sounds; **move or copy** a sound between any
containers (edit mode); edit characters/categories/sounds; apply themes and a box-size (zoom) slider. A
**Tauri 2.x** shell around a **React 19 + Vite + Tailwind** SPA, ported to Android. All mobile-specific changes
are gated behind `isMobile` so desktop/web stay untouched.

## Project facts
- Frontend: React 19 + Vite, entry `src/main.jsx`, all logic in `src/App.jsx` (6240 lines, one monolithic component).
- Backend: Rust/Tauri 2.x (`src-tauri/`), `tauri-plugin-fs` (2.5.1) + `tauri-plugin-log`.
- Storage: Tauri → `BaseDirectory.AppData` via the fs plugin; web → `localStorage` `sound_file_*` data-URLs.
- Data keys: `ttrpg_characters`, `ttrpg_environment` (**singular** — not `ttrpg_environments`; this has fooled
  harnesses before), `ttrpg_groups`, `ttrpg_data_version`, plus `backgroundSettings` and `boxSize`.
  `DATA_VERSION = '3'` (App.jsx:263) — **never bump it**: the mismatch path (App.jsx:322) renames the
  user's keys to `*_old` and resets to defaults.
- Package `com.mrhorakhty.thespellcaster.debug`; `tauri.conf.json` uses `devUrl: http://localhost:5173`.
- **Do not hardcode the version** — `vite.config.js` `define`s `__APP_VERSION__` from `package.json`.

## Repo state
- Branch **`mobile-support`**, **in sync with `origin/mobile-support`** (0 ahead / 0 behind as of 2026-10-04
  23:00). The move/copy feature and the docs work are both on GitHub.
- All 7 branches were fully merged into `mobile-support` as of 2026-10-04; no unmerged feature work anywhere.
- The move/copy feature is **shipped and user-tested by hand** (2026-10-04), committed as `f7f316e`.
- Recent commits: `d698d06` "Retire move/copy spec, revise profiles spec, fix kill-ports /emu" ·
  `f7f316e` "Added ability to move or copy sounds between groups and characters etc." ·
  `2d525ed` "Changes to how agents work on the project" · `c83a72c` "More document changes" ·
  `630f28f` "Some document changes" · `8ef2c6f` "Fixing known debts".
- ✅ `backup-project.ps1`, `AGENTS.md` and the state file (then `opencode-summary.md`) are committed in `c83a72c`.
- ✅ **Working tree clean and in sync with origin** as of 2026-10-04 23:00 (after `d698d06`).
- ⚠️ **The `post-commit` git hook is decorative and prints a false "backup" message.** On every commit it
  echoes `=== TTRPG Soundboard Backup Log ===` with `Backup location: %cd%` — i.e. the *project directory*, not
  a backup folder. **No backup is created.** `.git/hooks/post-commit.bat` is 6 lines of `echo` and nothing
  else. Do not read that output as "the commit was backed up" — use `.\backup-project.ps1`, which really does
  copy and verify.
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
| `e2e/e2e-full.mjs`, `e2e-run.mjs`, `e2e-features.mjs`, `e2e-mobile.mjs` | the suites the phases drive |

- Flags: `-Phase web|win|android|all` (default `all`), `-Suite full|mobile|run|features`.
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
- Web E2E suite `e2e/e2e-full.mjs` → **126/126 PASS, 0 FAIL** as of 2026-10-04 19:44 (includes
  M1-M22 move/copy suite and G1-G5 refcount-guard suite).
- Windows phase → `e2e-full.ps1 -Phase win -Suite full`: **125 PASS / 0 FAIL / 1 WARN** (G5 refcount negative test
  skips on Windows because Tauri uses physical uploads, not localStorage). Build green, move/copy suite green.
- Android phase → `e2e-android.ps1 -Suite full`: **85 PASS / 0 FAIL / 0 WARN / exit 0**; mobile suite passes, but
  `e2e-mobile.mjs` still has no move/copy UI tests ported.
- ✅ **Move/copy also verified by hand** — the user tested the built app (not just E2E) on 2026-10-04 and
  reported it works. That is why the feature and its spec are treated as done.

## Known environment facts
- Rust 1.97.1; SDK `C:\Users\emire\AppData\Local\Android\Sdk`; NDK `30.0.16138531`; JDK = Android Studio
  JBR (21), `JAVA_HOME` points there. AVDs: `Pixel_7`, `Pixel_Tablet`, `Small_Phone`.
- ProtonVPN's `10.2.0.2` interface previously collided with the emulator host mapping and baked the wrong
  dev-server host.

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
Latest: `ttrpg-soundboard-backup-20261004-230014` (39.2 MB, **203/203 verified**) — taken after `d698d06` /
`30fa85b` were pushed, so it matches the tree at `origin/mobile-support`. This one is **optional insurance**:
everything in it is committed and on GitHub, so unlike previous backups it protects nothing unique.
(203 not 204 because `MOVE_COPY_SOUND_SPEC.md` was deleted on 2026-10-04.)

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
  this file's Retired files section. Explicit "what NOT to delete" list: parked items, the only record
  of a decision, working harnesses, anything uncertain. See `AGENTS.md` for the full criteria.
- **Keep `PROJECT_STATE.md` up to date** — claim, edit in place, release.

### Planning specs in the repo root
| Spec | Status |
|---|---|
| `PROFILE_SYNC_SPEC.md` | **Re-opened by the user 2026-10-04** (was: parked 2026-09-27). **Revised** that day — docs only, all code references re-verified against `src/App.jsx` @ 6240 lines, §0 is a revision log. **Implementation is not authorised yet** — the user wants to review the design first. Do not write app code for it unasked. |
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
- ✅ **The Android SAF spike (spec §7/§10 step 0) is DONE and PASSES** — run 2026-10-04 on an API 37 emulator.
  `dialog.save()` returns a **`content://` URI, not a path**; `plugin-fs` accepts that URI as `path` on mobile
  (`#[cfg(mobile)] resolve_file` → `android.rs` `resolve_content_uri` → `getFileDescriptor` →
  `openAssetFileDescriptor`), so a 4 KiB write + read round-tripped byte-identical and re-write truncates.
  **No fs-scope change is needed on Android.** A raw `/sdcard/Download/…` write is **refused** ("forbidden
  path"), so the spec's old `BaseDirectory.Download` fallback is dead. Remaining unknown: the **desktop**
  picker-path write.
- ⚠️ **`fs:allow-read-dir` is SINGULAR** — the first draft of this spec had it right, my 21:44 revision "fixed"
  it to the plural `fs:allow-read-dirs` and was **wrong**; the Android build rejected it with "Permission not
  found, expected one of …". `permissions/read-dirs.toml` defines a *set* named `read-dirs`; the per-command
  permission is `allow-read-dir`. Build errors that print the valid id list beat reading filenames.
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
- **Move/copy is not ported to the mobile E2E suite.** `e2e-mobile.mjs` has no move/copy UI tests, so the
  Android phase (85 PASS) passes without exercising the feature at all. Web/Windows cover it (M1-M22, G1-G5).
- Deferred from the feature's design, still open if anyone picks them up: cross-container drag-and-drop
  (needs new sidebar drop zones — the existing hit-test only sees *rendered* cards), creating a
  character/category/group from inside the picker, moving or copying a whole container at once, and atomic
  cross-slice persistence (needs the parked `PROFILE_SYNC_SPEC.md` storage refactor).
- Not yet done: release APK (needs a signing keystore), wake lock, fullscreen guard, iOS (needs macOS).

## Retired files
Delete-then-ignore, so they cannot come back:
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
