-- In-app Epoint Premium prices in USD (owner 2026-11-25), converted to AZN on the server.
--
--   app_settings.in_app_epoint_pricing  {default:{monthly, yearly}, countries:{CC:{monthly?, yearly?}}, fallback_rate, rounding}
--       USD prices the admin manages at any time (Admin › Premium səhifəsi › Epoint). Admin-only (app_settings RLS);
--       NOT in the get_public_app_setting allowlist: the app gets the converted price from web-premium 'status'.
--       rounding: 'x99' (default, nearest price ending in ,99 like every existing Anacan AZN price) or 'cents'.
--   app_settings.fx_usd_azn  {rate, date, fetched_at, last_attempt_at, source}
--       Central Bank of Azerbaijan USD rate (cbar.az daily XML), written only by the web-premium function through
--       web_premium_fx_store_v1: refreshed at most once per Baku day (attempts at most hourly); when CBAR cannot be
--       reached the last cached rate is used, then fallback_rate.
--   web_premium_app_offer_v1(p_user)            the AZN prices for this user's country (profiles.country_code override,
--                                               else default), with the USD source prices and the rate used.
--   web_premium_app_subscribe_start_v1(p_user, p_plan)
--       web_premium_subscribe_start_v1 for page 'app': same checks and the same locking (subscription.price and
--       prices{monthly,yearly} are fixed at signup; renewals and plan switches keep them), but priced from the app
--       offer. The anacan.az pages (campaign / Mərcan / standard) keep web_premium_subscribe_start_v1 unchanged.
--
-- No new relation (app_settings is already guarded: CDC + writer guard). Apply with run-sql.py after 20261125150000.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
BEGIN
  IF (SELECT count(*) FROM _anacan_gcp_migration.guarded_relations WHERE schema_name = 'public' AND table_name = 'app_settings') <> 1 THEN
    RAISE EXCEPTION 'IN_APP_EPOINT_PRICING_GUARD_MISSING';
  END IF;
  IF to_regprocedure('public.web_premium_subscribe_start_v1(uuid,text)') IS NULL THEN RAISE EXCEPTION 'IN_APP_EPOINT_PRICING_WEB_PREMIUM_MISSING'; END IF;
END $$;

INSERT INTO public.app_settings (key, value, description)
SELECT 'in_app_epoint_pricing',
       jsonb_build_object('default', jsonb_build_object('monthly', 3.99, 'yearly', 29.99), 'countries', '{}'::jsonb,
                          'fallback_rate', 1.70, 'rounding', 'x99'),
       'Tətbiqdə Epoint Premium qiymətləri (USD), ölkə üzrə istisnalar, ehtiyat USD→AZN məzənnəsi'
 WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'in_app_epoint_pricing');

-- jsonb value as stored by either writer (object, or the JSON string the admin settings writer stores).
CREATE OR REPLACE FUNCTION public._app_setting_object(p_key text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v jsonb;
BEGIN
  SELECT value INTO v FROM public.app_settings WHERE key = p_key LIMIT 1;
  BEGIN
    IF jsonb_typeof(v) = 'string' THEN v := (v #>> '{}')::jsonb; END IF;
    IF jsonb_typeof(v) = 'string' THEN v := (v #>> '{}')::jsonb; END IF;
  EXCEPTION WHEN others THEN RETURN NULL;
  END;
  RETURN CASE WHEN jsonb_typeof(v) = 'object' THEN v END;
END $$;

-- AZN amount from a converted price: 'cents' → 2 decimals; 'x99' → the nearest price ending in ,99 (at least 0,99).
-- Mirrored by src/lib/in-app-epoint-pricing.ts roundAzn (unit-tested on the same values).
CREATE OR REPLACE FUNCTION public._web_premium_round_azn(p_amount numeric, p_mode text DEFAULT 'x99')
RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path = pg_catalog AS $$
  SELECT CASE
    WHEN p_amount IS NULL OR p_amount <= 0 THEN NULL
    WHEN coalesce(p_mode, 'x99') = 'cents' THEN round(p_amount, 2)
    ELSE greatest(0.99, CASE WHEN p_amount - (floor(p_amount) - 0.01) <= (floor(p_amount) + 0.99) - p_amount
                             THEN floor(p_amount) - 0.01 ELSE floor(p_amount) + 0.99 END)
  END
$$;

-- The USD → AZN rate to use now: today's or the last cached CBAR rate, else the admin fallback.
CREATE OR REPLACE FUNCTION public.web_premium_usd_azn_rate_v1()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE fx jsonb := public._app_setting_object('fx_usd_azn'); pricing jsonb := public._app_setting_object('in_app_epoint_pricing'); r numeric;
BEGIN
  BEGIN r := (fx->>'rate')::numeric; EXCEPTION WHEN others THEN r := NULL; END;
  IF r BETWEEN 0.5 AND 5 THEN
    RETURN jsonb_build_object('rate', r, 'date', fx->>'date', 'source', 'cbar', 'fetched_at', fx->>'fetched_at');
  END IF;
  BEGIN r := (pricing->>'fallback_rate')::numeric; EXCEPTION WHEN others THEN r := NULL; END;
  IF r BETWEEN 0.5 AND 5 THEN RETURN jsonb_build_object('rate', r, 'date', NULL, 'source', 'fallback'); END IF;
  RETURN NULL;
END $$;

-- Written by the web-premium function after reading cbar.az. p_rate NULL records an attempt only (CBAR unreachable).
CREATE OR REPLACE FUNCTION public.web_premium_fx_store_v1(p_rate numeric, p_date date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE cur jsonb := coalesce(public._app_setting_object('fx_usd_azn'), '{}'::jsonb); nxt jsonb;
BEGIN
  IF p_rate IS NOT NULL AND (p_rate NOT BETWEEN 0.5 AND 5 OR p_date IS NULL OR p_date > (now() AT TIME ZONE 'Asia/Baku')::date + 1) THEN
    RAISE EXCEPTION 'WEB_PREMIUM_FX_INVALID' USING ERRCODE = '22023';
  END IF;
  nxt := cur || jsonb_build_object('last_attempt_at', now());
  IF p_rate IS NOT NULL THEN
    nxt := nxt || jsonb_build_object('rate', round(p_rate, 4), 'date', p_date, 'fetched_at', now(), 'source', 'cbar');
  END IF;
  UPDATE public.app_settings SET value = nxt WHERE key = 'fx_usd_azn';
  IF NOT FOUND THEN
    INSERT INTO public.app_settings (key, value, description) VALUES ('fx_usd_azn', nxt, 'AMB USD→AZN məzənnəsi (cbar.az), web-premium yeniləyir');
  END IF;
  RETURN nxt;
END $$;

-- AZN prices of the in-app Epoint offer for this user (server-side only; the client never sends a price).
CREATE OR REPLACE FUNCTION public.web_premium_app_offer_v1(p_user uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  pricing jsonb := public._app_setting_object('in_app_epoint_pricing');
  fx jsonb := public.web_premium_usd_azn_rate_v1();
  ctry text;
  o jsonb;
  usd_m numeric; usd_y numeric; azn_m numeric; azn_y numeric; mode text;
BEGIN
  IF pricing IS NULL OR fx IS NULL THEN RETURN jsonb_build_object('active', false); END IF;
  SELECT upper(btrim(coalesce(p.country_code, ''))) INTO ctry FROM public.profiles p WHERE p.user_id = p_user LIMIT 1;
  o := CASE WHEN ctry ~ '^[A-Z]{2}$' AND jsonb_typeof(pricing #> ARRAY['countries', ctry]) = 'object' THEN pricing #> ARRAY['countries', ctry] END;
  BEGIN
    usd_m := coalesce((o->>'monthly')::numeric, (pricing#>>'{default,monthly}')::numeric);
    usd_y := coalesce((o->>'yearly')::numeric, (pricing#>>'{default,yearly}')::numeric);
  EXCEPTION WHEN others THEN RETURN jsonb_build_object('active', false);
  END;
  IF usd_m IS NULL OR usd_y IS NULL OR usd_m NOT BETWEEN 0.5 AND 300 OR usd_y NOT BETWEEN 0.5 AND 300 THEN
    RETURN jsonb_build_object('active', false);
  END IF;
  mode := CASE WHEN pricing->>'rounding' = 'cents' THEN 'cents' ELSE 'x99' END;
  azn_m := public._web_premium_round_azn(usd_m * (fx->>'rate')::numeric, mode);
  azn_y := public._web_premium_round_azn(usd_y * (fx->>'rate')::numeric, mode);
  IF azn_m NOT BETWEEN 0.5 AND 500 OR azn_y NOT BETWEEN 0.5 AND 500 THEN RETURN jsonb_build_object('active', false); END IF;
  RETURN jsonb_build_object('active', true, 'kind', 'app',
    'name', 'app_usd' || CASE WHEN o IS NOT NULL THEN ':' || ctry ELSE '' END,
    'country', nullif(ctry, ''), 'override', o IS NOT NULL, 'currency', 'AZN',
    'plans', jsonb_build_object('monthly', jsonb_build_object('price', azn_m, 'was', NULL),
                                'yearly', jsonb_build_object('price', azn_y, 'was', NULL)),
    'usd', jsonb_build_object('monthly', usd_m, 'yearly', usd_y),
    'rate', (fx->>'rate')::numeric, 'rate_date', fx->>'date', 'rate_source', fx->>'source', 'rounding', mode);
END $$;

-- Same as web_premium_subscribe_start_v1 (20261112250000), priced from the app offer and locked the same way.
CREATE OR REPLACE FUNCTION public.web_premium_app_subscribe_start_v1(p_user uuid, p_plan text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  c jsonb;
  sub_id uuid;
  charge_id uuid;
  v_price numeric;
BEGIN
  IF p_user IS NULL OR p_plan NOT IN ('monthly', 'yearly') THEN RAISE EXCEPTION 'WEB_PREMIUM_INVALID_REQUEST'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('web_premium:' || p_user::text, 0));
  UPDATE public.web_premium_subscriptions
     SET status = 'expired', ended_at = coalesce(ended_at, current_period_end, now()), next_charge_at = NULL, updated_at = now()
   WHERE user_id = p_user AND status IN ('cancelled', 'past_due') AND coalesce(current_period_end, now()) <= now();
  IF EXISTS (SELECT 1 FROM public.web_premium_subscriptions WHERE user_id = p_user AND status IN ('active', 'past_due', 'cancelled')) THEN
    RAISE EXCEPTION 'WEB_PREMIUM_ALREADY_SUBSCRIBED';
  END IF;
  c := public.web_premium_app_offer_v1(p_user);
  IF coalesce((c->>'active')::boolean, false) IS NOT TRUE THEN RAISE EXCEPTION 'WEB_PREMIUM_CAMPAIGN_INACTIVE'; END IF;
  UPDATE public.web_premium_subscriptions SET status = 'expired', ended_at = now(), updated_at = now()
   WHERE user_id = p_user AND status = 'pending';
  v_price := (c#>>ARRAY['plans', p_plan, 'price'])::numeric;
  INSERT INTO public.web_premium_subscriptions (user_id, plan, price, prices, campaign)
  VALUES (p_user, p_plan, v_price,
          jsonb_build_object('monthly', (c#>>'{plans,monthly,price}')::numeric, 'yearly', (c#>>'{plans,yearly,price}')::numeric),
          left(c->>'name', 64))
  RETURNING id INTO sub_id;
  INSERT INTO public.web_premium_charges (subscription_id, user_id, kind, plan, amount)
  VALUES (sub_id, p_user, 'initial', p_plan, v_price)
  RETURNING id INTO charge_id;
  RETURN jsonb_build_object('subscription_id', sub_id, 'charge_id', charge_id, 'amount', v_price, 'plan', p_plan, 'kind', 'app',
                            'usd', c#>ARRAY['usd', p_plan], 'rate', c->'rate', 'rate_date', c->'rate_date');
END
$function$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['_app_setting_object(text)', '_web_premium_round_azn(numeric,text)', 'web_premium_usd_azn_rate_v1()',
    'web_premium_fx_store_v1(numeric,date)', 'web_premium_app_offer_v1(uuid)', 'web_premium_app_subscribe_start_v1(uuid,text)'] LOOP
    EXECUTE format('ALTER FUNCTION public.%s OWNER TO pgadmin', f);
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', f);
  END LOOP;
END $$;

DO $$
BEGIN
  IF public._web_premium_round_azn(6.783, 'x99') <> 6.99 OR public._web_premium_round_azn(7.02, 'x99') <> 6.99
     OR public._web_premium_round_azn(50.983, 'x99') <> 50.99 OR public._web_premium_round_azn(6.783, 'cents') <> 6.78
     OR public._web_premium_round_azn(0.4, 'x99') <> 0.99 THEN
    RAISE EXCEPTION 'IN_APP_EPOINT_ROUNDING_MISMATCH';
  END IF;
  IF position('''in_app_epoint_pricing''' IN pg_get_functiondef('public.get_public_app_setting(text)'::regprocedure)) > 0
     OR position('''fx_usd_azn''' IN pg_get_functiondef('public.get_public_app_setting(text)'::regprocedure)) > 0 THEN
    RAISE EXCEPTION 'IN_APP_EPOINT_PRICING_MUST_NOT_BE_PUBLIC';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
