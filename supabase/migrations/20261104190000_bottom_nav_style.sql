-- Bottom navigation style switch: 'capsule' (floating dark capsule, test) or 'classic' (previous pill).
-- Admins change it in app_settings; the app reads it through the public allowlist RPC, so it can be
-- reverted without a new native build. No new relation; app_settings already has CDC and writer guard.
BEGIN;

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
      'premium_sponsor', 'bottom_nav_style'
    ]::text[]);
$function$;

INSERT INTO public.app_settings (key, value, description)
SELECT 'bottom_nav_style', '"capsule"'::jsonb, 'Alt menyu stili: capsule (üzən kapsul, test) və ya classic (köhnə)'
 WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'bottom_nav_style');

COMMIT;
