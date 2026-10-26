import { readFile, link, rename, stat, unlink, readdir, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const artifacts = join(root, 'artifacts');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
let reclaimed = 0;
for (const [library, source] of [
  ['libgodot.a', 'native-world-ios/Mommy3D.xcframework/ios-arm64/libgodot.a'],
  ['libMoltenVK.a', 'native-world-ios/MoltenVK.xcframework/ios-arm64/libMoltenVK.a'],
]) {
  const original = join(artifacts, source), info = await stat(original);
  for (const relative of [`native-world-ios-build5-source/${library === 'libgodot.a' ? 'Mommy3D' : 'MoltenVK'}.xcframework/ios-arm64/${library}`,
    `native-world-ios-build5/Build/Products/Debug-iphoneos/${library}`]) {
    const destination = join(artifacts, relative), target = await stat(destination);
    if (target.ino === info.ino) continue;
    if (hash(await readFile(original)) !== hash(await readFile(destination))) throw new Error(`Cache library mismatch: ${relative}`);
    const temporary = destination + '.deduplicated';
    await link(original, temporary);
    await rename(temporary, destination);
    reclaimed += target.size;
  }
}
// This candidate's object/IDE caches are reproducible; signed prior game apps stay in place.
const cache = join(artifacts, 'native-world-ios-build5/ModuleCache.noindex');
async function size(path) {
  const info = await stat(path); if (!info.isDirectory()) return info.size;
  let total = 0; for (const name of await readdir(path)) total += await size(join(path, name)); return total;
}
try { const bytes = await size(cache); await rm(cache, { recursive: true }); reclaimed += bytes; }
catch (error) { if (error.code !== 'ENOENT') throw error; }
console.log(`Native duplicate/cache consolidation: ${Math.round(reclaimed / 1048576)} MiB`);
