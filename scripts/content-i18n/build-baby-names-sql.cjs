/**
 * out-names/<lang>.json → idempotent INSERT SQL (baby_names_db), 20260813150021 nümunəsi ilə.
 * kk/de üçün mövcud sütunlar (origin_kk/meaning_kk, origin_de/meaning_de) kifayətdir.
 * ar üçün origin_ar/meaning_ar sütunları YOXDUR — bu skript onları da ADD COLUMN edir.
 *
 * İstifadə: node scripts/content-i18n/build-baby-names-sql.cjs <kk|de|ar> <outFileName>
 */
const fs = require('fs');
const path = require('path');

const LANG = process.argv[2];
const OUT_NAME = process.argv[3] || `Duzelis-names-${LANG}.sql`;
if (!['kk', 'de', 'ar'].includes(LANG)) { console.error('İstifadə: <kk|de|ar> <outFileName>'); process.exit(1); }

const names = JSON.parse(fs.readFileSync(path.join(__dirname, 'out-names', `${LANG}.json`), 'utf8'));
const esc = (s) => String(s ?? '').replace(/'/g, "''");

const lines = [
  '-- ============================================================',
  `-- Baby Names Seed: ${LANG.toUpperCase()} ad dəsti (${names.length} ad, lang sütunu ilə seqmentli)`,
  '-- Əvvəllər bu dil üçün ayrıca seqment yox idi (kk→az, de/ar→en körpüsü ilə göstərilirdi).',
  '-- İdempotent: name+lang üzrə WHERE NOT EXISTS.',
  '-- ============================================================',
  '',
];

if (LANG === 'ar') {
  lines.push(
    '-- ar üçün origin/meaning sütunları hələ yox idi (yalnız az/en/ru/tr/kk/de var idi)',
    'ALTER TABLE public.baby_names_db ADD COLUMN IF NOT EXISTS origin_ar TEXT;',
    'ALTER TABLE public.baby_names_db ADD COLUMN IF NOT EXISTS meaning_ar TEXT;',
    '',
  );
}

const nativeCol = LANG; // origin_kk/meaning_kk, origin_de/meaning_de, origin_ar/meaning_ar
for (const n of names) {
  const cols = `name, gender, origin, meaning, origin_en, meaning_en, origin_${nativeCol}, meaning_${nativeCol}, popularity, is_active, lang`;
  const vals = `'${esc(n.name)}', '${esc(n.gender)}', '${esc(n.origin_az)}', '${esc(n.meaning_az)}', '${esc(n.origin_en)}', '${esc(n.meaning_en)}', '${esc(n.origin_native)}', '${esc(n.meaning_native)}', ${Number(n.popularity) || 50}, true, '${LANG}'`;
  lines.push(
    `INSERT INTO public.baby_names_db (${cols}) SELECT ${vals} WHERE NOT EXISTS (SELECT 1 FROM public.baby_names_db WHERE name = '${esc(n.name)}' AND lang = '${LANG}');`
  );
}
lines.push('');

const outPath = path.join(__dirname, '..', '..', 'supabase', 'duzelis', OUT_NAME);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
console.log(`✓ supabase/duzelis/${OUT_NAME} — ${names.length} ad`);
