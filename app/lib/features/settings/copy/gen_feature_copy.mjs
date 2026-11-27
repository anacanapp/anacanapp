#!/usr/bin/env node
// Generates feature_copy.g.dart (+ assets/images/profile/flags/*.png, countries.g.dart) from the React copy
// tables used by the profile / settings / security / support / legal ports.
//   node app/lib/features/settings/copy/gen_feature_copy.mjs
// Re-running reproduces the files byte for byte.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../../../../..');
const app = join(root, 'app');
const LANGS = ['az', 'en', 'tr', 'ru', 'de', 'ar', 'ka', 'kk', 'uz', 'zh', 'id', 'fr', 'es', 'pt', 'vi', 'hi', 'ja', 'ko', 'pl', 'nl', 'sv', 'ky', 'et', 'tk', 'uk'];
const read = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const lit = (v) => JSON.stringify(v).replace(/\$/g, '\\$');

// Keyed tables (`copy.languages[lang][key] || copy.languages.en[key]`), only the keys these features use.
const TABLES = {
  feature37: ['scripts/i18n/feature37-copy.json', ['ph_what_sees', 'pp_week', 'pp_baby_age_months', 'pp_baby_age_days', 'pp_points', 'pp_missions', 'pp_surprises', 'pp_messages', 'pp_profile', 'pp_level', 'pp_to_next', 'pp_connected_with', 'ph_linked', 'pp_achievements', 'pn_title', 'pp_settings', 'pp_logout']],
  moderator: ['scripts/i18n/moderator-copy.json', ['user_history', 'open_panel', 'details']],
  privacy: ['scripts/i18n/privacy-copy.json', null],
};
// Feature text packs (`src/data/<name>/<lang>.json`, fallback en → az).
const PACKS = ['feedback', 'widgets', 'health-sync', 'lock-offer', 'promo'];

let out = '// GENERATED — do not edit; run node app/lib/features/settings/copy/gen_feature_copy.mjs\n';
out += '// Ported from: scripts/i18n/{feature37,moderator,privacy}-copy.json, src/data/{' + PACKS.join(',') + '}/*.json\n';
out += '// ignore_for_file: lines_longer_than_80_chars\n\n';
for (const [name, [file, keys]] of Object.entries(TABLES)) {
  const langs = read(file).languages;
  const ks = keys ?? Object.keys(langs.en);
  out += `const Map<String, Map<String, String>> k${name[0].toUpperCase()}${name.slice(1)}Copy = {\n`;
  for (const lang of LANGS) {
    const row = langs[lang];
    if (!row) continue;
    const entries = ks.filter((k) => typeof row[k] === 'string' && row[k] !== '').map((k) => `${lit(k)}: ${lit(row[k])}`);
    out += `  ${lit(lang)}: {${entries.join(', ')}},\n`;
  }
  out += '};\n\n';
}
for (const pack of PACKS) {
  const id = pack.replace(/-(\w)/g, (_, c) => c.toUpperCase());
  out += `const Map<String, Object> k${id[0].toUpperCase()}${id.slice(1)}Pack = {\n`;
  for (const lang of LANGS) {
    let v;
    try { v = read(`src/data/${pack}/${lang}.json`); } catch { continue; }
    out += `  ${lit(lang)}: ${dartValue(v)},\n`;
  }
  out += '};\n\n';
}
function dartValue(v) {
  if (Array.isArray(v)) return `<String>[${v.map(dartValue).join(', ')}]`;
  if (v && typeof v === 'object') return `<String, Object>{${Object.entries(v).map(([k, x]) => `${lit(k)}: ${dartValue(x)}`).join(', ')}}`;
  return lit(v);
}
writeFileSync(join(here, 'feature_copy.g.dart'), out);

// countries.json → name/iso list + flag PNGs.
const countries = read('countries.json');
mkdirSync(join(app, 'assets/images/profile/flags'), { recursive: true });
let c = '// GENERATED — do not edit; run node app/lib/features/settings/copy/gen_feature_copy.mjs\n// Ported from: countries.json (name, isoAlpha2; flags → assets/images/profile/flags/<iso>.png)\n\n';
c += 'const List<(String iso, String name)> kCountries = [\n';
for (const k of countries) {
  const b64 = k.flag.startsWith('data:') ? k.flag.split(',')[1] : k.flag;
  writeFileSync(join(app, `assets/images/profile/flags/${k.isoAlpha2}.png`), Buffer.from(b64, 'base64'));
  c += `  (${lit(k.isoAlpha2)}, ${lit(k.name)}),\n`;
}
c += '];\n';
writeFileSync(join(here, 'countries.g.dart'), c);
