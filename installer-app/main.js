const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const https = require("https");
const { spawn, spawnSync } = require("child_process");

let mainWindow;

// GitHub API (HTTPS)
function githubApi(host, pathname, token, method = "GET", body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request(
      {
        host,
        path: pathname,
        method,
        headers: {
          "Accept": "application/vnd.github.v3+json",
          "Authorization": "Bearer " + token,
          "User-Agent": "PhotoSite-Installer/1.0",
        },
      },
      (res) => {
        let buf = "";
        res.on("data", (c) => { buf += c; });
        res.on("end", () => {
          try {
            const parsed = buf ? JSON.parse(buf) : null;
            if (res.statusCode >= 400) {
              reject(new Error(parsed && parsed.message ? parsed.message : "HTTP " + res.statusCode));
            } else {
              resolve(parsed);
            }
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on("error", reject);
    if (data) {
      req.setHeader("Content-Type", "application/json");
      req.setHeader("Content-Length", Buffer.byteLength(data));
      req.write(data);
    }
    req.end();
  });
}

function downloadFile(url, redirectCount = 0) {
  if (redirectCount > 5) return Promise.reject(new Error("리다이렉트 횟수 초과"));
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const ext = path.extname(parsed.pathname) || ".exe";
    const tmp = path.join(os.tmpdir(), "photosite-install-" + Date.now() + ext);
    const file = fs.createWriteStream(tmp);
    const req = https.get(url, { headers: { "User-Agent": "PhotoSite-Installer/1.0" } }, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        file.close();
        fs.unlink(tmp, () => {});
        const next = res.headers.location;
        return downloadFile(next.startsWith("http") ? next : new URL(next, url).href, redirectCount + 1).then(resolve).catch(reject);
      }
      res.pipe(file);
      file.on("finish", () => { file.close(); resolve(tmp); });
    });
    req.on("error", (err) => { try { fs.unlinkSync(tmp); } catch (_) {} reject(err); });
  });
}

function runInstaller(exePath, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(exePath, args, { shell: true, stdio: "pipe" });
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error("Exit " + code))));
    child.on("error", reject);
  });
}

function sanitizeCommand(cmd) {
  return cmd.replace(/https:\\/\\/[^@]+@github\\.com/g, "https://[token]@github.com");
}

function runCmd(cmd, cwd, silent = true) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, [], { cwd, shell: true, stdio: silent ? "pipe" : "inherit" });
    const chunks = [];
    if (silent) {
      if (child.stdout) child.stdout.on("data", (chunk) => chunks.push(chunk.toString()));
      if (child.stderr) child.stderr.on("data", (chunk) => chunks.push(chunk.toString()));
    }
    child.on("close", (code) => {
      if (code === 0) {
        return resolve(chunks.join("").trim());
      }
      const output = chunks.join("").trim();
      const safeCmd = sanitizeCommand(cmd);
      const message = output ? `${safeCmd}: ${output}` : `${safeCmd}: no output`;
      reject(new Error(message + " (Exit " + code + ")"));
    });
    child.on("error", reject);
  });
}

const KNOWN_PROCESS_PATTERNS = [
  "run-test-server\\.js",
  "start-server\\.js",
  "sync-and-serve\\.js",
  "sync-local\\.js",
  "sync-and-push\\.js",
  "동기화-및-로컬서버\\.bat",
  "동기화-및-푸시\\.bat",
  "설치하기\\.bat",
  "설치하기\\.command",
];

function parseWmicProcessIds(output) {
  return (output || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^\d+$/.test(line))
    .map((num) => parseInt(num, 10));
}

function killWindowsProcesses(pattern, name) {
  const whereClause = name
    ? `(name='${name}' and CommandLine like '%${pattern}%')`
    : `CommandLine like '%${pattern}%'`;
  const result = spawnSync("wmic", ["process", "where", whereClause, "get", "ProcessId"], {
    encoding: "utf8",
    shell: true,
  });
  const pids = parseWmicProcessIds(result.stdout);
  pids.forEach((pid) => {
    try {
      spawnSync("taskkill", ["/PID", pid.toString(), "/F"], { stdio: "ignore", shell: true });
    } catch (_) {}
  });
  return pids;
}

function killUnixProcesses(pattern) {
  const result = spawnSync("pgrep", ["-f", pattern], { encoding: "utf8" });
  if (result.status !== 0) return [];
  return (result.stdout || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^\d+$/.test(line))
    .map((pid) => {
      try {
        process.kill(parseInt(pid, 10), "SIGKILL");
        return parseInt(pid, 10);
      } catch (_) {
        return null;
      }
    })
    .filter(Boolean);
}

function cleanupKnownProcesses() {
  const killed = [];
  if (process.platform === "win32") {
    KNOWN_PROCESS_PATTERNS.forEach((pattern) => {
      const byNode = killWindowsProcesses(pattern, "node.exe");
      const byCmd = killWindowsProcesses(pattern, "cmd.exe");
      killed.push(...byNode, ...byCmd);
    });
  } else {
    KNOWN_PROCESS_PATTERNS.forEach((pattern) => {
      killed.push(...killUnixProcesses(pattern));
    });
  }
  return Array.from(new Set(killed.filter(Boolean)));
}

function cleanupPhotoSiteTempDirs() {
  const tmpRoot = os.tmpdir();
  const removed = [];
  try {
    const entries = fs.readdirSync(tmpRoot, { withFileTypes: true });
    entries.forEach((entry) => {
      if (entry.isDirectory() && entry.name.startsWith("PhotoSiteSetup-")) {
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

async function cleanupBeforeInstall() {
  const killed = cleanupKnownProcesses();
  const removedDirs = cleanupPhotoSiteTempDirs();
  console.info("Installer cleanup:", { killed, removedDirs });
  return { cleanedProcesses: killed, cleanedTempDirs: removedDirs };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 560,
    height: 420,
    minWidth: 500,
    minHeight: 380,
    frame: true,
    title: "사진 사이트 템플릿 설치",
    icon: null,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile("wizard.html");
}

app.whenReady().then(createWindow);
app.on("before-quit", () => {
  cleanupBeforeInstall().catch(() => {});
});
app.on("window-all-closed", () => app.quit());

// 기본 설치 경로
ipcMain.handle("get-default-path", () => {
  const os = require("os");
  return path.join(os.homedir(), "my-photo-site");
});

ipcMain.handle("quit", () => app.quit());

// Node.js 설치 (Windows: MSI 다운로드 후 자동 설치)
ipcMain.handle("install-node", async () => {
  if (process.platform !== "win32") return;
  const url = "https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi";
  try {
    const msi = await downloadFile(url);
    await runInstaller("msiexec", ["/i", msi, "/quiet", "/norestart"]);
    try { fs.unlinkSync(msi); } catch (_) {}
  } catch (err) {
    throw new Error("Node.js 설치 실패: " + (err.message || err));
  }
});

// Git 설치 (Windows: Git for Windows 다운로드 후 자동 설치)
ipcMain.handle("install-git", async () => {
  if (process.platform !== "win32") return;
  const url = "https://github.com/git-for-windows/git/releases/download/v2.43.0.windows.1/Git-2.43.0-64-bit.exe";
  try {
    const exe = await downloadFile(url);
    await runInstaller(exe, ["/VERYSILENT", "/NORESTART"]);
    try { fs.unlinkSync(exe); } catch (_) {}
  } catch (err) {
    throw new Error("Git 설치 실패: " + (err.message || err));
  }
});

// 폴더 선택
ipcMain.handle("select-dir", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory", "createDirectory"],
    title: "설치할 폴더 선택",
  });
  if (canceled || !filePaths.length) return null;
  return filePaths[0];
});

ipcMain.handle("cleanup-running-processes", async () => {
  await cleanupBeforeInstall();
  return { ok: true };
});

// GitHub 토큰 발급 페이지 열기
ipcMain.handle("open-github-token-url", () => {
  shell.openExternal("https://github.com/settings/tokens/new?scopes=repo&description=PhotoSite-Installer");
});

// GitHub 사용자 조회 (토큰 검증)
ipcMain.handle("github-get-user", async (e, token) => {
  const data = await githubApi("api.github.com", "/user", token, "GET");
  return data;
});

// 설치 실행 (GitHub 연동: 저장소 생성, 첫 푸시, Pages 설정)
ipcMain.handle("do-install", async (e, opts) => {
  await cleanupBeforeInstall();
  const { installPath, mainTitle, subtitle, githubToken, repoName, useGithubIo } = opts;
  const githubUrl = opts.githubUrl; // 기존 URL만 넣는 경우 호환
  const AdmZip = require("adm-zip");
  const payloadPath = app.isPackaged
    ? path.join(process.resourcesPath, "payload.zip")
    : path.join(__dirname, "resources", "payload.zip");

  if (!fs.existsSync(payloadPath)) {
    return { ok: false, error: "설치 파일(payload.zip)을 찾을 수 없습니다." };
  }

  const absPath = path.resolve(installPath);
  try {
    fs.mkdirSync(absPath, { recursive: true });
  } catch (err) {
    return { ok: false, error: "폴더를 만들 수 없습니다: " + err.message };
  }

  let siteUrl = "";
  let ghUser = null;
  let finalRepoName = (repoName && repoName.trim()) || "my-photo-site";

  // GitHub 토큰 + 저장소 이름이 있으면: 사용자 조회 → 저장소 생성
  if (githubToken && githubToken.trim() && (repoName || useGithubIo)) {
    try {
      ghUser = await githubApi("api.github.com", "/user", githubToken.trim(), "GET");
      if (useGithubIo && ghUser && ghUser.login) {
        finalRepoName = ghUser.login + ".github.io";
      }
      siteUrl = finalRepoName === (ghUser && ghUser.login + ".github.io")
        ? "https://" + ghUser.login + ".github.io"
        : "https://" + ghUser.login + ".github.io/" + finalRepoName;
      try {
        await githubApi("api.github.com", "/user/repos", githubToken.trim(), "POST", {
          name: finalRepoName,
          private: false,
          auto_init: false,
        });
      } catch (err) {
        const msg = err.message || "";
        if (msg.includes("name already exists") || msg.includes("422") || msg.includes("Repository creation failed")) {
          // 저장소가 이미 있으면 기존 저장소에 푸시만 진행
        } else {
          return { ok: false, error: "GitHub 저장소 생성 실패: " + msg };
        }
      }
    } catch (err) {
      return { ok: false, error: "GitHub 연동 실패: " + (err.message || err) };
    }
  }

  try {
    const zip = new AdmZip(payloadPath);
    zip.extractAllTo(absPath, true);
  } catch (err) {
    return { ok: false, error: "압축 해제 실패: " + err.message };
  }

  const replaceSiteName = (filePath) => {
    try {
      let content = fs.readFileSync(filePath, "utf8");
      const fullTitle = [mainTitle, subtitle].filter(Boolean).join(" ");
      const desc = `${mainTitle}의 사진 포트폴리오. 다양한 작품을 한눈에 감상해 보세요.`;
      content = content
        .replace(/Jung In Hwan Photography/g, fullTitle)
        .replace(/>Jung In Hwan</g, ">" + mainTitle + "<")
        .replace(/>Photography</g, ">" + subtitle + "<")
        .replace(/Jung In Hwan의 사진 포트폴리오/g, desc);
      fs.writeFileSync(filePath, content, "utf8");
    } catch (_) {}
  };
  replaceSiteName(path.join(absPath, "index.html"));
  replaceSiteName(path.join(absPath, "collection.html"));

  if (siteUrl) {
    try {
      const pkgPath = path.join(absPath, "package.json");
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      pkg.homepage = siteUrl + "/";
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), "utf8");
    } catch (_) {}
  }

  await new Promise((resolve) => {
    const child = spawn("npm", ["install"], { cwd: absPath, shell: true, stdio: "pipe" });
    child.on("close", () => resolve());
  }).catch(() => {});

  if (githubToken && githubToken.trim() && ghUser && finalRepoName) {
    const originWithToken = "https://" + githubToken.trim() + "@github.com/" + ghUser.login + "/" + finalRepoName + ".git";
    const originClean = "https://github.com/" + ghUser.login + "/" + finalRepoName + ".git";
    try {
      await runCmd("git init", absPath);
      await runCmd("git config user.email \"install@photosite.local\"", absPath).catch(() => {});
      await runCmd("git config user.name \"PhotoSite Installer\"", absPath).catch(() => {});
      await runCmd("git remote add origin \"" + originWithToken + "\"", absPath);
      await runCmd("git add -A", absPath);
      await runCmd("git commit -m \"Initial commit\"", absPath);
      await runCmd("git branch -M main", absPath);
      await runCmd("git push -u origin main", absPath);
      await runCmd("git remote set-url origin \"" + originClean + "\"", absPath);
      await runCmd("npm run deploy", absPath).catch(() => {}); // gh-pages 브랜치 생성
      try {
        await githubApi("api.github.com", "/repos/" + ghUser.login + "/" + finalRepoName + "/pages", githubToken.trim(), "POST", {
          build_type: "legacy",
          source: { branch: "gh-pages", path: "/" },
        });
      } catch (_) {}
    } catch (err) {
      return { ok: false, error: "Git 푸시 또는 Pages 설정 실패: " + (err.message || err) };
    }
  } else if (githubUrl && githubUrl.trim()) {
    try {
      await runCmd("git init", absPath);
      await runCmd("git remote add origin \"" + githubUrl.trim() + "\"", absPath);
    } catch (_) {}
  }

  return { ok: true, path: absPath, siteUrl: siteUrl || undefined };
});
