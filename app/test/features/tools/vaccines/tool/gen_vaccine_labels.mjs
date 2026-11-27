// Generates app/lib/features/tools/vaccines/vaccine_labels.g.dart from src/lib/vaccine-labels.ts (label packs),
// scripts/i18n/regional-copy.json (regionalText) and Node's ICU (Intl.ListFormat, Intl.NumberFormat unit/long,
// formatRange, Intl.PluralRules, toLocaleUpperCase / toLocaleLowerCase), so Dart needs no Intl unit data.
// Run from the repo root:  node app/test/features/tools/vaccines/tool/gen_vaccine_labels.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const src = readFileSync('src/lib/vaccine-labels.ts', 'utf8');
const langSrc = readFileSync('src/lib/app-languages.ts', 'utf8');
const regional = JSON.parse(readFileSync('scripts/i18n/regional-copy.json', 'utf8')).languages;

const locales = Object.fromEntries([...langSrc.matchAll(/\{ code: '(\w+)',[^}]*locale: '([\w-]+)'/g)].map((m) => [m[1], m[2]]));
const langs = Object.keys(locales);

// P('terms', 'phrases') blocks; strings use '...' or "..." quotes.
const packs = {};
for (const m of src.matchAll(/^\s+(\w+): P\((['"])(.*?)\2,\s*\n\s*(['"])(.*?)\4\),?$/gms)) {
  packs[m[1]] = { terms: m[3].split('|'), phrases: m[5].split('|') };
}
const termKeys = ['tb', 'hepB', 'hepA', 'diph', 'tet', 'pert', 'hib', 'polio', 'pneumo', 'rota', 'measles', 'mumps',
  'rubella', 'varicella', 'mening', 'je', 'yf', 'hpv', 'flu'];
const phraseKeys = ['birth', 'dose', 'booster', 'booster2', 'revacc', 'im', 'oral', 'sc', 'id'];
for (const l of langs) {
  if (!packs[l] || packs[l].terms.length !== termKeys.length || packs[l].phrases.length !== phraseKeys.length) {
    throw new Error(`pack ${l} missing or invalid`);
  }
}
const vaccines = {};
for (const m of src.matchAll(/^\s+(\w+): \{ terms: \[([^\]]*)\], abbr: '([^']+)' \},$/gm)) {
  vaccines[m[1]] = { terms: m[2].split(',').map((s) => s.trim().replace(/'/g, '')), abbr: m[3] };
}
const CASELESS = new Set(['zh', 'ja', 'ko', 'ka', 'ar', 'hi']);
const capitalize = (s, lang) => (CASELESS.has(lang) ? s : s.charAt(0).toLocaleUpperCase(locales[lang]) + s.slice(1));
const joinList = (items, lang) => {
  if (items.length < 2) return items[0] || '';
  try { return new Intl.ListFormat(locales[lang], { style: 'long', type: 'conjunction' }).format(items); } catch { return items.join(', '); }
};
const display = {};
for (const l of langs) {
  if (l === 'az') continue;
  display[l] = {};
  for (const [code, def] of Object.entries(vaccines)) {
    const terms = def.terms.map((t) => packs[l].terms[termKeys.indexOf(t)]);
    display[l][code] = `${capitalize(joinList(terms, l), l)} (${def.abbr})`;
  }
}

// Plural categories for n and n + 0.5 (0..199), pattern per category, range pattern per end category.
const cat = { zero: 'z', one: 'o', two: 't', few: 'f', many: 'm', other: 'x' };
const units = ['day', 'week', 'month', 'year'];
const number = {};
const plural = {};
const unitPatterns = {};
const rangePatterns = {};
for (const l of langs) {
  const loc = locales[l];
  const nf = new Intl.NumberFormat(loc, { maximumFractionDigits: 1 });
  const parts = nf.formatToParts(1234.5);
  number[l] = {
    decimal: parts.find((p) => p.type === 'decimal')?.value ?? '.',
    zero: nf.format(0),
  };
  const pr = new Intl.PluralRules(loc);
  const ints = Array.from({ length: 200 }, (_, i) => cat[pr.select(i)]).join('');
  const halves = Array.from({ length: 200 }, (_, i) => cat[pr.select(i + 0.5)]).join('');
  plural[l] = [ints, halves];
  unitPatterns[l] = {};
  rangePatterns[l] = {};
  for (const u of units) {
    const f = new Intl.NumberFormat(loc, { style: 'unit', unit: u, unitDisplay: 'long', maximumFractionDigits: 1 });
    const pats = {};
    const ranges = {};
    const samples = {};
    for (let i = 0; i < 200; i++) { const c = pr.select(i); if (!(c in samples)) samples[c] = i; }
    for (let i = 0; i < 200; i++) { const c = pr.select(i + 0.5); if (!(c in samples)) samples[c] = i + 0.5; }
    for (const [c, n] of Object.entries(samples)) {
      const text = f.format(n);
      const num = nf.format(n);
      // Arabic "one" / "two" forms carry no digits ("يوم", "يومان").
      pats[cat[c]] = text.includes(num) ? text.replace(num, '{0}') : text;
    }
    // Range pattern per end category (start 3, the first larger value of that category; halves for fractions).
    for (const [c, k] of Object.entries(cat)) {
      if (!(c in samples)) continue;
      for (let i = 8; i < 800; i++) {
        const n = i / 2;
        if (pr.select(n) !== c) continue;
        const r = f.formatRange(3, n);
        const sNum = nf.format(3), eNum = nf.format(n);
        const iS = r.indexOf(sNum), iE = r.lastIndexOf(eNum);
        if (iS >= 0 && iE > iS) { ranges[k] = r.slice(0, iS) + '{0}' + r.slice(iS + sNum.length, iE) + '{1}' + r.slice(iE + eNum.length); break; }
      }
    }
    unitPatterns[l][u] = pats;
    rangePatterns[l][u] = ranges;
  }
}

const birthLower = {};
for (const l of langs) {
  const b = packs[l].phrases[0];
  birthLower[l] = b.charAt(0).toLocaleLowerCase(locales[l]) + b.slice(1);
}

const q = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\$/g, '\\$').replace(/\n/g, '\\n')}'`;
const map = (obj, indent = '  ') => `{\n${Object.entries(obj).map(([k, v]) => `${indent}${q(k)}: ${typeof v === 'string' ? q(v) : Array.isArray(v) ? `[${v.map(q).join(', ')}]` : map(v, indent + '  ')},`).join('\n')}\n${indent.slice(2)}}`;

let out = '// Ported from: src/lib/vaccine-labels.ts (VACCINE_LABEL_PACKS + Intl output), src/lib/regional-i18n.ts\n';
out += '//              (scripts/i18n/regional-copy.json). Generated, do not edit.\n';
out += '// Generator: app/test/features/tools/vaccines/tool/gen_vaccine_labels.mjs (Node ICU)\n';
out += '// ignore_for_file: lines_longer_than_80_chars\n\n';
out += `const List<String> kVaccineTermKeys = [${termKeys.map(q).join(', ')}];\n`;
out += `const List<String> kVaccinePhraseKeys = [${phraseKeys.map(q).join(', ')}];\n\n`;
out += '/// `VACCINE_LABEL_PACKS`: terms (kVaccineTermKeys order) and phrases (kVaccinePhraseKeys order).\n';
out += `const Map<String, Map<String, List<String>>> kVaccineLabelPacks = ${map(Object.fromEntries(langs.map((l) => [l, { terms: packs[l].terms, phrases: packs[l].phrases }])))};\n\n`;
out += '/// `VACCINES`: code (upper-cased) → terms + abbreviation.\n';
out += `const Map<String, ({List<String> terms, String abbr})> kVaccineCodes = {\n${Object.entries(vaccines).map(([k, v]) => `  ${q(k)}: (terms: [${v.terms.map(q).join(', ')}], abbr: ${q(v.abbr)}),`).join('\n')}\n};\n\n`;
out += '/// `capitalize(joinList(terms)) (ABBR)` per language and code (Intl.ListFormat long conjunction).\n';
out += `const Map<String, Map<String, String>> kVaccineDisplayNames = ${map(display)};\n\n`;
out += '/// `p.birth` with a locale lower-case first letter.\n';
out += `const Map<String, String> kVaccineBirthLower = ${map(birthLower)};\n\n`;
out += '/// Intl.NumberFormat: decimal separator and the formatted zero (digit system).\n';
out += `const Map<String, Map<String, String>> kVaccineNumber = ${map(number)};\n\n`;
out += '/// Intl.PluralRules categories (z o t f m x) for 0..199 and 0.5..199.5.\n';
out += `const Map<String, List<String>> kVaccinePlural = ${map(plural)};\n\n`;
out += '/// Intl.NumberFormat unit (long) patterns per category; `{0}` = the formatted number.\n';
out += `const Map<String, Map<String, Map<String, String>>> kVaccineUnitPatterns = ${map(unitPatterns)};\n\n`;
out += '/// `formatRange` patterns per end category; `{0}` / `{1}` = start / end.\n';
out += `const Map<String, Map<String, Map<String, String>>> kVaccineRangePatterns = ${map(rangePatterns)};\n\n`;
out += '/// `regionalText(key, language)` table.\n';
out += `const Map<String, Map<String, String>> kRegionalCopy = ${map(regional)};\n`;
writeFileSync('app/lib/features/tools/vaccines/vaccine_labels.g.dart', out);
console.log('ok', langs.length, Object.keys(vaccines).length);
