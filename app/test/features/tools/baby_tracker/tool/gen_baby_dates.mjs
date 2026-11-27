// Generates app/lib/features/tools/baby_tracker/baby_dates.g.dart: the date-fns names the Baby tracker formats with
// `getCurrentDateLocale()` (src/lib/date-utils.ts): 'EEEEEE' weekday names (Sunday first) and 'MMM' month names
// (format context) for every app language. Run from the repo root:
//   node app/test/features/tools/baby_tracker/tool/gen_baby_dates.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { format } from 'date-fns';
import * as L from 'date-fns/locale';

const source = readFileSync('src/lib/date-utils.ts', 'utf8');
const arr = (name) => JSON.parse(source.match(new RegExp(`const ${name} = (\\[[^\\]]*\\]);`))[1].replace(/'/g, '"'));
const TK_MONTHS_SHORT = arr('TK_MONTHS_SHORT');
const TK_DAYS_SHORT = arr('TK_DAYS_SHORT');

const byLang = {
  en: L.enUS, ru: L.ru, tr: L.tr, kk: L.kk, de: L.de, ar: L.ar, uz: L.uz, ka: L.ka, zh: L.zhCN, id: L.id, fr: L.fr,
  es: L.es, pt: L.pt, vi: L.vi, hi: L.hi, ja: L.ja, ko: L.ko, pl: L.pl, nl: L.nl, sv: L.sv, et: L.et, uk: L.uk, az: L.az,
};
const langs = ['az', 'en', 'tr', 'ru', 'de', 'ar', 'ka', 'kk', 'uz', 'zh', 'id', 'fr', 'es', 'pt', 'vi', 'hi', 'ja', 'ko', 'pl', 'nl', 'sv', 'ky', 'et', 'tk', 'uk'];
const days = (lang) => {
  if (lang === 'tk') return TK_DAYS_SHORT;
  if (lang === 'ky') {
    const f = new Intl.DateTimeFormat('ky-KG', { weekday: 'short', timeZone: 'UTC' });
    return Array.from({ length: 7 }, (_, i) => f.format(new Date(Date.UTC(2024, 0, 7 + i))));
  }
  return Array.from({ length: 7 }, (_, i) => format(new Date(2024, 0, 7 + i), 'EEEEEE', { locale: byLang[lang] }));
};
const months = (lang) => {
  if (lang === 'tk') return TK_MONTHS_SHORT;
  if (lang === 'ky') {
    const f = new Intl.DateTimeFormat('ky-KG', { month: 'short', timeZone: 'UTC' });
    return Array.from({ length: 12 }, (_, i) => f.format(new Date(Date.UTC(2024, i, 15))));
  }
  return Array.from({ length: 12 }, (_, i) => format(new Date(2024, i, 15), 'MMM', { locale: byLang[lang] }));
};
const q = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\$/g, '\\$')}'`;
const list = (xs) => `[${xs.map(q).join(', ')}]`;
let out = '// Ported from: src/lib/date-utils.ts (getCurrentDateLocale) + date-fns 3 locales (generated, do not edit)\n';
out += '// Generator: app/test/features/tools/baby_tracker/tool/gen_baby_dates.mjs\n\n';
out += '/// date-fns `EEEEEE` weekday names, Sunday first.\n';
out += 'const Map<String, List<String>> kBabyWeekdayShort = {\n';
for (const l of langs) out += `  '${l}': ${list(days(l))},\n`;
out += '};\n\n/// date-fns `MMM` month names (format context).\n';
out += 'const Map<String, List<String>> kBabyMonthShort = {\n';
for (const l of langs) out += `  '${l}': ${list(months(l))},\n`;
out += '};\n';
writeFileSync('app/lib/features/tools/baby_tracker/baby_dates.g.dart', out);
console.log('ok');
