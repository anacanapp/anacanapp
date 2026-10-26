import { readFile, readdir, rm, unlink, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const artifacts = join(root, 'artifacts');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const app4 = join(artifacts, 'native-world-ios-build4/Build/Products/Debug-iphoneos/Mommy3D.app');
execFileSync('codesign', ['--verify', '--deep', '--strict', app4], { stdio: 'pipe' });
const proof = JSON.parse(await readFile(join(artifacts, 'native-world-ios-device-acceptance.json'), 'utf8'));
if (hash(await readFile(join(app4, 'Mommy3D'))) !== proof.executableSHA256) throw new Error('Prior accepted game must be intact');
let reclaimed = 0;
for (const [library, source] of [
  ['libgodot.a', 'native-world-ios/Mommy3D.xcframework/ios-arm64/libgodot.a'],
  ['libMoltenVK.a', 'native-world-ios/MoltenVK.xcframework/ios-arm64/libMoltenVK.a'],
]) {
  const path = join(artifacts, 'native-world-ios-build4/Build/Products/Debug-iphoneos', library);
  try {
    const bytes = await readFile(path), original = await readFile(join(artifacts, source));
    if (hash(bytes) !== hash(original)) throw new Error(`Reproducible build library mismatch: ${library}`);
    await unlink(path); reclaimed += bytes.length;
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
async function bytes(path) {
  const info = await stat(path); if (!info.isDirectory()) return info.size;
  let size = 0; for (const name of await readdir(path)) size += await bytes(join(path, name)); return size;
}
for (const path of ['ios-luzern-build3/ModuleCache.noindex', 'ios-luzern-build3/Index.noindex', 'native-world-ios-build4/ModuleCache.noindex', 'native-world-ios-build4/Index.noindex',
  'ios-build/ModuleCache.noindex', 'ios-build/Index.noindex', 'ios-build-v2/ModuleCache.noindex', 'ios-build-v2/Index.noindex',
  'ios-simulator-v2/ModuleCache.noindex', 'ios-simulator-v2/Index.noindex']) {
  const cache = join(artifacts, path);
  try { const size = await bytes(cache); await rm(cache, { recursive: true }); reclaimed += size; }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
console.log(`Reclaimed ${Math.round(reclaimed / 1048576)} MiB of verified duplicate libraries and this game's generated IDE caches.`);
