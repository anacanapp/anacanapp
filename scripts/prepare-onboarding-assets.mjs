import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const [project] = process.argv.slice(2);
if (!project || process.argv.length !== 3) throw new Error('DESIGN_PROJECT_DIRECTORY_REQUIRED');
const output = fileURLToPath(new URL('../src/assets/onboarding/', import.meta.url));
const poses = ['mode','name','data','q1','q2','q3','q4','q5','sproof','privacy','value','analysis','results','proof','paywall','exit','freemode','success'];
const manifest = [];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
for (const [mode, id] of [['cycle','C01'], ['pregnancy','C02'], ['mother','C03']]) {
  for (const pose of ['welcome', ...poses]) {
    const source = pose === 'welcome' ? `generated/1789120948745-b3ce2027/${id}-cutout.png` : `generated/onboarding-poses/${mode}-${pose}.png`;
    const original = await readFile(join(project, source));
    const { data, info } = await sharp(original).resize({ width: 512, height: 512, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 83, alphaQuality: 95, effort: 5 }).toBuffer({ resolveWithObject: true });
    const file = `${mode}-${pose}.webp`;
    await writeFile(join(output, file), data);
    manifest.push({ file, source, sourceSha256: hash(original), sha256: hash(data), bytes: data.length, width: info.width, height: info.height });
  }
}
await writeFile(join(output, 'manifest.json'), JSON.stringify({ schema: 'anacan-onboarding-assets-v1', files: manifest }, null, 2) + '\n');
console.log(JSON.stringify({ files: manifest.length, bytes: manifest.reduce((sum, file) => sum + file.bytes, 0) }));
