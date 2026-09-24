@echo off
rem cooking one-click local start (OPS-003) - double click to run
rem Real logic lives in start-dev.ps1 next to this file.
rem This wrapper bypasses the PowerShell execution policy and keeps the window open.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-dev.ps1" %*
echo.
pause
