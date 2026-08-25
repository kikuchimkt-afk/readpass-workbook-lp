import { readFileSync, existsSync } from "node:fs";

const requiredFiles = [
  "index.html",
  "styles.css",
  "script.js",
  "assets/favicon.svg",
  "materials/grade3/2025-1/workbook.pdf",
  "materials/grade3/2025-1/teaching-guide.pdf",
  "vercel.json",
];
const missingFiles = requiredFiles.filter((file) => !existsSync(file));
if (missingFiles.length) throw new Error(`Missing files: ${missingFiles.join(", ")}`);

const html = readFileSync("index.html", "utf8");
const css = readFileSync("styles.css", "utf8");
const js = readFileSync("script.js", "utf8");
const requiredIds = ["top", "main", "materials", "philosophy", "design", "sample", "roadmap", "trial"];
const missingIds = requiredIds.filter((id) => !html.includes(`id="${id}"`));
if (missingIds.length) throw new Error(`Missing section IDs: ${missingIds.join(", ")}`);

const requiredCopy = [
  "社内利用専用",
  "外部への共有・再配布は行わないでください",
  "noindex, nofollow, noarchive",
  "社内教材ポータル",
  "ワークブック本体",
  "指導教案",
  "PDFを閲覧",
  "PDFをダウンロード",
  "不正解3語",
  "直訳風",
  "自然な訳",
  "承認や推奨",
];
const missingCopy = requiredCopy.filter((text) => !html.includes(text));
if (missingCopy.length) throw new Error(`Missing required copy: ${missingCopy.join(", ")}`);

if (!css.includes("@media (max-width: 680px)")) throw new Error("Mobile breakpoint is missing");
if (!css.includes("prefers-reduced-motion")) throw new Error("Reduced-motion support is missing");
if (!js.includes("sampleContent")) throw new Error("Interactive sample is missing");

const materialLinks = [
  "/materials/grade3/2025-1/workbook.pdf",
  "/materials/grade3/2025-1/teaching-guide.pdf",
];
for (const href of materialLinks) {
  if (html.split(`href="${href}"`).length - 1 !== 2) {
    throw new Error(`Material PDF must have separate view and download links: ${href}`);
  }
}

if ((html.match(/\sdownload="[^"]+\.pdf"/g) || []).length !== materialLinks.length) {
  throw new Error("Each material PDF must have one named download link");
}

for (const match of html.matchAll(/href="([^"]+)"/g)) {
  const href = match[1];
  if (href.startsWith("#") && !html.includes(`id="${href.slice(1)}"`)) {
    throw new Error(`Broken in-page link: ${href}`);
  }
}

console.log("LP validation passed: files, sections, required copy, responsive CSS, and interactions");
