import { existsSync, readFileSync } from "node:fs";

const requiredFiles = [
  "index.html",
  "styles.css",
  "script.js",
  "data/materials.json",
  "scripts/render-catalog.mjs",
  "assets/favicon.svg",
  "vercel.json",
  "robots.txt",
];
const missingFiles = requiredFiles.filter((file) => !existsSync(file));
if (missingFiles.length) throw new Error(`Missing files: ${missingFiles.join(", ")}`);

const html = readFileSync("index.html", "utf8");
const css = readFileSync("styles.css", "utf8");
const js = readFileSync("script.js", "utf8");
const robots = readFileSync("robots.txt", "utf8");
const data = JSON.parse(readFileSync("data/materials.json", "utf8"));

if (data.schemaVersion !== 1 || !Array.isArray(data.grades) || !data.grades.length) {
  throw new Error("data/materials.json has an unsupported or empty schema");
}

const unique = (values, label) => {
  const duplicates = values.filter((value, index) => values.indexOf(value) !== index);
  if (duplicates.length) throw new Error(`Duplicate ${label}: ${[...new Set(duplicates)].join(", ")}`);
};

const gradeSlugs = data.grades.map((grade) => grade.slug);
unique(gradeSlugs, "grade slug");

const sessionIds = [];
const paths = [];
const downloadNames = [];
let documentCount = 0;

for (const grade of data.grades) {
  if (!grade.slug || !grade.label || !Array.isArray(grade.sessions) || !grade.sessions.length) {
    throw new Error(`Invalid grade entry: ${grade.slug || "unknown"}`);
  }
  for (const session of grade.sessions) {
    const sessionId = `${grade.slug}-${session.key}`;
    sessionIds.push(sessionId);
    if (!Number.isInteger(session.year) || !Number.isInteger(session.session) || !session.label) {
      throw new Error(`Invalid session metadata: ${sessionId}`);
    }
    if (!Array.isArray(session.documents) || !session.documents.length) {
      throw new Error(`Session has no documents: ${sessionId}`);
    }
    const workbooks = session.documents.filter((document) => document.type === "workbook");
    const guides = session.documents.filter((document) => document.type === "teaching-guide");
    if (!workbooks.length || guides.length !== 1) {
      throw new Error(`${sessionId} must have at least one workbook and exactly one teaching guide`);
    }

    for (const document of session.documents) {
      documentCount += 1;
      if (!document.profile || !document.label || !document.audience || !document.description) {
        throw new Error(`Incomplete document metadata in ${sessionId}`);
      }
      if (!Number.isInteger(document.pages) || document.pages <= 0) {
        throw new Error(`Invalid page count for ${document.path}`);
      }
      if (!document.path?.startsWith("/materials/") || !document.path.endsWith(".pdf")) {
        throw new Error(`Invalid material path: ${document.path}`);
      }
      if (!document.downloadName?.endsWith(".pdf")) {
        throw new Error(`Invalid download name for ${document.path}`);
      }

      paths.push(document.path);
      downloadNames.push(document.downloadName);
      const localPath = document.path.slice(1);
      if (!existsSync(localPath)) throw new Error(`Missing material PDF: ${localPath}`);
      const pdfBuffer = readFileSync(localPath);
      if (pdfBuffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
        throw new Error(`Invalid PDF signature: ${localPath}`);
      }
      const actualPages = (pdfBuffer.toString("latin1").match(/\/Type\s*\/Page\b/g) || []).length;
      if (actualPages !== document.pages) {
        throw new Error(
          `Page count mismatch for ${localPath}: data=${document.pages}, pdf=${actualPages}`,
        );
      }

      const hrefCount = html.split(`href="${document.path}"`).length - 1;
      if (hrefCount !== 2) {
        throw new Error(`Material PDF must have separate view and download links: ${document.path}`);
      }
      if (html.split(`download="${document.downloadName}"`).length - 1 !== 1) {
        throw new Error(`Material must have one named download link: ${document.path}`);
      }
      const escapedPath = document.path.replace(/[.*+?^\${}()|[\]\\]/g, "\\$&");
      const viewPattern = new RegExp(
        `<a[^>]+href="${escapedPath}"[^>]+target="_blank"[^>]+rel="noopener noreferrer"[^>]+aria-label="[^"]+"`,
      );
      if (!viewPattern.test(html)) throw new Error(`View link is not safe or accessible: ${document.path}`);
    }
  }
}

unique(sessionIds, "session ID");
unique(paths, "material path");
unique(downloadNames, "download name");

const requiredIds = ["top", "main", "materials", "profiles", "philosophy", "design", "sample", "trial"];
const missingIds = requiredIds.filter((id) => !html.includes(`id="${id}"`));
if (missingIds.length) throw new Error(`Missing section IDs: ${missingIds.join(", ")}`);

const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
unique(ids, "HTML ID");

const requiredCopy = [
  "社内利用専用",
  "外部への共有・再配布は行わないでください",
  "noindex, nofollow, noarchive",
  "社内教材ポータル",
  "教材ライブラリ",
  "サポート版",
  "標準版",
  "指導教案",
  "PDFを閲覧",
  "ダウンロード",
  "不正解3語",
  "直訳風",
  "自然な訳",
  "承認や推奨",
];
const missingCopy = requiredCopy.filter((text) => !html.includes(text));
if (missingCopy.length) throw new Error(`Missing required copy: ${missingCopy.join(", ")}`);

if (html.includes('id="roadmap"') || html.includes("教室内プロトタイプ")) {
  throw new Error("Stale prototype roadmap copy remains in index.html");
}
if (!css.includes("@media (max-width: 680px)") || !css.includes("@media (max-width: 440px)")) {
  throw new Error("Required responsive breakpoints are missing");
}
if (!css.includes("prefers-reduced-motion")) throw new Error("Reduced-motion support is missing");
if (!js.includes("sampleContent") || !js.includes("updateCatalog")) {
  throw new Error("Required page interactions are missing");
}
if (!robots.includes("Disallow: /")) throw new Error("robots.txt must discourage indexing");

for (const match of html.matchAll(/href="([^"]+)"/g)) {
  const href = match[1];
  if (href.startsWith("#") && !html.includes(`id="${href.slice(1)}"`)) {
    throw new Error(`Broken in-page link: ${href}`);
  }
}

const downloadCount = (html.match(/\sdownload="[^"]+\.pdf"/g) || []).length;
if (downloadCount !== documentCount) {
  throw new Error(`Expected ${documentCount} named PDF downloads, found ${downloadCount}`);
}

console.log(
  `LP validation passed: ${data.grades.length} grade(s), ${sessionIds.length} session(s), ${documentCount} PDF document(s)`,
);
