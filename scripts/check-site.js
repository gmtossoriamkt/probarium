#!/usr/bin/env node
// Общая проверка сайта probarium.ru перед коммитом.
//
//   node scripts/check-site.js            — проверить весь репозиторий
//   node scripts/check-site.js --faq-all  — расхождения FAQ считать ошибками на всех страницах
//
// Что проверяется:
//   1. JSON-LD: каждый <script type="application/ld+json"> — валидный JSON.
//   2. Внутренние ссылки <a href="/..."> ведут на существующую страницу или файл;
//      ссылки на статьи блога обязаны заканчиваться слэшем.
//   3. sitemap.xml: каждый <loc> указывает на существующую страницу, нет дублей, <lastmod> — корректная дата,
//      у каждой статьи blog/<slug>/ есть запись.
//   4. blog/index.html: у каждой карточки есть статья, у каждой статьи — карточка, нет дублей карточек,
//      карточки идут от новых к старым, ItemList в JSON-LD повторяет порядок карточек (position, url, name).
//   5. FAQPage в JSON-LD совпадает с видимым FAQ (<details><summary>…): число вопросов, текст вопросов и ответов.
//      Расхождение — ошибка для страниц, изменённых в рабочем дереве (git status), и предупреждение для остальных
//      (на сайте есть старые статьи с сокращёнными ответами в JSON-LD; --faq-all делает ошибкой все).
//
// Код возврата: 0 — ошибок нет (предупреждения возможны), 1 — есть ошибки.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
process.chdir(ROOT);
const FAQ_ALL = process.argv.includes('--faq-all');
const ORIGIN = 'https://probarium.ru';
const SKIP = new Set(['.git', 'node_modules', '.claude']);
const MONTHS = { 'января': 1, 'февраля': 2, 'марта': 3, 'апреля': 4, 'мая': 5, 'июня': 6, 'июля': 7, 'августа': 8, 'сентября': 9, 'октября': 10, 'ноября': 11, 'декабря': 12 };

const errors = [];
const warnings = [];
const err = (f, m) => errors.push(f + ': ' + m);
const warn = (f, m) => warnings.push(f + ': ' + m);

function listHtml(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP.has(e.name)) out.push(...listHtml(path.join(dir, e.name))); }
    else if (e.name.endsWith('.html')) out.push(path.join(dir, e.name).replace(/\\/g, '/'));
  }
  return out;
}
const files = listHtml('.').map(f => f.replace(/^\.\//, '')).sort();
const read = f => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

// страницы, изменённые относительно HEAD (в индексе, в рабочем дереве, новые)
const changed = new Set();
try {
  const st = execSync('git status --porcelain', { encoding: 'utf8' });
  for (const line of st.split('\n')) {
    const m = line.match(/^.{2} (?:.* -> )?"?([^"]+?)"?$/);
    if (m && m[1].endsWith('.html')) changed.add(m[1]);
    else if (m && m[1].endsWith('/')) for (const f of files) if (f.startsWith(m[1])) changed.add(f);
  }
} catch (e) { /* не git-репозиторий — все предупреждения остаются предупреждениями */ }

const unent = s => s.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
// текст без тегов: переносы и блочные теги дают пробел, строчные (<a>, <strong>…) исчезают без пробела — остаётся только текст анкора
const strip = s => unent(s.replace(/<\/?(?:br|p|li|ul|ol|div|h[1-6])\b[^>]*>/gi, ' ').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();

// видимый FAQ: <details><summary>вопрос</summary>ответ</details>, а если таких нет — пары <h3>вопрос</h3>ответ под <h2>FAQ / Частые вопросы</h2>
function visibleFaq(h) {
  const det = [...h.matchAll(/<details[^>]*>\s*<summary[^>]*>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g)].map(m => [strip(m[1]), strip(m[2])]);
  if (det.length) return det;
  const hm = h.match(/<h2[^>]*>[^<]*(?:FAQ|Частые вопросы)[^<]*<\/h2>/i);
  if (!hm) return [];
  let seg = h.slice(hm.index + hm[0].length);
  const end = seg.search(/<h2[\s>]|<\/section>/i);
  if (end >= 0) seg = seg.slice(0, end);
  return [...seg.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3[\s>]|$)/g)].map(m => [strip(m[1]), strip(m[2])]);
}

const pageExists = u => {
  const p = u.split('#')[0].split('?')[0].replace(/^\//, '');
  if (!p) return true;
  if (fs.existsSync(p) && fs.statSync(p).isFile()) return true;
  return fs.existsSync(path.join(p, 'index.html'));
};

// ---------- 1, 2, 5: по страницам ----------
let ldCount = 0, faqPages = 0;
for (const f of files) {
  const h = read(f);
  const lds = [];
  for (const m of h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    ldCount++;
    try { lds.push(JSON.parse(m[1])); } catch (e) { err(f, 'невалидный JSON-LD (' + e.message + ')'); }
  }
  for (const m of h.matchAll(/<a\s[^>]*?href="(\/[^"]*)"/g)) {
    const u = m[1];
    if (u.startsWith('//')) continue;
    if (!pageExists(u)) err(f, 'битая внутренняя ссылка ' + u);
    if (/^\/blog\/[^\/"#?]+$/.test(u)) err(f, 'ссылка на статью блога без слэша ' + u);
  }
  const faq = lds.find(j => j && j['@type'] === 'FAQPage');
  if (faq) {
    faqPages++;
    const vis = visibleFaq(h);
    const ent = faq.mainEntity || [];
    const msgs = [];
    if (vis.length !== ent.length) msgs.push('вопросов в видимом блоке ' + vis.length + ', в JSON-LD ' + ent.length);
    ent.forEach((q, i) => {
      if (!vis[i]) return;
      if (vis[i][0] !== strip(q.name)) msgs.push('вопрос ' + (i + 1) + ' отличается');
      else if (vis[i][1] !== strip(q.acceptedAnswer && q.acceptedAnswer.text || '')) msgs.push('ответ ' + (i + 1) + ' отличается');
    });
    if (msgs.length) {
      const text = 'FAQPage ≠ видимый FAQ (' + msgs.slice(0, 3).join('; ') + (msgs.length > 3 ? '; … всего ' + msgs.length : '') + ')';
      (FAQ_ALL || changed.has(f) ? err : warn)(f, text);
    }
  }
}

// ---------- 3: sitemap ----------
const smRaw = fs.existsSync('sitemap.xml') ? read('sitemap.xml') : null;
const blogDirs = fs.existsSync('blog') ? fs.readdirSync('blog', { withFileTypes: true }).filter(e => e.isDirectory() && fs.existsSync(path.join('blog', e.name, 'index.html'))).map(e => e.name) : [];
let smCount = 0;
if (!smRaw) err('sitemap.xml', 'файл не найден');
else {
  const entries = [...smRaw.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(m => m[1]);
  const seen = new Set();
  for (const e of entries) {
    smCount++;
    const loc = (e.match(/<loc>([^<]*)<\/loc>/) || [])[1];
    if (!loc) { err('sitemap.xml', 'запись без <loc>'); continue; }
    if (!loc.startsWith(ORIGIN + '/')) err('sitemap.xml', 'адрес вне ' + ORIGIN + ': ' + loc);
    if (seen.has(loc)) err('sitemap.xml', 'дубль ' + loc);
    seen.add(loc);
    if (loc.startsWith(ORIGIN + '/') && !pageExists(loc.slice(ORIGIN.length))) err('sitemap.xml', 'страницы нет в репозитории: ' + loc);
    const lm = (e.match(/<lastmod>([^<]*)<\/lastmod>/) || [])[1];
    if (lm !== undefined) {
      const d = lm.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      const ok = d && !isNaN(Date.parse(lm)) && new Date(lm).toISOString().slice(0, 10) === lm;
      if (!ok) err('sitemap.xml', 'некорректный lastmod ' + lm + ' у ' + loc);
    }
  }
  for (const s of blogDirs) if (!seen.has(ORIGIN + '/blog/' + s + '/')) err('sitemap.xml', 'нет записи для статьи blog/' + s + '/');
  if (!seen.has(ORIGIN + '/blog/')) err('sitemap.xml', 'нет записи для /blog/');
}

// ---------- 4: blog/index.html ----------
let cardCount = 0;
if (fs.existsSync('blog/index.html')) {
  const idx = read('blog/index.html');
  const cards = [...idx.matchAll(/<article class="case-card">\s*<span class="tag">([^<]*)<\/span>\s*<h3><a href="(\/blog\/[^"]+)">([^<]+)<\/a><\/h3>/g)]
    .map(m => ({ tag: m[1], url: m[2], name: unent(m[3]) }));
  cardCount = cards.length;
  const dateOf = tag => { const m = tag.match(/(\d+) (\S+) (\d{4})\s*$/); return m && MONTHS[m[2]] ? +m[3] * 10000 + MONTHS[m[2]] * 100 + +m[1] : null; };
  const slugs = new Set();
  cards.forEach((c, i) => {
    const s = c.url.replace(/^\/blog\//, '').replace(/\/$/, '');
    if (slugs.has(s)) err('blog/index.html', 'дубль карточки ' + s);
    slugs.add(s);
    if (!c.url.endsWith('/')) err('blog/index.html', 'ссылка карточки без слэша ' + c.url);
    if (!fs.existsSync(path.join('blog', s, 'index.html'))) err('blog/index.html', 'карточка без статьи: ' + s);
    const d = dateOf(c.tag);
    if (d === null) err('blog/index.html', 'не удалось разобрать дату в метке карточки «' + c.tag + '» (' + s + ')');
    else if (i > 0) { const p = dateOf(cards[i - 1].tag); if (p !== null && d > p) err('blog/index.html', 'нарушен порядок «от новых к старым»: ' + s + ' новее предыдущей карточки'); }
  });
  for (const s of blogDirs) if (!slugs.has(s)) err('blog/index.html', 'у статьи blog/' + s + '/ нет карточки');
  const ld = [...idx.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => { try { return JSON.parse(m[1]); } catch (e) { return null; } })
    .filter(Boolean).find(j => j['@type'] === 'ItemList' || (j.mainEntity && j.mainEntity['@type'] === 'ItemList'));
  if (!ld) err('blog/index.html', 'не найден ItemList в JSON-LD');
  else {
    const el = ld.itemListElement || ld.mainEntity.itemListElement;
    if (el.length !== cards.length) err('blog/index.html', 'ItemList: ' + el.length + ' позиций, карточек ' + cards.length);
    el.forEach((x, i) => {
      const c = cards[i]; if (!c) return;
      const u = (x.url || x.item || '').replace(ORIGIN, '');
      if (x.position !== i + 1) err('blog/index.html', 'ItemList: position ' + x.position + ' вместо ' + (i + 1));
      if (u !== c.url) err('blog/index.html', 'ItemList: позиция ' + (i + 1) + ' ведёт на ' + u + ', карточка — ' + c.url);
      else if (x.name !== c.name) err('blog/index.html', 'ItemList: название позиции ' + (i + 1) + ' отличается от карточки');
    });
  }
} else err('blog/index.html', 'файл не найден');

// ---------- итог ----------
console.log('check-site: страниц ' + files.length + ', JSON-LD ' + ldCount + ', страниц с FAQPage ' + faqPages + ', карточек ' + cardCount + ', URL в sitemap ' + smCount);
if (warnings.length) {
  console.log('\nПредупреждения (' + warnings.length + '), не блокируют:');
  warnings.forEach(w => console.log('  ! ' + w));
}
if (errors.length) {
  console.error('\nОшибки (' + errors.length + '):');
  errors.forEach(e => console.error('  ✗ ' + e));
  console.error('\ncheck-site: найдены ошибки');
  process.exit(1);
}
console.log('check-site: ошибок нет' + (warnings.length ? ' (предупреждений: ' + warnings.length + ')' : ''));
