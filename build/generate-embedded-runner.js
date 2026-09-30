/**
 * payload.zip을 base64로 넣은 extract-and-run-embedded.js 생성
 * 이 파일을 pkg로 패키징하면 exe가 외부 파일 없이 동작합니다.
 */

const fs = require("fs");
const path = require("path");
const payloadZip = path.join(__dirname, "payload.zip");

if (!fs.existsSync(payloadZip)) {
  console.error("payload.zip이 없습니다. npm run build:payload 를 먼저 실행하세요.");
  process.exit(1);
}

const b64 = fs.readFileSync(payloadZip).toString("base64");
const runner = `/**
 * payload가 내장된 실행 스크립트 (pkg로 단일 exe 패키징용)
 */
const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawnSync } = require("child_process");
const AdmZip = require("adm-zip");

const EMBEDDED_PAYLOAD_BASE64 = ${JSON.stringify(b64)};

const isWin = process.platform === "win32";
const LAUNCHER = isWin ? "설치하기.bat" : "설치하기.command";
const LEGACY_PREFIX = "PhotoSiteSetup-";
const LAUNCHER_PATTERNS = ["설치하기\\\\.bat", "설치하기\\\\.command"];

function parseWmicPids(output) {
  return (output || "")
    .split(/\\r?\\n/)
    .map((line) => line.trim())
    .filter((line) => /^\\d+$/.test(line))
    .map((num) => parseInt(num, 10));
}

function killWindowsLauncherProcesses(pattern) {
  const result = spawnSync("wmic", ["process", "where", \`CommandLine like '%\${pattern}%'\`, "get", "ProcessId"], {
    encoding: "utf8",
    shell: true,
  });
  const pids = parseWmicPids(result.stdout);
  pids.forEach((pid) => {
    try {
      spawnSync("taskkill", ["/PID", pid.toString(), "/F"], { stdio: "ignore", shell: true });
    } catch (_) {}
  });
  return pids;
}

function killUnixLauncherProcesses(pattern) {
  const result = spawnSync("pkill", ["-f", pattern], { stdio: "ignore" });
  if (result.status === 0) {
    return [pattern];
  }
  return [];
}

function cleanupPreviousLaunchers() {
  const cleaned = [];
  if (isWin) {
    LAUNCHER_PATTERNS.forEach((pattern) => cleaned.push(...killWindowsLauncherProcesses(pattern)));
  } else {
    LAUNCHER_PATTERNS.forEach((pattern) => cleaned.push(...killUnixLauncherProcesses(pattern)));
  }
  return cleaned;
}

function cleanupLegacyTempDirs() {
  const tmpRoot = os.tmpdir();
  const removed = [];
  try {
    const entries = fs.readdirSync(tmpRoot, { withFileTypes: true });
    entries.forEach((entry) => {
      if (entry.isDirectory() && entry.name.startsWith(LEGACY_PREFIX)) {
        const target = path.join(tmpRoot, entry.name);
        try {
          fs.rmSync(target, { recursive: true, force: true });
          removed.push(target);
        } catch (_) {}
      }
    });
  } catch (_) {}
  return removed;
}

function cleanupLegacyState() {
  const cleanedDirs = cleanupLegacyTempDirs();
  const killed = cleanupPreviousLaunchers();
  if (cleanedDirs.length || killed.length) {
    console.log("Runner cleanup:", { cleanedDirs, killed });
  }
}

function main() {
  const zipBuffer = Buffer.from(EMBEDDED_PAYLOAD_BASE64, "base64");
  const tmpDir = path.join(os.tmpdir(), "PhotoSiteSetup-" + Date.now());
  cleanupLegacyState();
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    const zip = new AdmZip(zipBuffer);
    zip.extractAllTo(tmpDir, true);
  } catch (err) {
    console.error("압축 해제 실패:", err.message);
    require("readline").createInterface({ input: process.stdin }).question("아무 키나 누르면 종료합니다.", () => process.exit(1));
    return;
  }

  const launcherPath = path.join(tmpDir, LAUNCHER);
  if (!fs.existsSync(launcherPath)) {
    console.error("설치 파일을 찾을 수 없습니다:", launcherPath);
    require("readline").createInterface({ input: process.stdin }).question("아무 키나 누르면 종료합니다.", () => process.exit(1));
    return;
  }

  console.log("설치 파일을 풀었습니다. 설치 마법사를 실행합니다.\\n");

  const result = spawnSync(launcherPath, [], {
    cwd: tmpDir,
    stdio: "inherit",
    shell: true,
    windowsHide: false,
  });

  process.exit(result.status !== null ? result.status : 0);
}

main();
`;

const outPath = path.join(__dirname, "extract-and-run-embedded.js");
fs.writeFileSync(outPath, runner, "utf8");
console.log("extract-and-run-embedded.js 생성 완료 (payload 내장)");
