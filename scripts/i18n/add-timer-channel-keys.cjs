const fs = require('fs');
const KEYS = {
  livetimer_channel_name: { az: 'Taymerlər', en: 'Timers', ru: 'Таймеры', tr: 'Zamanlayıcılar' },
  livetimer_channel_desc: { az: 'Aktiv süd vermə / yuxu taymerləri', en: 'Active feeding / sleep timers', ru: 'Активные таймеры кормления / сна', tr: 'Aktif emzirme / uyku zamanlayıcıları' },
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
  '-- Timer kanal adı açarları (ru/tr/en) — Son17-yə əlavə',
  'INSERT INTO public.translations (key, lang, value, namespace) VALUES',
  rows.join(',\n'),
  'ON CONFLICT (key, lang) DO NOTHING;',
  '',
].join('\n');
// Son17-nin sonuna əlavə et (yoxlama SELECT-lərindən əvvəl)
let son = fs.readFileSync('supabase/son/Son17.sql', 'utf8');
if (!son.includes('livetimer_channel_name')) {
  son = son.replace('-- Yoxlama: hər iki sorğu 0 qaytarmalıdır', sql + '\n-- Yoxlama: hər iki sorğu 0 qaytarmalıdır');
  fs.writeFileSync('supabase/son/Son17.sql', son);
}
let mig = fs.readFileSync('supabase/migrations/20260813150035_day_notifications_i18n.sql', 'utf8');
if (!mig.includes('livetimer_channel_name')) {
  fs.writeFileSync('supabase/migrations/20260813150035_day_notifications_i18n.sql', mig.trimEnd() + '\n\n' + sql);
}
console.log('✓ Son17 + migration yeniləndi');
