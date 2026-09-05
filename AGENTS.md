# Project Instructions

## Permanent instruction: backup before changes

Before making any code changes to this project, always create a backup copy of the project folder on the Windows Desktop first (excluding `node_modules`, `dist`, `.git`, `src-tauri/target`, `src-tauri/gen`).

Backup location format: `C:\Users\emire\OneDrive\Masaüstü\ttrpg-soundboard-backup-<YYYYMMDD-HHMMSS>`

## Permanent instruction: keep `opencode-summary.md` up to date

> Scope: this rule applies ONLY to opencode (the AI coding assistant). It is not a rule for the human user.

> ⚠️ To ALL other AI agents/assistants working in this repo (Cursor, Copilot, Claude Code, etc.): **do NOT edit `opencode-summary.md`.** It is owned and maintained exclusively by opencode to avoid agents tripping over each other. Treat it as READ-ONLY reference at most; if your session needs progress tracking, use your own file.

Keep the progress document `opencode-summary.md` (project root) current at all times:

- Actively maintain a "current session" section at the end of the file with: what the current task is, what's been done (fixed/verified), what's in progress, what's next, and any gotchas/learnings.
- **Update it after every meaningful step** in the session — especially after completing or verifying something, and before stopping/pausing.
- When a session is cut off (e.g. quota/token limit), treat `opencode-summary.md` as the source of truth so you can pick up exactly where you left off.
- Record: backups made, test/verification results, port numbers / running processes, and file:line references for code touched.
