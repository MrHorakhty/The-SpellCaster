# Project log captures

Use the ignored root `logs/` folder for future manual build, diagnostic and agent
captures. Name new captures `<topic>-yyyyMMdd-HHmmss.log`. Keep companion status
files there too. Do not move an actively written log until its writer stops.

The E2E runners already write their logs under `%TEMP%\opencode`; that behavior
is unchanged. `logs/` is for additional project-local captures.

Before cleanup, put the latest successful verification set and any unresolved
failure evidence in `logs/keep/`. That folder is never visited by the cleanup
script. Record lasting findings in PROJECT_STATE.md or docs/session-history.md.

```powershell
.\clean-logs.ps1                 # preview direct .log files older than 30 days
.\clean-logs.ps1 -Days 60        # choose another retention window
.\clean-logs.ps1 -Apply         # delete the displayed candidates
.\clean-logs.ps1 -Apply -WhatIf  # PowerShell deletion preview
```

Cleanup is explicit, never scheduled. It does not traverse subfolders, touch
external E2E logs, or remove non-log files. Existing root captures were preserved
in `logs/keep/legacy-root/` during the initial organization; review them before
moving disposable files into `logs/` for eventual cleanup.
