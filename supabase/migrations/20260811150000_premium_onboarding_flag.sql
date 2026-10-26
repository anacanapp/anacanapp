-- ============================================================
-- Premium Onboarding bayrağı
--   Yeni qeydiyyat axını: sadə mərhələ+tarix sualları →
--   ReverseTrialFunnel (quiz → analiz → dəyər → paywall).
--   false edilsə köhnə OnboardingScreen işləyir (client default: aktiv).
-- ============================================================

INSERT INTO public.app_settings (key, value, description) VALUES
  ('premium_onboarding_enabled', 'true', 'Yeni qeydiyyatlarda premium onboarding + funnel axını (false = köhnə onboarding)')
ON CONFLICT (key) DO NOTHING;
