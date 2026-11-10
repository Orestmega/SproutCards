// Usage: node scripts/mascot/split.mjs <out.png from cut.mjs> src/assets/mascot <preview.png>
// Step 2: cut the transparent picture (960 px = 120 units) into layers that can move on their own,
// make the body 4 % taller (it looked squashed), fit everything back into the square, export WebP layers.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { launchChrome } from '../browser/lib.mjs';

const [src, outDir, previewPng] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const data = 'data:image/png;base64,' + readFileSync(src).toString('base64');
const b = await launchChrome({ width: 800, height: 800 });
await b.goto('about:blank', 300);
await b.evalJs(`window.SRC = ${JSON.stringify(data)}; 1`);
const result = await b.evalJs(`(async () => {
  const img = new Image(); img.src = SRC; await img.decode();
  const S = 960, U = S / 120;
  const c = document.createElement('canvas'); c.width = S; c.height = S;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const src = g.getImageData(0, 0, S, S).data;
  // the body: an ellipse in units
  const E = { cx: 60, cy: 76.5, rx: 38.6, ry: 33.6 };
  const dist = (x, y) => Math.sqrt(((x - E.cx) / E.rx) ** 2 + ((y - E.cy) / E.ry) ** 2);
  const inBody = (x, y) => dist(x, y) <= 1;
  // a band just inside the body edge, copied into the layer behind so no seam shows through
  const band = (x, y, units) => { const d = dist(x, y); return d >= 1 - units / E.ry; }; // (called for body pixels only, so the outline ring is included)
  const names = ['leaves', 'page', 'armLeft', 'armRight', 'footLeft', 'footRight', 'body'];
  const layers = Object.fromEntries(names.map((n) => [n, new ImageData(S, S)]));
  for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
    const i = (py * S + px) * 4; const a = src[i + 3]; if (!a) continue;
    const x = (px + 0.5) / U, y = (py + 0.5) / U;
    let n = 'body';
    // the body keeps its whole outline (a ring just outside the ellipse), so no moving layer cuts it
    if (dist(x, y) > 1 + 1.8 / E.ry) {
      if (y < 16.5) n = 'leaves';
      else if (y < 52 && x > 34 && x < 86) n = 'page';
      else if (y > 70 && y < 100 && x < 27) n = 'armLeft';
      else if (y > 70 && y < 100 && x > 93) n = 'armRight';
      else if (y > 99 && a > 150) n = x < 60 ? 'footLeft' : 'footRight';
    }
    const put = (name) => { const t = layers[name].data; t[i] = src[i]; t[i+1] = src[i+1]; t[i+2] = src[i+2]; t[i+3] = a; };
    put(n);
    if (n === 'body') {
      if (band(x, y, 1.5) && y < 52 && x > 34 && x < 86) put('page');
      if (band(x, y, 2) && y > 70 && y < 100 && x < 27) put('armLeft');
      if (band(x, y, 2) && y > 70 && y < 100 && x > 93) put('armRight');
      if (band(x, y, 2) && y > 99) put(x < 60 ? 'footLeft' : 'footRight');
    }
    // the stem crosses from the leaves into the page: both layers have it
    if (n === 'page' && y < 19.5 && x > 55 && x < 63) put('leaves');
  }
  // placement: body parts 4 % taller about the bottom of the body; page and leaves move up with its top;
  // then everything is scaled to 97 % about the centre so it still fits
  const K = 1.04, BOTTOM = 109.5, TOP = 43.2, SHIFT = (K - 1) * (BOTTOM - TOP), G = 0.97;
  const tall = new Set(['body', 'armLeft', 'armRight', 'footLeft', 'footRight']);
  const map = (n, x, y) => {
    const y1 = tall.has(n) ? BOTTOM - K * (BOTTOM - y) : y - SHIFT;
    return [60 + G * (x - 60), 60 + G * (y1 - 60)];
  };
  const out = {};
  const OUT = 480;
  const tmp = document.createElement('canvas'); tmp.width = S; tmp.height = S;
  const preview = document.createElement('canvas'); preview.width = OUT; preview.height = OUT;
  const pg = preview.getContext('2d'); pg.fillStyle = '#ffd0ff'; pg.fillRect(0, 0, OUT, OUT);
  for (const n of names) {
    tmp.getContext('2d').putImageData(layers[n], 0, 0);
    const o = document.createElement('canvas'); o.width = OUT; o.height = OUT;
    const og = o.getContext('2d'); og.imageSmoothingQuality = 'high';
    const f = OUT / 120;
    const [x0, y0] = map(n, 0, 0), [x1, y1] = map(n, 120, 120);
    og.drawImage(tmp, 0, 0, S, S, x0 * f, y0 * f, (x1 - x0) * f, (y1 - y0) * f);
    out[n] = o.toDataURL('image/webp', 0.9);
  }
  // preview: back to front, as the component stacks them
  for (const n of ['footLeft', 'footRight', 'page', 'leaves', 'armLeft', 'armRight', 'body']) {
    const im = new Image(); im.src = out[n]; await im.decode(); pg.drawImage(im, 0, 0);
  }
  const pivots = {
    leaves: map('leaves', 59, 17.5), page: map('page', 60, 48), armLeft: map('armLeft', 25, 80),
    armRight: map('armRight', 95, 80), footLeft: map('footLeft', 40, 113), footRight: map('footRight', 80, 113),
    bodyTop: map('body', 60, TOP), bodyBottom: map('body', 60, BOTTOM),
  };
  return { out, preview: preview.toDataURL('image/png'), pivots };
})()`);
if (result.error) {
  console.error(result.error);
  process.exit(1);
}
for (const [n, url] of Object.entries(result.out)) {
  const buf = Buffer.from(url.split(',')[1], 'base64');
  writeFileSync(join(outDir, `${n}.webp`), buf);
  console.log(n, buf.length);
}
writeFileSync(previewPng, Buffer.from(result.preview.split(',')[1], 'base64'));
console.log(
  JSON.stringify(result.pivots, (k, v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v)),
);
b.close();
setTimeout(() => process.exit(), 200);
