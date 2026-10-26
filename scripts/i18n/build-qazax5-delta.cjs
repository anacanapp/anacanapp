/**
 * Qazax5.sql — Qazax2-dən SONRA aşkarlanan çatışmayan UI açarlarının deltası.
 * (az.json-da olmayan, yalnız en.json/ru-tr seed/SQL-də mövcud olan 1605 açar)
 * Həm də kk.seed.json + Qazax2.sql tam yenidən qurulur (təzə quraşdırmalar üçün).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = JSON.parse(fs.readFileSync(path.join(__dirname, 'kk.out.json'), 'utf8'));
const MISSING = JSON.parse(fs.readFileSync(path.join(__dirname, 'kk-missing-keys.json'), 'utf8'));

// 1) kk.seed.json yenilə (tam dəst)
fs.writeFileSync(path.join(__dirname, 'kk.seed.json'), JSON.stringify(OUT, null, 2), 'utf8');
console.log(`✓ kk.seed.json — ${Object.keys(OUT).length} açar (tam)`);

const esc = (s) => String(s).replace(/'/g, "''");

// 2) Qazax5.sql — yalnız delta açarları
const deltaEntries = MISSING
  .map((x) => [x.key, OUT[x.key]])
  .filter(([, v]) => typeof v === 'string' && v.trim());

const statements = [];
for (let i = 0; i < deltaEntries.length; i += 500) {
  const slice = deltaEntries.slice(i, i + 500);
  statements.push(
    'INSERT INTO public.translations (key, lang, value, namespace) VALUES\n' +
    slice.map(([k, v]) => `  ('${esc(k)}', 'kk', '${esc(v)}', 'common')`).join(',\n') +
    '\nON CONFLICT (key, lang) DO NOTHING;'
  );
}

const qazaxDir = path.join(ROOT, 'supabase', 'qazax');
const deltaBody = [
  '-- ============================================================',
  '-- Qazax5 — UI açarlarının DELTASI (Qazax2-dən sonra tapılan boşluqlar)',
  `-- ${deltaEntries.length} açar: az.json-da olmayan, kodda inline-AZ-default olan açarlar`,
  '-- (dashboard salamlama, trimester, bottom nav, partner kartı, billing və s.)',
  '-- Qazax2-ni artıq işlətmisinizsə YALNIZ bunu işlədin. İdempotentdir.',
  '-- ============================================================',
  '', '',
  statements.join('\n\n'),
  '',
].join('\n');
fs.writeFileSync(path.join(qazaxDir, 'Qazax5.sql'), deltaBody, 'utf8');
console.log(`✓ supabase/qazax/Qazax5.sql — ${deltaEntries.length} açar, ${Math.round(Buffer.byteLength(deltaBody, 'utf8') / 1024)}KB`);

// 3) Qazax2.sql tam yenidən qur (təzə quraşdırma tam dəsti alsın)
const allEntries = Object.entries(OUT).filter(([, v]) => typeof v === 'string' && v.trim());
const allStatements = [];
for (let i = 0; i < allEntries.length; i += 500) {
  const slice = allEntries.slice(i, i + 500);
  allStatements.push(
    'INSERT INTO public.translations (key, lang, value, namespace) VALUES\n' +
    slice.map(([k, v]) => `  ('${esc(k)}', 'kk', '${esc(v)}', 'common')`).join(',\n') +
    '\nON CONFLICT (key, lang) DO NOTHING;'
  );
}
const MAX_BYTES = 800 * 1024;
const parts = [];
let cur = [], curBytes = 0;
for (const st of allStatements) {
  const b = Buffer.byteLength(st, 'utf8') + 2;
  if (curBytes + b > MAX_BYTES && cur.length) { parts.push(cur); cur = []; curBytes = 0; }
  cur.push(st);
  curBytes += b;
}
if (cur.length) parts.push(cur);
for (const f of fs.readdirSync(qazaxDir).filter((x) => /^Qazax2/.test(x))) fs.unlinkSync(path.join(qazaxDir, f));
parts.forEach((stmts, i) => {
  const name = parts.length === 1 ? 'Qazax2.sql' : `Qazax2${String.fromCharCode(97 + i)}.sql`;
  const body = [
    '-- ============================================================',
    `-- Qazax2${parts.length > 1 ? String.fromCharCode(96 + i + 1) : ''} (${i + 1}/${parts.length}) — UI açarlarının Qazax (kk) TAM dəsti`,
    `-- ${allEntries.length} açar (az.json + inline-default açarlar daxil) | Azure/gpt-5.6-sol`,
    '-- ƏVVƏL Qazax1.sql işlədilməlidir (app_languages FK). İdempotent.',
    '-- ============================================================',
    '', '',
    stmts.join('\n\n'),
    '',
  ].join('\n');
  fs.writeFileSync(path.join(qazaxDir, name), body, 'utf8');
  console.log(`✓ supabase/qazax/${name} — ${Math.round(Buffer.byteLength(body, 'utf8') / 1024)}KB`);
});
console.log(`Cəmi tam dəst: ${allEntries.length} açar`);
