-- In-app onboarding tour (Glass guided tour after the first full app open).
--  * app_settings.inapp_onboarding: 'on' | 'off' (default off), switched in Admin → Tənzimləmələr.
--  * app_settings.inapp_onboarding_since: only accounts created after this moment can see the tour
--    (existing users never get it); the client also requires the account to be < 14 days old.
--  * profiles.onboarding_journey: per-user progress {version, status: done|skipped, at, step}, so the
--    tour never repeats, on any device.
BEGIN;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_journey jsonb;
COMMENT ON COLUMN public.profiles.onboarding_journey IS 'Tətbiqdaxili onboarding turu: {version, status, at, step}. NULL = hələ görməyib.';

CREATE OR REPLACE FUNCTION public.get_public_app_setting(p_key text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT a.value
  FROM public.app_settings a
  WHERE a.key = p_key
    AND a.key = ANY(ARRAY[
      'flow_mode_enabled', 'bump_mode_enabled', 'mommy_mode_enabled',
      'dark_mode_enabled', 'mommy_hero_variant', 'force_update',
      'affiliate_section_enabled', 'social_login_enabled',
      'premium_onboarding_enabled', 'community_header_flow',
      'community_header_bump', 'community_header_mommy',
      'premium_paywall_config', 'billing_page_config', 'free_limits',
      'premium_sponsor', 'bottom_nav_style', 'profile_layout',
      'inapp_onboarding', 'inapp_onboarding_since'
    ]::text[]);
$function$;

INSERT INTO public.app_settings (key, value, description)
SELECT 'inapp_onboarding', '"off"'::jsonb, 'Tətbiqdaxili onboarding turu (Glass): on / off'
 WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'inapp_onboarding');

INSERT INTO public.app_settings (key, value, description)
SELECT 'inapp_onboarding_since', to_jsonb(to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')), 'Bu tarixdən sonra qeydiyyatdan keçənlər turu görə bilər'
 WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'inapp_onboarding_since');

COMMIT;
notify pgrst, 'reload schema';
