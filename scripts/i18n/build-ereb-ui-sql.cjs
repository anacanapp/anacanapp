/**
 * UI ar seed → SQL: ar.out.json → ar.seed.json + supabase/ereb/Ereb2*.sql
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = JSON.parse(fs.readFileSync(path.join(__dirname, 'ar.out.json'), 'utf8'));

fs.writeFileSync(path.join(__dirname, 'ar.seed.json'), JSON.stringify(OUT, null, 2), 'utf8');

const esc = (s) => String(s).replace(/'/g, "''");
const entries = Object.entries(OUT).filter(([, v]) => typeof v === 'string' && v.trim());

const statements = [];
for (let i = 0; i < entries.length; i += 500) {
  const slice = entries.slice(i, i + 500);
  statements.push(
    'INSERT INTO public.translations (key, lang, value, namespace) VALUES\n' +
    slice.map(([k, v]) => `  ('${esc(k)}', 'ar', '${esc(v)}', 'common')`).join(',\n') +
    '\nON CONFLICT (key, lang) DO NOTHING;'
  );
}

const header = (n, total) => [
  '-- ============================================================',
  `-- Ereb2${total > 1 ? String.fromCharCode(96 + n) : ''} (${n}/${total}) — UI açarlarının Ərəb (ar) TAM dəsti`,
  `-- ${entries.length} açar (kanonik dəst; qadın cinsi müraciət أنتِ, ماما istisna qaydası)`,
  '-- ƏVVƏL Ereb1.sql işlədilməlidir (app_languages FK). İdempotent.',
  '-- ============================================================',
  '', ''
].join('\n');

const MAX_BYTES = 800 * 1024;
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

const outDir = path.join(ROOT, 'supabase', 'ereb');
fs.mkdirSync(outDir, { recursive: true });
for (const f of fs.readdirSync(outDir).filter((x) => /^Ereb2/.test(x))) fs.unlinkSync(path.join(outDir, f));

parts.forEach((stmts, i) => {
  const name = parts.length === 1 ? 'Ereb2.sql' : `Ereb2${String.fromCharCode(97 + i)}.sql`;
  const body = header(i + 1, parts.length) + stmts.join('\n\n') + '\n';
  fs.writeFileSync(path.join(outDir, name), body, 'utf8');
  console.log(`✓ supabase/ereb/${name} — ${Math.round(Buffer.byteLength(body, 'utf8') / 1024)}KB`);
});
console.log(`Cəmi: ${entries.length} açar | ar.seed.json yeniləndi`);
