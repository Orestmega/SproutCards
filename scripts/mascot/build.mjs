// Usage: node scripts/mascot/build.mjs <cut.png from cut.mjs> src/assets/mascot <preview.png>
// Makes the mascot pictures from the transparent picture (960 px = 120 units):
//   sprout.webp        the picture as it is (closed, smiling eyes and an open smile)
//   sprout-noeyes.webp the eyes painted over with the body's colours (open eyes are drawn in SVG)
//   sprout-blank.webp  the eyes and the mouth painted over (every face is drawn in SVG)
// The body is made 4 % taller (it looked squashed) and the page and sprout move up with its top; then the
// whole picture is scaled to 97 % so it still fits the square. One picture per face, so nothing comes apart.
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
  const base = document.createElement('canvas'); base.width = S; base.height = S;
  base.getContext('2d').drawImage(img, 0, 0);
  const original = base.getContext('2d').getImageData(0, 0, S, S);

  // paint a box over with the body's colours: each column blends from the row above to the row below,
  // then the edge of the box is softened so it melts into the body
  const paint = (d, [x0, y0, x1, y1]) => {
    const p = d.data;
    const X0 = Math.round(x0 * U), X1 = Math.round(x1 * U), Y0 = Math.round(y0 * U), Y1 = Math.round(y1 * U);
    const at = (x, y) => (y * S + x) * 4;
    const filled = new Float32Array((X1 - X0 + 1) * (Y1 - Y0 + 1) * 3);
    for (let x = X0; x <= X1; x++) {
      // average a few pixels above and below, so one odd pixel does not streak down the column
      const avg = (y, dir) => { const s = [0, 0, 0]; for (let k = 1; k <= 4; k++) { const i = at(x, y + dir * k); for (let j = 0; j < 3; j++) s[j] += p[i + j] / 4; } return s; };
      const top = avg(Y0, -1), bottom = avg(Y1, 1);
      for (let y = Y0; y <= Y1; y++) {
        const t = (y - Y0) / (Y1 - Y0);
        for (let j = 0; j < 3; j++) filled[((x - X0) * (Y1 - Y0 + 1) + (y - Y0)) * 3 + j] = top[j] * (1 - t) + bottom[j] * t;
      }
    }
    // a gentle horizontal blur of the filled colours (columns can differ a little)
    const w = X1 - X0 + 1, h = Y1 - Y0 + 1, R = 6;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const s = [0, 0, 0]; let n = 0;
      for (let k = -R; k <= R; k++) { const xx = Math.min(w - 1, Math.max(0, x + k)); for (let j = 0; j < 3; j++) s[j] += filled[(xx * h + y) * 3 + j]; n++; }
      // feather: full paint inside, fading over the last 8 px of the box
      const edge = Math.min(x, y, w - 1 - x, h - 1 - y), f = Math.min(1, edge / 8);
      const i = at(X0 + x, Y0 + y);
      for (let j = 0; j < 3; j++) p[i + j] = p[i + j] * (1 - f) + (s[j] / n) * f;
    }
  };
  const clone = (d) => new ImageData(new Uint8ClampedArray(d.data), d.width, d.height);
  const EYES = [[35.5, 65, 56.5, 77], [63.5, 65, 84.5, 77]];
  const MOUTH = [45.5, 81, 74.5, 96.5];
  const noEyes = clone(original); EYES.forEach((box) => paint(noEyes, box));
  const blank = clone(noEyes); paint(blank, MOUTH);

  // the body: an ellipse in units; its outline ring stays with the body
  const E = { cx: 60, cy: 76.5, rx: 38.6, ry: 33.6 };
  const dist = (x, y) => Math.sqrt(((x - E.cx) / E.rx) ** 2 + ((y - E.cy) / E.ry) ** 2);
  const K = 1.04, BOTTOM = 109.5, TOP = 43.2, SHIFT = (K - 1) * (BOTTOM - TOP), G = 0.97, OUT = 480;
  const build = (d) => {
    // split: the page and the sprout (above the body) move up; everything else is stretched
    const top = new ImageData(S, S), body = new ImageData(S, S);
    for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
      const i = (py * S + px) * 4; if (!d.data[i + 3]) continue;
      const x = (px + 0.5) / U, y = (py + 0.5) / U, dd = dist(x, y);
      const put = (t) => { for (let j = 0; j < 4; j++) t.data[i + j] = d.data[i + j]; };
      const above = y < 56 && x > 33 && x < 87;
      if (dd > 1 + 1.8 / E.ry && above) put(top);
      else {
        put(body);
        // a copy of the body's edge under it, so no seam shows where the two parts meet
        if (above && dd >= 1 - 1.5 / E.ry) put(top);
      }
    }
    const o = document.createElement('canvas'); o.width = OUT; o.height = OUT;
    const og = o.getContext('2d'); og.imageSmoothingQuality = 'high';
    const f = OUT / 120, tmp = document.createElement('canvas'); tmp.width = S; tmp.height = S;
    const place = (layer, tall) => {
      tmp.getContext('2d').clearRect(0, 0, S, S); tmp.getContext('2d').putImageData(layer, 0, 0);
      const mapY = (y) => 60 + G * ((tall ? BOTTOM - K * (BOTTOM - y) : y - SHIFT) - 60);
      const mapX = (x) => 60 + G * (x - 60);
      og.drawImage(tmp, 0, 0, S, S, mapX(0) * f, mapY(0) * f, (mapX(120) - mapX(0)) * f, (mapY(120) - mapY(0)) * f);
    };
    place(top, false);
    place(body, true);
    return o;
  };
  const pictures = { sprout: build(original), 'sprout-noeyes': build(noEyes), 'sprout-blank': build(blank) };
  const out = Object.fromEntries(Object.entries(pictures).map(([n, c]) => [n, c.toDataURL('image/webp', 0.92)]));
  // preview: the three side by side, on pink and on dark green
  const pv = document.createElement('canvas'); pv.width = OUT * 3; pv.height = OUT * 2;
  const pg = pv.getContext('2d');
  pg.fillStyle = '#ffd0ff'; pg.fillRect(0, 0, OUT * 3, OUT); pg.fillStyle = '#1d3a24'; pg.fillRect(0, OUT, OUT * 3, OUT);
  Object.values(pictures).forEach((c, i) => { pg.drawImage(c, i * OUT, 0); pg.drawImage(c, i * OUT, OUT); });
  // where the face goes after the stretch, for the SVG faces
  const mapY = (y) => 60 + G * (BOTTOM - K * (BOTTOM - y) - 60), mapX = (x) => 60 + G * (x - 60);
  const face = { eyeLeft: [mapX(46), mapY(71)], eyeRight: [mapX(74), mapY(71)], mouthTop: mapY(83), mouthBottom: mapY(94.5), mouthX: [mapX(48), mapX(72)] };
  return { out, preview: pv.toDataURL('image/png'), face };
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
console.log(JSON.stringify(result.face, (k, v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v)));
b.close();
setTimeout(() => process.exit(), 200);
