import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

export async function webManifest() {
  const files = [];
  async function visit(folder, prefix = '') {
    for (const entry of (await readdir(folder, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const relative = path.posix.join(prefix, entry.name);
      if (entry.isDirectory()) await visit(path.join(folder, entry.name), relative);
      else {
        const bytes = await readFile(path.join(folder, entry.name));
        files.push({ file: relative, bytes: bytes.length, sha256: sha256(bytes) });
      }
    }
  }
  await visit(path.join(root, 'dist'));
  return { sha256: sha256(JSON.stringify(files)), files };
}

export async function verifyWeb(folder, manifest) {
  for (const file of manifest.files) {
    if (sha256(await readFile(path.join(folder, file.file))) !== file.sha256) throw new Error(`Native web asset mismatch: ${file.file}`);
  }
  return manifest.files.length;
}
