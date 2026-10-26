// common_saxla açarını 6 dilə əlavə et + Alman7.sql
const fs = require('fs');
const VALS = { az: 'Saxla', en: 'Save', ru: 'Сохранить', tr: 'Kaydet', kk: 'Сақтау', de: 'Speichern' };
const FILES = {
  az: 'src/locales/az.json', en: 'src/locales/en.json',
  ru: 'scripts/i18n/ru.seed.json', tr: 'scripts/i18n/tr.seed.json',
  kk: 'scripts/i18n/kk.seed.json', de: 'scripts/i18n/de.seed.json',
};
for (const [l, p] of Object.entries(FILES)) {
  const d = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!d.common_saxla) { d.common_saxla = VALS[l]; fs.writeFileSync(p, JSON.stringify(d, null, 2)); console.log(p, '+common_saxla'); }
}
for (const [l, p] of [['kk', 'scripts/i18n/kk.out.json'], ['de', 'scripts/i18n/de.out.json']]) {
  const d = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!d.common_saxla) { d.common_saxla = VALS[l]; fs.writeFileSync(p, JSON.stringify(d, null, 1)); }
}
const esc = (s) => s.replace(/'/g, "''");
const rows = ['en', 'ru', 'tr', 'kk', 'de'].map((l) => `  ('common_saxla', '${l}', '${esc(VALS[l])}', 'common')`).join(',\n');
const body = [
  '-- ============================================================',
  '-- Alman7 — common_saxla (PostCard redaktə düyməsi hardcoded idi)',
  '-- ============================================================',
  '',
  'INSERT INTO public.translations (key, lang, value, namespace) VALUES',
  rows,
  'ON CONFLICT (key, lang) DO NOTHING;',
  '',
].join('\n');
fs.writeFileSync('supabase/alman/Alman7.sql', body);
console.log('Alman7.sql yazıldı');
