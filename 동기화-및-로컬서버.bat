@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo [테스트 서버] 컬렉션 동기화 후 서버 실행...
echo.
node run-test-server.js
echo.
pause
