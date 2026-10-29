@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 20+ is required. Install Node.js from https://nodejs.org/ and run this again.
  pause
  exit /b 1
)
if not exist "node_modules\ws\package.json" (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 goto failed
)
echo Building the app...
call npm run build
if errorlevel 1 goto failed
echo Starting the local server. Keep the server window open.
start "Случай — сервер" /D "%~dp0" cmd /k npm start
timeout /t 2 /nobreak >nul
start "" "http://localhost:4173"
echo If the page does not open, check the server window for errors.
pause
exit /b 0
:failed
echo Startup failed. Check the error above and see README.md.
pause
exit /b 1
