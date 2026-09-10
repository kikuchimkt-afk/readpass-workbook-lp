import { readFileSync, writeFileSync } from "node:fs";

const data = JSON.parse(readFileSync("data/changelog.json", "utf8"));
const source = readFileSync("index.html", "utf8");
const startMarker = "<!-- CHANGELOG_START -->";
const endMarker = "<!-- CHANGELOG_END -->";

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

if (data.schemaVersion !== 1 || !Array.isArray(data.entries) || !data.entries.length) {
  throw new Error("data/changelog.json has an unsupported or empty schema");
}

// Newest first. Entries sharing a date keep the order written in the file,
// which is also newest first within that day.
const entries = data.entries
  .map((entry, index) => ({ ...entry, index }))
  .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.index - b.index));

const formatDate = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error(`Invalid changelog date: ${value}`);
  const [, year, month, day] = match;
  return `${year}年${Number(month)}月${Number(day)}日`;
};

const renderEntry = (entry) => {
  for (const key of ["date", "title", "model", "reasoning"]) {
    if (!entry[key]) throw new Error(`Changelog entry is missing ${key}: ${entry.title || entry.date}`);
  }
  if (!Array.isArray(entry.changes) || !entry.changes.length) {
    throw new Error(`Changelog entry has no changes: ${entry.title}`);
  }
  const scope = entry.scope
    ? `\n                <p class="changelog-scope">対象：${escapeHtml(entry.scope)}</p>`
    : "";
  return `
            <li class="changelog-entry">
              <div class="changelog-head">
                <time class="changelog-date" datetime="${escapeHtml(entry.date)}">${escapeHtml(formatDate(entry.date))}</time>
                <span class="changelog-tags">
                  <span class="changelog-tag changelog-tag-model">${escapeHtml(entry.model)}</span>
                  <span class="changelog-tag changelog-tag-reasoning">推論 ${escapeHtml(entry.reasoning)}</span>
                </span>
              </div>
              <h3>${escapeHtml(entry.title)}</h3>${scope}
              <ul class="changelog-changes">${entry.changes
                .map((change) => `\n                <li>${escapeHtml(change)}</li>`)
                .join("")}
              </ul>
            </li>`;
};

const changelog = `
          <ol class="changelog-list">${entries.map(renderEntry).join("")}
          </ol>`;

if (!source.includes(startMarker) || !source.includes(endMarker)) {
  throw new Error("Changelog markers are missing from index.html");
}

const before = source.slice(0, source.indexOf(startMarker) + startMarker.length);
const after = source.slice(source.indexOf(endMarker));
const rendered = `${before}${changelog}\n          ${after}`;

if (process.argv.includes("--check")) {
  if (rendered !== source) {
    throw new Error("Generated changelog is stale. Run: npm run catalog");
  }
  console.log("Generated changelog is current");
} else {
  writeFileSync("index.html", rendered, "utf8");
  console.log(`Rendered ${entries.length} changelog entries from data/changelog.json`);
}
