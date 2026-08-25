import { readFileSync, existsSync } from "node:fs";

const requiredFiles = ["index.html", "styles.css", "script.js", "assets/favicon.svg", "vercel.json"];
const missingFiles = requiredFiles.filter((file) => !existsSync(file));
if (missingFiles.length) throw new Error(`Missing files: ${missingFiles.join(", ")}`);

const html = readFileSync("index.html", "utf8");
const css = readFileSync("styles.css", "utf8");
const js = readFileSync("script.js", "utf8");
const requiredIds = ["top", "main", "philosophy", "design", "sample", "roadmap", "trial"];
const missingIds = requiredIds.filter((id) => !html.includes(`id="${id}"`));
if (missingIds.length) throw new Error(`Missing section IDs: ${missingIds.join(", ")}`);

const requiredCopy = [
  "当校の授業受講者向け",
  "教材単体での販売は行っていません",
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

for (const match of html.matchAll(/href="([^"]+)"/g)) {
  const href = match[1];
  if (href.startsWith("#") && !html.includes(`id="${href.slice(1)}"`)) {
    throw new Error(`Broken in-page link: ${href}`);
  }
}

console.log("LP validation passed: files, sections, required copy, responsive CSS, and interactions");
