-- In-app Epoint USD pricing: rounding, country overrides, rate fallback chain, CBAR store and the locked subscription.
-- Runs in one transaction and rolls back. Prints IN_APP_EPOINT_PRICING_OK when every check passes.
BEGIN;
SET LOCAL client_min_messages = warning;

DO $$
DECLARE u_az uuid := gen_random_uuid(); u_ge uuid := gen_random_uuid(); u_none uuid := gen_random_uuid(); r jsonb; s jsonb;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (u_az, 'pa@x.az'), (u_ge, 'pg@x.az'), (u_none, 'pn@x.az');
  UPDATE public.profiles SET country_code = 'AZ' WHERE user_id = u_az;
  IF NOT FOUND THEN INSERT INTO public.profiles (user_id, country_code) VALUES (u_az, 'AZ'); END IF;
  UPDATE public.profiles SET country_code = 'ge' WHERE user_id = u_ge;
  IF NOT FOUND THEN INSERT INTO public.profiles (user_id, country_code) VALUES (u_ge, 'ge'); END IF;

  -- the admin writer stores a JSON string; overrides may set one plan only
  UPDATE public.app_settings SET value = to_jsonb(jsonb_build_object('default', jsonb_build_object('monthly', 3.99, 'yearly', 29.99),
    'countries', jsonb_build_object('AZ', jsonb_build_object('monthly', 2.99, 'yearly', 19.99), 'GE', jsonb_build_object('yearly', 24.99)),
    'fallback_rate', 1.7, 'rounding', 'x99')::text) WHERE key = 'in_app_epoint_pricing';
  DELETE FROM public.app_settings WHERE key = 'fx_usd_azn';

  -- fallback rate (no CBAR rate cached yet)
  r := public.web_premium_app_offer_v1(u_az);
  IF r->>'rate_source' <> 'fallback' OR (r#>>'{plans,monthly,price}')::numeric <> 4.99 OR (r#>>'{plans,yearly,price}')::numeric <> 33.99
     OR r->>'name' <> 'app_usd:AZ' THEN RAISE EXCEPTION 'T1 AZ override with fallback rate: %', r; END IF;
  r := public.web_premium_app_offer_v1(u_ge);
  IF (r#>>'{usd,monthly}')::numeric <> 3.99 OR (r#>>'{usd,yearly}')::numeric <> 24.99 THEN RAISE EXCEPTION 'T2 partial override: %', r; END IF;
  r := public.web_premium_app_offer_v1(u_none);
  IF (r->>'override')::boolean OR (r#>>'{plans,monthly,price}')::numeric <> 6.99 THEN RAISE EXCEPTION 'T3 default: %', r; END IF;

  -- CBAR rate stored by the function wins over the fallback
  PERFORM public.web_premium_fx_store_v1(1.7000, (now() AT TIME ZONE 'Asia/Baku')::date);
  PERFORM public.web_premium_fx_store_v1(NULL, NULL);  -- a failed attempt keeps the rate
  r := public.web_premium_app_offer_v1(u_none);
  IF r->>'rate_source' <> 'cbar' OR (r->>'rate')::numeric <> 1.7 THEN RAISE EXCEPTION 'T4 cbar rate: %', r; END IF;
  BEGIN
    PERFORM public.web_premium_fx_store_v1(17, current_date);
    RAISE EXCEPTION 'T5 absurd rate stored';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;

  -- cents rounding
  UPDATE public.app_settings SET value = jsonb_set(public._app_setting_object('in_app_epoint_pricing'), '{rounding}', '"cents"') WHERE key = 'in_app_epoint_pricing';
  r := public.web_premium_app_offer_v1(u_none);
  IF (r#>>'{plans,monthly,price}')::numeric <> 6.78 THEN RAISE EXCEPTION 'T6 cents: %', r; END IF;
  UPDATE public.app_settings SET value = jsonb_set(public._app_setting_object('in_app_epoint_pricing'), '{rounding}', '"x99"') WHERE key = 'in_app_epoint_pricing';

  -- not public
  IF public.get_public_app_setting('in_app_epoint_pricing') IS NOT NULL OR public.get_public_app_setting('fx_usd_azn') IS NOT NULL THEN
    RAISE EXCEPTION 'T7 pricing is public';
  END IF;

  -- subscribe locks both converted prices into the subscription
  r := public.web_premium_app_subscribe_start_v1(u_az, 'yearly');
  SELECT to_jsonb(w) INTO s FROM public.web_premium_subscriptions w WHERE id = (r->>'subscription_id')::uuid;
  IF (s->>'price')::numeric <> 33.99 OR (s#>>'{prices,monthly}')::numeric <> 4.99 OR s->>'campaign' <> 'app_usd:AZ'
     OR (SELECT amount FROM public.web_premium_charges WHERE id = (r->>'charge_id')::uuid) <> 33.99 THEN
    RAISE EXCEPTION 'T8 locked price: % / %', r, s;
  END IF;
  -- a later price change does not touch the locked subscription
  UPDATE public.app_settings SET value = jsonb_set(public._app_setting_object('in_app_epoint_pricing'), '{countries,AZ,yearly}', '99') WHERE key = 'in_app_epoint_pricing';
  IF (SELECT price FROM public.web_premium_subscriptions WHERE id = (r->>'subscription_id')::uuid) <> 33.99 THEN RAISE EXCEPTION 'T9 lock'; END IF;

  -- broken settings switch the offer off instead of charging a wrong amount
  UPDATE public.app_settings SET value = '{"default":{"monthly":"abc","yearly":29.99},"fallback_rate":1.7}' WHERE key = 'in_app_epoint_pricing';
  IF (public.web_premium_app_offer_v1(u_none)->>'active')::boolean THEN RAISE EXCEPTION 'T10 broken setting active'; END IF;
  RAISE WARNING 'IN_APP_EPOINT_PRICING_OK';
END $$;

ROLLBACK;
