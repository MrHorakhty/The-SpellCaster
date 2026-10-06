# Project State

🔒 CURRENT HOLDER: opencode — claimed 2026-10-06 23:24 — working on: final doc pass, then commit + push volume
(prior holder: opencode, released 2026-10-06 23:20 — **per-sound volume is DONE**: shipped, hand-tested by the
user, and green on all three gates** (web 147, Windows 146, Android 85). Next feature is
`SOUND_PRIMING_SPEC.md`; new E2E ids must start at **P17**.)
(last holder before this: opencode, released 2026-10-06 22:18 — docs only. 20:02-21:00: spiked and closed the last open unknown in
`PROFILE_SYNC_SPEC.md` §10 — the **desktop** picker-path write — which passes via a ~5-line runtime
`fs_scope().allow_file` grant, no blanket scope; also falsified the spec's `fs:default`/`read_dir` claim, found
the missing `dialog:allow-save` capability, and found a silent byte-corruption trap (`Array` vs `Uint8Array`).
21:12-22:00: wrote three specs for queued features and folded in the user's answers — **priming is one-shot and
explicitly not profile content**, **per-sound volume is a live card slider**. Pushed as `0a6f346` + `a1f0e8b`.
**Nothing is authorised for implementation; no app code was touched.**)

**Read this file first.** It holds only the *current* state. Dated session-by-session detail lives in
[`docs/session-history.md`](docs/session-history.md) — read that only when you need the reasoning behind a
past decision.

**Any AI agent may edit this file, but only while holding the claim** (see *Permanent instruction: keep
`PROJECT_STATE.md` up to date* in `AGENTS.md`). Claim it as your first action; release it when the work is
genuinely finished.

Last updated: **2026-10-06**

---

## What the project is
**"The SpellCaster"** — a TTRPG soundboard where the GM assigns **sounds to Characters** and
**Environment categories**. Users play, loop, stop and reorder sounds; **move or copy** a sound between any
containers (edit mode); edit characters/categories/sounds; apply themes and a box-size (zoom) slider. A
**Tauri 2.x** shell around a **React 19 + Vite + Tailwind** SPA, ported to Android. All mobile-specific changes
are gated behind `isMobile` so desktop/web stay untouched.

## Project facts
- **Frontend: React 19 + Vite, entry `src/main.jsx`, all logic in `src/App.jsx`** (was 6240 lines on 2026-10-06;
  **~6500 now** after per-sound volume — line numbers in the specs have drifted, the structure has not).
- Backend: Rust/Tauri 2.x (`src-tauri/`), `tauri-plugin-fs` (2.5.1) + `tauri-plugin-log`.
- Storage: Tauri → `BaseDirectory.AppData` via the fs plugin; web → `localStorage` `sound_file_*` data-URLs.
- Data keys: `ttrpg_characters`, `ttrpg_environment` (**singular** — not `ttrpg_environments`; this has fooled
  harnesses before), `ttrpg_groups`, `ttrpg_data_version`, plus `backgroundSettings` and `boxSize`.
  `DATA_VERSION = '3'` (App.jsx:263) — **never bump it**: the mismatch path (App.jsx:322) renames the
  user's keys to `*_old` and resets to defaults.
- Package `com.mrhorakhty.thespellcaster.debug`; `tauri.conf.json` uses `devUrl: http://localhost:5173`.
- **Do not hardcode the version** — `vite.config.js` `define`s `__APP_VERSION__` from `package.json`.

## Repo state
- Branch **`mobile-support`**. ✅ **Per-sound volume committed and pushed 2026-10-06 23:2x** (hash in Recent
  commits). ✅ **Push works, no auth prompt or proxy trouble** — consistent with 2026-10-04 and 2026-10-06.
- All 7 branches were fully merged into `mobile-support` as of 2026-10-04; no unmerged feature work anywhere.
- The move/copy feature is **shipped and user-tested by hand** (2026-10-04), committed as `f7f316e`.
- Recent commits: per-sound volume (2026-10-06) · a final state note for it ·
  `0a6f346` "Close the desktop spike, add specs for volume, hotkeys and priming" ·
  `f3e83f2` "Final state note…" · `30fa85b` "Record repo state after push…" ·
  `d698d06` "Retire move/copy spec, revise profiles spec, fix kill-ports /emu" ·
  `f7f316e` "Added ability to move or copy sounds…".
- ✅ `backup-project.ps1`, `AGENTS.md` and the state file are committed.
- ✅ **Working tree clean and in sync with origin** as of 2026-10-06 23:3x.
- ⚠️ **`src-tauri/Cargo.toml` will show as modified in `git status` even when its content is untouched** — the
  working copy has LF endings while the committed blob has CRLF, so `git diff` reports **no content change**
  (`git diff -w` and a normalised hash both confirm it). Do not "fix" it by sweeping it into a commit; if you
  want a clean `git status`, change the EOL deliberately and say so in the commit.
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
- Web E2E suite `e2e/e2e-full.mjs` → **147 PASS / 0 FAIL / 0 WARN** as of 2026-10-06 22:44 (was 126 before
  per-sound volume; Suite **P** `P1`-`P16` added 21).
- Windows phase → `e2e-full.ps1 -Phase win -Suite full`: **146 PASS / 0 FAIL / 1 WARN** (2026-10-06 22:40). The
  WARN is the pre-existing **G5** skip — Tauri uses physical uploads, not a localStorage seed.
- Android phase → `e2e-android.ps1 -Suite full`: **85 PASS / 0 FAIL / 0 WARN / exit 0** as of 2026-10-06 23:03,
  re-run after per-sound volume. Matches the 2026-10-04 baseline exactly, so the card restructure is clean on
  mobile. ⚠️ **`e2e-mobile.mjs` has no volume tests** — Suite P lives only in `e2e/e2e-full.mjs`, so the Android run
  proves *no regression*, not that volume works there. Same gap move/copy has.
- ✅ **Layout confirmed by screenshot, not just by tests.** Pulled a real Pixel-class screenshot after the run: the
  volume row renders as a `100%` label + native slider **below** each card, cards keep their square aspect, and the
  multi-file and glow indicators are unaffected. 💡 The bars are visually prominent — four loud blue bars on a
  four-card board. That follows the spec's decision (live slider on every card, always visible, because
  hover-reveal is unusable on touch), but "a wall of visual noise" was a risk the spec itself flagged in §2b.3.
  Worth a design opinion from the user; shrinking the control is purely cosmetic and no logic depends on its size.
- ✅ **Move/copy verified by hand** — the user tested the built app (not just E2E) on 2026-10-04 and reported it
  works.
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
Latest: **`ttrpg-soundboard-backup-20261006-224711`** (206/206 verified, 39.3 MB) — taken **after** per-sound
volume shipped, so it is the only backup holding that work. ⚠️ **It saved this session**: a stray
`Add-Content -Encoding UTF8` (which injects a BOM mid-file) was followed by a `.Replace()` overload error that
made a variable `$null`, and the next `WriteAllText` **wiped `PROJECT_STATE.md` to 0 bytes**. Restored from this
backup in one step. 💡 **Lessons**: in PowerShell 5.1 `"str".Replace([char]0xFEFF, '')` throws (it wants a
`char`, not a `string`) — use `[regex]::Replace` or the `string,string` overload; and never chain a write onto a
variable that a failed command may have left `$null`. Verify a file's length after any bulk rewrite.
Previous: `ttrpg-soundboard-backup-20261006-215129` (206/206, before the volume changes),
`20261006-213714`, `20261006-200301`, `20261004-230014`. ⚠️ **Five backups now exist and the older four protect
nothing unique** — everything in them is on GitHub. Prune by hand.

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
**Three new specs written 2026-10-06** for features the user queued; each is meant to be picked up **one per
fresh session**. All three are docs-only, **none authorised for implementation**, and all three were written
against `src/App.jsx` @ 6240 lines — **re-verify the line numbers**, they drift.

| Spec | What it is | Recommended order |
|---|---|---|
| `PER_SOUND_VOLUME_SPEC.md` | ✅ **SHIPPED 2026-10-06** (E2E only, **not** hand-tested). Now a record of what was built, with the four wrong spec facts corrected in place. Card control is a **sibling of the card**, not a descendant — no `stopPropagation`, no `role="group"`. ⚠️ **`P1`-`P16` are taken**; priming and hotkeys must not reuse them. Traps recorded: the `\|\|` → `??` coercion that would revive a **muted** sound; `updateMasterVolume` must refresh `_baseVolume` or loop re-entry snaps back; and a slider drag persists **once on commit**, not per move | **DONE — this is the one to pick up next: priming** |
| `HOTKEYS_SPEC.md` | Keyboard shortcuts to trigger sounds. In-app tier (a `keydown` listener) vs global (`tauri-plugin-global-shortcut`, desktop-only, `main.rs` only — the **reverse** of the dialog rule). ⚠️ a hotkey is a *reference*, and `PROFILE_SYNC_SPEC.md` §8 plus the category-name-as-identity landmine are what make that hard. ⚠️ it must not fire while a text field has focus — this app has many | **AFTER profiles** — inherit the reference story instead of solving it twice |
| `SOUND_PRIMING_SPEC.md` | Right-click (desktop) / press-and-hold (mobile) to prime sounds that fire alongside the next trigger. ✅ **decided: ONE-SHOT, consumed by the next trigger, nothing persisted, explicitly not profile content** — so **add no `localStorage` key** (the absence is deliberate). Saved layers are **rejected**; §6 records why so it is not re-opened. Verified: the app has **no** existing right-click or long-press handling at all. ✅ build it **after volume** — the volume slider is now a sibling of the card, so the "hold on the slider" conflict is moot; what remains is the hold timer, `contextmenu` suppression and the double-fire trap. ⚠️ **new E2E ids must start at `P17`** | **NEXT UP** — cheapest feature, zero persistence |

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
  intended from the brief testing"), and green on web / Windows / Android. `SOUND_PRIMING_SPEC.md` is **next** — cheapest
  feature, zero persistence, and it now builds on the card shape volume established. ⚠️ Suite P is **not** ported
  to `e2e-mobile.mjs` (same gap move/copy has), and the mid-fade rescale branch plus a real loop-boundary crossing
  are still uncovered — all listed in `PER_SOUND_VOLUME_SPEC.md` §8.
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
