/**
 * 설치에 필요한 모든 파일을 payload.zip 하나로 만듭니다.
 * node_modules, .git 제외. 실행: node build/create-payload.js
 */

const fs = require("fs");
const path = require("path");
const { createWriteStream } = require("fs");
const archiver = require("archiver");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(__dirname, "payload.zip");
const EXCLUDE = new Set(["node_modules", ".git", "build", "dist", "웹사이트 설치 프로그램", "payload.zip", ".DS_Store"]);

function* walk(dir, prefix = "") {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const name = e.name;
    if (EXCLUDE.has(name)) continue;
    const rel = prefix ? `${prefix}/${name}` : name;
    const full = path.join(dir, name);
    if (e.isDirectory()) {
      yield* walk(full, rel);
    } else {
      yield { rel, full };
    }
  }
}

async function main() {
  const out = createWriteStream(OUT);
  const archive = archiver("zip", { zlib: { level: 9 } });

  await new Promise((resolve, reject) => {
    out.on("close", resolve);
    archive.on("error", reject);
    archive.pipe(out);

    for (const { rel, full } of walk(ROOT)) {
      archive.file(full, { name: rel });
    }
    archive.finalize();
  });

  console.log("payload.zip 생성 완료:", OUT);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
