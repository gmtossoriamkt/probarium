#!/usr/bin/env node
// Сборка dist/ для хостинга (Timeweb App Platform, «Статический сайт»): копирует сайт без служебных файлов.
// Запуск: node scripts/build-dist.js   → папка публикации dist
// Исключения: .deployignore (по одной записи в строке; «dir/» — папка, остальное — файл верхнего уровня),
// плюс всегда: всё, что начинается с точки (.git*, .githooks, .github, .claude, .local), dist, node_modules,
// package*.json, CNAME, *.md, *.bak, *.sh, *.log, *.tmp.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'dist');

const ALWAYS_SKIP = new Set(['dist', 'node_modules', 'package.json', 'package-lock.json', 'CNAME']);
const SKIP_EXT = /\.(md|bak|sh|log|tmp)$/i;

const ignore = new Set();
const ign = path.join(ROOT, '.deployignore');
if (fs.existsSync(ign)) {
  for (const line of fs.readFileSync(ign, 'utf8').split(/\r?\n/)) {
    const s = line.trim();
    if (s && !s.startsWith('#')) ignore.add(s.replace(/\/$/, ''));
  }
}

function skip(rel, name) {
  if (name.startsWith('.')) return true;
  if (ALWAYS_SKIP.has(name) && !rel.includes(path.sep)) return true;
  if (ignore.has(rel.split(path.sep).join('/'))) return true;
  if (SKIP_EXT.test(name)) return true;
  return false;
}

let files = 0, bytes = 0;
function copy(dir, rel) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const r = rel ? path.join(rel, ent.name) : ent.name;
    if (skip(r, ent.name)) continue;
    const from = path.join(dir, ent.name);
    const to = path.join(OUT, r);
    if (ent.isDirectory()) {
      fs.mkdirSync(to, { recursive: true });
      copy(from, r);
    } else if (ent.isFile()) {
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(from, to);
      files++; bytes += fs.statSync(from).size;
    }
  }
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
copy(ROOT, '');

// Сброс кэша браузера для своих CSS/JS: у файлов /assets/ нет Cache-Control, браузер держит старые копии
// днями (после смены шапки у посетителей оставался старый modern.css). В dist к ссылкам на /assets/*.css|js
// в HTML дописывается ?v=<8 символов md5 содержимого>; адрес меняется, только когда меняется файл.
// В исходниках репозитория ничего не меняется. Так же — путь к analytics.js внутри cookie-banner.js.
const crypto = require('crypto');
const hashOf = f => crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex').slice(0, 8);
const ASSETS = path.join(OUT, 'assets');
const cb = path.join(ASSETS, 'js', 'cookie-banner.js'), an = path.join(ASSETS, 'js', 'analytics.js');
if (fs.existsSync(cb) && fs.existsSync(an)) {
  const src = fs.readFileSync(cb, 'utf8');
  const out = src.replace(/(['"])\/assets\/js\/analytics\.js(\?v=[0-9a-f]+)?\1/, (m, q) => `${q}/assets/js/analytics.js?v=${hashOf(an)}${q}`);
  if (out === src) { console.error('build-dist: в cookie-banner.js не найден путь к analytics.js'); process.exit(1); }
  fs.writeFileSync(cb, out);
}
const ver = new Map();
const assetVer = rel => {
  if (!ver.has(rel)) { const f = path.join(OUT, rel); ver.set(rel, fs.existsSync(f) ? hashOf(f) : null); }
  return ver.get(rel);
};
let busted = 0, pages = 0;
(function walkHtml(d) {
  for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, ent.name);
    if (ent.isDirectory()) { walkHtml(p); continue; }
    if (!ent.name.endsWith('.html')) continue;
    const html = fs.readFileSync(p, 'utf8');
    const out = html.replace(/((?:href|src)=")\/(assets\/[^"?#]+\.(?:css|js))(?:\?[^"#]*)?"/g, (m, attr, rel) => {
      const v = assetVer(rel);
      if (!v) return m;
      busted++; return `${attr}/${rel}?v=${v}"`;
    });
    if (out !== html) { fs.writeFileSync(p, out); pages++; }
  }
})(OUT);
const missing = [...ver].filter(([, v]) => !v).map(([r]) => r);
if (missing.length) { console.error('build-dist: страницы ссылаются на несуществующие файлы: ' + missing.join(', ')); process.exit(1); }

// Обязательные файлы: без них деплой не должен считаться успешным
const need = ['index.html', '404.html', 'sitemap.xml', 'robots.txt', 'blog/index.html'];
const miss = need.filter(f => !fs.existsSync(path.join(OUT, f)));
if (miss.length) { console.error('build-dist: в dist нет обязательных файлов: ' + miss.join(', ')); process.exit(1); }

// Служебное в dist попасть не должно
const bad = [];
(function walk(d) {
  for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, ent.name);
    const rel = path.relative(OUT, p).split(path.sep).join('/');
    if (/^(scripts|\.|data-room-src)/.test(rel) || /\.(md|sh|bak)$/i.test(rel) || /^(CNAME|package(-lock)?\.json)$/.test(rel)) bad.push(rel);
    if (ent.isDirectory()) walk(p);
  }
})(OUT);
if (bad.length) { console.error('build-dist: в dist попало служебное: ' + bad.join(', ')); process.exit(1); }

console.log('build-dist: файлов ' + files + ', ' + (bytes / 1048576).toFixed(1) + ' МБ → dist/; версии ?v= у ' + ver.size + ' файлов assets, ссылок ' + busted + ' на ' + pages + ' страницах');
