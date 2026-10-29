// Generates the PWA icons (Sprout: a page with a sprout on top) with no dependencies.
// Shapes are drawn as signed-distance functions and anti-aliased by supersampling.
// Run: node scripts/make-icons.ts
// Writes public/icon-192.png, icon-512.png (rounded, transparent corners), icon-maskable-512.png and
// apple-touch-icon.png (full-bleed, no transparency: the OS applies its own mask), and, when the native
// projects exist, the Android launcher icons and launch screens and the iOS icon and launch screens.
import { deflateSync } from 'node:zlib';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';

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

/** How the 512 x 512 picture is placed on a canvas. */
interface Placement {
  /** Side of the picture in canvas pixels. */
  size: number;
  /** Top-left corner of the picture on the canvas. */
  x: number;
  y: number;
  /** Cut the picture to a rounded square or a circle (the corners become transparent / canvas colour). */
  clip: 'none' | 'rounded' | 'circle';
  /** Draw the green background square. False gives only the foreground (Android adaptive icons). */
  withBackground: boolean;
  /** Canvas colour outside the picture; null = transparent. */
  canvas: Rgb | null;
  /** Samples per pixel side inside the picture (anti-aliasing); 1 for big flat canvases. */
  samples: number;
}

const rounded = roundedRect(0, 0, 512, 512, 112);
const circle: Distance = (x, y) => Math.hypot(x - 256, y - 256) - 256;

function render(width: number, height: number, p: Placement): Buffer {
  const layers = artwork();
  const clip = p.clip === 'rounded' ? rounded : p.clip === 'circle' ? circle : null;
  const scale = 512 / p.size;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  const total = p.samples * p.samples;
  for (let py = 0; py < height; py++) {
    raw[py * (width * 4 + 1)] = 0; // filter: none
    for (let px = 0; px < width; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      const inside = px >= p.x - 1 && px <= p.x + p.size && py >= p.y - 1 && py <= p.y + p.size;
      if (!inside) {
        if (p.canvas) {
          r = p.canvas[0] * total;
          g = p.canvas[1] * total;
          b = p.canvas[2] * total;
          a = total;
        }
      } else {
        for (let sy = 0; sy < p.samples; sy++) {
          for (let sx = 0; sx < p.samples; sx++) {
            const x = (px - p.x + (sx + 0.5) / p.samples) * scale;
            const y = (py - p.y + (sy + 0.5) / p.samples) * scale;
            const outsideArt = x < 0 || y < 0 || x > 512 || y > 512 || (clip && clip(x, y) > 0);
            let color: Rgb | null = outsideArt ? p.canvas : p.withBackground ? GREEN : p.canvas;
            if (!outsideArt)
              for (const layer of layers) if (layer.shape(x, y) <= 0) color = layer.color;
            if (!color) continue; // transparent sample
            r += color[0];
            g += color[1];
            b += color[2];
            a += 1;
          }
        }
      }
      const at = py * (width * 4 + 1) + 1 + px * 4;
      if (a > 0) raw.set([Math.round(r / a), Math.round(g / a), Math.round(b / a)], at);
      raw[at + 3] = Math.round((255 * a) / total);
    }
  }
  return encodePng(width, height, raw);
}

/** The picture filling a square canvas. */
function square(size: number, clip: Placement['clip']): Buffer {
  return render(size, size, {
    size,
    x: 0,
    y: 0,
    clip,
    withBackground: true,
    canvas: null,
    samples: 4,
  });
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

function encodePng(width: number, height: number, raw: Buffer): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const WHITE_CANVAS: Rgb = [0xff, 0xff, 0xff];
const out = (path: string) => new URL(`../${path}`, import.meta.url);
const write = (path: string, data: Buffer) => writeFileSync(out(path), data);

// ---- web / PWA ----
write('public/icon-192.png', square(192, 'rounded'));
write('public/icon-512.png', square(512, 'rounded'));
write('public/icon-maskable-512.png', square(512, 'none'));
write('public/apple-touch-icon.png', square(180, 'none'));

// ---- Android app (only if the project was created with `npx cap add android`) ----
const androidRes = 'android/app/src/main/res';
if (existsSync(out(androidRes))) {
  const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 } as const;
  for (const [name, factor] of Object.entries(densities)) {
    const dir = `${androidRes}/mipmap-${name}`;
    const legacy = Math.round(48 * factor); // old launchers: a finished square / round icon
    const layer = Math.round(108 * factor); // adaptive icon layer; only the middle 66 dp is always visible
    write(`${dir}/ic_launcher.png`, square(legacy, 'rounded'));
    write(`${dir}/ic_launcher_round.png`, square(legacy, 'circle'));
    const art = Math.round(layer * 0.93);
    write(
      `${dir}/ic_launcher_foreground.png`,
      render(layer, layer, {
        size: art,
        x: Math.round((layer - art) / 2),
        y: Math.round((layer - art) / 2),
        clip: 'none',
        withBackground: false,
        canvas: null,
        samples: 4,
      }),
    );
  }
  // the adaptive icon background is a colour resource
  writeFileSync(
    out(`${androidRes}/values/ic_launcher_background.xml`),
    [
      '<?xml version="1.0" encoding="utf-8"?>',
      '<resources>',
      '    <color name="ic_launcher_background">#58A83C</color>',
      '</resources>',
      '',
    ].join('\n'),
  );
  // launch screens: white with the icon in the middle, same sizes as the files they replace
  for (const entry of readdirSync(out(androidRes))) {
    if (!/^drawable(-(land|port)-[a-z]+)?$/.test(entry)) continue;
    const file = out(`${androidRes}/${entry}/splash.png`);
    if (existsSync(file)) writeSplash(file);
  }
}

// ---- iOS app (only if the project was created with `npx cap add ios`) ----
const iosAssets = 'ios/App/App/Assets.xcassets';
if (existsSync(out(iosAssets))) {
  write(`${iosAssets}/AppIcon.appiconset/AppIcon-512@2x.png`, square(1024, 'none'));
  for (const name of readdirSync(out(`${iosAssets}/Splash.imageset`))) {
    if (name.endsWith('.png')) writeSplash(out(`${iosAssets}/Splash.imageset/${name}`));
  }
}

/** Replaces a launch image by a white one of the same size with the icon in the middle. */
function writeSplash(file: URL): void {
  const header = readFileSync(file);
  const width = header.readUInt32BE(16);
  const height = header.readUInt32BE(20);
  const size = Math.round(Math.min(width, height) * 0.28);
  writeFileSync(
    file,
    render(width, height, {
      size,
      x: Math.round((width - size) / 2),
      y: Math.round((height - size) / 2),
      clip: 'rounded',
      withBackground: true,
      canvas: WHITE_CANVAS,
      samples: 2,
    }),
  );
}

console.log('icons written');
