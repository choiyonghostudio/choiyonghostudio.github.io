/**
 * collections.json 기준으로 sitemap.xml 생성
 * URL 목록이 바뀐 경우에만 파일을 다시 씀 (lastmod 때문에 매번 커밋되는 것 방지)
 */

const fs = require("fs");
const path = require("path");
const { SITE_URL } = require("./publish-github.js");

const ROOT = path.resolve(__dirname);
const STATIC_PAGES = ["", "about.html", "contact.html"];
const SECTIONS = ["personalWorks", "works"];

function escapeXml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function sitemapUrls() {
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, "collections.json"), "utf8"));
  const urls = STATIC_PAGES.map((p) => `${SITE_URL}/${p}`);
  for (const section of SECTIONS) {
    for (const c of data[section] || []) {
      urls.push(`${SITE_URL}/collection.html?section=${section}&id=${encodeURIComponent(c.id)}`);
    }
  }
  return urls.map(escapeXml);
}

function generateSitemap() {
  const file = path.join(ROOT, "sitemap.xml");
  const locs = sitemapUrls();
  const existing = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  const existingLocs = [...existing.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);
  if (locs.length === existingLocs.length && locs.every((l, i) => l === existingLocs[i])) {
    return false;
  }

  const today = new Date().toLocaleDateString("sv-SE");
  const body = locs
    .map((loc) => `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${today}</lastmod>\n  </url>`)
    .join("\n");
  fs.writeFileSync(
    file,
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`,
    "utf8"
  );
  return true;
}

if (require.main === module) {
  console.log(generateSitemap() ? "🗺 sitemap.xml 갱신" : "🗺 sitemap.xml 변경 없음");
}

module.exports = { generateSitemap };
