const fs = require('fs');
const KEYS = {
  premiumgate_default_title: { az: 'Bu bölmə Premium-dadır', en: 'This section is Premium', ru: 'Этот раздел доступен в Premium', tr: "Bu bölüm Premium'da" },
  premiumgate_weekly_title: { az: 'Həftəlik inkişaf icmalı', en: 'Weekly development review', ru: 'Недельный обзор развития', tr: 'Haftalık gelişim özeti' },
  premiumgate_weekly_sub: { az: 'Yuxu, qidalanma və bez statistikası — körpənizin həftəlik analizi Premium-da', en: "Sleep, feeding and diaper stats — your baby's weekly analysis in Premium", ru: 'Статистика сна, кормлений и подгузников — недельный анализ малыша в Premium', tr: "Uyku, beslenme ve bez istatistikleri — bebeğinizin haftalık analizi Premium'da" },
  premiumgate_teething_title: { az: 'Diş çıxarma izləyicisi', en: 'Teething tracker', ru: 'Трекер прорезывания зубов', tr: 'Diş çıkarma takibi' },
  premiumgate_teething_sub: { az: 'Hər dişin vaxtı, simptomlar və rahatlatma bələdçisi Premium-da', en: 'Timing of each tooth, symptoms and soothing guide in Premium', ru: 'Сроки каждого зуба, симптомы и советы по облегчению — в Premium', tr: "Her dişin zamanı, belirtiler ve rahatlatma rehberi Premium'da" },
  premiumgate_growth_title: { az: 'Boy-çəki artım əyriləri', en: 'Growth curves', ru: 'Кривые роста и веса', tr: 'Boy-kilo büyüme eğrileri' },
  premiumgate_growth_sub: { az: 'ÜST standartları ilə müqayisəli inkişaf qrafikləri Premium-da', en: 'WHO-standard comparative growth charts in Premium', ru: 'Графики развития по стандартам ВОЗ — в Premium', tr: "DSÖ standartlarıyla karşılaştırmalı gelişim grafikleri Premium'da" },
};

for (const [f, lang] of [['src/locales/az.json', 'az'], ['src/locales/en.json', 'en'], ['scripts/i18n/ru.seed.json', 'ru'], ['scripts/i18n/tr.seed.json', 'tr']]) {
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  let n = 0;
  for (const [k, v] of Object.entries(KEYS)) if (!d[k]) { d[k] = v[lang]; n++; }
  fs.writeFileSync(f, JSON.stringify(d, null, 2));
  console.log('✓', f, '+' + n);
}

const esc = (s) => s.replace(/'/g, "''");
const rows = [];
for (const [k, v] of Object.entries(KEYS)) {
  for (const l of ['ru', 'tr', 'en']) rows.push(`  ('${k}', '${l}', '${esc(v[l])}', 'common')`);
}
const sql = [
  '-- Premium blur gate UI açarları (ru/tr/en) — idempotent',
  'INSERT INTO public.translations (key, lang, value, namespace) VALUES',
  rows.join(',\n'),
  'ON CONFLICT (key, lang) DO NOTHING;',
  '',
].join('\n');
fs.writeFileSync('supabase/migrations/20260813150024_premiumgate_ui_keys.sql', sql);
fs.copyFileSync('supabase/migrations/20260813150024_premiumgate_ui_keys.sql', 'supabase/son/Son6.sql');
console.log('✓ Son6.sql +', rows.length, 'sətir');
