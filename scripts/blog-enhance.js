#!/usr/bin/env node
// Единый «улучшатель» статей блога: идемпотентно (можно запускать повторно и для новых статей).
//
//   node scripts/blog-enhance.js            — все фазы
//   node scripts/blog-enhance.js cta        — «Что делать дальше», инлайн-CTA, расширенная форма, подключение CSS/JS статьи
//   node scripts/blog-enhance.js home       — блок «Последние статьи» на главной
//
// Блоки, которые вставляет скрипт, обёрнуты в маркеры <!--enh:имя--> … <!--/enh:имя-->, поэтому при повторном
// запуске заменяются, а не дублируются. Тематика CTA задаётся в scripts/blog-cta-map.js.

const fs = require('fs');
const path = require('path');
const {CARDS, CLUSTERS, CLUSTER_OF, HUBS, PROGRAM_MEMBERS, CROSS, POINTERS} = require('./blog-cta-map');

const ROOT = path.resolve(__dirname, '..');
const phases = process.argv.slice(2);
const run = name => phases.length === 0 || phases.includes(name);

function edit(file, fn) {
  const raw = fs.readFileSync(file, 'utf8');
  const crlf = raw.includes('\r\n');
  let h = raw.replace(/\r\n/g, '\n');
  const out = fn(h);
  if (out === h) return false;
  fs.writeFileSync(file, crlf ? out.replace(/\n/g, '\r\n') : out);
  return true;
}
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const marker = (name, html) => `<!--enh:${name}-->\n${html}\n<!--/enh:${name}-->`;
const stripMarker = (h, name, repl = '\n\n') =>
  h.replace(new RegExp('\\n*[ \\t]*<!--enh:' + name + '-->[\\s\\S]*?<!--/enh:' + name + '-->\\n*', 'g'), repl);

const FINAL_RE = /<section id="?final-cta"?>/;
const NEEDS = ['Клинические испытания', 'Доклиника и токсикология', 'Технические испытания', 'Не знаю, нужна консультация'];

function cardHtml(key, topic) {
  const c = CARDS[key];
  if (c.form) {
    return `<div class="next-card"><h3>${esc(c.title)}</h3><p>${esc(c.text)}</p>` +
      `<a href="#cta-form" class="btn btn-primary" data-goal="${c.goal}" data-prefill="${esc('Вопрос из статьи: ' + topic)}" data-need="${esc(c.need)}">${esc(c.label)}</a></div>`;
  }
  return `<div class="next-card"><h3>${esc(c.title)}</h3><p>${esc(c.text)}</p>` +
    `<a href="${c.href}" class="btn btn-outline" data-goal="${c.goal}">${esc(c.label)}</a></div>`;
}

function formHtml(slug, canon, topic) {
  return `<form id="cta-form" aria-label="Форма заявки на консультацию" action="https://formspree.io/f/mzdlwqbk" method="POST">
          <input type="hidden" name="_subject" value="Заявка с сайта Probarium (blog/${slug})">
          <input type="hidden" name="source_url" value="${canon}">
          <input type="hidden" name="source_article" value="${esc(topic)}">
          <label class="visually-hidden" for="name">Имя</label>
          <input id="name" name="name" type="text" placeholder="Ваше имя" required>
          <label class="visually-hidden" for="company">Компания</label>
          <input id="company" name="company" type="text" placeholder="Компания">
          <label class="visually-hidden" for="email">Email</label>
          <input id="email" name="email" type="email" placeholder="Email" required>
          <label class="visually-hidden" for="phone">Телефон</label>
          <input id="phone" name="phone" type="tel" placeholder="Телефон (необязательно)" autocomplete="tel">
          <label class="visually-hidden" for="need">Что нужно</label>
          <select id="need" name="need">
${NEEDS.map(n => `            <option>${n}</option>`).join('\n')}
          </select>
          <label class="visually-hidden" for="message">Комментарий</label>
          <textarea id="message" name="message" rows="3" placeholder="Кратко об изделии и предполагаемой форме испытаний"></textarea>
          <label class="consent">
            <input type="checkbox" required>
            <span>Согласен(на) на обработку персональных данных в соответствии с <a href="/privacy/" style="text-decoration:underline;">политикой конфиденциальности</a> (152-ФЗ) и принимаю условия <a href="/oferta/" style="text-decoration:underline;">публичной оферты</a></span>
          </label>
          <button type="submit" class="btn btn-primary">Отправить заявку</button>
        </form>`;
}

function enhanceArticle(file, slug) {
  return edit(file, h => {
    const canon = (h.match(/<link rel="canonical" href="([^"]+)"/) || [])[1] || `https://probarium.ru/blog/${slug}/`;
    const bc = (h.match(/"@type":\s*"ListItem",\s*"position":\s*3,\s*"name":\s*"([^"]+)"/) || [])[1];
    const h1 = (h.match(/<h1>([\s\S]*?)<\/h1>/) || [])[1].replace(/<[^>]+>/g, '').trim();
    const topic = bc || h1;
    const clusterKey = CLUSTER_OF[slug] || 'general';
    const cluster = CLUSTERS[clusterKey];

    h = stripMarker(h, 'next');
    h = stripMarker(h, 'inline', '\n\n      ');

    // подключение CSS/JS статьи
    if (!h.includes('/assets/css/article.css'))
      h = h.replace('</head>', '<link rel="stylesheet" href="/assets/css/article.css">\n</head>');
    if (!h.includes('/assets/js/article-cta.js'))
      h = h.replace('<script src="/assets/js/cookie-banner.js" defer></script>',
        '<script src="/assets/js/article-cta.js" defer></script>\n<script src="/assets/js/cookie-banner.js" defer></script>');
    if (!h.includes('/assets/js/leads.js'))
      h = h.replace('<script src="/assets/js/cookie-banner.js" defer></script>',
        '<script src="/assets/js/leads.js" defer></script>\n<script src="/assets/js/cookie-banner.js" defer></script>');

    // финальный блок: ищем и в обычной, и в минифицированной (без кавычек) разметке
    if (!FINAL_RE.test(h)) {
      const sec = `  <section id="final-cta">
    <div class="container">
      <div class="final-cta">
        <div class="copy">
          <h2>Обсудить проект</h2>
          <p>Оставьте заявку — менеджер свяжется в течение рабочего дня, чтобы уточнить детали и предложить маршрут испытаний.</p>
        </div>
        ${formHtml(slug, canon, topic)}
      </div>
    </div>
  </section>
`;
      h = h.replace(/<\/main>/, sec + '\n</main>');
    }
    const finalAt = h.search(FINAL_RE);

    // кнопки с mailto в теле статьи → страницы подбора/калькулятора
    h = h.replace(/<a href="mailto:info@probarium\.ru\?subject=Подбор формы клинических испытаний" class="btn btn-outline">/g, '<a href="/podbor-ispytaniy/" class="btn btn-outline" data-goal="forms_from_article">');
    h = h.replace(/<a href="mailto:info@probarium\.ru\?subject=Расчёт стоимости КИ" class="btn btn-outline">/g, '<a href="/kalkulyator/" class="btn btn-outline" data-goal="calc_from_article">');
    const finalAt1 = h.search(FINAL_RE);
    // mailto-кнопка в финальном блоке → якорь на форму с предзаполнением
    h = h.replace(/<a href="?mailto:info@probarium\.ru\?subject=[^">]*"? class="?btn(?: btn-outline)?"?>([^<]+)<\/a>/g, (m, label, offset) => {
      if (offset < finalAt1) return m;
      return `<a href="#cta-form" class="btn btn-outline" data-goal="article_cta_click" data-prefill="${esc('Вопрос из статьи: ' + topic)}" data-need="${esc(NEEDS[0])}">${label}</a>`;
    });

    // расширенная форма (только форма внутри финального блока)
    const finalAt2 = h.search(FINAL_RE);
    h = h.replace(/<form [^>]*>[\s\S]*?<\/form>/, (m, offset) => (offset > finalAt2 ? formHtml(slug, canon, topic) : m));

    // «Что делать дальше» перед финальным блоком
    const next = `  <section class="next-steps" aria-labelledby="next-h2">
    <div class="container">
      <h2 id="next-h2">Что делать дальше</h2>
      <div class="next-grid">
        ${cluster.cards.map(k => cardHtml(k, topic)).join('\n        ')}
      </div>
    </div>
  </section>`;
    h = h.replace(/( *)(<section id="?final-cta"?>)/, (m, sp, tag) => marker('next', next) + '\n\n' + sp + tag);

    // инлайн-CTA в статьях с более чем 12 заголовками H2 (перед 5-м H2)
    const bodyStart = h.indexOf('<div class="container article-body">');
    const bodyEnd = bodyStart >= 0 ? h.indexOf('</section>', bodyStart) : -1;
    if (bodyStart >= 0 && bodyEnd > bodyStart) {
      const body = h.slice(bodyStart, bodyEnd);
      const h2s = [...body.matchAll(/<h2[ >]/g)];
      if (h2s.length > 12) {
        const c = CARDS[cluster.inline.card];
        const btn = c.form
          ? `<a href="#cta-form" class="btn btn-primary" data-goal="${c.goal}" data-prefill="${esc('Вопрос из статьи: ' + topic)}" data-need="${esc(c.need)}">${esc(c.label)}</a>`
          : `<a href="${c.href}" class="btn btn-primary" data-goal="${c.goal}">${esc(c.label)}</a>`;
        const aside = marker('inline', `      <aside class="inline-cta" aria-label="Подсказка"><p>${esc(cluster.inline.text)}</p>${btn}</aside>`);
        const at = bodyStart + h2s[4].index;
        h = h.slice(0, at) + aside + '\n\n      ' + h.slice(at);
      }
    }
    return h;
  });
}

function latestHtml() {
  const idx = fs.readFileSync(path.join(ROOT, 'blog/index.html'), 'utf8').replace(/\r\n/g, '\n');
  const cards = [...idx.matchAll(/<article class="case-card">([\s\S]*?)<\/article>/g)].slice(0, 3).map(m => {
    const tag = (m[1].match(/<span class="tag">([\s\S]*?)<\/span>/) || [])[1] || '';
    const date = (tag.split('·')[1] || '').trim();
    const a = m[1].match(/<h3><a href="([^"]+)">([\s\S]*?)<\/a><\/h3>/);
    const p = (m[1].match(/<p>([\s\S]*?)<\/p>/) || [])[1] || '';
    return {date, href: a[1], title: a[2], text: p};
  });
  return `  <section aria-labelledby="latest-h2" class="sec-white">
    <div class="container">
      <div class="section-head">
        <h2 id="latest-h2">Последние статьи</h2>
      </div>
      <div class="cases">
${cards.map(c => `        <article class="case-card">
          <span class="tag">${c.date}</span>
          <h3><a href="${c.href}">${c.title}</a></h3>
          <p>${c.text}</p>
        </article>`).join('\n')}
      </div>
      <p style="text-align:center;margin-top:28px;"><a class="btn btn-outline" href="/blog/">Все статьи →</a></p>
    </div>
  </section>`;
}

// ---- Перелинковка: хабы кластеров, связи между кластерами, ссылки «конкурентов» на основную статью ----
function h1Of(slug) {
  const h = fs.readFileSync(path.join(ROOT, 'blog', slug, 'index.html'), 'utf8');
  return h.match(/<h1>([\s\S]*?)<\/h1>/)[1].replace(/<[^>]+>/g, '').trim();
}
const RELATED_ANCHOR = /(<a class="?related-card"? href="?\/glossariy\/?"?>)/;
const hasLink = (h, slug) => new RegExp('href="?/blog/' + slug + '/?"?[ >]').test(h.slice(h.search(/id="?related-h2"?/)));

function linkArticle(file, slug) {
  const cluster = CLUSTER_OF[slug];
  const want = [];
  if (cluster && HUBS[cluster]) HUBS[cluster].forEach(s => want.push(s));
  if (PROGRAM_MEMBERS.includes(slug)) HUBS.program.forEach(s => want.push(s));
  (CROSS[slug] || []).forEach(s => want.push(s));
  const targets = [...new Set(want)].filter(s => s !== slug && fs.existsSync(path.join(ROOT, 'blog', s, 'index.html')));
  return edit(file, h => {
    const relAt = h.search(/id="?related-h2"?/);
    if (relAt < 0) return h;
    const add = targets.filter(s => !hasLink(h, s));
    if (add.length) {
      const cards = add.map(s => `<a class="related-card" href="/blog/${s}/">${h1Of(s)}</a>`).join('\n        ');
      h = h.replace(RELATED_ANCHOR, (m) => cards + '\n        ' + m);
    }
    // ссылка «конкурента» на основную статью по запросу (маркер — для повторных запусков)
    h = h.replace(/<!--enh:pointer-->[\s\S]*?<!--\/enh:pointer-->/g, '');
    const ptr = POINTERS[slug];
    if (ptr) {
      const at = h.indexOf('<div class="container article-body">');
      const firstP = at >= 0 ? h.indexOf('</p>', at) : -1;
      if (firstP > 0) {
        const p = `<!--enh:pointer-->\n\n      <p>${ptr.text} <a href="/blog/${ptr.main}/" class="inline-link">«${ptr.anchor}»</a>.</p><!--/enh:pointer-->`;
        h = h.slice(0, firstP + 4) + p + h.slice(firstP + 4);
      }
    }
    return h;
  });
}

// ---- JSON-LD (BlogPosting), даты, оглавление ----
const RU = {а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'c',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya'};
const slugify = s => s.toLowerCase().replace(/[а-яё]/g, c => RU[c]).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'section';
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const ruDate = iso => { const [y, m, d] = iso.slice(0, 10).split('-').map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };

// ISO 8601 с временем и поясом (Москва, +03:00). Время берём из git-истории файла: если в тот день, что указан в
// статье, были коммиты, то для публикации — время первого, для обновления — время последнего; иначе 10:00:00.
const {execFileSync} = require('child_process');
const MSK = new Intl.DateTimeFormat('en-CA', {timeZone: 'Europe/Moscow', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'});
function moscow(ts) {
  const p = Object.fromEntries(MSK.formatToParts(new Date(ts * 1000)).map(x => [x.type, x.value]));
  return {ts, date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}:${p.second}`};
}
function commitTimes(file) {
  try {
    return execFileSync('git', ['log', '--format=%ct', '--', file], {cwd: ROOT}).toString().trim().split('\n').filter(Boolean).map(Number).map(moscow);
  } catch (e) { return []; }
}
function fullIso(file, value, kind) {
  if (!value) return value;
  if (value.length > 10) return value; // уже полный формат
  const same = commitTimes(file).filter(t => t.date === value).sort((a, b) => a.ts - b.ts);
  if (!same.length) return `${value}T10:00:00+03:00`;
  const pick = kind === 'pub' ? same[0] : same[same.length - 1];
  return `${value}T${pick.time}+03:00`;
}

function ldArticle(file, slug) {
  return edit(file, h => {
    const url = `https://probarium.ru/blog/${slug}/`;
    // BlogPosting
    h = h.replace(/<script type="application\/ld\+json">\s*(\{[\s\S]*?\})\s*<\/script>/g, (m, json) => {
      let o;
      try { o = JSON.parse(json); } catch (e) { return m; }
      if (!/Article|BlogPosting/.test(o['@type'])) return m;
      let pubIso = fullIso(file, o.datePublished, 'pub');
      let mod = fullIso(file, o.dateModified || o.datePublished, 'mod');
      if (mod.slice(0, 10) === pubIso.slice(0, 10) && mod < pubIso) mod = pubIso; // обновление не раньше публикации
      const out = {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: o.headline,
        description: o.description,
        inLanguage: 'ru',
        image: ['https://probarium.ru/assets/og-cover.jpg'],
        author: {'@type': 'Person', name: 'Артемий-Татуш Танделов', jobTitle: 'Генеральный директор Probarium', url: 'https://probarium.ru/komanda/', sameAs: ['https://t.me/tandelovtat']},
        publisher: {'@type': 'Organization', name: 'Probarium', url: 'https://probarium.ru/', logo: {'@type': 'ImageObject', url: 'https://probarium.ru/icon-512.png'}},
        mainEntityOfPage: {'@type': 'WebPage', '@id': url},
        datePublished: pubIso,
        dateModified: mod,
      };
      return '<script type="application/ld+json">\n' + JSON.stringify(out, null, 2) + '\n</script>';
    });
    const art = JSON.parse((h.match(/<script type="application\/ld\+json">\s*(\{[^<]*"@type": "BlogPosting"[\s\S]*?\})\s*<\/script>/) || [, '{}'])[1]);
    const pub = art.datePublished, mod = art.dateModified;

    // видимая дата обновления (если отличается от даты публикации)
    h = h.replace(/<!--enh:upd-->[\s\S]*?<!--\/enh:upd-->/g, '');
    if (pub && mod && mod.slice(0, 10) !== pub.slice(0, 10)) {
      h = h.replace(/(<div class="article-meta">[\s\S]*?<span>)([^<]*)(<\/span>)(<\/div>)/, (m, a, b, c, d) =>
        b.trim().startsWith('Обновлено') ? m : `${a}${b}${c}<!--enh:upd--><span>Обновлено: ${ruDate(mod)}</span><!--/enh:upd-->${d}`);
    }

    // оглавление: больше 8 заголовков H2 в теле статьи
    h = h.replace(/<!--enh:toc-->[\s\S]*?<!--\/enh:toc-->\n*/g, '');
    const bs = h.indexOf('<div class="container article-body">');
    const be = bs >= 0 ? h.indexOf('</section>', bs) : -1;
    if (bs >= 0 && be > bs) {
      let body = h.slice(bs, be);
      const used = new Set();
      const items = [];
      body = body.replace(/<h2((?: [^>]*)?)>([\s\S]*?)<\/h2>/g, (m, attrs, inner) => {
        const text = inner.replace(/<[^>]+>/g, '').trim();
        let id = (attrs.match(/ id="?([^" >]+)"?/) || [])[1];
        if (!id) {
          id = slugify(text);
          let k = 2, base = id;
          while (used.has(id)) id = base + '-' + k++;
          attrs += ` id="${id}"`;
        }
        used.add(id);
        items.push({id, text});
        return `<h2${attrs}>${inner}</h2>`;
      });
      if (items.length > 8) {
        const toc = marker('toc', `      <details class="toc" open>\n        <summary>Содержание</summary>\n        <ol>\n${items.map(i => `          <li><a href="#${i.id}">${esc(i.text)}</a></li>`).join('\n')}\n        </ol>\n      </details>`);
        body = body.replace('<div class="container article-body">', '<div class="container article-body">\n\n' + toc + '\n');
      }
      h = h.slice(0, bs) + body + h.slice(be);
    }
    return h;
  });
}

if (run('ld')) {
  let n = 0;
  const mods = {};
  for (const d of fs.readdirSync(path.join(ROOT, 'blog'))) {
    const f = path.join(ROOT, 'blog', d, 'index.html');
    if (!fs.existsSync(f)) continue;
    if (ldArticle(f, d)) n++;
    const h = fs.readFileSync(f, 'utf8');
    const m = h.match(/"dateModified":\s*"([^"]+)"/);
    if (m) mods[d] = m[1];
  }
  // sitemap lastmod = dateModified
  let sm = 0;
  edit(path.join(ROOT, 'sitemap.xml'), s => s.replace(/(<loc>https:\/\/probarium\.ru\/blog\/([a-z0-9-]+)\/<\/loc>\s*<lastmod>)([^<]+)(<\/lastmod>)/g, (m, a, slug, lm, z) => {
    if (mods[slug] && mods[slug] !== lm) { sm++; return a + mods[slug] + z; }
    return m;
  }));
  console.log('blog-enhance ld: обновлено статей:', n, '; lastmod в sitemap исправлено:', sm);
}

if (run('links')) {
  let n = 0;
  for (const d of fs.readdirSync(path.join(ROOT, 'blog'))) {
    const f = path.join(ROOT, 'blog', d, 'index.html');
    if (fs.existsSync(f) && linkArticle(f, d)) n++;
  }
  console.log('blog-enhance links: обновлено статей:', n);
}

if (run('cta')) {
  let n = 0;
  for (const d of fs.readdirSync(path.join(ROOT, 'blog'))) {
    const f = path.join(ROOT, 'blog', d, 'index.html');
    if (!fs.existsSync(f)) continue;
    if (enhanceArticle(f, d)) n++;
  }
  console.log('blog-enhance cta: обновлено статей:', n);
}
if (run('home')) {
  const changed = edit(path.join(ROOT, 'index.html'), h => {
    h = stripMarker(h, 'latest');
    return h.replace('  <section aria-labelledby="faq-h2">', marker('latest', latestHtml()) + '\n\n  <section aria-labelledby="faq-h2">');
  });
  console.log('blog-enhance home:', changed ? 'блок «Последние статьи» обновлён' : 'без изменений');
}
