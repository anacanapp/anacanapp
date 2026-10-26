-- ============================================================
-- Flow P1: Ovulyasiya testi (OPK) logu
--   flow_daily_logs.ovulation_test — LH test nəticəsi.
--   Fertil pəncərənin simptom-əsaslı dəqiqləşdirilməsi üçün
--   servikal maye (P0) ilə birgə istifadə olunur.
-- ============================================================

ALTER TABLE public.flow_daily_logs
  ADD COLUMN IF NOT EXISTS ovulation_test TEXT
    CHECK (ovulation_test IN ('negative', 'positive', 'peak'));

COMMENT ON COLUMN public.flow_daily_logs.ovulation_test IS
  'OPK/LH test nəticəsi: negative | positive (LH yüksəlişi) | peak (maksimum). Fertil pəncərə dəqiqləşdirməsində istifadə olunur.';
