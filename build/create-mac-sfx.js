/**
 * Mac용 단일 실행 파일(PhotoSite-Setup.command) 생성
 * 셸 스크립트 + base64(payload.zip) → 실행 시 압축 해제 후 설치하기.command 실행
 * Windows에서도 실행 가능 (payload.zip 사용, tar 불필요)
 */

const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "웹사이트 설치 프로그램");
const PAYLOAD_ZIP = path.join(__dirname, "payload.zip");
const OUT = path.join(OUT_DIR, "PhotoSite-Setup.command");

// payload.zip 없으면 먼저 생성
function ensurePayload() {
  if (fs.existsSync(PAYLOAD_ZIP)) return;
  const { execSync } = require("child_process");
  execSync("node build/create-payload.js", { cwd: ROOT, stdio: "inherit", shell: true });
}

const SCRIPT = `#!/bin/bash
set -e
TMP=$(mktemp -d)
MARKER="__PAYLOAD_BELOW__"
LINE=$(grep -n "$MARKER" "$0" | head -1 | cut -d: -f1)
tail -n +$((LINE + 1)) "$0" | base64 -d > "$TMP/payload.zip"
unzip -o -q "$TMP/payload.zip" -d "$TMP"
rm -f "$TMP/payload.zip"
cd "$TMP"
exec ./설치하기.command
__PAYLOAD_BELOW__
`;

function main() {
  ensurePayload();
  if (!fs.existsSync(PAYLOAD_ZIP)) {
    console.error("payload.zip이 없습니다. npm run build:payload 를 먼저 실행하세요.");
    process.exit(1);
  }

  const data = fs.readFileSync(PAYLOAD_ZIP);
  const b64 = data.toString("base64");

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT, SCRIPT + b64, "utf8");
  try {
    fs.chmodSync(OUT, 0o755);
  } catch (_) {}

  console.log("PhotoSite-Setup.command 생성 완료:", OUT);
  console.log("이 파일 하나만 이메일로 보내면, Mac 사용자가 더블클릭 시 압축 해제 후 설치 마법사가 실행됩니다.");
}

main();
