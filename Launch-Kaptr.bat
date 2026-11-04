@echo off
title Kaptr
cd /d "%~dp0"
set AUTO_SHUTDOWN=1

echo ========================================================
echo   Starting Kaptr...
echo   Opening: http://kaptr.local
echo   (Server will automatically shut down when tab is closed)
echo ========================================================

start "" "http://kaptr.local"
node server.js
