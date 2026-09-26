@echo off
rem ===========================================================================
rem  kill-ports.bat - free the ports and stray processes used by this project
rem
rem  Usage:
rem    kill-ports.bat                free the default E2E / dev ports
rem    kill-ports.bat 5173 9225      free only the ports you list
rem    kill-ports.bat /all           defaults + app.exe + adb forwards + orphans
rem    kill-ports.bat /all /emu      also shut the Android emulator down
rem
rem  Flags can be combined with ports:  kill-ports.bat /all 5173 9225
rem
rem  Default ports:
rem    5173  vite dev server (tauri android dev / tauri dev)
rem    9224  WebView2 CDP (Windows program tests)
rem    9225  WebView CDP forwarded from the Android emulator
rem    5233  vite preview (desktop web tests)
rem    9333  headless Edge CDP (web tests)
rem    9334  headless Edge CDP (feature tests)
rem
rem  For a port that is an "adb forward" it removes the forward first, so the
rem  adb server itself is never killed. Otherwise the listening PID (and its
rem  process tree) is terminated.
rem ===========================================================================
setlocal EnableExtensions EnableDelayedExpansion

set "PORTS="
set "KILL_ALL=0"
set "KILL_EMU=0"

:parse
if "%~1"=="" goto parsed
if /i "%~1"=="/all" (
    set "KILL_ALL=1"
    shift
    goto parse
)
if /i "%~1"=="/emu" (
    set "KILL_EMU=1"
    shift
    goto parse
)
set "PORTS=!PORTS! %1"
shift
goto parse
:parsed

if "!PORTS!"=="" set "PORTS= 5173 9224 9225 5233 9333 9334"

set "ADB=%ANDROID_HOME%\platform-tools\adb.exe"
if not exist "!ADB!" set "ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"
if not exist "!ADB!" set "ADB="

echo.
echo  Ports to free:!PORTS!
if "!KILL_ALL!"=="1" echo  Mode: /all  (also app.exe, adb forwards, orphan tauri/cargo)
if "!KILL_EMU!"=="1" echo  Mode: /emu (Android emulator will be shut down)
echo.

if "!KILL_ALL!"=="1" call :extras
if "!KILL_EMU!"=="1" call :emu

for %%P in (!PORTS!) do call :killport %%P

echo.
echo  Result:
for %%P in (!PORTS!) do call :report %%P

echo.
if "!KILL_ALL!"=="1" echo  Also handled: app.exe, adb forward --remove-all, orphan tauri CLI / cargo.
if "!KILL_EMU!"=="1" echo  Also handled: adb emu kill.
echo  Done.
echo.
endlocal
exit /b 0

:killport
set "PORT=%~1"
if "!SEEN!"=="" set "SEEN= ~ "
echo  Port %PORT%:
if not "!ADB!"=="" "!ADB!" forward --remove "tcp:%PORT%" >nul 2>&1
for /f "tokens=5" %%p in ('netstat -ano -p tcp ^| findstr /R /C:"LISTENING" ^| findstr /R /C:":%PORT% "') do (
    echo(!SEEN!| findstr /C:" %%p " >nul
    if errorlevel 1 (
        set "SEEN=!SEEN!%%p "
        echo     killing PID %%p ^(and its process tree^)
        taskkill /PID %%p /T /F >nul 2>&1
        if errorlevel 1 echo     FAILED to kill PID %%p - try running this file as Administrator
    )
)
goto :eof

:report
set "PORT=%~1"
set "BUSY="
for /f "tokens=5" %%p in ('netstat -ano -p tcp ^| findstr /R /C:"LISTENING" ^| findstr /R /C:":%PORT% "') do set "BUSY=!BUSY! %%p"
if defined BUSY (
    echo     port %PORT% : STILL IN USE by PID!BUSY!
) else (
    echo     port %PORT% : free
)
goto :eof

:extras
echo  /all extras:
taskkill /F /IM app.exe /T >nul 2>&1
if not errorlevel 1 echo     app.exe terminated
if not "!ADB!"=="" (
    "!ADB!" forward --remove-all >nul 2>&1
    echo     adb forwards removed
) else (
    echo     adb not found - skipped adb forward cleanup
)
rem Orphaned tauri CLI / cargo helpers left behind when a dev server is killed.
rem Scoped by process name + command line so unrelated node/cargo work is untouched.
for /f "tokens=1" %%p in ('powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { ($_.Name -eq 'node.exe' -and $_.CommandLine -like '*tauri.js*') -or ($_.Name -eq 'cargo.exe') } | ForEach-Object { $_.ProcessId }"') do (
    echo     killing orphan %%p ^(tauri CLI / cargo^)
    taskkill /PID %%p /T /F >nul 2>&1
)
echo.
goto :eof

:emu
if "!ADB!"=="" (
    echo  /emu: adb not found - cannot shut the emulator down
    goto :eof
)
echo  /emu:
for /f "tokens=1" %%d in ('"!ADB!" devices ^| findstr /R /C:"emulator-[0-9]*"') do (
    echo     shutting down %%d
    "!ADB!" -s %%d emu kill >nul 2>&1
)
goto :eof
