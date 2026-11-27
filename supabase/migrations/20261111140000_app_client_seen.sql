-- App update centre, step 1 (2026-11-11, owner request: find old iOS installs and offer them the update).
--   * app_client_seen: one row per signed-in user with the platform and app version their app last reported.
--     Version source: X-Anacan-Version (native builds from 2026-11-09) or, on iOS, the native user agent
--     "App/<version>.<build> CFNetwork/...", which every iOS build sends. Android's "Dalvik/..." agent has no version. Every native build since March polls get_public_app_setting('force_update') every 5 minutes, so
--     that call records the row (at most once an hour per user). No IP address is stored.
--   * force_update: the live value was saved as a character-spread object (min_version lost, Android link cut to
--     "y.google.com/..."). Reset it to a clean, disabled config so old builds parse it correctly.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

CREATE TABLE IF NOT EXISTS public.app_client_seen (
  user_id uuid PRIMARY KEY,
  platform text NOT NULL CHECK (platform IN ('ios', 'android', 'web', 'other')),
  app_version text CHECK (app_version IS NULL OR length(app_version) <= 20),
  os_version text CHECK (os_version IS NULL OR length(os_version) <= 20),
  user_agent text CHECK (user_agent IS NULL OR length(user_agent) <= 200),
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS app_client_seen_platform_idx ON public.app_client_seen (platform, last_seen DESC);
ALTER TABLE public.app_client_seen ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_client_seen FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.app_client_seen TO service_role;
ALTER TABLE public.app_client_seen OWNER TO pgadmin;

-- Records the caller's platform and reported version. Never raises: version tracking must not break the app.
CREATE OR REPLACE FUNCTION public.app_client_seen_touch_v1()
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  uid uuid := auth.uid();
  h json;
  ua text;
  ver text;
  plat text;
  osv text;
BEGIN
  IF uid IS NULL THEN RETURN; END IF;
  BEGIN
    h := nullif(current_setting('request.headers', true), '')::json;
  EXCEPTION WHEN others THEN h := NULL;
  END;
  IF h IS NULL THEN RETURN; END IF;
  ua := left(coalesce(h->>'user-agent', ''), 200);
  -- X-Anacan-Version when sent; otherwise the iOS native user agent carries it ("App/49.0.19 CFNetwork/... Darwin/...").
  ver := coalesce(nullif(left(trim(coalesce(h->>'x-anacan-version', '')), 20), ''),
                  substring(ua from '^App/([0-9]+(?:\.[0-9]+){0,3}) '));
  plat := CASE WHEN ua ~* '(iphone|ipad|ipod|cfnetwork|darwin)' THEN 'ios'
               WHEN ua ~* 'android|okhttp' THEN 'android'
               WHEN ua ~* 'mozilla' THEN 'web' ELSE 'other' END;
  osv := left(coalesce(substring(ua from '(?:iPhone OS|CPU OS) ([0-9_]+)'), substring(ua from 'Android ([0-9.]+)')), 20);
  INSERT INTO public.app_client_seen AS s (user_id, platform, app_version, os_version, user_agent)
  VALUES (uid, plat, ver, replace(osv, '_', '.'), nullif(ua, ''))
  ON CONFLICT (user_id) DO UPDATE
    SET platform = EXCLUDED.platform, app_version = EXCLUDED.app_version, os_version = EXCLUDED.os_version,
        user_agent = EXCLUDED.user_agent, last_seen = now()
    WHERE s.last_seen < now() - interval '1 hour'
       OR s.app_version IS DISTINCT FROM EXCLUDED.app_version OR s.platform IS DISTINCT FROM EXCLUDED.platform;
EXCEPTION WHEN others THEN
  RAISE WARNING 'app_client_seen_touch_v1: %', SQLERRM;
END $$;
ALTER FUNCTION public.app_client_seen_touch_v1() OWNER TO pgadmin;
REVOKE ALL ON FUNCTION public.app_client_seen_touch_v1() FROM PUBLIC, anon, authenticated;

-- Same contract as before (same keys, same value); now VOLATILE so the force_update poll can record the client.
-- All callers use POST (supabase.rpc), which PostgREST runs read-write for volatile functions.
CREATE OR REPLACE FUNCTION public.get_public_app_setting(p_key text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_key = 'force_update' THEN PERFORM public.app_client_seen_touch_v1(); END IF;
  RETURN (SELECT a.value
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
      ]::text[]));
END $$;

-- Clean, disabled legacy config (old builds read title/message/min_version/android_url/ios_url).
UPDATE public.app_settings SET value = jsonb_build_object(
    'enabled', false,
    'min_version', '50.0',
    'title', 'Yeniləmə tələb olunur',
    'message', 'Tətbiqin yeni versiyası mövcuddur. Davam etmək üçün tətbiqi yeniləyin.',
    'android_url', 'https://play.google.com/store/apps/details?id=com.atlasoon.anacan',
    'ios_url', 'https://apps.apple.com/app/id6758301924'),
  updated_at = now()
WHERE key = 'force_update';

-- Admin view: platform x version for users seen in the last N days.
CREATE OR REPLACE FUNCTION public.admin_app_versions_v1(p_days int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501'; END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('platform', platform, 'version', coalesce(app_version, 'köhnə (başlıqsız)'), 'users', n) ORDER BY platform, n DESC)
    FROM (SELECT platform, app_version, count(*) AS n FROM public.app_client_seen
          WHERE last_seen > now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)))
          GROUP BY 1, 2) t), '[]'::jsonb);
END $$;
ALTER FUNCTION public.admin_app_versions_v1(int) OWNER TO pgadmin;
REVOKE ALL ON FUNCTION public.admin_app_versions_v1(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_app_versions_v1(int) TO authenticated, service_role;

-- CDC/writer guard for the new relation (same contract as Duzelis73).
DO $$
BEGIN
  INSERT INTO _anacan_gcp_migration.guarded_relations(schema_name, table_name, primary_key)
  VALUES ('public', 'app_client_seen', ARRAY['user_id']) ON CONFLICT DO NOTHING;
  DROP TRIGGER IF EXISTS anacan_gcp_writer_guard ON public.app_client_seen;
  DROP TRIGGER IF EXISTS anacan_gcp_change ON public.app_client_seen;
  DROP TRIGGER IF EXISTS anacan_gcp_truncate ON public.app_client_seen;
  CREATE TRIGGER anacan_gcp_writer_guard BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON public.app_client_seen FOR EACH STATEMENT EXECUTE FUNCTION _anacan_gcp_migration.guard_write();
  CREATE TRIGGER anacan_gcp_change AFTER INSERT OR DELETE OR UPDATE ON public.app_client_seen FOR EACH ROW EXECUTE FUNCTION _anacan_gcp_migration.capture_change();
  CREATE TRIGGER anacan_gcp_truncate AFTER TRUNCATE ON public.app_client_seen FOR EACH STATEMENT EXECUTE FUNCTION _anacan_gcp_migration.capture_change();
  IF (SELECT count(*) FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = 'app_client_seen'
         AND tg.tgname IN ('anacan_gcp_writer_guard', 'anacan_gcp_change', 'anacan_gcp_truncate')) <> 3 THEN
    RAISE EXCEPTION 'APP_CLIENT_SEEN_GUARD_INCOMPLETE';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
