-- Server AI free-limit gate: teach the atomic usage consume every feature key the AI edge functions use,
-- and add a service-role entrypoint that takes an explicit user id (audit Phase 2, finding #3).
--
-- Background. Round-3 migration 20261125190000 added public.usage_consume_v1(p_feature, p_time_zone): a single
-- INSERT .. ON CONFLICT .. WHERE usage_count < limit on public.usage_tracking, keyed on the caller's LOCAL
-- calendar day, so parallel calls never overshoot and the day is not UTC (Baku resets at local midnight, not
-- 04:00). Only the client was wired to it. The server AI functions (_shared/usage-limit.ts and baby-chat-reply)
-- still did a racy read-then-update on a UTC-day row. This migration wires the server to the same atomic path.
--
-- Two problems to solve so nothing changes for users:
--   1. usage_consume_v1 resolves the user with auth.uid(). The edge functions call the DB with the service-role
--      key (no JWT), so auth.uid() is NULL there. We factor the logic into _anacan_usage_consume(p_user, ...)
--      and add public.usage_consume_srv_v1(p_user_id, p_feature, p_time_zone) for the server (service_role only).
--      public.usage_consume_v1(p_feature, p_time_zone) keeps its exact signature and delegates auth.uid(), so the
--      already-shipped client stays untouched.
--   2. The server counts its own `<feature>_srv` rows for the four features the APP also counts (ai_chat,
--      cry_translator, poop_scanner, horoscope) to avoid double counting, and is the sole counter (plain row) for
--      fairy_tale / baby_insight. baby-chat-reply counts 'baby_chat_ai'. The consume logic must therefore accept
--      ai_chat_srv / cry_translator_srv / poop_scanner_srv / horoscope_srv and baby_chat_ai, and resolve each
--      one's limit to the SAME value used today: the `<base>_count_per_day` key of app_settings.free_limits for
--      the `_srv` features (identical to the base feature's limit), and app_settings.baby_chat_ai.daily_limit
--      (default 20) for baby_chat_ai — exactly what baby-chat-reply reads now.
--
-- No relation is created or changed (functions only), so no CDC/writer-guard enrollment and no .cdc.json.
-- Idempotent: CREATE OR REPLACE throughout; grants re-applied. Depends on 20261125190000.
-- Apply with /home/anacan-runner/run-sql.py on anacan-gcp-candidate. Not applied by the author of this migration.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
BEGIN
  IF to_regprocedure('public.usage_consume_v1(text, text)') IS NULL
     OR to_regprocedure('public._anacan_local_day(text)') IS NULL THEN
    RAISE EXCEPTION 'USAGE_CONSUME_AI_DEPENDENCY_MISSING: apply 20261125190000 first';
  END IF;
  IF to_regclass('public.app_settings') IS NULL OR to_regclass('public.usage_tracking') IS NULL THEN
    RAISE EXCEPTION 'USAGE_CONSUME_AI_RELATION_MISSING';
  END IF;
END $$;

-- ───────────── limit resolution: base features, their `_srv` twins, and baby_chat_ai ─────────────
-- Free daily count limit for a feature key. `<feature>_srv` resolves to the base feature's limit. baby_chat_ai
-- keeps its own admin setting (app_settings.baby_chat_ai.daily_limit, default 20) so it matches baby-chat-reply.
CREATE OR REPLACE FUNCTION public._anacan_free_daily_limit(p_feature text)
RETURNS integer LANGUAGE plpgsql STABLE SET search_path = pg_catalog, public AS $$
DECLARE
  f text := lower(btrim(coalesce(p_feature, '')));
  base text := regexp_replace(lower(btrim(coalesce(p_feature, ''))), '_srv$', '');
  v jsonb;
  cfg jsonb;
  dflt integer;
BEGIN
  IF f = 'baby_chat_ai' THEN
    SELECT value INTO v FROM public.app_settings WHERE key = 'baby_chat_ai';
    IF jsonb_typeof(v) = 'string' THEN
      BEGIN v := (v #>> '{}')::jsonb; EXCEPTION WHEN others THEN v := NULL; END;
    END IF;
    cfg := v -> 'daily_limit';
    IF jsonb_typeof(cfg) = 'number' AND (cfg #>> '{}')::numeric >= 0 THEN
      RETURN least(floor((cfg #>> '{}')::numeric), 1000000)::integer;
    END IF;
    RETURN 20;
  END IF;

  dflt := CASE base WHEN 'ai_chat' THEN 10 WHEN 'cry_translator' THEN 3 WHEN 'poop_scanner' THEN 3
                    WHEN 'fairy_tale' THEN 3 WHEN 'horoscope' THEN 2 WHEN 'baby_insight' THEN 2 END;
  SELECT value INTO v FROM public.app_settings WHERE key = 'free_limits';
  IF jsonb_typeof(v) = 'string' THEN
    BEGIN v := (v #>> '{}')::jsonb; EXCEPTION WHEN others THEN v := NULL; END;
  END IF;
  cfg := v -> (base || '_count_per_day');
  IF jsonb_typeof(cfg) = 'number' AND (cfg #>> '{}')::numeric >= 0 THEN
    RETURN least(floor((cfg #>> '{}')::numeric), 1000000)::integer;
  END IF;
  RETURN dflt;
END $$;

-- ───────────── shared atomic consume (explicit user) ─────────────
CREATE OR REPLACE FUNCTION public._anacan_usage_consume(p_user uuid, p_feature text, p_time_zone text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  f text := lower(btrim(coalesce(p_feature, '')));
  d date := public._anacan_local_day(p_time_zone);
  lim integer;
  used integer;
BEGIN
  IF p_user IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501'; END IF;
  IF f NOT IN ('ai_chat', 'cry_translator', 'poop_scanner', 'fairy_tale', 'horoscope', 'baby_insight',
               'ai_chat_srv', 'cry_translator_srv', 'poop_scanner_srv', 'horoscope_srv', 'baby_chat_ai') THEN
    RAISE EXCEPTION 'unknown daily feature' USING ERRCODE = '22023';
  END IF;
  lim := public._anacan_free_daily_limit(f);

  IF lim > 0 THEN
    -- Check and count in one statement: the row lock of ON CONFLICT serialises parallel calls.
    INSERT INTO public.usage_tracking AS u (user_id, feature_type, usage_date, usage_count)
    VALUES (p_user, f, d, 1)
    ON CONFLICT (user_id, feature_type, usage_date) DO UPDATE
      SET usage_count = u.usage_count + 1, updated_at = now()
      WHERE u.usage_count < lim
    RETURNING u.usage_count INTO used;
    IF used IS NOT NULL THEN
      RETURN jsonb_build_object('allowed', true, 'used', used, 'limit', lim, 'usage_date', d);
    END IF;
  END IF;

  SELECT usage_count INTO used FROM public.usage_tracking WHERE user_id = p_user AND feature_type = f AND usage_date = d;
  RETURN jsonb_build_object('allowed', false, 'used', coalesce(used, 0), 'limit', lim, 'usage_date', d);
END $$;

-- ───────────── client entrypoint (auth.uid()) — same signature as 20261125190000 ─────────────
CREATE OR REPLACE FUNCTION public.usage_consume_v1(p_feature text, p_time_zone text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  RETURN public._anacan_usage_consume(auth.uid(), p_feature, p_time_zone);
END $$;

-- ───────────── server entrypoint (explicit user id, service_role only) ─────────────
CREATE OR REPLACE FUNCTION public.usage_consume_srv_v1(p_user_id uuid, p_feature text, p_time_zone text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501'; END IF;
  RETURN public._anacan_usage_consume(p_user_id, p_feature, p_time_zone);
END $$;

REVOKE ALL ON FUNCTION public._anacan_free_daily_limit(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._anacan_usage_consume(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.usage_consume_v1(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.usage_consume_srv_v1(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._anacan_free_daily_limit(text) TO service_role;
GRANT EXECUTE ON FUNCTION public._anacan_usage_consume(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.usage_consume_v1(text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.usage_consume_srv_v1(uuid, text, text) TO service_role;

COMMIT;
