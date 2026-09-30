/**
 * WALL / collections 변경 감지 → images.json(갤러리+background)·sitemap.xml 갱신 → GitHub 업로드
 * 프로젝트 루트에서 실행: node sync-and-push.js
 * git 이 없어도 동작 (publish-github.js 가 GitHub API 로 직접 커밋)
 */

const { runSync } = require("./sync-local.js");
const { generateSitemap } = require("./generate-sitemap.js");
const { publish, SITE_URL } = require("./publish-github.js");

runSync()
  .then(() => {
    if (generateSitemap()) console.log("🗺 sitemap.xml 갱신");
    console.log("\n📤 GitHub 업로드...");
    return publish("chore: collections 동기화");
  })
  .then((result) => {
    if (!result.changed) {
      console.log("\n📤 변경 없음. 업로드 생략.");
      return;
    }
    console.log(`\n✅ 동기화 및 업로드 완료: ${result.url}`);
    console.log(`   사이트(${SITE_URL})에는 1~2분 후 반영됩니다.`);
  })
  .catch((err) => {
    console.error("❌ 오류:", err.message);
    process.exit(1);
  });
