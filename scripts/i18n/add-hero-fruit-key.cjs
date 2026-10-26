const fs = require('fs');
const KEYS = {
  dashboard_hero_fruit_tpl: {
    az: 'Anacan, hazırda {fruit} boydayam',
    en: "Mommy, right now I'm the size of {fruit}",
    ru: 'Мамочка, сейчас я размером с {fruit}',
    tr: 'Anneciğim şu an {fruit} büyüklükteyim',
  },
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
  '-- Bump hero fruit şablonu (təbii söz sırası hər dildə) — idempotent',
  'INSERT INTO public.translations (key, lang, value, namespace) VALUES',
  rows.join(',\n'),
  'ON CONFLICT (key, lang) DO NOTHING;',
  '',
].join('\n');
fs.writeFileSync('supabase/migrations/20260813150040_hero_fruit_tpl_key.sql', sql);
fs.copyFileSync('supabase/migrations/20260813150040_hero_fruit_tpl_key.sql', 'supabase/son/Son22.sql');
console.log('✓ Son22.sql +', rows.length, 'sətir');
