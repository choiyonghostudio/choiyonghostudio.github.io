const fs = require("fs").promises;
const path = require("path");

const ROOT = process.cwd();
const IMAGES_DIR = path.join(ROOT, "WALL");
const OUTPUT_FILE = path.join(ROOT, "images.json");

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"];

async function main() {
  try {
    const entries = await fs.readdir(IMAGES_DIR, { withFileTypes: true });

    const files = entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) =>
        IMAGE_EXTENSIONS.includes(path.extname(name).toLowerCase())
      )
      .sort((a, b) => b.localeCompare(a, "en", { numeric: true })); // 이름 내림차순 정렬

    const data = files.map((file) => ({
      src: `WALL/${file}`,
      alt: path.parse(file).name,
    }));

    await fs.writeFile(OUTPUT_FILE, JSON.stringify(data, null, 2), "utf8");

    console.log(
      `✅ images.json 생성 완료 (${data.length}개 이미지)\n` +
        ` - 폴더: ${IMAGES_DIR}\n` +
        ` - 파일: ${OUTPUT_FILE}`
    );
  } catch (error) {
    console.error("❌ images.json 생성 중 오류:", error);
    process.exit(1);
  }
}

main();


