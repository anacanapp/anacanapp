import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const directory = join(root, 'artifacts', 'engine');
const version = '4.7.2-stable';
const url = `https://github.com/godotengine/godot/releases/download/${version}/Godot_v${version}_macos.universal.zip`;
const expected = 'c58a24e31d720be9d62f60cb5627c4e695fb72f21b0cfe1bc9ccaa9a3b3ba63e';
await mkdir(directory, { recursive: true });
const binary = join(directory, 'Godot.app', 'Contents', 'MacOS', 'Godot');
try { await stat(binary); } catch {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Godot download: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (createHash('sha256').update(bytes).digest('hex') !== expected) throw new Error('Godot release checksum mismatch');
  const archive = join(directory, 'godot-macos.zip'); await writeFile(archive, bytes);
  execFileSync('ditto', ['-x', '-k', archive, directory], { stdio: 'pipe' });
}
const reported = execFileSync(binary, ['--version'], { encoding: 'utf8' }).trim();
if (!reported.startsWith('4.7.2.stable')) throw new Error('Unexpected engine version');
await writeFile(join(directory, 'engine.json'), JSON.stringify({ name: 'Godot', version: reported, source: url, sha256: expected }, null, 2) + '\n');
console.log(`Godot ${reported} ready: artifacts/engine/Godot.app`);
