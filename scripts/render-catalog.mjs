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

const grades = [...data.grades].sort((a, b) => a.order - b.order);
const allSessions = grades
  .flatMap((grade) => grade.sessions.map((session) => ({ ...session, grade })))
  .sort((a, b) => b.year - a.year || b.session - a.session || a.grade.order - b.grade.order);
const years = [...new Set(allSessions.map((session) => session.year))].sort((a, b) => b - a);
const documentTotal = allSessions.reduce((count, session) => count + session.documents.length, 0);
const readPassBaseUrl = "https://read-pass-pro.vercel.app/index.html";

const yearOptions = years.map((year) => `<option value="${year}">${year}年度</option>`).join("");

const renderDocument = (document, session, grade) => {
  const isGuide = document.type === "teaching-guide";
  const ariaBase = `${grade.label} ${session.label} ${document.label}`;
  return `
                <article class="library-document${isGuide ? " library-document-guide" : ""}">
                  <span class="library-document-icon" aria-hidden="true">${isGuide ? "教" : "生"}</span>
                  <div class="library-document-copy">
                    <div class="library-document-meta">
                      <span>${escapeHtml(document.audience)}</span>
                      <span>${escapeHtml(document.pages)}ページ</span>
                    </div>
                    <h4>${escapeHtml(document.label)}</h4>
                    <p>${escapeHtml(document.description)}</p>
                  </div>
                  <div class="library-document-actions" aria-label="${escapeHtml(ariaBase)}の操作">
                    <a class="library-action library-action-view" href="${escapeHtml(document.path)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(ariaBase)}のPDFを新しいタブで閲覧">PDFを閲覧</a>
                    <a class="library-action library-action-download" href="${escapeHtml(document.path)}" download="${escapeHtml(document.downloadName)}" aria-label="${escapeHtml(ariaBase)}のPDFをダウンロード">ダウンロード</a>
                  </div>
                </article>`;
};

const renderSession = (session) => {
  const { grade } = session;
  const workbookCount = session.documents.filter((document) => document.type === "workbook").length;
  const available = workbookCount === 1 ? "生徒用＋指導教案" : `生徒用${workbookCount}版＋指導教案`;
  const readPassUrl = `${readPassBaseUrl}?grade=${encodeURIComponent(grade.slug)}&exam=${encodeURIComponent(session.key)}&nav=1`;
  const readPassAriaLabel = `ReadPassで${grade.label} ${session.label}を新しいタブで開く`;
  const searchText = [
    grade.label,
    session.label,
    ...session.documents.flatMap((document) => [document.label, document.audience]),
  ].join(" ");
  return `
            <details class="session-row" id="${escapeHtml(grade.slug)}-${escapeHtml(session.key)}" data-catalog-card data-grade="${escapeHtml(grade.slug)}" data-year="${session.year}" data-search="${escapeHtml(searchText)}">
              <summary>
                <span class="session-primary">
                  <span class="grade-pill">${escapeHtml(grade.label)}</span>
                  <span class="session-title-group">
                    <strong>${escapeHtml(session.label)}</strong>
                    <a class="session-readpass-link" href="${escapeHtml(readPassUrl)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(readPassAriaLabel)}">ReadPassで開く <span aria-hidden="true">↗</span></a>
                  </span>
                </span>
                <span class="session-contents">${escapeHtml(available)}</span>
                <span class="session-pdf-count">PDF ${session.documents.length}点</span>
                <span class="session-chevron" aria-hidden="true"></span>
              </summary>
              <div class="library-document-list">${session.documents.map((document) => renderDocument(document, session, grade)).join("")}
              </div>
            </details>`;
};

const catalog = `
          <div class="library-toolbar" data-catalog-controls>
            <div class="grade-filter-block">
              <span class="control-label">級から選ぶ</span>
              <div class="grade-filters" aria-label="級で絞り込む">
                <button type="button" class="is-active" data-grade-filter="all" aria-pressed="true">すべて</button>
                ${grades.map((grade) => `<button type="button" data-grade-filter="${escapeHtml(grade.slug)}" aria-pressed="false">${escapeHtml(grade.label)}</button>`).join("")}
              </div>
            </div>
            <label class="catalog-search">
              <span class="control-label">教材を検索</span>
              <span class="search-field"><span aria-hidden="true">⌕</span><input type="search" data-query-filter placeholder="例：3級 第2回" autocomplete="off" /></span>
            </label>
            <label class="catalog-year">
              <span class="control-label">年度</span>
              <select name="year" data-year-filter>
                <option value="all">すべて</option>
                ${yearOptions}
              </select>
            </label>
            <button class="catalog-reset" type="button" data-filter-reset>条件をクリア</button>
          </div>

          <div class="catalog-summary">
            <p data-result-count aria-live="polite">${allSessions.length}回分・PDF ${documentTotal}点を表示中</p>
            <p>行を選ぶと、教材PDFが開きます。</p>
          </div>

          <div class="session-list" data-session-grid>${allSessions.map(renderSession).join("")}
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
