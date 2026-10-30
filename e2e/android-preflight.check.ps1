#requires -Version 7.0
# Fault injection uses child-process environment only; no SDK/project changes.
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$engine = if ($env:PREFLIGHT_TEST_ENGINE) { $env:PREFLIGHT_TEST_ENGINE } else { (Get-Process -Id $PID).Path }
$count = 0
function Assert($Condition, $Message) {
    if (-not $Condition) { throw $Message }
    $script:count++
    Write-Host "PASS $Message"
}
function Run-Case($Arguments, $Environment, $Script = (Join-Path $root 'android-preflight.ps1')) {
    $info = [Diagnostics.ProcessStartInfo]::new()
    $info.FileName = $engine
    $info.UseShellExecute = $false
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    foreach ($arg in @('-NoProfile', '-File', $Script) + $Arguments) { $info.ArgumentList.Add($arg) }
    foreach ($key in $Environment.Keys) { $info.Environment[$key] = $Environment[$key] }
    $process = [Diagnostics.Process]::Start($info)
    $stdout = $process.StandardOutput.ReadToEndAsync()
    $stderr = $process.StandardError.ReadToEndAsync()
    $process.WaitForExit()
    $output = $stdout.GetAwaiter().GetResult() + $stderr.GetAwaiter().GetResult()
    if ($output -notmatch 'Status: ([^\r\n]+)') { throw "No report: $output" }
    $report = Get-Content -LiteralPath $Matches[1] -Raw | ConvertFrom-Json
    Assert ($process.ExitCode -eq $report.exitCode) 'Process exit matches JSON'
    return $report
}
$missing = Join-Path $root 'logs/nonexistent-preflight-sdk'
$report = Run-Case @('-Build') @{ ANDROID_HOME = $missing; ANDROID_SDK_ROOT = $missing }
Assert ($report.fail -ge 2 -and $report.exitCode -eq 2) 'Missing SDK fails even with build requested'
Assert ($null -eq $report.buildExitCode) 'Blocked build was never invoked'
Assert (@($report.checks | Where-Object { $_.name -eq 'Release build' -and $_.detail -like 'Not started:*' }).Count -eq 1) 'Blocked build reports why'
$report = Run-Case @('-ApkPath', (Join-Path $missing 'missing.apk')) @{}
Assert (@($report.checks | Where-Object { $_.name -eq 'APK' -and $_.status -eq 'FAIL' }).Count -eq 1) 'Missing APK fails explicitly'
$report = Run-Case @() @{ JAVA_HOME = $missing }
Assert (@($report.checks | Where-Object { $_.name -eq 'Java' -and $_.status -eq 'FAIL' }).Count -eq 1) 'Broken JAVA_HOME fails without PATH fallback'
Assert (@($report.checks | Where-Object { $_.name -eq 'APK inspection' -and $_.status -eq 'WARN' }).Count -eq 1) 'No APK remains a visible warning'
if ($env:PREFLIGHT_BUILD_FIXTURES -eq '1') {
    # Opt-in host check: real prerequisites, isolated fake CLI. Never builds the app.
    $fixture = Join-Path $root ('logs/preflight-fixture-' + (Get-Date -Format yyyyMMdd-HHmmss))
    foreach ($relative in @('android-preflight.ps1', 'package.json', 'src-tauri/tauri.conf.json',
        'src-tauri/gen/android/gradlew.bat', 'src-tauri/gen/android/gradle/wrapper/gradle-wrapper.jar',
        'src-tauri/gen/android/gradle/wrapper/gradle-wrapper.properties', 'src-tauri/gen/android/settings.gradle',
        'src-tauri/gen/android/app/build.gradle.kts', 'src-tauri/gen/android/app/src/main/AndroidManifest.xml')) {
        $destination = Join-Path $fixture $relative
        $null = New-Item -ItemType Directory -Force -Path (Split-Path $destination)
        Copy-Item -LiteralPath (Join-Path $root $relative) -Destination $destination
    }
    $cli = Join-Path $fixture 'node_modules/@tauri-apps/cli/tauri.js'
    $null = New-Item -ItemType Directory -Force -Path (Split-Path $cli)
    Set-Content -LiteralPath $cli -Value 'console.error("fixture original failure"); process.exit(7);'
    $report = Run-Case @('-Build') @{} (Join-Path $fixture 'android-preflight.ps1')
    Assert ($report.buildExitCode -eq 7 -and $report.exitCode -eq 2) 'Original nonzero build exit survives unchanged'
    $native = Get-ChildItem -LiteralPath (Join-Path $fixture 'logs') -Filter '*stderr*.log' | Select-Object -First 1
    Assert ((Get-Content $native.FullName -Raw) -match 'fixture original failure') 'Original build diagnostic retained'
    Set-Content -LiteralPath $cli -Value 'process.exit(0);'
    $report = Run-Case @('-Build') @{} (Join-Path $fixture 'android-preflight.ps1')
    Assert ($report.buildExitCode -eq 0 -and @($report.checks | Where-Object { $_.name -eq 'Build APK output' -and $_.status -eq 'FAIL' }).Count -eq 1) 'Zero build exit without an APK fails'
    Set-Content -LiteralPath $cli -Value 'setInterval(() => {}, 1000);'
    $report = Run-Case @('-Build', '-BuildTimeoutSeconds', '1') @{} (Join-Path $fixture 'android-preflight.ps1')
    Assert (@($report.checks | Where-Object { $_.name -eq 'Build timeout' -and $_.status -eq 'FAIL' }).Count -eq 1) 'Hung build times out and fails'
}
Write-Host "$count/$count PASS"
