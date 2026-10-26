import { readdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

// Only disposable outputs created by this METRO task, never enclosing game files.
const root = fileURLToPath(new URL('../', import.meta.url));
for (const name of ['test-results', 'metro-simulator']) {
  await rm(join(root, name), { recursive: true, force: true });
}
const imported = join(root, '.godot/imported');
for (const name of await readdir(imported)) {
  if (name.startsWith('test-failed-')) await rm(join(imported, name), { force: true });
}
console.log('Removed only METRO disposable test caches.');
