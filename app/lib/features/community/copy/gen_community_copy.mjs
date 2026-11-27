#!/usr/bin/env node
// Generates community_copy.g.dart from the React copy tables used by the community ports:
//   scripts/i18n/community-moderation-copy.json (moderationText), scripts/i18n/feature37-copy.json (blog_* keys of
//   feature37Text), date-fns 3 locales (formatDistanceToNow with addSuffix and formatDistanceToNowStrict of the
//   locale getCurrentDateLocale() returns, incl. the ky = ru and tk = TK_DISTANCE rules of src/lib/date-utils.ts).
//   node app/lib/features/community/copy/gen_community_copy.mjs
// Re-running reproduces the file byte for byte.
import { readFileSync, writeFileSync } from 'node:fs';
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

let out = '// GENERATED - do not edit; run node app/lib/features/community/copy/gen_community_copy.mjs\n';
out += '// Ported from: scripts/i18n/community-moderation-copy.json, scripts/i18n/feature37-copy.json (blog_* keys),\n';
out += '//              date-fns 3.6 locales (formatDistance with addSuffix, formatDistanceStrict tokens)\n';
out += '// ignore_for_file: lines_longer_than_80_chars\n\n';

function table(name, doc, file, keys) {
  const langs = readJson(file).languages;
  const ks = keys ?? Object.keys(langs.en);
  out += `/// ${doc}\n`;
  out += `const Map<String, Map<String, String>> ${name} = {\n`;
  for (const lang of LANGS) {
    const row = langs[lang];
    if (!row) continue;
    const entries = ks.filter((k) => typeof row[k] === 'string').map((k) => `${lit(k)}: ${lit(row[k])}`);
    out += `  ${lit(lang)}: {${entries.join(', ')}},\n`;
  }
  out += '};\n\n';
}
table('kCommunityModerationCopy', '`moderationText` (scripts/i18n/community-moderation-copy.json, every language).',
  'scripts/i18n/community-moderation-copy.json', null);
const feature37 = readJson('scripts/i18n/feature37-copy.json').languages.en;
table('kCommunityFeature37Copy', '`feature37Text` blog_* keys (shared blog cards / attachment picker).',
  'scripts/i18n/feature37-copy.json', Object.keys(feature37).filter((k) => k.startsWith('blog_')));

const locales = require('date-fns/locale');
const dateUtils = readText('src/lib/date-utils.ts');
const tkDistance = literalAfter(dateUtils, 'TK_DISTANCE');
const LOCALE = { en: 'enUS', ru: 'ru', tr: 'tr', kk: 'kk', de: 'de', ar: 'ar', uz: 'uz', ka: 'ka', zh: 'zhCN', id: 'id', fr: 'fr', es: 'es',
  pt: 'pt', vi: 'vi', hi: 'hi', ja: 'ja', ko: 'ko', pl: 'pl', nl: 'nl', sv: 'sv', et: 'et', ky: 'ru', uk: 'uk', az: 'az' };
function range(a, b) { return Array.from({ length: b - a + 1 }, (_, i) => a + i); }
function formatter(lang) {
  if (lang === 'tk') return (token, count, options) => {
    const text = (tkDistance[token] ?? '{{count}}').replace('{{count}}', String(count));
    if (!options?.addSuffix) return text;
    return options.comparison && options.comparison > 0 ? `${text} geçenden soň` : `${text} öň`;
  };
  return (token, count, options) => locales[LOCALE[lang]].formatDistance(token, count, options);
}

// formatDistanceToNow(date, { addSuffix: true }): comparison -1 = past ("... ago"), 1 = future ("in ...").
const SUFFIX_TOKENS = { lessThanXMinutes: [1], xMinutes: range(1, 44), aboutXHours: range(1, 24), xDays: range(1, 30), aboutXMonths: range(1, 2),
  xMonths: range(1, 12), aboutXYears: range(1, 60), overXYears: range(1, 60), almostXYears: range(1, 60) };
out += '/// date-fns `formatDistance(token, count, { addSuffix: true, comparison })` per app language: token  [past strings,\n';
out += '/// future strings] for count 1..N (index = count - 1).\n';
out += 'const Map<String, Map<String, List<List<String>>>> kSuffixDistance = {\n';
for (const lang of LANGS) {
  const format = formatter(lang);
  out += `  ${lit(lang)}: {\n`;
  for (const [token, counts] of Object.entries(SUFFIX_TOKENS)) {
    const past = counts.map((n) => lit(format(token, n, { addSuffix: true, comparison: -1 })));
    const future = counts.map((n) => lit(format(token, n, { addSuffix: true, comparison: 1 })));
    out += `    ${lit(token)}: [[${past.join(', ')}], [${future.join(', ')}]],\n`;
  }
  out += '  },\n';
}
out += '};\n\n';

// formatDistanceToNowStrict(date) (no suffix): xSeconds 0..60, xMinutes 1..60, xHours 1..24, xDays 0..30, xMonths 0..12,
// xYears 0..60 (index = count).
const STRICT_TOKENS = { xSeconds: range(0, 60), xMinutes: range(0, 60), xHours: range(0, 24), xDays: range(0, 31), xMonths: range(0, 12), xYears: range(0, 60) };
out += '/// date-fns `formatDistance(token, count)` (no suffix) for the formatDistanceStrict tokens: token  strings for\n';
out += '/// count 0..N (index = count).\n';
out += 'const Map<String, Map<String, List<String>>> kStrictDistance = {\n';
for (const lang of LANGS) {
  const format = formatter(lang);
  out += `  ${lit(lang)}: {\n`;
  for (const [token, counts] of Object.entries(STRICT_TOKENS)) out += `    ${lit(token)}: [${counts.map((n) => lit(format(token, n, { addSuffix: false }))).join(', ')}],\n`;
  out += '  },\n';
}
out += '};\n';
writeFileSync(join(here, 'community_copy.g.dart'), out);
