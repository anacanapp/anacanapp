// Son18: pregnancy/mommy_day_notifications ru+tr tərcümələrindən SQL parçaları yaradır.
// out/{ru,tr}/*.json fayllarından yalnız bu 2 cədvəli yığır.
// İstifadə: node scripts/content-i18n/build-son18.cjs
const fs = require('fs');
const path = require('path');

const TABLES = ['pregnancy_day_notifications', 'mommy_day_notifications'];
const LANGS = ['ru', 'tr'];
const MAX_BYTES = 800 * 1024;
const ROWS_PER_STMT = 250;

const esc = (s) => String(s).replace(/'/g, "''");

// out/-dan yığ: { table: { lang: { id: {title, body} } } }
const data = {};
for (const lang of LANGS) {
  const dir = path.join(__dirname, 'out', lang);
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    let d;
    try { d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { continue; }
    for (const t of TABLES) {
      const rows = f.startsWith('_') ? d[t] : (f === `${t}.json` ? d : null);
      if (!rows) continue;
      data[t] = data[t] || {};
      data[t][lang] = data[t][lang] || {};
      Object.assign(data[t][lang], rows);
    }
  }
}

// SQL bəyanatları
const statements = [];
for (const t of TABLES) {
  for (const lang of LANGS) {
    const rows = Object.entries(data[t]?.[lang] || {});
    if (!rows.length) { console.warn(`⚠ ${t}/${lang}: nəticə yoxdur`); continue; }
    for (let i = 0; i < rows.length; i += ROWS_PER_STMT) {
      const slice = rows.slice(i, i + ROWS_PER_STMT);
      const values = slice.map(([id, v], j) =>
        `  ('${id}'${j === 0 ? '::uuid' : ''}, '${esc(v.title)}', '${esc(v.body)}')`
      ).join(',\n');
      statements.push(
        `UPDATE public.${t} AS x SET title_${lang} = v.t, body_${lang} = v.b\nFROM (VALUES\n${values}\n) AS v(id, t, b)\nWHERE x.id = v.id;`
      );
    }
    console.log(`${t} → ${lang}: ${rows.length} sətir`);
  }
}

// ≤800KB parçalara böl
const header = (n, total) => [
  `-- ============================================================`,
  `-- Son18${String.fromCharCode(96 + n)} (${n}/${total}): Günə-özəl push bildirişlərinin ru+tr tərcüməsi`,
  `-- pregnancy_day_notifications (294) + mommy_day_notifications (4370) — Azure/Fable`,
  `-- ============================================================`,
  '', ''
].join('\n');

const parts = [];
let cur = [];
let curBytes = 0;
for (const st of statements) {
  const b = Buffer.byteLength(st, 'utf8') + 2;
  if (curBytes + b > MAX_BYTES && cur.length) { parts.push(cur); cur = []; curBytes = 0; }
  cur.push(st);
  curBytes += b;
}
if (cur.length) parts.push(cur);

// Köhnə Son18 fayllarını təmizlə
const sonDir = path.join(__dirname, '../../supabase/son');
for (const f of fs.readdirSync(sonDir).filter((x) => /^Son18/.test(x))) fs.unlinkSync(path.join(sonDir, f));

parts.forEach((stmts, i) => {
  let body = header(i + 1, parts.length) + stmts.join('\n\n') + '\n';
  if (i === parts.length - 1) {
    body += [
      '', '-- Yoxlama: hər ikisi ~0 olmalıdır (10 boş-mənbə sətri istisna)',
      `SELECT`,
      `  (SELECT count(*) FROM public.pregnancy_day_notifications WHERE title_ru IS NULL) AS preg_ru_bos,`,
      `  (SELECT count(*) FROM public.mommy_day_notifications WHERE title_ru IS NULL) AS mommy_ru_bos,`,
      `  (SELECT count(*) FROM public.mommy_day_notifications WHERE title_tr IS NULL) AS mommy_tr_bos;`, ''
    ].join('\n');
  }
  const name = `Son18${String.fromCharCode(97 + i)}.sql`;
  fs.writeFileSync(path.join(sonDir, name), body);
  console.log(`✓ supabase/son/${name} — ${Math.round(Buffer.byteLength(body, 'utf8') / 1024)}KB, ${stmts.length} bəyanat`);
});

// Migration nüsxəsi (tam, tək fayl)
const migDir = path.join(__dirname, '../../supabase/migrations');
for (const f of fs.readdirSync(migDir).filter((x) => /^20260813150036_day_notifications_ru_tr/.test(x))) fs.unlinkSync(path.join(migDir, f));
parts.forEach((stmts, i) => {
  const name = `20260813150036_day_notifications_ru_tr_part${String(i + 1).padStart(2, '0')}.sql`;
  fs.writeFileSync(path.join(migDir, name), header(i + 1, parts.length) + stmts.join('\n\n') + '\n');
});
console.log(`✓ migrations: ${parts.length} part`);
