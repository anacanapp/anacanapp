-- Duzelis36: Mommy Dashboard-dakı Yuxu/Qidalanma/Bez izləmə alətləri +
-- "Bugünkü xülasə" bloku Premium edildi (tək PremiumBlurGate ilə əhatə
-- olunub — bax Dashboard.tsx MommyDashboard). Yeni overlay başlıq/alt mətn
-- açarları, 7 dildə.
-- Idempotent — safe to re-run.

INSERT INTO public.translations (key, lang, value, namespace) VALUES
  ('premiumgate_babycare_title', 'az', 'Qulluq izləmə alətləri', 'common'),
  ('premiumgate_babycare_title', 'en', 'Care tracking tools', 'common'),
  ('premiumgate_babycare_title', 'ru', 'Инструменты отслеживания ухода', 'common'),
  ('premiumgate_babycare_title', 'tr', 'Bakım takip araçları', 'common'),
  ('premiumgate_babycare_title', 'kk', 'Күтім бақылау құралдары', 'common'),
  ('premiumgate_babycare_title', 'de', 'Pflege-Tracking-Tools', 'common'),
  ('premiumgate_babycare_title', 'ar', 'أدوات تتبع الرعاية', 'common'),
  ('premiumgate_babycare_sub', 'az', 'Yuxu, qidalanma və bez dəyişmə qeydləri Premium-da', 'common'),
  ('premiumgate_babycare_sub', 'en', 'Sleep, feeding and diaper change logs are in Premium', 'common'),
  ('premiumgate_babycare_sub', 'ru', 'Записи о сне, кормлении и смене подгузников — в Premium', 'common'),
  ('premiumgate_babycare_sub', 'tr', 'Uyku, beslenme ve bez değiştirme kayıtları Premium''da', 'common'),
  ('premiumgate_babycare_sub', 'kk', 'Ұйқы, тамақтану және жаялық ауыстыру жазбалары Premium-да', 'common'),
  ('premiumgate_babycare_sub', 'de', 'Schlaf-, Fütterungs- und Windelwechsel-Protokolle sind in Premium enthalten', 'common'),
  ('premiumgate_babycare_sub', 'ar', 'سجلات النوم والرضاعة وتغيير الحفاضات في Premium', 'common')
ON CONFLICT (key, lang) DO UPDATE SET value = EXCLUDED.value;
