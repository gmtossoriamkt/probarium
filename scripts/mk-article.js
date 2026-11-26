#!/usr/bin/env node
// Собирает страницу статьи блога blog/<slug>/index.html из JSON-описания по образцу уже опубликованной статьи
// (по умолчанию — первой карточки в blog/index.html, т. е. самой свежей). Шапка, подвал, форма, cookie-баннер,
// стили и счётчики берутся из образца как есть; заменяется только то, что относится к статье.
//
//   node scripts/mk-article.js статья.json [--template <slug-образца>] [--force] [--dry-run]
//
// Формат JSON (все строки — HTML-фрагменты, типографика « » и — ставится в тексте):
// {
//   "slug": "gap-analiz-klinicheskoj-chasti-dosye-eaes",     латиница, цифры, дефисы
//   "title": "Гэп-анализ клинической части досье под ЕАЭС",  без суффикса; итоговый <title> выставит blog-seo.js
//   "h1": "…", "description": "…",                           description 120–160 символов
//   "crumb": "Гэп-анализ клинической части досье",           последний пункт хлебных крошек
//   "date": "2026-11-26",                                     дата публикации (= сегодня)
//   "category": "Клинические испытания медизделий",           необязательно (это значение по умолчанию)
//   "type": "BlogPosting",                                    BlogPosting (по умолчанию) или TechArticle
//   "lead": "…",                                              вводный абзац под H1
//   "body": [                                                 блоки статьи по порядку
//     {"h2": "Заголовок раздела"}, {"h3": "…"}, {"p": "Абзац"},
//     {"ul": ["пункт", "…"]}, {"ol": ["…"]},
//     {"table": {"head": ["…", "…"], "rows": [["…", "…"]]}},  всегда в обёртке .table-wrap
//     {"faq": true},                                          сюда выводятся вопросы из "faq" (<details>)
//     {"html": "<p>произвольная разметка</p>"}
//   ],
//   "faq": [["Вопрос?", "Ответ (можно со ссылками)"]],        FAQPage JSON-LD строится из этого же списка
//   "related": [["/blog/…/", "Название"]],                   блок «Смежные разделы», адреса со слэшем
//   "cta": {"h2": "…", "p": "…", "btn": ["/kontakty/", "Обсудить проект →"]}
// }
//
// После сборки: add-blog-card.js → blog-enhance.js → blog-seo.js → check-site.js (см. CLAUDE.md).
// Блоки <!--enh:*--> образца удаляются — их заново вставит blog-enhance.js.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ORIGIN = 'https://probarium.ru';
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

const fail = msg => { console.error('mk-article: ' + msg); process.exit(1); };

const argv = process.argv.slice(2);
let specPath = null, tplSlug = null, force = false, dry = false;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--template') tplSlug = argv[++i];
  else if (a === '--force') force = true;
  else if (a === '--dry-run') dry = true;
  else if (a.startsWith('--')) fail('неизвестный параметр ' + a);
  else specPath = a;
}
if (!specPath) fail('укажите JSON-файл статьи: node scripts/mk-article.js статья.json');
let S;
try { S = JSON.parse(fs.readFileSync(specPath, 'utf8')); } catch (e) { fail('не удалось прочитать JSON: ' + e.message); }

for (const k of ['slug', 'title', 'h1', 'description', 'crumb', 'date', 'lead', 'body', 'faq', 'related', 'cta']) {
  if (S[k] === undefined || S[k] === '' || (Array.isArray(S[k]) && !S[k].length)) fail('в JSON нет поля ' + k);
}
if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(S.slug)) fail('slug: только латиница, цифры и дефисы');
if (!/^\d{4}-\d{2}-\d{2}$/.test(S.date) || isNaN(new Date(S.date + 'T00:00:00Z'))) fail('date: ГГГГ-ММ-ДД');
const TYPE = S.type || 'BlogPosting';
if (!['BlogPosting', 'TechArticle'].includes(TYPE)) fail('type: BlogPosting или TechArticle');
const CATEGORY = S.category || 'Клинические испытания медизделий';
if (!S.cta.h2 || !S.cta.p || !Array.isArray(S.cta.btn) || S.cta.btn.length !== 2) fail('cta: нужны h2, p и btn [адрес, текст]');
for (const [u] of S.related) if (u.startsWith('/') && !/\/$|\.[a-z0-9]+$/i.test(u.split('#')[0])) fail('адрес без слэша в related: ' + u);
if (!S.body.some(b => b.faq)) fail('в body нет блока {"faq": true}');
const attr = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const strip = s => String(s).replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&laquo;/g, '«').replace(/&raquo;/g, '»')
  .replace(/&mdash;/g, '—').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

const outDir = path.join(ROOT, 'blog', S.slug);
const outFile = path.join(outDir, 'index.html');
if (fs.existsSync(outFile) && !force) fail(`blog/${S.slug}/index.html уже есть (--force — перезаписать)`);

if (!tplSlug) {
  const idx = fs.readFileSync(path.join(ROOT, 'blog/index.html'), 'utf8');
  const m = idx.match(/<a[^>]+href="\/blog\/([a-z0-9-]+)\/"/);
  if (!m) fail('не нашёл первую карточку в blog/index.html');
  tplSlug = m[1];
  if (tplSlug === S.slug) { const all = [...idx.matchAll(/<a[^>]+href="\/blog\/([a-z0-9-]+)\/"/g)].map(x => x[1]); tplSlug = all.find(s => s !== S.slug); }
}
const tplFile = path.join(ROOT, 'blog', tplSlug, 'index.html');
if (!fs.existsSync(tplFile)) fail('нет образца blog/' + tplSlug + '/index.html');
const tpl = fs.readFileSync(tplFile, 'utf8');
let h = tpl;

const URL = `${ORIGIN}/blog/${S.slug}/`;
const [y, mo, d] = S.date.split('-').map(Number);
const DATE_RU = `${d} ${MONTHS[mo - 1]} ${y}`;
const TIME = `${S.date}T10:00:00+03:00`;

function sub(re, rep, what) {
  const before = h;
  h = h.replace(re, () => rep);
  if (h === before && !before.match(re)) fail('в образце не найдено: ' + what);
}
sub(/<title>[^<]*<\/title>/, `<title>${S.title}</title>`, 'title');
sub(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${attr(S.description)}">`, 'description');
sub(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${URL}">`, 'canonical');
sub(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${attr(S.title)}">`, 'og:title');
sub(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${attr(S.description)}">`, 'og:description');
sub(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${URL}">`, 'og:url');
sub(/<meta property="article:published_time" content="[^"]*">/, `<meta property="article:published_time" content="${TIME}">`, 'article:published_time');
sub(/<meta property="article:modified_time" content="[^"]*">/, `<meta property="article:modified_time" content="${TIME}">`, 'article:modified_time');
sub(/<span aria-current="page">[^<]*<\/span>/, `<span aria-current="page">${S.crumb}</span>`, 'хлебные крошки');
sub(/<div class="article-meta">[\s\S]*?<\/div>/, `<div class="article-meta"><span>${CATEGORY}</span><span>READMIN мин чтения</span><span>${DATE_RU}</span></div>`, 'article-meta');
sub(/<h1>[\s\S]*?<\/h1>/, `<h1>${S.h1}</h1>`, 'h1');
sub(/<p class="lead">[\s\S]*?<\/p>/, `<p class="lead">${S.lead}</p>`, 'lead');

// тело статьи
const I = '      ';
const blocks = S.body.map((b, i) => {
  if (b.h2) return `${I}<h2>${b.h2}</h2>`;
  if (b.h3) return `${I}<h3>${b.h3}</h3>`;
  if (b.p) return `${I}<p>${b.p}</p>`;
  if (b.ul || b.ol) { const tag = b.ul ? 'ul' : 'ol'; return `${I}<${tag}>\n` + b[tag].map(x => `${I}  <li>${x}</li>`).join('\n') + `\n${I}</${tag}>`; }
  if (b.table) {
    const t = b.table;
    if (!Array.isArray(t.head) || !Array.isArray(t.rows)) fail(`body[${i}]: у таблицы нужны head и rows`);
    return [`${I}<div class="table-wrap">`, `${I}<table>`, `${I}  <tr>` + t.head.map(c => `<th>${c}</th>`).join('') + '</tr>',
      ...t.rows.map(r => `${I}  <tr>` + r.map(c => `<td>${c}</td>`).join('') + '</tr>'), `${I}</table>`, `${I}</div>`].join('\n');
  }
  if (b.faq) return S.faq.map(([q, a]) => `${I}<details class="faq-item"><summary>${q}</summary><p>${a}</p></details>`).join('\n');
  if (b.html) return b.html.split('\n').map(l => /^\s/.test(l) ? l : I + l).join('\n');
  fail(`body[${i}]: неизвестный блок ${JSON.stringify(b).slice(0, 80)}`);
});
const BODY = blocks.join('\n\n');
const bodyRe = /(<div class="container article-body">\n)([\s\S]*?)(\n {4}<\/div>\n {2}<\/section>\n\n {2}<section aria-labelledby="related-h2")/;
if (!bodyRe.test(h)) fail('в образце не найден блок article-body');
h = h.replace(bodyRe, (m, a, b, c) => a + BODY + c);

const relRe = /<h2 id="related-h2">[^<]*<\/h2><\/div>\n {6}<div class="related-grid">\n[\s\S]*?\n {6}<\/div>/;
if (!relRe.test(h)) fail('в образце не найден блок related');
h = h.replace(relRe, () => '<h2 id="related-h2">Смежные разделы</h2></div>\n      <div class="related-grid">\n' +
  S.related.map(([u, t]) => `        <a class="related-card" href="${u}">${t}</a>`).join('\n') + '\n      </div>');

// блоки скриптов из образца — убрать, blog-enhance.js вставит свои
h = h.replace(/\n*[ \t]*<!--enh:([a-z-]+)-->[\s\S]*?<!--\/enh:\1-->\n*/g, '\n\n');

// финальный блок и скрытые поля формы
const ctaRe = /(<section id="final-cta">[\s\S]*?<div class="copy">)([\s\S]*?)(<\/div>\s*<form )/;
if (!ctaRe.test(h)) fail('в образце не найден final-cta');
h = h.replace(ctaRe, (m, a, b, c) => a + `\n          <h2>${S.cta.h2}</h2>\n          <p>${S.cta.p}</p>\n          <p style="margin-top:14px;"><a href="${S.cta.btn[0]}" class="btn btn-outline" data-goal="article_cta_click">${S.cta.btn[1]}</a></p>\n        ` + c);
h = h.split(`(blog/${tplSlug})`).join(`(blog/${S.slug})`).split(`value="${ORIGIN}/blog/${tplSlug}/"`).join(`value="${URL}"`);
h = h.replace(/(name="source_article" value=")[^"]*"/, (m, a) => a + attr(S.crumb) + '"');

// JSON-LD: статья + BreadcrumbList + FAQPage
const author = { '@type': 'Person', name: 'Артемий-Татуш Танделов', jobTitle: 'Генеральный директор Probarium' };
const art = { '@context': 'https://schema.org', '@type': TYPE, headline: strip(S.h1), description: strip(S.description),
  datePublished: S.date, dateModified: S.date, inLanguage: 'ru', mainEntityOfPage: URL, author,
  publisher: { '@type': 'Organization', name: 'Probarium', url: ORIGIN + '/' } };
const faq = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: S.faq.map(([q, a]) => ({
  '@type': 'Question', name: strip(q), acceptedAnswer: { '@type': 'Answer', text: strip(a) } })) };
const ldRe = /<script type="application\/ld\+json">\n?([\s\S]*?)\n?<\/script>/g;
let seenArt = 0, seenFaq = 0, seenBc = 0;
h = h.replace(ldRe, (m, json) => {
  let o; try { o = JSON.parse(json); } catch (e) { fail('в образце битый JSON-LD'); }
  const t = o['@type'];
  if (['BlogPosting', 'Article', 'TechArticle'].includes(t)) { seenArt++; o = art; }
  else if (t === 'FAQPage') { seenFaq++; o = faq; }
  else if (t === 'BreadcrumbList') {
    seenBc++;
    const last = o.itemListElement[o.itemListElement.length - 1];
    last.name = strip(S.crumb); last.item = URL;
  }
  return `<script type="application/ld+json">\n${JSON.stringify(o, null, 2)}\n</script>`;
});
if (seenArt !== 1 || seenBc !== 1) fail(`в образце ожидались по одному блоку статьи и BreadcrumbList (найдено ${seenArt}/${seenBc})`);
if (!seenFaq) h = h.replace('</head>', `<script type="application/ld+json">\n${JSON.stringify(faq, null, 2)}\n</script>\n</head>`);

// время чтения — пропорционально объёму образца
const words = s => s.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
const part = s => (s.match(/<div class="container article-body">([\s\S]*?)<section aria-labelledby="related-h2"/) || [, ''])[1];
const tmin = Number((tpl.match(/<span>(\d+) мин чтения/) || [, 10])[1]);
const mins = Math.max(1, Math.round(tmin * words(part(h)) / Math.max(1, words(part(tpl)))));
h = h.replace('READMIN мин чтения', `${mins} мин чтения`);

if (h.includes(`/blog/${tplSlug}/"`) && h.match(new RegExp(`value="${ORIGIN}/blog/${tplSlug}/"`))) fail('в форме остался адрес образца');
const leftovers = [...h.matchAll(new RegExp(`/blog/${tplSlug}/`, 'g'))].length;

const tables = (BODY.match(/<table>/g) || []).length;
console.log(`образец: blog/${tplSlug}/  →  blog/${S.slug}/`);
console.log(`тип ${TYPE}; H2: ${(BODY.match(/<h2>/g) || []).length}; таблиц: ${tables}; FAQ: ${S.faq.length}; мин чтения: ${mins}; description: ${strip(S.description).length} симв.`);
if (leftovers) console.log(`внимание: адрес образца /blog/${tplSlug}/ встречается ${leftovers} раз(а) — проверьте, что это ссылки из текста статьи`);
if (dry) { console.log('--dry-run: файл не записан'); process.exit(0); }
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, h);
console.log('записано: blog/' + S.slug + '/index.html');
