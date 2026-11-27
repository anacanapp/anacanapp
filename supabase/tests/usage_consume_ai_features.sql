-- Server AI free-limit gate: the extended atomic consume (migration 20261126130000).
-- Verifies the service-role entrypoint, the `_srv` and baby_chat_ai feature keys, limit resolution that matches
-- what the edge functions read today, atomic no-overshoot, local-day key, and grants. Depends on 20261125190000
-- and 20261126130000 being applied. Runs in one transaction and rolls back. Prints USAGE_CONSUME_AI_OK on success.
BEGIN;
SET LOCAL client_min_messages = warning;

DO $$
DECLARE
  ua uuid := gen_random_uuid();  -- default limits
  ub uuid := gen_random_uuid();  -- configured free_limits
  uc uuid := gen_random_uuid();  -- configured baby_chat_ai
  ud uuid := gen_random_uuid();  -- client (auth.uid()) path
  r jsonb; n int; i int;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (ua, 'uc-a@x.az'), (ub, 'uc-b@x.az'), (uc, 'uc-c@x.az'), (ud, 'uc-d@x.az');

  -- ── Phase A: default limits (no app_settings rows) ──
  DELETE FROM public.app_settings WHERE key IN ('free_limits', 'baby_chat_ai');

  -- ai_chat_srv: the server's own counter for ai_chat; default limit 10, never overshoots.
  FOR i IN 1..12 LOOP r := public.usage_consume_srv_v1(ua, 'ai_chat_srv', 'Asia/Baku'); END LOOP;
  IF (r->>'allowed')::boolean OR (r->>'used')::int <> 10 OR (r->>'limit')::int <> 10 THEN RAISE EXCEPTION 'A1 ai_chat_srv overshoot: %', r; END IF;
  SELECT usage_count INTO n FROM public.usage_tracking WHERE user_id = ua AND feature_type = 'ai_chat_srv';
  IF n <> 10 THEN RAISE EXCEPTION 'A2 stored _srv row: %', n; END IF;
  -- the plain ai_chat row (app's counter) is untouched by the server's _srv counter
  IF EXISTS (SELECT 1 FROM public.usage_tracking WHERE user_id = ua AND feature_type = 'ai_chat') THEN RAISE EXCEPTION 'A3 server wrote the app row'; END IF;

  -- baby_insight: sole server counter (plain row), default 2
  FOR i IN 1..3 LOOP r := public.usage_consume_srv_v1(ua, 'baby_insight', 'Asia/Baku'); END LOOP;
  IF (r->>'allowed')::boolean OR (r->>'used')::int <> 2 OR (r->>'limit')::int <> 2 THEN RAISE EXCEPTION 'A4 baby_insight: %', r; END IF;

  -- baby_chat_ai: default limit 20 (same as baby-chat-reply's hardcoded default)
  r := public.usage_consume_srv_v1(ua, 'baby_chat_ai', 'Asia/Baku');
  IF NOT (r->>'allowed')::boolean OR (r->>'limit')::int <> 20 THEN RAISE EXCEPTION 'A5 baby_chat_ai default: %', r; END IF;

  -- local day is the caller's local day (Baku)
  IF (r->>'usage_date')::date <> (now() AT TIME ZONE 'Asia/Baku')::date THEN RAISE EXCEPTION 'A6 day key: %', r; END IF;

  -- unknown / non-daily feature rejected
  BEGIN PERFORM public.usage_consume_srv_v1(ua, 'white_noise', 'Asia/Baku'); RAISE EXCEPTION 'A7 unknown feature'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  -- null user rejected
  BEGIN PERFORM public.usage_consume_srv_v1(NULL, 'ai_chat_srv', 'Asia/Baku'); RAISE EXCEPTION 'A8 null user'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  -- ── Phase B: configured limits (admin panel stores the value as a JSON string) ──
  INSERT INTO public.app_settings (key, value) VALUES
    ('free_limits', to_jsonb('{"ai_chat_count_per_day": 1}'::text)),
    ('baby_chat_ai', to_jsonb('{"enabled": true, "daily_limit": 1}'::text));

  -- ai_chat_srv resolves to the base ai_chat limit (1) — the server and the app share one configured value
  r := public.usage_consume_srv_v1(ub, 'ai_chat_srv', 'Asia/Baku');
  IF NOT (r->>'allowed')::boolean OR (r->>'limit')::int <> 1 THEN RAISE EXCEPTION 'B1 configured _srv limit: %', r; END IF;
  r := public.usage_consume_srv_v1(ub, 'ai_chat_srv', 'Asia/Baku');
  IF (r->>'allowed')::boolean THEN RAISE EXCEPTION 'B2 configured _srv passed: %', r; END IF;

  -- baby_chat_ai honours app_settings.baby_chat_ai.daily_limit (1), the same value baby-chat-reply reads
  r := public.usage_consume_srv_v1(uc, 'baby_chat_ai', 'Asia/Baku');
  IF NOT (r->>'allowed')::boolean OR (r->>'limit')::int <> 1 THEN RAISE EXCEPTION 'B3 baby_chat_ai configured: %', r; END IF;
  r := public.usage_consume_srv_v1(uc, 'baby_chat_ai', 'Asia/Baku');
  IF (r->>'allowed')::boolean THEN RAISE EXCEPTION 'B4 baby_chat_ai configured passed: %', r; END IF;

  -- ── client (auth.uid()) entrypoint still works and uses the same logic ──
  PERFORM set_config('request.jwt.claim.sub', ud::text, true);
  -- fairy_tale not in the configured free_limits above -> default 3
  r := public.usage_consume_v1('fairy_tale', 'Asia/Baku');
  IF NOT (r->>'allowed')::boolean OR (r->>'limit')::int <> 3 THEN RAISE EXCEPTION 'B5 client fairy_tale: %', r; END IF;
  PERFORM set_config('request.jwt.claim.sub', '', true);

  -- ── grants: srv entrypoint is service_role only; the client entrypoint stays available to authenticated ──
  IF has_function_privilege('anon', 'public.usage_consume_srv_v1(uuid,text,text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.usage_consume_srv_v1(uuid,text,text)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.usage_consume_srv_v1(uuid,text,text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.usage_consume_v1(text,text)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.usage_consume_v1(text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'B6 grants';
  END IF;

  RAISE WARNING 'USAGE_CONSUME_AI_OK';
END $$;

ROLLBACK;
