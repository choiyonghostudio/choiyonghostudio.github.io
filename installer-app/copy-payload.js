const fs = require("fs");
const path = require("path");
const src = path.join(__dirname, "..", "build", "payload.zip");
const destDir = path.join(__dirname, "resources");
const dest = path.join(destDir, "payload.zip");
if (!fs.existsSync(src)) {
  console.error("build/payload.zip이 없습니다. 프로젝트 루트에서 npm run build:payload 를 먼저 실행하세요.");
  process.exit(1);
}
if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log("payload.zip 복사 완료 → installer-app/resources/");
