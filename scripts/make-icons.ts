// Generates temporary placeholder PWA icons (solid green + white "page" + leaf) with no dependencies.
// Run: node scripts/make-icons.ts
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

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

function makePng(size: number): Buffer {
  const green = [0x58, 0xa8, 0x3c];
  const white = [0xff, 0xff, 0xff];
  const leaf = [0x3f, 0x8a, 0x2a];
  const raw = Buffer.alloc((size * 3 + 1) * size);
  const s = size / 512;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      let px = green;
      // white rounded "page" in the middle (kept inside the maskable safe zone)
      const inPage = x > 150 * s && x < 362 * s && y > 190 * s && y < 392 * s;
      if (inPage) px = white;
      // leaf: circle sprouting from the top of the page
      const dx = x - 256 * s;
      const dy = y - 150 * s;
      if (dx * dx + dy * dy < (50 * s) ** 2) px = leaf;
      raw.set(px, y * (size * 3 + 1) + 1 + x * 3);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const size of [192, 512]) {
  writeFileSync(new URL(`../public/icon-${size}.png`, import.meta.url), makePng(size));
}
console.log('icons written');
