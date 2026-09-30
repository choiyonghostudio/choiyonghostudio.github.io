const { generateImagesJson } = require("./sync-local.js");
const path = require("path");

const COLLECTION_NAME = process.env.COLLECTION_ID || process.argv[2];

if (!COLLECTION_NAME) {
  console.error("❌ 사용법: node generate-collection-json.js [경로]");
  console.error('예: node generate-collection-json.js "personal-works/컬렉션명"');
  console.error('예: node generate-collection-json.js "works/컬렉션명"');
  console.error('예: node generate-collection-json.js home');
  process.exit(1);
}

const relPath = COLLECTION_NAME.replace(/^collections[\\/]/, "").replace(/\\/g, "/");

generateImagesJson(relPath, "asc", relPath === "home" ? { keepFeatured: true } : {})
  .then((result) => {
    console.log(
      `✅ ${relPath}/images.json 생성 완료 (${result.count}개 이미지` +
        (result.featured ? `, 대표 ${result.featured}` : "") +
        (result.background ? `, 배경 ${path.basename(result.background)}` : "") +
        `)`
    );
  })
  .catch((error) => {
    console.error("❌ images.json 생성 중 오류:", error);
    process.exit(1);
  });
