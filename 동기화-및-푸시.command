#!/bin/zsh

cd -- "$(dirname "$0")"

echo
echo "[푸시] 컬렉션·배경 동기화 후 Git 푸시..."
echo

node sync-and-push.js

echo
read -r "dummy?계속하려면 Enter 키를 누르세요..."

