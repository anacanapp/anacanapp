-- Tərbiyə (2026-11-07): evidence-based positive parenting tool for children 0–12 (Ana module, Azerbaijani only).
--
--   * app_settings.parenting_tool ('on' | 'off', default 'off') is the admin switch (Admin → Tənzimləmələr) and is
--     added to the public allowlist RPC; the client also hides the tile for non-Azerbaijani app languages;
--   * the tile is app-defined (virtual, like baby-tracker / solid-food-guide), so no tool_configs row is needed;
--   * no new relation: programme progress, quiz results and bookmarks stay on the phone (localStorage per account).
--
-- Applied by /home/anacan-runner/run-sql.py (psql as supabase_admin, ON_ERROR_STOP, one transaction).
-- app_settings is already enrolled in CDC and writer guarding (the migration refuses otherwise). No cron or timer.
-- NOT APPLIED YET.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
BEGIN
  IF to_regclass('_anacan_gcp_migration.guarded_relations') IS NULL THEN
    RAISE EXCEPTION 'PARENTING_GUARD_CATALOG_MISSING';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM _anacan_gcp_migration.guarded_relations WHERE schema_name = 'public' AND table_name = 'app_settings') THEN
    RAISE EXCEPTION 'PARENTING_APP_SETTINGS_NOT_GUARDED';
  END IF;
END $$;

INSERT INTO public.app_settings (key, value, description)
SELECT 'parenting_tool', '"off"'::jsonb, 'Tərbiyə aləti (Ana modulu, 0–12 yaş, yalnız az dili): on / off'
 WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'parenting_tool');

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
      'parenting_tool'
    ]::text[]);
$function$;

NOTIFY pgrst, 'reload schema';
COMMIT;
