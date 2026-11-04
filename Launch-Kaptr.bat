@echo off
title Kaptr
cd /d "%~dp0"
set AUTO_SHUTDOWN=1

echo ========================================================
echo   Starting Kaptr...
echo   (Server will automatically shut down when tab is closed)
echo ========================================================

start "" "http://localhost:3000"
node server.js
