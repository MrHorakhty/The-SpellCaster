# opencode — Current State

> ⚠️ Maintained exclusively by **opencode**. Other AI agents/assistants (Cursor, Copilot, Claude Code, etc.): treat this file as **READ-ONLY reference — do NOT edit it**. If your session needs progress tracking, use your own file to avoid agents tripping over each other.

**Read this file first.** It holds only the *current* state. Dated session-by-session detail lives in
[`docs/session-history.md`](docs/session-history.md) — read that only when you need the reasoning behind a
past decision.

Last updated: **2026-10-04**

---

## What the project is
**"The SpellCaster"** — a TTRPG soundboard where the GM assigns **sounds to Characters** and
**Environment categories**. Users play, loop, stop and reorder sounds; edit characters/categories/sounds;
apply themes and a box-size (zoom) slider. A **Tauri 2.x** shell around a **React 19 + Vite + Tailwind**
SPA, ported to Android. All mobile-specific changes are gated behind `isMobile` so desktop/web stay untouched.

## Project facts
- Frontend: React 19 + Vite, entry `src/main.jsx`, all logic in `src/App.jsx` (~4400 lines, one monolithic component).
- Backend: Rust/Tauri 2.x (`src-tauri/`), `tauri-plugin-fs` (2.5.1) + `tauri-plugin-log`.
- Storage: Tauri → `BaseDirectory.AppData` via the fs plugin; web → `localStorage` `sound_file_*` data-URLs.
- Data keys: `ttrpg_characters`, `ttrpg_environments`, `ttrpg_groups`, `ttrpg_themes`, `ttrpg_data_version`. `DATA_VERSION = '3'`.
- Package `com.mrhorakhty.thespellcaster.debug`; `tauri.conf.json` uses `devUrl: http://localhost:5173`.
- **Do not hardcode the version** — `vite.config.js` `define`s `__APP_VERSION__` from `package.json`.

## Repo state
- Branch **`mobile-support`**, in sync with `origin/mobile-support`.
- All 7 branches are fully merged into `mobile-support`; no unmerged work anywhere.
- Recent commits: `630f28f` "Some document changes" · `8ef2c6f` "Fixing known debts" · `bde7483` "Added Restore Defaults function" · `53ce2eb` "Added ability to add icons/emoji for groups".
- ⚠️ **Uncommitted at the end of 2026-10-04** (the user had not committed these yet):
  `?? backup-project.ps1` (new backup script), `M AGENTS.md`, `M opencode-summary.md`.
  Commit them before relying on `backup-project.ps1` existing in a fresh clone.
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
Latest: `ttrpg-soundboard-backup-20261004-163113` (the user deleted the earlier ones as test artifacts).

### Bitdefender quarantined the backup folder itself?
Not excluded, but it also did not fire again during the final runs — the several test backups taken after
the first deletion all kept `e2e-full.ps1`. Likely AV caching from the re-scan of identical content, not
safety. Assume it *will* be eaten again; `backup-project.ps1` is the mitigation, not a fix.

## Docs layout (changed 2026-10-04)
`opencode-summary.md` was split — it had grown to 1000 lines and future sessions had to dig through
dated history to find current state. It now holds **current state only**; the 35 dated session logs moved
to `docs/session-history.md` (append-only, 927 lines). Same for `AGENTS.md` (115 lines, standing rules).
**Do not merge them back.** Read the summary first, the archive only when you need past reasoning.

Two new standing rules were added to `AGENTS.md` this session:
- **Delete deprecated parts** — retired files get `git rm`'d *and* a `.gitignore` entry *and* a line in
  the summary's Retired files section. Explicit "what NOT to delete" list: parked items, the only record
  of a decision, working harnesses, anything uncertain. See `AGENTS.md` for the full criteria.

## Open items
- **Antiviral quarantine of the backup** — contained via `backup-project.ps1` (verify + repair), not
  prevented. If the e2e harness is ever edited again, expect the file to be eaten from each backup and
  re-check a fresh backup with the script rather than trusting the robocopy exit code.
- **Debt 6 — native `onRenderProcessGone`.** Confirmed **blocked**: the Android WebView client is
  auto-generated by `wry 0.55.1` (`RustWebViewClient.kt` under `src-tauri/gen/`, which is gitignored), so
  there is no supported hook. Only viable via an upstream wry patch or vendoring it. Do not retry blindly.
- **Debt 7 — `e2e-all.ps1`.** Kept on the books as a reminder (user's decision). Enforced by `.gitignore`
  and documented in `README.md`.
- `src-tauri/gen/android/Run App.bat` stays gitignored (user's decision) — its port-5173 fix is local-only.
- `PROFILE_SYNC_SPEC.md` is **parked** by user decision (documentation-only for now). Do not implement unasked.
- Android phase (`-Phase android`) not run recently; needs the emulator plus a Rust Android build, and its
  repo seeding path is the unreliable `Page.reload` one above.
- Not yet done: release APK (needs a signing keystore), wake lock, fullscreen guard, iOS (needs macOS).

## Retired files
Delete-then-ignore, so they cannot come back:
- `RESTORE_DEFAULTS_SPEC.md` — shipped as `bde7483`, deleted 2026-10-04.
- `ICON_FEATURE_SPEC.md` — shipped as `53ce2eb`, deleted by the user 2026-09-28.
- `e2e-all.ps1` / `e2e-all.ps1.new` — replaced by `e2e-full.ps1`; filename is AV-blocked.
- `TESTING_REPORT.md`, `TESTING_REPORT_FOLLOWUP.md`, `EDGE_TO_EDGE_REPORT.md` — resolved, deleted; git history has them.

---

## Dated session detail
→ [`docs/session-history.md`](docs/session-history.md)
