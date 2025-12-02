@echo off
echo Starting d'sis Catering Backend Server...
echo.

REM Check if port 3000 is in use and kill any existing node processes
echo Checking for existing server processes...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000') do (
    echo Killing process %%a
    taskkill /PID %%a /F >nul 2>&1
)

REM Wait a moment for the port to be released
timeout /t 2 /nobreak >nul

REM Start the backend server
echo Starting server...
cd backend
node server.js

pause
