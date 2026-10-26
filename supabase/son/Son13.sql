-- ============================================================
-- Son13: usage_tracking.feature_type CHECK genişləndirilməsi
-- Yeni gündəlik limitli feature-lər: ai_chat, cry_translator,
-- poop_scanner, fairy_tale, horoscope, baby_insight
-- (Paywall vədlərinin real tətbiqi üçün)
-- ============================================================

ALTER TABLE public.usage_tracking
  DROP CONSTRAINT IF EXISTS usage_tracking_feature_type_check;

ALTER TABLE public.usage_tracking
  ADD CONSTRAINT usage_tracking_feature_type_check
  CHECK (feature_type IN (
    'white_noise', 'baby_photoshoot',
    'ai_chat', 'cry_translator', 'poop_scanner',
    'fairy_tale', 'horoscope', 'baby_insight'
  ));
