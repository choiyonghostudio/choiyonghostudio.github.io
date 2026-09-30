#!/bin/zsh

export PATH="$HOME/.local/node/bin:$HOME/.local/gh:/opt/homebrew/bin:/usr/local/bin:$PATH"
cd -- "$(dirname "$0")"

echo
echo "[푸시] 컬렉션·배경·사이트맵 동기화 후 GitHub 업로드..."
echo

node sync-and-push.js

echo
read -r "dummy?계속하려면 Enter 키를 누르세요..."

