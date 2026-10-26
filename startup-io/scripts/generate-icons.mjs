import { readFile, writeFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = await readFile(path.join(root, 'public/icon.svg'));
const files = [
  ['public/icon-192.png', 192], ['public/icon-512.png', 512],
  ['ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', 1024],
  ['android/app/src/main/res/mipmap-mdpi/ic_launcher.png', 48],
  ['android/app/src/main/res/mipmap-hdpi/ic_launcher.png', 72],
  ['android/app/src/main/res/mipmap-xhdpi/ic_launcher.png', 96],
  ['android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png', 144],
  ['android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png', 192],
];
let generated = 0;
for (const [relative, size] of files) {
  const target = path.join(root, relative);
  try { await access(path.dirname(target)); } catch { continue; }
  await writeFile(target, await sharp(source).resize(size, size).flatten({ background: '#080f1c' }).png().toBuffer());
  generated++;
  if (relative.startsWith('android/')) {
    for (const name of ['ic_launcher_round.png', 'ic_launcher_foreground.png']) {
      await writeFile(path.join(path.dirname(target), name), await sharp(source).resize(size, size).flatten({ background: '#080f1c' }).png().toBuffer());
    }
  }
}
console.log(`Generated ${generated} startup.io icon sizes.`);
