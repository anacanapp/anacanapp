#!/usr/bin/env node
// Reproducibly exports every game's offline data to app/assets/games/** from the React sources:
//   node app/tool/games/export_assets.mjs
// - Word Garden lexicons and the Two Friends / Clear the Way catalogs are copied byte-for-byte
//   (published revisions must keep their exact bytes / SHA-256).
// - Message catalogs, Color Sort levels and item/tile tables are evaluated from the TS modules.
import { copyFileSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { appDir, loadEntry, repoDir } from './run_ts.mjs';

const out = path.join(appDir, 'assets/games');
const games = path.join(repoDir, 'src/components/games');
const manifest = {};
const record = (relative) => {
  const bytes = readFileSync(path.join(out, relative));
  manifest[relative] = { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
};
const copy = (from, to) => {
  mkdirSync(path.dirname(path.join(out, to)), { recursive: true });
  copyFileSync(path.join(games, from), path.join(out, to));
  record(to);
};
copy('word-garden/data/az.json', 'word_garden/az.json');
copy('word-garden/data/az-v2.json', 'word_garden/az-v2.json');
copy('word-garden/data/az-v1.json', 'word_garden/az-v1.json');
copy('iki-dost/catalog.json', 'iki_dost/catalog.json');
copy('parking/catalog.json', 'parking/catalog.json');
copy('color-sort/catalog.json', 'color_sort/catalog.json');

const { assets } = await loadEntry('assets');
for (const [relative, value] of Object.entries(assets())) {
  mkdirSync(path.dirname(path.join(out, relative)), { recursive: true });
  writeFileSync(path.join(out, relative), JSON.stringify(value) + '\n');
  record(relative);
}
writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
for (const [file, info] of Object.entries(manifest)) console.log(`${file.padEnd(34)} ${String(info.bytes).padStart(8)} B  ${info.sha256.slice(0, 12)}`);
