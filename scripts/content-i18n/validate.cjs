/**
 * Content i18n — addım 2.5: VALİDASİYA.
 * out/{ru,tr}/ fayllarındakı hər cədvəl+id+sahənin chunks/-da mövcudluğunu yoxlayır.
 * Səhv UUID / naməlum sahə / boş dəyər aşkarlanır. Massiv uzunluğu da tutuşdurulur.
 */
const fs = require('fs');
const path = require('path');

const CHUNKS = path.join(__dirname, 'chunks');
const OUT = path.join(__dirname, 'out');

const chunkIndex = {}; // table -> { id -> row }
for (const f of fs.readdirSync(CHUNKS).filter((x) => x.endsWith('.json') && !x.startsWith('_'))) {
  const table = path.basename(f, '.json');
  chunkIndex[table] = {};
  for (const row of JSON.parse(fs.readFileSync(path.join(CHUNKS, f), 'utf8'))) {
    chunkIndex[table][row.id] = row;
  }
}

let problems = 0;
const stats = {};

for (const lang of ['ru', 'tr']) {
  const dir = path.join(OUT, lang);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
    const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const tables = path.basename(f).startsWith('_') ? data : { [path.basename(f, '.json')]: data };
    for (const [table, rows] of Object.entries(tables)) {
      if (!chunkIndex[table]) { console.log(`✗ [${lang}/${f}] naməlum cədvəl: ${table}`); problems++; continue; }
      for (const [id, fields] of Object.entries(rows)) {
        const src = chunkIndex[table][id];
        if (!src) { console.log(`✗ [${lang}] ${table}: chunk-da olmayan id: ${id}`); problems++; continue; }
        for (const [field, val] of Object.entries(fields)) {
          // Mənbə: base sütun VƏ YA <field>_az (bəzi cədvəllərdə yalnız _az var)
          const srcVal = (field in src) ? src[field] : src[`${field}_az`];
          if (srcVal === undefined) { console.log(`✗ [${lang}] ${table}/${id}: mənbədə olmayan sahə '${field}'`); problems++; continue; }
          if (val === null || val === undefined || (typeof val === 'string' && !val.trim())) {
            console.log(`✗ [${lang}] ${table}/${id}.${field}: boş dəyər`); problems++;
          }
          if (Array.isArray(srcVal)) {
            if (!Array.isArray(val)) { console.log(`✗ [${lang}] ${table}/${id}.${field}: massiv olmalı idi`); problems++; }
            else if (val.length !== srcVal.length) {
              console.log(`⚠ [${lang}] ${table}/${id}.${field}: massiv uzunluğu ${val.length} ≠ mənbə ${srcVal.length}`); problems++;
            }
          }
        }
        stats[`${table}/${lang}`] = (stats[`${table}/${lang}`] || 0) + 1;
      }
    }
  }
}

console.log('---');
Object.entries(stats).sort().forEach(([k, v]) => {
  const table = k.split('/')[0];
  const total = Object.keys(chunkIndex[table] || {}).length;
  console.log(k.padEnd(38), `${v}/${total}`);
});
console.log(problems === 0 ? '✓ VALİDASİYA TƏMİZ' : `✗ ${problems} PROBLEM`);
process.exitCode = problems ? 1 : 0;
