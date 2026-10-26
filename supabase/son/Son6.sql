-- Premium blur gate UI açarları (ru/tr/en) — idempotent
INSERT INTO public.translations (key, lang, value, namespace) VALUES
  ('premiumgate_default_title', 'ru', 'Этот раздел доступен в Premium', 'common'),
  ('premiumgate_default_title', 'tr', 'Bu bölüm Premium''da', 'common'),
  ('premiumgate_default_title', 'en', 'This section is Premium', 'common'),
  ('premiumgate_weekly_title', 'ru', 'Недельный обзор развития', 'common'),
  ('premiumgate_weekly_title', 'tr', 'Haftalık gelişim özeti', 'common'),
  ('premiumgate_weekly_title', 'en', 'Weekly development review', 'common'),
  ('premiumgate_weekly_sub', 'ru', 'Статистика сна, кормлений и подгузников — недельный анализ малыша в Premium', 'common'),
  ('premiumgate_weekly_sub', 'tr', 'Uyku, beslenme ve bez istatistikleri — bebeğinizin haftalık analizi Premium''da', 'common'),
  ('premiumgate_weekly_sub', 'en', 'Sleep, feeding and diaper stats — your baby''s weekly analysis in Premium', 'common'),
  ('premiumgate_teething_title', 'ru', 'Трекер прорезывания зубов', 'common'),
  ('premiumgate_teething_title', 'tr', 'Diş çıkarma takibi', 'common'),
  ('premiumgate_teething_title', 'en', 'Teething tracker', 'common'),
  ('premiumgate_teething_sub', 'ru', 'Сроки каждого зуба, симптомы и советы по облегчению — в Premium', 'common'),
  ('premiumgate_teething_sub', 'tr', 'Her dişin zamanı, belirtiler ve rahatlatma rehberi Premium''da', 'common'),
  ('premiumgate_teething_sub', 'en', 'Timing of each tooth, symptoms and soothing guide in Premium', 'common'),
  ('premiumgate_growth_title', 'ru', 'Кривые роста и веса', 'common'),
  ('premiumgate_growth_title', 'tr', 'Boy-kilo büyüme eğrileri', 'common'),
  ('premiumgate_growth_title', 'en', 'Growth curves', 'common'),
  ('premiumgate_growth_sub', 'ru', 'Графики развития по стандартам ВОЗ — в Premium', 'common'),
  ('premiumgate_growth_sub', 'tr', 'DSÖ standartlarıyla karşılaştırmalı gelişim grafikleri Premium''da', 'common'),
  ('premiumgate_growth_sub', 'en', 'WHO-standard comparative growth charts in Premium', 'common')
ON CONFLICT (key, lang) DO NOTHING;
