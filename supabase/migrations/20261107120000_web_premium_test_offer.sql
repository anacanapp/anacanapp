-- Web Premium: admin-only test offer (yearly plan at a tiny price) to test real Epoint card payments,
-- saved cards and renewals end to end. Only accounts with the 'admin' role see or can buy it; ordinary users never do.
-- Configured in app_settings 'web_premium_test' {enabled, plan, price}; default yearly 0.01 AZN (Epoint is AZN only).
-- No new relations (app_settings row only), so no CDC enrollment changes.

INSERT INTO public.app_settings (key, value)
VALUES ('web_premium_test', '{"enabled": true, "plan": "yearly", "price": 0.01}'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.web_premium_test_offer_v1(p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v jsonb;
  v_price numeric;
BEGIN
  IF p_user IS NULL OR NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user AND role = 'admin') THEN RETURN NULL; END IF;
  SELECT value INTO v FROM public.app_settings WHERE key = 'web_premium_test';
  IF jsonb_typeof(v) = 'string' THEN v := (v #>> '{}')::jsonb; END IF;
  IF v IS NULL OR jsonb_typeof(v) <> 'object' OR coalesce((v->>'enabled')::boolean, false) IS NOT TRUE THEN RETURN NULL; END IF;
  BEGIN v_price := (v->>'price')::numeric; EXCEPTION WHEN OTHERS THEN RETURN NULL; END;
  IF v_price IS NULL OR v_price NOT BETWEEN 0.01 AND 1 OR coalesce(v->>'plan', '') NOT IN ('monthly', 'yearly') THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('plan', v->>'plan', 'price', round(v_price, 2));
END
$function$;

CREATE OR REPLACE FUNCTION public.web_premium_subscribe_test_start_v1(p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  offer jsonb;
  sub_id uuid;
  charge_id uuid;
  v_plan text;
  v_price numeric;
BEGIN
  offer := public.web_premium_test_offer_v1(p_user);
  IF offer IS NULL THEN RAISE EXCEPTION 'WEB_PREMIUM_INVALID_REQUEST'; END IF;
  v_plan := offer->>'plan';
  v_price := (offer->>'price')::numeric;
  PERFORM pg_advisory_xact_lock(hashtextextended('web_premium:' || p_user::text, 0));
  UPDATE public.web_premium_subscriptions
     SET status = 'expired', ended_at = coalesce(ended_at, current_period_end, now()), next_charge_at = NULL, updated_at = now()
   WHERE user_id = p_user AND status IN ('cancelled', 'past_due') AND coalesce(current_period_end, now()) <= now();
  IF EXISTS (SELECT 1 FROM public.web_premium_subscriptions WHERE user_id = p_user AND status IN ('active', 'past_due', 'cancelled')) THEN
    RAISE EXCEPTION 'WEB_PREMIUM_ALREADY_SUBSCRIBED';
  END IF;
  UPDATE public.web_premium_subscriptions SET status = 'expired', ended_at = now(), updated_at = now()
   WHERE user_id = p_user AND status = 'pending';
  -- Both plan prices are the test price, so a later plan change also stays a test.
  INSERT INTO public.web_premium_subscriptions (user_id, plan, price, prices, campaign)
  VALUES (p_user, v_plan, v_price, jsonb_build_object('monthly', v_price, 'yearly', v_price), 'admin-test')
  RETURNING id INTO sub_id;
  INSERT INTO public.web_premium_charges (subscription_id, user_id, kind, plan, amount)
  VALUES (sub_id, p_user, 'initial', v_plan, v_price)
  RETURNING id INTO charge_id;
  RETURN jsonb_build_object('subscription_id', sub_id, 'charge_id', charge_id, 'amount', v_price, 'plan', v_plan, 'test', true);
END
$function$;

REVOKE ALL ON FUNCTION public.web_premium_test_offer_v1(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.web_premium_subscribe_test_start_v1(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.web_premium_test_offer_v1(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.web_premium_subscribe_test_start_v1(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
