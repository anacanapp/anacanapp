#!/usr/bin/env node
// Generates app/lib/features/moderation/copy/moderator_copy.g.dart from scripts/i18n/moderator-copy.json
// (every key, 25 languages; `moderatorText` falls back to en like src/lib/moderator-i18n.ts).
//   node app/tool/moderation/gen_moderator_copy.mjs [--check]
// Re-running reproduces the file byte for byte; --check fails when the committed file is stale.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../../..');
const target = join(root, 'app/lib/features/moderation/copy/moderator_copy.g.dart');
const LANGS = ['az', 'en', 'tr', 'ru', 'de', 'ar', 'ka', 'kk', 'uz', 'zh', 'id', 'fr', 'es', 'pt', 'vi', 'hi', 'ja', 'ko', 'pl', 'nl', 'sv', 'ky', 'et', 'tk', 'uk'];
const lit = (v) => JSON.stringify(v).replace(/\$/g, '\\$');

const copy = JSON.parse(readFileSync(join(root, 'scripts/i18n/moderator-copy.json'), 'utf8'));
const keys = Object.keys(copy.languages.en);
let out = '// GENERATED — do not edit; run node app/tool/moderation/gen_moderator_copy.mjs\n';
out += '// Ported from: scripts/i18n/moderator-copy.json\n';
out += '// ignore_for_file: lines_longer_than_80_chars\n\n';
out += `const String kModeratorCopyProtocol = ${lit(copy.protocol)};\n\n`;
out += 'const Map<String, Map<String, String>> kModeratorCopyAll = {\n';
for (const lang of LANGS) {
  const row = copy.languages[lang];
  if (!row) continue;
  const entries = keys.filter((k) => typeof row[k] === 'string' && row[k] !== '').map((k) => `${lit(k)}: ${lit(row[k])}`);
  out += `  ${lit(lang)}: {${entries.join(', ')}},\n`;
}
out += '};\n';

if (process.argv.includes('--check')) {
  let current = '';
  try { current = readFileSync(target, 'utf8'); } catch {}
  if (current !== out) { console.error('moderator_copy.g.dart is stale'); process.exit(1); }
} else {
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, out);
}
