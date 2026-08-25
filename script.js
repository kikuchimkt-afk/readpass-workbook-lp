const header = document.querySelector("[data-header]");
const menuButton = document.querySelector(".menu-button");
const navigation = document.querySelector(".global-nav");

const closeMenu = () => {
  if (!menuButton || !navigation) return;
  menuButton.setAttribute("aria-expanded", "false");
  navigation.classList.remove("is-open");
  document.body.classList.remove("menu-open");
  menuButton.querySelector(".sr-only").textContent = "メニューを開く";
};

menuButton?.addEventListener("click", () => {
  const isOpen = menuButton.getAttribute("aria-expanded") === "true";
  menuButton.setAttribute("aria-expanded", String(!isOpen));
  navigation?.classList.toggle("is-open", !isOpen);
  document.body.classList.toggle("menu-open", !isOpen);
  menuButton.querySelector(".sr-only").textContent = isOpen ? "メニューを開く" : "メニューを閉じる";
});

navigation?.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));

window.addEventListener(
  "scroll",
  () => header?.classList.toggle("is-scrolled", window.scrollY > 16),
  { passive: true },
);

const gradeFilters = [...document.querySelectorAll("[data-grade-filter]")];
const yearFilter = document.querySelector("[data-year-filter]");
const queryFilter = document.querySelector("[data-query-filter]");
const filterReset = document.querySelector("[data-filter-reset]");
const catalogCards = [...document.querySelectorAll("[data-catalog-card]")];
const resultCount = document.querySelector("[data-result-count]");
const catalogEmpty = document.querySelector("[data-catalog-empty]");
let activeGrade = "all";

const availableGrades = new Set(gradeFilters.map((button) => button.dataset.gradeFilter));
const optionExists = (select, value) =>
  [...(select?.options ?? [])].some((option) => option.value === value);
const normalizeSearch = (value) => String(value ?? "").toLocaleLowerCase("ja").trim();
const matchesSearch = (searchText, query) => {
  const haystack = normalizeSearch(searchText);
  return normalizeSearch(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term));
};

const updateGradeButtons = () => {
  gradeFilters.forEach((button) => {
    const selected = button.dataset.gradeFilter === activeGrade;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
};

const updateCatalog = ({ updateUrl = false, clearHash = false } = {}) => {
  if (!yearFilter || !queryFilter) return;
  const year = optionExists(yearFilter, yearFilter.value) ? yearFilter.value : "all";
  const query = normalizeSearch(queryFilter.value);
  let visibleSessions = 0;
  let visibleDocuments = 0;

  catalogCards.forEach((card) => {
    const matchesGrade = activeGrade === "all" || card.dataset.grade === activeGrade;
    const matchesYear = year === "all" || card.dataset.year === year;
    const matchesQuery = !query || matchesSearch(card.dataset.search, query);
    const visible = matchesGrade && matchesYear && matchesQuery;
    card.hidden = !visible;
    if (!visible) card.open = false;
    if (visible) {
      visibleSessions += 1;
      visibleDocuments += card.querySelectorAll(".library-document").length;
    }
  });

  updateGradeButtons();
  if (resultCount) resultCount.textContent = `${visibleSessions}回分・PDF ${visibleDocuments}点を表示中`;
  if (catalogEmpty) catalogEmpty.hidden = visibleSessions !== 0;

  if (updateUrl) {
    const url = new URL(window.location.href);
    activeGrade === "all" ? url.searchParams.delete("grade") : url.searchParams.set("grade", activeGrade);
    year === "all" ? url.searchParams.delete("year") : url.searchParams.set("year", year);
    query ? url.searchParams.set("q", queryFilter.value.trim()) : url.searchParams.delete("q");
    if (clearHash) url.hash = "";
    history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }
};

const syncCatalogFromLocation = () => {
  if (!yearFilter || !queryFilter) return;
  const url = new URL(window.location.href);
  const hashId = decodeURIComponent(url.hash.slice(1));
  const hashTarget = hashId ? document.getElementById(hashId) : null;
  const requestedGrade = url.searchParams.get("grade");
  activeGrade = availableGrades.has(requestedGrade) ? requestedGrade : "all";
  yearFilter.value = optionExists(yearFilter, url.searchParams.get("year"))
    ? url.searchParams.get("year")
    : "all";
  queryFilter.value = url.searchParams.get("q") ?? "";

  if (hashTarget?.matches("[data-catalog-card]")) {
    activeGrade = hashTarget.dataset.grade;
    yearFilter.value = hashTarget.dataset.year;
    queryFilter.value = "";
    hashTarget.open = true;
  }
  updateCatalog();
};

gradeFilters.forEach((button) => {
  button.addEventListener("click", () => {
    activeGrade = button.dataset.gradeFilter;
    updateCatalog({ updateUrl: true, clearHash: true });
  });
});
yearFilter?.addEventListener("change", () => updateCatalog({ updateUrl: true, clearHash: true }));
queryFilter?.addEventListener("input", () => updateCatalog({ updateUrl: true, clearHash: true }));
filterReset?.addEventListener("click", () => {
  activeGrade = "all";
  yearFilter.value = "all";
  queryFilter.value = "";
  updateCatalog({ updateUrl: true, clearHash: true });
  gradeFilters[0]?.focus();
});
window.addEventListener("popstate", syncCatalogFromLocation);
window.addEventListener("hashchange", syncCatalogFromLocation);
syncCatalogFromLocation();

const sampleContent = {
  short: {
    number: "Q 01",
    kind: "短文・語彙",
    action: "正しい英文を見ながら1回写す",
    model: "Aya was glad because she found her lost notebook.",
    extraTitle: "不正解3語の意味を書く",
    extra: "empty＝＿＿　careful＝＿＿　famous＝＿＿",
    done: "4　英文を指で追って、声に出して1回読む",
  },
  dialogue: {
    number: "Q 16",
    kind: "会話文",
    action: "AとBの2文を見ながら写す",
    model: "A: Are you free after school?\nB: Yes. Let's study together.",
    extraTitle: "AとBを一人で2役読む",
    extra: "Aを読む → 少し間をあける → Bを読む",
    done: "3　最後まで2役読めたらチェックする",
  },
  reading: {
    number: "Q 21",
    kind: "長文読解",
    action: "答えの根拠になる英文を見ながら写す",
    model: "The students planted flowers because they wanted to make the school garden brighter.",
    extraTitle: "英文の下に、直訳風と自然な訳を写す",
    extra:
      "直訳風：生徒たちは、学校の庭をより明るくしたかったので、花を植えました。\n自然な訳：学校の庭を明るくするために、生徒たちは花を植えました。",
    done: "5　答えになる語句に線を引き、英文を1回読む",
  },
};

const samplePanel = document.querySelector("#sample-panel");
const sampleTabs = [...document.querySelectorAll("[data-sample]")];

const updateSample = (key) => {
  const content = sampleContent[key];
  if (!content || !samplePanel) return;

  samplePanel.querySelector("[data-sample-number]").textContent = content.number;
  samplePanel.querySelector("[data-sample-kind]").textContent = content.kind;
  samplePanel.querySelector("[data-sample-action]").textContent = content.action;
  samplePanel.querySelector("[data-sample-model]").textContent = content.model;
  samplePanel.querySelector("[data-sample-extra-title]").textContent = content.extraTitle;
  samplePanel.querySelector("[data-sample-extra]").textContent = content.extra;
  samplePanel.querySelector(".sample-done span").textContent = content.done;

  sampleTabs.forEach((tab) => tab.setAttribute("aria-selected", String(tab.dataset.sample === key)));
  samplePanel.animate?.(
    [
      { opacity: 0.55, transform: "translateY(5px)" },
      { opacity: 1, transform: "translateY(0)" },
    ],
    { duration: 220, easing: "ease-out" },
  );
};

sampleTabs.forEach((tab, index) => {
  tab.addEventListener("click", () => updateSample(tab.dataset.sample));
  tab.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const nextIndex = (index + direction + sampleTabs.length) % sampleTabs.length;
    sampleTabs[nextIndex].focus();
    updateSample(sampleTabs[nextIndex].dataset.sample);
  });
});

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const revealItems = document.querySelectorAll(".reveal");

if (prefersReducedMotion || !("IntersectionObserver" in window)) {
  revealItems.forEach((item) => item.classList.add("is-visible"));
} else {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -30px" },
  );
  revealItems.forEach((item) => observer.observe(item));
}
