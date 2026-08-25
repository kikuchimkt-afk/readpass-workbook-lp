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
  if (!grade.slug || !grade.label || !grade.fileCode || !Array.isArray(grade.sessions) || !grade.sessions.length) {
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
      const pathFileName = decodeURIComponent(document.path.split("/").at(-1));
      if (pathFileName !== document.downloadName) {
        throw new Error(
          `PDF path filename and download name must match: ${document.path} / ${document.downloadName}`,
        );
      }
      const requiredNameParts = ["ReadPass", "EIKEN", grade.fileCode, session.key];
      if (!requiredNameParts.every((part) => document.downloadName.includes(part))) {
        throw new Error(`Download name does not identify the material: ${document.downloadName}`);
      }
      if (document.type === "workbook" && !document.downloadName.includes("Student")) {
        throw new Error(`Workbook download name must identify the student audience: ${document.downloadName}`);
      }
      if (document.type === "teaching-guide" && !document.downloadName.includes("Instructor_Teaching_Guide")) {
        throw new Error(`Teaching guide download name is incomplete: ${document.downloadName}`);
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
  "PenPass",
  "ReadPass連動 かきこみワーク",
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

const vercel = JSON.parse(readFileSync("vercel.json", "utf8"));
const redirects = vercel.redirects ?? [];
const requiredLegacySources = [
  "/materials/grade-pre2/2025-3/workbook-support.pdf",
  "/materials/grade-pre2/2025-3/workbook-standard.pdf",
  "/materials/grade-pre2/2025-3/teaching-guide.pdf",
  "/materials/grade-pre2/2025-2/workbook-support.pdf",
  "/materials/grade-pre2/2025-2/workbook-standard.pdf",
  "/materials/grade-pre2/2025-2/teaching-guide.pdf",
  "/materials/grade-pre2/2025-1/workbook-support.pdf",
  "/materials/grade-pre2/2025-1/workbook-standard.pdf",
  "/materials/grade-pre2/2025-1/teaching-guide.pdf",
  "/materials/grade3/2025-1/workbook.pdf",
  "/materials/grade3/2025-1/workbook-standard.pdf",
  "/materials/grade3/2025-1/teaching-guide.pdf",
  "/materials/grade3/2025-2/workbook-support.pdf",
  "/materials/grade3/2025-2/workbook-standard.pdf",
  "/materials/grade3/2025-2/teaching-guide.pdf",
  "/materials/grade3/2025-3/workbook-support.pdf",
  "/materials/grade3/2025-3/workbook-standard.pdf",
  "/materials/grade3/2025-3/teaching-guide.pdf",
  "/materials/grade4/2025-3/workbook.pdf",
  "/materials/grade4/2025-3/teaching-guide.pdf",
  "/materials/grade4/2025-2/workbook.pdf",
  "/materials/grade4/2025-2/teaching-guide.pdf",
  "/materials/grade4/2025-1/workbook.pdf",
  "/materials/grade4/2025-1/teaching-guide.pdf",
  "/materials/grade5/2025-3/workbook.pdf",
  "/materials/grade5/2025-3/teaching-guide.pdf",
  "/materials/grade5/2025-2/workbook.pdf",
  "/materials/grade5/2025-2/teaching-guide.pdf",
  "/materials/grade5/2025-1/workbook.pdf",
  "/materials/grade5/2025-1/teaching-guide.pdf",
];
unique(redirects.map((redirect) => redirect.source), "redirect source");
for (const source of requiredLegacySources) {
  if (!redirects.some((redirect) => redirect.source === source)) {
    throw new Error(`Missing legacy PDF redirect: ${source}`);
  }
}
for (const redirect of redirects) {
  if (!redirect.permanent || !paths.includes(redirect.destination)) {
    throw new Error(`Invalid legacy PDF redirect: ${redirect.source}`);
  }
}

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
