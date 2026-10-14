@echo off
chcp 65001 >nul
rem Gallery watcher: keeps the manifest in sync with gallery/ automatically.
rem Double-click to run; press Ctrl+C or close this window to stop.
setlocal
set "NODEEXE="
for /d %%D in ("%USERPROFILE%\.workbuddy\binaries\node\versions\*") do (
  if exist "%%D\node.exe" if not defined NODEEXE set "NODEEXE=%%D\node.exe"
)
if not defined NODEEXE (
  echo [ERROR] Node.js not found under .workbuddy\binaries\node\versions\
  echo Please run this project inside WorkBuddy, or install Node.js first.
  pause
  exit /b 1
)
pushd "%~dp0.."
"%NODEEXE%" "tools\gallery_watch.js"
popd
pause
