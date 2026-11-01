# Shared with the fault checks. No work runs when this file is dot-sourced.
function Invoke-AndroidAdb {
    param([string[]]$Arguments)
    $output = & $adb @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) { throw "adb $($Arguments -join ' ') failed ($LASTEXITCODE): $output" }
    return $output
}

function Invoke-AndroidSnapshot {
    param([string[]]$Arguments)
    & node (Join-Path $PSScriptRoot 'e2e-snapshot.mjs') @Arguments 2>&1 |
        Add-Content $Script:TestLog
    if ($LASTEXITCODE -ne 0) { throw "Storage $($Arguments[0]) FAILED (exit $LASTEXITCODE)" }
}

function Close-AndroidStorage {
    # BACK gives Activity/WebView its normal lifecycle before any process kill.
    # sync alone cannot flush Chromium's pending in-process localStorage writes.
    Invoke-AndroidAdb @('shell', 'input', 'keyevent', 'KEYCODE_BACK') | Out-Null
    Start-Sleep -Seconds 5
    Invoke-AndroidAdb @('shell', 'sync') | Out-Null
    Invoke-AndroidAdb @('shell', 'am', 'force-stop', $pkg) | Out-Null
}

function Restore-AndroidStorage {
    param([string]$Snapshot)
    $oldPort = $env:CDP_PORT
    $oldLabel = $env:LABEL
    $env:CDP_PORT = $cdpPort
    $env:LABEL = 'SNAP'
    try {
        Invoke-AndroidSnapshot @('restore', $Snapshot)
        Close-AndroidStorage
        Invoke-AndroidAdb @('shell', 'am', 'start', '-W', '-n', "$pkg/com.thespellcaster.mrhorakhty.MainActivity") | Out-Null
        $deadline = (Get-Date).AddSeconds(60)
        $freshPid = ''
        while ((Get-Date) -lt $deadline) {
            # pidof returns 1 while Android is still starting the process.
            $raw = & $adb shell pidof $pkg 2>$null
            if ($LASTEXITCODE -eq 0 -and "$raw".Trim() -match '^\d+$') {
                $freshPid = "$raw".Trim()
                break
            }
            Start-Sleep -Seconds 1
        }
        if (-not $freshPid) { throw 'Cold restart FAILED: no app PID within 60 seconds' }
        Invoke-AndroidAdb @('forward', "tcp:$cdpPort", "localabstract:webview_devtools_remote_$freshPid") | Out-Null
        if (-not (Wait-Cdp -Port $cdpPort -Minutes 1)) { throw 'Cold restart FAILED: CDP unavailable' }
        Start-Sleep -Seconds 3
        $coldSnapshot = "$Snapshot.cold.json"
        Invoke-AndroidSnapshot @('save', $coldSnapshot)
        Invoke-AndroidSnapshot @('compare', $Snapshot, $coldSnapshot)
        # Leave the verified board persisted before the runner shuts down its AVD.
        Close-AndroidStorage
        "`t[C-CLEANUP] storage verified FROM DISK after cold restart: $coldSnapshot" |
            Add-Content $Script:TestLog
    } finally {
        $env:CDP_PORT = $oldPort
        $env:LABEL = $oldLabel
    }
}
