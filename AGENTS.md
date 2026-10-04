# Project Instructions

## Permanent instruction: backup before changes

Before making any code changes to this project, always create a backup copy of the project folder on the Windows Desktop first (excluding `node_modules`, `dist`, `.git`, `src-tauri/target`, `src-tauri/gen`).

Backup location format: `C:\Users\emire\OneDrive\Masaüstü\ttrpg-soundboard-backup-<YYYYMMDD-HHMMSS>`

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

## Permanent instruction: keep `opencode-summary.md` up to date

> Scope: this rule applies ONLY to opencode (the AI coding assistant). It is not a rule for the human user.

> ⚠️ To ALL other AI agents/assistants working in this repo (Cursor, Copilot, Claude Code, etc.): **do NOT edit `opencode-summary.md`.** It is owned and maintained exclusively by opencode to avoid agents tripping over each other. Treat it as READ-ONLY reference at most; if your session needs progress tracking, use your own file.

`opencode-summary.md` (project root) holds the **current state only** — project facts, architecture gotchas,
operational warnings, open items. Keep it accurate and short:

- Rewrite sections in place when state changes. Do **not** append dated session logs to it.
- **Update it after every meaningful step** in the session — especially after completing or verifying something, and before stopping/pausing.
- When a session is cut off (e.g. quota/token limit), treat it as the source of truth so you can pick up exactly where you left off.
- Record: backups made, test/verification results, port numbers / running processes, and file:line references for code touched.
- Anything that is genuinely worth remembering later but is no longer current goes in **`docs/session-history.md`** (append-only archive). Move it there rather than letting this file grow.
- If a fact here contradicts the code, the code wins — fix this file in the same session.

## Permanent instruction: delete deprecated parts

Retired things must not linger. This project has repeatedly accumulated dead weight that later sessions had to
reason around: an obsolete combined test runner, two finished feature specs, three resolved audit reports.

When something becomes obsolete, in the same session that establishes it:

- **Delete the file** (prefer `git rm` so the deletion is staged) — do not just stop using it, and do not
  mark it deprecated in place.
- **Add a `.gitignore` entry** so it cannot silently come back. Existing examples: `e2e/e2e-all.ps1`,
  `RESTORE_DEFAULTS_SPEC.md`, `ICON_FEATURE_SPEC.md`.
- **Record what it was and where the design lives** in `opencode-summary.md` (Retired files, or Open items if
  it is a debt being tracked rather than a finished feature). Deleting the file must not delete the knowledge.
- A file is deprecated when it is **replaced**, **shipped**, **resolved**, or **explicitly abandoned by the
  user** — not merely because it is unused for a while.

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
