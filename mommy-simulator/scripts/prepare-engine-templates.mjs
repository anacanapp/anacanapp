import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const directory = join(root, 'artifacts/engine/templates'); await mkdir(directory, { recursive: true });
const url = 'https://github.com/godotengine/godot/releases/download/4.7.2-stable/Godot_v4.7.2-stable_export_templates.tpz';
const redirected = await fetch(url, { redirect: 'manual' });
const location = redirected.headers.get('location'); if (!location) throw new Error('Template release redirect missing');
async function range(start, end) {
  const response = await fetch(location, { headers: { Range: `bytes=${start}-${end}` } });
  if (response.status !== 206) throw new Error(`Template range HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}
const tail = await range(1281349702 - 65536, 1281349701);
let eocd = -1;
for (let index = tail.length - 22; index >= 0; index--) if (tail.readUInt32LE(index) === 0x06054b50) { eocd = index; break; }
if (eocd < 0) throw new Error('Template ZIP directory missing');
const offset = tail.readUInt32LE(eocd + 16), size = tail.readUInt32LE(eocd + 12), central = await range(offset, offset + size - 1);
const selected = new Set(['templates/ios.zip', 'templates/web_nothreads_debug.zip', 'templates/web_nothreads_release.zip']);
const records = [];
const crcTable = Array.from({ length: 256 }, (_, index) => { let value = index; for (let bit = 0; bit < 8; bit++) value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1; return value >>> 0; });
const crc32 = bytes => { let crc = 0xffffffff; for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0; };
for (let index = 0; index + 46 <= central.length;) {
  if (central.readUInt32LE(index) !== 0x02014b50) throw new Error('Unexpected template ZIP directory');
  const names = central.readUInt16LE(index + 28), extra = central.readUInt16LE(index + 30), comment = central.readUInt16LE(index + 32);
  const name = central.subarray(index + 46, index + 46 + names).toString();
  if (selected.has(name)) {
    const checksum = central.readUInt32LE(index + 16), length = central.readUInt32LE(index + 20), uncompressed = central.readUInt32LE(index + 24), at = central.readUInt32LE(index + 42);
    const destination = join(directory, name.split('/').at(-1));
    let bytes; try { bytes = await readFile(destination); } catch {}
    if (!bytes || bytes.length !== uncompressed || crc32(bytes) !== checksum) {
      const header = await range(at, at + 29), payload = at + 30 + header.readUInt16LE(26) + header.readUInt16LE(28);
      bytes = inflateRawSync(await range(payload, payload + length - 1));
      if (bytes.length !== uncompressed || crc32(bytes) !== checksum) throw new Error(`Template CRC/length mismatch: ${name}`);
      await writeFile(destination, bytes);
    }
    records.push({ name, bytes: bytes.length, crc32: checksum.toString(16), sha256: createHash('sha256').update(bytes).digest('hex') });
    console.log(`${name}: ${bytes.length} bytes verified`);
  }
  index += 46 + names + extra + comment;
}
if (records.length !== selected.size) throw new Error('Required templates missing');
await writeFile(join(directory, 'provenance.json'), JSON.stringify({ source: url, version: '4.7.2.stable', partialDownload: true, files: records }, null, 2) + '\n');
