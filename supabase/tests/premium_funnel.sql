-- Premium funnel, purchase intents, purchase attribution, admin report and the in_app_epoint public setting.
-- Runs in one transaction and rolls back. Prints PREMIUM_FUNNEL_OK when every check passes.
BEGIN;
SET LOCAL client_min_messages = warning;

DO $$
DECLARE
  u_admin uuid := gen_random_uuid(); u_mom uuid := gen_random_uuid(); u_other uuid := gen_random_uuid(); u_new uuid := gen_random_uuid();
  r jsonb; n int; s jsonb;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (u_admin, 'fa@x.az'), (u_mom, 'fm@x.az'), (u_other, 'fo@x.az'), (u_new, 'fn@x.az');
  INSERT INTO public.user_roles (user_id, role) VALUES (u_admin, 'admin');
  UPDATE public.profiles SET country_code = 'az', life_stage = 'bump' WHERE user_id = u_mom;
  IF NOT FOUND THEN INSERT INTO public.profiles (user_id, country_code, life_stage) VALUES (u_mom, 'az', 'bump'); END IF;

  -- setting is public and seeded with AZ, iOS off
  s := public.get_public_app_setting('in_app_epoint');
  IF jsonb_typeof(s) = 'string' THEN s := (s #>> '{}')::jsonb; END IF;
  IF s IS NULL OR NOT (s->'countries') ? 'AZ' THEN RAISE EXCEPTION 'T1 in_app_epoint not public: %', s; END IF;
  IF public.get_public_app_setting('epoint_private_key') IS NOT NULL THEN RAISE EXCEPTION 'T2 secret leaked through allowlist'; END IF;

  -- anonymous callers count nothing
  PERFORM set_config('request.jwt.claim.sub', '', true);
  IF public.premium_funnel_hit_v1('paywall_shown', 'tool_ai', 'android', NULL) THEN RAISE EXCEPTION 'T3 anonymous hit counted'; END IF;
  IF public.premium_purchase_intent_v1('tool_ai', 'android', 'yearly') THEN RAISE EXCEPTION 'T4 anonymous intent stored'; END IF;

  -- counted once per source per 10 minutes; country + stage from the profile
  PERFORM set_config('request.jwt.claim.sub', u_mom::text, true);
  IF NOT public.premium_funnel_hit_v1('paywall_shown', 'Tool AI', 'android', NULL) THEN RAISE EXCEPTION 'T5 first hit not counted'; END IF;
  IF public.premium_funnel_hit_v1('paywall_shown', 'tool_ai', 'android', NULL) THEN RAISE EXCEPTION 'T6 throttle failed'; END IF;
  IF NOT public.premium_funnel_hit_v1('paywall_shown', 'onboarding', 'android', NULL) THEN RAISE EXCEPTION 'T7 other source throttled'; END IF;
  IF public.premium_funnel_hit_v1('not_an_event', 'tool_ai', 'android', NULL) THEN RAISE EXCEPTION 'T8 unknown event counted'; END IF;
  SELECT count INTO n FROM public.premium_funnel_daily WHERE event = 'paywall_shown' AND source = 'tool_ai' AND platform = 'android'
     AND country = 'AZ' AND life_stage = 'bump' AND day = (now() AT TIME ZONE 'Asia/Baku')::date;
  IF n IS DISTINCT FROM 1 THEN RAISE EXCEPTION 'T9 daily row: %', n; END IF;
  UPDATE public.premium_funnel_throttle SET last_at = now() - interval '11 minutes' WHERE user_id = u_mom AND source = 'tool_ai';
  IF NOT public.premium_funnel_hit_v1('paywall_shown', 'tool_ai', 'android', 'flow') THEN RAISE EXCEPTION 'T10 hit after window'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.premium_funnel_daily WHERE source = 'tool_ai' AND life_stage = 'flow') THEN RAISE EXCEPTION 'T11 explicit stage'; END IF;
  IF EXISTS (SELECT 1 FROM public.premium_funnel_daily WHERE source <> lower(source)) THEN RAISE EXCEPTION 'T12 source not normalised'; END IF;

  -- intents and attribution
  IF NOT public.premium_purchase_intent_v1('tool_ai', 'android', 'yearly') THEN RAISE EXCEPTION 'T13 intent not stored'; END IF;
  IF public.premium_purchase_intent_v1('tool_ai', 'android', 'yearly') THEN RAISE EXCEPTION 'T14 double tap stored'; END IF;
  PERFORM set_config('request.jwt.claim.sub', '', true);

  r := public.premium_purchase_record_v1(u_mom, 'play_store', 'com.atlasoon.anacan.premium.yearly', 'yearly', 29.99, 'usd', 'rc:GPA.1', 'initial', NULL, now());
  IF NOT (r->>'recorded')::boolean OR r->>'source' <> 'tool_ai' OR NOT (r->>'first_purchase')::boolean THEN RAISE EXCEPTION 'T15 attribution: %', r; END IF;
  r := public.premium_purchase_record_v1(u_mom, 'play_store', 'com.atlasoon.anacan.premium.yearly', 'yearly', 29.99, 'USD', 'rc:GPA.1', 'initial', NULL, now());
  IF (r->>'recorded')::boolean OR (SELECT count(*) FROM public.premium_purchases WHERE provider_ref = 'rc:GPA.1') <> 1 THEN RAISE EXCEPTION 'T16 not idempotent'; END IF;
  r := public.premium_purchase_record_v1(u_mom, 'play_store', 'com.atlasoon.anacan.premium.yearly', 'yearly', 29.99, 'USD', 'rc:GPA.2', 'renewal', NULL, now());
  IF r->>'source' <> 'renewal' OR (r->>'first_purchase')::boolean THEN RAISE EXCEPTION 'T17 renewal: %', r; END IF;
  r := public.premium_purchase_record_v1(u_other, 'epoint', 'epoint:monthly', 'monthly', 4.99, 'AZN', 'epoint:' || gen_random_uuid(), 'initial', NULL, now());
  IF r->>'source' <> 'unknown' OR (SELECT platform FROM public.premium_purchases WHERE id = (r->>'id')::uuid) <> 'web' THEN RAISE EXCEPTION 'T18 unattributed: %', r; END IF;
  -- an intent older than 48 h does not attribute
  INSERT INTO public.premium_purchase_intents (user_id, source, platform, plan, created_at) VALUES (u_new, 'banner', 'ios', 'monthly', now() - interval '3 days');
  r := public.premium_purchase_record_v1(u_new, 'app_store', 'com.atlasoon.anacan.premium.monthly', 'monthly', NULL, NULL, 'rc:1000001', 'initial', NULL, now());
  IF r->>'source' <> 'unknown' THEN RAISE EXCEPTION 'T19 stale intent attributed: %', r; END IF;

  -- privileges
  IF has_table_privilege('authenticated', 'public.premium_purchases', 'SELECT') OR has_table_privilege('authenticated', 'public.premium_funnel_daily', 'INSERT')
     OR has_function_privilege('authenticated', 'public.premium_purchase_record_v1(uuid,text,text,text,numeric,text,text,text,text,timestamptz)', 'EXECUTE') THEN
    RAISE EXCEPTION 'T20 grants too wide';
  END IF;

  -- admin report
  PERFORM set_config('request.jwt.claim.sub', u_mom::text, true);
  BEGIN
    PERFORM public.admin_premium_funnel_v1(30);
    RAISE EXCEPTION 'T21 non-admin read the report';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM set_config('request.jwt.claim.sub', u_admin::text, true);
  r := public.admin_premium_funnel_v1(9999);
  IF (r->>'days')::int <> 180 OR jsonb_array_length(r->'funnel') < 2 OR jsonb_array_length(r->'purchases') < 3
     OR NOT (r ? 'cancellations') OR NOT (r ? 'daily') OR NOT (r ? 'intents') THEN RAISE EXCEPTION 'T22 report: %', r; END IF;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  RAISE WARNING 'PREMIUM_FUNNEL_OK';
END $$;

ROLLBACK;
