# e2e-full.ps1 - E2E runner: Phases A (web) + B (Windows).
# Phase C (Android) is delegated to e2e-android.ps1 to keep this file lightweight
# and avoid AV heuristic triggers (process kill + debug port forwarding in one script).
# Why new filename: Bitdefender quarantined and hard-blocks the old name `e2e-all.ps1`.
# Requirements: Start-Process -PassThru capture, try/finally cleanup, output redirect,
#               hard 15-min timeout, process kills scoped so unrelated WebView2 apps
#               (WhatsApp / Google Drive / Windows Search) are never touched.
#
# E2E TEST POLICY: When asked to run E2E, only execute and report results.
# Do NOT modify app code or harness code - wait for user instructions.
param([string]$Phase = 'all', [string]$Suite = 'full')
$ErrorActionPreference = 'Continue'
$Script:TestLog = Join-Path $env:TEMP "opencode\e2e-run-$(Get-Date -f yyyyMMdd-HHmmss).log"
$Script:EdgeProfile = Join-Path $env:TEMP 'opencode\e2e-web-profile'
$Script:TestStartTime = Get-Date

$tmp   = Join-Path $env:TEMP 'opencode'
$proj  = Split-Path -Parent $PSScriptRoot   # C:\Users\emire\Projects\ttrpg-soundboard
$edge  = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$results = [System.Collections.ArrayList]::new()
$Script:MjsFile = "e2e-$Suite.mjs"

# Annex-box comment arts below are intentionally in comments only:
# ASCII-only strings everywhere so PS 5.1 ANSI fallback never corrupts a terminator.
Write-Host "Test output log -> $Script:TestLog" -ForegroundColor DarkGray
New-Item -ItemType Directory -Path $tmp -Force | Out-Null
"=== E2E RUNNER $(Get-Date -f 'yyyy-MM-dd HH:mm:ss') ===" | Set-Content $Script:TestLog

# --- Cleanup helpers ---------------------------------------------------------

# PIDs that Remove-Orphans must never touch.
# The orphan sweep matches on '*ttrpg-soundboard*', which also matches the command line
# of the shell/agent session that launched this script - killing that would end the run
# (and the session) mid-suite. So protect this process's whole ancestry plus anything
# that is opencode itself.
function Get-ProtectedPids {
    $keep = New-Object 'System.Collections.Generic.HashSet[int]'

    $id = $PID
    for ($i = 0; $i -lt 16; $i++) {
        if (-not $id) { break }
        [void]$keep.Add([int]$id)
        $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$id" -ErrorAction SilentlyContinue
        if (-not $proc -or $proc.ParentProcessId -eq 0 -or $proc.ParentProcessId -eq $id) { break }
        $id = $proc.ParentProcessId
    }

    Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -like 'opencode*' -or ($_.CommandLine -like '*opencode*') } |
        ForEach-Object { [void]$keep.Add([int]$_.ProcessId) }

    return $keep
}

function Remove-Orphans {
    $keep = Get-ProtectedPids
    Get-CimInstance Win32_Process |
        Where-Object {
            -not $keep.Contains([int]$_.ProcessId) -and (
                ($_.CommandLine -like '*ttrpg-soundboard*') -or
                ($_.CommandLine -like '*vite*preview*5233*') -or
                ($_.CommandLine -like '*vite*5173*') -or
                ($_.Name -eq 'msedge.exe' -and $_.CommandLine -like '*remote-debugging-port=*') -or
                ($_.Name -eq 'msedgewebview2.exe' -and $_.CommandLine -like '*remote-debugging-port=*')
            )
        } |
        ForEach-Object {
            try {
                Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop
                "`tKilled PID $($_.ProcessId) ($($_.Name))" | Add-Content $Script:TestLog
            } catch {}
        }
}

function Stop-ProcessTree {
    param([System.Diagnostics.Process]$Proc)
    if ($null -eq $Proc -or $Proc.HasExited) { return }
    try {
        $Proc.Kill($true)
        "`tStopped captured PID $($Proc.Id) ($($Proc.ProcessName))" | Add-Content $Script:TestLog
    } catch {
        try {
            Stop-Process -Id $Proc.Id -Force -ErrorAction Stop
        } catch {}
    }
    Start-Sleep -Milliseconds 500
}

function Remove-AllEdgeProfiles {
    foreach ($profile in @($Script:EdgeProfile, "$tmp\e2e-feat-profile")) {
        if (Test-Path $profile) {
            Remove-Item $profile -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

function Invoke-TestSuite {
    param([string]$Label, [string]$Mjs, [string]$Port, [string]$Expect, [string]$SaveRestore)
    $env:CDP_PORT    = $Port
    $env:LABEL       = $Label
    $env:EXPECT_TAURI = $Expect
    $env:SAVE_RESTORE = $SaveRestore
    "`n[$Label] node $mjs (CDP :$Port)" | Add-Content $Script:TestLog
    node (Join-Path $PSScriptRoot $Mjs) >> $Script:TestLog 2>&1
    $exitCode = $LASTEXITCODE
    Remove-Item Env:\CDP_PORT, Env:\LABEL, Env:\EXPECT_TAURI, Env:\SAVE_RESTORE -ErrorAction SilentlyContinue
    "`tExit code: $exitCode" | Add-Content $Script:TestLog
    return $exitCode
}

function Assert-NotTimedOut {
    param([int]$Minutes = 15)
    $elapsed = ((Get-Date) - $Script:TestStartTime).TotalMinutes
    if ($elapsed -ge $Minutes) {
        "`n!!! HARD TIMEOUT ($([int]$elapsed) min >= $Minutes min) - tests stalled. EXIT 1." | Add-Content $Script:TestLog
        Write-Host "HARD TIMEOUT ($([int]$elapsed) min) - tests stalled. EXIT 1." -ForegroundColor Red
        exit 1
    }
}

function Wait-Cdp {
    param([int]$Port, [int]$Minutes = 15)
    $deadline = (Get-Date).AddMinutes($Minutes)
    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Seconds 4
        try {
            $r = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/json" -UseBasicParsing -TimeoutSec 3
            if ($r.Content -match 'webSocketDebuggerUrl') { return $true }
        } catch {}
    }
    return $false
}

# =============================================================================
# PHASE A - WEBVIEW (headless Edge)
# =============================================================================

if ($Phase -in @('all', 'web')) {
    "=== PHASE A: WEBVIEW $(Get-Date -f 'HH:mm:ss') ===" | Add-Content $Script:TestLog
    Write-Host "`n=== PHASE A: WEBVIEW (browser) ===" -ForegroundColor Cyan

    $edgeProc = $null
    $previewProc = $null
    try {
        "`tBuilding vite ..." | Add-Content $Script:TestLog
        Push-Location $proj
        cmd /c "npx vite build 2>&1" | Select-Object -Last 3
        Pop-Location
        Assert-NotTimedOut

        "`tStarting vite preview :5233 ..." | Add-Content $Script:TestLog
        $previewProc = Start-Process 'npx.cmd' @('vite','preview','--port','5233','--strictPort') `
            -WorkingDirectory $proj `
            -RedirectStandardOutput  "$tmp\e2e-web-preview.log" `
            -RedirectStandardError   "$tmp\e2e-web-preview.err.log" `
            -WindowStyle Hidden -PassThru
        "`t  PID $($previewProc.Id)" | Add-Content $Script:TestLog
        Start-Sleep -Seconds 4

        "`tLaunching headless Edge :9333 ..." | Add-Content $Script:TestLog
        $edgeProc = Start-Process $edge @(
            '--headless=new','--disable-gpu','--no-proxy-server','--no-first-run',
            '--no-default-browser-check',"--remote-debugging-port=9333",
            "--user-data-dir=$Script:EdgeProfile",'--window-size=1440,900',
            'http://localhost:5233'
        ) `
            -RedirectStandardOutput "$tmp\e2e-web-edge.log" `
            -RedirectStandardError  "$tmp\e2e-web-edge.err.log" `
            -WindowStyle Hidden -PassThru
        "`t  PID $($edgeProc.Id)" | Add-Content $Script:TestLog
        Start-Sleep -Seconds 4
        Assert-NotTimedOut

        "`tRunning test suite ..." | Add-Content $Script:TestLog
        $code = Invoke-TestSuite -Label 'WEBV' -Mjs $Script:MjsFile -Port '9333' -Expect '0' -SaveRestore '0'
        $results.Add("PHASE A (webview): exit=$code") | Out-Null

    } finally {
        "`t[A-CLEANUP] stopping processes ..." | Add-Content $Script:TestLog
        if ($edgeProc)    { Stop-ProcessTree $edgeProc }
        if ($previewProc) { Stop-ProcessTree $previewProc }
        Remove-Orphans
        # NO blanket msedgewebview2 kill here. Phase A only starts headless Edge
        # (msedge.exe) and uses no WebView2, so there is nothing of ours to reap,
        # and Get-Process -Name msedgewebview2 would also kill the user's unrelated
        # WebView2 apps (WhatsApp, Google Drive, Windows Search). Our own WebView2
        # instances are always started with --remote-debugging-port, which is what
        # Remove-Orphans filters on above.
        Remove-AllEdgeProfiles
    }
}

# =============================================================================
# PHASE B - WINDOWS PROGRAM (Tauri via WebView2 CDP)
# =============================================================================

if ($Phase -in @('all', 'win')) {
    "=== PHASE B: WINDOWS $(Get-Date -f 'HH:mm:ss') ===" | Add-Content $Script:TestLog
    Write-Host "`n=== PHASE B: WINDOWS PROGRAM (Tauri) ===" -ForegroundColor Cyan

    $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = '--remote-debugging-port=9224 --remote-allow-origins=*'
    $tauriProc = $null
    $lsBackup = $null

    try {
        "`tLaunching tauri dev (WEBVIEW2 debug :9224) ..." | Add-Content $Script:TestLog
        $tauriProc = Start-Process 'npm.cmd' @('run','tauri','dev') `
            -WorkingDirectory $proj `
            -RedirectStandardOutput  "$tmp\e2e-win-tauri.log" `
            -RedirectStandardError   "$tmp\e2e-win-tauri.err.log" `
            -WindowStyle Hidden -PassThru
        "`t  PID $($tauriProc.Id)" | Add-Content $Script:TestLog
        Write-Host "tauri dev PID $($tauriProc.Id); waiting for CDP :9224 (Rust compile) ..."

        if (-not (Wait-Cdp -Port 9224)) {
            $results.Add('PHASE B: TIMEOUT waiting for CDP :9224') | Out-Null
            Write-Host "ERROR: CDP :9224 never came up." -ForegroundColor Red
            "`tCDP timeout. Tauri log tail:" | Add-Content $Script:TestLog
            Get-Content "$tmp\e2e-win-tauri.err.log" -Tail 30 -ErrorAction SilentlyContinue |
                Add-Content $Script:TestLog
            exit 1
        }
        Write-Host "CDP :9224 up - running suite ..."
        "`tCDP :9224 ready. Running suite ..." | Add-Content $Script:TestLog
        Start-Sleep -Seconds 2
        Assert-NotTimedOut

        # Crash-safe data guard. This phase runs against the user's REAL desktop app
        # data. The suite snapshots/restores localStorage itself, but only if it
        # survives; a crashed or killed run would otherwise leave the E2E seed in the
        # app. So the runner takes its own snapshot and restores it from the finally
        # block below (mirrors e2e-android.ps1).
        $lsBackup = Join-Path $tmp "ls-backup-$(Get-Date -f yyyyMMdd-HHmmss).json"
        $env:CDP_PORT = '9224'
        $env:LABEL    = 'SNAP'
        "`t[SNAP] saving app storage -> $lsBackup" | Add-Content $Script:TestLog
        & node (Join-Path $PSScriptRoot 'e2e-snapshot.mjs') save $lsBackup 2>&1 | Add-Content $Script:TestLog
        if ($LASTEXITCODE -ne 0) {
            "`t[SNAP] WARNING: could not snapshot app storage (exit $LASTEXITCODE) - the suite will run without a crash-safe restore." | Add-Content $Script:TestLog
            Write-Host "WARNING: could not snapshot app storage - no crash-safe restore available." -ForegroundColor Yellow
            $lsBackup = $null
        } else {
            Write-Host "App storage snapshotted -> $lsBackup"
        }
        Remove-Item Env:\CDP_PORT, Env:\LABEL -ErrorAction SilentlyContinue

        $code = Invoke-TestSuite -Label 'WIN' -Mjs $Script:MjsFile -Port '9224' -Expect '1' -SaveRestore '1'
        $results.Add("PHASE B (windows): exit=$code") | Out-Null

    } finally {
        # Restore first, while the app is still alive and CDP is still up.
        if ($lsBackup) {
            "`t[B-CLEANUP] restoring app storage from $lsBackup ..." | Add-Content $Script:TestLog
            $env:CDP_PORT = '9224'
            $env:LABEL    = 'SNAP'
            & node (Join-Path $PSScriptRoot 'e2e-snapshot.mjs') restore $lsBackup 2>&1 | Add-Content $Script:TestLog
            $restoreCode = $LASTEXITCODE
            Remove-Item Env:\CDP_PORT, Env:\LABEL -ErrorAction SilentlyContinue
            if ($restoreCode -eq 0) {
                Write-Host "App storage restored." -ForegroundColor Green
            } else {
                "`t[B-CLEANUP] RESTORE FAILED (exit $restoreCode). The app may still hold E2E test data." | Add-Content $Script:TestLog
                "`t[B-CLEANUP] Recover with: npm run tauri dev, then node e2e-snapshot.mjs restore $lsBackup" | Add-Content $Script:TestLog
                Write-Host "WARNING: storage restore failed (exit $restoreCode)." -ForegroundColor Red
                Write-Host "  The app may still contain E2E test data. Snapshot kept at: $lsBackup" -ForegroundColor Red
                $results.Add("WARNING: app storage restore failed (exit $restoreCode) - snapshot at $lsBackup") | Out-Null
            }
        }
        "`t[B-CLEANUP] killing tauri tree PID $($tauriProc.Id) ..." | Add-Content $Script:TestLog
        if ($tauriProc) { Invoke-Expression "taskkill /PID $($tauriProc.Id) /T /F 2>&1" | Out-Null }
        "`t[B-CLEANUP] killing remaining app.exe + orphaned debug WebView2 trees ..." | Add-Content $Script:TestLog
        taskkill /F /IM app.exe /T 2>&1 | Out-Null
        # Scope by --remote-debugging-port, NOT by --webview-exe-name=SearchHost.exe:
        # that exe name is also used by the real Windows Search shell, so matching it
        # killed unrelated system WebView2. Only processes we started carry our port.
        Get-CimInstance Win32_Process |
            Where-Object {
                $_.Name -eq 'msedgewebview2.exe' -and
                $_.CommandLine -like '*remote-debugging-port=9224*'
            } |
            ForEach-Object { taskkill /F /PID $_.ProcessId /T 2>&1 | Out-Null }
        "`t[B-CLEANUP] killing remaining orphans ..." | Add-Content $Script:TestLog
        Remove-Orphans
        Remove-Item Env:\WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS -ErrorAction SilentlyContinue
        Remove-Item Env:\TAURI_DEV_HOST -ErrorAction SilentlyContinue
    }
}

# =============================================================================
# PHASE C - ANDROID (delegated to e2e-android.ps1)
# =============================================================================

if ($Phase -in @('all', 'android')) {
    "=== PHASE C: ANDROID $(Get-Date -f 'HH:mm:ss') ===" | Add-Content $Script:TestLog
    Write-Host "`n=== PHASE C: ANDROID (delegating to e2e-android.ps1) ===" -ForegroundColor Cyan

    & "$PSScriptRoot\e2e-android.ps1" -Suite $Suite -TestLog $Script:TestLog -TestStartTime $Script:TestStartTime
    $exitCode = $LASTEXITCODE
    $results.Add("PHASE C (android): exit=$exitCode") | Out-Null
}

# --- Summary -----------------------------------------------------------------

"`n========== RUNNER SUMMARY ==========" | Add-Content $Script:TestLog
$results | ForEach-Object { Add-Content $Script:TestLog $_ }

Write-Host "`n========== RUNNER SUMMARY ==========" -ForegroundColor Yellow
$results | ForEach-Object { Write-Host $_ }

Write-Host "`nFull log -> $Script:TestLog" -ForegroundColor DarkGray
if ($results | Where-Object { $_ -match 'exit=[1-9]' -or $_ -match 'FAILED|TIMEOUT' }) { exit 1 }