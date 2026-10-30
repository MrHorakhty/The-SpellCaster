#requires -Version 5.1
# Read-only by default. No IDE, emulator, installation, signing or credential access.
[CmdletBinding()]
param(
    [switch]$Build,
    [ValidateRange(1, 3600)]
    [int]$BuildTimeoutSeconds = 900,
    [string]$ApkPath,
    [ValidatePattern('^[A-Fa-f0-9:]{64,95}$')]
    [string]$ExpectedCertificate = '6E:E2:C6:2B:43:4B:A6:A6:A1:D6:63:A0:60:D4:A1:56:49:41:26:A2:5D:CF:55:48:0A:78:3E:D2:0C:3C:F3:C8'
)
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$stamp = Get-Date -Format yyyyMMdd-HHmmss
$logDir = Join-Path $root 'logs'
$null = New-Item -ItemType Directory -Force -Path $logDir
$log = Join-Path $logDir "android-preflight-$PID-$stamp.log"
$status = Join-Path $logDir "android-preflight-$PID-$stamp.json"
$checks = [Collections.Generic.List[object]]::new()
$buildExit = $null
function Record($Name, $Level, $Detail) {
    $checks.Add([pscustomobject]@{ name = $Name; status = $Level; detail = $Detail })
    $line = "[$Level] $Name : $Detail"
    Write-Host $line
    Add-Content -LiteralPath $log -Value $line -Encoding UTF8
}
function Invoke-Tool($File, $Arguments) {
    # Merge stderr without turning native diagnostic output into a terminating error.
    $saved = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $output = @(& $File @Arguments 2>&1 | ForEach-Object {
            $line = "$_"
            Add-Content -LiteralPath $log -Value $line -Encoding UTF8
            $line
        })
        $code = $LASTEXITCODE
    } finally { $ErrorActionPreference = $saved }
    return [pscustomobject]@{ code = $code; text = ($output -join "`n") }
}
Push-Location $root
try {
    Record 'Mode' 'PASS' $(if ($Build) { 'Explicit release build requested; no install or signing.' } else { 'Inspection only; no build, IDE or device required.' })
    foreach ($name in @('node.exe', 'npm.cmd', 'cargo.exe', 'rustup.exe')) {
        $command = Get-Command $name -ErrorAction SilentlyContinue
        if ($command) {
            $result = Invoke-Tool $command.Source @('--version')
            Record $name $(if ($result.code -eq 0) { 'PASS' } else { 'FAIL' }) $result.text
        } else { Record $name 'FAIL' 'Missing on PATH.' }
    }
    $java = if ($env:JAVA_HOME) { Join-Path $env:JAVA_HOME 'bin/java.exe' } else { (Get-Command java.exe -ErrorAction SilentlyContinue).Source }
    if ($java -and (Test-Path -LiteralPath $java)) {
        $result = Invoke-Tool $java @('-version')
        $major = if ($result.text -match 'version "(\d+)') { [int]$Matches[1] } else { 0 }
        Record 'Java' $(if ($result.code -eq 0 -and $major -ge 17) { 'PASS' } else { 'FAIL' }) "JDK major $major; Android Gradle plugin requires 17 or newer. $java"
        Record 'Java compiler' $(if (Test-Path -LiteralPath (Join-Path (Split-Path $java) 'javac.exe')) { 'PASS' } else { 'FAIL' }) 'A full JDK, rather than a Java runtime, is required.'
    } else { Record 'Java' 'FAIL' 'JAVA_HOME/bin/java.exe or java on PATH is missing.' }
    $sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { $env:ANDROID_SDK_ROOT }
    if ($env:ANDROID_HOME -and $env:ANDROID_SDK_ROOT -and $env:ANDROID_HOME.TrimEnd('\') -ine $env:ANDROID_SDK_ROOT.TrimEnd('\')) {
        Record 'SDK environment' 'FAIL' 'ANDROID_HOME and ANDROID_SDK_ROOT disagree.'
    }
    $android = Join-Path $root 'src-tauri/gen/android'
    foreach ($relative in @('gradlew.bat', 'gradle/wrapper/gradle-wrapper.jar', 'gradle/wrapper/gradle-wrapper.properties', 'settings.gradle', 'app/build.gradle.kts', 'app/src/main/AndroidManifest.xml')) {
        Record $relative $(if (Test-Path -LiteralPath (Join-Path $android $relative)) { 'PASS' } else { 'FAIL' }) 'Required Android source/wrapper file.'
    }
    $wrapper = Get-Content -LiteralPath (Join-Path $android 'gradle/wrapper/gradle-wrapper.properties') -Raw
    Record 'Gradle distribution' $(if ($wrapper -match 'distributionUrl=.*gradle-[\d.]+-(bin|all)\.zip') { 'PASS' } else { 'FAIL' }) 'Wrapper distribution declared; actual Gradle execution is checked only with -Build.'
    Record 'Local Tauri CLI' $(if (Test-Path -LiteralPath (Join-Path $root 'node_modules/@tauri-apps/cli/tauri.js')) { 'PASS' } else { 'FAIL' }) 'Install project dependencies with npm install if missing.'
    $config = Get-Content -LiteralPath 'src-tauri/tauri.conf.json' -Raw | ConvertFrom-Json
    $package = Get-Content -LiteralPath 'package.json' -Raw | ConvertFrom-Json
    $gradle = Get-Content -LiteralPath (Join-Path $android 'app/build.gradle.kts') -Raw
    $id = if ($gradle -match 'applicationId\s*=\s*"([^"]+)"') { $Matches[1] } else { '' }
    Record 'Package identity' $(if ($id -eq $config.identifier) { 'PASS' } else { 'FAIL' }) "Tauri=$($config.identifier); Android=$id"
    Record 'Source version' $(if ($package.version -eq $config.version) { 'PASS' } else { 'FAIL' }) "npm=$($package.version); Tauri=$($config.version)"
    $compileSdk = if ($gradle -match 'compileSdk\s*=\s*(\d+)') { $Matches[1] } else { '' }
    $tools = $null
    if ($sdk -and (Test-Path -LiteralPath $sdk)) {
        Record 'SDK' 'PASS' $sdk
        foreach ($relative in @('platform-tools/adb.exe', "platforms/android-$compileSdk/android.jar")) {
            Record $relative $(if (Test-Path -LiteralPath (Join-Path $sdk $relative)) { 'PASS' } else { 'FAIL' }) 'Required SDK component.'
        }
        $tools = Get-ChildItem -LiteralPath (Join-Path $sdk 'build-tools') -Directory -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -match '^\d+\.\d+\.\d+$' } | Sort-Object { [version]$_.Name } -Descending | Select-Object -First 1
        foreach ($name in @('aapt2.exe', 'apksigner.bat')) {
            Record $name $(if ($tools -and (Test-Path -LiteralPath (Join-Path $tools.FullName $name))) { 'PASS' } else { 'FAIL' }) 'Android build-tools.'
        }
        $ndk = if ($env:NDK_HOME) { $env:NDK_HOME } elseif ($env:ANDROID_NDK_HOME) { $env:ANDROID_NDK_HOME } else { '' }
        if (-not $ndk) {
            $installed = Get-ChildItem -LiteralPath (Join-Path $sdk 'ndk') -Directory -ErrorAction SilentlyContinue |
                Where-Object { $_.Name -match '^\d+\.\d+\.\d+$' } | Sort-Object { [version]$_.Name } -Descending | Select-Object -First 1
            if ($installed) { $ndk = $installed.FullName }
        }
        Record 'NDK' $(if ($ndk -and (Test-Path -LiteralPath (Join-Path $ndk 'toolchains/llvm/prebuilt/windows-x86_64/bin/clang.exe'))) { 'PASS' } else { 'FAIL' }) "Resolved NDK: $ndk"
    } else { Record 'SDK' 'FAIL' 'Set ANDROID_HOME to an installed Android SDK.' }
    if (Get-Command rustup.exe -ErrorAction SilentlyContinue) {
        $result = Invoke-Tool 'rustup.exe' @('target', 'list', '--installed')
        Record 'Rust Android ARM64 target' $(if ($result.code -eq 0 -and $result.text -match '(?m)^aarch64-linux-android\s*$') { 'PASS' } else { 'FAIL' }) 'Requires rustup target add aarch64-linux-android.'
    }
    if ($Build) {
        try {
            $active = @(Get-CimInstance Win32_Process -ErrorAction Stop | Where-Object {
                $_.Name -eq 'studio64.exe' -or $_.CommandLine -match 'tauri\.js["\s]+android\s+(dev|build)'
            })
            if ($active.Count) { Record 'Build concurrency' 'FAIL' 'Android Studio or another Tauri Android pipeline is active. Close it before building; nothing was stopped.' }
        } catch { Record 'Build concurrency' 'FAIL' 'Cannot inspect running processes; build refused.' }
        if (@($checks | Where-Object status -eq 'FAIL').Count) { Record 'Release build' 'FAIL' 'Not started: resolve preflight failures first.' }
        else {
            Write-Host "Building release APK; output captured in $log"
            $stdout = Join-Path $logDir "android-preflight-build-stdout-$PID-$stamp.log"
            $stderr = Join-Path $logDir "android-preflight-build-stderr-$PID-$stamp.log"
            Record 'Build output' 'PASS' "Live stdout: $stdout; stderr: $stderr"
            $process = Start-Process -FilePath (Get-Command node.exe).Source -ArgumentList @('node_modules/@tauri-apps/cli/tauri.js', 'android', 'build', '--apk', '--target', 'aarch64', '--ci') -WorkingDirectory $root -WindowStyle Hidden -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
            # Retain the process handle so Windows PowerShell also keeps ExitCode.
            $null = $process.Handle
            if (-not $process.WaitForExit($BuildTimeoutSeconds * 1000)) {
                $killed = Invoke-Tool (Join-Path $env:SystemRoot 'System32/taskkill.exe') @('/PID', "$($process.Id)", '/T', '/F')
                if ($killed.code -ne 0 -and -not $process.HasExited) { throw 'Could not stop timed-out build process tree.' }
                $process.WaitForExit()
                Record 'Build timeout' 'FAIL' "Stopped this probe's process tree after $BuildTimeoutSeconds seconds. See native output logs."
            }
            $buildExit = $process.ExitCode
            Record 'Release build' $(if ($buildExit -eq 0) { 'PASS' } else { 'FAIL' }) "Native exit code $buildExit. Full output retained in log; no fallback build masks the failure."
            if ($buildExit -eq 0) {
                $outputDir = Join-Path $android 'app/build/outputs/apk/universal/release'
                $artifact = Get-ChildItem -LiteralPath $outputDir -Filter '*.apk' -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
                if ($artifact) {
                    $result = Invoke-Tool (Join-Path $tools.FullName 'aapt2.exe') @('dump', 'badging', $artifact.FullName)
                    $correctId = $result.text.Contains("package: name='$($config.identifier)'")
                    $correctVersion = $result.text.Contains("versionName='$($config.version)'")
                    Record 'Build APK output' $(if ($artifact.Length -gt 0 -and $result.code -eq 0 -and $correctId -and $correctVersion) { 'PASS' } else { 'FAIL' }) "$($artifact.FullName); SHA256=$((Get-FileHash -LiteralPath $artifact.FullName).Hash). Gradle may reuse up-to-date output; signing is checked separately with -ApkPath."
                } else { Record 'Build APK output' 'FAIL' 'Build exited zero but no release APK exists in the expected output directory.' }
            }
        }
    }
    if ($ApkPath) {
        if (-not (Test-Path -LiteralPath $ApkPath -PathType Leaf)) { Record 'APK' 'FAIL' "Not found: $ApkPath" }
        elseif ($tools) {
            $resolvedApk = (Resolve-Path -LiteralPath $ApkPath).Path
            Record 'APK evidence' 'PASS' "$resolvedApk; SHA256=$((Get-FileHash -LiteralPath $resolvedApk -Algorithm SHA256).Hash); inspected independently of build status."
            $result = Invoke-Tool (Join-Path $tools.FullName 'aapt2.exe') @('dump', 'badging', $resolvedApk)
            $apkId = if ($result.text -match "package: name='([^']+)'" ) { $Matches[1] } else { '' }
            $apkVersion = if ($result.text -match "versionName='([^']+)'" ) { $Matches[1] } else { '' }
            Record 'APK identity/version' $(if ($result.code -eq 0 -and $apkId -eq $config.identifier -and $apkVersion -eq $config.version) { 'PASS' } else { 'FAIL' }) "Package=$apkId; version=$apkVersion"
            $result = Invoke-Tool (Join-Path $tools.FullName 'apksigner.bat') @('verify', '--verbose', '--print-certs', $resolvedApk)
            $actual = if ($result.text -match 'Signer #1 certificate SHA-256 digest:\s*([a-fA-F0-9]+)') { $Matches[1] } else { '' }
            Record 'APK signature/certificate' $(if ($result.code -eq 0 -and $actual -and $actual -ieq $ExpectedCertificate.Replace(':', '')) { 'PASS' } else { 'FAIL' }) "Signature verification exit=$($result.code); certificate SHA256=$actual"
        } else { Record 'APK inspection' 'FAIL' 'Android build-tools unavailable.' }
    } else { Record 'APK inspection' 'WARN' 'Not requested. Supply -ApkPath to verify a signed release; preflight alone does not prove release readiness.' }
} catch { Record 'Checker execution' 'FAIL' $_.Exception.Message }
finally { Pop-Location }
$pass = @($checks | Where-Object status -eq 'PASS').Count
$fail = @($checks | Where-Object status -eq 'FAIL').Count
$warn = @($checks | Where-Object status -eq 'WARN').Count
$exitCode = if ($fail) { 2 } elseif ($warn) { 1 } else { 0 }
[pscustomobject]@{ pass = $pass; fail = $fail; warn = $warn; exitCode = $exitCode; buildExitCode = $buildExit; checks = @($checks.ToArray()); log = $log } |
    ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $status -Encoding UTF8
Write-Host "$pass PASS / $fail FAIL / $warn WARN; exit $exitCode`nLog: $log`nStatus: $status"
exit $exitCode
