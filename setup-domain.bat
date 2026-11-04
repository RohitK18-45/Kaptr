@echo off
title Kaptr Domain Setup
:: BatchGotAdmin
:-------------------------------------
REM --> Check for permissions
>nul 2>&1 "%SYSTEMROOT%\system32\cacls.exe" "%SYSTEMROOT%\system32\config\system"
if '%errorlevel%' NEQ '0' (
    echo Requesting administrative permissions to set up http://kaptr.local...
    goto UACPrompt
) else ( goto gotAdmin )

:UACPrompt
    echo Set UAC = CreateObject^("Shell.Application"^) > "%temp%\getadmin.vbs"
    echo UAC.ShellExecute "%~s0", "", "", "runas", 1 >> "%temp%\getadmin.vbs"
    "%temp%\getadmin.vbs"
    exit /B

:gotAdmin
    if exist "%temp%\getadmin.vbs" ( del "%temp%\getadmin.vbs" )
    pushd "%CD%"
    CD /D "%~dp0"
:--------------------------------------

findstr /C:"kaptr.local" "%WINDIR%\System32\drivers\etc\hosts" >nul
if %errorlevel% NEQ 0 (
    echo. >> "%WINDIR%\System32\drivers\etc\hosts"
    echo 127.0.0.1 kaptr.local >> "%WINDIR%\System32\drivers\etc\hosts"
    echo ========================================================
    echo   Success! http://kaptr.local has been registered.
    echo ========================================================
) else (
    echo ========================================================
    echo   http://kaptr.local is already configured!
    echo ========================================================
)

echo.
echo You can now close this window and run Kaptr anytime.
timeout /t 3 >nul
