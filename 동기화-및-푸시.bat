@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo [푸시] 컬렉션·배경 동기화 후 Git 푸시...
echo.
node sync-and-push.js
echo.
pause
