/**
 * 사진 폴더 변경 감지 → images.json·collections.json 갱신만 (Git/서버 없음)
 *
 * 구조:
 *   home/                      홈 대표사진
 *   personal-works/{이름}/     Personal Works 컬렉션
 *   works/{이름}/              Works 컬렉션
 *
 * 홈 대표사진: 파일명을 featured.* 로 두거나, collections.json 의 home.featured 로 지정
 */

const fs = require("fs").promises;
const path = require("path");

const ROOT = path.resolve(__dirname);
const IMAGE_EXT = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"];
const SECTION_DIRS = {
  home: "home",
  personalWorks: "personal-works",
  works: "works",
};

function isImage(name) {
  return IMAGE_EXT.includes(path.extname(name).toLowerCase());
}

function isBackgroundFile(name) {
  const stem = path.parse(name).name.toLowerCase();
  return stem === "background" || stem === "bsckground";
}

function isSceneAssetFile(name) {
  const stem = path.parse(name).name.toLowerCase();
  return stem.startsWith("bg-");
}

function isGalleryExcludedFile(name) {
  return isBackgroundFile(name) || isSceneAssetFile(name);
}

function photoOrderFor(entry, isNew) {
  if (isNew) return "asc";
  return entry && entry.photoOrder === "asc" ? "asc" : "desc";
}

function sortPhotoNames(names, order) {
  const copy = [...names];
  copy.sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
  if (order !== "asc") copy.reverse();
  return copy;
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function listSubdirs(dir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

async function subdirsByBirth(dir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const dirs = entries.filter((e) => e.isDirectory());
    const withBirth = await Promise.all(
      dirs.map(async (e) => {
        const stat = await fs.stat(path.join(dir, e.name));
        const t =
          (stat.birthtime && stat.birthtime.getTime && stat.birthtime.getTime()) ||
          (stat.mtime && stat.mtime.getTime && stat.mtime.getTime()) ||
          0;
        return { id: e.name, birthtime: t };
      })
    );
    withBirth.sort((a, b) => b.birthtime - a.birthtime);
    return withBirth.map((d) => d.id);
  } catch {
    return [];
  }
}

async function normalizeBackgroundFilename(dir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const bgLike = entries.filter(
      (e) => e.isFile() && isImage(e.name) && isBackgroundFile(e.name)
    );
    if (!bgLike.length) return null;
    const canonical = bgLike.find(
      (e) => path.parse(e.name).name.toLowerCase() === "background"
    );
    const typo = bgLike.find(
      (e) => path.parse(e.name).name.toLowerCase() === "bsckground"
    );
    if (typo && !canonical) {
      const ext = path.extname(typo.name);
      const dest = path.join(dir, `background${ext}`);
      await fs.rename(path.join(dir, typo.name), dest);
      return `background${ext}`;
    }
    return canonical ? canonical.name : bgLike[0].name;
  } catch {
    return null;
  }
}

async function loadCollectionsJson() {
  const file = path.join(ROOT, "collections.json");
  try {
    const raw = await fs.readFile(file, "utf8");
    const data = JSON.parse(raw);
    if (data && !Array.isArray(data)) {
      return {
        home: data.home && typeof data.home === "object" ? data.home : {},
        personalWorks: Array.isArray(data.personalWorks) ? data.personalWorks : [],
        works: Array.isArray(data.works) ? data.works : [],
      };
    }
  } catch {
    // empty
  }
  return { home: {}, personalWorks: [], works: [] };
}

async function saveCollectionsJson(data) {
  const file = path.join(ROOT, "collections.json");
  await fs.writeFile(file, JSON.stringify(data, null, 2), "utf8");
}

async function readImagesJson(relPath) {
  const file = path.join(ROOT, relPath, "images.json");
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function pickFeatured(files, previousFeatured) {
  const featuredFile = files.find(
    (name) => path.parse(name).name.toLowerCase() === "featured"
  );
  if (featuredFile) return featuredFile;
  if (previousFeatured && files.includes(previousFeatured)) return previousFeatured;
  return files[0] || null;
}

async function generateImagesJson(relPath, photoOrder, extra = {}) {
  const dir = path.join(ROOT, relPath);
  const outFile = path.join(dir, "images.json");
  await ensureDir(dir);
  const backgroundFile = await normalizeBackgroundFilename(dir);
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = sortPhotoNames(
    entries
      .filter(
        (e) =>
          e.isFile() &&
          e.name !== "images.json" &&
          isImage(e.name) &&
          !isGalleryExcludedFile(e.name)
      )
      .map((e) => e.name),
    photoOrder
  );
  const images = files.map((file) => ({
    src: `${relPath}/${file}`,
    alt: path.parse(file).name,
  }));
  const previous = await readImagesJson(relPath);
  const data = {
    background: backgroundFile ? `${relPath}/${backgroundFile}` : null,
    images,
    ...extra,
  };
  if (extra.keepFeatured) {
    const prevName = previous && previous.featured
      ? path.basename(String(previous.featured))
      : extra.featured || null;
    const featured = pickFeatured(files, prevName);
    data.featured = featured;
    delete data.keepFeatured;
  }
  await fs.writeFile(outFile, JSON.stringify(data, null, 2), "utf8");
  return { count: images.length, background: backgroundFile, featured: data.featured || null };
}

function mergeSectionList(existing, dirIds, dirIdsByBirth) {
  const byId = new Map(existing.map((c) => [c.id, c]));
  const newIds = new Set();
  for (const id of dirIds) {
    if (byId.has(id)) continue;
    newIds.add(id);
    byId.set(id, { id, name: id, photoOrder: "asc" });
  }
  const kept = existing.filter((c) => dirIds.includes(c.id));
  const newcomers = dirIdsByBirth
    .filter((id) => newIds.has(id))
    .map((id) => byId.get(id));
  return [...newcomers, ...kept].map((c) => ({
    id: c.id,
    name: c.name || c.id,
    photoOrder: photoOrderFor(c, newIds.has(c.id)),
  }));
}

async function runSync() {
  process.chdir(ROOT);
  console.log("📷 사진 폴더 동기화\n");
  console.log("   작업 폴더:", ROOT, "\n");

  const homeDir = path.join(ROOT, SECTION_DIRS.home);
  const personalDir = path.join(ROOT, SECTION_DIRS.personalWorks);
  const worksDir = path.join(ROOT, SECTION_DIRS.works);
  await ensureDir(homeDir);
  await ensureDir(personalDir);
  await ensureDir(worksDir);

  const state = await loadCollectionsJson();
  const personalIds = await listSubdirs(personalDir);
  const worksIds = await listSubdirs(worksDir);
  const personalByBirth = await subdirsByBirth(personalDir);
  const worksByBirth = await subdirsByBirth(worksDir);

  state.personalWorks = mergeSectionList(state.personalWorks, personalIds, personalByBirth);
  state.works = mergeSectionList(state.works, worksIds, worksByBirth);

  const homeResult = await generateImagesJson(SECTION_DIRS.home, "asc", {
    keepFeatured: true,
    featured: state.home && state.home.featured,
  });
  state.home = {
    featured: homeResult.featured,
  };
  console.log(
    `🖼 홈 → images.json 갱신 (${homeResult.count}개 이미지` +
      (homeResult.featured ? `, 대표 ${homeResult.featured}` : "") +
      `)`
  );

  for (const entry of state.personalWorks) {
    const rel = `${SECTION_DIRS.personalWorks}/${entry.id}`;
    try {
      const { count, background } = await generateImagesJson(rel, entry.photoOrder);
      const bgNote = background ? `, 배경 ${background}` : "";
      console.log(`🖼 Personal Works "${entry.id}" → images.json 갱신 (${count}개 이미지${bgNote})`);
    } catch (err) {
      console.error(`❌ Personal Works "${entry.id}" 실패:`, err.message);
    }
  }

  for (const entry of state.works) {
    const rel = `${SECTION_DIRS.works}/${entry.id}`;
    try {
      const { count, background } = await generateImagesJson(rel, entry.photoOrder);
      const bgNote = background ? `, 배경 ${background}` : "";
      console.log(`🖼 Works "${entry.id}" → images.json 갱신 (${count}개 이미지${bgNote})`);
    } catch (err) {
      console.error(`❌ Works "${entry.id}" 실패:`, err.message);
    }
  }

  await saveCollectionsJson(state);
  console.log("\n✅ 모든 컬렉션 갱신 완료.");
  return true;
}

module.exports = { runSync, generateImagesJson, SECTION_DIRS };
