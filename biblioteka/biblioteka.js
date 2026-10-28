/*
  Раздел "Библиотека" — med-local.ru
  Логика: загрузка данных, фильтр по категориям, поиск, модальное окно документа.

  ВАЖНО ДЛЯ РАЗРАБОТЧИКА:
  - DATA_URL ниже указывает на статический JSON. На проде замените на реальный
    эндпоинт вашей CMS/API, который отдаёт тот же формат (categories + documents).
  - При открытии документа мы дополнительно меняем URL через history.pushState —
    это даёт каждому документу свой адрес (для SEO и возможности поделиться ссылкой),
    даже когда открывается модалка, а не отдельная страница.
  - Если пользователь заходит сразу по прямой ссылке /biblioteka/{cat}/{doc}/ —
    рекомендуется на сервере отдавать полноценную статическую страницу документа
    (шаблон card-template-example.html), а не только эту SPA-версию — так поисковики
    надёжно проиндексируют контент без выполнения JS.
*/

const DATA_URL = "biblioteka-data.json?v=1";

let state = {
  documents: [],
  categories: [],
  activeCategory: "all",
  query: ""
};

async function init() {
  const res = await fetch(DATA_URL);
  const data = await res.json();
  state.documents = data.documents;
  state.categories = data.categories;
  renderChips();
  renderList();
  bindGlobalEvents();
  handleDeepLink();
}

function renderChips() {
  const chips = document.getElementById("libChips");
  const all = { name: "Все документы", slug: "all", count: state.documents.length };
  const items = [all, ...state.categories];
  chips.innerHTML = items.map(c => `
    <button class="lib-chip${state.activeCategory === c.slug ? " active" : ""}"
            data-slug="${c.slug}" role="tab" aria-selected="${state.activeCategory === c.slug}">
      ${escapeHtml(c.name)} (${c.count})
    </button>
  `).join("");
  chips.querySelectorAll(".lib-chip").forEach(btn => {
    btn.addEventListener("click", () => {
      state.activeCategory = btn.dataset.slug;
      renderChips();
      renderList();
    });
  });
}

function renderList() {
  const list = document.getElementById("libList");
  const empty = document.getElementById("libEmpty");
  const countEl = document.getElementById("libCount");

  const q = state.query.trim().toLowerCase();
  const filtered = state.documents.filter(d => {
    const matchesCategory = state.activeCategory === "all" || d.categorySlug === state.activeCategory;
    const matchesQuery = !q || d.title.toLowerCase().includes(q);
    return matchesCategory && matchesQuery;
  });

  countEl.textContent = `Найдено документов: ${filtered.length}`;

  if (filtered.length === 0) {
    list.innerHTML = "";
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  list.innerHTML = filtered.map((d, i) => `
    <div class="lib-item">
      <span class="lib-item-icon" aria-hidden="true">&#128196;</span>
      <div class="lib-item-body">
        <p class="lib-item-title">${escapeHtml(d.title)}</p>
        <p class="lib-item-meta">${escapeHtml(d.category)}${d.year ? " · " + d.year : ""}</p>
        ${d.note ? `<p class="lib-item-note">${escapeHtml(d.note)}${d.noteLink ? ` <a href="${d.noteLink}">Открыть Решение № 7</a>` : ""}</p>` : ""}
      </div>
      <button class="lib-item-btn" data-index="${state.documents.indexOf(d)}">
        &#8595; Скачать
      </button>
    </div>
  `).join("");

  list.querySelectorAll(".lib-item-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const doc = state.documents[parseInt(btn.dataset.index, 10)];
      openModal(doc, true);
    });
  });
}

function openModal(doc, updateUrl) {
  document.getElementById("libModalBadge").textContent = `${doc.docType} · ${doc.year || ""}`;
  document.getElementById("libModalTitle").textContent = doc.title;
  document.getElementById("libModalMeta").textContent = doc.category;
  const noteEl = document.getElementById("libModalNote");
  noteEl.textContent = doc.note || "";
  if (doc.noteLink) { const a = document.createElement("a"); a.href = doc.noteLink; a.textContent = " Открыть Решение № 7"; noteEl.appendChild(a); }
  noteEl.hidden = !doc.note;
  document.getElementById("libModalDownload").href = doc.fileUrl;
  document.getElementById("libModalFullpage").href = doc.pageUrl;
  document.getElementById("libModalOverlay").hidden = false;
  document.body.style.overflow = "hidden";

  if (updateUrl) {
    history.pushState({ docPage: doc.pageUrl }, "", doc.pageUrl);
  }
}

function closeModal(updateUrl) {
  document.getElementById("libModalOverlay").hidden = true;
  document.body.style.overflow = "";
  if (updateUrl) {
    history.pushState({}, "", "/biblioteka/");
  }
}

function handleDeepLink() {
  // Если пользователь открыл /biblioteka/{cat}/{doc}/ напрямую —
  // сразу показываем модалку с этим документом поверх списка.
  const path = window.location.pathname;
  const doc = state.documents.find(d => d.pageUrl === path);
  if (doc) {
    openModal(doc, false);
  }
}

function bindGlobalEvents() {
  document.getElementById("libSearch").addEventListener("input", (e) => {
    state.query = e.target.value;
    renderList();
  });

  document.getElementById("libModalClose").addEventListener("click", () => closeModal(true));
  document.getElementById("libModalOverlay").addEventListener("click", (e) => {
    if (e.target.id === "libModalOverlay") closeModal(true);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !document.getElementById("libModalOverlay").hidden) closeModal(true);
  });
  window.addEventListener("popstate", () => {
    if (window.location.pathname === "/biblioteka/") {
      closeModal(false);
    } else {
      handleDeepLink();
    }
  });

  const askLink = document.getElementById("libModalAsk");
  if (askLink) {
    askLink.addEventListener("click", (e) => {
      e.preventDefault();
      closeModal(true);
      setTimeout(() => {
        const target = document.getElementById("libAsk");
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
    });
  }

  const LIB_ERRORS = {
    no_consent_pd: "Нужно согласие на обработку персональных данных",
    no_consent_offer: "Нужно принять условия оферты",
    no_contact: "Укажите email или телефон",
    bad_email: "Проверьте адрес email",
    bad_phone: "Проверьте номер телефона",
    rate_limited: "Слишком много попыток, попробуйте позже или напишите на info@probarium.ru",
    default: "Не удалось отправить заявку. Напишите нам на info@probarium.ru"
  };
  const askForm = document.getElementById("libAskForm");
  if (askForm) {
    askForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const submitBtn = askForm.querySelector(".lib-ask-submit");
      const successEl = document.getElementById("libAskSuccess");
      const errorEl = document.getElementById("libAskError");
      successEl.hidden = true;
      errorEl.hidden = true;
      submitBtn.disabled = true;
      submitBtn.textContent = "Отправляем...";

      try {
        const data = new FormData(askForm);
        const contact = String(data.get("contact") || "").trim();
        const payload = {
          _subject: "Вопрос из Библиотеки НПА и ГОСТов",
          name: String(data.get("name") || "").trim(),
          message: String(data.get("question") || "").trim(),
          page: location.href.split("#")[0],
          source: String(data.get("source") || ""),
          _gotcha: String(data.get("_gotcha") || "")
        };
        if (contact.indexOf("@") !== -1) payload.email = contact; else payload.phone = contact;
        if (data.get("consent_pd")) payload.consent_pd = "on";
        if (data.get("consent_offer")) payload.consent_offer = "on";
        const res = await fetch("https://functions.yandexcloud.net/d4e389n57q1ils09t0f3", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify(payload)
        });
        let body = {};
        try { body = await res.json(); } catch (e) {}
        if (res.ok && body.ok === true) {
          successEl.hidden = false;
          askForm.reset();
        } else {
          errorEl.textContent = LIB_ERRORS[body.error] || LIB_ERRORS.default;
          errorEl.hidden = false;
        }
      } catch (err) {
        errorEl.textContent = LIB_ERRORS.default;
        errorEl.hidden = false;
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Задать вопрос";
      }
    });
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

document.addEventListener("DOMContentLoaded", init);
