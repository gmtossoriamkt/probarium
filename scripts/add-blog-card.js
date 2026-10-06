#!/usr/bin/env node
// Добавляет карточку статьи ПЕРВОЙ в blog/index.html, пересобирает ItemList (JSON-LD) и добавляет запись в sitemap.xml.
//
// Пример:
//   node scripts/add-blog-card.js --slug kak-chitat-smetu-ki-medizdeliya \
//     --title "Как читать смету КИ медизделия: разбираем коммерческое предложение построчно" \
//     --desc "Как сравнить коммерческие предложения на КИ медизделия: …" \
//     --date 2026-10-06
//
// Параметры:
//   --slug      папка статьи blog/<slug>/ (должна существовать; --no-check отключает проверку статьи)
//   --title     заголовок карточки (H1 статьи)
//   --desc      описание карточки (description статьи)
//   --date      дата публикации ГГГГ-ММ-ДД (в карточке «6 октября 2026», в sitemap — lastmod)
//   --category  рубрика в метке карточки (по умолчанию «Клинические испытания медизделий»)
//   --dry-run   ничего не записывать, только проверить и показать результат
//
// Проверки (при любой ошибке — код 1 и файлы не меняются):
//   • slug: латиница/цифры/дефисы, папка статьи существует, такой карточки и записи в sitemap ещё нет;
//   • дата: реальная календарная дата, не раньше даты текущей первой карточки (иначе нарушится порядок
//     «от новых к старым») и не в будущем; совпадает с datePublished в JSON-LD статьи;
//   • title и desc совпадают с H1 и description статьи (расхождение — предупреждение);
//   • после вставки ItemList перестраивается из карточек (position = порядок на странице).
// После запуска: node scripts/check-site.js, обратные ссылки в «Читайте также», проверка diff, push только по команде.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ORIGIN = 'https://probarium.ru';
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

function fail(msg) { console.error('add-blog-card: ' + msg); process.exit(1); }

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith('--')) fail('неожиданный аргумент: ' + k);
    const name = k.slice(2);
    if (name === 'dry-run' || name === 'no-check') { a[name] = true; continue; }
    if (i + 1 >= argv.length) fail('у параметра --' + name + ' нет значения');
    a[name] = argv[++i];
  }
  return a;
}

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const unesc = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const norm = s => unesc(s).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

const args = parseArgs(process.argv.slice(2));
for (const k of ['slug', 'title', 'desc', 'date']) {
  if (!args[k] || !args[k].trim()) fail('не указан параметр --' + k);
}
const slug = args.slug.trim();
const title = args.title.trim();
const desc = args.desc.trim();
const category = (args.category || 'Клинические испытания медизделий').trim();
if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) fail('slug должен состоять из латиницы, цифр и дефисов: ' + slug);

// --- дата ---
const dm = args.date.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
if (!dm) fail('дата должна быть в формате ГГГГ-ММ-ДД: ' + args.date);
const dateIso = dm[0];
const parsed = new Date(dateIso + 'T00:00:00Z');
if (isNaN(parsed) || parsed.toISOString().slice(0, 10) !== dateIso) fail('несуществующая дата: ' + dateIso);
const dateRu = +dm[3] + ' ' + MONTHS[+dm[2] - 1] + ' ' + dm[1];
const dateKey = +dm[1] * 10000 + +dm[2] * 100 + +dm[3];
const today = new Date(); const todayKey = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
if (dateKey > todayKey) fail('дата публикации ' + dateIso + ' в будущем');

// --- статья ---
const articleFile = path.join('blog', slug, 'index.html');
if (!args['no-check']) {
  if (!fs.existsSync(path.join(ROOT, articleFile))) fail('не найдена статья ' + articleFile + ' (сначала создайте статью или используйте --no-check)');
  const art = fs.readFileSync(path.join(ROOT, articleFile), 'utf8');
  let published = null;
  for (const m of art.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { const j = JSON.parse(m[1]); if (j['@type'] === 'TechArticle') published = j.datePublished; } catch (e) { fail('в ' + articleFile + ' невалидный JSON-LD'); }
  }
  if (!published) fail('в ' + articleFile + ' нет TechArticle с datePublished');
  if (published !== dateIso) fail('--date ' + dateIso + ' не совпадает с datePublished статьи (' + published + ')');
  const h1 = (art.match(/<h1>([\s\S]*?)<\/h1>/) || [])[1];
  const metaDesc = (art.match(/<meta name="description" content="([^"]*)"/) || [])[1];
  if (h1 && norm(h1) !== norm(title)) console.warn('add-blog-card: предупреждение — --title не совпадает с H1 статьи');
  if (metaDesc && norm(metaDesc) !== norm(desc)) console.warn('add-blog-card: предупреждение — --desc не совпадает с description статьи');
}

function read(file) {
  const raw = fs.readFileSync(path.join(ROOT, file), 'utf8');
  return { crlf: raw.includes('\r\n'), text: raw.replace(/\r\n/g, '\n') };
}
function write(file, doc) {
  fs.writeFileSync(path.join(ROOT, file), doc.crlf ? doc.text.replace(/\n/g, '\r\n') : doc.text);
}

// --- blog/index.html ---
const idx = read('blog/index.html');
const CARD_RE = /<article class="case-card">\s*<span class="tag">([^<]*)<\/span>\s*<h3><a href="(\/blog\/[^"]+)">([^<]+)<\/a><\/h3>/g;
const cards = [...idx.text.matchAll(CARD_RE)].map(m => ({ index: m.index, tag: m[1], url: m[2], name: unesc(m[3]) }));
if (!cards.length) fail('в blog/index.html не найдено ни одной карточки (<article class="case-card">)');
const url = '/blog/' + slug + '/';
if (cards.some(c => c.url === url)) fail('карточка ' + slug + ' уже есть в blog/index.html');

const tagDate = tag => { const m = tag.match(/(\d+) (\S+) (\d{4})\s*$/); const mi = m ? MONTHS.indexOf(m[2]) : -1; return m && mi >= 0 ? +m[3] * 10000 + (mi + 1) * 100 + +m[1] : null; };
const firstKey = tagDate(cards[0].tag);
if (firstKey === null) fail('не удалось разобрать дату первой карточки: «' + cards[0].tag + '»');
if (dateKey < firstKey) fail('дата ' + dateIso + ' раньше первой карточки (' + cards[0].tag.match(/\d+ \S+ \d{4}\s*$/)[0] + '): вставка первой нарушит порядок «от новых к старым»');

const eol = '\n';
const card =
  '<article class="case-card">' + eol +
  '          <span class="tag">' + esc(category) + ' · ' + dateRu + '</span>' + eol +
  '          <h3><a href="' + url + '">' + esc(title) + '</a></h3>' + eol +
  '          <p>' + esc(desc) + '</p>' + eol +
  '        </article>' + eol + '        ';
const at = idx.text.lastIndexOf('<article class="case-card">', cards[0].index + 1);
idx.text = idx.text.slice(0, at) + card + idx.text.slice(at);

// ItemList из карточек
const all = [...idx.text.matchAll(CARD_RE)].map(m => ({ url: m[2], name: unesc(m[3]) }));
const items = all.map((c, i) => '    {"@type": "ListItem", "position": ' + (i + 1) + ', "name": ' + JSON.stringify(c.name) + ', "url": "' + ORIGIN + c.url + '"}').join(',\n');
const IL_RE = /("@type":\s*"ItemList"[\s\S]*?"itemListElement":\s*\[)[\s\S]*?(\]\s*\})/;
if (!IL_RE.test(idx.text)) fail('в blog/index.html не найден ItemList в JSON-LD');
idx.text = idx.text.replace(IL_RE, (m, a, b) => a + '\n' + items + '\n  ' + b);
for (const m of idx.text.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
  try { JSON.parse(m[1]); } catch (e) { fail('после вставки JSON-LD в blog/index.html стал невалидным: ' + e.message); }
}

// --- sitemap.xml ---
const sm = read('sitemap.xml');
const loc = ORIGIN + '/blog/' + slug + '/';
if (sm.text.includes('<loc>' + loc + '</loc>')) fail('запись ' + slug + ' уже есть в sitemap.xml');
const entry = '  <url><loc>' + loc + '</loc><lastmod>' + dateIso + '</lastmod></url>';
// ставим перед записью предыдущей первой статьи; если её нет — перед </urlset>
const prevLoc = ORIGIN + cards[0].url;
const prevRe = new RegExp('^[ \\t]*<url><loc>' + prevLoc.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&') + '</loc>', 'm');
const pm = sm.text.match(prevRe);
if (pm) sm.text = sm.text.slice(0, pm.index) + entry + '\n' + sm.text.slice(pm.index);
else if (sm.text.includes('</urlset>')) sm.text = sm.text.replace('</urlset>', () => entry + '\n</urlset>');
else fail('в sitemap.xml не найден </urlset>');

if (args['dry-run']) {
  console.log('add-blog-card: dry-run, файлы не изменены');
  console.log(card.trim());
  console.log(entry.trim());
  console.log('ItemList: ' + all.length + ' позиций, первая — ' + all[0].url);
  process.exit(0);
}
write('blog/index.html', idx);
write('sitemap.xml', sm);
console.log('add-blog-card: добавлено ' + slug + ' (' + dateRu + '), карточек ' + all.length + ', ItemList перестроен');
console.log('Дальше: обратные ссылки в «Читайте также», node scripts/check-site.js, проверка diff, push только по команде.');
