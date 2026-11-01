@echo off
setlocal
cd /d "%~dp0.." || exit /b 1
set "ROOT=%CD%"
rem Build both Windows release installers. --no-pause is for terminal/CI use.
set "RESULT=1"
if "%~1"=="" goto prerequisites
if /i "%~1"=="--no-pause" goto prerequisites
echo Usage: "Build Installer.bat" [--no-pause]
set "RESULT=2"
goto finish

:prerequisites
where npm.cmd >nul 2>&1
if errorlevel 1 goto missingnpm
where cargo.exe >nul 2>&1
if errorlevel 1 goto missingcargo
if not exist "node_modules\@tauri-apps\cli\tauri.js" goto missingdeps
if not exist "logs" mkdir "logs"
if not exist "logs" goto logfailed
set "STAMP="
for /f %%T in ('powershell.exe -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set "STAMP=%%T"
if not defined STAMP goto logfailed
set "BUILDLOG=%ROOT%\logs\windows-installer-%STAMP%.log"
echo Building MSI and EXE release installers. This may take several minutes.
echo Build output: "%BUILDLOG%"
echo First-time builds may download Windows packaging tools.
echo.
call npm.cmd run tauri -- build --bundles msi,nsis >"%BUILDLOG%" 2>&1
set "RESULT=%ERRORLEVEL%"
type "%BUILDLOG%"
if not "%RESULT%"=="0" goto buildfailed
echo.
echo Installers created. See the bundle paths printed above.
echo Default MSI folder: "%ROOT%\src-tauri\target\release\bundle\msi"
echo Default EXE folder: "%ROOT%\src-tauri\target\release\bundle\nsis"
echo A custom Cargo target directory changes these default locations.
goto finish

:missingnpm
echo ERROR: Node.js/npm is missing from PATH. Install Node.js first.
goto finish
:missingcargo
echo ERROR: Rust Cargo is missing from PATH. Install the Rust MSVC toolchain
echo and Visual Studio C++ Build Tools with the Windows SDK first.
goto finish
:missingdeps
echo ERROR: Project dependencies are missing. Run npm install first.
goto finish
:logfailed
echo ERROR: Could not prepare the build log under logs.
goto finish
:buildfailed
echo.
echo ERROR: Installer build failed with exit code %RESULT%.
echo Full output: "%BUILDLOG%"
:finish
if /i not "%~1"=="--no-pause" pause
exit /b %RESULT%
