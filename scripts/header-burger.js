#!/usr/bin/env node
// Единая шапка сайта с бургер-меню: заменяет блок шапки на всех страницах одинаково.
//
//   node scripts/header-burger.js            — применить ко всем .html
//   node scripts/header-burger.js --dry-run  — только показать, что изменится
//
// Что делает на каждой странице со стандартной шапкой (есть <header class="site-header"> с id="burgerBtn"
// или уже вставленный блок <!--pb:header-->):
//   • заменяет шапку (и старое мобильное меню #mobileNav внутри неё) блоком между маркерами
//     <!--pb:header--> … <!--/pb:header--> — шапка + панель меню (панель стоит после </header>, иначе
//     sticky/backdrop-filter шапки ограничивают её позиционирование и z-index);
//   • удаляет встроенный скрипт toggleMobileNav() (прежний бургер);
//   • подключает /assets/modern.css и /assets/modern.js, если их нет (стили и логика меню — там).
// Идемпотентно: повторный запуск заменяет содержимое между маркерами тем же шаблоном.
// Страницы со своей шапкой (другая разметка) и без шапки пропускаются и перечисляются в конце.

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const DRY = process.argv.includes('--dry-run');
const SKIP_DIRS = new Set(['.git', 'dist', 'node_modules', 'scripts', 'seo-audit', '.claude']);

const PHONE_TEXT = '+7 985 316-91-04';
const PHONE_HREF = 'tel:+79853169104';
const MAIL = 'info@probarium.ru';

const ICON_PHONE = '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z"/></svg>';
const ICON_MAIL = '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zm0 2v.4l8 5 8-5V7H4zm16 2.75-7.47 4.67a1 1 0 0 1-1.06 0L4 9.75V17h16z"/></svg>';
const ICON_CHEVRON = '<svg width="14" height="14" viewBox="0 0 10 10" aria-hidden="true" focusable="false"><path d="M1 3l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
const ICON_TG = '<svg width="24" height="24" viewBox="0 0 240 240" aria-hidden="true"><circle cx="120" cy="120" r="120" fill="#29A9EB"/><path fill="#fff" d="M177 66l-23 118c-2 8-6 10-13 6l-38-28-18 17c-2 2-4 4-8 4l3-38 68-62c3-3-1-4-4-2l-84 53-37-11c-8-3-8-8 2-12l144-56c7-2 13 2 8 12z"/></svg>';
const MAX_HREF = 'https://max.ru/u/f9LHodD0cOLDvyS7TfGCuqMQTcuMpF-2LxGuF5nNyXHgZFoFnYUC0KjLnaQ';

const LOGO = `<a href="/" class="logo" aria-label="Probarium, на главную">
      <svg width="44" height="44" viewBox="0 0 60 60" role="img" aria-hidden="true">
        <path d="M15,18 C15,26 27,26 27,34 C27,42 15,42 15,50" fill="none" stroke="#0F2A4D" stroke-width="4.5" stroke-linecap="round"/>
        <path d="M27,18 C27,26 15,26 15,34 C15,42 27,42 27,50" fill="none" stroke="#0F2A4D" stroke-width="4.5" stroke-linecap="round" opacity="0.5"/>
        <circle cx="21" cy="26" r="3.4" fill="#B3701A"/><circle cx="21" cy="34" r="3.4" fill="#B3701A"/><circle cx="21" cy="42" r="3.4" fill="#B3701A"/>
      </svg>
      Probarium
    </a>`;

// Разделы меню — в прежнем порядке и с прежними подписями
const MENU = [
  {group: 'Услуги', id: 'pbAccServices', items: [
    ['/klinicheskie-ispytaniya-medizdeliy/', 'Клинические испытания МИ', 'Анализ данных, с участием человека, ИВД'],
    ['/doklinicheskie-issledovaniya/', 'Доклиника и токсикология', 'Биосовместимость, GLP'],
    ['/tehnicheskie-ispytaniya-medizdeliy/', 'Технические испытания', 'Включая электробезопасность, ЭМС, ПО'],
    ['/registraciya-medizdeliy/', 'Регистрация МИ', 'РФ и ЕАЭС'],
    ['/razrabotka-dokumentatsii/', 'Разработка документации', 'Протоколы, отчёты, досье'],
    ['/uslugi/', 'Все услуги'],
  ]},
  ['/dorozhnaya-karta/', 'Как мы работаем'],
  ['/kejsy/', 'Кейсы'],
  {group: 'База знаний', id: 'pbAccKnowledge', items: [
    ['/npa/', 'НПА и стандарты'],
    ['/biblioteka/', 'Библиотека'],
    ['/blog/', 'Блог'],
    ['/glossariy/', 'Глоссарий'],
    ['/faq/', 'Вопросы и ответы'],
  ]},
  ['/o-kompanii/', 'О компании'],
  ['/kontakty/', 'Контакты'],
];

function menuHtml() {
  const out = [];
  for (const m of MENU) {
    if (Array.isArray(m)) { out.push(`        <li><a class="pb-menu-link" href="${m[0]}">${m[1]}</a></li>`); continue; }
    out.push(`        <li class="pb-acc">`);
    out.push(`          <button type="button" class="pb-menu-link pb-acc-btn" aria-expanded="false" aria-controls="${m.id}">${m.group} ${ICON_CHEVRON}</button>`);
    out.push(`          <ul class="pb-acc-list" id="${m.id}" hidden>`);
    for (const [href, title, note] of m.items)
      out.push(`            <li><a class="pb-sub-link" href="${href}">${title}${note ? `<small>${note}</small>` : ''}</a></li>`);
    out.push(`          </ul>`);
    out.push(`        </li>`);
  }
  return out.join('\n');
}

const BLOCK = `<!--pb:header-->
<header class="site-header">
  <div class="container header-row pb-hdr">
    ${LOGO}
    <div class="pb-hdr-contacts">
      <a class="pb-hdr-tel" href="${PHONE_HREF}" aria-label="Позвонить: ${PHONE_TEXT}">${ICON_PHONE}<span class="pb-hdr-text">${PHONE_TEXT}</span></a>
      <a class="pb-hdr-mail" href="mailto:${MAIL}">${ICON_MAIL}<span class="pb-hdr-text">${MAIL}</span></a>
    </div>
    <a href="/kontakty/" class="btn btn-primary header-cta">Оставить заявку</a>
    <button type="button" class="pb-burger" aria-label="Открыть меню" aria-expanded="false" aria-controls="pbMenu"><span></span><span></span><span></span></button>
  </div>
</header>
<div class="pb-menu-backdrop" hidden></div>
<div class="pb-menu" id="pbMenu" role="dialog" aria-modal="true" aria-label="Меню сайта" hidden>
  <div class="pb-menu-top">
    <button type="button" class="pb-menu-close" aria-label="Закрыть меню"><svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></button>
  </div>
  <div class="pb-menu-body">
    <nav class="pb-menu-nav" aria-label="Основная навигация">
      <ul>
${menuHtml()}
      </ul>
    </nav>
    <div class="pb-menu-foot">
      <div class="pb-menu-contacts">
        <a class="pb-menu-tel" href="${PHONE_HREF}">${ICON_PHONE}<span>${PHONE_TEXT}</span></a>
        <a class="pb-menu-mail" href="mailto:${MAIL}">${ICON_MAIL}<span>${MAIL}</span></a>
      </div>
      <div class="pb-menu-msg">
        <a href="https://t.me/tandelovtat" target="_blank" rel="noopener" aria-label="Написать в Telegram" class="pb-msg">${ICON_TG}</a>
        <a href="${MAX_HREF}" target="_blank" rel="noopener" aria-label="Написать в MAX" class="pb-msg"><img src="/assets/img/max-icon.png" width="24" height="24" alt="MAX" loading="lazy"></a>
      </div>
      <a href="/kontakty/" class="btn btn-primary pb-menu-cta">Оставить заявку</a>
    </div>
  </div>
</div>
<!--/pb:header-->`;

const MARKED_RE = /<!--pb:header-->[\s\S]*?<!--\/pb:header-->/;
const HEADER_RE = /<header class="site-header">[\s\S]*?<\/header>/;
const TOGGLE_RE = /\n?<script>\s*function toggleMobileNav\(\)\{[\s\S]*?\}\s*<\/script>/g;

function walk(dir, acc) {
  for (const e of fs.readdirSync(dir, {withFileTypes: true})) {
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name) && !e.name.startsWith('.')) walk(path.join(dir, e.name), acc); }
    else if (e.name.endsWith('.html')) acc.push(path.join(dir, e.name));
  }
  return acc;
}

const changed = [], unchanged = [], skipped = [];
for (const file of walk(ROOT, []).sort()) {
  const rel = path.relative(ROOT, file);
  const raw = fs.readFileSync(file, 'utf8');
  const crlf = raw.includes('\r\n');
  let h = raw.replace(/\r\n/g, '\n');
  if (MARKED_RE.test(h)) {
    h = h.replace(MARKED_RE, () => BLOCK);
  } else {
    const m = h.match(HEADER_RE);
    if (!m) { skipped.push([rel, 'нет <header class="site-header">']); continue; }
    if (!m[0].includes('id="burgerBtn"')) { skipped.push([rel, 'своя шапка (другая разметка, без стандартного меню)']); continue; }
    h = h.replace(HEADER_RE, () => BLOCK);
  }
  h = h.replace(TOGGLE_RE, '');
  if (!h.includes('/assets/modern.css')) h = h.replace('</head>', '<link rel="stylesheet" href="/assets/modern.css">\n<script defer src="/assets/modern.js"></script>\n</head>');
  else if (!h.includes('/assets/modern.js')) h = h.replace('</head>', '<script defer src="/assets/modern.js"></script>\n</head>');
  const out = crlf ? h.replace(/\n/g, '\r\n') : h;
  if (out !== raw) { changed.push(rel); if (!DRY) fs.writeFileSync(file, out); } else unchanged.push(rel);
}

console.log(`header-burger: ${DRY ? '[dry-run] ' : ''}изменено ${changed.length}, без изменений ${unchanged.length}, пропущено ${skipped.length}`);
for (const [f, why] of skipped) console.log('  пропущено: ' + f + ' — ' + why);
