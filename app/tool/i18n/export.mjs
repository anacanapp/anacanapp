#!/usr/bin/env node
// Flutter i18n export (Node 22). Spec: docs/flutter/I18N.md.
//
//   node app/tool/i18n/export.mjs           write every output
//   node app/tool/i18n/export.mjs --check   exit 1 when any output is stale (writes nothing)
//
// Outputs (all deterministic, no timestamps):
//   app/assets/i18n/<lang>.json            25 flat key -> string maps (minified, keys sorted)
//   app/assets/i18n/_inline_index.json     inline_* key -> { file, azText, placeholders[, files][, admin] }
//   app/assets/i18n/_manifest.json         per-language key / missing counts, bytes, sha256
//   app/lib/core/i18n/generated/*.g.dart   language registry, startup copy, ICU-derived format data
//   app/test/core/i18n/fixtures/*.json     golden values computed from the React sources
//   app/test/core/content_packs/fixtures/*.json  content-key samples from scripts/i18n/content/*.json
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { analyzeInlineCopy } from '../../../scripts/i18n/inline-localization.mjs';
import { contentTranslationKey, canonicalContent } from '../../../scripts/i18n/content-translation-core.mjs';
import { buildLanguagePacks, canonicalJson } from '../../../scripts/i18n/content-packs.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const APP = join(ROOT, 'app');
const CHECK = process.argv.includes('--check');
const COPY_PREFIX = '@copy.';
const sha256 = text => createHash('sha256').update(text, 'utf8').digest('hex');
const readJson = path => JSON.parse(readFileSync(join(ROOT, path), 'utf8'));
const sortObject = object => Object.fromEntries(Object.keys(object).sort().map(key => [key, object[key]]));

// ── TypeScript constant evaluation (registry + startup copy are read from the React sources) ──
function tsConstants(path, names) {
  const code = readFileSync(join(ROOT, path), 'utf8');
  const tree = ts.createSourceFile(path, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const found = {};
  const visit = node => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && names.includes(node.name.text) && node.initializer) {
      const js = ts.transpileModule(`export default (${node.initializer.getText(tree)});`, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
      const module = { exports: {} };
      new Function('module', 'exports', js)(module, module.exports);
      found[node.name.text] = module.exports.default;
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  for (const name of names) if (!(name in found)) throw new Error(`EXPORT_CONSTANT_MISSING ${path}:${name}`);
  return found;
}

const registry = tsConstants('src/lib/app-languages.ts', ['APP_LANGUAGES', 'NEW_LANGUAGE_CODES', 'LANGUAGE_EXPANSION_21', 'LANGUAGE_EXPANSION_23', 'LANGUAGE_EXPANSION_25']);
const LANGS = registry.APP_LANGUAGES.map(language => language.code);
const rtlSource = readFileSync(join(ROOT, 'src/lib/rtl.ts'), 'utf8');
const RTL_LANGS = JSON.parse(`[${/RTL_LANGS = new Set\(\[([^\]]*)\]\)/.exec(rtlSource)[1].replace(/'/g, '"')}]`);
const { COPY: STARTUP_COPY } = tsConstants('src/lib/startup-i18n.ts', ['COPY']);
const EXPANSION = [...registry.LANGUAGE_EXPANSION_21, ...registry.LANGUAGE_EXPANSION_23, ...registry.LANGUAGE_EXPANSION_25];

// ── Sources ──
const seedPath = lang => lang === 'az' || lang === 'en' ? `src/locales/${lang}.json` : `scripts/i18n/${lang}.seed.json`;
const seeds = Object.fromEntries(LANGS.map(lang => [lang, readJson(seedPath(lang))]));
const copies = Object.fromEntries(LANGS.map(lang => [lang, existsSync(join(ROOT, `scripts/i18n/copy/${lang}.json`)) ? readJson(`scripts/i18n/copy/${lang}.json`) : null]));

// Inline extraction: the Vite plugin's own analyzeInlineCopy over every src/**/*.ts(x).
// Its built-in exclusions (tests, brand-portal, public-blog, website, web-entry, main.tsx,
// bootstrap-app.tsx, InitialLanguageScreen.tsx) apply; admin is NOT excluded by the plugin.
function sourceFiles() {
  const files = [];
  const walk = directory => {
    for (const name of readdirSync(directory).sort()) {
      const path = join(directory, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.tsx?$/.test(name) && !name.endsWith('.d.ts')) files.push(relative(ROOT, path).replace(/\\/g, '/'));
    }
  };
  walk(join(ROOT, 'src'));
  return files;
}
const isAdminFile = file => /\/admin\//.test(file) || /\/(?:Admin|Admob[A-Za-z]*Admin)[A-Za-z]*\.tsx?$/.test(file);
const inline = {};
for (const file of sourceFiles()) {
  const { messages } = analyzeInlineCopy(readFileSync(join(ROOT, file), 'utf8'), file);
  for (const [key, text] of Object.entries(messages)) {
    const entry = inline[key];
    if (entry) {
      if (entry.azText !== text) throw new Error(`INLINE_KEY_COLLISION ${key}`);
      if (!entry.files.includes(file)) entry.files.push(file);
    } else inline[key] = { azText: text, files: [file] };
  }
}
const inlineIndex = sortObject(Object.fromEntries(Object.entries(inline).map(([key, { azText, files }]) => {
  const placeholders = [...new Set([...azText.matchAll(/\{(inline_\d+)\}/g)].map(match => match[1]))];
  const sorted = [...files].sort();
  const entry = { file: sorted[0], azText, placeholders };
  if (sorted.length > 1) entry.files = sorted;
  if (sorted.every(isAdminFile)) entry.admin = true;
  return [key, entry];
})));

// ── Per-language maps ──
// <lang>.json = what translationCache[lang] holds after the bundled seed is merged, i.e. what
// tr(key, azDefault) returns for every key it knows (absent keys fall back to azDefault):
//   az: src/locales/az.json + inline az texts (equal to their tr default) ;  en: src/locales/en.json ;
//   others: scripts/i18n/<lang>.seed.json.
// copyText(section, key, lang) is pure, so its resolved value (own || en || key) is stored as
// "@copy.<section>.<key>".
function copyEntries(lang) {
  const out = {};
  const en = copies.en;
  for (const [section, values] of Object.entries(en)) {
    for (const key of Object.keys(values)) {
      const own = copies[lang]?.[section]?.[key];
      out[`${COPY_PREFIX}${section}.${key}`] = own || values[key] || key;
    }
  }
  for (const [section, values] of Object.entries(copies[lang] ?? {})) {
    for (const [key, value] of Object.entries(values)) if (!(`${COPY_PREFIX}${section}.${key}` in out) && value) out[`${COPY_PREFIX}${section}.${key}`] = value;
  }
  return out;
}
const maps = {};
for (const lang of LANGS) {
  const map = { ...seeds[lang] };
  if (lang === 'az') for (const [key, { azText }] of Object.entries(inline)) if (!(key in map)) map[key] = azText;
  for (const key of Object.keys(map)) if (key.startsWith(COPY_PREFIX)) throw new Error(`COPY_NAMESPACE_COLLISION ${lang}:${key}`);
  Object.assign(map, copyEntries(lang));
  maps[lang] = sortObject(map);
}

const outputs = new Map(); // absolute path -> text
const emit = (path, text) => outputs.set(join(APP, path), text);
const manifest = { schema: 'anacan-flutter-i18n-v1', copyPrefix: COPY_PREFIX, inlineKeys: Object.keys(inlineIndex).length,
  inlineKeysAdminOnly: Object.values(inlineIndex).filter(entry => entry.admin).length, languages: {} };
const azKeys = Object.keys(maps.az);
for (const lang of LANGS) {
  const text = JSON.stringify(maps[lang]);
  emit(`assets/i18n/${lang}.json`, text);
  const keys = new Set(Object.keys(maps[lang]));
  const inlineCovered = Object.keys(inlineIndex).filter(key => keys.has(key)).length;
  manifest.languages[lang] = { keys: keys.size, missingVsAz: azKeys.filter(key => !keys.has(key)).length,
    extraVsAz: [...keys].filter(key => !maps.az[key]).length, inlineTranslated: inlineCovered,
    bytes: Buffer.byteLength(text), sha256: sha256(text), source: seedPath(lang) };
}
emit('assets/i18n/_inline_index.json', JSON.stringify(inlineIndex));
manifest.inlineIndexBytes = Buffer.byteLength(JSON.stringify(inlineIndex));
emit('assets/i18n/_manifest.json', `${JSON.stringify(manifest, null, 1)}\n`);

// ── ICU-derived format data (Node full-icu) ──
const locale = code => registry.APP_LANGUAGES.find(language => language.code === code).locale;
const REF = (month, day, hour, minute) => new Date(Date.UTC(2024, month, day, hour, minute));
const DATE_VARIANTS = {
  dm: { day: 'numeric', month: 'long' },
  dmy: { day: 'numeric', month: 'long', year: 'numeric' },
  dmhm: { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hour12: false },
  dmyhm: { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hour12: false, year: 'numeric' },
};
const numbering = code => {
  const zero = new Intl.NumberFormat(locale(code), { useGrouping: false }).format(0);
  return zero;
};
function digitsOf(code, text) { const zero = numbering(code).charCodeAt(0); return text.replace(/[0-9]/g, d => String.fromCharCode(zero + Number(d))); }
function dateTemplate(code, options) {
  const formatter = new Intl.DateTimeFormat(locale(code), { ...options, timeZone: 'UTC' });
  // format() is what React renders; V8's format() and formatToParts() can differ in literal
  // whitespace (U+202F vs space), so literals are taken from the format() text between part values.
  const date = REF(0, 15, 9, 5), text = formatter.format(date);
  let index = 0, pattern = '';
  for (const part of formatter.formatToParts(date)) {
    if (part.type === 'literal') continue;
    const token = { day: '{d}', month: '{M}', year: '{y}', hour: '{H}', minute: '{m}' }[part.type];
    if (!token) throw new Error(`DATE_PART ${code} ${part.type}`);
    const at = text.indexOf(part.value, index);
    if (at < 0) throw new Error(`DATE_PART_POSITION ${code} ${part.type}`);
    pattern += text.slice(index, at) + token; index = at + part.value.length;
  }
  pattern += text.slice(index);
  const months = Array.from({ length: 12 }, (_, month) => formatter.formatToParts(REF(month, 15, 9, 5)).find(part => part.type === 'month').value);
  return { pattern, months };
}
function renderDate(code, template, date) {
  const pad = value => String(value).padStart(2, '0');
  return template.pattern.replace(/\{([dMyHm])\}/g, (_, token) => ({
    d: digitsOf(code, String(date.getUTCDate())), M: template.months[date.getUTCMonth()], y: digitsOf(code, String(date.getUTCFullYear())),
    H: digitsOf(code, pad(date.getUTCHours())), m: digitsOf(code, pad(date.getUTCMinutes())) })[token]);
}
const formatDates = [REF(0, 1, 0, 0), REF(1, 29, 9, 5), REF(2, 9, 12, 30), REF(3, 22, 13, 59), REF(4, 31, 23, 1), REF(5, 3, 7, 7),
  REF(6, 4, 18, 45), REF(7, 15, 0, 5), REF(8, 30, 11, 11), REF(9, 12, 21, 0), REF(10, 7, 6, 6), REF(11, 31, 23, 59)];
const dateData = {}, dateGolden = {};
for (const code of registry.NEW_LANGUAGE_CODES) {
  dateData[code] = {}; dateGolden[code] = {};
  for (const [variant, options] of Object.entries(DATE_VARIANTS)) {
    const template = dateTemplate(code, options);
    const formatter = new Intl.DateTimeFormat(locale(code), { ...options, timeZone: 'UTC' });
    dateGolden[code][variant] = formatDates.map(date => {
      const expected = formatter.format(date), rendered = renderDate(code, template, date);
      if (expected !== rendered) throw new Error(`DATE_TEMPLATE_MISMATCH ${code} ${variant}: ${expected} != ${rendered}`);
      return [date.toISOString(), expected];
    });
    dateData[code][variant] = template;
  }
}
const weekdays = Object.fromEntries(LANGS.map(code => {
  const formatter = new Intl.DateTimeFormat(locale(code), { weekday: 'short', timeZone: 'UTC' });
  return [code, Array.from({ length: 7 }, (_, index) => formatter.format(new Date(Date.UTC(2024, 0, 7 + index))))];
}));
const numberSymbols = Object.fromEntries(LANGS.map(code => {
  const parts = new Intl.NumberFormat(locale(code), { maximumFractionDigits: 2 }).formatToParts(1234567.5);
  const group = parts.find(part => part.type === 'group')?.value ?? '';
  const decimal = parts.find(part => part.type === 'decimal')?.value ?? '.';
  const minus = new Intl.NumberFormat(locale(code)).formatToParts(-1).find(part => part.type === 'minusSign')?.value ?? '-';
  const minGrouping = new Intl.NumberFormat(locale(code)).format(1000).length === new Intl.NumberFormat(locale(code), { useGrouping: false }).format(1000).length ? 2 : 1;
  return [code, { group, decimal, minus, zero: numbering(code), minGrouping }];
}));
const pluralSamples = [0, 1, 2, 3, 4, 5, 7, 11, 12, 14, 21, 22, 25, 101, 111, 1.5, 0.5, 2.25, 1000000];
const UNIT_KEYS = { day: ['long'], week: ['long'], month: ['long'], year: ['long'], hour: ['long'], minute: ['long', 'short'], second: ['long', 'short'] };
const unitPatterns = {};
for (const code of EXPANSION) {
  const rules = new Intl.PluralRules(locale(code));
  const categories = rules.resolvedOptions().pluralCategories;
  unitPatterns[code] = {};
  for (const [unit, widths] of Object.entries(UNIT_KEYS)) for (const width of widths) {
    const formatter = new Intl.NumberFormat(locale(code), { style: 'unit', unit, unitDisplay: width, maximumFractionDigits: 2 });
    const number = new Intl.NumberFormat(locale(code), { maximumFractionDigits: 2 });
    const forms = {};
    for (const category of categories) {
      const sample = pluralSamples.find(value => rules.select(value) === category);
      if (sample === undefined) continue;
      const text = formatter.format(sample), digits = number.format(sample);
      forms[category] = text.includes(digits) ? text.replace(digits, '{0}') : text;
    }
    unitPatterns[code][`${unit}:${width}`] = forms;
  }
}
// Golden for formatCountUnit + plural categories (verifies the Dart CLDR rules and patterns).
const unitGolden = [];
for (const code of EXPANSION) {
  for (const value of [0, 1, 2, 3, 5, 11, 12, 21, 22, 25, 1.5, 2.25, 1234]) {
    for (const [template, unit, width] of [['{count} days', 'day', 'long'], ['{n} həftə', 'week', 'long'], ['{count} ay', 'month', 'long'], ['{count} il', 'year', 'long'],
      ['{count} hours', 'hour', 'long'], ['{count} dəqiqə', 'minute', 'long'], ['{count} min', 'minute', 'short'], ['{count} san.', 'second', 'short'], ['{count} seconds', 'second', 'long']]) {
      unitGolden.push([code, template, value, new Intl.NumberFormat(locale(code), { style: 'unit', unit, unitDisplay: width, maximumFractionDigits: 2 }).format(value)]);
    }
  }
}
const pluralGolden = Object.fromEntries(EXPANSION.map(code => [code, pluralSamples.map(value => [value, new Intl.PluralRules(locale(code)).select(value)])]));

// ICU root collation for ASCII (String.prototype.localeCompare(_, 'en')), used by canonicalContent.
const ascii = Array.from({ length: 95 }, (_, index) => String.fromCharCode(32 + index)).sort((a, b) => a.localeCompare(b, 'en') || (a < b ? -1 : 1));
const primary = {}; let rank = 0;
ascii.forEach((char, index) => { if (index && ascii[index - 1].localeCompare(char, 'en', { sensitivity: 'base' }) !== 0) rank++; primary[char] = rank; });
const asciiPrimary = Array.from({ length: 95 }, (_, index) => primary[String.fromCharCode(32 + index)]);

// NFC composition pairs for the scripts langDetect inspects (Dart has no String.normalize).
const nfcPairs = {};
for (const [from, to] of [[0xc0, 0x24f], [0x400, 0x4ff], [0x1e00, 0x1eff]]) {
  for (let code = from; code <= to; code++) {
    const char = String.fromCharCode(code), decomposed = char.normalize('NFD');
    if (decomposed === char || char.normalize('NFC') !== char) continue;
    const base = decomposed.slice(0, -1).normalize('NFC'), mark = decomposed.slice(-1);
    if (base.length === 1) nfcPairs[`${base}${mark}`] = char;
  }
}

// ── Generated Dart ──
const dartString = value => `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\$/g, '\\$').replace(/\n/g, '\\n').replace(/[\u0000-\u001f\u2028\u2029]/g, c => `\\u{${c.charCodeAt(0).toString(16)}}`)}'`;
const dartValue = value => {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') return dartString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return `[${value.map(dartValue).join(', ')}]`;
  return `{${Object.entries(value).map(([key, item]) => `${dartString(key)}: ${dartValue(item)}`).join(', ')}}`;
};
const header = source => `// GENERATED by app/tool/i18n/export.mjs from ${source}. Do not edit.\n// Ported from: ${source}\n// ignore_for_file: lines_longer_than_80_chars\n`;
emit('lib/core/i18n/generated/app_languages.g.dart', `${header('src/lib/app-languages.ts, src/lib/rtl.ts')}
/// Raw registry rows in bundle order: code, English name, native name, locale tag, flag.
const List<(String, String, String, String, String)> kAppLanguageRows = [
${registry.APP_LANGUAGES.map(l => `  (${dartString(l.code)}, ${dartString(l.name)}, ${dartString(l.native_name)}, ${dartString(l.locale)}, ${dartString(l.flag)}),`).join('\n')}
];
const List<String> kNewLanguageCodes = ${dartValue(registry.NEW_LANGUAGE_CODES)};
const List<String> kLanguageExpansion21 = ${dartValue(registry.LANGUAGE_EXPANSION_21)};
const List<String> kLanguageExpansion23 = ${dartValue(registry.LANGUAGE_EXPANSION_23)};
const List<String> kLanguageExpansion25 = ${dartValue(registry.LANGUAGE_EXPANSION_25)};
const Set<String> kRtlLanguages = {${RTL_LANGS.map(dartString).join(', ')}};
`);
emit('lib/core/i18n/generated/startup_copy.g.dart', `${header('src/lib/startup-i18n.ts')}
const Map<String, Map<String, String>> kStartupCopy = ${dartValue(STARTUP_COPY)};
`);
emit('lib/core/i18n/generated/intl_data.g.dart', `${header('Node ICU (Intl) as used by src/lib/date-utils.ts, src/lib/count-format.ts')}
/// Intl.DateTimeFormat(locale, options) templates for the pack languages. Tokens: {d} day, {M} month name,
/// {y} year, {H} 2-digit hour (h23), {m} 2-digit minute. months[i] is the month text in that pattern.
const Map<String, Map<String, (String, List<String>)>> kDateTemplates = {
${Object.entries(dateData).map(([code, variants]) => `  ${dartString(code)}: {\n${Object.entries(variants).map(([variant, t]) => `    ${dartString(variant)}: (${dartString(t.pattern)}, ${dartValue(t.months)}),`).join('\n')}\n  },`).join('\n')}
};
/// Intl.DateTimeFormat(locale, { weekday: 'short' }) Sunday-first.
const Map<String, List<String>> kWeekdayShort = ${dartValue(weekdays)};
/// Intl.NumberFormat symbols: (group, decimal, minus, zero digit, minimum grouping digits).
const Map<String, (String, String, String, String, int)> kNumberSymbols = {
${Object.entries(numberSymbols).map(([code, s]) => `  ${dartString(code)}: (${dartString(s.group)}, ${dartString(s.decimal)}, ${dartString(s.minus)}, ${dartString(s.zero)}, ${s.minGrouping}),`).join('\n')}
};
/// Intl.NumberFormat style 'unit' patterns: lang -> "unit:width" -> plural category -> pattern ({0} = number).
const Map<String, Map<String, Map<String, String>>> kUnitPatterns = ${dartValue(unitPatterns)};
/// ICU root collation primary rank of printable ASCII (0x20..0x7E) for localeCompare(_, 'en').
const List<int> kAsciiPrimaryRank = ${dartValue(asciiPrimary)};
/// Canonical composition pairs (base + combining mark -> composed) for Latin, Cyrillic, Vietnamese.
const Map<String, String> kNfcPairs = ${dartValue(sortObject(nfcPairs))};
`);

// ── Golden fixtures: React-runtime resolution computed from the raw sources ──
// tr(key, d) = cache[lang][key] ?? d, cache = seed (az: az.json). copyText = own || en || key.
function reactTr(lang, key, fallback) { const value = seeds[lang][key]; return value !== undefined ? value : fallback; }
function reactCopy(lang, section, key) { return copies[lang]?.[section]?.[key] || copies.en[section]?.[key] || key; }
const GOLDEN_LANGS = ['az', 'en', 'ru', 'ar', 'tk', 'ja'];
const pick = (list, count) => { const step = Math.max(1, Math.floor(list.length / count)); return list.filter((_, index) => index % step === 0).slice(0, count); };
const seedKeySample = pick(Object.keys(seeds.az).sort(), 60);
const extraKeys = pick(Object.keys(seeds.ja).filter(key => !(key in seeds.az)).sort(), 20);
const inlineSample = [...pick(Object.keys(inlineIndex).filter(key => !inlineIndex[key].admin && !inlineIndex[key].placeholders.length), 25),
  ...pick(Object.keys(inlineIndex).filter(key => inlineIndex[key].placeholders.length), 5)];
const copySample = Object.entries(copies.en).flatMap(([section, values]) => pick(Object.keys(values).sort(), 6).map(key => [section, key]));
const trCases = [];
for (const lang of GOLDEN_LANGS) {
  for (const key of [...seedKeySample, ...extraKeys, 'month_january', 'dateutils_today', 'count_articles_few', 'ordinal_week_label']) {
    const fallback = seeds.az[key] ?? `AZ_DEFAULT:${key}`;
    trCases.push({ lang, key, azDefault: fallback, expected: reactTr(lang, key, fallback) });
  }
  for (const key of inlineSample) trCases.push({ lang, key, azDefault: inlineIndex[key].azText, expected: reactTr(lang, key, inlineIndex[key].azText), file: inlineIndex[key].file });
  trCases.push({ lang, key: '__missing_key__', azDefault: 'Mətn', expected: 'Mətn' });
}
const copyCases = [];
for (const lang of LANGS) for (const [section, key] of copySample) copyCases.push({ lang, section, key, expected: reactCopy(lang, section, key) });
const startupCases = [];
for (const lang of LANGS) for (const key of ['selectLanguage', 'continue', 'retry', 'updateRequired']) startupCases.push({ lang, key, expected: STARTUP_COPY[lang]?.[key] ?? 'FALLBACK' });
const golden = { trCases, copyCases, startupCases, dates: dateGolden, weekdays, units: unitGolden, plurals: pluralGolden,
  numbers: Object.fromEntries(LANGS.map(code => [code, [0, 7, 999, 1000, 12345, 1234567.891, -42.5, 0.25].map(value => [value, new Intl.NumberFormat(locale(code), { maximumFractionDigits: 2 }).format(value)])])),
  collation: (() => {
    const words = ['b', 'a', 'B', 'A', '_x', '-x', 'x1', 'x_1', 'x-1', 'X1', 'id', 'ID', 'Id', 'title_en', 'title', 'titleEn', 'a b', 'a.b', 'a$b', 'zz', '10', '9', '~', 'é', 'e', 'f'];
    return { input: words, sorted: [...words].sort((a, b) => a.localeCompare(b, 'en')) };
  })() };
emit('test/core/i18n/fixtures/golden.json', `${JSON.stringify(golden)}\n`);

// Content samples: real public rows (scripts/i18n/catalog-fixtures.json) and their translations in the
// pack bundles, plus synthetic canonicalisation cases and a small Node-built pack.
const catalog = readJson('scripts/i18n/catalog-fixtures.json');
const contentLangs = ['fr', 'ja', 'tk', 'ky', 'uk'];
const bundles = Object.fromEntries(contentLangs.map(lang => [lang, readJson(`scripts/i18n/content/${lang}.json`)]));
const rows = [];
for (const [table, row] of Object.entries(catalog.rows)) {
  const fields = Object.keys(row).filter(key => key !== 'id' && !/_(?:az|en)$/.test(key));
  const keys = {}, translations = {};
  for (const field of fields) {
    const key = contentTranslationKey(row, field);
    keys[field] = key;
    for (const lang of contentLangs) {
      if (!(key in bundles[lang].values)) throw new Error(`CONTENT_SAMPLE_MISSING ${lang} ${key}`);
      (translations[lang] ??= {})[field] = bundles[lang].values[key];
    }
  }
  rows.push({ table, row, fields, keys, translations });
}
const synthetic = [
  { id: 'syn-1', title: 'Başlıq', title_az: null, title_en: 'Title' },
  { id: 42, info: { b: 1, a: [1, 2.5, { z: true, A: null, _k: 'x', a: 'y', B: 'é' }], 'title_en': 'x', Title: 'Y' }, info_en: 'Line\n"quoted"\t\u0001 \u2028 😀' },
  { id: 'syn-3', data: [1e21, 1e-7, 0.1, 100, -0, 123456789012345680000, 3.14159], data_az: 'x', data_en: { 'é': 1, e: 2, f: 3, E: 4 } },
  { id: 'syn-4', items: ['x', null, false, 'ğ'], items_en: null },
  { id: 'syn-5', missing_en: 'only en' },
].map(row => ({ row, field: Object.keys(row).find(key => key !== 'id'), }))
  .map(({ row, field }) => {
    const value = [row[field] ?? null, row[`${field}_az`] ?? null, row[`${field}_en`] ?? null];
    return { row, field, canonical: canonicalContent(value), key: contentTranslationKey(row, field), canonicalCodeUnit: canonicalJson(value) };
  });
const packValues = {};
for (const sample of rows) for (const field of sample.fields) packValues[sample.keys[field]] = sample.translations.fr[field];
const packBundle = { schema: 'anacan-content-translations-v1', language: 'fr', sourceHash: bundles.fr.sourceHash, values: packValues };
const smallPack = buildLanguagePacks(packBundle);
const splitPack = buildLanguagePacks(packBundle, { targetBytes: 4096 });
const contentFixture = { source: 'scripts/i18n/catalog-fixtures.json + scripts/i18n/content/{fr,ja,tk,ky,uk}.json', rows, synthetic,
  packs: { default: smallPack.files, split: splitPack.files } };
emit('test/core/content_packs/fixtures/content_samples.json', `${JSON.stringify(contentFixture)}\n`);

// ── Write or check ──
let stale = [];
for (const [path, text] of [...outputs].sort(([a], [b]) => a < b ? -1 : 1)) {
  const current = existsSync(path) ? readFileSync(path, 'utf8') : null;
  if (current === text) continue;
  stale.push(relative(ROOT, path));
  if (!CHECK) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, text); }
}
const summary = Object.entries(manifest.languages).map(([lang, info]) => `${lang} keys=${info.keys} missingVsAz=${info.missingVsAz} bytes=${info.bytes}`);
if (CHECK) {
  if (stale.length) { console.error(`i18n export is stale:\n  ${stale.join('\n  ')}\nRun: node app/tool/i18n/export.mjs`); process.exit(1); }
  console.log(`i18n export up to date (${outputs.size} files)`);
} else {
  console.log(summary.join('\n'));
  console.log(`inline keys: ${manifest.inlineKeys} (admin-only ${manifest.inlineKeysAdminOnly}), index bytes ${manifest.inlineIndexBytes}`);
  console.log(`${stale.length} of ${outputs.size} files written`);
}
