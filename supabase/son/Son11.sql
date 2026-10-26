-- ============================================================
-- Son11: profiles.onboarding_answers (jsonb)
-- Yeni sual-əsaslı onboarding (v2) cavabları — gələcək fərdiləşdirmə,
-- push seqmentasiyası və analitika üçün.
-- Nümunə: {"v":2,"multiples":"single","firstPregnancy":"first",
--          "bumpSymptoms":["nausea","fatigue"],"bumpInterests":["development"],
--          "notifications":"granted"}
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_answers jsonb;

COMMENT ON COLUMN public.profiles.onboarding_answers IS
  'Onboarding v2 sual cavabları (jsonb). v açarı versiyanı göstərir.';
