# e2e-all.ps1 — Robust process-lifecycle E2E runner.
# Phase A (headless Edge browser) + Phase B (Tauri Windows app via WebView2 CDP).
# Requirements: Start-Process -PassThru capture, try/finally cleanup, output redirect,
#               hard 15-min timeout, aggressive msedgewebview2 kill in finally.
param([string]$Phase = 'all', [string]$Suite = 'full')
$ErrorActionPreference = 'Continue'
$Script:TestLog = Join-Path $env:TEMP "opencode\e2e-run-$(Get-Date -f yyyyMMdd-HHmmss).log"
$Script:EdgeProfile = Join-Path $env:TEMP 'opencode\e2e-web-profile'
$Script:TestStartTime = Get-Date

$tmp  = Join-Path $env:TEMP 'opencode'
$proj = Split-Path -Parent $PSScriptRoot   # C:\Users\emire\Projects\ttrpg-soundboard
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$results = [System.Collections.ArrayList]::new()
$Script:MjsFile = "e2e-$Suite.mjs"

# ── Output log ───────────────────────────────────────────────────────────────
# All node test output goes to this file instead of the terminal to avoid
# buffer truncation. The summary + status messages still go to the console.
Write-Host "Test output log → $Script:TestLog" -ForegroundColor DarkGray
New-Item -ItemType Directory -Path $tmp -Force | Out-Null
"=== E2E RUNNER $(Get-Date -f 'yyyy-MM-dd HH:mm:ss') ===" | Set-Content $Script:TestLog

# ── Cleanup helpers ──────────────────────────────────────────────────────────

function Remove-Orphans {
    Get-CimInstance Win32_Process |
        Where-Object {
            ($_.CommandLine -like '*ttrpg-soundboard*') -or
            ($_.CommandLine -like '*vite*preview*5233*') -or
            ($_.CommandLine -like '*vite*5173*') -or
            ($_.Name -eq 'msedge.exe' -and $_.CommandLine -like '*remote-debugging-port=*') -or
            ($_.Name -eq 'msedgewebview2.exe' -and $_.CommandLine -like '*remote-debugging-port=*')
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
    $env:CDP_PORT        = $Port
    $env:LABEL            = $Label
    $env:EXPECT_TAURI     = $Expect
    $env:SAVE_RESTORE     = $SaveRestore
    "`n[$Label] node $mjs (CDP :$Port) …" | Add-Content $Script:TestLog
    node (Join-Path $PSScriptRoot $Mjs) >> $Script:TestLog 2>&1
    $exitCode = $LASTEXITCODE
    Remove-Item Env:\CDP_PORT, Env:\LABEL, Env:\EXPECT_TAURI, Env:\SAVE_RESTORE -ErrorAction SilentlyContinue
    "`tExit code: $exitCode" | Add-Content $Script:TestLog
    return $exitCode
}

function Assert-NotTimedOut {
    $elapsed = ((Get-Date) - $Script:TestStartTime).TotalMinutes
    if ($elapsed -ge 15) {
        "`n!!! HARD TIMEOUT ($([int]$elapsed) min >= 15 min) -- tests stalled. EXIT 1." | Add-Content $Script:TestLog
        Write-Host "HARD TIMEOUT ($([int]$elapsed) min) -- tests stalled. EXIT 1." -ForegroundColor Red
        exit 1
    }
}

# ══════════════════════════════════════════════════════════════════════════════
# PHASE A — WEBVIEW (headless Edge)
# ══════════════════════════════════════════════════════════════════════════════

if ($Phase -in @('all', 'web')) {
    "=== PHASE A: WEBVIEW $(Get-Date -f 'HH:mm:ss') ===" | Add-Content $Script:TestLog
    Write-Host "`n=== PHASE A: WEBVIEW (browser) ===" -ForegroundColor Cyan

    $edgeProc = $null
    $previewProc = $null
    try {
        # Build
        "`tBuilding vite …" | Add-Content $Script:TestLog
        Push-Location $proj
        cmd /c "npx vite build 2>&1" | Select-Object -Last 3
        if ($LASTEXITCODE -ne 0) {
            $results.Add('PHASE A: vite build FAILED') | Out-Null
            Write-Host "`tvite build FAILED (exit $LASTEXITCODE)" -ForegroundColor Red
        }
        Pop-Location
        Assert-NotTimedOut

        # Serve
        "`tStarting vite preview :5233 …" | Add-Content $Script:TestLog
        $previewProc = Start-Process 'npx.cmd' @('vite','preview','--port','5233','--strictPort') `
            -WorkingDirectory $proj `
            -RedirectStandardOutput  "$tmp\e2e-web-preview.log" `
            -RedirectStandardError   "$tmp\e2e-web-preview.err.log" `
            -WindowStyle Hidden -PassThru
        "`t  PID $($previewProc.Id)" | Add-Content $Script:TestLog
        Start-Sleep -Seconds 4

        # Headless Edge
        "`tLaunching headless Edge :9333 …" | Add-Content $Script:TestLog
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

        # Run suite
        "`tRunning test suite …" | Add-Content $Script:TestLog
        $code = Invoke-TestSuite -Label 'WEBV' -Mjs $Script:MjsFile -Port '9333' -Expect '0' -SaveRestore '0'
        $results.Add("PHASE A (webview): exit=$code") | Out-Null

    } finally {
        "`t[A-CLEANUP] stopping processes …" | Add-Content $Script:TestLog
        if ($edgeProc)    { Stop-ProcessTree $edgeProc }
        if ($previewProc) { Stop-ProcessTree $previewProc }
        Remove-Orphans
        "`t[A-CLEANUP] killing ALL msedgewebview2 …" | Add-Content $Script:TestLog
        Get-Process -Name msedgewebview2 -ErrorAction SilentlyContinue |
            Stop-Process -Force -ErrorAction SilentlyContinue
        Remove-AllEdgeProfiles
    }
}

# ══════════════════════════════════════════════════════════════════════════════
# PHASE B — WINDOWS PROGRAM (Tauri via WebView2 CDP)
# ══════════════════════════════════════════════════════════════════════════════

if ($Phase -in @('all', 'win')) {
    "=== PHASE B: WINDOWS $(Get-Date -f 'HH:mm:ss') ===" | Add-Content $Script:TestLog
    Write-Host "`n=== PHASE B: WINDOWS PROGRAM (Tauri) ===" -ForegroundColor Cyan

    $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = '--remote-debugging-port=9224 --remote-allow-origins=*'
    $tauriProc = $null

    try {
        # Launch tauri dev (captured)
        "`tLaunching tauri dev (WEBVIEW2 debug :9224) …" | Add-Content $Script:TestLog
        $tauriProc = Start-Process 'npm.cmd' @('run','tauri','dev') `
            -WorkingDirectory $proj `
            -RedirectStandardOutput  "$tmp\e2e-win-tauri.log" `
            -RedirectStandardError   "$tmp\e2e-win-tauri.err.log" `
            -WindowStyle Hidden -PassThru
        "`t  PID $($tauriProc.Id)" | Add-Content $Script:TestLog
        Write-Host "tauri dev PID $($tauriProc.Id); waiting for CDP :9224 (Rust compile) …"

        # Poll CDP with 15-min hard ceiling (independent of the test-level timeout)
        $deadline = (Get-Date).AddMinutes(15)
        $ready = $false
        while ((Get-Date) -lt $deadline) {
            Start-Sleep -Seconds 4
            try {
                $r = Invoke-WebRequest -Uri 'http://127.0.0.1:9224/json' -UseBasicParsing -TimeoutSec 3
                if ($r.Content -match 'webSocketDebuggerUrl') { $ready = $true; break }
            } catch {}
        }
        if (-not $ready) {
            $results.Add('PHASE B: TIMEOUT waiting for CDP :9224') | Out-Null
            Write-Host "ERROR: CDP :9224 never came up." -ForegroundColor Red
            "`tCDP timeout. Tauri log tail:" | Add-Content $Script:TestLog
            Get-Content "$tmp\e2e-win-tauri.err.log" -Tail 30 -ErrorAction SilentlyContinue |
                Add-Content $Script:TestLog
            # Exit early — finally block still runs
            exit 1
        }
        Write-Host 'CDP :9224 up — running suite …'
        "`tCDP :9224 ready. Running suite …" | Add-Content $Script:TestLog
        Start-Sleep -Seconds 2
        Assert-NotTimedOut

        $code = Invoke-TestSuite -Label 'WIN' -Mjs $Script:MjsFile -Port '9224' -Expect '1' -SaveRestore '1'
        $results.Add("PHASE B (windows): exit=$code") | Out-Null

    } finally {
        "`t[B-CLEANUP] stopping tauri PID $($tauriProc.Id) …" | Add-Content $Script:TestLog
        if ($tauriProc) { Stop-ProcessTree $tauriProc }
        "`t[B-CLEANUP] killing ALL msedgewebview2 …" | Add-Content $Script:TestLog
        Get-Process -Name msedgewebview2 -ErrorAction SilentlyContinue |
            Stop-Process -Force -ErrorAction SilentlyContinue
        "`t[B-CLEANUP] killing remaining orphans …" | Add-Content $Script:TestLog
        Remove-Orphans
        Remove-Item Env:\WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS -ErrorAction SilentlyContinue
        Remove-Item Env:\TAURI_DEV_HOST -ErrorAction SilentlyContinue
    }
}

# ── Summary ──────────────────────────────────────────────────────────────────

"`n========== RUNNER SUMMARY ==========" | Add-Content $Script:TestLog
$results | ForEach-Object { Add-Content $Script:TestLog $_ }

Write-Host "`n========== RUNNER SUMMARY ==========" -ForegroundColor Yellow
$results | ForEach-Object { Write-Host $_ }

Write-Host "`nFull log → $Script:TestLog" -ForegroundColor DarkGray
if ($results | Where-Object { $_ -match 'exit=[1-9]' -or $_ -match 'FAILED|TIMEOUT' }) { exit 1 }
