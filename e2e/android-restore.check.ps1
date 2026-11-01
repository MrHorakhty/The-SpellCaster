#requires -Version 7.0
# Exercise production restore orchestration without a device or user storage.
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'android-restore.ps1')
$adbWrapper = ${function:Invoke-AndroidAdb}
$snapshotWrapper = ${function:Invoke-AndroidSnapshot}
$adb = 'Mock-Adb'
$pkg = 'fixture.debug'
$cdpPort = '9225'
$Script:TestLog = Join-Path (Split-Path $PSScriptRoot) ('logs/android-restore-check-' + (Get-Date -Format yyyyMMdd-HHmmss) + '.log')
$count = 0
function Assert($Condition, $Message) {
    if (-not $Condition) { throw $Message }
    $script:count++
    Write-Host "PASS $Message"
}
function Mock-Adb { $global:LASTEXITCODE = $script:nativeExit; return '456' }
function node { $global:LASTEXITCODE = $script:nativeExit; return 'fixture diagnostic' }
function Start-Sleep {}
function Wait-Cdp { return $script:cdpReady }
function Invoke-AndroidAdb {
    param([string[]]$Arguments)
    $step = $Arguments -join ' '
    $script:steps.Add($step)
    if ($step -eq $script:failAt) { throw 'Injected adb failure' }
}
function Invoke-AndroidSnapshot {
    param([string[]]$Arguments)
    $script:steps.Add($Arguments[0])
    if ($Arguments[0] -eq $script:failAt) { throw 'Injected snapshot failure' }
}
$beforePort = $env:CDP_PORT
$beforeLabel = $env:LABEL
try {
    foreach ($script:nativeExit in @(0, 17)) {
        $failed = $false
        try { & $adbWrapper @('shell', 'sync') | Out-Null } catch { $failed = $true }
        Assert ($failed -eq ($nativeExit -ne 0)) "ADB wrapper respects native exit $nativeExit"
        $failed = $false
        try { & $snapshotWrapper @('compare', 'expected.json', 'actual.json') } catch { $failed = $true }
        Assert ($failed -eq ($nativeExit -ne 0)) "Snapshot wrapper respects native exit $nativeExit"
    }
    $script:nativeExit = 0
    $env:CDP_PORT = 'original-port'
    $env:LABEL = 'original-label'
    $script:steps = [Collections.Generic.List[string]]::new()
    $script:failAt = ''
    $script:cdpReady = $true
    Restore-AndroidStorage 'original.json'
    $expected = @('restore', 'shell input keyevent KEYCODE_BACK', 'shell sync',
        'shell am force-stop fixture.debug',
        'shell am start -W -n fixture.debug/com.thespellcaster.mrhorakhty.MainActivity',
        'forward tcp:9225 localabstract:webview_devtools_remote_456', 'save', 'compare',
        'shell input keyevent KEYCODE_BACK', 'shell sync', 'shell am force-stop fixture.debug')
    Assert (($steps -join '|') -eq ($expected -join '|')) 'Restore, graceful close, cold launch, fresh CDP, disk compare, final close in order'
    Assert ($env:CDP_PORT -eq 'original-port' -and $env:LABEL -eq 'original-label') 'Success restores caller environment'
    foreach ($failure in @('restore', 'shell input keyevent KEYCODE_BACK', 'shell sync',
        'shell am force-stop fixture.debug',
        'shell am start -W -n fixture.debug/com.thespellcaster.mrhorakhty.MainActivity',
        'forward tcp:9225 localabstract:webview_devtools_remote_456', 'save', 'compare')) {
        $script:steps.Clear()
        $script:failAt = $failure
        $failed = $false
        try { Restore-AndroidStorage 'original.json' } catch { $failed = $true }
        Assert ($failed -and $steps[$steps.Count - 1] -eq $failure) "Failure propagates and stops dependent steps: $failure"
        Assert ($env:CDP_PORT -eq 'original-port' -and $env:LABEL -eq 'original-label') 'Failure restores caller environment'
    }
    $script:failAt = ''
    $script:cdpReady = $false
    $script:steps.Clear()
    $failed = $false
    try { Restore-AndroidStorage 'original.json' } catch { $failed = $_ -match 'CDP unavailable' }
    Assert ($failed -and -not $steps.Contains('save')) 'Unavailable cold CDP fails before snapshot/compare'
} finally {
    $env:CDP_PORT = $beforePort
    $env:LABEL = $beforeLabel
}
Write-Host "$count/$count PASS"
