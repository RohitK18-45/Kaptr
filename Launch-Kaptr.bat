@echo off
title Kaptr
cd /d "%~dp0"
set AUTO_SHUTDOWN=1

echo ========================================================
echo   Starting Kaptr...
echo   Open at: http://kaptr.localtest.me
echo   (Server will automatically shut down when closed)
echo ========================================================

set "TARGET=http://kaptr.localtest.me"
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --app=%TARGET%
) else if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --app=%TARGET%
) else (
    start "" "%TARGET%"
)

node server.js
