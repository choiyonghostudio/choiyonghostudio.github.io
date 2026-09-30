/**
 * 한 번만 실행: 루트의 WALL 폴더를 collections/_wall 로 옮깁니다.
 * 실행 후 동기화(동기화-및-로컬서버.bat 또는 npm run serve)를 한 번 실행하세요.
 */

const fs = require("fs").promises;
const path = require("path");

const ROOT = path.resolve(__dirname);
const WALL_SRC = path.join(ROOT, "WALL");
const WALL_DST = path.join(ROOT, "personal-works", "_WALL");

async function main() {
  try {
    await fs.access(WALL_SRC);
  } catch {
    console.log("WALL 폴더가 없습니다. 마이그레이션을 건너뜁니다.");
    return;
  }

  await fs.mkdir(path.join(ROOT, "personal-works"), { recursive: true });
  await fs.mkdir(WALL_DST, { recursive: true });

  const entries = await fs.readdir(WALL_SRC, { withFileTypes: true });
  for (const e of entries) {
    const src = path.join(WALL_SRC, e.name);
    const dst = path.join(WALL_DST, e.name);
    if (e.isFile()) {
      await fs.copyFile(src, dst);
      console.log("복사:", e.name);
    }
  }

  console.log("\n✅ personal-works/_WALL 에 복사했습니다.");
  console.log("   원하는 경우 루트의 WALL 폴더를 수동으로 삭제하세요.");
  console.log("   이어서 동기화(동기화-및-로컬서버.bat 또는 npm run serve)를 실행하세요.");
}

main().catch((err) => {
  console.error("❌ 오류:", err.message);
  process.exit(1);
});
