-- App update centre, step 2 (2026-11-11). Owner request: update prompts per language, per platform, forced or not.
--   * app_update_rules: admin-defined rules (mode force | soft | banner, platform, version range, languages,
--     countries, audience, frequency, per-language texts, schedule).
--   * app_settings.store_versions: the version each store currently serves. A rule is only shown when the store
--     already has the version it asks for, so nobody is stuck on a screen they cannot complete.
--   * get_app_update_v1: the one decision for the calling app (new builds).
--   * get_public_app_setting('force_update'): old builds only understand this key. When a force rule matches the
--     caller (platform and version from the native user agent / X-Anacan-Version, language from user_preferences),
--     it returns that rule as the legacy object; otherwise the stored legacy value.
--   * admin_app_update_audience_v1: how many recently seen users a rule would reach.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

CREATE TABLE IF NOT EXISTS public.app_update_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  mode text NOT NULL CHECK (mode IN ('force', 'soft', 'banner')),
  platform text NOT NULL DEFAULT 'both' CHECK (platform IN ('ios', 'android', 'both')),
  below_version text NOT NULL CHECK (public.app_version_parts_v1(below_version) IS NOT NULL),
  min_version text CHECK (min_version IS NULL OR public.app_version_parts_v1(min_version) IS NOT NULL),
  languages text[] CHECK (languages IS NULL OR cardinality(languages) BETWEEN 1 AND 30),
  countries text[] CHECK (countries IS NULL OR cardinality(countries) BETWEEN 1 AND 250),
  audience text NOT NULL DEFAULT 'test' CHECK (audience IN ('test', 'all', 'percent')),
  percent int NOT NULL DEFAULT 100 CHECK (percent BETWEEN 0 AND 100),
  frequency text NOT NULL DEFAULT 'daily' CHECK (frequency IN ('every_launch', 'daily', 'once')),
  texts jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(texts) = 'object' AND octet_length(texts::text) <= 60000),
  ios_url text CHECK (ios_url IS NULL OR ios_url ~ '^https://'),
  android_url text CHECK (android_url IS NULL OR android_url ~ '^https://'),
  starts_at timestamptz,
  ends_at timestamptz,
  priority int NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
ALTER TABLE public.app_update_rules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_update_rules FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_update_rules TO authenticated;
GRANT ALL ON public.app_update_rules TO service_role;
DROP POLICY IF EXISTS app_update_rules_admin ON public.app_update_rules;
CREATE POLICY app_update_rules_admin ON public.app_update_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
ALTER TABLE public.app_update_rules OWNER TO pgadmin;

INSERT INTO public.app_settings (key, value, description)
VALUES ('store_versions', jsonb_build_object('ios', '50.0', 'android', NULL),
        'Version each store currently serves; update rules wait until the store has the version they ask for')
ON CONFLICT (key) DO NOTHING;

-- Caller facts from the request: platform and version from X-Anacan-Version or the iOS native user agent.
CREATE OR REPLACE FUNCTION public.request_client_facts_v1()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = pg_catalog, public
AS $$
DECLARE h json; ua text;
BEGIN
  BEGIN h := nullif(current_setting('request.headers', true), '')::json; EXCEPTION WHEN others THEN h := NULL; END;
  ua := coalesce(h->>'user-agent', '');
  RETURN jsonb_build_object(
    'platform', CASE WHEN ua ~* '(iphone|ipad|ipod|cfnetwork|darwin)' THEN 'ios' WHEN ua ~* 'android|okhttp|dalvik' THEN 'android' ELSE NULL END,
    'version', coalesce(nullif(trim(coalesce(h->>'x-anacan-version', '')), ''), substring(ua from '^App/([0-9]+(?:\.[0-9]+){0,3}) ')));
END $$;
ALTER FUNCTION public.request_client_facts_v1() OWNER TO pgadmin;
REVOKE ALL ON FUNCTION public.request_client_facts_v1() FROM PUBLIC, anon, authenticated;

-- Compares dotted versions; NULL when either side is not a version.
CREATE OR REPLACE FUNCTION public.app_version_cmp_v1(a text, b text)
RETURNS int
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public
AS $$
  SELECT CASE WHEN pa IS NULL OR pb IS NULL THEN NULL
    ELSE (SELECT coalesce((SELECT sign(coalesce(pa[i], 0) - coalesce(pb[i], 0))::int
                           FROM generate_series(1, greatest(cardinality(pa), cardinality(pb))) AS i
                           WHERE coalesce(pa[i], 0) <> coalesce(pb[i], 0) ORDER BY i LIMIT 1), 0)) END
  FROM (SELECT public.app_version_parts_v1(a) AS pa, public.app_version_parts_v1(b) AS pb) v
$$;

-- The best matching rule for one client, with texts resolved for its language. Shared by the new RPC, the legacy
-- bridge and the admin preview. p_user may be NULL (signed out): only audience 'all' rules then apply.
CREATE OR REPLACE FUNCTION public.app_update_match_v1(p_platform text, p_version text, p_language text, p_country text,
  p_user uuid, p_modes text[] DEFAULT ARRAY['force', 'soft', 'banner'])
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  r public.app_update_rules;
  store jsonb;
  store_ver text;
  lang text := lower(left(coalesce(p_language, ''), 8));
  t jsonb;
BEGIN
  IF p_platform NOT IN ('ios', 'android') OR public.app_version_parts_v1(p_version) IS NULL THEN RETURN NULL; END IF;
  SELECT CASE WHEN jsonb_typeof(value) = 'string' THEN (value #>> '{}')::jsonb ELSE value END INTO store
    FROM public.app_settings WHERE key = 'store_versions';
  store_ver := store->>p_platform;
  FOR r IN
    SELECT * FROM public.app_update_rules u
    WHERE u.enabled AND u.mode = ANY(p_modes)
      AND (u.platform = 'both' OR u.platform = p_platform)
      AND public.app_version_cmp_v1(p_version, u.below_version) < 0
      AND (u.min_version IS NULL OR public.app_version_cmp_v1(p_version, u.min_version) >= 0)
      AND (u.languages IS NULL OR lang = ANY(u.languages))
      AND (u.countries IS NULL OR upper(coalesce(p_country, '')) = ANY(u.countries))
      AND (u.starts_at IS NULL OR u.starts_at <= now()) AND (u.ends_at IS NULL OR u.ends_at > now())
      -- the store must already serve the version the rule asks for
      AND store_ver IS NOT NULL AND public.app_version_cmp_v1(store_ver, u.below_version) >= 0
      AND (u.audience = 'all'
        OR (u.audience = 'test' AND p_user IS NOT NULL AND public.has_role(p_user, 'admin'::public.app_role))
        OR (u.audience = 'percent' AND p_user IS NOT NULL
            AND abs(hashtext(p_user::text || u.id::text)) % 100 < u.percent))
    ORDER BY CASE u.mode WHEN 'force' THEN 3 WHEN 'soft' THEN 2 ELSE 1 END DESC, u.priority DESC, u.updated_at DESC
    LIMIT 1
  LOOP
    t := coalesce(r.texts->lang, r.texts->'en', r.texts->'az',
                  (SELECT value FROM jsonb_each(r.texts) LIMIT 1), '{}'::jsonb);
    RETURN jsonb_build_object(
      'protocol', 'anacan-app-update-v1', 'rule_id', r.id, 'mode', r.mode, 'frequency', r.frequency,
      'target_version', r.below_version, 'store_version', store_ver,
      'title', t->>'title', 'body', t->>'body', 'whats_new', coalesce(t->'whats_new', '[]'::jsonb),
      'button', t->>'button', 'later', t->>'later',
      'store_url', CASE WHEN p_platform = 'ios'
        THEN coalesce(r.ios_url, 'https://apps.apple.com/app/id6758301924')
        ELSE coalesce(r.android_url, 'https://play.google.com/store/apps/details?id=com.atlasoon.anacan') END);
  END LOOP;
  RETURN NULL;
END $$;
ALTER FUNCTION public.app_update_match_v1(text, text, text, text, uuid, text[]) OWNER TO pgadmin;
REVOKE ALL ON FUNCTION public.app_update_match_v1(text, text, text, text, uuid, text[]) FROM PUBLIC, anon, authenticated;

-- New builds: one decision for this app. Also records the client (version tracking).
CREATE OR REPLACE FUNCTION public.get_app_update_v1(p_platform text, p_version text, p_language text, p_country text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  PERFORM public.app_client_seen_touch_v1();
  RETURN public.app_update_match_v1(lower(p_platform), p_version, p_language, p_country, auth.uid());
END $$;
ALTER FUNCTION public.get_app_update_v1(text, text, text, text) OWNER TO pgadmin;
REVOKE ALL ON FUNCTION public.get_app_update_v1(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_app_update_v1(text, text, text, text) TO anon, authenticated, service_role;

-- Old builds: the legacy force_update object, built from a matching force rule for this caller.
CREATE OR REPLACE FUNCTION public.get_public_app_setting(p_key text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  facts jsonb;
  m jsonb;
  lang text;
  stored jsonb;
BEGIN
  IF p_key = 'force_update' THEN
    PERFORM public.app_client_seen_touch_v1();
    BEGIN
      facts := public.request_client_facts_v1();
      IF auth.uid() IS NOT NULL THEN
        SELECT p.language INTO lang FROM public.user_preferences p WHERE p.user_id = auth.uid() LIMIT 1;
      END IF;
      m := public.app_update_match_v1(facts->>'platform', facts->>'version', coalesce(lang, 'az'), NULL, auth.uid(), ARRAY['force']);
    EXCEPTION WHEN others THEN m := NULL;
    END;
    IF m IS NOT NULL THEN
      SELECT CASE WHEN jsonb_typeof(value) = 'string' THEN (value #>> '{}')::jsonb ELSE value END INTO stored
        FROM public.app_settings WHERE key = 'force_update';
      RETURN jsonb_build_object('enabled', true, 'min_version', m->>'target_version',
        'title', coalesce(m->>'title', stored->>'title', 'Yeniləmə tələb olunur'),
        'message', coalesce(m->>'body', stored->>'message', ''),
        'ios_url', CASE WHEN facts->>'platform' = 'ios' THEN m->>'store_url' ELSE coalesce(stored->>'ios_url', 'https://apps.apple.com/app/id6758301924') END,
        'android_url', CASE WHEN facts->>'platform' = 'android' THEN m->>'store_url' ELSE coalesce(stored->>'android_url', 'https://play.google.com/store/apps/details?id=com.atlasoon.anacan') END);
    END IF;
  END IF;
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

-- Admin: how many users seen in the last 30 days a rule would reach (language from user_preferences).
CREATE OR REPLACE FUNCTION public.admin_app_update_audience_v1(p_platform text, p_below text, p_min text, p_languages text[])
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501'; END IF;
  RETURN (SELECT jsonb_build_object(
      'matching', count(*) FILTER (WHERE s.app_version IS NOT NULL
        AND public.app_version_cmp_v1(s.app_version, p_below) < 0
        AND (p_min IS NULL OR p_min = '' OR public.app_version_cmp_v1(s.app_version, p_min) >= 0)
        AND (p_languages IS NULL OR cardinality(p_languages) = 0 OR coalesce(pr.language, 'az') = ANY(p_languages))),
      'unknown_version', count(*) FILTER (WHERE s.app_version IS NULL),
      'seen', count(*))
    FROM public.app_client_seen s
    LEFT JOIN public.user_preferences pr ON pr.user_id = s.user_id
    WHERE s.last_seen > now() - interval '30 days'
      AND (p_platform = 'both' OR s.platform = p_platform) AND s.platform IN ('ios', 'android'));
END $$;
ALTER FUNCTION public.admin_app_update_audience_v1(text, text, text, text[]) OWNER TO pgadmin;
REVOKE ALL ON FUNCTION public.admin_app_update_audience_v1(text, text, text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_app_update_audience_v1(text, text, text, text[]) TO authenticated, service_role;

-- CDC/writer guard for the new relation (same contract as Duzelis73).
DO $$
BEGIN
  INSERT INTO _anacan_gcp_migration.guarded_relations(schema_name, table_name, primary_key)
  VALUES ('public', 'app_update_rules', ARRAY['id']) ON CONFLICT DO NOTHING;
  DROP TRIGGER IF EXISTS anacan_gcp_writer_guard ON public.app_update_rules;
  DROP TRIGGER IF EXISTS anacan_gcp_change ON public.app_update_rules;
  DROP TRIGGER IF EXISTS anacan_gcp_truncate ON public.app_update_rules;
  CREATE TRIGGER anacan_gcp_writer_guard BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON public.app_update_rules FOR EACH STATEMENT EXECUTE FUNCTION _anacan_gcp_migration.guard_write();
  CREATE TRIGGER anacan_gcp_change AFTER INSERT OR DELETE OR UPDATE ON public.app_update_rules FOR EACH ROW EXECUTE FUNCTION _anacan_gcp_migration.capture_change();
  CREATE TRIGGER anacan_gcp_truncate AFTER TRUNCATE ON public.app_update_rules FOR EACH STATEMENT EXECUTE FUNCTION _anacan_gcp_migration.capture_change();
  IF (SELECT count(*) FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = 'app_update_rules'
         AND tg.tgname IN ('anacan_gcp_writer_guard', 'anacan_gcp_change', 'anacan_gcp_truncate')) <> 3 THEN
    RAISE EXCEPTION 'APP_UPDATE_RULES_GUARD_INCOMPLETE';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
