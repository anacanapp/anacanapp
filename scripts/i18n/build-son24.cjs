const fs = require('fs');

// ── Yeni açarlar (4 dil) ──
const KEYS = {
  aichat_input_ph: { az: 'Anacan.AI-yə sualınızı yazın...', en: 'Type your question for Anacan.AI...', ru: 'Напишите свой вопрос Anacan.AI...', tr: 'Anacan.AI’ye sorunuzu yazın...' },
  nutrition_food_ph: { az: 'məs. Plov', en: 'e.g. Salad', ru: 'напр. Борщ', tr: 'örn. Menemen' },
  ft_child_name_ph: { az: 'Məsələn: Aysel, Murad...', en: 'For example: Emma, Liam...', ru: 'Например: Алина, Артём...', tr: 'Örneğin: Elif, Emir...' },
  ft_child_names_ph: { az: 'Məsələn: Aysel, Murad, Ləman...', en: 'For example: Emma, Liam, Olivia...', ru: 'Например: Алина, Артём, София...', tr: 'Örneğin: Elif, Emir, Zeynep...' },
  mc_example_prefix: { az: 'Məsələn', en: 'e.g.', ru: 'Например', tr: 'Örnek' },
  rf_urgent_guidance_n: { az: '⚠️ Gözləməyin: dərhal həkiminizə zəng edin və ya təcili yardıma ({n}) müraciət edin.', en: '⚠️ Don\'t wait: call your doctor immediately or contact emergency services ({n}).', ru: '⚠️ Не ждите: немедленно позвоните врачу или в скорую помощь ({n}).', tr: '⚠️ Beklemeyin: hemen doktorunuzu arayın veya acil yardımı ({n}) arayın.' },
};

// ── Mövcud açarların DÜZƏLİŞLƏRİ (DO UPDATE) ──
const OVERRIDES = [
  // Kadın Blogları → Kadınlar için makaleler
  { key: 'blogscreen_ana_bloqu_28124b', lang: 'tr', value: 'Kadınlar için makaleler' },
  // Baş (cm) → Kafa (cm)
  { key: 'babygrowthtracker_bas_sm_927b99', lang: 'tr', value: 'Kafa (cm)' },
  // Onboarding ad nümunələri — mədəniyyətə uyğun adlar
  { key: 'ponb_mommy_name_ph', lang: 'ru', value: 'напр. Алина' },
  { key: 'ponb_mommy_name_ph', lang: 'tr', value: 'örn. Elif' },
  { key: 'ponb_mommy_name_ph', lang: 'en', value: 'e.g. Emma' },
];

// Lokal fayllara yaz
for (const [f, lang] of [['src/locales/az.json', 'az'], ['src/locales/en.json', 'en'], ['scripts/i18n/ru.seed.json', 'ru'], ['scripts/i18n/tr.seed.json', 'tr']]) {
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  let n = 0;
  for (const [k, v] of Object.entries(KEYS)) if (!d[k]) { d[k] = v[lang]; n++; }
  for (const o of OVERRIDES) if (o.lang === lang) { d[o.key] = o.value; n++; }
  fs.writeFileSync(f, JSON.stringify(d, null, 2));
  console.log('✓', f, '+' + n);
}

const esc = (s) => String(s).replace(/'/g, "''");
const insRows = [];
for (const [k, v] of Object.entries(KEYS)) {
  for (const l of ['ru', 'tr', 'en']) insRows.push(`  ('${k}', '${l}', '${esc(v[l])}', 'common')`);
}
const updRows = OVERRIDES.map((o) =>
  `  ('${o.key}', '${o.lang}', '${esc(o.value)}', 'common')`
);

const sql = [
  '-- ============================================================',
  '-- Son24: 1) healthcare_providers ölkə sütunu (+AZ backfill)',
  '--        2) yeni açarlar (təcili nömrə {n}, placeholder-lər)',
  '--        3) mövcud açar düzəlişləri (Kadınlar için makaleler, Kafa cm, ad nümunələri)',
  '-- ============================================================',
  '',
  'ALTER TABLE public.healthcare_providers',
  "  ADD COLUMN IF NOT EXISTS country_code text NOT NULL DEFAULT 'AZ';",
  '',
  "UPDATE public.healthcare_providers SET country_code = 'AZ' WHERE country_code IS NULL;",
  '',
  '-- Yeni açarlar (idempotent)',
  'INSERT INTO public.translations (key, lang, value, namespace) VALUES',
  insRows.join(',\n'),
  'ON CONFLICT (key, lang) DO NOTHING;',
  '',
  '-- Düzəlişlər (mövcud dəyərlərin ÜSTÜNƏ yazılır)',
  'INSERT INTO public.translations (key, lang, value, namespace) VALUES',
  updRows.join(',\n'),
  'ON CONFLICT (key, lang) DO UPDATE SET value = EXCLUDED.value;',
  '',
].join('\n');

fs.writeFileSync('supabase/son/Son24.sql', sql);
fs.writeFileSync('supabase/migrations/20260813150042_country_emergency_placeholders.sql', sql);
console.log('✓ Son24.sql:', insRows.length, 'yeni +', updRows.length, 'düzəliş');
