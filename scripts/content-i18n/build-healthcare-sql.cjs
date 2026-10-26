/**
 * out-hospitals/<ISO2>.json → idempotent INSERT SQL (healthcare_providers).
 * İstifadə: node scripts/content-i18n/build-healthcare-sql.cjs <ISO2> <outFileName>
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ISO2 = process.argv[2];
const OUT_NAME = process.argv[3] || `Duzelis-hospitals-${ISO2}.sql`;
if (!ISO2) { console.error('İstifadə: <ISO2> <outFileName>'); process.exit(1); }

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'out-hospitals', `${ISO2}.json`), 'utf8'));
const esc = (s) => String(s ?? '').replace(/'/g, "''");
const sqlVal = (v) => (v === null || v === undefined || v === '') ? 'NULL' : `'${esc(v)}'`;

const lines = [
  '-- ============================================================',
  `-- Xəstəxana/Klinika Seed: ${data.country_name} (${data.providers.length} provider)`,
  '-- Mənbə: AI-əsaslı "bot" (generate-healthcare-providers.cjs) — YALNIZ məşhur/sabit',
  '-- flaqman xəstəxanalar; əmin olunmayan telefon/veb-sayt sahələri NULL saxlanılıb.',
  '-- ⚠️ Canlıya keçirmədən əvvəl bir neçə sətri əl ilə yoxlamaq tövsiyə olunur.',
  '-- İdempotent: name+country_code üzrə WHERE NOT EXISTS.',
  '-- ============================================================',
  '',
];

for (const p of data.providers) {
  const id = crypto.randomUUID();
  const cols = ['id', 'name', 'name_en', 'provider_type', 'specialty', 'specialty_en', 'city', 'country_code', 'phone', 'website', 'is_featured', 'is_active'];
  const vals = [
    `'${id}'`,
    sqlVal(p.name),
    sqlVal(p.name_en),
    sqlVal(p.provider_type || 'hospital'),
    sqlVal(p.specialty),
    sqlVal(p.specialty_en),
    sqlVal(p.city),
    sqlVal(ISO2),
    sqlVal(p.phone),
    sqlVal(p.website),
    p.is_major_landmark ? 'true' : 'false',
    'true',
  ];
  lines.push(
    `INSERT INTO public.healthcare_providers (${cols.join(', ')}) SELECT ${vals.join(', ')} WHERE NOT EXISTS (SELECT 1 FROM public.healthcare_providers WHERE name = '${esc(p.name)}' AND country_code = '${ISO2}');`
  );
}
lines.push('');

const outPath = path.join(__dirname, '..', '..', 'supabase', 'duzelis', OUT_NAME);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
console.log(`✓ supabase/duzelis/${OUT_NAME} — ${data.providers.length} provider`);
