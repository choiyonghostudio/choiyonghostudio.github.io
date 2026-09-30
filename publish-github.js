/**
 * 로컬 폴더 전체를 GitHub 저장소 main 브랜치에 커밋 (git 설치 불필요)
 * - 인증: gh CLI 로그인 토큰 (gh auth login) 또는 GH_TOKEN 환경변수
 * - .gitignore 에 적힌 항목은 제외, 로컬에서 지운 파일은 원격에서도 삭제됨
 * 단독 실행: node publish-github.js "커밋 메시지"
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { execFileSync } = require("child_process");

const OWNER = "choiyonghostudio";
const REPO = `${OWNER}.github.io`;
const BRANCH = "main";
const SITE_URL = `https://${OWNER}.github.io`;

const ROOT = path.resolve(__dirname);
const GH_CANDIDATES = ["gh", path.join(os.homedir(), ".local/gh/gh"), "/opt/homebrew/bin/gh", "/usr/local/bin/gh"];

function getToken() {
  if (process.env.GH_TOKEN || process.env.GITHUB_TOKEN) return process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  for (const gh of GH_CANDIDATES) {
    try {
      const token = execFileSync(gh, ["auth", "token"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
      if (token) return token;
    } catch {
      // try next candidate
    }
  }
  throw new Error("GitHub 로그인 정보가 없습니다. 터미널에서 `gh auth login` 을 먼저 실행하세요.");
}

function loadIgnore() {
  let lines = [];
  try {
    lines = fs.readFileSync(path.join(ROOT, ".gitignore"), "utf8").split(/\r?\n/);
  } catch {
    // no .gitignore
  }
  const matchers = [".git/", ...lines]
    .map((l) => l.trim().normalize("NFC"))
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const pattern = l.replace(/^\/|\/$/g, "");
      const source = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*").replace(/\?/g, "[^/]");
      return { dirOnly: l.endsWith("/"), re: new RegExp(`^${source}$`) };
    });
  return (name, isDir) => matchers.some((m) => (!m.dirOnly || isDir) && m.re.test(name.normalize("NFC")));
}

function collectFiles() {
  const ignored = loadIgnore();
  const files = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (ignored(e.name, e.isDirectory())) continue;
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) walk(abs);
      else if (e.isFile()) files.push(abs);
    }
  })(ROOT);

  return files.map((abs) => {
    const buf = fs.readFileSync(abs);
    const rel = path.relative(ROOT, abs).split(path.sep).join("/").normalize("NFC");
    const executable = (fs.statSync(abs).mode & 0o111) !== 0 && /\.(command|sh)$/.test(rel);
    return {
      rel,
      buf,
      mode: executable ? "100755" : "100644",
      sha: crypto.createHash("sha1").update(`blob ${buf.length}\0`).update(buf).digest("hex"),
    };
  });
}

function createApi(token) {
  return async function api(method, url, body) {
    for (let attempt = 1; ; attempt++) {
      const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}${url}`, {
        method,
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (res.ok) return res.json();
      const text = await res.text();
      // GitHub 은 분당 콘텐츠 생성 요청 수를 제한하므로 403/429 는 잠시 기다렸다 재시도
      if (attempt < 6 && (res.status >= 500 || res.status === 403 || res.status === 429)) {
        const wait = res.status >= 500 ? 3000 * attempt : 60000;
        console.log(`   GitHub 응답 ${res.status}, ${wait / 1000}초 후 재시도...`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      throw new Error(`GitHub API ${method} ${url} 실패 (${res.status}): ${text.slice(0, 300)}`);
    }
  };
}

async function buildTree(api, files) {
  const dirs = new Map([["", []]]);
  for (const f of files) {
    const parts = f.rel.split("/");
    for (let d = 1; d < parts.length; d++) {
      const dir = parts.slice(0, d).join("/");
      if (!dirs.has(dir)) dirs.set(dir, []);
    }
    dirs.get(parts.slice(0, -1).join("/")).push({ path: parts[parts.length - 1], mode: f.mode, type: "blob", sha: f.sha });
  }
  // 한 번에 큰 트리를 보내면 GitHub 가 시간 초과로 거부하므로 가장 깊은 폴더부터 하나씩 생성
  const depth = (d) => (d === "" ? 0 : d.split("/").length);
  const order = [...dirs.keys()].filter((d) => d !== "").sort((a, b) => depth(b) - depth(a));
  for (const dir of order) {
    const res = await api("POST", "/git/trees", { tree: dirs.get(dir) });
    const parts = dir.split("/");
    dirs.get(parts.slice(0, -1).join("/")).push({ path: parts[parts.length - 1], mode: "040000", type: "tree", sha: res.sha });
  }
  return (await api("POST", "/git/trees", { tree: dirs.get("") })).sha;
}

async function publish(message) {
  const api = createApi(getToken());
  const parentSha = (await api("GET", `/git/ref/heads/${BRANCH}`)).object.sha;
  const parent = await api("GET", `/git/commits/${parentSha}`);
  const remoteTree = await api("GET", `/git/trees/${parent.tree.sha}?recursive=1`);
  const remoteBlobs = new Set(remoteTree.tree.filter((t) => t.type === "blob").map((t) => t.sha));

  const files = collectFiles();
  const toUpload = files.filter((f) => !remoteBlobs.has(f.sha));
  if (toUpload.length) console.log(`   새로 올릴 파일 ${toUpload.length}개`);

  const queue = [...toUpload];
  let done = 0;
  await Promise.all(
    Array.from({ length: 2 }, async () => {
      while (queue.length) {
        const f = queue.shift();
        const started = Date.now();
        await api("POST", "/git/blobs", { content: f.buf.toString("base64"), encoding: "base64" });
        console.log(`   업로드 ${++done}/${toUpload.length} ${f.rel}`);
        await new Promise((r) => setTimeout(r, Math.max(0, 1600 - (Date.now() - started))));
      }
    })
  );

  const treeSha = await buildTree(api, files);
  if (treeSha === parent.tree.sha) return { changed: false };

  const commit = await api("POST", "/git/commits", { message, tree: treeSha, parents: [parentSha] });
  await api("PATCH", `/git/refs/heads/${BRANCH}`, { sha: commit.sha, force: false });
  return { changed: true, sha: commit.sha, url: `https://github.com/${OWNER}/${REPO}/commit/${commit.sha}` };
}

if (require.main === module) {
  publish(process.argv[2] || "chore: 사이트 업데이트")
    .then((r) => console.log(r.changed ? `✅ 업로드 완료: ${r.url}` : "변경 없음. 업로드 생략."))
    .catch((err) => {
      console.error("❌ 오류:", err.message);
      process.exit(1);
    });
}

module.exports = { publish, SITE_URL, OWNER, REPO };
