@echo off
setlocal
cd /d %~dp0
echo Starting Kiosk...
npx --yes electron . 
pause
