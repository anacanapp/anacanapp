#!/usr/bin/env node
// Regenerates the cross-language fixtures under app/test/features/games/fixtures/ by running
// the ORIGINAL TypeScript engines (src/components/games/**) through esbuild.
//   node app/tool/games/gen_fixtures.mjs [game ...]
// Dart tests in app/test/features/games/** must reproduce every value exactly.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { appDir, loadEntry } from './run_ts.mjs';

const fixtures = path.join(appDir, 'test/features/games/fixtures');
mkdirSync(fixtures, { recursive: true });
const write = (name, value) => {
  const file = path.join(fixtures, `${name}.json`);
  writeFileSync(file, JSON.stringify(value) + '\n');
  console.log(`${path.relative(appDir, file)}  ${(JSON.stringify(value).length / 1024).toFixed(1)} KB`);
};

const games = {
  async 'word-garden'(m) {
    write('word_garden_primitives', { primitives: m.primitives(), lexicons: m.lexiconStats(), text: m.text() });
    write('word_garden_levels_v3', m.levels('v3'));
    write('word_garden_levels_v2', m.levels('v2'));
    write('word_garden_levels_v1', m.levels('v1'));
    write('word_garden_play', m.play());
    write('word_garden_storage', m.storage());
  },
  async 'color-sort'(m) { write('color_sort', m.all()); },
  async 'iki-dost'(m) { write('iki_dost', m.all()); },
  async parking(m) { write('parking', m.all()); },
  async 'leaf-flight'(m) { write('leaf_flight', m.all()); },
  async qabarciq(m) { write('qabarciq', m.all()); },
  async birlesdir(m) { write('birlesdir', m.all()); },
  async 'saglam-sebet'(m) { write('saglam_sebet', m.all()); },
  async casual(m) { write('casual', m.all()); },
  async common(m) { write('common_js', m.all()); },
};

const selected = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(games);
for (const name of selected) {
  const started = Date.now();
  await games[name](await loadEntry(name));
  console.log(`  ${name}: ${Date.now() - started} ms`);
}
