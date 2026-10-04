# Project State

🔓 **UNCLAIMED** — last holder: opencode (2026-10-04 19:57). Session log: `docs/session-history.md`.

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
**Environment categories**. Users play, loop, stop and reorder sounds; edit characters/categories/sounds;
apply themes and a box-size (zoom) slider. A **Tauri 2.x** shell around a **React 19 + Vite + Tailwind**
SPA, ported to Android. All mobile-specific changes are gated behind `isMobile` so desktop/web stay untouched.

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
- Branch **`mobile-support`**, in sync with `origin/mobile-support`.
- All 7 branches are fully merged into `mobile-support`; no unmerged work anywhere.
- Recent commits: `c83a72c` "More document changes" · `630f28f` "Some document changes" · `8ef2c6f` "Fixing known debts" ·
  `bde7483` "Added Restore Defaults function" · `53ce2eb` "Added ability to add icons/emoji for groups".
- ✅ `backup-project.ps1`, `AGENTS.md` and the state file (then `opencode-summary.md`) are committed in `c83a72c`.
- ⚠️ **Uncommitted as of 2026-10-04 ~19:50 (user has not asked for a commit):** MOVE_COPY_SOUND_SPEC feature
  implemented in `src/App.jsx` (`mintId`, `allSoundContainers`, `findSoundContainer`, `transferSound`,
  `nextCopyName`, `openMoveCopyModal/transferSound`, picker modal UI), with `removeContainerFiles` /
  `removeFileIfUnreferenced` / `isFileReferencedElsewhere` guarding all file cleanup; web E2E green.
  `e2e/e2e-full.mjs` and `MOVE_COPY_SOUND_SPEC.md` touched. No Android/Windows phase run yet.
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

### Data-model gotchas (found 2026-10-04 while planning move/copy)
- **There are FIVE container shapes for sounds, not four.** `characters[].sounds`,
  `environmentSounds[].sounds`, `groups[].categories[].sounds`, `groups[].characters[].sounds` — **plus
  `groups[].sounds`, a vestigial array that `addGroup` allocates on every group (App.jsx:3137) and nothing ever
  pushes into.** Only `deleteGroup`'s cleanup (App.jsx:3155) and the delete-confirm name lookup
  (App.jsx:5930) read it. **Any code that walks containers to find a sound or a file reference must walk all
  five** — the four-shape assumption looks correct and is not.
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
-   "Deletea sound must always confirm, and today it does." `handleDeleteSound` (App.jsx:2224) only opens
  the dialog; `deleteSound` has exactly one call site, `confirmDelete` (App.jsx:2230). Keep it that way — a
  second unconfirmed sound-removal path is a regression.

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
Latest: `ttrpg-soundboard-backup-20261004-181318` (39.1 MB, 204/204 verified) — taken before starting
 MOVE_COPY_SOUND_SPEC implementation (2026-10-04 18:13).
  
  This file now records that the next code-touching session (this one) took one before touching code.

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
| `PROFILE_SYNC_SPEC.md` | **Parked** by user decision — documentation only |
| `MOVE_COPY_SOUND_SPEC.md` | **Implemented 2026-10-04** — move/copy + refcount guard landed; web E2E green. §2 is the settled decision list; §7 guard now covers eight sites. |

## Open items
- **The claim/release protocol is unproven with a second agent.** Installed 2026-10-04; only opencode has
  used it, and only within the session that wrote it. Watch for the failure modes on the next non-opencode
  session: an agent that edits without claiming, an agent that never releases, or an agent that cannot tell
  which tool it is (the protocol tells it to write its own name — if an agent can't identify itself it
  should write `unknown-agent` and ask the user rather than guessing).
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
- `MOVE_COPY_SOUND_SPEC.md` — **Implemented 2026-10-04** per §10: copy **shares** the audio file reference;
  entry is a third per-card button in edit mode; move is silent with no confirm; append at end of target;
  the §7 hazard got a refcount guard (`isFileReferencedElsewhere`, App.jsx:1967) as
  a **separate follow-up** in this same session. Partial writes still rely on the
  existing save-error banner (not atomic — see spec §5.4); picker rows have **two** buttons, no mode state;
  copies auto-suffix `Name (copy)`.
  ✅ Because a copy shares the source's `storedName`, deleting the *container* holding the original was guarded at
  App.jsx:2615/2630/3041/3155/3173 and sound-modal paths at App.jsx:2454/2459/2468. The guard is landed and tested.
- The **spec has two self-corrections already applied** that a future session must not "re-fix": the write-order
  guarantee is best-effort (effect order, not setter order, decides what hits disk — see the gotchas above), and
  the container-shape list is five, not four.
- Android mobile phase run 2026-10-04 20:21 (`e2e-android.ps1 -Suite full`,
  **85 PASS / 0 FAIL / 0 WARN**, exit 0): the *mobile* suite passed, but it
  still does not contain the move/copy UI yet.
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
