/**
 * Alman8*.sql — en/ru/tr paritet deltası (kanonik 8486-ya çatdırma).
 * parity-miss.json-dakı açarların YENİ dəyərləri seed fayllardan götürülür.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const MISS = JSON.parse(fs.readFileSync(path.join(__dirname, 'parity-miss.json'), 'utf8'));
const EN = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/locales/en.json'), 'utf8'));
const RU = JSON.parse(fs.readFileSync(path.join(__dirname, 'ru.seed.json'), 'utf8'));
const TR = JSON.parse(fs.readFileSync(path.join(__dirname, 'tr.seed.json'), 'utf8'));

const esc = (s) => String(s).replace(/'/g, "''");
const rows = [];
for (const [lang, keys, src] of [['en', MISS.missEn, EN], ['ru', MISS.missRu, RU], ['tr', MISS.missTr, TR]]) {
  let n = 0;
  for (const k of keys) {
    const v = src[k];
    if (typeof v === 'string' && v.trim()) { rows.push(`  ('${esc(k)}', '${lang}', '${esc(v)}', 'common')`); n++; }
  }
  console.log(`${lang}: ${n} sətir`);
}

const statements = [];
for (let i = 0; i < rows.length; i += 500) {
  statements.push(
    'INSERT INTO public.translations (key, lang, value, namespace) VALUES\n' +
    rows.slice(i, i + 500).join(',\n') +
    '\nON CONFLICT (key, lang) DO NOTHING;'
  );
}
const header = (n, total) => [
  '-- ============================================================',
  `-- Alman8${total > 1 ? String.fromCharCode(96 + n) : ''} (${n}/${total}) — en/ru/tr PARİTET deltası`,
  `-- ru/tr ilk dalğada yalnız "istifadə olunan" 4450 açarı almışdı; kk/de isə tam`,
  `-- kanonik dəsti (8486). Bu fayl en(+11)/ru(+3743)/tr(+3743)-ü tam paritetə çatdırır.`,
  '-- İdempotent (DO NOTHING).',
  '-- ============================================================',
  '', ''
].join('\n');

const MAX = 800 * 1024;
const parts = [];
let cur = [], bytes = 0;
for (const st of statements) {
  const b = Buffer.byteLength(st, 'utf8') + 2;
  if (bytes + b > MAX && cur.length) { parts.push(cur); cur = []; bytes = 0; }
  cur.push(st); bytes += b;
}
if (cur.length) parts.push(cur);

const dir = path.join(ROOT, 'supabase', 'alman');
for (const f of fs.readdirSync(dir).filter((x) => /^Alman8/.test(x))) fs.unlinkSync(path.join(dir, f));
parts.forEach((stmts, i) => {
  const name = parts.length === 1 ? 'Alman8.sql' : `Alman8${String.fromCharCode(97 + i)}.sql`;
  const body = header(i + 1, parts.length) + stmts.join('\n\n') + '\n';
  fs.writeFileSync(path.join(dir, name), body);
  console.log(`✓ supabase/alman/${name} — ${Math.round(Buffer.byteLength(body, 'utf8') / 1024)}KB`);
});
console.log(`Cəmi: ${rows.length} sətir, ${parts.length} fayl`);
