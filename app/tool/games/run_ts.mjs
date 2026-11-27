// Bundles a TypeScript entry (which imports the ORIGINAL React-app engines from
// src/components/games/**) with the repo's own esbuild and imports it, so fixture
// dumps run the exact TypeScript code that ships today. Usage: `await loadEntry('word-garden')`.
import { build } from 'esbuild';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const toolDir = path.dirname(fileURLToPath(import.meta.url));
export const appDir = path.resolve(toolDir, '../..');
export const repoDir = path.resolve(appDir, '..');

export async function loadEntry(name) {
  const outdir = mkdtempSync(path.join(process.env.GAMES_TMP || tmpdir(), 'anacan-games-'));
  const outfile = path.join(outdir, `${name}.mjs`);
  await build({
    entryPoints: [path.join(toolDir, 'entries', `${name}.ts`)],
    bundle: true, platform: 'node', format: 'esm', target: 'node20', outfile, logLevel: 'error',
    alias: { '@': path.join(repoDir, 'src') },
    loader: { '.webp': 'empty', '.png': 'empty', '.css': 'empty' },
  });
  return import(pathToFileURL(outfile).href);
}
