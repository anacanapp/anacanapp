const fs = require('fs');
const KEYS = {
  babynames_ai_search: { az: 'AI ilə axtar: {name}', en: 'Search with AI: {name}', ru: 'Искать с AI: {name}', tr: 'AI ile ara: {name}' },
  babynames_ai_searching: { az: 'AI axtarır...', en: 'AI is searching...', ru: 'AI ищет...', tr: 'AI arıyor...' },
  babynames_ai_notfound: { az: 'AI bu adı tanımadı — yazılışı yoxlayın', en: "AI didn't recognize this name — check the spelling", ru: 'AI не распознал это имя — проверьте написание', tr: 'AI bu adı tanımadı — yazımı kontrol edin' },
  babynames_ai_error: { az: 'AI axtarışı alınmadı — yenidən cəhd edin', en: 'AI search failed — try again', ru: 'AI-поиск не удался — попробуйте ещё раз', tr: 'AI araması başarısız — tekrar deneyin' },
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
  '-- Baby Names AI axtarış açarları (ru/tr/en) — idempotent',
  'INSERT INTO public.translations (key, lang, value, namespace) VALUES',
  rows.join(',\n'),
  'ON CONFLICT (key, lang) DO NOTHING;',
  '',
].join('\n');
fs.writeFileSync('supabase/migrations/20260813150037_babynames_ai_keys.sql', sql);
fs.copyFileSync('supabase/migrations/20260813150037_babynames_ai_keys.sql', 'supabase/son/Son19.sql');
console.log('✓ Son19.sql +', rows.length, 'sətir');
