import { readFile, writeFile, stat, unlink, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const directory = join(root, 'artifacts/engine/templates');
await mkdir(directory, { recursive: true });
const original = join(directory, 'ios.zip'), subset = join(directory, 'ios-device.zip');
try { await stat(original); } catch (error) {
  if (error.code !== 'ENOENT') throw error;
  const proof = JSON.parse(await readFile(join(directory, 'ios-device-provenance.json'), 'utf8'));
  const bytes = await readFile(subset);
  if (createHash('sha256').update(bytes).digest('hex') !== proof.sha256) throw new Error('Device template checksum mismatch');
  console.log('Existing verified arm64 device template ready.');
  process.exit(0);
}
// Same official engine; retain only the debug iOS device slices needed for this build.
execFileSync('python3', ['-c', `import zipfile,sys,plistlib
source,out=sys.argv[1:]
with zipfile.ZipFile(source) as z,zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as result:
 for name in z.namelist():
  if name.startswith(('libgodot.ios.release.', 'libgodot_camera.', 'libgodot.visionos.')) or '-simulator/' in name: continue
  data=z.read(name)
  if name.endswith('.xcframework/Info.plist'):
   obj=plistlib.loads(data)
   obj['AvailableLibraries']=[item for item in obj.get('AvailableLibraries',[]) if item.get('SupportedPlatform')=='ios' and item.get('SupportedPlatformVariant')!='simulator']
   data=plistlib.dumps(obj)
  result.writestr(name,data)
`, original, subset], { stdio: 'pipe' });
const bytes = await readFile(subset);
await writeFile(join(directory, 'ios-device-provenance.json'), JSON.stringify({ source: 'https://github.com/godotengine/godot/releases/download/4.7.2-stable/Godot_v4.7.2-stable_export_templates.tpz', modification: 'Debug iOS arm64 device slices only; simulator/release slices omitted', file: 'ios-device.zip', bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }, null, 2) + '\n');
const proof = JSON.parse(await readFile(join(directory, 'provenance.json'), 'utf8'));
const entry = proof.files.find(file => file.name === 'templates/ios.zip');
const full = await readFile(original);
if (entry && createHash('sha256').update(full).digest('hex') === entry.sha256) await unlink(original);
// Remove only a verified reproducible download cache created by prepare-native-engine.mjs.
const cache = join(root, 'artifacts/engine/godot-macos.zip');
try {
  const zip = await readFile(cache);
  if (createHash('sha256').update(zip).digest('hex') === 'c58a24e31d720be9d62f60cb5627c4e695fb72f21b0cfe1bc9ccaa9a3b3ba63e') await unlink(cache);
} catch (error) { if (error.code !== 'ENOENT') throw error; }
console.log(`iOS arm64 device template ready: ${Math.round(bytes.length / 1048576)} MiB`);
