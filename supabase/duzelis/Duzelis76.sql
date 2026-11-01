-- Duzelis76 (2026-11-02): remote switch for the native store review prompt.
--
--   * app_settings.review_prompts = {"enabled": false, "min_build_ios": null, "min_build_android": null,
--     "cooldown_days": 60}. Seeded OFF: the app asks for a store review only after an admin turns it on
--     (after the crash fix ships) and only on native builds at or above min_build_<platform>.
--   * get_review_prompt_config_v1(): read-only, returns just that value to signed-in users. The existing
--     get_public_app_setting allowlist is not touched.
--   * app_settings is already CDC/writer guarded (the migration refuses otherwise). No new relation.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM _anacan_gcp_migration.guarded_relations WHERE schema_name = 'public' AND table_name = 'app_settings') THEN
    RAISE EXCEPTION 'D76_APP_SETTINGS_NOT_GUARDED';
  END IF;
END $$;

INSERT INTO public.app_settings (key, value, description)
SELECT 'review_prompts',
       '{"enabled": false, "min_build_ios": null, "min_build_android": null, "cooldown_days": 60}'::jsonb,
       'Native store review prompt (milestone, pregnancy week, day 7). Keep disabled until the crash fix build is live.'
WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'review_prompts');

CREATE OR REPLACE FUNCTION public.get_review_prompt_config_v1()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $$
  SELECT CASE WHEN jsonb_typeof(a.value) = 'string' THEN (a.value #>> '{}')::jsonb ELSE a.value END
    FROM public.app_settings a WHERE a.key = 'review_prompts';
$$;

ALTER FUNCTION public.get_review_prompt_config_v1() OWNER TO pgadmin;
REVOKE ALL ON FUNCTION public.get_review_prompt_config_v1() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_review_prompt_config_v1() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
