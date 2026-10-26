import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = fileURLToPath(new URL('../', import.meta.url));
const directory = join(root, 'godot/assets/details');
await mkdir(directory, { recursive: true });
const files = [];
async function output(name, bytes, origin) {
  await writeFile(join(directory, name), bytes);
  files.push({ file: name, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), origin });
}
const leaf = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="128" height="256" viewBox="0 0 128 256">
<defs><linearGradient id="l"><stop stop-color="#4d663e"/><stop offset=".48" stop-color="#b1ba78"/><stop offset="1" stop-color="#5b753d"/></linearGradient></defs>
<path fill="url(#l)" d="M64 4C10 54 5 141 64 240C123 141 118 54 64 4Z"/>
<path fill="none" stroke="#d0ce8c" stroke-width="2.1" d="M64 13V255M64 64L34 90M64 91L22 123M64 122L23 149M64 150L33 176M64 179L47 198M64 65L95 91M64 93L106 122M64 123L104 150M64 152L95 178M64 180L80 199" opacity=".6"/></svg>`);
await output('leaf.png', await sharp(leaf).png().toBuffer(), 'Original leaf-card artwork with alpha, generated for this game');
await output('alpine-print.jpg', await sharp(await readFile(join(root, 'public/assets/luzern/alpine-window.webp'))).resize(640, 480, { fit: 'cover' }).jpeg({ quality: 86 }).toBuffer(), 'Existing Mommy Simulator alpine artwork');

// Subtle woven relief with correctly encoded tangent-space normals.
const size = 256, normal = Buffer.alloc(size * size * 3);
for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
  const at = (y * size + x) * 3;
  normal[at] = Math.round(128 + Math.sin(x * Math.PI / 3) * 13);
  normal[at + 1] = Math.round(128 + Math.sin(y * Math.PI / 3) * 13);
  normal[at + 2] = 254;
}
await output('cotton-normal.png', await sharp(normal, { raw: { width: size, height: size, channels: 3 } }).png().toBuffer(), 'Original procedural woven-cotton normal map');

// Original short foley, with no external recordings or private inputs.
function wav(kind) {
  const rate = 22050, seconds = kind === 'step' ? .16 : .08, samples = Math.floor(rate * seconds);
  const bytes = Buffer.alloc(44 + samples * 2);
  bytes.write('RIFF'); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(rate, 24); bytes.writeUInt32LE(rate * 2, 28); bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36); bytes.writeUInt32LE(samples * 2, 40);
  let seed = 1231, filtered = 0;
  for (let n = 0; n < samples; n++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    filtered = filtered * .62 + (seed / 4294967296 * 2 - 1) * .38;
    const t = n / rate, envelope = Math.exp(-t * (kind === 'step' ? 31 : 66));
    const signal = kind === 'step' ? (filtered * .28 + Math.sin(t * 420) * .1) : Math.sin(t * 3700) * .15;
    bytes.writeInt16LE(Math.round(signal * envelope * 26000), 44 + n * 2);
  }
  return bytes;
}
await output('step.wav', wav('step'), 'Original synthesized quiet footstep foley');
await output('object-tap.wav', wav('tap'), 'Original synthesized ceramic/wood interaction foley');
const fontURL = 'https://raw.githubusercontent.com/google/fonts/main/ofl/manrope/Manrope%5Bwght%5D.ttf';
const response = await fetch(fontURL);
if (!response.ok) throw new Error('Manrope font download failed');
await output('Manrope.ttf', Buffer.from(await response.arrayBuffer()), fontURL);
const licenseURL = 'https://raw.githubusercontent.com/google/fonts/main/ofl/manrope/OFL.txt';
const license = await fetch(licenseURL);
if (!license.ok) throw new Error('Manrope font license missing');
await output('FONT_LICENSE.txt', Buffer.from(await license.arrayBuffer()), licenseURL);
await writeFile(join(directory, 'provenance.json'), JSON.stringify({ name: 'Mommy Simulator world details', files }, null, 2) + '\n');
console.log('World-detail artwork, woven normals and original foley prepared.');
