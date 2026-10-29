@echo off
setlocal
cd /d "%~dp0"
set "LOCKTODO_OPEN=1"
if exist "runtime\windows-x64\node.exe" (
  "runtime\windows-x64\node.exe" "scripts\server.cjs"
) else (
  where node >nul 2>nul
  if errorlevel 1 (
    echo Node.js was not found. Install Node.js 20 or newer, then run again.
    pause
    exit /b 1
  )
  node "scripts\server.cjs"
)
if errorlevel 1 pause
