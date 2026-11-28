#!/usr/bin/env node
// date-fns golden for formatDatePattern (app/lib/core/i18n/date_utils.dart).
//
//   node app/tool/i18n/date_fns_golden.mjs           print the fixture JSON (save it as
//                                                     app/test/core/i18n/fixtures/date_fns_golden.json)
//   node app/tool/i18n/date_fns_golden.mjs --check   exit 1 when the committed fixture differs
//
// React renders `format(date, pattern, { locale: getCurrentDateLocale() })` (src/lib/date-utils.ts). The ky and tk
// locales below are built exactly like kyrgyzLocale() / turkmenLocale() there (ru resp. tr patterns + Intl ky-KG /
// fixed Turkmen names). Patterns are the ones the Flutter code passes to formatDatePattern / flowFormat.
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const require = createRequire(join(ROOT, 'package.json'));
const { format } = require('date-fns');
const locales = require('date-fns/locale');
const FIXTURE = join(ROOT, 'app/test/core/i18n/fixtures/date_fns_golden.json');

function kyrgyzLocale() {
  const { ru } = locales;
  const names = (options, count, at) => {
    const f = new Intl.DateTimeFormat('ky-KG', { ...options, timeZone: 'UTC' });
    return Array.from({ length: count }, (_, i) => f.format(at(i)));
  };
  const month = width => names({ month: width }, 12, i => new Date(Date.UTC(2024, i, 15)));
  const day = width => names({ weekday: width }, 7, i => new Date(Date.UTC(2024, 0, 7 + i)));
  const wide = month('long'), abbr = month('short'), days = day('long'), shortDays = day('short');
  return { ...ru, code: 'ky', localize: { ...ru.localize,
    month: (index, options) => ((options?.width === 'abbreviated' || options?.width === 'short') ? abbr : wide)[index],
    day: (index, options) => ((options?.width === 'short' || options?.width === 'abbreviated') ? shortDays : days)[index],
  } };
}
const TK_MONTHS = ['ýanwar', 'fewral', 'mart', 'aprel', 'maý', 'iýun', 'iýul', 'awgust', 'sentýabr', 'oktýabr', 'noýabr', 'dekabr'];
const TK_MONTHS_SHORT = ['ýan', 'few', 'mar', 'apr', 'maý', 'iýun', 'iýul', 'awg', 'sen', 'okt', 'noý', 'dek'];
const TK_DAYS = ['ýekşenbe', 'duşenbe', 'sişenbe', 'çarşenbe', 'penşenbe', 'anna', 'şenbe'];
const TK_DAYS_SHORT = ['ýek', 'duş', 'siş', 'çar', 'pen', 'ann', 'şen'];
function turkmenLocale() {
  const trLocale = locales.tr;
  const capital = value => value.charAt(0).toLocaleUpperCase('tr') + value.slice(1);
  const pick = (wide, short, options) => {
    const width = options?.width;
    const list = width === 'narrow' ? wide.map(value => value.charAt(0)) : width === 'abbreviated' || width === 'short' ? short : wide;
    return options?.context === 'standalone' || width === 'narrow' ? list.map(capital) : list;
  };
  return { ...trLocale, code: 'tk', localize: { ...trLocale.localize,
    month: (index, options) => pick(TK_MONTHS, TK_MONTHS_SHORT, options)[index],
    day: (index, options) => pick(TK_DAYS, TK_DAYS_SHORT, options)[index],
  } };
}
const LOCALE = { en: locales.enUS, ru: locales.ru, tr: locales.tr, kk: locales.kk, de: locales.de, ar: locales.ar, uz: locales.uz,
  ka: locales.ka, zh: locales.zhCN, id: locales.id, fr: locales.fr, es: locales.es, pt: locales.pt, vi: locales.vi, hi: locales.hi,
  ja: locales.ja, ko: locales.ko, pl: locales.pl, nl: locales.nl, sv: locales.sv, et: locales.et, ky: kyrgyzLocale(), uk: locales.uk,
  tk: turkmenLocale(), az: locales.az };
const LANGS = ['az', 'en', 'tr', 'ru', 'de', 'ar', 'ka', 'kk', 'uz', 'zh', 'id', 'fr', 'es', 'pt', 'vi', 'hi', 'ja', 'ko', 'pl', 'nl', 'sv', 'ky', 'et', 'tk', 'uk'];
const PATTERNS = ['d MMMM', 'd MMM', 'd MMMM yyyy', 'dd MMMM yyyy', 'd MMM yyyy', 'MMMM yyyy', 'MMMM y', 'EEEE, d MMM', 'd MMMM, EEEE', 'EEE', 'EEEE', 'HH:mm', 'dd.MM.yyyy', 'd.M.yyyy', 'LLLL'];
// Local wall-clock values (no time zone involved): [year, month (1-based), day, hour, minute].
const DATES = [[2025, 1, 5, 9, 5], [2025, 6, 3, 14, 30], [2024, 12, 28, 23, 59], [2026, 3, 17, 0, 0]];

const cases = {};
for (const lang of LANGS) {
  cases[lang] = PATTERNS.map(pattern => [pattern, DATES.map(([y, m, d, h, min]) => format(new Date(y, m - 1, d, h, min), pattern, { locale: LOCALE[lang] }))]);
}
// One line per language and pattern keeps the fixture reviewable.
const text = `{"source": "date-fns 3.6 via app/tool/i18n/date_fns_golden.mjs",\n"dates": ${JSON.stringify(DATES)},\n"cases": {\n${
  LANGS.map(lang => `${JSON.stringify(lang)}: [\n${cases[lang].map(item => `  ${JSON.stringify(item)}`).join(',\n')}\n]`).join(',\n')}\n}}\n`;
// Name tables for formatDatePattern: date-fns `MMMM` / `MMM` (formatting context), `LLLL` (stand-alone),
// `EEEE` / `EEE` (formatting context), i.e. exactly what the React locale renders for those tokens.
const dart = value => `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\$/g, '\\$')}'`;
const list = values => `[${values.map(dart).join(', ')}]`;
const monthDate = i => new Date(2024, i, 15, 12, 0);
const dayDate = i => new Date(2024, 0, 7 + i, 12, 0); // 2024-01-07 is a Sunday
const names = Object.fromEntries(LANGS.map(lang => {
  const f = (date, token) => format(date, token, { locale: LOCALE[lang] });
  const months = token => Array.from({ length: 12 }, (_, i) => f(monthDate(i), token));
  const days = token => Array.from({ length: 7 }, (_, i) => f(dayDate(i), token));
  return [lang, [months('MMMM'), months('MMM'), months('LLLL'), days('EEEE'), days('EEE')]];
}));
const namesDart = `// GENERATED by app/tool/i18n/date_fns_golden.mjs --names from date-fns 3.6 and src/lib/date-utils.ts
// (getCurrentDateLocale, incl. the custom ky / tk locales). Do not edit.
// Ported from: src/lib/date-utils.ts
// ignore_for_file: lines_longer_than_80_chars

/// date-fns names per app language: (MMMM, MMM, LLLL months January-first; EEEE, EEE weekdays Sunday-first).
const Map<String, (List<String>, List<String>, List<String>, List<String>, List<String>)> kDateFnsNames = {
${LANGS.map(lang => `  ${dart(lang)}: (\n${names[lang].map(values => `    ${list(values)},`).join('\n')}\n  ),`).join('\n')}
};
`;
const NAMES_FILE = join(ROOT, 'app/lib/core/i18n/generated/date_fns_names.g.dart');
if (process.argv.includes('--check')) {
  let stale = false;
  for (const [path, expected] of [[FIXTURE, text], [NAMES_FILE, namesDart]]) {
    let current = null;
    try { current = readFileSync(path, 'utf8').replace(/\r\n/g, '\n'); } catch { /* missing */ }
    if (current !== expected) { console.error(`stale: ${path}`); stale = true; }
  }
  if (stale) process.exit(1);
  console.log('date-fns golden and name tables up to date');
} else process.stdout.write(process.argv.includes('--names') ? namesDart : text);
