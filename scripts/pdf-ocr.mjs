// Распознавание текста в PDF-скане: node scripts/pdf-ocr.mjs файл.pdf выход.txt [масштаб]
// Постранично пишет «=== стр.N» и текст в выходной файл. Для PDF с текстовым слоем быстрее scripts/pdf-text.mjs.
// Зависимости ставятся вне репозитория (versions важны: canvas 1.x падает с pdfjs 4):
//   mkdir <TOOLS_DIR> && cd <TOOLS_DIR> && npm i pdfjs-dist@4 @napi-rs/canvas@0.1.65 tesseract.js@5
// <TOOLS_DIR> — переменная окружения TOOLS_DIR (по умолчанию <tmp>/probarium-tools).
// Первый запуск скачивает языковые данные rus.traineddata в текущую папку.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';
import { pathToFileURL } from 'url';

const TOOLS = process.env.TOOLS_DIR || path.join(os.tmpdir(), 'probarium-tools');
const req = createRequire(path.join(TOOLS, 'x.js'));
const pdfjs = await import(pathToFileURL(path.join(TOOLS, 'node_modules/pdfjs-dist/legacy/build/pdf.mjs')).href);
const { createCanvas } = req('@napi-rs/canvas');
const { createWorker } = req('tesseract.js');

const [, , file, out, scale = '2.2'] = process.argv;
if (!file || !out) { console.error('Использование: node scripts/pdf-ocr.mjs файл.pdf выход.txt [масштаб]'); process.exit(1); }
const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(file)), useSystemFonts: true, isEvalSupported: false }).promise;
const worker = await createWorker('rus');
fs.writeFileSync(out, '');
for (let p = 1; p <= doc.numPages; p++) {
  const page = await doc.getPage(p);
  const viewport = page.getViewport({ scale: Number(scale) });
  const canvas = createCanvas(viewport.width, viewport.height);
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  const { data } = await worker.recognize(canvas.toBuffer('image/png'));
  fs.appendFileSync(out, '=== стр.' + p + '\n' + data.text + '\n');
  console.log('page', p, '/', doc.numPages);
}
await worker.terminate();
