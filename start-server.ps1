# 서버 시작 스크립트
Write-Host "서버 시작 중..." -ForegroundColor Green

# 기존 Node 프로세스 종료
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 1

# 서버 시작
node start-server.js



















