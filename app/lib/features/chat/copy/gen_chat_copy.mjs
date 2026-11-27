#!/usr/bin/env node
// Generates chat_copy.g.dart from the React copy tables used by the chat / DM / sticker ports:
//   src/lib/chat-i18n.ts (CHAT_TRANSLATIONS), src/lib/group-i18n.ts (GROUP_LANGUAGES, GROUP_LABELS),
//   scripts/i18n/feature37-copy.json (chat_* keys), scripts/i18n/followup36-copy.json (media_* keys),
//   scripts/i18n/sticker-copy.json, date-fns 3 locales (formatDistance strings of getCurrentDateLocale(), incl. the
//   ky = ru and tk = TK_DISTANCE rules of src/lib/date-utils.ts).
//   node app/lib/features/chat/copy/gen_chat_copy.mjs            # regenerates chat_copy.g.dart
//   node app/lib/features/chat/copy/gen_chat_copy.mjs --assets   # also copies public/stickers/*.webp → app/assets/stickers/
// Re-running reproduces the file byte for byte.
import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../../../../..');
const require = createRequire(join(root, 'package.json'));
const LANGS = ['az', 'en', 'tr', 'ru', 'de', 'ar', 'ka', 'kk', 'uz', 'zh', 'id', 'fr', 'es', 'pt', 'vi', 'hi', 'ja', 'ko', 'pl', 'nl', 'sv', 'ky', 'et', 'tk', 'uk'];
const readJson = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const readText = (p) => readFileSync(join(root, p), 'utf8');
const lit = (v) => JSON.stringify(v).replace(/\$/g, '\\$');

/** Evaluates the object/array literal that follows `marker` in a TS source (up to the balanced closing bracket). */
function literalAfter(source, marker) {
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`marker not found: ${marker}`);
  let i = source.indexOf('=', start) + 1;
  while (/\s/.test(source[i])) i++;
  const open = source[i], close = open === '{' ? '}' : ']';
  let depth = 0, quote = null;
  for (let j = i; j < source.length; j++) {
    const c = source[j];
    if (quote) { if (c === '\\') j++; else if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === open) depth++;
    else if (c === close && --depth === 0) return new Function(`return ${source.slice(i, j + 1)};`)();
  }
  throw new Error(`unbalanced literal after ${marker}`);
}

const chatSource = readText('src/lib/chat-i18n.ts');
const chat = literalAfter(chatSource, 'CHAT_TRANSLATIONS');
const groupSource = readText('src/lib/group-i18n.ts');
const groupLanguages = literalAfter(groupSource, 'GROUP_LANGUAGES');
const groupLabels = literalAfter(groupSource, 'GROUP_LABELS');

let out = '// GENERATED — do not edit; run node app/lib/features/chat/copy/gen_chat_copy.mjs\n';
out += '// Ported from: src/lib/chat-i18n.ts (CHAT_TRANSLATIONS), src/lib/group-i18n.ts (GROUP_LANGUAGES, GROUP_LABELS),\n';
out += '//              scripts/i18n/{feature37,followup36,sticker}-copy.json, date-fns 3.6 locales (formatDistance)\n';
out += '// ignore_for_file: lines_longer_than_80_chars\n\n';

out += '/// `CHAT_TRANSLATIONS` (bundled fallbacks of chat-i18n `tr`).\n';
out += 'const Map<String, Map<String, String>> kChatTranslations = {\n';
for (const [lang, row] of Object.entries(chat)) {
  out += `  ${lit(lang)}: {${Object.entries(row).map(([k, v]) => `${lit(k)}: ${lit(v)}`).join(', ')}},\n`;
}
out += '};\n\n';

out += '/// `GROUP_LANGUAGES`.\n';
out += `const List<String> kGroupLanguages = [${groupLanguages.map(lit).join(', ')}];\n\n`;
out += '/// `GROUP_LABELS` (one label per [kGroupLanguages] entry).\n';
out += 'const Map<String, List<String>> kGroupLabels = {\n';
for (const [key, labels] of Object.entries(groupLabels)) out += `  ${lit(key)}: [${labels.map(lit).join(', ')}],\n`;
out += '};\n\n';

function table(name, doc, file, keys) {
  const langs = readJson(file).languages;
  const ks = keys ?? Object.keys(langs.en);
  out += `/// ${doc}\n`;
  out += `const Map<String, Map<String, String>> ${name} = {\n`;
  for (const lang of LANGS) {
    const row = langs[lang];
    if (!row) continue;
    const entries = ks.filter((k) => typeof row[k] === 'string' && row[k] !== '').map((k) => `${lit(k)}: ${lit(row[k])}`);
    out += `  ${lit(lang)}: {${entries.join(', ')}},\n`;
  }
  out += '};\n\n';
}
const feature37 = readJson('scripts/i18n/feature37-copy.json').languages.en;
table('kChatFeature37Copy', '`feature37Text` chat_* keys.', 'scripts/i18n/feature37-copy.json', Object.keys(feature37).filter((k) => k.startsWith('chat_')));
table('kChatFollowupCopy', '`followupText` media_* keys (ChatMediaAttachment).', 'scripts/i18n/followup36-copy.json', ['media_failed', 'media_retry']);
table('kStickerCopy', '`stickerText` (scripts/i18n/sticker-copy.json).', 'scripts/i18n/sticker-copy.json', null);

// date-fns formatDistance strings (addSuffix: false) per token and count, for the locale getCurrentDateLocale() picks.
const locales = require('date-fns/locale');
const dateUtils = readText('src/lib/date-utils.ts');
const tkDistance = literalAfter(dateUtils, 'TK_DISTANCE');
const LOCALE = { en: 'enUS', ru: 'ru', tr: 'tr', kk: 'kk', de: 'de', ar: 'ar', uz: 'uz', ka: 'ka', zh: 'zhCN', id: 'id', fr: 'fr', es: 'es',
  pt: 'pt', vi: 'vi', hi: 'hi', ja: 'ja', ko: 'ko', pl: 'pl', nl: 'nl', sv: 'sv', et: 'et', ky: 'ru', uk: 'uk', az: 'az' };
const TOKENS = { lessThanXMinutes: [1], xMinutes: range(1, 44), aboutXHours: range(1, 24), xDays: range(1, 30), aboutXMonths: range(1, 2),
  xMonths: range(1, 12), aboutXYears: range(1, 60), overXYears: range(1, 60), almostXYears: range(1, 60) };
function range(a, b) { return Array.from({ length: b - a + 1 }, (_, i) => a + i); }
out += '/// date-fns `formatDistance(token, count)` (no suffix) of the locale `getCurrentDateLocale()` returns, per app\n';
out += '/// language: token → strings for count 1..N (index = count - 1).\n';
out += 'const Map<String, Map<String, List<String>>> kDistanceStrings = {\n';
for (const lang of LANGS) {
  const format = lang === 'tk'
    ? (token, count) => (tkDistance[token] ?? '{{count}}').replace('{{count}}', String(count))
    : (token, count) => locales[LOCALE[lang]].formatDistance(token, count, { addSuffix: false });
  out += `  ${lit(lang)}: {\n`;
  for (const [token, counts] of Object.entries(TOKENS)) out += `    ${lit(token)}: [${counts.map((n) => lit(format(token, n))).join(', ')}],\n`;
  out += '  },\n';
}
out += '};\n';
writeFileSync(join(here, 'chat_copy.g.dart'), out);

if (process.argv.includes('--assets')) {
  const target = join(root, 'app/assets/stickers');
  mkdirSync(target, { recursive: true });
  for (const file of readdirSync(join(root, 'public/stickers')).filter((f) => /^\d{2}\.webp$/.test(f)).sort()) {
    copyFileSync(join(root, 'public/stickers', file), join(target, file));
  }
}
