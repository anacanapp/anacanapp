/**
 * UI kk seed → SQL: kk.out.json → kk.seed.json + supabase/qazax/Qazax2*.sql
 * INSERT ... ON CONFLICT (key, lang) DO NOTHING (idempotent), 500 sətirlik dəstələr, ≤800KB hissələr.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = JSON.parse(fs.readFileSync(path.join(__dirname, 'kk.out.json'), 'utf8'));

// dev overlay + repo seed
fs.writeFileSync(path.join(__dirname, 'kk.seed.json'), JSON.stringify(OUT, null, 2), 'utf8');

const esc = (s) => String(s).replace(/'/g, "''");
const entries = Object.entries(OUT).filter(([, v]) => typeof v === 'string' && v.trim());

const statements = [];
for (let i = 0; i < entries.length; i += 500) {
  const slice = entries.slice(i, i + 500);
  statements.push(
    'INSERT INTO public.translations (key, lang, value, namespace) VALUES\n' +
    slice.map(([k, v]) => `  ('${esc(k)}', 'kk', '${esc(v)}', 'common')`).join(',\n') +
    '\nON CONFLICT (key, lang) DO NOTHING;'
  );
}

const header = (n, total) => [
  '-- ============================================================',
  `-- Qazax2${total > 1 ? String.fromCharCode(96 + n) : ''} (${n}/${total}) — UI açarlarının Qazax (kk) tərcüməsi`,
  `-- ${entries.length} açar | mənbə: scripts/i18n/kk.out.json (Azure/gpt-5.6-sol)`,
  '-- ƏVVƏL Qazax1.sql işlədilməlidir (app_languages FK).',
  '-- İdempotent: ON CONFLICT DO NOTHING — mövcud dəyərlərə toxunmur.',
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

const qazaxDir = path.join(ROOT, 'supabase', 'qazax');
fs.mkdirSync(qazaxDir, { recursive: true });
for (const f of fs.readdirSync(qazaxDir).filter((x) => /^Qazax2/.test(x))) fs.unlinkSync(path.join(qazaxDir, f));

parts.forEach((stmts, i) => {
  const name = parts.length === 1 ? 'Qazax2.sql' : `Qazax2${String.fromCharCode(97 + i)}.sql`;
  const body = header(i + 1, parts.length) + stmts.join('\n\n') + '\n';
  fs.writeFileSync(path.join(qazaxDir, name), body, 'utf8');
  console.log(`✓ supabase/qazax/${name} — ${Math.round(Buffer.byteLength(body, 'utf8') / 1024)}KB`);
});
console.log(`Cəmi: ${entries.length} açar, ${parts.length} fayl`);
