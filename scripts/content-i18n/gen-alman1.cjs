/**
 * Alman1.sql generatoru — de sütunları + app_languages + community CHECK.
 * REGISTRY azure-translate.cjs-dən (regex ilə) + registry-extra.json-dan oxunur.
 * İstifadə: node scripts/content-i18n/gen-alman1.cjs
 */
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, 'azure-translate.cjs'), 'utf8');
const m = src.match(/const REGISTRY = (\{[\s\S]*?\n\});/);
if (!m) { console.error('✗ REGISTRY tapılmadı'); process.exit(1); }
// eslint-disable-next-line no-eval
const REGISTRY = eval(`(${m[1]})`);

const extra = JSON.parse(fs.readFileSync(path.join(__dirname, 'registry-extra.json'), 'utf8'));
for (const [t, cfg] of Object.entries(extra)) REGISTRY[t] = REGISTRY[t] || cfg;

const lines = [
  '-- ============================================================',
  '-- Alman1 — Alman dili (de) inteqrasiyası: SXEM',
  '-- 1) app_languages: de sətri (translations FK bundan asılıdır)',
  '-- 2) Bütün kontent cədvəllərinə <sahə>_de sütunları',
  '-- 3) community_post_translations CHECK: de əlavə olunur (kk qorunur)',
  '-- İdempotentdir — təkrar icra təhlükəsizdir.',
  '-- SIRALAMA: Alman1 → Alman2 (UI açarları) → Alman3+ (kontent)',
  '-- ============================================================',
  '',
  '-- 1) Dil qeydiyyatı',
  "INSERT INTO public.app_languages (code, name, native_name, is_active, sort_order)",
  "VALUES ('de', 'German', 'Deutsch', true, 6)",
  'ON CONFLICT (code) DO UPDATE SET is_active = true, native_name = EXCLUDED.native_name;',
  '',
  '-- 2) Kontent sütunları (_de)',
];

let colCount = 0;
for (const table of Object.keys(REGISTRY).sort()) {
  const cfg = REGISTRY[table];
  const cols = [];
  for (const f of cfg.text || []) cols.push([f, 'TEXT']);
  for (const f of cfg.arrText || []) cols.push([f, 'TEXT']); // JSON-string kimi saxlanan massiv
  for (const f of cfg.arr || []) cols.push([f, 'TEXT[]']);
  for (const f of cfg.json || []) cols.push([f, 'JSONB']);
  if (!cols.length) continue;
  lines.push(`-- ${table}`);
  for (const [f, type] of cols) {
    lines.push(`ALTER TABLE public.${table} ADD COLUMN IF NOT EXISTS ${f}_de ${type};`);
    colCount++;
  }
  lines.push('');
}

lines.push(
  '-- 3) Cəmiyyət tərcümə keşi: de icazəsi (Son27 hələ tətbiq olunmayıbsa ötürülür)',
  'DO $$',
  'BEGIN',
  "  IF to_regclass('public.community_post_translations') IS NOT NULL THEN",
  '    ALTER TABLE public.community_post_translations DROP CONSTRAINT IF EXISTS community_post_translations_lang_check;',
  "    ALTER TABLE public.community_post_translations ADD CONSTRAINT community_post_translations_lang_check CHECK (lang IN ('az','en','ru','tr','kk','de'));",
  '  END IF;',
  'END $$;',
  '',
);

const outPath = path.join(__dirname, '..', '..', 'supabase', 'alman', 'Alman1.sql');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
console.log(`✓ supabase/alman/Alman1.sql — ${Object.keys(REGISTRY).length} cədvəl, ${colCount} sütun`);
