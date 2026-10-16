@echo off
rem ===========================================================
rem  OPEN the Android app, and make sure it can actually load.
rem
rem  SELF-SUFFICIENT: if nothing is serving the UI, this starts a
rem  Vite dev server first, then opens the app. Double-click it and
rem  the app works; you do not need to run "Build Android.bat"
rem  first.
rem
rem  WHY IT NEEDS A DEV SERVER AT ALL
rem  --------------------------------
rem  The installed APK is a DEBUG build, and a debug build does not
rem  contain the UI: it fetches it from the Vite dev server at run
rem  time. With no server listening the app opens to this and
rem  nothing else:
rem
rem      Failed to request http://10.2.0.2:5173/: error sending
rem      request for url (http://10.2.0.2:5173/)
rem
rem  An earlier version launched anyway and printed "Done. The app
rem  is starting on the emulator." - true, and useless, because the
rem  window it opened could not possibly work. The user reported
rem  the script broken when in fact it had done its job.
rem
rem  The host in that URL is NOT always 10.0.2.2. The debug build
rem  bakes in whichever adapter it picked at install time and the
rem  ProtonVPN 10.2.0.2 adapter usually wins. It does not matter
rem  here: vite.config.js binds host 0.0.0.0, so Vite answers on
rem  every one of them. The PORT is what matters, and that is fixed
rem  at 5173 by tauri.conf.json's devUrl.
rem
rem  WHEN TO USE "Build Android.bat" INSTEAD
rem  ------------------------------------------
rem  This script does NOT rebuild anything. It reuses the APK that is
rem  already installed. Use Build Android.bat when you changed
rem  Rust or native code and need the APK rebuilt - it also
rem  reinstalls, which FORCE-STOPS the app you are using. Here the
rem  only cost is a few seconds of Vite startup.
rem
rem  adb is read through a temp file on purpose: a quoted path
rem  inside a for /f backtick command cannot be captured by cmd,
rem  which is the same trap kill-ports.bat was fixed for. The
rem  netstat check gets away with the backtick form because netstat
rem  resolves from PATH, so no quoted path is involved.
rem ===========================================================
setlocal
cd /d "%~dp0"
set "APP=com.mrhorakhty.thespellcaster.debug"
set "DEVLIST=%TEMP%\opencode\adb-devices.txt"
set "DEVPORT=5173"
set "ROOT=%CD%"
set "VITE_JS=%CD%\node_modules\vite\bin\vite.js"

set "ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"
if not exist "%ADB%" set "ADB=adb"

rem ---- device ---------------------------------------------------------
%ADB% start-server >nul 2>&1
%ADB% devices > "%DEVLIST%" 2>nul

set "DEVICES="
set "STATE="
set "COUNT=0"
rem usebackq is REQUIRED here: without it, for /f reads the quoted path as a
rem literal STRING rather than a filename, and skip=1 then skips the only
rem iteration, leaving DEVICES empty.
for /f "usebackq skip=1 tokens=1,2" %%d in ("%DEVLIST%") do (
  set "DEVICES=%%d"
  set "STATE=%%e"
  set /a COUNT+=1
)

if not defined DEVICES goto nodevice
if /i "%STATE%"=="offline" goto offline
if not "%COUNT%"=="1" goto manydevices

rem ---- is anything already serving the UI? ----------------------------
:preflight
call :portopen
if not errorlevel 1 goto haveServer
if exist "%VITE_JS%" goto startserver
goto novite

rem ---------------------------------------------------------------------
:haveServer
echo Using the dev server already on port %DEVPORT%.
goto launch

rem ---------------------------------------------------------------------
:startserver
echo No dev server on port %DEVPORT%. Starting one ...
rem Start-Process -WindowStyle Hidden gives a process with its own
rem console, so closing THIS window does not take Vite down with it -
rem which is the whole difference between the app working after you
rem dismiss this script and stopping the moment you do.
rem
rem Paths go through the environment so no quoting has to survive two
rem layers of cmd and PowerShell at once.
rem
rem The @(...) wrapper collects the new process instead of piping it
rem through Select-Object, and that is deliberate rather than stylistic:
rem a "|" inside for /f backticks has to be written ^|, and the caret
rem then reaches PowerShell as a literal argument - the first version of
rem this line did exactly that and died with "Start-Process : A
rem positional parameter cannot be found that accepts argument '^'".
rem Build Android.bat already uses the @(...) form for the same
rem reason.
set "VITEPID="
for /f %%p in ('powershell -NoProfile -Command "@(Start-Process node -ArgumentList $env:VITE_JS -WorkingDirectory $env:ROOT -WindowStyle Hidden -PassThru).Id"') do set "VITEPID=%%p"
if not defined VITEPID goto serverfail

rem Bounded wait for the port, not an unbounded one: a silent hang here
rem would look exactly like the "script does nothing" report this script
rem exists to fix. 30 tries of a ~1s ping is ~30s, and a warm Vite on
rem this machine binds in 3-5s, so 30s is roughly six times what a healthy
rem start needs. A first-ever start also has to pre-bundle dependencies,
rem which is the slowest case and is why this is not 10s.
set "TRIES=0"
:waitport
call :portopen
if not errorlevel 1 goto serverup
set /a TRIES+=1
if %TRIES% GEQ 30 goto serverfail
>nul 2>&1 ping -n 2 127.0.0.1
goto waitport

rem ---------------------------------------------------------------------
:serverup
echo Dev server is up (pid %VITEPID%).
goto launch

rem ---------------------------------------------------------------------
:launch
echo Launching %APP% on %DEVICES% ...
%ADB% shell monkey -p %APP% -c android.intent.category.LAUNCHER 1 > "%TEMP%\opencode\launch-out.txt" 2>&1
if errorlevel 1 goto failed

echo.
echo Done. The app is starting on the emulator.
if defined VITEPID goto ownserver
echo It is using the dev server that was already running on %DEVPORT%.
echo.
pause
endlocal
exit /b 0

:ownserver
echo This script started that dev server, so it stays running after
echo this window closes. To stop it:
echo     taskkill /PID %VITEPID% /T /F
echo To rebuild or reinstall the app, use Build Android.bat.
echo.
pause
endlocal
exit /b 0

rem ---------------------------------------------------------------------
rem PORTOPEN: errorlevel 1 when nothing is listening on DEVPORT.
:portopen
set "HITS="
for /f %%i in ('netstat -ano ^| findstr /C:"LISTENING" ^| findstr /C:":%DEVPORT% "') do set "HITS=%%i"
if defined HITS (exit /b 0) else (exit /b 1)

rem ---------------------------------------------------------------------
:serverfail
call :portopen
if not errorlevel 1 goto serverup
echo.
echo === Could not start a dev server on port %DEVPORT% ===
echo.
echo   Tried to launch:  node "%VITE_JS%"
echo.
echo   Check that:
echo     - node_modules exists   (it is excluded from backups)
echo     - node is on PATH       where node --version
echo     - port %DEVPORT% is free (maybe a dev server is starting)
echo.
echo   Without one, the app opens to a blank "Failed to request"
echo   page, so this script stops here rather than launching it.
echo.
pause
endlocal
exit /b 1

:novite
echo.
echo === No Vite, so this script cannot serve the app ===
echo.
echo   Expected:  "%VITE_JS%"
echo   That means npm install has not been run, or node_modules was
echo   deleted. node_modules is excluded from backups by design.
echo.
echo   With no dev server the installed debug build cannot load its UI
echo   at all, so use Build Android.bat after an npm install.
echo.
pause
endlocal
exit /b 1

:manydevices
echo.
echo === More than one device attached ===
echo.
echo   Using the last one adb listed: %DEVICES%
echo   Stop the others, or detach them, if that is not the one you
echo   meant. To see the list:  adb devices
echo.
pause
goto preflight

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
echo.
echo   adb said:
type "%TEMP%\opencode\launch-out.txt"
echo.
pause
endlocal
exit /b 1