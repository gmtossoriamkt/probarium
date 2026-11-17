#!/usr/bin/env node
// Технический SEO-аудит: seo-audit/pages.csv + seo-audit/report.md (+ seo-audit/data.json для сравнения «было / стало»).
//   node scripts/seo-audit.js            — аудит текущего состояния
//   node scripts/seo-audit.js --out seo-audit/before   — сохранить в другую папку (имя без расширения)
// Только чтение репозитория; ничего, кроме папки seo-audit/, не пишет.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
process.chdir(ROOT);
const ORIGIN = 'https://probarium.ru';
const outIdx = process.argv.indexOf('--out');
const OUT = outIdx > 0 ? process.argv[outIdx + 1] : 'seo-audit';
const SKIP = new Set(['.git', 'node_modules', '.claude', 'dist', 'seo-audit']);
const NON_PAGES = new Set(['404.html', 'yandex_9c686e48342398e2.html']);
const GENERIC = /^(подробнее|читать далее|читать|узнать больше|узнать|смотреть|перейти|далее|открыть|больше|здесь|тут|ссылка)[\s→>»…\.]*$/i;
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

function listHtml(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP.has(e.name)) out.push(...listHtml(path.join(dir, e.name))); }
    else if (e.name.endsWith('.html')) out.push(path.join(dir, e.name).replace(/\\/g, '/').replace(/^\.\//, ''));
  }
  return out.sort();
}
const read = f => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const unent = s => s.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const text = s => unent(s.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<svg[\s\S]*?<\/svg>/g, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const urlOf = f => f === 'index.html' ? '/' : '/' + f.replace(/index\.html$/, '').replace(/\.html$/, '.html');
function attrs(s) {
  const o = {};
  for (const m of s.matchAll(/([a-zA-Z_:][\w:.-]*)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s>"']+)))?/g)) {
    o[m[1].toLowerCase()] = m[3] !== undefined ? m[3] : m[4] !== undefined ? m[4] : m[5] !== undefined ? m[5] : '';
  }
  return o;
}
const metaContent = (h, key, val) => {
  for (const m of h.matchAll(/<meta\b([^>]*)>/g)) { const a = attrs(m[1]); if ((a[key] || '') === val) return a.content !== undefined ? unent(a.content) : null; }
  return null;
};
const csv = v => { v = String(v === undefined || v === null ? '' : v); return /[",;\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };

const files = listHtml('.');
const sitemapRaw = fs.existsSync('sitemap.xml') ? fs.readFileSync('sitemap.xml', 'utf8') : '';
const sitemapLocs = new Set([...sitemapRaw.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].trim()));
const robots = fs.existsSync('robots.txt') ? fs.readFileSync('robots.txt', 'utf8') : '';
const disallow = [...robots.matchAll(/^Disallow:\s*(\S+)/gim)].map(m => m[1]);

const pages = {};
const idsOf = {};
for (const f of files) {
  const h = read(f);
  const url = urlOf(f);
  const P = { file: f, url, nonPage: NON_PAGES.has(f) };
  const t = h.match(/<title>([\s\S]*?)<\/title>/);
  P.title = t ? unent(t[1]).trim() : '';
  P.desc = (metaContent(h, 'name', 'description') || '').trim();
  const can = h.match(/<link\b([^>]*rel=["']?canonical["']?[^>]*)>/i);
  P.canonical = can ? (attrs(can[1]).href || '') : '';
  P.robotsMeta = metaContent(h, 'name', 'robots') || '';
  const noScript = h.replace(/<script[\s\S]*?<\/script>/g, ' ');
  const mainM = noScript.match(/<main\b[^>]*>([\s\S]*?)<\/main>/);
  const main = mainM ? mainM[1] : noScript.replace(/<head>[\s\S]*?<\/head>/, '');
  P.h1 = [...main.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)].map(m => text(m[1]));
  const levels = [...main.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/g)].map(m => ({ l: +m[1], t: text(m[2]) }));
  P.headings = levels;
  P.h2 = levels.filter(x => x.l === 2).length; P.h3 = levels.filter(x => x.l === 3).length;
  P.skips = [];
  let prev = 0;
  for (const x of levels) { if (prev && x.l > prev + 1) P.skips.push('h' + prev + '→h' + x.l + ' «' + x.t.slice(0, 40) + '»'); prev = x.l; }
  // ids для проверки якорей
  idsOf[url] = new Set([...h.matchAll(/\b(?:id|name)=("([^"]*)"|'([^']*)'|([^\s>"']+))/g)].map(m => m[2] || m[3] || m[4]));
  // картинки
  P.imgs = [...noScript.replace(/<head>[\s\S]*?<\/head>/, '').matchAll(/<img\b([^>]*)>/g)].map((m, i) => ({ ...attrs(m[1]), idx: i }));
  P.imgNoAlt = P.imgs.filter(i => i.alt === undefined);
  P.imgEmptyAlt = P.imgs.filter(i => i.alt !== undefined && i.alt.trim() === '');
  P.imgNoDims = P.imgs.filter(i => !i.width || !i.height);
  P.imgNoLazy = P.imgs.filter(i => i.idx > 0 && (i.loading || '').toLowerCase() !== 'lazy' && !/fetchpriority/i.test(JSON.stringify(i)));
  // ссылки
  const body = noScript.replace(/<head>[\s\S]*?<\/head>/, '');
  const chromeStripped = body.replace(/<header\b[\s\S]*?<\/header>/g, ' ').replace(/<footer\b[\s\S]*?<\/footer>/g, ' ').replace(/<nav\b[\s\S]*?<\/nav>/g, ' ');
  const grab = src => [...src.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map(m => ({ a: attrs(m[1]), text: text(m[2]) })).filter(x => x.a.href !== undefined);
  P.links = grab(body);
  P.contentLinks = grab(chromeStripped);
  P.jsonld = [];
  for (const m of h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { const j = JSON.parse(m[1]); const arr = Array.isArray(j) ? j : j['@graph'] ? j['@graph'] : [j]; for (const o of arr) P.jsonld.push(o); } catch (e) { P.jsonldErr = (P.jsonldErr || 0) + 1; }
  }
  P.og = { title: metaContent(h, 'property', 'og:title'), description: metaContent(h, 'property', 'og:description'), image: metaContent(h, 'property', 'og:image') };
  P.visibleDate = (text(main).match(/(\d{1,2}) (января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря) (\d{4})/) || [])[0] || '';
  P.visibleAuthor = (text(main).match(/Автор:\s*([^,.]+)/) || [])[1] || '';
  P.rawHasWww = /https?:\/\/(www\.probarium\.ru|probarium\.ru)(?![\w.-])/.test(h) ? [...h.matchAll(/(http:\/\/probarium\.ru[^\s"'<>]*|https?:\/\/www\.probarium\.ru[^\s"'<>]*)/g)].map(m => m[1]) : [];
  P.rawHasWww = [...h.matchAll(/(http:\/\/(?:www\.)?probarium\.ru[^\s"'<>]*|https?:\/\/www\.probarium\.ru[^\s"'<>]*)/g)].map(m => m[1]);
  pages[url] = P;
}

// ---------- разрешение ссылок ----------
function resolve(href, fromUrl) {
  if (/^(mailto:|tel:|javascript:|data:|#$)/i.test(href)) return null;
  let u = href.trim();
  if (/^https?:\/\//i.test(u)) { const m = u.match(/^https?:\/\/(www\.)?probarium\.ru(\/[^#?]*)?(#.*)?/i); if (!m) return null; u = (m[2] || '/') + (m[3] || ''); }
  if (u.startsWith('//')) return null;
  if (u.startsWith('#')) return { path: fromUrl, hash: u.slice(1), raw: href };
  if (!u.startsWith('/')) { const base = fromUrl.replace(/[^/]*$/, ''); u = path.posix.normalize(base + u); }
  const m = u.match(/^([^#?]*)(?:\?[^#]*)?(?:#(.*))?$/);
  return { path: m[1], hash: m[2] || '', raw: href };
}
const pageExists = p => pages[p] || fs.existsSync(path.join(ROOT, p.replace(/^\//, ''))) && fs.statSync(path.join(ROOT, p.replace(/^\//, ''))).isFile() || pages[p.endsWith('/') ? p : p + '/'];

const inAll = {}, inContent = {};
const broken = [], brokenAnchors = [], noSlash = [], wwwHttp = [];
for (const url in pages) { inAll[url] = new Set(); inContent[url] = new Set(); }
for (const url in pages) {
  const P = pages[url];
  P.outInternal = new Set();
  for (const l of P.links) {
    const href = l.a.href;
    const r = resolve(href, url);
    if (!r) continue;
    const target = r.path;
    if (/^\/(biblioteka\/files|assets)\//.test(target) || /\.(pdf|png|jpg|jpeg|svg|ico|webmanifest|xml|txt|css|js|json|webp|docx?|xlsx?)$/i.test(target)) {
      if (!fs.existsSync(path.join(ROOT, target.replace(/^\//, '')))) broken.push(url + ' → ' + href);
      continue;
    }
    if (!/\/$/.test(target) && !/\.html$/.test(target)) noSlash.push(url + ' → ' + href);
    const key = target.endsWith('/') ? target : target + '/';
    const tp = pages[target] ? target : pages[key] ? key : null;
    if (!tp) {
      // страницы, которых нет в репозитории как html (например, /biblioteka/<категория>/…) — проверяем наличие файла/папки
      const rel = target.replace(/^\//, '');
      if (!(rel && fs.existsSync(path.join(ROOT, rel)))) broken.push(url + ' → ' + href);
      continue;
    }
    if (tp !== url) { inAll[tp].add(url); P.outInternal.add(tp); }
    if (r.hash && idsOf[tp] && !idsOf[tp].has(decodeURIComponent(r.hash))) brokenAnchors.push(url + ' → ' + href);
  }
  for (const l of P.contentLinks) {
    const r = resolve(l.a.href, url); if (!r) continue;
    const key = r.path.endsWith('/') ? r.path : r.path + '/';
    const tp = pages[r.path] ? r.path : pages[key] ? key : null;
    if (tp && tp !== url) inContent[tp].add(url);
  }
  for (const w of P.rawHasWww) wwwHttp.push(url + ' → ' + w);
}

// ---------- повторяющиеся анкоры ----------
const anchorSite = {};
for (const url in pages) {
  const P = pages[url];
  const cnt = {};
  for (const l of P.contentLinks) { if (GENERIC.test(l.text)) { const k = l.text; cnt[k] = (cnt[k] || 0) + 1; (anchorSite[k] = anchorSite[k] || []).push(url); } }
  P.genericAnchors = cnt;
}

// ---------- CSV ----------
const rows = [['url', 'title', 'title_len', 'description', 'desc_len', 'canonical', 'h1_count', 'h1_text', 'h2_count', 'h3_count', 'heading_skips', 'img_total', 'img_no_alt', 'img_empty_alt', 'img_no_dims', 'img_no_lazy', 'generic_anchors', 'inbound_all', 'inbound_content', 'outbound_internal', 'jsonld_types', 'og_title', 'og_description', 'og_image', 'robots_meta', 'in_sitemap'].join(',')];
for (const url in pages) {
  const P = pages[url];
  const types = P.jsonld.map(o => Array.isArray(o['@type']) ? o['@type'].join('+') : o['@type']).filter(Boolean);
  rows.push([url, P.title, P.title.length, P.desc, P.desc.length, P.canonical, P.h1.length, P.h1.join(' | '), P.h2, P.h3, P.skips.join('; '), P.imgs.length, P.imgNoAlt.length, P.imgEmptyAlt.length, P.imgNoDims.length, P.imgNoLazy.length,
    Object.entries(P.genericAnchors).map(([k, v]) => k + '×' + v).join('; '), inAll[url].size, inContent[url].size, P.outInternal.size, [...new Set(types)].join('+'), P.og.title ? 'да' : 'нет', P.og.description ? 'да' : 'нет', P.og.image ? 'да' : 'нет', P.robotsMeta, sitemapLocs.has(ORIGIN + url) ? 'да' : 'нет'].map(csv).join(','));
}
fs.mkdirSync(path.dirname(OUT === 'seo-audit' ? 'seo-audit/x' : OUT + '.x'), { recursive: true });
const csvPath = OUT === 'seo-audit' ? 'seo-audit/pages.csv' : OUT + '-pages.csv';
fs.writeFileSync(csvPath, '﻿' + rows.join('\n') + '\n');

// ---------- отчёт ----------
const real = Object.values(pages).filter(p => !p.nonPage);
const R = {};     // числа для «было / стало»
const sec = [];
const add = (key, title, items, note) => { R[key] = items.length; sec.push('## ' + title + ' — ' + items.length + (note ? '\n\n' + note : '') + '\n\n' + (items.length ? items.map(x => '- ' + x).join('\n') : '_нет_') + '\n'); };

const group = (arr, fn) => { const m = {}; for (const p of arr) { const k = fn(p); if (k) (m[k] = m[k] || []).push(p.url); } return Object.entries(m).filter(([, v]) => v.length > 1); };
add('dup_title', 'Дубли title', group(real, p => p.title).map(([k, v]) => '«' + k + '»: ' + v.join(', ')));
add('dup_desc', 'Дубли description', group(real, p => p.desc).map(([k, v]) => '«' + k.slice(0, 90) + '…»: ' + v.join(', ')));
add('title_long', 'Title длиннее 60 символов', real.filter(p => p.title.length > 60).map(p => p.url + ' (' + p.title.length + '): ' + p.title));
add('title_missing', 'Страницы без title', real.filter(p => !p.title).map(p => p.url));
add('desc_long', 'Description длиннее 160 символов', real.filter(p => p.desc.length > 160).map(p => p.url + ' (' + p.desc.length + ')'));
add('desc_short', 'Description короче 70 символов (включая отсутствующие)', real.filter(p => p.desc.length < 70).map(p => p.url + ' (' + p.desc.length + ')'));
add('h1_bad', 'Страницы без H1 или с несколькими H1', real.filter(p => p.h1.length !== 1).map(p => p.url + ': H1 = ' + p.h1.length));
add('heading_skips', 'Пропуски уровней заголовков', real.filter(p => p.skips.length).map(p => p.url + ': ' + p.skips.join('; ')));
const orphanStrict = real.filter(p => p.url !== '/' && inAll[p.url].size === 0 && !/\/(404|privacy|cookie|terms|disclaimer|lk|data-room)\//.test(p.url));
add('orphan_strict', 'Страницы-сироты (нет ни одной входящей ссылки)', orphanStrict.map(p => p.url));
const orphanContent = real.filter(p => p.url !== '/' && inContent[p.url].size === 0 && inAll[p.url].size > 0 && !/^\/(privacy|cookie|terms|disclaimer|lk|data-room|oferta)\//.test(p.url));
add('orphan_content', 'Страницы без входящих ссылок из контента (только меню/подвал)', orphanContent.map(p => p.url + ' — из меню/подвала: ' + inAll[p.url].size), 'Контентной считается ссылка вне `<header>`, `<footer>`, `<nav>`.');
add('not_in_sitemap', 'Страницы не в sitemap.xml', real.filter(p => !sitemapLocs.has(ORIGIN + p.url) && !(new RegExp('^\\/(' + disallow.map(d => d.replace(/^\//, '').replace(/\/$/, '')).join('|') + ')\\/')).test(p.url)).map(p => p.url), 'Исключены страницы, закрытые в robots.txt.');
add('sitemap_no_page', 'Адреса sitemap.xml без страницы', [...sitemapLocs].filter(l => !pages[l.replace(ORIGIN, '')]).map(l => l));
add('canon_mismatch', 'Расхождение canonical и адреса страницы / sitemap', real.filter(p => p.canonical !== ORIGIN + p.url).map(p => p.url + ': canonical «' + p.canonical + '»'));
add('broken_links', 'Битые внутренние ссылки', broken);
add('broken_anchors', 'Якоря, ведущие в пустоту', brokenAnchors);
add('no_slash', 'Внутренние ссылки без слэша на конце', noSlash);
add('www_http', 'Ссылки на www или http', wwwHttp);
add('og_missing', 'Нет og:title / og:description / og:image', real.filter(p => !p.og.title || !p.og.description || !p.og.image).map(p => p.url + ': ' + [!p.og.title && 'og:title', !p.og.description && 'og:description', !p.og.image && 'og:image'].filter(Boolean).join(', ')));
add('img_no_alt', 'Изображения без атрибута alt', real.flatMap(p => p.imgNoAlt.map(i => p.url + ': ' + (i.src || '').slice(0, 80))));
add('img_empty_alt', 'Изображения с пустым alt (допустимо только для декоративных)', real.flatMap(p => p.imgEmptyAlt.map(i => p.url + ': ' + (i.src || '').slice(0, 80))));
add('img_no_dims', 'Изображения без width/height', real.flatMap(p => p.imgNoDims.map(i => p.url + ': ' + (i.src || '').slice(0, 80))));
add('img_no_lazy', 'Изображения без loading="lazy" (кроме первого на странице)', real.flatMap(p => p.imgNoLazy.map(i => p.url + ': ' + (i.src || '').slice(0, 80))), 'Первое изображение страницы считается первым экраном и не включается.');
const ga = Object.entries(anchorSite).map(([k, v]) => '«' + k + '» — ' + v.length + ' раз; страницы: ' + [...new Set(v)].join(', '));
add('generic_anchors', 'Повторяющиеся неинформативные анкоры', ga);
// JSON-LD
const ld = [];
for (const p of real) {
  if (p.jsonldErr) ld.push(p.url + ': JSON-LD не парсится (' + p.jsonldErr + ')');
  const art = p.jsonld.find(o => /^(BlogPosting|TechArticle|Article)$/.test(o['@type']));
  if (art) {
    if (art.datePublished && p.visibleDate) {
      const m = p.visibleDate.match(/(\d{1,2}) (\S+) (\d{4})/); const iso = m[3] + '-' + String(MONTHS.indexOf(m[2]) + 1).padStart(2, '0') + '-' + m[1].padStart(2, '0');
      if (iso !== String(art.datePublished).slice(0, 10)) ld.push(p.url + ': datePublished ' + String(art.datePublished).slice(0, 10) + ' ≠ видимая дата ' + p.visibleDate);
    }
    if (art.author && art.author.name && p.visibleAuthor && !art.author.name.includes(p.visibleAuthor.trim())) ld.push(p.url + ': автор в разметке «' + art.author.name + '» ≠ видимый «' + p.visibleAuthor + '»');
    if (!art.author) ld.push(p.url + ': нет author в ' + art['@type']);
  }
}
add('jsonld', 'Schema.org: парсинг, дата и автор против видимого текста', ld);
const noLd = real.filter(p => !p.jsonld.length && !p.jsonldErr && !/^\/(privacy|cookie|terms|disclaimer|lk|data-room|oferta)\//.test(p.url)).map(p => p.url);
add('no_jsonld', 'Страницы без JSON-LD', noLd);
// robots
const robotsNotes = [];
robotsNotes.push('Sitemap: ' + (/^Sitemap:\s*https:\/\/probarium\.ru\/sitemap\.xml/im.test(robots) ? 'указан (https://probarium.ru/sitemap.xml)' : '**не указан**'));
robotsNotes.push('Закрыто для всех ботов: ' + disallow.join(', '));
for (const d of disallow) for (const l of sitemapLocs) if (l.replace(ORIGIN, '').startsWith(d)) robotsNotes.push('закрытая страница есть в sitemap: ' + l);
for (const d of disallow) { const p = pages[d]; if (p && !/noindex/i.test(p.robotsMeta)) robotsNotes.push('закрыта в robots.txt, но без `noindex` в мета (Disallow не убирает из индекса уже найденные адреса): ' + d); }
R.robots_notes = robotsNotes.length;
sec.push('## robots.txt\n\n' + robotsNotes.map(x => '- ' + x).join('\n') + '\n');

// «было / стало»
let cmp = '';
if (OUT === 'seo-audit' && fs.existsSync('seo-audit/before-data.json')) {
  const B = JSON.parse(fs.readFileSync('seo-audit/before-data.json', 'utf8'));
  cmp = ['## Было / стало', '', '| Проверка | Было | Стало |', '|---|---:|---:|'].concat(Object.keys(R).map(k => '| ' + k + ' | ' + (B[k] === undefined ? '—' : B[k]) + ' | ' + R[k] + ' |')).join('\n') + '\n\n';
}
const head = '# SEO-аудит probarium.ru\n\nСтраниц в репозитории: ' + Object.keys(pages).length + ' (в анализе: ' + real.length + '; без 404.html и файла верификации Яндекса). URL в sitemap.xml: ' + sitemapLocs.size + '.\n\nТаблица по страницам — `' + csvPath + '`. Сгенерировано `node scripts/seo-audit.js`.\n\n';
const reportPath = OUT === 'seo-audit' ? 'seo-audit/report.md' : OUT + '-report.md';
fs.writeFileSync(reportPath, head + cmp + sec.join('\n'));
fs.writeFileSync(OUT === 'seo-audit' ? 'seo-audit/data.json' : OUT + '-data.json', JSON.stringify(R, null, 1));
console.log('страниц', real.length, '| отчёт', reportPath);
for (const [k, v] of Object.entries(R)) console.log(String(v).padStart(5), k);
