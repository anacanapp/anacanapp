// ru/tr-də DB translations-da olan, amma kk dəstində olmayan açarları tapır.
// Mənbələr: ru.seed.json, tr.seed.json + bütün migrations/son SQL-lərdəki
// INSERT INTO public.translations ... ('key','ru'|'tr'|'en', ...) sətirləri.
const fs = require('fs');
const path = require('path');

const kk = JSON.parse(fs.readFileSync('scripts/i18n/kk.out.json', 'utf8'));
const az = JSON.parse(fs.readFileSync('src/locales/az.json', 'utf8'));
const ruSeed = JSON.parse(fs.readFileSync('scripts/i18n/ru.seed.json', 'utf8'));
const trSeed = JSON.parse(fs.readFileSync('scripts/i18n/tr.seed.json', 'utf8'));

const en = JSON.parse(fs.readFileSync('src/locales/en.json', 'utf8'));

const dbKeys = new Map(); // key -> Set(langs)
const addKey = (k, lang) => {
  if (!dbKeys.has(k)) dbKeys.set(k, new Set());
  dbKeys.get(k).add(lang);
};
Object.keys(ruSeed).forEach((k) => addKey(k, 'ru'));
Object.keys(trSeed).forEach((k) => addKey(k, 'tr'));
// en.json-da olub az.json-da OLMAYAN açarlar (inline-AZ-default sinfi) — ən böyük boşluq mənbəyi
Object.keys(en).forEach((k) => { if (!az[k]) addKey(k, 'en'); });

// SQL fayllarını skan et
const dirs = ['supabase/migrations', 'supabase/son'];
// ('key', 'ru', 'value'... formatı — value-da escaped '' ola bilər
const re = /\(\s*'((?:[^']|'')+)'\s*,\s*'(ru|tr|en)'\s*,/g;
for (const dir of dirs) {
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.sql'))) {
    const s = fs.readFileSync(path.join(dir, f), 'utf8');
    if (!s.includes('translations')) continue;
    // yalnız INSERT INTO public.translations bloklarında axtar
    const blocks = s.split(/INSERT INTO public\.translations/i).slice(1);
    for (const b of blocks) {
      // blokun sonu: növbəti INSERT-ə qədər (split artıq bunu edir)
      let m;
      while ((m = re.exec(b))) addKey(m[1].replace(/''/g, "'"), m[2]);
    }
  }
}

// Tərcümə mənbəyi prioriteti: az > ru > tr > en
const missingInKk = [];
for (const [k, langs] of dbKeys) {
  if (kk[k]) continue;
  let src = null, srcLang = null;
  if (az[k]) { src = az[k]; srcLang = 'az'; }
  else if (ruSeed[k]) { src = ruSeed[k]; srcLang = 'ru'; }
  else if (trSeed[k]) { src = trSeed[k]; srcLang = 'tr'; }
  else if (en[k]) { src = en[k]; srcLang = 'en'; }
  missingInKk.push({ key: k, langs: [...langs].join(','), srcLang, src });
}
console.log('Ümumi açar kainatı (ru/tr seed + SQL + en-extra):', dbKeys.size);
console.log('kk dəstində OLMAYAN:', missingInKk.length);
const bySrc = {};
missingInKk.forEach((x) => { bySrc[x.srcLang || 'NONE'] = (bySrc[x.srcLang || 'NONE'] || 0) + 1; });
console.log('Mənbə dilinə görə:', JSON.stringify(bySrc));
missingInKk.slice(0, 40).forEach((x) => console.log(` ${x.key} [${x.langs}] src=${x.srcLang} ${JSON.stringify(x.src || '').slice(0, 60)}`));
fs.writeFileSync('scripts/i18n/kk-missing-keys.json', JSON.stringify(missingInKk, null, 1));
console.log('→ scripts/i18n/kk-missing-keys.json');
