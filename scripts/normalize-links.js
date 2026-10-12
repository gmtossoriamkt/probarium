#!/usr/bin/env node
// Приводит внутренние ссылки на страницы-каталоги к виду со слэшем (/uslugi → /uslugi/), как их отдаёт сервер
// (вариант без слэша получает 308-редирект). Не трогает файлы, якоря-только, mailto/tel, внешние ссылки и раздел biblioteka/.
//   node scripts/normalize-links.js          — применить
//   node scripts/normalize-links.js --dry    — только показать количество
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const dry = process.argv.includes('--dry');
const isDir = p => { const f = path.join(ROOT, p.replace(/^\//, '')); return fs.existsSync(path.join(f, 'index.html')); };
let files = 0, links = 0;
(function walk(d) {
  for (const e of fs.readdirSync(d)) {
    if (['node_modules', '.git', 'scratchpad', 'biblioteka', '.local'].includes(e)) continue;
    const q = path.join(d, e);
    if (fs.statSync(q).isDirectory()) { walk(q); continue; }
    if (!e.endsWith('.html')) continue;
    const raw = fs.readFileSync(q, 'utf8');
    const crlf = raw.includes('\r\n');
    let n = 0;
    const out = raw.replace(/\r\n/g, '\n').replace(/(href=)("?)(\/[a-z0-9][a-z0-9\-\/]*[a-z0-9])(["?# >])/g, (m, a, qt, p, tail) => {
      if (!isDir(p)) return m;
      n++;
      return a + qt + p + '/' + tail;
    });
    if (n) { links += n; files++; if (!dry) fs.writeFileSync(q, crlf ? out.replace(/\n/g, '\r\n') : out); }
  }
})(ROOT);
console.log(`normalize-links: ${links} ссылок в ${files} файлах${dry ? ' (dry)' : ''}`);
