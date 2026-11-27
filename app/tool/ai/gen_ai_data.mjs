#!/usr/bin/env node
// Generates the const Dart data of the AI chat and baby chat ports from the React sources:
//   lib/features/baby_chat/data/baby_chat_text.g.dart  ← src/data/baby-chat/<lang>.json (all app languages)
//   lib/features/ai_chat/copy/ai_copy.g.dart            ← scripts/i18n/feature37-copy.json (keys the AI chat uses)
// Run from anywhere:  node app/tool/ai/gen_ai_data.mjs   (re-running reproduces the files byte for byte)
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../../..');
const app = join(root, 'app');
const LANGS = ['az', 'en', 'tr', 'ru', 'de', 'ar', 'ka', 'kk', 'uz', 'zh', 'id', 'fr', 'es', 'pt', 'vi', 'hi', 'ja', 'ko', 'pl', 'nl', 'sv', 'ky', 'et', 'tk', 'uk'];
const lit = (v) => JSON.stringify(v).replace(/\$/g, '\\$');
const dart = (v) => {
  if (typeof v === 'string') return lit(v);
  if (Array.isArray(v)) return `<String>[${v.map(dart).join(', ')}]`;
  return `<String, Object>{${Object.entries(v).map(([k, x]) => `${lit(k)}: ${dart(x)}`).join(', ')}}`;
};

const dir = join(root, 'src/data/baby-chat');
const files = new Set(readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', '')));
let out = '// GENERATED — do not edit; run node app/tool/ai/gen_ai_data.mjs\n';
out += '// Ported from: src/data/baby-chat/*.json\n// ignore_for_file: lines_longer_than_80_chars\n\n';
out += '/// `BabyChatText` per app language (same shape as az.json).\n';
out += 'const Map<String, Map<String, Object>> kBabyChatText = {\n';
for (const lang of LANGS) {
  if (!files.has(lang)) continue;
  out += `  ${lit(lang)}: ${dart(JSON.parse(readFileSync(join(dir, `${lang}.json`), 'utf8')))},\n`;
}
out += '};\n';
mkdirSync(join(app, 'lib/features/baby_chat/data'), { recursive: true });
writeFileSync(join(app, 'lib/features/baby_chat/data/baby_chat_text.g.dart'), out);

const KEYS = ['ai_partner_welcome', 'pm_ata_ai', 'ai_pq_flow_1', 'ai_pq_flow_2', 'ai_pq_support', 'ai_pq_birth', 'ai_pq_bag',
  'ai_pq_crying', 'ai_pq_night', 'ai_pq_postpartum'];
const langs = JSON.parse(readFileSync(join(root, 'scripts/i18n/feature37-copy.json'), 'utf8')).languages;
let copy = '// GENERATED — do not edit; run node app/tool/ai/gen_ai_data.mjs\n';
copy += '// Ported from: scripts/i18n/feature37-copy.json (AI chat keys)\n// ignore_for_file: lines_longer_than_80_chars\n\n';
copy += 'const Map<String, Map<String, String>> kAiFeature37Copy = {\n';
for (const lang of LANGS) {
  const row = langs[lang];
  if (!row) continue;
  copy += `  ${lit(lang)}: {${KEYS.filter((k) => typeof row[k] === 'string' && row[k] !== '').map((k) => `${lit(k)}: ${lit(row[k])}`).join(', ')}},\n`;
}
copy += '};\n';
mkdirSync(join(app, 'lib/features/ai_chat/copy'), { recursive: true });
writeFileSync(join(app, 'lib/features/ai_chat/copy/ai_copy.g.dart'), copy);
console.log('wrote baby_chat_text.g.dart, ai_copy.g.dart');
