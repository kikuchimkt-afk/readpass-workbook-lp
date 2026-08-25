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
  () => header?.classList.toggle("is-scrolled", window.scrollY > 20),
  { passive: true },
);

const gradeFilter = document.querySelector("[data-grade-filter]");
const yearFilter = document.querySelector("[data-year-filter]");
const filterReset = document.querySelector("[data-filter-reset]");
const catalogCards = [...document.querySelectorAll("[data-catalog-card]")];
const resultCount = document.querySelector("[data-result-count]");
const catalogEmpty = document.querySelector("[data-catalog-empty]");

const optionExists = (select, value) =>
  [...(select?.options ?? [])].some((option) => option.value === value);

const updateCatalog = ({ updateUrl = false, clearHash = false } = {}) => {
  if (!gradeFilter || !yearFilter) return;
  const grade = optionExists(gradeFilter, gradeFilter.value) ? gradeFilter.value : "all";
  const year = optionExists(yearFilter, yearFilter.value) ? yearFilter.value : "all";
  let visibleSessions = 0;
  let visibleDocuments = 0;

  catalogCards.forEach((card) => {
    const matchesGrade = grade === "all" || card.dataset.grade === grade;
    const matchesYear = year === "all" || card.dataset.year === year;
    const visible = matchesGrade && matchesYear;
    card.hidden = !visible;
    if (visible) {
      visibleSessions += 1;
      visibleDocuments += card.querySelectorAll(".document-row").length;
    }
  });

  if (resultCount) {
    resultCount.textContent = `${visibleSessions}回分・PDF ${visibleDocuments}点を表示中`;
  }
  if (catalogEmpty) catalogEmpty.hidden = visibleSessions !== 0;

  if (updateUrl) {
    const url = new URL(window.location.href);
    grade === "all" ? url.searchParams.delete("grade") : url.searchParams.set("grade", grade);
    year === "all" ? url.searchParams.delete("year") : url.searchParams.set("year", year);
    if (clearHash) url.hash = "";
    history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }
};

const syncCatalogFromLocation = () => {
  if (!gradeFilter || !yearFilter) return;
  const url = new URL(window.location.href);
  const hashId = decodeURIComponent(url.hash.slice(1));
  const hashTarget = hashId ? document.getElementById(hashId) : null;

  let grade = optionExists(gradeFilter, url.searchParams.get("grade"))
    ? url.searchParams.get("grade")
    : "all";
  let year = optionExists(yearFilter, url.searchParams.get("year"))
    ? url.searchParams.get("year")
    : "all";

  if (hashTarget?.matches("[data-catalog-card]")) {
    grade = hashTarget.dataset.grade;
    year = hashTarget.dataset.year;
  }

  gradeFilter.value = grade;
  yearFilter.value = year;
  updateCatalog();
};

gradeFilter?.addEventListener("change", () => updateCatalog({ updateUrl: true, clearHash: true }));
yearFilter?.addEventListener("change", () => updateCatalog({ updateUrl: true, clearHash: true }));
filterReset?.addEventListener("click", () => {
  gradeFilter.value = "all";
  yearFilter.value = "all";
  updateCatalog({ updateUrl: true, clearHash: true });
  gradeFilter.focus();
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
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
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
