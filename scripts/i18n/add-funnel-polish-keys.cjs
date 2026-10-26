const fs = require('fs');

// Yalnız ru/tr əlavə olunacaq (az/en artıq mövcuddur)
const RU_TR_ONLY = {
  paywallstep_3_gunluk_pulsuz_dovrunuz_basladi_d84d42: { ru: 'Ваш 3-дневный бесплатный период начался', tr: '3 günlük ücretsiz döneminiz başladı' },
  paywallstep_alis_ugursuz_ffb098: { ru: 'Покупка не удалась', tr: 'Satın alma başarısız' },
  paywallstep_ayliq_6f265e: { ru: 'Месячный', tr: 'Aylık' },
  paywallstep_butun_aletlere_sinirsiz_giris_2d0db2: { ru: 'Безлимитный доступ ко всем инструментам', tr: 'Tüm araçlara sınırsız erişim' },
  paywallstep_en_serfeli_056ce6: { ru: 'Самый выгодный ·', tr: 'En avantajlı ·' },
  paywallstep_ferdi_heftelik_hesabatlar_4ab67b: { ru: 'Персональные недельные отчёты', tr: 'Kişisel haftalık raporlar' },
  paywallstep_gun_pulsuz_sinaq_0787ff: { ru: 'ДНЕЙ БЕСПЛАТНО', tr: 'GÜN ÜCRETSİZ DENEME' },
  paywallstep_illik_4a3cef: { ru: 'Годовой', tr: 'Yıllık' },
  paywallstep_istediyin_an_legv_et_zemanetli_c95beb: { ru: 'Отменяйте в любой момент · С гарантией', tr: 'İstediğin an iptal et · Garantili' },
  paywallstep_premium_a_kec_2e8b0e: { ru: 'Перейти на Premium', tr: "Premium'a Geç" },
  paywallstep_premium_aktivlesdi_67ea32: { ru: 'Premium активирован 🎉', tr: 'Premium etkinleşti 🎉' },
  paywallstep_qenaet_ea8b53: { ru: '% экономии', tr: '% tasarruf' },
  paywallstep_qiymetler_yuklenir_15aa82: { ru: 'Цены загружаются...', tr: 'Fiyatlar yükleniyor...' },
  paywallstep_reklamsiz_tecrube_2e4fa4: { ru: 'Без рекламы', tr: 'Reklamsız deneyim' },
  paywallstep_tam_imkanlardan_yararlanin_4b72fb: { ru: 'Используйте все возможности', tr: 'Tüm imkanlardan yararlanın' },
  paywallstep_yuxu_sesleri_meditasiya_fb635f: { ru: 'Звуки сна и медитация', tr: 'Uyku Sesleri & Meditasyon' },
  funneldata_ciddi_yuxusuzluq_painpoint: { ru: 'Серьёзная бессонница', tr: 'Ciddi uykusuzluk' },
  funneldata_yuxusuzluq_painpoint: { ru: 'Бессонница', tr: 'Uykusuzluk' },
};

// 4 dildə əlavə olunacaq yeni açarlar
const KEYS = {
  funnel_month_stats: { az: 'aylıq körpəsi olan anaların 82%-i oxşar çətinliklərlə üzləşir.', en: 'months old — 82% of moms with a baby this age face similar challenges.', ru: 'мес. — 82% мам с малышом этого возраста сталкиваются с похожими трудностями.', tr: 'aylık bebeği olan annelerin %82’si benzer zorluklarla karşılaşıyor.' },
  funnel_cycle_stats: { az: 'günlük tsiklinizə əsasən fərdi təhlil hazırladıq.', en: 'day cycle — we prepared a personal analysis based on it.', ru: 'дн. цикл — мы подготовили персональный анализ на его основе.', tr: 'günlük döngünüze göre kişisel analiz hazırladık.' },
  funneldata_ay_1: { az: 'Ay 1', en: 'Month 1', ru: 'Месяц 1', tr: 'Ay 1' },
  funneldata_ay_3: { az: 'Ay 3', en: 'Month 3', ru: 'Месяц 3', tr: 'Ay 3' },
  revtrial_context_bump: { az: '{week}-ci həftə, {tri}-ci trimester', en: 'Week {week}, trimester {tri}', ru: '{week}-я неделя, {tri}-й триместр', tr: '{week}. hafta, {tri}. trimester' },
  revtrial_context_mommy: { az: '{name} — {months} aylıq', en: '{name} — {months} months old', ru: '{name} — {months} мес.', tr: '{name} — {months} aylık' },
  howapphelps_stat_tools: { az: 'Peşəkar alət', en: 'Expert tools', ru: 'Инструментов', tr: 'Profesyonel araç' },
  howapphelps_stat_moms: { az: 'Ana icmada', en: 'Moms in community', ru: 'Мам в сообществе', tr: 'Toplulukta anne' },
  howapphelps_stat_langs: { az: 'Dil dəstəyi', en: 'Languages', ru: 'Языка', tr: 'Dil desteği' },
  howapphelps_trust_line: { az: 'Məzmun həkim baxışından keçir · Məlumatlarınız qorunur', en: 'Content is doctor-reviewed · Your data is protected', ru: 'Контент проверяется врачами · Ваши данные защищены', tr: 'İçerik doktor onaylı · Verileriniz korunur' },
  nutrition_ai_kalori_axtarir: { az: 'AI təyin edir...', en: 'AI is estimating...', ru: 'AI определяет...', tr: 'AI belirliyor...' },
  countryselect_olke_secin: { az: 'Ölkə seçin', en: 'Select country', ru: 'Выберите страну', tr: 'Ülke seçin' },
  countryselect_axtar: { az: 'Axtar...', en: 'Search...', ru: 'Поиск...', tr: 'Ara...' },
  countryselect_tapilmadi: { az: 'Ölkə tapılmadı', en: 'No countries found', ru: 'Страна не найдена', tr: 'Ülke bulunamadı' },
};

for (const [f, lang] of [['src/locales/az.json', 'az'], ['src/locales/en.json', 'en'], ['scripts/i18n/ru.seed.json', 'ru'], ['scripts/i18n/tr.seed.json', 'tr']]) {
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  let n = 0;
  for (const [k, v] of Object.entries(KEYS)) if (!d[k]) { d[k] = v[lang]; n++; }
  if (lang === 'ru' || lang === 'tr') {
    for (const [k, v] of Object.entries(RU_TR_ONLY)) if (!d[k]) { d[k] = v[lang]; n++; }
  }
  fs.writeFileSync(f, JSON.stringify(d, null, 2));
  console.log('✓', f, '+' + n);
}

const esc = (s) => s.replace(/'/g, "''");
const rows = [];
for (const [k, v] of Object.entries(KEYS)) {
  for (const l of ['ru', 'tr', 'en']) rows.push(`  ('${k}', '${l}', '${esc(v[l])}', 'common')`);
}
const en = JSON.parse(fs.readFileSync('src/locales/en.json', 'utf8'));
for (const [k, v] of Object.entries(RU_TR_ONLY)) {
  rows.push(`  ('${k}', 'ru', '${esc(v.ru)}', 'common')`);
  rows.push(`  ('${k}', 'tr', '${esc(v.tr)}', 'common')`);
  if (en[k]) rows.push(`  ('${k}', 'en', '${esc(en[k])}', 'common')`);
}
const sql = [
  '-- Funnel/paywall/ölkə seçici/AI kalori açarları — idempotent',
  'INSERT INTO public.translations (key, lang, value, namespace) VALUES',
  rows.join(',\n'),
  'ON CONFLICT (key, lang) DO NOTHING;',
  '',
].join('\n');
fs.writeFileSync('supabase/migrations/20260813150039_funnel_ui_polish_keys.sql', sql);
fs.copyFileSync('supabase/migrations/20260813150039_funnel_ui_polish_keys.sql', 'supabase/son/Son21.sql');
console.log('✓ Son21.sql +', rows.length, 'sətir');
