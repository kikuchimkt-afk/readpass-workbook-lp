import { readFileSync, writeFileSync } from "node:fs";

const data = JSON.parse(readFileSync("data/materials.json", "utf8"));
const source = readFileSync("index.html", "utf8");
const startMarker = "<!-- MATERIAL_CATALOG_START -->";
const endMarker = "<!-- MATERIAL_CATALOG_END -->";

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const allSessions = data.grades
  .flatMap((grade) => grade.sessions.map((session) => ({ ...session, grade })))
  .sort((a, b) => b.year - a.year || b.session - a.session || a.grade.order - b.grade.order);
const years = [...new Set(allSessions.map((session) => session.year))].sort((a, b) => b - a);

const gradeOptions = data.grades
  .sort((a, b) => a.order - b.order)
  .map((grade) => `<option value="${escapeHtml(grade.slug)}">${escapeHtml(grade.label)}</option>`)
  .join("");
const yearOptions = years.map((year) => `<option value="${year}">${year}年度</option>`).join("");
const latestSessionKey = (grade) =>
  [...grade.sessions].sort((a, b) => b.year - a.year || b.session - a.session)[0].key;

const renderDocument = (document, session, grade) => {
  const isGuide = document.type === "teaching-guide";
  const icon = isGuide ? "T" : "W";
  const kind = isGuide ? "講師用" : "生徒用";
  const ariaBase = `${grade.label} ${session.label} ${document.label}`;
  return `
              <article class="document-row${isGuide ? " document-row-guide" : ""}">
                <div class="document-icon" aria-hidden="true">${icon}</div>
                <div class="document-copy">
                  <div class="document-title-line">
                    <p class="document-audience">${escapeHtml(document.audience)}</p>
                    <span>${escapeHtml(document.pages)}ページ</span>
                  </div>
                  <h4>${escapeHtml(document.label)}</h4>
                  <p>${escapeHtml(document.description)}</p>
                </div>
                <div class="document-actions" aria-label="${escapeHtml(ariaBase)}の操作">
                  <a class="document-button document-view" href="${escapeHtml(document.path)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(ariaBase)}のPDFを新しいタブで閲覧">PDFを閲覧</a>
                  <a class="document-button document-download" href="${escapeHtml(document.path)}" download="${escapeHtml(document.downloadName)}" aria-label="${escapeHtml(ariaBase)}のPDFをダウンロード">ダウンロード</a>
                </div>
              </article>`;
};

const renderSession = (session) => {
  const { grade } = session;
  const workbookCount = session.documents.filter((document) => document.type === "workbook").length;
  const available = workbookCount === 1 ? "生徒用1版＋指導教案" : `生徒用${workbookCount}版＋指導教案`;
  return `
          <article class="session-card" id="${escapeHtml(grade.slug)}-${escapeHtml(session.key)}" data-catalog-card data-grade="${escapeHtml(grade.slug)}" data-year="${session.year}">
            <header class="session-card-head">
              <div>
                <p class="session-grade">${escapeHtml(grade.label)}</p>
                <h3>${escapeHtml(session.label)}</h3>
              </div>
              <div class="session-status"><span>公開中</span><small>${escapeHtml(available)}</small></div>
            </header>
            <div class="document-list">${session.documents.map((document) => renderDocument(document, session, grade)).join("")}
            </div>
          </article>`;
};

const catalog = `
          <div class="grade-jump" aria-label="級から教材を探す">
            <span>収録級</span>
            ${data.grades.map((grade) => `<a href="#${escapeHtml(grade.slug)}-${escapeHtml(latestSessionKey(grade))}">${escapeHtml(grade.label)}</a>`).join("\n            ")}
          </div>

          <form class="catalog-controls" data-catalog-controls aria-label="教材の絞り込み">
            <label>
              <span>級</span>
              <select name="grade" data-grade-filter>
                <option value="all">すべての級</option>
                ${gradeOptions}
              </select>
            </label>
            <label>
              <span>年度</span>
              <select name="year" data-year-filter>
                <option value="all">すべての年度</option>
                ${yearOptions}
              </select>
            </label>
            <button type="button" data-filter-reset>絞り込みを解除</button>
          </form>

          <div class="catalog-summary">
            <p data-result-count aria-live="polite">${allSessions.length}回分・PDF ${allSessions.reduce((count, session) => count + session.documents.length, 0)}点を掲載</p>
            <p>新しい試験回から順に表示しています。</p>
          </div>

          <div class="session-grid" data-session-grid>${allSessions.map(renderSession).join("")}
          </div>
          <p class="catalog-empty" data-catalog-empty hidden>該当する教材はまだ登録されていません。</p>`;

if (!source.includes(startMarker) || !source.includes(endMarker)) {
  throw new Error("Catalog markers are missing from index.html");
}

const before = source.slice(0, source.indexOf(startMarker) + startMarker.length);
const after = source.slice(source.indexOf(endMarker));
const rendered = `${before}${catalog}\n          ${after}`;

if (process.argv.includes("--check")) {
  if (rendered !== source) {
    throw new Error("Generated catalog is stale. Run: npm run catalog");
  }
  console.log("Generated catalog is current");
} else {
  writeFileSync("index.html", rendered, "utf8");
  console.log(`Rendered ${allSessions.length} sessions from data/materials.json`);
}
