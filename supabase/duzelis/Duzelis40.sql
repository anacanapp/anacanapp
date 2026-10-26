-- Duzelis40: Premium popup (PaywallCore.tsx — həm PremiumModal, həm
-- ReverseTrialFunnel-in paywall addımı, həm də BillingScreen-in tam siyahısı
-- BUNDAN oxuyur) məzmun düzəlişləri:
--   1) "AI Həkim Çatı" xüsusiyyət başlığı → "Anacan AI" (brend adı, bütün
--      dillərdə eyni saxlanılır)
--   2) "Bez Skaneri" xüsusiyyəti tamamilə "Böyümə İzləmə"yə əvəzlənir (eyni
--      sətir/sort_order-da — vizual olaraq "yerinə" keçir)
--   3) "10.000+ qadın" → "1000+ qadın" (pw_social_proof tərcümə açarı,
--      ru/tr/kk/de/ar üçün overlay — az/en artıq JSON fayllarında düzəldilib)
--
-- QEYD: 1) və 2) premium_features CƏDVƏLİNİN sətirləridir (tərcümə açarı
-- DEYİL) — admin panelin "Premium İdarəetmə → Funksiyalar" bölməsində
-- redaktə edilə bilər, bu SQL isə eyni nəticəni birbaşa verir.
-- Idempotent — safe to re-run.

-- 1) "AI Həkim Çatı" → "Anacan AI"
UPDATE public.premium_features
SET
  title = 'Anacan AI',
  title_az = 'Anacan AI',
  title_en = 'Anacan AI',
  title_ru = 'Anacan AI',
  title_tr = 'Anacan AI',
  title_kk = 'Anacan AI',
  title_de = 'Anacan AI',
  title_ar = 'Anacan AI'
WHERE id = 'bb94201a-dd66-416c-abea-f584f484d0a7';

-- 2) "Bez Skaneri" (Poop Scanner) → "Böyümə İzləmə" (Growth Tracking)
UPDATE public.premium_features
SET
  icon = '📈',
  title = 'Growth Tracking',
  title_az = 'Böyümə İzləmə',
  title_en = 'Growth Tracking',
  title_ru = 'Отслеживание роста',
  title_tr = 'Büyüme Takibi',
  title_kk = 'Өсуді бақылау',
  title_de = 'Wachstumsverfolgung',
  title_ar = 'تتبع النمو',
  description = 'Percentile charts',
  description_az = 'Faiz qrafikləri',
  description_en = 'Percentile charts',
  description_ru = 'Процентильные графики',
  description_tr = 'Persentil grafikleri',
  description_kk = 'Пайыздық графиктер',
  description_de = 'Perzentil-Diagramme',
  description_ar = 'مخططات النسبة المئوية'
WHERE id = 'd2602145-8693-4aeb-96d9-ac5247e58c5c';

-- 3) pw_social_proof: "10,000+" → "1000+" (ru/tr/kk/de/ar overlay)
INSERT INTO public.translations (key, lang, value, namespace) VALUES
  ('pw_social_proof', 'ru', 'Нас уже выбрали 1000+ женщин', 'common'),
  ('pw_social_proof', 'tr', '1.000+ kadın bizi seçti', 'common'),
  ('pw_social_proof', 'kk', '1000+ әйел бізді таңдады', 'common'),
  ('pw_social_proof', 'de', 'Über 1.000 Frauen vertrauen uns', 'common'),
  ('pw_social_proof', 'ar', 'اختارتنا أكثر من 1000 امرأة', 'common')
ON CONFLICT (key, lang) DO UPDATE SET value = EXCLUDED.value;
