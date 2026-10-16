@echo off
rem ===========================================================
rem  OPEN the already-installed Android app. Nothing else.
rem
rem  No build, no install, no Vite. It just launches the app that
rem  is already on the emulator, and fails clearly when there is
rem  not one - for that, use "Run Tauri Android.bat".
rem
rem  A DEBUG build loads its UI from the Vite dev server, so this
rem  only gives you a working app while a dev pipeline is running
rem  elsewhere. With no dev server the app may open blank or fail
rem  to load. To restart it properly, kill the dev pipeline and
rem  start it again - closing the app on the emulator does not
rem  stop the pipeline.
rem
rem  adb is read through a temp file on purpose: a quoted path
rem  inside a for /f backtick command cannot be captured by cmd,
rem  which is the same trap kill-ports.bat was fixed for.
rem ===========================================================
setlocal
set "APP=com.mrhorakhty.thespellcaster.debug"
set "DEVLIST=%TEMP%\opencode\adb-devices.txt"

set "ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"
if not exist "%ADB%" set "ADB=adb"

%ADB% start-server >nul 2>&1
%ADB% devices > "%DEVLIST%" 2>nul

set "DEVICES="
set "STATE="
rem usebackq is REQUIRED here: without it, for /f reads the quoted path as a
rem literal STRING rather than a filename, and skip=1 then skips the only
rem iteration, leaving DEVICES empty.
for /f "usebackq skip=1 tokens=1,2" %%d in ("%DEVLIST%") do (
  set "DEVICES=%%d"
  set "STATE=%%e"
)

if not defined DEVICES goto nodevice
if /i "%STATE%"=="offline" goto offline

echo Launching %APP% on %DEVICES% ...
%ADB% shell monkey -p %APP% -c android.intent.category.LAUNCHER 1 >nul 2>&1
if errorlevel 1 goto failed
echo Done. The app is starting on the emulator.
endlocal
exit /b 0

:nodevice
echo.
echo === No emulator or device attached ===
echo.
echo   Start an AVD in Android Studio first, or plug in a device,
echo   then run this again. To check what adb sees:  adb devices
echo.
pause
endlocal
exit /b 1

:offline
echo.
echo === The device is offline ===
echo.
echo   adb can see it but cannot talk to it. Try:
echo     adb kill-server
echo     adb start-server
echo   or restart the emulator.
echo.
pause
endlocal
exit /b 1

:failed
echo.
echo === Launch failed ===
echo.
echo   - is the app installed?  adb shell pm list packages ^| findstr thespellcaster
echo   - is a dev pipeline running?  it serves the UI for a debug build
echo   - for the full error, run the monkey command above by hand
echo.
pause
endlocal
exit /b 1
