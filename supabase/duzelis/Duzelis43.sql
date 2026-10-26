-- ============================================================
-- Duzelis43: app_settings-in public SELECT-i itirilmesinden yaranan
-- geniş miqyaslı, sessiz reqressiya
--
-- KOK SEBEB: 20260514093759 ve 20260514094740 miqrasiyalari
-- `app_settings` cedvelinden "Anyone can view app settings" SELECT
-- policy-sini TAMAMILE sildi (Epoint API açarlarının (epoint_public_key/
-- epoint_private_key) hər kəsə açıq oxuna bilməsinin qarşısını almaq
-- üçün, düzgün niyyət) - amma əvəzinə heç bir dar-hədəfli SELECT yolu
-- qoyulmadı. Nəticədə `useAppSetting(key)` (src/hooks/useAppSettings.ts)
-- vasitəsilə oxunan HƏR bir "təhlükəsiz" (qeyri-sensitiv) açar da real
-- (admin olmayan) istifadəçilər üçün sıfır sətir qaytarır - admin panelin
-- özündə isə (admin RLS-ə görə) hər şey normal görünür, ona görə bu ay
-- ərzində heç kim tərəfindən hiss olunmayıb. Təsdiqlənmiş, real təsirlənən
-- canlı funksiyalar:
--   - mommy_hero_variant (MommyHero.tsx) - admin seçdiyi variant heç vaxt
--     tətbiq olunmur, həmişə defolt 'classic' göstərilir
--   - social_login_enabled (AuthScreen.tsx) - Google/Apple düymələrini
--     gizlətmək/göstərmək üçün admin keçidi işləmir
--   - affiliate_section_enabled (AffiliateProducts.tsx) - "Bölməni
--     deaktiv et" keçidi real istifadəçilər üçün heç vaxt işləməyib
--   - community_header_flow/bump/mommy (CommunityScreen.tsx) - admin-in
--     yazdığı başlıq mətni heç vaxt görünmür
--   - premium_paywall_config / billing_page_config (usePaywallConfig.ts,
--     PaywallDesignerTab/BillingDesignerTab-də redaktə olunur) - real
--     müştərilər həmişə kod-daxili defolt dəyərləri görür, admin-in
--     dizayn etdiyi versiya deyil
--   - force_update (useForceUpdate.ts) - məcburi yeniləmə tam işləmir
--   - premium_onboarding_enabled (Index.tsx) - admin bu keçidi geri
--     "false" edə bilmir (dəyər oxuna bilmədiyi üçün həmişə true kimi
--     davranır - hazırkı defolt davranışla üst-üstə düşdüyü üçün indiyə
--     kimi görünməz qalıb)
--
-- HƏLL: `get_active_payment_methods()` ilə eyni artıq sınanmış nümunə -
-- yalnız açıq şəkildə TƏHLÜKƏSİZ (sensitiv olmayan) açarların siyahısını
-- qaytaran, SECURITY DEFINER, dar-hədəfli bir funksiya. Epoint
-- açarları/digər sensitiv sirlər bu allowlist-də YOXDUR və heç vaxt
-- əlavə edilməməlidir.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_public_app_setting(p_key text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.value
  FROM public.app_settings a
  WHERE a.key = p_key
    AND a.key = ANY(ARRAY[
      'flow_mode_enabled', 'bump_mode_enabled', 'mommy_mode_enabled',
      'dark_mode_enabled', 'mommy_hero_variant', 'force_update',
      'affiliate_section_enabled', 'social_login_enabled',
      'premium_onboarding_enabled', 'community_header_flow',
      'community_header_bump', 'community_header_mommy',
      'premium_paywall_config', 'billing_page_config', 'free_limits'
    ]::text[]);
$$;

GRANT EXECUTE ON FUNCTION public.get_public_app_setting(text) TO anon, authenticated;
