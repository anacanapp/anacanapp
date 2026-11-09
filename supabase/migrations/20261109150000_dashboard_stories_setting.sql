-- Dashboard stories switch (2026-11-09): app_settings.dashboard_stories = 'off' | 'admin' | 'on'.
--  * 'admin' (default): only admin accounts see the story row (testing); 'on': every Azerbaijani-language user.
--  * The story content ships with the app (src/data/stories/az.ts); this only adds the switch and exposes it to the
--    public allowlist of get_public_app_setting (same list as live, plus the new key).
-- app_settings is already a guarded relation (CDC + writer guard); run through run-sql.py.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
BEGIN
  IF (SELECT count(*) FROM _anacan_gcp_migration.guarded_relations WHERE schema_name = 'public' AND table_name = 'app_settings') <> 1 THEN
    RAISE EXCEPTION 'DASHBOARD_STORIES_GUARD_MISSING';
  END IF;
END $$;

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
      'inapp_onboarding', 'inapp_onboarding_since', 'weaning_tool',
      'parenting_tool', 'dashboard_stories'
    ]::text[]);
$function$;

INSERT INTO public.app_settings (key, value, description)
SELECT 'dashboard_stories', '"admin"'::jsonb, 'Ana səhifə story-ləri: off / admin / on'
 WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'dashboard_stories');

DO $$
BEGIN
  IF public.get_public_app_setting('dashboard_stories') IS NULL OR public.get_public_app_setting('parenting_tool') IS NULL THEN
    RAISE EXCEPTION 'DASHBOARD_STORIES_ALLOWLIST_INCOMPLETE';
  END IF;
END $$;

COMMIT;
NOTIFY pgrst, 'reload schema';
