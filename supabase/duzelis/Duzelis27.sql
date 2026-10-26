-- ============================================================
-- Duzelis27: Üçüz/dördüz seçimlərinin tətbiqdən çıxarılması (sifariş üzrə).
-- Kod tərəfi (PremiumOnboarding.tsx, ProfileEditScreen.tsx,
-- useDynamicOnboarding.ts fallback) artıq yalnız single/twins göstərir.
-- Bu, legacy OnboardingScreen.tsx-in DB-driven multiples_options
-- siyahısını da eyni şəkildə məhdudlaşdırır (useMultiplesOptions()
-- is_active=true filtri edir — bax src/hooks/useDynamicOnboarding.ts:67).
-- Mövcud multiples_type='triplets'/'quadruplets' olan profillərə TƏSİR
-- ETMİR (yalnız YENİ seçim imkanı aradan qalxır, DB-də dəyər qalır,
-- FetalGrowthTracker/BirthOnboardingModal bu istifadəçilər üçün eyni
-- kimi işləməyə davam edir).
-- İdempotent: UPDATE, şərtli, təkrar işlədilməsi zərərsizdir.
-- ============================================================

UPDATE public.multiples_options SET is_active = false WHERE option_id IN ('triplets', 'quadruplets');
