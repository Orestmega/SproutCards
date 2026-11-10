// Usage: node scripts/mascot/cut.mjs design/mascot/sprout.png <out.png> <grid.png>
// Step 1: remove the white background (flood fill from the edges + soft matting), crop to a square.
import { readFileSync, writeFileSync } from 'node:fs';
import { launchChrome } from '../browser/lib.mjs';

const [src, outPng, gridPng] = process.argv.slice(2);
const data = 'data:image/png;base64,' + readFileSync(src).toString('base64');
const b = await launchChrome({ width: 800, height: 800 });
await b.goto('about:blank', 300);
await b.evalJs(`window.SRC = ${JSON.stringify(data)}; 1`);
const result = await b.evalJs(`(async () => {
  const img = new Image();
  img.src = SRC;
  await img.decode();
  const W = img.naturalWidth, H = img.naturalHeight;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, W, H); const p = d.data;
  // background: light and nearly grey, connected to the border
  const light = (i) => { const r = p[i], gg = p[i+1], bb = p[i+2]; const mn = Math.min(r, gg, bb), mx = Math.max(r, gg, bb); return mn > 120 && mx - mn < 40; };
  const bg = new Uint8Array(W * H);
  const stack = [];
  for (let x = 0; x < W; x++) { stack.push(x, (H - 1) * W + x); }
  for (let y = 0; y < H; y++) { stack.push(y * W, y * W + W - 1); }
  while (stack.length) {
    const k = stack.pop();
    if (bg[k] || !light(k * 4)) continue;
    bg[k] = 1;
    const x = k % W, y = (k / W) | 0;
    if (x > 0) stack.push(k - 1); if (x < W - 1) stack.push(k + 1);
    if (y > 0) stack.push(k - W); if (y < H - 1) stack.push(k + W);
  }
  // matting: background pixels get alpha from how far they are from white (keeps the soft shadow and edges)
  let minX = W, minY = H, maxX = 0, maxY = 0;
  for (let k = 0; k < W * H; k++) {
    const i = k * 4;
    if (bg[k]) {
      const mn = Math.min(p[i], p[i+1], p[i+2]);
      // shadow and soft edges: treated as dark ink over white, so they stay dark on any background
      let a = (252 - mn) / 252;
      a = Math.max(0, Math.min(1, a));
      if (a < 0.04) { p[i+3] = 0; continue; }
      for (let j = 0; j < 3; j++) p[i+j] = Math.max(0, Math.min(255, (p[i+j] - 255 * (1 - a)) / a));
      p[i+3] = Math.round(a * 255);
    }
    if (p[i+3] > 20) { const x = k % W, y = (k / W) | 0; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  }
  g.putImageData(d, 0, 0);
  // a square around the picture with a little margin
  const side = Math.max(maxX - minX, maxY - minY) + 24;
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const S = 960;
  const out = document.createElement('canvas'); out.width = S; out.height = S;
  out.getContext('2d').drawImage(c, cx - side / 2, cy - side / 2, side, side, 0, 0, S, S);
  window.CUT = out;
  // a preview with a grid every 10 units of 120, to read coordinates from
  const grid = document.createElement('canvas'); grid.width = S; grid.height = S;
  const gg = grid.getContext('2d'); gg.fillStyle = '#ffd0ff'; gg.fillRect(0, 0, S, S); gg.drawImage(out, 0, 0);
  gg.strokeStyle = 'rgba(0,0,255,.35)'; gg.fillStyle = 'blue'; gg.font = '16px sans-serif';
  for (let u = 0; u <= 120; u += 10) { const v = u * S / 120; gg.beginPath(); gg.moveTo(v, 0); gg.lineTo(v, S); gg.moveTo(0, v); gg.lineTo(S, v); gg.stroke(); gg.fillText(String(u), v + 2, 16); gg.fillText(String(u), 2, v - 2); }
  return { W, H, box: [minX, minY, maxX, maxY], side, png: out.toDataURL('image/png'), grid: grid.toDataURL('image/png') };
})()`);
if (result.error) {
  console.error(result.error);
  process.exit(1);
}
writeFileSync(outPng, Buffer.from(result.png.split(',')[1], 'base64'));
writeFileSync(gridPng, Buffer.from(result.grid.split(',')[1], 'base64'));
console.log(result.W, result.H, result.box, result.side);
b.close();
setTimeout(() => process.exit(), 200);
