/**
 * UI de seed → SQL: de.out.json → de.seed.json + supabase/alman/Alman2*.sql
 * INSERT ... ON CONFLICT (key, lang) DO NOTHING (idempotent), 500 sətirlik dəstələr, ≤800KB hissələr.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = JSON.parse(fs.readFileSync(path.join(__dirname, 'de.out.json'), 'utf8'));

fs.writeFileSync(path.join(__dirname, 'de.seed.json'), JSON.stringify(OUT, null, 2), 'utf8');

const esc = (s) => String(s).replace(/'/g, "''");
const entries = Object.entries(OUT).filter(([, v]) => typeof v === 'string' && v.trim());

const statements = [];
for (let i = 0; i < entries.length; i += 500) {
  const slice = entries.slice(i, i + 500);
  statements.push(
    'INSERT INTO public.translations (key, lang, value, namespace) VALUES\n' +
    slice.map(([k, v]) => `  ('${esc(k)}', 'de', '${esc(v)}', 'common')`).join(',\n') +
    '\nON CONFLICT (key, lang) DO NOTHING;'
  );
}

const header = (n, total) => [
  '-- ============================================================',
  `-- Alman2${total > 1 ? String.fromCharCode(96 + n) : ''} (${n}/${total}) — UI açarlarının Alman (de) TAM dəsti`,
  `-- ${entries.length} açar (az.json + inline-default + community dinamik açarları daxil)`,
  '-- ƏVVƏL Alman1.sql işlədilməlidir (app_languages FK). İdempotent.',
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

const outDir = path.join(ROOT, 'supabase', 'alman');
fs.mkdirSync(outDir, { recursive: true });
for (const f of fs.readdirSync(outDir).filter((x) => /^Alman2/.test(x))) fs.unlinkSync(path.join(outDir, f));

parts.forEach((stmts, i) => {
  const name = parts.length === 1 ? 'Alman2.sql' : `Alman2${String.fromCharCode(97 + i)}.sql`;
  const body = header(i + 1, parts.length) + stmts.join('\n\n') + '\n';
  fs.writeFileSync(path.join(outDir, name), body, 'utf8');
  console.log(`✓ supabase/alman/${name} — ${Math.round(Buffer.byteLength(body, 'utf8') / 1024)}KB`);
});
console.log(`Cəmi: ${entries.length} açar, ${parts.length} fayl | de.seed.json yeniləndi`);
