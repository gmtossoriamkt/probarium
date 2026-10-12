#!/usr/bin/env node
// SEO-оформление статей блога: title (50–60 символов; суффикс « — Probarium» только если помещается),
// description (120–160), og:title/og:description = title/description, article:published_time / modified_time,
// og:site_name. Идемпотентно. Запуск: node scripts/blog-seo.js
//
// Правила длины title: база (без суффикса) ≤ 48 → добавляем « — Probarium» (итого ≤ 60); иначе суффикс убираем (база ≤ 60).
// TITLES / DESCRIPTIONS ниже — ручные формулировки там, где исходная не укладывалась в лимит или нужно развести запросы.

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const SUFFIX = ' — Probarium';

const TITLES = {
  // сдвиг акцента у статей-«конкурентов» (основные: kak-vybrat-kliniku…, kak-sostavit-programmu…)
  'protokol-programma-ki-medizdeliya-ekspertiza': 'Экспертиза протокола КИ: что проверяет эксперт',
  'perechen-medorganizaciy-ki-kak-proverit-kliniku': 'Как проверить клинику по Перечню Росздравнадзора',
  'trebovaniya-k-medorganizacii-dlya-ki-medizdeliya': 'Требования к медорганизации для КИ медизделия',
  'kak-vybrat-kliniku-dlya-ki-perechen-roszdravnadzora': 'Как выбрать клинику для КИ: Перечень и feasibility',
  // слишком длинные
  'dizajn-klinicheskogo-issledovaniya-medizdeliya-vidy': 'Дизайн клинического исследования медизделия: виды и выбор',
  'konechnye-tochki-ki-medizdeliya-kak-vybrat': 'Конечные точки КИ медизделия: как выбрать',
  'statisticheskaya-moshchnost-issledovaniya-medizdeliya': 'Статистическая мощность КИ медизделия простыми словами',
  'zamechanie-k-raschetu-vyborki-kak-otvechat': 'Замечание к расчёту выборки КИ: как пересчитать',
};
const H1S = {
  'protokol-programma-ki-medizdeliya-ekspertiza': 'Экспертиза протокола (программы) КИ медизделия: что проверяет эксперт и как подготовиться',
};
const CRUMBS = {
  'protokol-programma-ki-medizdeliya-ekspertiza': {from: 'Протокол КИ', to: 'Экспертиза протокола КИ'},
};
const DESCRIPTIONS = {
  'kak-poluchit-razreshenie-na-ki': 'Как получить разрешение на КИ медизделия пошагово: подача документов, проверка Росздравнадзором, решение медорганизации, Совет по этике и сроки.',
  'klinicheskaya-ocenka-ili-ki': 'Клиническая оценка или КИ медизделия: чем отличаются подходы, сроки и из чего складывается стоимость каждого варианта. Что выбрать производителю.',
  'otkazali-v-razreshenii': 'Отказали в разрешении на КИ медизделия: типичные причины отказа Росздравнадзора и стратегия повторной подачи заявления с учётом замечаний.',
};

const esc = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const unesc = s => s.replace(/&quot;/g, '"').replace(/&amp;/g, '&');

function process_(file, slug) {
  const raw = fs.readFileSync(file, 'utf8');
  const crlf = raw.includes('\r\n');
  let h = raw.replace(/\r\n/g, '\n');
  const cur = unesc(h.match(/<title>([^<]*)<\/title>/)[1]);
  const base = TITLES[slug] || cur.replace(/ [—|-] Probarium$/, '');
  if (base.length > 60) console.warn('title >60:', slug, base.length);
  const title = base.length <= 48 ? base + SUFFIX : base;
  const desc = DESCRIPTIONS[slug] || unesc(h.match(/<meta name="description" content="([^"]*)"/)[1]);
  const ld = [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));
  const art = ld.find(j => /Article|BlogPosting/.test(j['@type'])) || {};
  const pub = art.datePublished, mod = art.dateModified || art.datePublished;

  h = h.replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`);
  h = h.replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(desc)}">`);
  h = h.replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${esc(base)}">`);
  h = h.replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${esc(desc)}">`);
  // JSON-LD description и headline (если менялись)
  if (DESCRIPTIONS[slug]) h = h.replace(/("description":\s*)"[^"]*"/, `$1${JSON.stringify(desc)}`);
  if (H1S[slug]) {
    h = h.replace(/<h1>[\s\S]*?<\/h1>/, `<h1>${H1S[slug]}</h1>`);
    h = h.replace(/("headline":\s*)"[^"]*"/, `$1${JSON.stringify(H1S[slug])}`);
  }
  if (CRUMBS[slug]) h = h.split(CRUMBS[slug].from).join(CRUMBS[slug].to);

  // article:* и og:site_name (после og:locale, иначе после og:image)
  h = h.replace(/<meta property="article:published_time"[^>]*>\n?/g, '').replace(/<meta property="article:modified_time"[^>]*>\n?/g, '').replace(/<meta property="og:site_name"[^>]*>\n?/g, '');
  const extra = `<meta property="og:site_name" content="Probarium">\n<meta property="article:published_time" content="${pub}">\n<meta property="article:modified_time" content="${mod}">\n`;
  h = /<meta property="og:locale"[^>]*>\n/.test(h) ? h.replace(/(<meta property="og:locale"[^>]*>\n)/, '$1' + extra) : h.replace(/(<meta property="og:image"[^>]*>\n)/, '$1' + extra);

  if (h !== raw.replace(/\r\n/g, '\n')) { fs.writeFileSync(file, crlf ? h.replace(/\n/g, '\r\n') : h); return true; }
  return false;
}

let n = 0;
for (const d of fs.readdirSync(path.join(ROOT, 'blog'))) {
  const f = path.join(ROOT, 'blog', d, 'index.html');
  if (fs.existsSync(f) && process_(f, d)) n++;
}
console.log('blog-seo: обновлено статей:', n);
