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
- Recent commits: `8ef2c6f` "Fixing known debts" · `bde7483` "Added Restore Defaults function" · `53ce2eb` "Added ability to add icons/emoji for groups".
- Working tree: clean except for the doc restructure in progress.

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
- **Back up before every change** — see `AGENTS.md` for the exact path construction. Do not hand-type the
  accented folder name; it has been created wrong twice.

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

## Open items
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
