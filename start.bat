@echo off
echo ====================================================
echo Starting ParentVision Platform...
echo ====================================================

echo Starting Backend API on port 4000...
start "ParentVision Backend API" cmd /k "cd /d services\api && npm start"

timeout /t 3 /nobreak >nul

echo Starting Parent Dashboard on port 3000...
start "ParentVision Web Dashboard" cmd /k "cd /d apps\web && npm start"

timeout /t 2 /nobreak >nul

echo ====================================================
echo ParentVision is now running!
echo Dashboard URL: http://localhost:3000
echo iPhone URL:    http://192.168.1.9:3000/mobile
echo ====================================================

start http://localhost:3000
pause
