/**
 * 테스트 서버 실행 진입점
 * - 서버가 꺼져 있으면: 동기화 후 서버 실행
 * - 서버가 이미 켜져 있으면: 메뉴 표시 (동기화 후 재실행 / 브라우저에서 열기 / 종료)
 */

const net = require("net");
const { execSync, exec } = require("child_process");
const readline = require("readline");
const path = require("path");

const PORT = parseInt(process.env.PORT, 10) || 3000;
const ROOT = path.resolve(__dirname);
const URL = `http://127.0.0.1:${PORT}`;

function isPortInUse(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const onError = () => {
      socket.destroy();
      resolve(false);
    };
    socket.setTimeout(500);
    socket.on("error", onError);
    socket.on("timeout", onError);
    socket.connect(port, "127.0.0.1", () => {
      socket.destroy();
      resolve(true);
    });
  });
}

function killProcessOnPort(port) {
  if (process.platform !== "win32") {
    try {
      const out = execSync(`lsof -ti :${port}`, { encoding: "utf8" }).trim();
      if (out) execSync(`kill -9 ${out.split("\n")[0]}`, { stdio: "inherit" });
    } catch (e) {
      // no process or lsof not found
    }
    return;
  }
  try {
    const out = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, {
      encoding: "utf8",
      windowsHide: true,
    });
    const line = out.split("\n")[0];
    if (!line) return;
    const parts = line.trim().split(/\s+/);
    const pid = parts[parts.length - 1];
    if (pid && /^\d+$/.test(pid)) {
      execSync(`taskkill /PID ${pid} /F`, { stdio: "inherit", windowsHide: true });
    }
  } catch (e) {
    // ignore
  }
}

function openBrowser() {
  const command =
    process.platform === "win32"
      ? `start ${URL}`
      : process.platform === "darwin"
        ? `open ${URL}`
        : `xdg-open ${URL}`;
  exec(command, (err) => {
    if (err) console.log(`   수동으로 ${URL} 을 열어주세요.`);
  });
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve((answer || "").trim());
    });
  });
}

function runSyncThenStartServer() {
  const { runSync } = require("./sync-local.js");
  return runSync().then(() => {
    console.log("\n🌐 로컬 서버 실행 중...\n");
    require("./start-server.js");
  });
}

async function main() {
  const inUse = await isPortInUse(PORT);

  if (!inUse) {
    return runSyncThenStartServer().catch((err) => {
      console.error("❌ 오류:", err.message);
      process.exit(1);
    });
  }

  console.log("\n⚠ 테스트 서버가 이미 실행 중입니다.\n");
  console.log("   [1] 동기화 후 재실행 (기존 서버 종료 → 변경 반영 → 서버 다시 실행)");
  console.log("   [2] 브라우저에서 서버 열기 (현재 서버 그대로 두고 창만 띄우기)");
  console.log("   [3] 종료\n");

  const choice = await ask("선택 (1/2/3): ");

  if (choice === "2") {
    console.log("\n   브라우저를 엽니다...\n");
    openBrowser();
    return;
  }

  if (choice === "3") {
    console.log("   종료합니다.\n");
    process.exit(0);
  }

  if (choice === "1") {
    console.log("\n   기존 서버를 종료한 뒤 동기화하고 서버를 다시 띄웁니다...\n");
    killProcessOnPort(PORT);
    await new Promise((r) => setTimeout(r, 800));
    return runSyncThenStartServer().catch((err) => {
      console.error("❌ 오류:", err.message);
      process.exit(1);
    });
  }

  console.log("   잘못된 선택입니다. 종료합니다.\n");
  process.exit(0);
}

main();
