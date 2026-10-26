// Günə-özəl bildirişlərin seed SQL-i (istənilən dil): pregnancy/mommy_day_notifications.
// out/<lang>/*.json fayllarından yalnız bu 2 cədvəli yığır (VALUES-based bulk UPDATE — performans üçün).
// İstifadə: node gen-qazax-daynotif-sql.cjs [--lang kk] [--prefix Qazax4] [--outdir qazax]
//           node gen-qazax-daynotif-sql.cjs --lang de --prefix Alman4 --outdir alman
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const getOpt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? String(args[i + 1]) : d; };
const LANG = getOpt('--lang', 'kk');
const PREFIX = getOpt('--prefix', 'Qazax4');
const OUTDIR = getOpt('--outdir', 'qazax');

const ROOT = path.resolve(__dirname, '..', '..');
const TABLES = ['pregnancy_day_notifications', 'mommy_day_notifications'];
const MAX_BYTES = 800 * 1024;
const ROWS_PER_STMT = 250;

const esc = (s) => String(s).replace(/'/g, "''");

// out/<lang>-dan yığ: { table: { id: {title, body} } }
const data = {};
const dir = path.join(__dirname, 'out', LANG);
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
  let d;
  try { d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { continue; }
  for (const t of TABLES) {
    const rows = f.startsWith('_') ? d[t] : (f === `${t}.json` ? d : null);
    if (!rows) continue;
    data[t] = data[t] || {};
    Object.assign(data[t], rows);
  }
}

// SQL bəyanatları
const statements = [];
let totalRows = 0;
for (const t of TABLES) {
  const rows = Object.entries(data[t] || {}).filter(([, v]) => v?.title && v?.body);
  if (!rows.length) { console.warn(`⚠ ${t}: nəticə yoxdur`); continue; }
  totalRows += rows.length;
  for (let i = 0; i < rows.length; i += ROWS_PER_STMT) {
    const slice = rows.slice(i, i + ROWS_PER_STMT);
    const values = slice.map(([id, v], j) =>
      `  ('${id}'${j === 0 ? '::uuid' : ''}, '${esc(v.title)}', '${esc(v.body)}')`
    ).join(',\n');
    statements.push(
      `UPDATE public.${t} AS x SET title_${LANG} = v.t, body_${LANG} = v.b\nFROM (VALUES\n${values}\n) AS v(id, t, b)\nWHERE x.id = v.id;`
    );
  }
  console.log(`${t} → ${LANG}: ${rows.length} sətir`);
}

// ≤800KB parçalara böl
const header = (n, total) => [
  `-- ============================================================`,
  `-- ${PREFIX}${String.fromCharCode(96 + n)} (${n}/${total}): Günə-özəl push bildirişlərinin ${LANG.toUpperCase()} tərcüməsi`,
  `-- pregnancy_day_notifications + mommy_day_notifications — Azure/gpt-5.6-sol`,
  `-- ƏVVƏL sxem faylı (sütunlar) işlədilməlidir.`,
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

const outSqlDir = path.join(ROOT, 'supabase', OUTDIR);
fs.mkdirSync(outSqlDir, { recursive: true });
for (const f of fs.readdirSync(outSqlDir).filter((x) => x.startsWith(PREFIX))) fs.unlinkSync(path.join(outSqlDir, f));

parts.forEach((stmts, i) => {
  let body = header(i + 1, parts.length) + stmts.join('\n\n') + '\n';
  if (i === parts.length - 1) {
    body += [
      '', '-- Yoxlama: hər ikisi ~0 olmalıdır (boş-mənbə sətirləri istisna olmaqla)',
      `SELECT`,
      `  (SELECT count(*) FROM public.pregnancy_day_notifications WHERE title_${LANG} IS NULL) AS preg_${LANG}_bos,`,
      `  (SELECT count(*) FROM public.mommy_day_notifications WHERE title_${LANG} IS NULL) AS mommy_${LANG}_bos;`, ''
    ].join('\n');
  }
  const name = `${PREFIX}${String.fromCharCode(97 + i)}.sql`;
  fs.writeFileSync(path.join(outSqlDir, name), body);
  console.log(`✓ supabase/${OUTDIR}/${name} — ${Math.round(Buffer.byteLength(body, 'utf8') / 1024)}KB, ${stmts.length} bəyanat`);
});
console.log(`Cəmi: ${totalRows} sətir, ${parts.length} fayl`);
