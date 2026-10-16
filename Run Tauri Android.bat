@echo off
rem ===========================================================
rem  BUILD + INSTALL + RUN the Android debug app.
rem
rem  NOT a plain launcher: this runs the whole debug pipeline - it
rem  starts Vite, rebuilds the APK and REINSTALLS it, which
rem  FORCE-STOPS the app. To only open the app that is already
rem  installed, use "Launch App Android.bat" instead.
rem
rem  Why these guards exist (2026-10-16): two copies of the old
rem  src-tauri\gen\android\Run App.bat were left running at once,
rem  one killed the other's Vite on port 5173, and a debug app left
rem  running against a dead dev server produced a FALSE bug report
rem  that cost five rounds of investigation. See PROJECT_STATE.md.
rem
rem  Deliberate difference from the sibling Run*.bat files: the
rem  project root comes from %~dp0 instead of a hardcoded path, so
rem  this file is portable and can be tracked in git. The old gen\
rem  copy was untracked AND excluded from backups, so it existed in
rem  exactly one place on one machine.
rem
rem  Written with goto labels rather than if-blocks on purpose: an
rem  unescaped ) inside echo text - "process(es)" - silently ends an
rem  if-block early in cmd. Labels cannot be broken that way.
rem ===========================================================
setlocal
cd /d "%~dp0"
set "ROOT=%~dp0"

rem --- guard 1: refuse to start a second dev pipeline --------------------
set "RUNNING=0"
for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "@((Get-CimInstance Win32_Process).Where({$_.CommandLine -match 'tauri\.js.? android'})).Count"`) do set "RUNNING=%%i"
if "%RUNNING%"=="0" goto checkport
if "%RUNNING%"=="" goto checkport
echo.
echo === Another tauri android dev is already running ===
echo     %RUNNING% matching processes found.
echo.
echo   Two of these fight over port 5173 and over the APK, and the
echo   loser leaves a half-running app behind. That exact state
echo   produced a false bug report on 2026-10-16.
echo.
echo   Close the other console window first, or run kill-ports.bat
echo   and then try again.
echo.
pause
exit /b 1

rem --- guard 2: port 5173 is only freed after asking --------------------
:checkport
set "PORT=0"
for /f "usebackq delims=" %%p in (`powershell -NoProfile -Command "@((Get-NetTCPConnection -State Listen -LocalPort 5173 -ErrorAction SilentlyContinue)).Count"`) do set "PORT=%%p"
if "%PORT%"=="0" goto start
if "%PORT%"=="" goto start
echo.
echo Port 5173 is in use.
echo.
echo   The tauri CLI starts its OWN Vite server, so a leftover Vite
echo   makes the new one die instantly with a port-in-use error, and
echo   the window closes before you can read why.
echo.
echo   It may also be an E2E run - e2e-full.ps1 and e2e-android.ps1
echo   both start a dev server of their own. Freeing it underneath
echo   them breaks the run silently.
echo.
choice /C YN /N /M "  Free port 5173 now? [Y/N] "
if errorlevel 2 goto cancelled
echo Freeing port 5173 ...
call "%ROOT%kill-ports.bat" 5173
goto start

:cancelled
echo Cancelled. Nothing was changed.
exit /b 1

:start
echo.
echo Starting tauri android dev. Leave this window open for as long as
echo you want the app to work: a debug build loads its UI from Vite, so
echo closing this window leaves the app running but unable to reload.
echo.
call npm run tauri android dev
if errorlevel 1 goto failed
endlocal
exit /b 0

:failed
echo.
echo === Failed. Check: ===
echo   - an emulator/device is running:  adb devices
echo   - ports are free:                kill-ports.bat
echo   - Android SDK/NDK present:       "%ANDROID_HOME%"
echo   - full log:                      rerun from a terminal
echo.
pause
endlocal
exit /b 1
