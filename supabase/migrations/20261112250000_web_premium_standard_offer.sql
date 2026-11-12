-- Web Premium at the normal price (owner request 2026-11-12): outside campaigns anacan.az still sells the renewing
-- subscription (saved Epoint card, automatic renewal, cabinet) at the standard prices of app_settings.web_premium_epoint
-- (monthly 3.99 / yearly 26.99 AZN today). A running campaign keeps priority with its own prices.
--   * web_premium_offer_v1(): the campaign while it is active, else the standard offer (kind 'standard'), else inactive.
--   * web_premium_subscribe_start_v1 now starts from that offer (was: campaign only). Its signature, locks and rows
--     are unchanged; the subscription's campaign column holds 'standard' for standard-price signups.
-- Functions only; no relation changes.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE OR REPLACE FUNCTION public.web_premium_offer_v1()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  c jsonb;
  v jsonb;
  m numeric; y numeric;
BEGIN
  c := public.web_premium_campaign_v1();
  IF coalesce((c->>'active')::boolean, false) THEN
    RETURN c || jsonb_build_object('kind', 'campaign');
  END IF;
  SELECT value INTO v FROM public.app_settings WHERE key = 'web_premium_epoint';
  IF jsonb_typeof(v) = 'string' THEN v := (v #>> '{}')::jsonb; END IF;
  IF v IS NULL OR jsonb_typeof(v) <> 'object' OR coalesce((v->>'enabled')::boolean, false) IS NOT TRUE THEN
    RETURN jsonb_build_object('active', false);
  END IF;
  BEGIN
    m := (v#>>'{prices,monthly}')::numeric;
    y := (v#>>'{prices,yearly}')::numeric;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('active', false);
  END;
  IF m IS NULL OR y IS NULL OR m NOT BETWEEN 0.5 AND 500 OR y NOT BETWEEN 0.5 AND 500 THEN
    RETURN jsonb_build_object('active', false);
  END IF;
  RETURN jsonb_build_object('active', true, 'kind', 'standard', 'name', 'standard',
    'plans', jsonb_build_object('monthly', jsonb_build_object('price', m, 'was', NULL),
                                'yearly', jsonb_build_object('price', y, 'was', NULL)));
END
$function$;
ALTER FUNCTION public.web_premium_offer_v1() OWNER TO pgadmin;
REVOKE ALL ON FUNCTION public.web_premium_offer_v1() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.web_premium_offer_v1() TO service_role;

CREATE OR REPLACE FUNCTION public.web_premium_subscribe_start_v1(p_user uuid, p_plan text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  c jsonb;
  sub_id uuid;
  charge_id uuid;
  v_price numeric;
BEGIN
  IF p_user IS NULL OR p_plan NOT IN ('monthly', 'yearly') THEN RAISE EXCEPTION 'WEB_PREMIUM_INVALID_REQUEST'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('web_premium:' || p_user::text, 0));
  -- A cancelled or lapsed subscription whose period has ended no longer counts as live.
  UPDATE public.web_premium_subscriptions
     SET status = 'expired', ended_at = coalesce(ended_at, current_period_end, now()), next_charge_at = NULL, updated_at = now()
   WHERE user_id = p_user AND status IN ('cancelled', 'past_due') AND coalesce(current_period_end, now()) <= now();
  IF EXISTS (SELECT 1 FROM public.web_premium_subscriptions WHERE user_id = p_user AND status IN ('active', 'past_due', 'cancelled')) THEN
    RAISE EXCEPTION 'WEB_PREMIUM_ALREADY_SUBSCRIBED';
  END IF;
  -- 2026-11-12: the campaign while it runs, otherwise the standard price.
  c := public.web_premium_offer_v1();
  IF coalesce((c->>'active')::boolean, false) IS NOT TRUE THEN RAISE EXCEPTION 'WEB_PREMIUM_CAMPAIGN_INACTIVE'; END IF;
  -- Earlier checkouts the person left on the bank page are abandoned (a late payment is still honoured).
  UPDATE public.web_premium_subscriptions SET status = 'expired', ended_at = now(), updated_at = now()
   WHERE user_id = p_user AND status = 'pending';
  v_price := (c#>>ARRAY['plans', p_plan, 'price'])::numeric;
  INSERT INTO public.web_premium_subscriptions (user_id, plan, price, prices, campaign)
  VALUES (p_user, p_plan, v_price,
          jsonb_build_object('monthly', (c#>>'{plans,monthly,price}')::numeric, 'yearly', (c#>>'{plans,yearly,price}')::numeric),
          c->>'name')
  RETURNING id INTO sub_id;
  INSERT INTO public.web_premium_charges (subscription_id, user_id, kind, plan, amount)
  VALUES (sub_id, p_user, 'initial', p_plan, v_price)
  RETURNING id INTO charge_id;
  RETURN jsonb_build_object('subscription_id', sub_id, 'charge_id', charge_id, 'amount', v_price, 'plan', p_plan,
                            'kind', c->>'kind');
END
$function$;

NOTIFY pgrst, 'reload schema';
COMMIT;
