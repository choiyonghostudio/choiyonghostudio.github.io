/**
 * payload.zip을 임시 폴더에 풀고 설치하기.bat(Windows) 또는 설치하기.command(Mac) 실행.
 * 단일 exe로 패키지할 때 이 스크립트 + payload.zip을 pkg로 묶습니다.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawnSync } = require("child_process");
const AdmZip = require("adm-zip");

const isWin = process.platform === "win32";
const LAUNCHER = isWin ? "설치하기.bat" : "설치하기.command";
const LEGACY_PREFIX = "PhotoSiteSetup-";
const LAUNCHER_PATTERNS = ["설치하기\\.bat", "설치하기\\.command"];

function parseWmicPids(output) {
  return (output || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^\d+$/.test(line))
    .map((num) => parseInt(num, 10));
}

function killWindowsLauncherProcesses(pattern) {
  const result = spawnSync("wmic", ["process", "where", `CommandLine like '%${pattern}%'`, "get", "ProcessId"], {
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

// payload.zip 위치: 패키지된 exe에서는 exe와 같은 폴더 또는 snapshot
function findPayloadZip() {
  const candidates = [
    path.join(__dirname, "payload.zip"),
    path.join(path.dirname(process.execPath), "payload.zip"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function main() {
  const zipPath = findPayloadZip();
  if (!zipPath) {
    console.error("payload.zip을 찾을 수 없습니다. build 폴더에서 node build/create-payload.js 를 먼저 실행하세요.");
    process.exit(1);
  }

  cleanupLegacyState();

  const tmpDir = path.join(os.tmpdir(), "PhotoSiteSetup-" + Date.now());
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(tmpDir, true);
  } catch (err) {
    console.error("압축 해제 실패:", err.message);
    process.exit(1);
  }

  const launcherPath = path.join(tmpDir, LAUNCHER);
  if (!fs.existsSync(launcherPath)) {
    console.error("설치 파일을 찾을 수 없습니다:", launcherPath);
    process.exit(1);
  }

  console.log("설치 파일을 풀었습니다. 설치 마법사를 실행합니다.\n");

  const result = spawnSync(launcherPath, [], {
    cwd: tmpDir,
    stdio: "inherit",
    shell: true,
    windowsHide: false,
  });

  process.exit(result.status !== null ? result.status : 0);
}

main();
