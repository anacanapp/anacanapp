const fs = require('fs');
const KEYS = {
  // AI chat limiti
  aichat_limit_warn_title: { az: 'Pulsuz limit azalır', en: 'Free limit running low', ru: 'Бесплатный лимит заканчивается', tr: 'Ücretsiz limit azalıyor' },
  aichat_limit_warn_desc: { az: 'Bu gün {n} pulsuz sualınız qalıb. Premium ilə limitsizdir.', en: 'You have {n} free questions left today. Unlimited with Premium.', ru: 'Сегодня осталось {n} бесплатных вопросов. С Premium — без лимита.', tr: "Bugün {n} ücretsiz sorunuz kaldı. Premium'la sınırsız." },
  // Baby insight limiti
  babyai_limit_cta: { az: 'Gündəlik pulsuz analiz bitdi — Premium ilə limitsiz', en: 'Daily free analyses used — unlimited with Premium', ru: 'Дневной бесплатный анализ исчерпан — с Premium без лимита', tr: "Günlük ücretsiz analiz bitti — Premium'la sınırsız" },
  // PremiumModal feature adları
  pm_feat_tool: { az: 'Bu alət', en: 'This tool', ru: 'Этот инструмент', tr: 'Bu araç' },
  pm_feat_ai_chat: { az: 'Limitsiz AI söhbəti', en: 'Unlimited AI chat', ru: 'Безлимитный AI-чат', tr: 'Sınırsız AI sohbeti' },
  pm_feat_doctor_report: { az: 'Həkim PDF hesabatı', en: 'Doctor PDF report', ru: 'PDF-отчёт для врача', tr: 'Doktor PDF raporu' },
  pm_feat_baby_insight: { az: 'AI tracker analizi', en: 'AI tracker analysis', ru: 'AI-анализ трекеров', tr: 'AI takip analizi' },
  pm_feat_cry: { az: 'Ağlama tərcüməçisi', en: 'Cry translator', ru: 'Переводчик плача', tr: 'Ağlama çevirmeni' },
  pm_feat_poop: { az: 'Bez analizi', en: 'Diaper analysis', ru: 'Анализ подгузника', tr: 'Bez analizi' },
  pm_feat_fairy: { az: 'AI nağıllar', en: 'AI fairy tales', ru: 'AI-сказки', tr: 'AI masallar' },
  pm_feat_horoscope: { az: 'Ulduz falı analizi', en: 'Horoscope analysis', ru: 'Астрологический анализ', tr: 'Burç analizi' },
  pm_feat_weekly: { az: 'Həftəlik statistika', en: 'Weekly stats', ru: 'Недельная статистика', tr: 'Haftalık istatistik' },
  pm_feat_teething: { az: 'Diş izləyicisi', en: 'Teething tracker', ru: 'Трекер зубов', tr: 'Diş takibi' },
  pm_feat_growth: { az: 'Boy-çəki izləyicisi', en: 'Growth tracker', ru: 'Трекер роста', tr: 'Büyüme takibi' },
  pm_feat_pregdays: { az: 'Bütün günlərə baxış', en: 'View all days', ru: 'Просмотр всех дней', tr: 'Tüm günleri görüntüleme' },
  pm_feat_whitenoise: { az: 'Limitsiz ağ səs', en: 'Unlimited white noise', ru: 'Безлимитный белый шум', tr: 'Sınırsız beyaz gürültü' },
  pm_feat_winback: { az: 'Premium', en: 'Premium', ru: 'Premium', tr: 'Premium' },
  pm_feat_general: { az: 'Premium', en: 'Premium', ru: 'Premium', tr: 'Premium' },
  pm_feat_flow_logger: { az: 'Gündəlik qeydlər', en: 'Daily logging', ru: 'Ежедневные записи', tr: 'Günlük kayıtlar' },
  pm_feat_flow_mood: { az: 'Əhval qrafiki', en: 'Mood chart', ru: 'График настроения', tr: 'Ruh hali grafiği' },
  pm_feat_flow_stats: { az: 'Tsikl statistikası', en: 'Cycle stats', ru: 'Статистика цикла', tr: 'Döngü istatistikleri' },
  pm_feat_flow_trend: { az: 'Trend qrafiki', en: 'Trend chart', ru: 'График трендов', tr: 'Trend grafiği' },
  pm_feat_flow_symptom: { az: 'Simptom hesabatı', en: 'Symptom report', ru: 'Отчёт о симптомах', tr: 'Semptom raporu' },
  pm_feat_flow_reminders: { az: 'Xatırlatmalar', en: 'Reminders', ru: 'Напоминания', tr: 'Hatırlatmalar' },
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
  '-- Premium limit/gate UI açarları (ru/tr/en) — idempotent',
  'INSERT INTO public.translations (key, lang, value, namespace) VALUES',
  rows.join(',\n'),
  'ON CONFLICT (key, lang) DO NOTHING;',
  '',
].join('\n');
fs.writeFileSync('supabase/migrations/20260813150032_premium_limits_ui_keys.sql', sql);
fs.copyFileSync('supabase/migrations/20260813150032_premium_limits_ui_keys.sql', 'supabase/son/Son14.sql');
console.log('✓ Son14.sql +', rows.length, 'sətir');
