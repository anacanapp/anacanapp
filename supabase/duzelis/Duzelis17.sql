-- Duzelis17: Premium paywall-dakı ictimai sübut (social proof) mətni düzəldilir.
-- ("pw_social_proof" — PaywallCore.tsx). Əvvəlki mətn "Azərbaycanlı ana" deyirdi —
-- bu, İKİ səbəbdən yanlış idi: (1) tətbiq artıq 7 dildə/çoxlu ölkədə istifadə olunur,
-- yalnız Azərbaycanlı deyil; (2) "ana" (analıq) tətbiqin YALNIZ bir mərhələsinə
-- (mommy) aiddir — dövr (flow) izləyiciləri hamısı ana deyil. "qadın/women" hər
-- ölkəyə və hər 3 mərhələyə (flow/bump/mommy) uyğun düzgün, universal termindir.
-- QEYD: bu, YENİ açar deyil — mövcud "pw_social_proof" açarının DƏYƏRİ düzəldilir.
-- Idempotent — safe to re-run.

INSERT INTO public.translations (key, lang, value, namespace) VALUES
  ('pw_social_proof', 'az', '10,000+ qadın bizi seçib', 'paywall'),
  ('pw_social_proof', 'en', '10,000+ women already chose us', 'paywall'),
  ('pw_social_proof', 'ru', 'Нас уже выбрали 10 000+ женщин', 'paywall'),
  ('pw_social_proof', 'tr', '10.000+ kadın bizi seçti', 'paywall'),
  ('pw_social_proof', 'kk', '10,000+ әйел бізді таңдады', 'paywall'),
  ('pw_social_proof', 'de', 'Über 10.000 Frauen vertrauen uns', 'paywall'),
  ('pw_social_proof', 'ar', 'اختارتنا أكثر من 10,000 امرأة', 'paywall')
ON CONFLICT (key, lang) DO UPDATE SET value = EXCLUDED.value;
