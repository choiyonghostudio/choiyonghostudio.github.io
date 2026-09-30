/**
 * 단일 실행 파일(PhotoSite-Setup.exe) 생성
 * 1) payload.zip 생성  2) payload 내장 스크립트 생성  3) pkg로 exe 패키징 (외부 파일 불필요)
 */

const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");
const ROOT = path.resolve(__dirname, "..");

// 1. payload.zip 생성
execSync("node build/create-payload.js", { cwd: ROOT, stdio: "inherit", shell: true });

// 2. payload를 base64로 넣은 extract-and-run-embedded.js 생성 (exe가 외부 payload.zip 없이 동작)
execSync("node build/generate-embedded-runner.js", { cwd: ROOT, stdio: "inherit", shell: true });

const outDir = path.join(ROOT, "웹사이트 설치 프로그램");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const outExe = path.join(outDir, "PhotoSite-Setup.exe");

try {
  // payload가 스크립트 안에 있으므로 --assets 없이 패키징
  execSync(
    `npx pkg extract-and-run-embedded.js --output "${outExe}" --targets node18-win-x64`,
    { cwd: __dirname, stdio: "inherit", shell: true }
  );
  console.log("\n단일 실행 파일 생성 완료:", outExe);
} catch (e) {
  console.error("\npkg 실행 실패. 다음을 실행한 뒤 다시 시도하세요:");
  console.error("  npm install archiver adm-zip");
  console.error("  npm run build:sfx-win");
  process.exit(1);
}
