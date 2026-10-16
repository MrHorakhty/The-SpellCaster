# Project Instructions

## Permanent instruction: backup before changes

Before making any code changes, run the backup script. It copies **and verifies**, which matters
because antivirus silently eats files from the backup folder after `robocopy` reports success:

```powershell
.\backup-project.ps1             # copy + verify + auto-repair (default)
.\backup-project.ps1 -NoRepair   # verify only, don't restore anything
.\backup-project.ps1 -MaxMB 400  # raise the size ceiling if the project grows
```

**Every backup is complete** — source, docs, tests, and `public/assets` audio (~40 MB). The user chose
complete-by-default rather than a smaller tier that risks omitting assets.

Only **regenerable** content is excluded, and each exclusion maps to a rebuild command:

| Excluded | Size | Rebuilt by |
|---|---|---|
| `node_modules` | 108 MB | `npm install` |
| `dist` | 29 MB | `npm run build` |
| `.git` | 21 MB | `git clone` (objects already in the repo) |
| `target` | **25 GB** | `cargo build` |
| `gen` | 5.8 GB | see the warning below — **only mostly** |

⚠️ **`gen` is excluded from the backup, but it is NOT purely regenerable, and it is not gitignored.** Two
things make the old "rebuilt by `tauri android init`" row wrong (corrected 2026-10-12):

- **50 files under `src-tauri/gen/android/` are tracked in git.** `.gitignore` only excludes specific subpaths
  (`gen/schemas/`, `Run App.bat`, `local.properties`, `*.keystore`, `*.jks`, `.gradle/`, `build/`, `.cxx/`) - not
  the directory. Tracked and hand-maintained among them is
  **`src-tauri/gen/android/app/src/main/java/com/mrhorakhty/thespellcaster/MainActivity.kt`**, which is where the
  Rust plugins are registered, plus `build.gradle.kts` and `AndroidManifest.xml`.
  ⚠️ **`Run App.bat` is the counter-example, retired 2026-10-16.** It was hand-maintained, lived under `gen/` (which
  backups exclude) **and** was gitignored — so it existed in exactly one place on one machine, and its comment
  claimed it "launches the app" while it actually ran the whole build+install pipeline. It is replaced by the two
  **tracked root** scripts `Run Tauri Android.bat` and `Launch App Android.bat`. 💡 **A hand-maintained file belongs
  next to the tracked sources, never inside a generated directory** — that is the same rule as the 50 files above.
- So a fresh `tauri android init` would **not** reproduce them. That is precisely why they are tracked.

The practical consequence: **a backup folder is not a complete checkout of this repo.** It omits 50 tracked
files, including the Android entry point. That is safe *only* because those files are in git and pushed — which
is the case as of `8f06de9`. 💡 The same shape as the `public/assets` lesson: check what is actually tracked
before treating an exclusion as harmless.

The script prints the exclusion list, file count and size on **every run**, and aborts (deleting the
oversized folder, exit 1) if the result exceeds 150 MB. That guard exists because of a real incident:
`/XD src-tauri\target` was passed as a path instead of a bare name, robocopy silently ignored it, and
the "backup" was 31 GB / 34,966 files. **Never hand-copy with a bare `robocopy` call** — you get no
verification and no size check, and it will not notice a lost file.

If a file is missing from the backup, the script restores it — preferring the **working tree** copy when
that file has uncommitted edits, falling back to `git show HEAD:` when clean.

Backup location format: `C:\Users\emire\OneDrive\Masaüstü\ttrpg-soundboard-backup-<YYYYMMDD-HHMMSS>`

### Known: antivirus quarantines `e2e\e2e-full.ps1` from backup folders
Bitdefender detects it as `CMD:Heur.BZC.PZQ.Boxter.949` and deletes the **copy** in the OneDrive backup
folder. The repo copy survives because `c:\users\emire\projects\ttrpg-soundboard\e2e\` is excluded from
scanning; the backup location is **not** excluded. This has silently removed the file from a backup at
least twice (2026-09-30 from `.git\objects`, 2026-10-04 from a backup folder).

Controlled testing narrowed the trigger to the single line
`Remove-Item $profile -Recurse -Force -ErrorAction SilentlyContinue` in combination with the rest of
the file — stripping all process-kill commands did **not** help, and the pattern alone in a tiny script
is harmless. The e2e files are currently final and committed, so `backup-project.ps1` repairing from git
is the accepted mitigation. The user declined excluding all of OneDrive.

### Known: backups accumulate — prune the old ones once pushed
The script does **not** delete old backups. During a work session several accumulate; once the work is pushed
and verified, older ones can be deleted by hand. **Keep the newest** regardless — it is the fast rollback point
and it costs ~40 MB.

A backup holds source, docs, tests **and `public/assets`**, and **all of that is now in git** — `public/` was
un-ignored in `ba57282` (2026-10-12). A fresh clone plus `npm install` therefore reproduces a backup's contents.
That was **verified end to end, not assumed**: a fresh clone from GitHub built to a `dist/` containing all 71
starter sounds, with every filename `src/data.json` references resolving.

⚠️ **This was false until 2026-10-12, and the falsehood had already been acted on.** `.gitignore:90` read
`public` — boilerplate inherited from the Nuxt/Gatsby blocks beside it, where ignoring it *is* correct. Here it
was not: the app is Vite, so `public/` is source. The audio was untracked, the "all of which are in git" sentence
was wrong, and every backup folder was cleared on 2026-10-11 under *"after a successful push, you do not need one
at all"* — which left 29 MB of the shipped app existing in exactly one place: the working tree.
💡 **Verify a redundancy claim against `.gitignore` before you rely on it.** A rule justified by *"it's all in
git"* is only ever as good as the ignore list, and nobody re-reads a rule that has been working.

### Build that path in PowerShell — do NOT type the accented characters

`ü` is U+00FC and the folder name is exactly `Masaüstü` = `Masa` + `ü` + `st` + `ü`. Typing or
guessing the literal creates a **differently named folder** (this happened twice: once as
`MasaÃ¼stÃ¼` from a UTF-8-as-Latin-1 mixup, once as `üstültÜ` from a bad char-code sequence).
Both times the backup looked successful and was found in the wrong place days later.

```powershell
# correct - verified against the real folder on disk
$desk = 'C:\Users\emire\OneDrive\Masa' + [char]0x00FC + 'st' + [char]0x00FC   # -> Masaüstü
```

`[char]0xDC` (capital `Ü`) is **wrong** here, and so is any leading `ü`. Then verify before copying:

```powershell
($desk.ToCharArray() | ForEach-Object { [int]$_ }) -join ','   # must be 77,97,115,97,252,115,116,252
```

## Permanent instruction: keep `PROJECT_STATE.md` up to date

> Scope: this rule applies to every AI agent/assistant working in this repo (opencode, Cursor, Copilot,
> Claude Code, …). It is not a rule for the human user.

`PROJECT_STATE.md` (project root, formerly `opencode-summary.md`) holds the **current state only** — project
facts, architecture gotchas, operational warnings, open items.

**No agent owns this file.** Any agent may maintain it, and the name is deliberately agent-neutral so nobody
reads it as another tool's private file. To stop two agents rewriting it at once, they **claim** it:

```
🔒 CURRENT HOLDER: <agent name> — claimed <YYYY-MM-DD HH:MM> — working on: <one line>
🔓 UNCLAIMED — last holder: <agent name> (<YYYY-MM-DD HH:MM>)
```

⚠️ **Exactly one of those two lines is present at a time** — they are alternatives, not a pair. **Claiming means
replacing** the `🔓` line, not adding a `🔒` line above it. With both present the reader cannot tell which is
authoritative, and step 4 below only works if they can. opencode made exactly this mistake on 2026-10-12 by
adding its `🔒` line instead of replacing, which briefly left the file claiming a holder *and* being unclaimed.

### Claim — first action of every session, before the backup
1. Re-read the top of `PROJECT_STATE.md`.
2. If **UNCLAIMED**, write your claim in one edit (name + timestamp + one-line topic), then get on with the work.
   Sign it with **your own tool name** (opencode, Cursor, Copilot, Claude Code, …). If you genuinely cannot
   identify yourself, write `unknown-agent` and ask the user — do not guess or write `opencode`.
3. If **CLAIMED by someone else**, do not edit the file. Tell the user, and keep any progress notes in your own
   scratch file instead.
4. Re-read the claim immediately before each write. Two agents starting in the same second can both see
   `UNCLAIMED`; this narrows that window to seconds, it does not close it.

### While holding the claim
- Rewrite sections in place when state changes. Do **not** append dated session logs to this file.
- **Update after every meaningful step** — especially after completing or verifying something, and before
  stopping or pausing.
- Record: backups made, test/verification results, port numbers / running processes, and file:line references
  for code touched.
- Anything genuinely worth remembering later but no longer current goes in **`docs/session-history.md`**
  (append-only archive). Move it there rather than letting this file grow.
- If a fact here contradicts the code, the code wins — fix this file in the same session.

### Release — only when the work is actually finished
1. Rewrite sections in place with the final state.
2. Append one dated block to `docs/session-history.md`.
3. Leave handover facts for the next agent: backups, test results, uncommitted files, running processes/ports.
4. Flip the claim to `🔓 UNCLAIMED — last holder: <you> (<timestamp>)`.

**Release means "done", not "stopping".** If the session ends with work unfinished (quota cut-off, context
limit, user interruption), **leave the claim in place** and say what is left — an active claim tells the next
agent that work here is mid-flight. The user normally prompts for these final edits before ending a session.

### Stale claims
A claim left by another agent is presumed abandoned but **never overwrite it silently** — a stale claim usually
means a previous session was cut off, which is exactly the information you need. Report it to the user and ask
before taking over. They may also tell you to release another agent's claim.

### You are not the holder, but you learned something worth recording
Say so to the user — e.g. "I retired `FOO.md`; I need the claim to record that in Project State." The user will
release it or ask the holder to add it. Do not create a side file to work around this; do not edit the body of
`PROJECT_STATE.md` without the claim.

### Honesty about the mechanism
This is cooperative, not enforced. Nothing prevents an agent from editing the file while another holds the
claim; the protocol works because every agent loads this file. A markdown line is not a mutex — two agents
starting in the same second can still both claim, so re-read immediately before writing.

## Permanent instruction: delete deprecated parts

Retired things must not linger. This project has repeatedly accumulated dead weight that later sessions had to
reason around: an obsolete combined test runner, two finished feature specs, three resolved audit reports.

When something becomes obsolete, in the same session that establishes it:

- **Delete the file** (prefer `git rm` so the deletion is staged) — do not just stop using it, and do not
  mark it deprecated in place.
- **Add a `.gitignore` entry** so it cannot silently come back. Existing examples: `e2e/e2e-all.ps1`,
  `e2e/e2e-run.mjs`, `e2e/e2e-features.mjs`, `RESTORE_DEFAULTS_SPEC.md`, `ICON_FEATURE_SPEC.md`.
- **Record what it was and where the design lives** in `PROJECT_STATE.md` (Retired files, or Open items if
  it is a debt being tracked rather than a finished feature). Deleting the file must not delete the knowledge.
- A file is deprecated when it is **replaced**, **shipped**, **resolved**, or **explicitly abandoned by the
  user** — not merely because it is unused for a while.

### Retiring a TEST file is a different act from retiring a doc
⚠️ **A retired doc loses prose. A retired test loses passing coverage, and nothing will ever report the hole.**
Before deleting any test harness, diff what it uniquely covers against everything else, and **port that
coverage first**, then delete. Concretely, on 2026-10-11 Phase 3 was written as "delete `e2e-run.mjs` /
`e2e-features.mjs`"; extracting their `log()` calls showed **~31 tests that existed nowhere else** (live
playback, scroll containment, the `isMobile` gate), so they became `specs/playback.mjs`, `specs/scroll.mjs` and
`specs/platform.mjs` *before* the `git rm`. Delete-only would have passed every gate at 0 FAIL while quietly
removing a third of the suite.

### What NOT to delete

This rule is deliberately narrow. Do not delete:

- Anything the user did not ask you to delete, or that is parked/awaiting a decision — parked means parked
  (`PROFILE_SYNC_SPEC.md`).
- Anything that is the only record of a decision or a hard-won gotcha. Move it to
  `docs/session-history.md` first, then delete.
- Test harnesses, backup folders, or history in git. Deleting a working harness to "tidy up" costs more than
  it saves.
- Anything you are not certain about. If unsure whether something is deprecated, ask — a wrong deletion is far
  more expensive than a leftover file.

## Permanent instruction: definition of done

Work in this repo is **not** done when the code compiles. It is done when all of the following are true, and
the report you give the user must state each one with its actual number rather than "should be fine".

### Run these, in this order

| # | Gate | Command | Passes when |
|---|---|---|---|
| 1 | Backup | `.\backup-project.ps1` | `VERIFY OK` and the file count matches the source |
| 2 | Lint | `npx eslint .` | **0 errors.** 3 warnings (`convertFileSrc`, `_`, `ev`) are the accepted baseline — do not chase them |
| 3 | Build | `npx vite build` | completes |
| 4 | Coverage | `node e2e/check-coverage.mjs` | `OK — manifest, code and platform wiring agree`, exit 0 |
| 5 | Web E2E | `e2e\e2e-full.ps1 -Phase web -Suite full` | **0 FAIL** |
| 6 | Windows E2E | `e2e\e2e-full.ps1 -Phase win -Suite full` | **0 FAIL** |
| 7 | Android E2E | `e2e\e2e-android.ps1 -Suite mobile` | **0 FAIL** |

Gates 4–7 are the ones that catch things gates 2–3 cannot. Budget roughly 3 min / 4 min / 5 min with warm
`node_modules` and cargo cache; Android additionally boots an emulator and rebuilds the APK.

### Read the exit code correctly, or you will "fix" a non-bug
`report.mjs` maps `fail>0 → 2`, `warn>0 → 1`, else `0`. **Suites G5 (the file-reference guard's negative
localStorage case) legitimately WARNs on both Tauri phases**, because under Tauri an upload is a physical file
in the app's uploads dir rather than a `sound_file_*` localStorage key. So:

- **Windows and Android exiting `1` is the expected healthy baseline.** `0 FAIL` is the signal; the exit code
  alone is not a regression.
- Only the **web** phase is expected to exit `0`.
- Never "fix" this by downgrading the WARN to a silent skip. A quietly dropped test rots unnoticed — that is
  the entire reason it is a WARN.

### Coverage you add must be registered, or it does not exist
After adding, renaming or deleting a test, run `node e2e/check-coverage.mjs --update` and **review the id
diff** before committing. The checker is what stops a spec from silently running on one platform only, and
what catches a test that exists in the code but in no inventory.

### A shipped feature with no tests FAILS the gate
The checker has two layers, and they are not the same thing:

- The **suite** registry enforces that coverage cannot *rot* — ids stay registered, specs keep running on both
  platforms, retired files stay retired.
- The **features** registry enforces that coverage *exists*. Every shipped capability is listed in
  `e2e/coverage.manifest.json` under `features`, each mapping to the suites that cover it. A `shipped` feature
  with an empty `coveredBy` is an error — you must either write the tests or record an explicit `gap` reason,
  which then prints on every run so the debt cannot quietly disappear.

So when you build a feature: **add a `features` entry the moment you start, not when you finish.** Marking it
`planned` first is the honest move — the checker will list it under "no coverage expected", and flipping it to
`shipped` is what forces the tests to exist. If you ship without registering, the gate stays green, because no
registry can catch a feature nobody wrote down.

### The user-visible bar
E2E green is not the whole bar for a **user-facing** feature. Move/copy and per-sound volume both shipped only
after the user **hand-tested the built app**; say so explicitly in the report, and never imply a hand-test that
did not happen. Tests that only touch internal state (a refactor, a pure function, harness work) do not need
one — say that too, rather than leaving it ambiguous.

### Reporting
Give the per-gate PASS/FAIL/WARN counts and the exit code for each. If a gate could not run (no emulator, no
device, no build), **say which and why** — never quietly report the ones that did run as if they were all of
them.

### Before you stop
- `.\backup-project.ps1` again, so the backup matches the final state rather than the pre-change one.
- `PROJECT_STATE.md` updated and the claim **released** — see the release protocol above.
- If you changed a plan, record **why the plan changed**, not just the new plan.
