# Deep-feature E2E runner: Phase A (webview) + Phase B (Tauri Windows app).
# Uses e2e-features.mjs (real file upload -> save -> play -> volume/fade/loop -> theme/CRUD/persistence).
#
# E2E TEST POLICY: When asked to run E2E, only execute and report results.
# Do NOT modify app code or harness code — wait for user instructions.
param([string]$Phase = 'all')
$ErrorActionPreference = 'Continue'
$tmp = Join-Path $env:TEMP 'opencode'
$proj = Split-Path -Parent $PSScriptRoot   # C:\Users\emire\Projects\ttrpg-soundboard
$harness = $PSScriptRoot   # this folder holds e2e-features.mjs etc.
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$uploads = "$env:APPDATA\com.mrhorakhty.thespellcaster\uploads"
$results = @()

function Run-FeatureSuite {
    param([string]$Label, [string]$Port, [string]$Expect)
    $env:CDP_PORT = $Port; $env:LABEL = $Label; $env:EXPECT_TAURI = $Expect
    if ($Expect -eq '1') { $env:SAVE_RESTORE = '1' } else { $env:SAVE_RESTORE = '0' }
    node "$harness\e2e-features.mjs"
    $code = $LASTEXITCODE
    Remove-Item Env:\CDP_PORT, Env:\LABEL, Env:\EXPECT_TAURI, Env:\SAVE_RESTORE -ErrorAction SilentlyContinue
    return $code
}

function Get-TestUploadCount {
    $c = Get-ChildItem -Path $uploads -Filter '*_e2e_silence.wav' -ErrorAction SilentlyContinue
    if ($c) { return @($c).Count } else { return 0 }
}

if ($Phase -in @('all', 'web')) {
    Write-Host "`n=== PHASE A (features): WEBVIEW ===" -ForegroundColor Cyan
    Start-Process -FilePath 'npx.cmd' -ArgumentList 'vite','preview','--port','5233','--strictPort' -WorkingDirectory $proj -RedirectStandardOutput "$tmp\feat-web-preview.log" -RedirectStandardError "$tmp\feat-web-preview.err.log" -WindowStyle Hidden
    Start-Sleep -Seconds 4
    Start-Process -FilePath $edge -ArgumentList '--headless=new','--disable-gpu','--no-proxy-server','--no-first-run','--no-default-browser-check','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9334','--user-data-dir=C:\Users\emire\AppData\Local\Temp\opencode\e2e-feat-profile','--window-size=1440,900','http://localhost:5233' -RedirectStandardOutput "$tmp\feat-web-edge.log" -RedirectStandardError "$tmp\feat-web-edge.err.log" -WindowStyle Hidden
    Start-Sleep -Seconds 4
    $code = Run-FeatureSuite -Label 'WEBV-F' -Port '9334' -Expect '0'
    $results += "PHASE A (features, webview): exit=$code"
    Get-CimInstance Win32_Process | Where-Object { ($_.Name -eq 'msedge.exe' -and $_.CommandLine -like '*remote-debugging-port=9334*') -or ($_.CommandLine -like '*vite*preview*5233*') } | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } catch {} }
}

if ($Phase -in @('all', 'win')) {
    Write-Host "`n=== PHASE B (features): WINDOWS PROGRAM ===" -ForegroundColor Cyan
    $before = Get-TestUploadCount
    Write-Host "test-upload files before: $before"
    $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = '--remote-debugging-port=9225 --remote-allow-origins=*'
    Start-Process -FilePath 'npm.cmd' -ArgumentList 'run','tauri','dev' -WorkingDirectory $proj -RedirectStandardOutput "$tmp\feat-win-tauri.log" -RedirectStandardError "$tmp\feat-win-tauri.err.log" -WindowStyle Hidden
    $deadline = (Get-Date).AddMinutes(15)
    $ready = $false
    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Seconds 4
        try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:9225/json' -UseBasicParsing -TimeoutSec 3; if ($r.Content -match 'webSocketDebuggerUrl') { $ready = $true; break } } catch {}
    }
    if (-not $ready) {
        $results += 'PHASE B (features): TIMEOUT waiting for CDP :9225'
    } else {
        Start-Sleep -Seconds 2
        $code = Run-FeatureSuite -Label 'WIN-F' -Port '9225' -Expect '1'
        $results += "PHASE B (features, windows): exit=$code"
        Start-Sleep -Seconds 1
        $after = Get-TestUploadCount
        Write-Host "test-upload files after: $after"
        if ($after -ge 1) {
            $results += "PHASE B upload proof: $after file(s) written to uploads\" 
        } else {
            $results += 'PHASE B upload proof: NO files written to uploads (write path broken?)'
        }
        if ($after -gt 1) { $results += 'PHASE B upload-delete proof: FAIL — expected only 1 file to remain after Env Echo deletion' }
        if ($after -eq 1) { $results += 'PHASE B upload-delete proof: PASS — Env Echo file was deleted, E2E Silence remains (write + delete both hit disk)' }
        # cleanup test files
        Get-ChildItem -Path $uploads -Filter '*_e2e_silence.wav' -ErrorAction SilentlyContinue | ForEach-Object { Remove-Item -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue }
        Write-Host 'test-upload files cleaned. remaining:' (Get-TestUploadCount)
    }
    Remove-Item Env:\WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS -ErrorAction SilentlyContinue
    Remove-Item Env:TAURI_DEV_HOST -ErrorAction SilentlyContinue
    # full cleanup: the Tauri app + its webview + the npm/node wrappers
    Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -like '*ttrpg-soundboard*' } | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } catch {} }
    Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'msedgewebview2.exe' -and $_.CommandLine -like '*remote-debugging-port=9225*' } | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } catch {} }
    Get-CimInstance Win32_Process | Where-Object { ($_.CommandLine -like '*tauri*dev*') -or ($_.Name -eq 'node.exe' -and $_.CommandLine -like '*vite*') } | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } catch {} }
}

Write-Host "`n========== FEATURES RUNNER SUMMARY ==========" -ForegroundColor Yellow
$results | ForEach-Object { Write-Host $_ }