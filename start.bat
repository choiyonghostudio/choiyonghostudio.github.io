@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo [서버 시작 중] C:\jeong-inhwan
echo.

node start-server.js

if errorlevel 1 (
  echo.
  echo 서버가 종료되었거나 오류가 났습니다. 위 메시지를 확인하세요.
)

echo.
pause
