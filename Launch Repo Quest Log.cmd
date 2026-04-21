@echo off
setlocal
cd /d "%~dp0"
set "REPO_ROOT=%~dp0"
if "%REPO_ROOT:~-1%"=="\" set "REPO_ROOT=%REPO_ROOT:~0,-1%"

if not exist "node_modules" (
  echo node_modules is missing. Run npm install first.
  pause
  exit /b 1
)

if not exist "dist\cli\index.js" (
  echo Build output missing. Running npm run build...
  call npm run build
  if errorlevel 1 (
    echo Build failed.
    pause
    exit /b 1
  )
)

echo Launching Repo Quest Log desktop app for this repo...
call npm run desktop:app -- "%REPO_ROOT%"
if errorlevel 1 (
  echo Desktop app exited with an error.
  pause
  exit /b 1
)
