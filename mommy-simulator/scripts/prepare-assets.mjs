import { mkdir, readFile, copyFile, writeFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import sharp from 'sharp';

const root = fileURLToPath(new URL('../', import.meta.url));
const assets = join(root, 'public/assets');
await mkdir(assets, { recursive: true });
const mark = await readFile(join(assets, 'mark.svg'));
for (const size of [192, 512, 1024]) {
  await sharp(mark).resize(size, size).png().toFile(join(assets, `icon-${size}.png`));
}
await copyFile(join(root, '../src/assets/onboarding/pregnancy-welcome.webp'), join(assets, 'anacan-bump.webp'));
await copyFile(join(root, '../src/assets/onboarding/mother-welcome.webp'), join(assets, 'anacan-mom.webp'));
if (await stat(join(root, 'ios/App/App/Assets.xcassets')).catch(() => null)) {
  const icon = join(root, 'ios/App/App/Assets.xcassets/AppIcon.appiconset');
  await mkdir(icon, { recursive: true });
  await copyFile(join(assets, 'icon-1024.png'), join(icon, 'AppIcon-512@2x.png'));
  await writeFile(join(icon, 'Contents.json'), JSON.stringify({ images: [{ filename: 'AppIcon-512@2x.png', idiom: 'universal', platform: 'ios', size: '1024x1024' }], info: { author: 'xcode', version: 1 } }, null, 2));
  const splash = `<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732" viewBox="0 0 2732 2732"><rect width="2732" height="2732" fill="#edf0e4"/><g transform="translate(1126 1126) scale(4)">${mark.toString().replace(/<svg[^>]+>/, '').replace('</svg>', '')}</g></svg>`;
  const directory = join(root, 'ios/App/App/Assets.xcassets/Splash.imageset');
  await mkdir(directory, { recursive: true });
  for (const name of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) await sharp(Buffer.from(splash)).png().toFile(join(directory, name));
}
if (await stat(join(root, 'android/app/src/main/res')).catch(() => null)) {
  for (const [density, size] of Object.entries({ mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 })) {
    const directory = join(root, `android/app/src/main/res/mipmap-${density}`); await mkdir(directory, { recursive: true });
    for (const name of ['ic_launcher.png', 'ic_launcher_round.png']) await sharp(mark).resize(size, size).png().toFile(join(directory, name));
    await sharp(mark).resize(Math.round(size * 1.5), Math.round(size * 1.5)).extend({ top: Math.round(size * .375), bottom: Math.round(size * .375), left: Math.round(size * .375), right: Math.round(size * .375), background: '#edf0e4' }).png().toFile(join(directory, 'ic_launcher_foreground.png'));
  }
}
console.log('Mommy Simulator: app icons, native launch artwork and the two Anacan companions prepared.');
