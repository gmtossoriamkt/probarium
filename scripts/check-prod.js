#!/usr/bin/env node
// Проверка опубликованной статьи (или страницы) на боевом сайте.
// node scripts/check-prod.js blog/slug/ [--base https://probarium.ru] [--contains "фраза" ...] [--absent "фраза" ...]
// Адрес — без ведущего «/» (Git Bash на Windows превращает «/blog/…» в путь диска); с «/» работает при MSYS_NO_PATHCONV=1.
// Печатает: код ответа, title, canonical, число вопросов FAQ в разметке и в видимом тексте (и совпадение),
// число таблиц .table-wrap, наличие формы, первая ли карточка на /blog/, адрес в sitemap, 404 у CLAUDE.md и version.txt.
const args = process.argv.slice(2);
const flag = (name) => { const out = []; for (let i = 0; i < args.length; i++) if (args[i] === name) out.push(args[i + 1]); return out; };
const base = (flag('--base')[0] || 'https://probarium.ru').replace(/\/$/, '');
const valued = new Set(['--base', '--contains', '--absent']);
const positional = args.filter((a, i) => !a.startsWith('--') && !valued.has(args[i - 1]));
if (!positional.length) { console.error('Использование: node scripts/check-prod.js blog/slug/ [--contains "текст"] [--absent "текст"]'); process.exit(1); }
const page = positional[0].startsWith('/') ? positional[0] : '/' + positional[0];

const norm = x => x.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
const get = async (p) => { const r = await fetch(base + p + (p.includes('?') ? '&' : '?') + 'v=' + Date.now()); return [r.status, await r.text()]; };

(async () => {
  const [status, html] = await get(page);
  const title = (html.match(/<title>([^<]*)/) || [, '—'])[1];
  const canonical = (html.match(/rel="canonical" href="([^"]*)"/) || [, '—'])[1];
  const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => { try { return JSON.parse(m[1]); } catch (e) { return null; } }).filter(Boolean);
  const faq = ld.flatMap(x => x['@graph'] || [x]).find(x => x['@type'] === 'FAQPage');
  const visible = [...html.matchAll(/<details class="faq-item"><summary>[\s\S]*?<\/summary><p>([\s\S]*?)<\/p><\/details>/g)].map(m => norm(m[1]));
  const faqSame = faq ? faq.mainEntity.every((q, i) => norm(q.acceptedAnswer.text) === visible[i]) : null;
  console.log('страница', status, '|', title, '| canonical', canonical);
  console.log('FAQ в разметке', faq ? faq.mainEntity.length : 0, '| видимых', visible.length, '| совпадают', faqSame,
    '| таблиц .table-wrap', (html.match(/class="table-wrap"/g) || []).length, '| форма', /consent_pd/.test(html));
  const upd = (html.match(/Обновлено: [^<]*/) || [])[0];
  if (upd) console.log(upd);
  for (const s of flag('--contains')) console.log(html.includes(s) ? '  есть   ' : '  НЕТ    ', s);
  for (const s of flag('--absent')) console.log(!html.includes(s) ? '  нет    ' : '  ЕСТЬ!  ', s);
  if (/^\/blog\/[^/]+\/$/.test(page)) {
    const [, blog] = await get('/blog/');
    const first = [...blog.matchAll(/href="(\/blog\/[a-z0-9-]+\/)"/g)][0];
    console.log('/blog/: первая карточка', first && first[1], first && first[1] === page ? '(это она)' : '');
  }
  const sitemap = await (await fetch(base + '/sitemap.xml')).text();
  console.log('sitemap', sitemap.includes('<loc>' + base + page + '</loc>'));
  const [claude] = await get('/CLAUDE.md');
  const version = await (await fetch(base + '/version.txt?v=' + Date.now())).text();
  console.log('CLAUDE.md', claude, '| version.txt', version.slice(0, 7));
})();
