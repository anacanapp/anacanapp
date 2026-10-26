import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const directory = join(root, 'assets/fonts');
await mkdir(directory, { recursive: true });
const sources = [
  ['Manrope.ttf', 'https://raw.githubusercontent.com/google/fonts/main/ofl/manrope/Manrope%5Bwght%5D.ttf'],
  ['Manrope-OFL.txt', 'https://raw.githubusercontent.com/google/fonts/main/ofl/manrope/OFL.txt'],
  ['BarlowCondensed-SemiBold.ttf', 'https://raw.githubusercontent.com/google/fonts/main/ofl/barlowcondensed/BarlowCondensed-SemiBold.ttf'],
  ['BarlowCondensed-OFL.txt', 'https://raw.githubusercontent.com/google/fonts/main/ofl/barlowcondensed/OFL.txt'],
  ['NotoSans.ttf', 'https://raw.githubusercontent.com/google/fonts/main/ofl/notosans/NotoSans%5Bwdth,wght%5D.ttf'],
  ['NotoSans-OFL.txt', 'https://raw.githubusercontent.com/google/fonts/main/ofl/notosans/OFL.txt'],
];
const records = [];
for (const [name, url] of sources) {
  const destination = join(directory, name);
  let bytes;
  try { bytes = await readFile(destination); } catch {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Font asset ${name}: HTTP ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
    if (name.endsWith('.ttf') && (bytes.length < 10000 || ![0x00010000, 0x4f54544f].includes(bytes.readUInt32BE(0)))) throw new Error(`Invalid font: ${name}`);
    if (name.endsWith('.txt') && !bytes.toString().includes('SIL OPEN FONT LICENSE')) throw new Error(`Missing OFL: ${name}`);
    await writeFile(destination, bytes);
  }
  records.push({ file: `assets/fonts/${name}`, source: url, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), license: 'SIL Open Font License 1.1' });
}
await writeFile(join(root, 'assets/provenance.json'), JSON.stringify({
  artwork: 'Original procedural/vector illustrations in scripts/character.gd, platform.gd, icon.gd and assets/icons/metro.svg.',
  audio: 'Original synthesized PCM effects in scripts/audio.gd.',
  fonts: records,
}, null, 2) + '\n');
console.log('METRO assets ready: original commuter art + licensed fonts with Azerbaijani fallback.');
