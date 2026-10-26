/**
 * i18n SQL Seed Generator — pipeline addım 4.
 *
 * ru.seed.json + tr.seed.json → supabase/migrations/…_i18n_ru_tr_seed.sql
 * ON CONFLICT (key, lang) DO NOTHING — DB-dəki mövcud (əl ilə yazılmış)
 * tərcümələr HEÇ VAXT üstyazılmır.
 *
 * Run: node scripts/i18n/build-seed-sql.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const OUT_SQL = path.join(ROOT, 'supabase', 'migrations', '20260813100000_i18n_ru_tr_seed.sql');

const esc = (s) => String(s).replace(/'/g, "''");

const lines = [
'-- ============================================================',
'-- i18n Seed: ru + tr UI tərcümələri (Claude Fable 5 ilə generasiya)',
'-- ON CONFLICT DO NOTHING — mövcud əl tərcümələri qorunur.',
'-- Mənbə pipeline: scripts/i18n/ (extract → translate → validate → bu fayl)',
'-- ============================================================',
''];


let total = 0;
for (const lang of ['ru', 'tr']) {
  const file = path.join(__dirname, `${lang}.seed.json`);
  if (!fs.existsSync(file)) {
    console.error(`⚠ ${lang}.seed.json yoxdur — əvvəl merge-validate işlədin`);
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const entries = Object.entries(data);
  total += entries.length;

  lines.push(`-- ── ${lang.toUpperCase()}: ${entries.length} açar ──`);

  // 500-lük multi-row INSERT-lər (oxunaqlı + sürətli)
  const BATCH = 500;
  for (let i = 0; i < entries.length; i += BATCH) {
    const slice = entries.slice(i, i + BATCH);
    lines.push('INSERT INTO public.translations (key, lang, value, namespace) VALUES');
    lines.push(
      slice.
      map(([k, v]) => `  ('${esc(k)}', '${lang}', '${esc(v)}', 'common')`).
      join(',\n')
    );
    lines.push('ON CONFLICT (key, lang) DO NOTHING;');
    lines.push('');
  }
}

fs.writeFileSync(OUT_SQL, lines.join('\n'), 'utf8');
const sizeKb = Math.round(fs.statSync(OUT_SQL).size / 1024);
console.log(`✓ ${OUT_SQL.replace(ROOT + path.sep, '')} yazıldı — ${total} sətir, ${sizeKb} KB`);
