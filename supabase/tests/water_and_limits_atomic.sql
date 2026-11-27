-- Atomic water taps (idempotent op ids, local day) and atomic free daily limits (local-day key, no overshoot).
-- Runs in one transaction and rolls back. Prints WATER_LIMITS_OK when every check passes.
BEGIN;
SET LOCAL client_min_messages = warning;

DO $$
DECLARE
  u_mom uuid := gen_random_uuid(); u_other uuid := gen_random_uuid();
  op1 uuid := gen_random_uuid(); op2 uuid := gen_random_uuid();
  today date := (now() AT TIME ZONE 'UTC')::date;
  r jsonb; n int; i int; d date;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (u_mom, 'wl-m@x.az'), (u_other, 'wl-o@x.az');

  -- anonymous callers write nothing
  PERFORM set_config('request.jwt.claim.sub', '', true);
  BEGIN
    PERFORM public.increment_water_intake_v1(today, 1, op1);
    RAISE EXCEPTION 'T1 anonymous water';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  PERFORM set_config('request.jwt.claim.sub', u_mom::text, true);
  -- yesterday has 5 glasses: the first tap of a new day starts at 1, not 6
  INSERT INTO public.daily_logs (user_id, log_date, water_intake, mood) VALUES (u_mom, today - 1, 5, 4);
  r := public.increment_water_intake_v1(today, 1, op1);
  IF (r->>'water_intake')::int <> 1 OR NOT (r->>'applied')::boolean THEN RAISE EXCEPTION 'T2 first tap of the day: %', r; END IF;
  -- second tap adds, a replay of op1 does not
  r := public.increment_water_intake_v1(today, 1, op2);
  IF (r->>'water_intake')::int <> 2 THEN RAISE EXCEPTION 'T3 second tap: %', r; END IF;
  r := public.increment_water_intake_v1(today, 1, op1);
  IF (r->>'water_intake')::int <> 2 OR (r->>'applied')::boolean THEN RAISE EXCEPTION 'T4 replay applied twice: %', r; END IF;
  -- other columns of the day and yesterday's row are untouched
  UPDATE public.daily_logs SET mood = 3 WHERE user_id = u_mom AND log_date = today;
  PERFORM public.increment_water_intake_v1(today, 1, NULL);
  SELECT water_intake INTO n FROM public.daily_logs WHERE user_id = u_mom AND log_date = today AND mood = 3;
  IF n IS DISTINCT FROM 3 THEN RAISE EXCEPTION 'T5 mood lost or water wrong: %', n; END IF;
  SELECT water_intake INTO n FROM public.daily_logs WHERE user_id = u_mom AND log_date = today - 1;
  IF n <> 5 THEN RAISE EXCEPTION 'T6 yesterday changed: %', n; END IF;
  -- never below zero
  r := public.increment_water_intake_v1(today, -50, gen_random_uuid());
  IF (r->>'water_intake')::int <> 0 THEN RAISE EXCEPTION 'T7 clamp: %', r; END IF;
  -- bad input
  BEGIN PERFORM public.increment_water_intake_v1(today + 5, 1, gen_random_uuid()); RAISE EXCEPTION 'T8 future day'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  BEGIN PERFORM public.increment_water_intake_v1(today, 0, gen_random_uuid()); RAISE EXCEPTION 'T9 zero delta'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  -- another user's op id does not reveal or change their water
  PERFORM set_config('request.jwt.claim.sub', u_other::text, true);
  r := public.increment_water_intake_v1(today, 1, op1);
  IF (r->>'applied')::boolean OR (r->>'water_intake')::int <> 0 THEN RAISE EXCEPTION 'T10 cross-user op: %', r; END IF;

  -- limits: horoscope default 2/day, never more even when called repeatedly
  DELETE FROM public.app_settings WHERE key = 'free_limits';
  PERFORM set_config('request.jwt.claim.sub', u_mom::text, true);
  FOR i IN 1..4 LOOP r := public.usage_consume_v1('horoscope', 'Asia/Baku'); END LOOP;
  IF (r->>'allowed')::boolean OR (r->>'used')::int <> 2 OR (r->>'limit')::int <> 2 THEN RAISE EXCEPTION 'T11 limit overshoot: %', r; END IF;
  SELECT usage_count INTO n FROM public.usage_tracking WHERE user_id = u_mom AND feature_type = 'horoscope';
  IF n <> 2 THEN RAISE EXCEPTION 'T12 stored count: %', n; END IF;
  -- day is the caller's local day (Baku), invalid zone falls back to Baku
  IF (r->>'usage_date')::date <> (now() AT TIME ZONE 'Asia/Baku')::date THEN RAISE EXCEPTION 'T13 day key: %', r; END IF;
  r := public.usage_consume_v1('horoscope', 'Not/AZone''; DROP TABLE x');
  IF (r->>'usage_date')::date <> (now() AT TIME ZONE 'Asia/Baku')::date OR (r->>'allowed')::boolean THEN RAISE EXCEPTION 'T14 bad zone: %', r; END IF;
  r := public.usage_consume_v1('horoscope', 'Pacific/Kiritimati');
  d := (now() AT TIME ZONE 'Pacific/Kiritimati')::date;
  IF (r->>'usage_date')::date <> d THEN RAISE EXCEPTION 'T15 zone day: %', r; END IF;
  -- configured limit (stored as a JSON string by the admin panel) and limit 0
  INSERT INTO public.app_settings (key, value) VALUES ('free_limits', to_jsonb('{"ai_chat_count_per_day": 1, "fairy_tale_count_per_day": 0}'::text));
  r := public.usage_consume_v1('ai_chat', 'Asia/Baku');
  IF NOT (r->>'allowed')::boolean OR (r->>'limit')::int <> 1 THEN RAISE EXCEPTION 'T16 configured limit: %', r; END IF;
  r := public.usage_consume_v1('ai_chat', 'Asia/Baku');
  IF (r->>'allowed')::boolean THEN RAISE EXCEPTION 'T17 configured limit passed: %', r; END IF;
  r := public.usage_consume_v1('fairy_tale', 'Asia/Baku');
  IF (r->>'allowed')::boolean OR (r->>'used')::int <> 0 THEN RAISE EXCEPTION 'T18 zero limit: %', r; END IF;
  BEGIN PERFORM public.usage_consume_v1('white_noise', NULL); RAISE EXCEPTION 'T19 unknown feature'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;

  -- white noise seconds add up atomically
  r := public.usage_add_seconds_v1(40, 'Asia/Baku');
  r := public.usage_add_seconds_v1(5, 'Asia/Baku');
  IF (r->>'used_seconds')::int <> 45 THEN RAISE EXCEPTION 'T20 seconds: %', r; END IF;

  -- privileges
  IF has_table_privilege('authenticated', 'public.water_intake_ops', 'SELECT') OR has_table_privilege('anon', 'public.water_intake_ops', 'INSERT')
     OR has_function_privilege('anon', 'public.increment_water_intake_v1(date,integer,uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.usage_consume_v1(text,text)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.usage_consume_v1(text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'T21 grants';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM _anacan_gcp_migration.guarded_relations WHERE schema_name = 'public' AND table_name = 'water_intake_ops')
     OR (SELECT count(*) FROM pg_trigger WHERE tgrelid = 'public.water_intake_ops'::regclass AND tgname LIKE 'anacan_gcp_%') <> 3 THEN
    RAISE EXCEPTION 'T22 CDC enrollment';
  END IF;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  RAISE WARNING 'WATER_LIMITS_OK';
END $$;

ROLLBACK;
