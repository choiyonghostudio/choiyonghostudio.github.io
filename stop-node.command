#!/bin/zsh

PORT="${PORT:-3000}"

echo "포트 ${PORT}에서 실행 중인 로컬 서버 종료 중..."
pids=$(lsof -ti "tcp:${PORT}" -sTCP:LISTEN 2>/dev/null)

if [ -z "$pids" ]; then
  echo "포트 ${PORT}에서 실행 중인 서버가 없습니다."
else
  kill ${=pids} 2>/dev/null
  sleep 1
  remaining=$(lsof -ti "tcp:${PORT}" -sTCP:LISTEN 2>/dev/null)
  [ -n "$remaining" ] && kill -9 ${=remaining} 2>/dev/null
  echo "완료되었습니다."
fi

read -r "dummy?계속하려면 Enter 키를 누르세요..."
