// Tiny deterministic PNG encoder for placeholder images (avatars, covers, product photos).
// Every unknown image URL maps to a soft two-tone tile whose colours derive from the URL hash,
// so the same URL always renders the same pixels and different images stay distinguishable.
import { createHash } from 'node:crypto';
import { deflateSync, crc32 } from 'node:zlib';

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([len, body, crc]);
}

export function encodePng(width, height, pixel) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixel(x, y);
      raw[row + 1 + x * 3] = r; raw[row + 2 + x * 3] = g; raw[row + 3 + x * 3] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const cache = new Map();
/** Pastel diagonal two-tone tile, 96x96, keyed by the URL path (query ignored). */
export function placeholderPng(key) {
  if (cache.has(key)) return cache.get(key);
  const h = createHash('sha256').update(key).digest();
  const pastel = (i) => [180 + (h[i] % 60), 170 + (h[i + 1] % 70), 175 + (h[i + 2] % 65)];
  const a = pastel(0), b = pastel(3);
  const png = encodePng(96, 96, (x, y) => (x + y < 96 ? a : b));
  cache.set(key, png);
  return png;
}
