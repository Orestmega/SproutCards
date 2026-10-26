// Generates the PWA icons (Sprout: a page with a sprout on top) with no dependencies.
// Shapes are drawn as signed-distance functions and anti-aliased by supersampling.
// Run: node scripts/make-icons.ts
// Writes public/icon-192.png, icon-512.png (rounded, transparent corners), icon-maskable-512.png and
// apple-touch-icon.png (full-bleed, no transparency: the OS applies its own mask).
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

type Rgb = readonly [number, number, number];
type Distance = (x: number, y: number) => number; // < 0 inside the shape

const GREEN: Rgb = [0x58, 0xa8, 0x3c];
const DARK_GREEN: Rgb = [0x24, 0x59, 0x1a];
const LIGHT_LEAF: Rgb = [0xe6, 0xf3, 0xdf];
const WHITE: Rgb = [0xff, 0xff, 0xff];
const LINE: Rgb = [0xb9, 0xc9, 0xb0];

function roundedRect(x0: number, y0: number, x1: number, y1: number, r: number): Distance {
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const hx = (x1 - x0) / 2 - r;
  const hy = (y1 - y0) / 2 - r;
  return (x, y) => {
    const qx = Math.abs(x - cx) - hx;
    const qy = Math.abs(y - cy) - hy;
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
  };
}

function segment(ax: number, ay: number, bx: number, by: number, width: number): Distance {
  return (x, y) => {
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(x - (ax + t * dx), y - (ay + t * dy)) - width / 2;
  };
}

/** Leaf: the lens where two circles overlap (a pointed oval), from `base` to `tip`. */
function leaf(bx: number, by: number, tx: number, ty: number, bulge: number): Distance {
  const mx = (bx + tx) / 2;
  const my = (by + ty) / 2;
  const len = Math.hypot(tx - bx, ty - by);
  const nx = -(ty - by) / len;
  const ny = (tx - bx) / len;
  const half = len / 2;
  const radius = (half * half + bulge * bulge) / (2 * bulge);
  const off = radius - bulge;
  return (x, y) =>
    Math.max(
      Math.hypot(x - (mx + nx * off), y - (my + ny * off)) - radius,
      Math.hypot(x - (mx - nx * off), y - (my - ny * off)) - radius,
    );
}

interface Layer {
  shape: Distance;
  color: Rgb;
}

/** The picture on a 512 x 512 canvas; everything important stays inside the maskable safe zone. */
function artwork(): Layer[] {
  return [
    { shape: segment(256, 214, 256, 150, 14), color: DARK_GREEN },
    { shape: leaf(256, 152, 372, 98, 32), color: LIGHT_LEAF },
    { shape: leaf(256, 164, 142, 112, 28), color: DARK_GREEN },
    { shape: roundedRect(132, 206, 380, 418, 30), color: DARK_GREEN },
    { shape: roundedRect(140, 214, 372, 410, 24), color: WHITE },
    { shape: segment(180, 268, 332, 268, 14), color: LINE },
    { shape: segment(180, 312, 332, 312, 14), color: LINE },
    { shape: segment(180, 356, 280, 356, 14), color: LINE },
  ];
}

const SAMPLES = 4; // 4 x 4 samples per pixel

function render(size: number, rounded: boolean): Buffer {
  const scale = 512 / size;
  const layers = artwork();
  const corners = roundedRect(0, 0, 512, 512, 112);
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let py = 0; py < size; py++) {
    raw[py * (size * 4 + 1)] = 0; // filter: none
    for (let px = 0; px < size; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const x = (px + (sx + 0.5) / SAMPLES) * scale;
          const y = (py + (sy + 0.5) / SAMPLES) * scale;
          if (rounded && corners(x, y) > 0) continue; // transparent corner
          let color = GREEN;
          for (const layer of layers) if (layer.shape(x, y) <= 0) color = layer.color;
          r += color[0];
          g += color[1];
          b += color[2];
          a += 1;
        }
      }
      const at = py * (size * 4 + 1) + 1 + px * 4;
      if (a > 0) raw.set([Math.round(r / a), Math.round(g / a), Math.round(b / a)], at);
      raw[at + 3] = Math.round((255 * a) / (SAMPLES * SAMPLES));
    }
  }
  return encodePng(size, raw);
}

function crc32(buf: Buffer): number {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return ~c >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size: number, raw: Buffer): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const out = (name: string) => new URL(`../public/${name}`, import.meta.url);
writeFileSync(out('icon-192.png'), render(192, true));
writeFileSync(out('icon-512.png'), render(512, true));
writeFileSync(out('icon-maskable-512.png'), render(512, false));
writeFileSync(out('apple-touch-icon.png'), render(180, false));
console.log('icons written');
