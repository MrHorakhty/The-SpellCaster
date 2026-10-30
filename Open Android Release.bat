@echo off
setlocal
cd /d "%~dp0"

rem Studio must be launched by Tauri to inherit its Android linker settings.
rem Reusing an already-open IDE does not update that process's environment.
set "STUDIO_CHECK=%TEMP%\spellcaster-studio-check-%RANDOM%-%RANDOM%.tmp"
tasklist /FI "IMAGENAME eq studio64.exe" /NH >"%STUDIO_CHECK%" 2>&1
if errorlevel 1 goto check_failed
find /I "studio64.exe" "%STUDIO_CHECK%" >nul
set "STUDIO_STATUS=%ERRORLEVEL%"
del /Q "%STUDIO_CHECK%" >nul 2>&1
if "%STUDIO_STATUS%"=="0" goto studio_open
where npm.cmd >nul 2>&1
if errorlevel 1 goto npm_missing
where node.exe >nul 2>&1
if errorlevel 1 goto npm_missing
if /I "%~1"=="--check" goto ready

echo Preparing release APK and AAB, then opening Android Studio.
echo Leave this window open while generating your signed bundle or APK.
echo Enter signing passwords only in Android Studio.
rem A private TEMP/TMP keeps other Tauri builds from replacing Studio's
rem companion address file. The helper also captures the complete build output.
node.exe "%~dp0open-android-release.mjs"
set "RESULT=%ERRORLEVEL%"
echo.
echo Tauri release session ended with exit code %RESULT%.
pause
exit /b %RESULT%

:studio_open
echo Close Android Studio completely, then run this launcher again.
echo Nothing was stopped or reset.
if /I "%~1"=="--check" exit /b 2
pause
exit /b 2

:npm_missing
echo Node.js or npm.cmd was not found. Make both available on PATH.
if /I "%~1"=="--check" exit /b 3
pause
exit /b 3

:check_failed
type "%STUDIO_CHECK%"
del /Q "%STUDIO_CHECK%" >nul 2>&1
echo Could not check running Studio processes. Refusing to start another instance.
if /I "%~1"=="--check" exit /b 4
pause
exit /b 4

:ready
echo Ready: Android Studio is closed and npm.cmd is available.
exit /b 0
