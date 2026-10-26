// "Anacan" müraciət-istifadəsi inventarı — UI seedlər + content out/* (3 dil).
// Brend istisnaları: Dr.Anacan, Anacan Premium, Anacan.AI, Anacan AI, Anacan tətbiqi/app/qosımşası
const fs = require('fs');
const path = require('path');

// Brend kontekstlərini müvəqqəti maskala, sonra qalan \bAnacan\b say
const BRAND_PATTERNS = [
  /Dr\.?\s?Anacan/g,
  /Anacan\s+Premium/g,
  /Anacan\.AI/gi,
  /Anacan\s+AI\b/g,
];
function countAddressUses(text) {
  let t = String(text);
  for (const re of BRAND_PATTERNS) t = t.replace(re, '§BRAND§');
  const m = t.match(/\bAnacan\b/g);
  return m ? m.length : 0;
}

console.log('══ UI seed faylları ══');
for (const [name, p] of [
  ['kk.seed', 'scripts/i18n/kk.seed.json'],
  ['ru.seed', 'scripts/i18n/ru.seed.json'],
  ['tr.seed', 'scripts/i18n/tr.seed.json'],
  ['en.json', 'src/locales/en.json'],
]) {
  const d = JSON.parse(fs.readFileSync(p, 'utf8'));
  const hits = Object.entries(d).filter(([, v]) => typeof v === 'string' && countAddressUses(v) > 0);
  console.log(`${name}: ${hits.length} açar`);
  hits.slice(0, 15).forEach(([k, v]) => console.log(`   ${k} => ${JSON.stringify(v).slice(0, 90)}`));
}

console.log('\n══ Content out/* (cədvəl/sahə üzrə) ══');
for (const lang of ['kk', 'ru', 'tr']) {
  const dir = `scripts/content-i18n/out/${lang}`;
  const agg = {}; // table.field -> count
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    let d;
    try { d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { continue; }
    const tables = f.startsWith('_') ? d : { [path.basename(f, '.json')]: d };
    for (const [table, rows] of Object.entries(tables)) {
      for (const fields of Object.values(rows)) {
        for (const [field, val] of Object.entries(fields)) {
          const vals = Array.isArray(val) ? val : [val];
          let n = 0;
          for (const v of vals) if (typeof v === 'string') n += countAddressUses(v);
          if (n > 0) agg[`${table}.${field}`] = (agg[`${table}.${field}`] || 0) + n;
        }
      }
    }
  }
  const entries = Object.entries(agg).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, n]) => s + n, 0);
  console.log(`${lang}: cəmi ${total} istifadə, ${entries.length} sahə`);
  entries.forEach(([k, n]) => console.log(`   ${k}: ${n}`));
}
