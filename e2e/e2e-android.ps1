# e2e-android.ps1 - Standalone Android E2E runner.
# Boots emulator, builds+installs via tauri android dev, forwards WebView CDP, runs suite.
# Can be called standalone or delegated from e2e-full.ps1 (-Phase android).
#
# E2E TEST POLICY: When asked to run E2E, only execute and report results.
# Do NOT modify app code or harness code - wait for user instructions.
param(
    [string]$Suite = 'mobile',
    [string]$TestLog,
    [datetime]$TestStartTime
)
$ErrorActionPreference = 'Continue'

if (-not $TestLog) {
    $Script:TestLog = Join-Path $env:TEMP "opencode\e2e-android-$(Get-Date -f yyyyMMdd-HHmmss).log"
} else {
    $Script:TestLog = $TestLog
}
if (-not $TestStartTime) { $Script:TestStartTime = Get-Date } else { $Script:TestStartTime = $TestStartTime }

$tmp   = Join-Path $env:TEMP 'opencode'
$proj  = Split-Path -Parent $PSScriptRoot
$adb   = "$env:ANDROID_HOME\platform-tools\adb.exe"
$emu   = "$env:ANDROID_HOME\emulator\emulator.exe"
$avd   = 'Pixel_7'
$cdpPort = '9225'
$pkg   = 'com.mrhorakhty.thespellcaster.debug'
$results = [System.Collections.ArrayList]::new()

Write-Host "Test output log -> $Script:TestLog" -ForegroundColor DarkGray
New-Item -ItemType Directory -Path $tmp -Force | Out-Null

# --- Helpers -----------------------------------------------------------------

function Remove-Orphans {
    Get-CimInstance Win32_Process |
        Where-Object {
            ($_.CommandLine -like '*ttrpg-soundboard*') -or
            ($_.CommandLine -like '*vite*5173*') -or
            ($_.Name -eq 'msedgewebview2.exe' -and $_.CommandLine -like '*remote-debugging-port=*')
        } |
        ForEach-Object {
            try {
                Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop
                "`tKilled PID $($_.ProcessId) ($($_.Name))" | Add-Content $Script:TestLog
            } catch {}
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
    param([int]$Minutes = 25)
    $elapsed = ((Get-Date) - $Script:TestStartTime).TotalMinutes
    if ($elapsed -ge $Minutes) {
        "`n!!! HARD TIMEOUT ($([int]$elapsed) min >= $Minutes min) - tests stalled. EXIT 1." | Add-Content $Script:TestLog
        Write-Host "HARD TIMEOUT ($([int]$elapsed) min) - tests stalled. EXIT 1." -ForegroundColor Red
        exit 1
    }
}

function Wait-Cdp {
    param([int]$Port, [int]$Minutes = 5)
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

# --- Main --------------------------------------------------------------------

"=== PHASE C: ANDROID $(Get-Date -f 'HH:mm:ss') ===" | Add-Content $Script:TestLog
Write-Host "`n=== PHASE C: ANDROID (emulator) ===" -ForegroundColor Cyan

$tauriProc = $null
$emulatorStarted = $false

try {
    $emuRunning = & $adb devices 2>&1 | Select-String -Pattern 'emulator-\d+\s+device'
    if (-not $emuRunning) {
        "`tStarting emulator $avd ..." | Add-Content $Script:TestLog
        Start-Process $emu @('-avd', $avd, '-no-snapshot-load') -WindowStyle Hidden -PassThru | Out-Null
        $emulatorStarted = $true
        "`tWaiting for emulator boot (max 5 min) ..." | Add-Content $Script:TestLog
        Write-Host "Waiting for emulator boot (max 5 min) ..."
        & $adb wait-for-device
        $deadline = (Get-Date).AddMinutes(5)
        while ((Get-Date) -lt $deadline) {
            $boot = (& $adb shell getprop sys.boot_completed 2>&1).Trim()
            if ($boot -eq '1') { break }
            Start-Sleep -Seconds 3
        }
        "`tEmulator ready." | Add-Content $Script:TestLog
    } else {
        "`tEmulator already running." | Add-Content $Script:TestLog
    }
    Assert-NotTimedOut -Minutes 25

    "`tLaunching tauri android dev (Rust compile + install) ..." | Add-Content $Script:TestLog
    $tauriProc = Start-Process 'npm.cmd' @('run','tauri','android','dev') `
        -WorkingDirectory $proj `
        -RedirectStandardOutput  "$tmp\e2e-android-tauri.log" `
        -RedirectStandardError   "$tmp\e2e-android-tauri.err.log" `
        -WindowStyle Hidden -PassThru
    "`t  PID $($tauriProc.Id)" | Add-Content $Script:TestLog
    Write-Host "tauri android dev PID $($tauriProc.Id); waiting for app + Vite + CDP ..."

    $deadline = (Get-Date).AddMinutes(15)
    $appReady = $false
    $pidLine = ''
    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Seconds 5
        $raw = & $adb shell pidof $pkg 2>&1
        if ($null -ne $raw) { $pidLine = "$raw".Trim() }
        if ($pidLine -match '^\d+$') { $appReady = $true; break }
    }
    if (-not $appReady) {
        $results.Add('TIMEOUT waiting for app launch') | Out-Null
        Write-Host "ERROR: App never launched on emulator." -ForegroundColor Red
        "`tApp timeout. Tauri log tail:" | Add-Content $Script:TestLog
        Get-Content "$tmp\e2e-android-tauri.err.log" -Tail 30 -ErrorAction SilentlyContinue |
            Add-Content $Script:TestLog
        exit 1
    }
    "`tApp launched on emulator (pid $pidLine)." | Add-Content $Script:TestLog

    "`tForwarding WebView debug socket -> tcp:$cdpPort ..." | Add-Content $Script:TestLog
    & $adb forward "tcp:$cdpPort" "localabstract:webview_devtools_remote_$pidLine" 2>&1 | Out-Null

    if (-not (Wait-Cdp -Port $cdpPort -Minutes 5)) {
        $results.Add("TIMEOUT waiting for CDP :$cdpPort") | Out-Null
        Write-Host "ERROR: CDP :$cdpPort never came up." -ForegroundColor Red
        "`tCDP timeout. Tauri log tail:" | Add-Content $Script:TestLog
        Get-Content "$tmp\e2e-android-tauri.err.log" -Tail 30 -ErrorAction SilentlyContinue |
            Add-Content $Script:TestLog
        exit 1
    }
    Write-Host "CDP :$cdpPort up - running suite ..."
    "`tCDP :$cdpPort ready. Running suite ..." | Add-Content $Script:TestLog
    Start-Sleep -Seconds 2
    Assert-NotTimedOut -Minutes 25

    $mobileSuite = if ($Suite -eq 'full') { 'mobile' } else { $Suite }
    $code = Invoke-TestSuite -Label 'MOB' -Mjs "e2e-$mobileSuite.mjs" -Port $cdpPort -Expect '1' -SaveRestore '1'
    $results.Add("android: exit=$code") | Out-Null

} finally {
    "`t[C-CLEANUP] removing adb forward ..." | Add-Content $Script:TestLog
    & $adb forward --remove "tcp:$cdpPort" 2>&1 | Out-Null
    "`t[C-CLEANUP] killing tauri tree ..." | Add-Content $Script:TestLog
    if ($tauriProc) {
        try { taskkill /PID $tauriProc.Id /T /F 2>&1 | Out-Null } catch {}
    }
    try { taskkill /F /IM app.exe /T 2>&1 | Out-Null } catch {}
    "`t[C-CLEANUP] killing remaining orphans ..." | Add-Content $Script:TestLog
    Remove-Orphans
    if ($emulatorStarted) {
        "`t[C-CLEANUP] stopping emulator ..." | Add-Content $Script:TestLog
        & $adb emu kill 2>&1 | Out-Null
    }
}

# --- Summary -----------------------------------------------------------------

"`n========== ANDROID SUMMARY ==========" | Add-Content $Script:TestLog
$results | ForEach-Object { Add-Content $Script:TestLog $_ }

Write-Host "`n========== ANDROID SUMMARY ==========" -ForegroundColor Yellow
$results | ForEach-Object { Write-Host $_ }

Write-Host "`nLog -> $Script:TestLog" -ForegroundColor DarkGray
if ($results | Where-Object { $_ -match 'exit=[1-9]' -or $_ -match 'FAILED|TIMEOUT' }) { exit 1 }