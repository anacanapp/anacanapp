#!/usr/bin/env node
// Finds the translation key the React app uses for an Azerbaijani string (docs/flutter/I18N.md).
//
//   node app/tool/i18n/find-key.mjs "Saytda aç"                 exact matches (inline index + az dictionary)
//   node app/tool/i18n/find-key.mjs "Saytda" --contains         substring matches
//   node app/tool/i18n/find-key.mjs "Saytda aç" --file AdminAdmob.tsx   derive the inline key for a file
//   node app/tool/i18n/find-key.mjs --key inline_adminadmob_77cd136b6f7a   show a key in every language
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ASSETS = join(dirname(fileURLToPath(import.meta.url)), '../../assets/i18n');
const args = process.argv.slice(2);
const option = name => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
const flag = name => args.includes(name);
const text = args.find((arg, index) => !arg.startsWith('--') && !['--file', '--key', '--langs'].includes(args[index - 1]));
const langs = (option('--langs') ?? 'az,en,ru').split(',');
const read = name => JSON.parse(readFileSync(join(ASSETS, name), 'utf8'));
const index = read('_inline_index.json');
const dictionaries = Object.fromEntries(langs.map(lang => [lang, read(`${lang}.json`)]));
const inlineKey = (file, value) => `inline_${file.split('/').pop().replace(/\.tsx?$/, '').toLowerCase()}_${createHash('sha256').update(value).digest('hex').slice(0, 12)}`;

function show(key, extra = '') {
  const entry = index[key];
  console.log(`${key}${extra}`);
  if (entry) console.log(`  file: ${entry.files ? entry.files.join(', ') : entry.file}${entry.admin ? ' (admin)' : ''}${entry.placeholders.length ? `  placeholders: ${entry.placeholders.join(', ')}` : ''}`);
  for (const lang of langs) console.log(`  ${lang}: ${dictionaries[lang][key] ?? '(missing: tr returns the az default)'}`);
  if (entry) console.log(entry.placeholders.length
    ? `  dart: formatTrInline('${entry.file.split('/').pop()}', ${JSON.stringify(entry.azText)}, [...])`
    : `  dart: trInline('${entry.file.split('/').pop()}', ${JSON.stringify(entry.azText)})  // == tr('${key}', ...)`);
}

const key = option('--key');
if (key) { show(key); process.exit(0); }
if (!text) { console.error('usage: find-key.mjs "<Azerbaijani text>" [--contains] [--file <React file>] [--langs az,en,ru] | --key <key>'); process.exit(1); }
const file = option('--file');
if (file) show(inlineKey(file, text), '  (derived)');
const match = value => flag('--contains') ? value.includes(text) : value === text;
let found = 0;
for (const [candidate, entry] of Object.entries(index)) if (match(entry.azText)) { show(candidate, '  (inline)'); found++; }
for (const [candidate, value] of Object.entries(read('az.json'))) {
  if (!candidate.startsWith('inline_') && !candidate.startsWith('@copy.') && match(value)) { show(candidate, '  (az.json / explicit tr key)'); found++; }
  else if (candidate.startsWith('@copy.') && match(value)) { const [, section, name] = candidate.split('.'); console.log(`${candidate}  (ui-copy) → copyText('${section}', '${name}')`); found++; }
}
if (!found && !file) console.log('no match (explicit tr(key, default) keys whose az text lives only in code are not indexed; grep src/ for the text)');
