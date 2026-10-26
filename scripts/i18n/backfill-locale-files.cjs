/**
 * 1605 "inline-default" açarını dil fayllarına backfill edir:
 *   az → src/locales/az.json          (mənbə: koddakı tr('key','default') inline AZ defaultları)
 *   en → src/locales/en.json          (mənbə: mövcud en.json ∪ SQL 'en' insertləri)
 *   ru → scripts/i18n/ru.seed.json    (mənbə: mövcud seed ∪ SQL 'ru' insertləri)
 *   tr → scripts/i18n/tr.seed.json    (mənbə: mövcud seed ∪ SQL 'tr' insertləri)
 *   kk → scripts/i18n/kk.seed.json    (artıq tamdır — yalnız yoxlanılır)
 * Mövcud dəyərlər HEÇ VAXT üstələnmir (yalnız boşluqlar doldurulur).
 * İstifadə: node scripts/i18n/backfill-locale-files.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const MISSING = JSON.parse(fs.readFileSync(path.join(__dirname, 'kk-missing-keys.json'), 'utf8'));
const targetKeys = new Set(MISSING.map((x) => x.key));

// ── 1) Koddan inline AZ defaultlarını çıxar ──
// tr('key', 'default') / tr("key", "default") — default JS string escape-ləri ilə
function unescapeJs(raw) {
  return raw.replace(/\\(u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|.)/g, (m, g) => {
    if (g[0] === 'u') return String.fromCharCode(parseInt(g.slice(1), 16));
    if (g[0] === 'x') return String.fromCharCode(parseInt(g.slice(1), 16));
    const map = { n: '\n', t: '\t', r: '\r', "'": "'", '"': '"', '`': '`', '\\': '\\', '0': '\0' };
    return map[g] ?? g;
  });
}

const azFromCode = new Map();
function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) { walk(p); continue; }
    if (!/\.(tsx?|jsx?)$/.test(f)) continue;
    const s = fs.readFileSync(p, 'utf8');
    // tr( 'key' , 'default' ) — default üçün ' və ya " dırnaq
    const re = /\btr\(\s*(['"])((?:\\.|(?!\1).)*)\1\s*,\s*(['"])((?:\\.|(?!\3).)*)\3/g;
    let m;
    while ((m = re.exec(s))) {
      const key = unescapeJs(m[2]);
      const def = unescapeJs(m[4]);
      if (targetKeys.has(key) && def.trim() && !azFromCode.has(key)) azFromCode.set(key, def);
    }
  }
}
walk(path.join(ROOT, 'src'));
console.log(`Koddan AZ inline default tapıldı: ${azFromCode.size}/${targetKeys.size}`);

// ── 2) SQL insertlərindən ru/tr/en dəyərlərini çıxar ──
const sqlVals = { ru: new Map(), tr: new Map(), en: new Map() };
const unescSql = (s) => s.replace(/''/g, "'");
for (const dir of ['supabase/migrations', 'supabase/son']) {
  const full = path.join(ROOT, dir);
  for (const f of fs.readdirSync(full).filter((x) => x.endsWith('.sql'))) {
    const s = fs.readFileSync(path.join(full, f), 'utf8');
    if (!s.includes('translations')) continue;
    const blocks = s.split(/INSERT INTO public\.translations/i).slice(1);
    for (const b of blocks) {
      const re = /\(\s*'((?:[^']|'')+)'\s*,\s*'(ru|tr|en)'\s*,\s*'((?:[^']|'')*)'/g;
      let m;
      while ((m = re.exec(b))) {
        const key = unescSql(m[1]);
        if (!targetKeys.has(key)) continue;
        const lang = m[2];
        const val = unescSql(m[3]);
        if (val.trim() && !sqlVals[lang].has(key)) sqlVals[lang].set(key, val);
      }
    }
  }
}
console.log(`SQL-dən: ru=${sqlVals.ru.size}, tr=${sqlVals.tr.size}, en=${sqlVals.en.size}`);

// ── 3) Faylları doldur (yalnız boşluqlar) ──
const FILES = {
  az: path.join(ROOT, 'src/locales/az.json'),
  en: path.join(ROOT, 'src/locales/en.json'),
  ru: path.join(__dirname, 'ru.seed.json'),
  tr: path.join(__dirname, 'tr.seed.json'),
  kk: path.join(__dirname, 'kk.seed.json'),
};
const data = Object.fromEntries(Object.entries(FILES).map(([l, p]) => [l, JSON.parse(fs.readFileSync(p, 'utf8'))]));
const ruSeedOld = data.ru, trSeedOld = data.tr;

const added = { az: 0, en: 0, ru: 0, tr: 0 };
const gaps = { az: [], en: [], ru: [], tr: [], kk: [] };

for (const key of targetKeys) {
  // az — koddan
  if (!data.az[key]) {
    const v = azFromCode.get(key);
    if (v) { data.az[key] = v; added.az++; } else gaps.az.push(key);
  }
  // en — en.json artıq var? yoxsa SQL
  if (!data.en[key]) {
    const v = sqlVals.en.get(key);
    if (v) { data.en[key] = v; added.en++; } else gaps.en.push(key);
  }
  // ru — seed var? yoxsa SQL
  if (!data.ru[key]) {
    const v = sqlVals.ru.get(key);
    if (v) { data.ru[key] = v; added.ru++; } else gaps.ru.push(key);
  }
  // tr
  if (!data.tr[key]) {
    const v = sqlVals.tr.get(key);
    if (v) { data.tr[key] = v; added.tr++; } else gaps.tr.push(key);
  }
  // kk — yoxlama
  if (!data.kk[key]) gaps.kk.push(key);
}

for (const [lang, p] of Object.entries(FILES)) {
  if (lang === 'kk') continue; // kk onsuz da tamdır, yenidən yazmağa ehtiyac yoxdur
  fs.writeFileSync(p, JSON.stringify(data[lang], null, 2), 'utf8');
}

console.log('\nƏlavə olundu:');
console.log(`  az.json: +${added.az} (indi ${Object.keys(data.az).length})`);
console.log(`  en.json: +${added.en} (indi ${Object.keys(data.en).length})`);
console.log(`  ru.seed.json: +${added.ru} (indi ${Object.keys(data.ru).length})`);
console.log(`  tr.seed.json: +${added.tr} (indi ${Object.keys(data.tr).length})`);
console.log('\nQalan boşluqlar (mənbə heç yerdə tapılmadı):');
for (const [l, g] of Object.entries(gaps)) {
  console.log(`  ${l}: ${g.length}${g.length ? ' → ' + g.slice(0, 8).join(', ') + (g.length > 8 ? '…' : '') : ''}`);
}
fs.writeFileSync(path.join(__dirname, 'kk-backfill-gaps.json'), JSON.stringify(gaps, null, 1));
