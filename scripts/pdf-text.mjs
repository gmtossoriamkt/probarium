// Текст из PDF с текстовым слоем: node scripts/pdf-text.mjs файл.pdf [с_страницы] [по_страницу] > out.txt
// Для сканов (без текстового слоя) — scripts/pdf-ocr.mjs.
// Зависимость pdfjs-dist ставится вне репозитория:  mkdir <TOOLS_DIR> && cd <TOOLS_DIR> && npm i pdfjs-dist@4
// <TOOLS_DIR> — переменная окружения TOOLS_DIR (по умолчанию <tmp>/probarium-tools).
import fs from 'fs';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';

const TOOLS = process.env.TOOLS_DIR || path.join(os.tmpdir(), 'probarium-tools');
const pdfjs = await import(pathToFileURL(path.join(TOOLS, 'node_modules/pdfjs-dist/legacy/build/pdf.mjs')).href);

const [, , file, from = '1', to = '100000'] = process.argv;
if (!file) { console.error('Использование: node scripts/pdf-text.mjs файл.pdf [с] [по]'); process.exit(1); }
const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(file)), useSystemFonts: true, isEvalSupported: false }).promise;
for (let p = Number(from); p <= Math.min(Number(to), doc.numPages); p++) {
  const content = await (await doc.getPage(p)).getTextContent();
  console.log('=== стр.' + p + '\n' + content.items.map(i => i.str).join(' ').replace(/\s+/g, ' '));
}
