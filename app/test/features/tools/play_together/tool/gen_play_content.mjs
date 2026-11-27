// Generates the bundled content of Uşaqla oyun (tool.play-together) from the React sources:
//   app/assets/play_together/az.json        ← src/data/play-together/az.ts (PLAY_GAMES_AZ) + ui-az.ts (PLAY_UI_AZ)
//                                              as {ui, games: PlayGame[]} (the source structure)
//   app/assets/play_together/<lang>.json    ← src/data/play-together/<lang>.ts (PlayLocale {ui, games: {id: text}})
//   app/assets/books/catalog.json           ← src/data/books/catalog.json (verbatim; lib/books/catalog.ts reads it)
//   app/assets/books/covers/<id>.webp       ← public/books/covers/<id>.webp (bookCover(id), byte-identical)
// Run from the repository root:  node app/test/features/tools/play_together/tool/gen_play_content.mjs [--check]
// --check writes nothing and exits 1 when a generated file differs from its source.
import { build } from 'esbuild';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const check = process.argv.includes('--check');
const out = (p) => path.join(root, p);

async function load(source) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'anacan-play-'));
  const outfile = path.join(dir, 'entry.mjs');
  await build({
    stdin: { contents: source, resolveDir: root, loader: 'ts' },
    bundle: true, platform: 'node', format: 'esm', target: 'node20', outfile, logLevel: 'error',
    alias: { '@': path.join(root, 'src') },
  });
  return import(pathToFileURL(outfile).href);
}

const files = new Map();
const tile = await load("export { PLAY_CONTENT_LANGUAGES } from '@/data/play-together/tile';");
const az = await load("export { PLAY_GAMES_AZ } from '@/data/play-together/az'; export { PLAY_UI_AZ } from '@/data/play-together/ui-az';");
files.set('app/assets/play_together/az.json', Buffer.from(`${JSON.stringify({ ui: az.PLAY_UI_AZ, games: az.PLAY_GAMES_AZ })}\n`));
for (const lang of tile.PLAY_CONTENT_LANGUAGES) {
  if (lang === 'az') continue;
  const m = await load(`export { default } from '@/data/play-together/${lang}';`);
  files.set(`app/assets/play_together/${lang}.json`, Buffer.from(`${JSON.stringify(m.default)}\n`));
}

files.set('app/assets/books/catalog.json', fs.readFileSync(out('src/data/books/catalog.json')));
const covers = out('public/books/covers');
for (const f of fs.readdirSync(covers).filter((f) => f.endsWith('.webp')).sort()) {
  files.set(`app/assets/books/covers/${f}`, fs.readFileSync(path.join(covers, f)));
}

let drift = 0;
for (const [p, bytes] of files) {
  const current = fs.existsSync(out(p)) ? fs.readFileSync(out(p)) : null;
  if (current && current.equals(bytes)) continue;
  if (check) { console.error(`out of date: ${p}`); drift++; continue; }
  fs.mkdirSync(path.dirname(out(p)), { recursive: true });
  fs.writeFileSync(out(p), bytes);
}
if (check && drift) process.exit(1);
console.log(check ? 'up to date' : `checked ${files.size} files`);
