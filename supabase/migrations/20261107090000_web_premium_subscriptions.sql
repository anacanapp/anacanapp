-- anacan.az web subscriptions: monthly / yearly Anacan Premium, paid by card through Epoint, renewing automatically.
--
-- The first payment registers the card and pays in one step (Epoint card-registration-with-pay). Renewals charge the
-- saved card server-side (execute-pay) from the web-premium-renew timer, one day before the period ends. Subscribers
-- keep the price they signed up with on every renewal until they cancel (owner decision 2026-11-06): both plan prices
-- are locked on the subscription, so a plan switch also keeps the campaign price.
--
-- * epoint_saved_cards: Epoint card_id per user (pending until the signed callback / get-status confirms it).
--   card_id never leaves the server: the user RPCs below return only mask, name, expiry and status.
-- * web_premium_subscriptions: one live subscription per user (active | past_due | cancelled).
-- * web_premium_charges: one row per Epoint payment; id = Epoint order_id. One pending/paid charge per period.
-- * Entitlement: every paid charge writes the existing web_subscriptions row (provider 'epoint',
--   provider_subscription_id 'epoint_sub_<subscription id>', user_id set directly), so web_entitlement_v1 and the
--   app's entitlement sync (revenuecat-sync webEntitlement → withWeb) keep working unchanged.
-- * QayğıCash: qc_web_premium earns only for funnel passes (web_premium_orders), so every paid charge earns
--   explicitly through qc_earn_web_premium_charge_v1 (source_type 'web_premium', source_id = charge id).
-- * app_settings.web_premium_campaign: campaign window and prices (AZN, server-side only).
--
-- Service-role RPCs are called by the web-premium, web-premium-renew and epoint-payment functions; the
-- web_premium_my_*_v1 RPCs are for the signed-in user (SECURITY DEFINER, filtered by auth.uid()).
--
-- Applied by /home/anacan-runner/run-sql.py (psql as supabase_admin, ON_ERROR_STOP, one transaction).
-- The three new relations are CDC/writer guarded below; see the .cdc.json manifest.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

DO $$
BEGIN
  IF to_regclass('_anacan_gcp_migration.guarded_relations') IS NULL THEN
    RAISE EXCEPTION 'WEB_PREMIUM_SUBSCRIPTIONS_GUARD_CATALOG_MISSING';
  END IF;
  IF (SELECT count(*) FROM _anacan_gcp_migration.guarded_relations
       WHERE schema_name = 'public' AND table_name IN ('web_subscriptions', 'app_settings', 'web_premium_orders', 'cashback_lots')) <> 4 THEN
    RAISE EXCEPTION 'WEB_PREMIUM_SUBSCRIPTIONS_EXISTING_RELATIONS_NOT_GUARDED';
  END IF;
  IF to_regprocedure('public.qc_earn(uuid,text,text,text,text,bigint,boolean,text,text)') IS NULL
     OR to_regprocedure('public.qc_to_minor(numeric)') IS NULL THEN
    RAISE EXCEPTION 'WEB_PREMIUM_SUBSCRIPTIONS_QAYGICASH_MISSING';
  END IF;
END $$;

-- ── Tables ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.epoint_saved_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  card_id text NOT NULL UNIQUE CHECK (card_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  purpose text NOT NULL CHECK (purpose IN ('subscribe', 'add_card')),
  mask text CHECK (mask IS NULL OR length(mask) <= 32),
  card_name text CHECK (card_name IS NULL OR length(card_name) <= 64),
  expiry text CHECK (expiry IS NULL OR length(expiry) <= 10),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'failed', 'removed')),
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS epoint_saved_cards_user_idx ON public.epoint_saved_cards (user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS epoint_saved_cards_one_default ON public.epoint_saved_cards (user_id) WHERE is_default AND status = 'active';

CREATE TABLE IF NOT EXISTS public.web_premium_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan text NOT NULL CHECK (plan IN ('monthly', 'yearly')),
  price numeric(10, 2) NOT NULL CHECK (price > 0),
  -- Both plan prices, locked at signup: renewals and plan switches keep them until the subscription ends.
  prices jsonb NOT NULL CHECK ((prices->>'monthly')::numeric > 0 AND (prices->>'yearly')::numeric > 0),
  currency text NOT NULL DEFAULT 'AZN' CHECK (currency = 'AZN'),
  campaign text CHECK (campaign IS NULL OR length(campaign) <= 64),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'past_due', 'cancelled', 'expired')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  next_plan text CHECK (next_plan IS NULL OR next_plan IN ('monthly', 'yearly')),
  card_ref uuid REFERENCES public.epoint_saved_cards(id) ON DELETE SET NULL,
  next_charge_at timestamptz,
  failed_attempts integer NOT NULL DEFAULT 0 CHECK (failed_attempts BETWEEN 0 AND 10),
  web_subscription_id uuid REFERENCES public.web_subscriptions(id) ON DELETE SET NULL,
  cancelled_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS web_premium_subscriptions_one_live ON public.web_premium_subscriptions (user_id)
  WHERE status IN ('active', 'past_due', 'cancelled');
CREATE INDEX IF NOT EXISTS web_premium_subscriptions_user_idx ON public.web_premium_subscriptions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS web_premium_subscriptions_due_idx ON public.web_premium_subscriptions (next_charge_at)
  WHERE status IN ('active', 'past_due') AND NOT cancel_at_period_end;

CREATE TABLE IF NOT EXISTS public.web_premium_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),          -- Epoint order_id
  subscription_id uuid NOT NULL REFERENCES public.web_premium_subscriptions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('initial', 'renewal')),
  plan text NOT NULL CHECK (plan IN ('monthly', 'yearly')),
  amount numeric(10, 2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'AZN' CHECK (currency = 'AZN'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed')),
  period_from timestamptz,                                 -- renewal: the period end this charge continues from
  period_start timestamptz,
  period_end timestamptz,
  card_ref uuid REFERENCES public.epoint_saved_cards(id) ON DELETE SET NULL,
  provider_transaction text CHECK (provider_transaction IS NULL OR length(provider_transaction) <= 128),
  error text CHECK (error IS NULL OR length(error) <= 160),
  attempt integer NOT NULL DEFAULT 1 CHECK (attempt BETWEEN 1 AND 10),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);
CREATE INDEX IF NOT EXISTS web_premium_charges_user_idx ON public.web_premium_charges (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS web_premium_charges_card_idx ON public.web_premium_charges (card_ref) WHERE status = 'pending';
-- Idempotency: at most one in-flight or paid charge per subscription period.
CREATE UNIQUE INDEX IF NOT EXISTS web_premium_charges_one_initial ON public.web_premium_charges (subscription_id)
  WHERE kind = 'initial' AND status IN ('pending', 'paid');
CREATE UNIQUE INDEX IF NOT EXISTS web_premium_charges_one_per_period ON public.web_premium_charges (subscription_id, period_from)
  WHERE kind = 'renewal' AND status IN ('pending', 'paid');

ALTER TABLE public.epoint_saved_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.web_premium_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.web_premium_charges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.epoint_saved_cards, public.web_premium_subscriptions, public.web_premium_charges FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.epoint_saved_cards, public.web_premium_subscriptions, public.web_premium_charges TO service_role;

-- ── Campaign (prices are server-side only) ──────────────────────────────────────────────
INSERT INTO public.app_settings (key, value, description)
SELECT 'web_premium_campaign',
       '{"active": true, "name": "weekend-2026-11", "starts_at": "2026-11-06T00:00:00+04:00", "ends_at": "2026-11-08T23:59:59+04:00",
         "plans": {"monthly": {"price": 4.99, "was": 6.78}, "yearly": {"price": 24.99, "was": 50.98}}}'::jsonb,
       'anacan.az web subscriptions (Epoint, AZN): campaign window and prices; subscribers keep the price on renewals'
 WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'web_premium_campaign');

-- {active, name, starts_at, ends_at, plans{monthly{price, was}, yearly{price, was}}}; inactive when malformed.
CREATE OR REPLACE FUNCTION public.web_premium_campaign_v1()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v jsonb;
  starts timestamptz;
  ends timestamptz;
  m numeric; mw numeric; y numeric; yw numeric;
  plans jsonb;
BEGIN
  SELECT value INTO v FROM public.app_settings WHERE key = 'web_premium_campaign';
  IF jsonb_typeof(v) = 'string' THEN v := (v #>> '{}')::jsonb; END IF;
  IF v IS NULL OR jsonb_typeof(v) <> 'object' THEN RETURN jsonb_build_object('active', false); END IF;
  BEGIN
    starts := nullif(v->>'starts_at', '')::timestamptz;
    ends := nullif(v->>'ends_at', '')::timestamptz;
    m := (v#>>'{plans,monthly,price}')::numeric; mw := (v#>>'{plans,monthly,was}')::numeric;
    y := (v#>>'{plans,yearly,price}')::numeric; yw := (v#>>'{plans,yearly,was}')::numeric;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('active', false);
  END;
  IF m IS NULL OR y IS NULL OR m NOT BETWEEN 0.5 AND 500 OR y NOT BETWEEN 0.5 AND 500 THEN
    RETURN jsonb_build_object('active', false);
  END IF;
  plans := jsonb_build_object(
    'monthly', jsonb_build_object('price', round(m, 2), 'was', CASE WHEN mw > m THEN round(mw, 2) END),
    'yearly', jsonb_build_object('price', round(y, 2), 'was', CASE WHEN yw > y THEN round(yw, 2) END));
  RETURN jsonb_build_object(
    'active', coalesce((v->>'active')::boolean, false) AND (starts IS NULL OR now() >= starts) AND (ends IS NULL OR now() < ends),
    'name', left(v->>'name', 64), 'starts_at', starts, 'ends_at', ends, 'plans', plans);
END
$function$;

-- ── Read model (never exposes Epoint card_id) ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.web_premium_subscription_json(p_user uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT jsonb_build_object(
    'id', s.id, 'plan', s.plan, 'price', s.price, 'currency', s.currency, 'campaign', s.campaign, 'status', s.status,
    'current_period_start', s.current_period_start, 'current_period_end', s.current_period_end,
    'cancel_at_period_end', s.cancel_at_period_end, 'next_plan', s.next_plan,
    'next_price', (s.prices->>coalesce(s.next_plan, s.plan))::numeric,
    'prices', s.prices, 'next_charge_at', s.next_charge_at, 'failed_attempts', s.failed_attempts,
    'card', CASE WHEN c.id IS NOT NULL AND c.status = 'active' THEN jsonb_build_object('id', c.id, 'mask', c.mask, 'card_name', c.card_name) END,
    'created_at', s.created_at)
    FROM public.web_premium_subscriptions s
    LEFT JOIN public.epoint_saved_cards c ON c.id = s.card_ref
   WHERE s.user_id = p_user AND s.status IN ('active', 'past_due', 'cancelled')
   ORDER BY s.created_at DESC
   LIMIT 1
$function$;

CREATE OR REPLACE FUNCTION public.web_premium_cards_json(p_user uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'mask', c.mask, 'card_name', c.card_name, 'expiry', c.expiry,
           'status', c.status, 'is_default', c.is_default, 'created_at', c.created_at)
         ORDER BY c.is_default DESC, c.created_at DESC), '[]'::jsonb)
    FROM public.epoint_saved_cards c
   WHERE c.user_id = p_user
     AND (c.status = 'active' OR (c.status = 'pending' AND c.purpose = 'add_card' AND c.created_at > now() - interval '1 hour'))
$function$;

CREATE OR REPLACE FUNCTION public.web_premium_charges_json(p_user uuid, p_limit integer DEFAULT 50)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT coalesce(jsonb_agg(x.j ORDER BY x.created_at DESC), '[]'::jsonb) FROM (
    SELECT ch.created_at, jsonb_build_object('id', ch.id, 'kind', ch.kind, 'plan', ch.plan, 'amount', ch.amount,
             'currency', ch.currency, 'status', ch.status, 'created_at', ch.created_at, 'paid_at', ch.paid_at,
             'period_end', ch.period_end, 'card_mask', c.mask) AS j
      FROM public.web_premium_charges ch
      LEFT JOIN public.epoint_saved_cards c ON c.id = ch.card_ref
     WHERE ch.user_id = p_user
       -- A checkout the person left on the bank page is not a payment; show it only once it failed or was paid.
       AND NOT (ch.kind = 'initial' AND ch.status = 'pending' AND ch.created_at < now() - interval '1 hour')
     ORDER BY ch.created_at DESC
     LIMIT least(greatest(coalesce(p_limit, 50), 1), 100)) x
$function$;

-- Service role: everything the cabinet shows for one user.
CREATE OR REPLACE FUNCTION public.web_premium_account_v1(p_user uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT jsonb_build_object('subscription', public.web_premium_subscription_json(p_user),
    'cards', public.web_premium_cards_json(p_user), 'charges', public.web_premium_charges_json(p_user, 24))
$function$;

-- Signed-in user.
CREATE OR REPLACE FUNCTION public.web_premium_my_subscription_v1()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;
  RETURN public.web_premium_subscription_json(auth.uid());
END $function$;
CREATE OR REPLACE FUNCTION public.web_premium_my_cards_v1()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;
  RETURN public.web_premium_cards_json(auth.uid());
END $function$;
CREATE OR REPLACE FUNCTION public.web_premium_my_charges_v1(p_limit integer DEFAULT 50)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;
  RETURN public.web_premium_charges_json(auth.uid(), p_limit);
END $function$;

-- ── Subscribe ───────────────────────────────────────────────────────────────────────────
-- Creates a pending subscription and its initial charge at the campaign price. The web-premium function then asks
-- Epoint for card-registration-with-pay with order_id = charge id and stores the returned card_id as a pending card.
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
  c := public.web_premium_campaign_v1();
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
  RETURN jsonb_build_object('subscription_id', sub_id, 'charge_id', charge_id, 'amount', v_price, 'plan', p_plan);
END
$function$;

-- Stores the card_id from Epoint's immediate answer as a pending card, so its signed callback can be matched.
CREATE OR REPLACE FUNCTION public.web_premium_card_pending_v1(p_user uuid, p_card_id text, p_purpose text, p_charge uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  card uuid;
  owner uuid;
BEGIN
  IF p_user IS NULL OR p_purpose NOT IN ('subscribe', 'add_card') THEN RAISE EXCEPTION 'WEB_PREMIUM_INVALID_REQUEST'; END IF;
  INSERT INTO public.epoint_saved_cards (user_id, card_id, purpose) VALUES (p_user, p_card_id, p_purpose)
  ON CONFLICT (card_id) DO NOTHING
  RETURNING id INTO card;
  IF card IS NULL THEN
    SELECT id, user_id INTO card, owner FROM public.epoint_saved_cards WHERE card_id = p_card_id;
    IF owner IS DISTINCT FROM p_user THEN RAISE EXCEPTION 'WEB_PREMIUM_CARD_CONFLICT'; END IF;
  END IF;
  IF p_charge IS NOT NULL THEN
    UPDATE public.web_premium_charges SET card_ref = card, updated_at = now()
     WHERE id = p_charge AND user_id = p_user AND status = 'pending';
    UPDATE public.web_premium_subscriptions s SET card_ref = card, updated_at = now()
      FROM public.web_premium_charges ch
     WHERE ch.id = p_charge AND ch.user_id = p_user AND s.id = ch.subscription_id;
  END IF;
  RETURN card;
END
$function$;

-- ── Card results (signed Epoint callback) ───────────────────────────────────────────────
-- Activates (or fails) a registered card. Provider truth wins: a late success also activates a card marked failed.
CREATE OR REPLACE FUNCTION public.web_premium_card_result_v1(p_card_id text, p_success boolean, p_mask text DEFAULT NULL,
  p_card_name text DEFAULT NULL, p_expiry text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  c public.epoint_saved_cards%ROWTYPE;
  has_default boolean;
BEGIN
  SELECT * INTO c FROM public.epoint_saved_cards WHERE card_id = p_card_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF c.status = 'removed' OR (c.status = 'active' AND p_success) THEN
    RETURN jsonb_build_object('changed', false, 'user_id', c.user_id, 'purpose', c.purpose, 'status', c.status);
  END IF;
  IF NOT p_success THEN
    UPDATE public.epoint_saved_cards SET status = 'failed', updated_at = now() WHERE id = c.id AND status = 'pending';
    RETURN jsonb_build_object('changed', FOUND, 'user_id', c.user_id, 'purpose', c.purpose, 'status', 'failed');
  END IF;
  SELECT EXISTS (SELECT 1 FROM public.epoint_saved_cards WHERE user_id = c.user_id AND is_default AND status = 'active') INTO has_default;
  UPDATE public.epoint_saved_cards
     SET status = 'active', is_default = NOT has_default, updated_at = now(),
         mask = coalesce(left(nullif(p_mask, ''), 32), mask), card_name = coalesce(left(nullif(p_card_name, ''), 64), card_name),
         expiry = coalesce(left(nullif(p_expiry, ''), 10), expiry)
   WHERE id = c.id;
  -- The first card of a renewing subscription without a usable card becomes its renewal card.
  UPDATE public.web_premium_subscriptions s SET card_ref = c.id, updated_at = now()
   WHERE s.user_id = c.user_id AND s.status IN ('active', 'past_due', 'cancelled')
     AND NOT EXISTS (SELECT 1 FROM public.epoint_saved_cards x WHERE x.id = s.card_ref AND x.status = 'active');
  RETURN jsonb_build_object('changed', true, 'user_id', c.user_id, 'purpose', c.purpose, 'status', 'active');
END
$function$;

-- Pending charge that a card registration belongs to (card-registration-with-pay callback without order_id).
CREATE OR REPLACE FUNCTION public.web_premium_charge_for_card_v1(p_card_id text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT ch.id FROM public.web_premium_charges ch JOIN public.epoint_saved_cards c ON c.id = ch.card_ref
   WHERE c.card_id = p_card_id AND ch.kind = 'initial'
   ORDER BY (ch.status = 'pending') DESC, ch.created_at DESC LIMIT 1
$function$;

-- ── QayğıCash per paid charge ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qc_earn_web_premium_charge_v1(p_charge uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  ch public.web_premium_charges%ROWTYPE;
BEGIN
  SELECT * INTO ch FROM public.web_premium_charges
   WHERE id = p_charge AND status = 'paid' AND coalesce(error, '') <> 'duplicate_refund_required';
  IF NOT FOUND THEN RETURN NULL; END IF;
  BEGIN
    RETURN public.qc_earn(ch.user_id, 'AZ', 'premium_' || ch.plan, 'web_premium', ch.id::text,
                          public.qc_to_minor(ch.amount), true, 'system:web-premium');
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'qaygicash web premium charge skipped: %', SQLERRM;
    RETURN NULL;
  END;
END
$function$;

-- ── Charge results ──────────────────────────────────────────────────────────────────────
-- Idempotent and amount-checked (like web_premium_epoint_grant_v1). Extends the period, writes the entitlement row
-- in web_subscriptions and earns QayğıCash. Called only after a signed callback or get-status confirmed the payment.
CREATE OR REPLACE FUNCTION public.web_premium_charge_paid_v1(p_charge uuid, p_amount numeric, p_transaction text,
  p_mask text DEFAULT NULL, p_card_name text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  ch public.web_premium_charges%ROWTYPE;
  s public.web_premium_subscriptions%ROWTYPE;
  v_start timestamptz;
  v_end timestamptz;
  v_email text;
  ws_id uuid;
BEGIN
  SELECT * INTO ch FROM public.web_premium_charges WHERE id = p_charge FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'WEB_PREMIUM_CHARGE_NOT_FOUND'; END IF;
  IF ch.status = 'paid' THEN
    RETURN jsonb_build_object('changed', false, 'user_id', ch.user_id, 'subscription_id', ch.subscription_id, 'kind', ch.kind,
      'plan', ch.plan, 'amount', ch.amount, 'period_end', ch.period_end);
  END IF;
  IF p_amount IS NULL OR abs(p_amount - ch.amount) > 0.001 THEN RAISE EXCEPTION 'WEB_PREMIUM_AMOUNT_MISMATCH'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('web_premium:' || ch.user_id::text, 0));
  SELECT * INTO s FROM public.web_premium_subscriptions WHERE id = ch.subscription_id FOR UPDATE;

  -- Paid twice (an abandoned checkout paid late while another subscription is live): keep the money traceable for a
  -- refund, but do not start a second subscription.
  IF EXISTS (SELECT 1 FROM public.web_premium_subscriptions WHERE user_id = ch.user_id AND id <> s.id
              AND status IN ('active', 'past_due', 'cancelled')) THEN
    UPDATE public.web_premium_charges SET status = 'paid', paid_at = now(), updated_at = now(), error = 'duplicate_refund_required',
           provider_transaction = coalesce(left(p_transaction, 128), provider_transaction)
     WHERE id = ch.id;
    RAISE WARNING 'web premium charge % paid while another subscription is live: refund required', ch.id;
    RETURN jsonb_build_object('changed', true, 'duplicate', true, 'user_id', ch.user_id, 'subscription_id', s.id,
      'kind', ch.kind, 'plan', ch.plan, 'amount', ch.amount);
  END IF;

  IF ch.card_ref IS NOT NULL THEN
    UPDATE public.epoint_saved_cards c
       SET status = 'active', updated_at = now(),
           is_default = c.is_default OR NOT EXISTS (SELECT 1 FROM public.epoint_saved_cards d
                          WHERE d.user_id = c.user_id AND d.is_default AND d.status = 'active' AND d.id <> c.id),
           mask = coalesce(left(nullif(p_mask, ''), 32), c.mask), card_name = coalesce(left(nullif(p_card_name, ''), 64), c.card_name)
     WHERE c.id = ch.card_ref AND c.status IN ('pending', 'active', 'failed');
  END IF;

  v_start := CASE WHEN ch.kind = 'initial' THEN now() ELSE greatest(coalesce(ch.period_from, s.current_period_end, now()), now()) END;
  v_end := v_start + CASE ch.plan WHEN 'yearly' THEN interval '12 months' ELSE interval '1 month' END;

  UPDATE public.web_premium_charges
     SET status = 'paid', paid_at = now(), updated_at = now(), period_start = v_start, period_end = v_end, error = NULL,
         provider_transaction = coalesce(left(p_transaction, 128), provider_transaction)
   WHERE id = ch.id;

  UPDATE public.web_premium_subscriptions
     SET status = CASE WHEN cancel_at_period_end THEN 'cancelled' ELSE 'active' END,
         plan = ch.plan, price = ch.amount, next_plan = CASE WHEN next_plan = ch.plan THEN NULL ELSE next_plan END,
         current_period_start = v_start, current_period_end = v_end, failed_attempts = 0, ended_at = NULL,
         next_charge_at = CASE WHEN cancel_at_period_end THEN NULL ELSE v_end - interval '1 day' END,
         card_ref = coalesce(ch.card_ref, card_ref), updated_at = now()
   WHERE id = s.id;

  SELECT lower(u.email) INTO v_email FROM auth.users u WHERE u.id = ch.user_id;
  v_email := coalesce(nullif(v_email, ''), 'user-' || ch.user_id::text || '@users.anacan.az');
  INSERT INTO public.web_subscriptions (provider, provider_subscription_id, email, user_id, product_id, plan, status,
    current_period_end, cancel_at_period_end, test_mode, updated_at)
  VALUES ('epoint', 'epoint_sub_' || s.id::text, v_email, ch.user_id, 'epoint_sub_' || ch.plan, ch.plan, 'active',
    v_end, s.cancel_at_period_end, false, now())
  ON CONFLICT (provider_subscription_id) DO UPDATE
     SET user_id = EXCLUDED.user_id, plan = EXCLUDED.plan, product_id = EXCLUDED.product_id, status = 'active',
         current_period_end = EXCLUDED.current_period_end, cancel_at_period_end = EXCLUDED.cancel_at_period_end, updated_at = now()
  RETURNING id INTO ws_id;
  UPDATE public.web_premium_subscriptions SET web_subscription_id = ws_id WHERE id = s.id;

  PERFORM public.qc_earn_web_premium_charge_v1(ch.id);
  RETURN jsonb_build_object('changed', true, 'user_id', ch.user_id, 'subscription_id', s.id, 'kind', ch.kind,
    'plan', ch.plan, 'amount', ch.amount, 'period_end', v_end);
END
$function$;

-- A failed initial checkout ends the pending subscription. A failed renewal is retried after 24 hours, three attempts
-- in all; then the subscription expires and Premium ends at current_period_end.
CREATE OR REPLACE FUNCTION public.web_premium_charge_failed_v1(p_charge uuid, p_error text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  ch public.web_premium_charges%ROWTYPE;
  s public.web_premium_subscriptions%ROWTYPE;
  attempts integer;
BEGIN
  SELECT * INTO ch FROM public.web_premium_charges WHERE id = p_charge FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'WEB_PREMIUM_CHARGE_NOT_FOUND'; END IF;
  IF ch.status <> 'pending' THEN
    RETURN jsonb_build_object('changed', false, 'user_id', ch.user_id, 'kind', ch.kind, 'status', ch.status);
  END IF;
  UPDATE public.web_premium_charges SET status = 'failed', error = left(coalesce(p_error, 'failed'), 160), updated_at = now() WHERE id = ch.id;
  SELECT * INTO s FROM public.web_premium_subscriptions WHERE id = ch.subscription_id FOR UPDATE;

  IF ch.kind = 'initial' THEN
    UPDATE public.web_premium_subscriptions SET status = 'expired', ended_at = now(), updated_at = now() WHERE id = s.id AND status = 'pending';
    UPDATE public.epoint_saved_cards SET status = 'failed', updated_at = now() WHERE id = ch.card_ref AND status = 'pending';
    RETURN jsonb_build_object('changed', true, 'user_id', ch.user_id, 'kind', 'initial', 'outcome', 'checkout_failed');
  END IF;

  IF s.status NOT IN ('active', 'past_due') OR s.cancel_at_period_end THEN
    RETURN jsonb_build_object('changed', true, 'user_id', ch.user_id, 'kind', 'renewal', 'outcome', 'ignored');
  END IF;
  attempts := s.failed_attempts + 1;
  IF attempts >= 3 THEN
    UPDATE public.web_premium_subscriptions
       SET status = 'expired', failed_attempts = attempts, next_charge_at = NULL, ended_at = current_period_end, updated_at = now()
     WHERE id = s.id;
    UPDATE public.web_subscriptions
       SET cancel_at_period_end = true, status = CASE WHEN current_period_end > now() THEN status ELSE 'expired' END, updated_at = now()
     WHERE id = s.web_subscription_id;
    RETURN jsonb_build_object('changed', true, 'user_id', ch.user_id, 'kind', 'renewal', 'outcome', 'expired',
      'attempts', attempts, 'plan', ch.plan, 'amount', ch.amount, 'period_end', s.current_period_end);
  END IF;
  UPDATE public.web_premium_subscriptions
     SET status = 'past_due', failed_attempts = attempts, next_charge_at = now() + interval '24 hours', updated_at = now()
   WHERE id = s.id;
  UPDATE public.web_subscriptions SET status = 'past_due', updated_at = now() WHERE id = s.web_subscription_id;
  RETURN jsonb_build_object('changed', true, 'user_id', ch.user_id, 'kind', 'renewal', 'outcome', 'retry',
    'attempts', attempts, 'plan', ch.plan, 'amount', ch.amount, 'period_end', s.current_period_end);
END
$function$;

-- ── Renewals (web-premium-renew timer) ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.web_premium_renewals_due_v1(p_limit integer DEFAULT 50)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT id FROM public.web_premium_subscriptions
   WHERE status IN ('active', 'past_due') AND NOT cancel_at_period_end AND next_charge_at <= now()
   ORDER BY next_charge_at
   LIMIT least(greatest(coalesce(p_limit, 50), 1), 500)
$function$;

-- Creates (or resumes) the renewal charge of one due subscription. Returns the Epoint card_id to the service only.
-- {due:false} when nothing is due; {due:true, resumed, charge_id, amount, plan, card_id|null, created_at}.
CREATE OR REPLACE FUNCTION public.web_premium_renewal_claim_v1(p_subscription uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  s public.web_premium_subscriptions%ROWTYPE;
  ch public.web_premium_charges%ROWTYPE;
  card public.epoint_saved_cards%ROWTYPE;
  v_plan text;
  v_amount numeric;
BEGIN
  SELECT * INTO s FROM public.web_premium_subscriptions WHERE id = p_subscription FOR UPDATE;
  IF NOT FOUND OR s.status NOT IN ('active', 'past_due') OR s.cancel_at_period_end OR s.next_charge_at IS NULL
     OR s.next_charge_at > now() OR s.current_period_end IS NULL THEN
    RETURN jsonb_build_object('due', false);
  END IF;
  SELECT * INTO ch FROM public.web_premium_charges
   WHERE subscription_id = s.id AND kind = 'renewal' AND period_from = s.current_period_end AND status IN ('pending', 'paid')
   ORDER BY created_at DESC LIMIT 1;
  IF FOUND AND ch.status = 'paid' THEN RETURN jsonb_build_object('due', false, 'reason', 'already_paid'); END IF;
  IF FOUND THEN
    SELECT * INTO card FROM public.epoint_saved_cards WHERE id = ch.card_ref;
    RETURN jsonb_build_object('due', true, 'resumed', true, 'charge_id', ch.id, 'amount', ch.amount, 'plan', ch.plan,
      'card_id', card.card_id, 'user_id', s.user_id, 'created_at', ch.created_at);
  END IF;
  SELECT * INTO card FROM public.epoint_saved_cards
   WHERE user_id = s.user_id AND status = 'active'
   ORDER BY (id = s.card_ref) DESC, is_default DESC, created_at DESC LIMIT 1;
  v_plan := coalesce(s.next_plan, s.plan);
  v_amount := (s.prices->>v_plan)::numeric;
  INSERT INTO public.web_premium_charges (subscription_id, user_id, kind, plan, amount, period_from, card_ref, attempt)
  VALUES (s.id, s.user_id, 'renewal', v_plan, v_amount, s.current_period_end, card.id, least(s.failed_attempts + 1, 10))
  RETURNING * INTO ch;
  RETURN jsonb_build_object('due', true, 'resumed', false, 'charge_id', ch.id, 'amount', ch.amount, 'plan', ch.plan,
    'card_id', card.card_id, 'user_id', s.user_id, 'created_at', ch.created_at);
END
$function$;

-- Ends cancelled subscriptions after their period, abandons stale checkouts and card registrations.
CREATE OR REPLACE FUNCTION public.web_premium_housekeeping_v1()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  ended integer;
  abandoned integer;
  cards integer;
BEGIN
  WITH e AS (
    UPDATE public.web_premium_subscriptions SET status = 'expired', ended_at = current_period_end, next_charge_at = NULL, updated_at = now()
     WHERE status = 'cancelled' AND current_period_end <= now()
    RETURNING web_subscription_id),
  w AS (
    UPDATE public.web_subscriptions ws SET status = 'expired', updated_at = now() FROM e WHERE ws.id = e.web_subscription_id
    RETURNING ws.id)
  SELECT count(*) INTO ended FROM e;
  -- Subscriptions that lapsed after three failed renewals keep Premium until their period end; then the row ends too.
  UPDATE public.web_subscriptions ws SET status = 'expired', updated_at = now()
    FROM public.web_premium_subscriptions s
   WHERE s.web_subscription_id = ws.id AND s.status = 'expired' AND ws.status <> 'expired' AND ws.current_period_end <= now();
  UPDATE public.web_premium_subscriptions SET status = 'expired', ended_at = now(), updated_at = now()
   WHERE status = 'pending' AND created_at < now() - interval '1 day';
  GET DIAGNOSTICS abandoned = ROW_COUNT;
  UPDATE public.epoint_saved_cards SET status = 'failed', updated_at = now()
   WHERE status = 'pending' AND created_at < now() - interval '1 day';
  GET DIAGNOSTICS cards = ROW_COUNT;
  RETURN jsonb_build_object('ended', ended, 'abandoned', abandoned, 'stale_cards', cards);
END
$function$;

-- ── Cabinet actions (web-premium function, after the user's JWT is verified) ────────────
CREATE OR REPLACE FUNCTION public.web_premium_cancel_v1(p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  s public.web_premium_subscriptions%ROWTYPE;
BEGIN
  SELECT * INTO s FROM public.web_premium_subscriptions WHERE user_id = p_user AND status IN ('active', 'past_due') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'WEB_PREMIUM_NO_SUBSCRIPTION'; END IF;
  UPDATE public.web_premium_subscriptions
     SET status = CASE WHEN current_period_end > now() THEN 'cancelled' ELSE 'expired' END,
         ended_at = CASE WHEN current_period_end > now() THEN NULL ELSE current_period_end END,
         cancel_at_period_end = true, cancelled_at = now(), next_charge_at = NULL, updated_at = now()
   WHERE id = s.id;
  UPDATE public.web_subscriptions SET cancel_at_period_end = true, updated_at = now() WHERE id = s.web_subscription_id;
  RETURN public.web_premium_subscription_json(p_user);
END
$function$;

CREATE OR REPLACE FUNCTION public.web_premium_resume_v1(p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  s public.web_premium_subscriptions%ROWTYPE;
BEGIN
  SELECT * INTO s FROM public.web_premium_subscriptions WHERE user_id = p_user AND status = 'cancelled' FOR UPDATE;
  IF NOT FOUND OR s.current_period_end <= now() THEN RAISE EXCEPTION 'WEB_PREMIUM_CANNOT_RESUME'; END IF;
  UPDATE public.web_premium_subscriptions
     SET status = CASE WHEN failed_attempts > 0 THEN 'past_due' ELSE 'active' END,
         cancel_at_period_end = false, cancelled_at = NULL, updated_at = now(),
         next_charge_at = CASE WHEN failed_attempts > 0 THEN now() ELSE greatest(current_period_end - interval '1 day', now()) END
   WHERE id = s.id;
  UPDATE public.web_subscriptions SET cancel_at_period_end = false, updated_at = now() WHERE id = s.web_subscription_id;
  RETURN public.web_premium_subscription_json(p_user);
END
$function$;

-- The new plan applies from the next renewal, at the price locked at signup.
CREATE OR REPLACE FUNCTION public.web_premium_change_plan_v1(p_user uuid, p_plan text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF p_plan NOT IN ('monthly', 'yearly') THEN RAISE EXCEPTION 'WEB_PREMIUM_INVALID_REQUEST'; END IF;
  UPDATE public.web_premium_subscriptions
     SET next_plan = CASE WHEN p_plan = plan THEN NULL ELSE p_plan END, updated_at = now()
   WHERE user_id = p_user AND status IN ('active', 'past_due', 'cancelled');
  IF NOT FOUND THEN RAISE EXCEPTION 'WEB_PREMIUM_NO_SUBSCRIPTION'; END IF;
  RETURN public.web_premium_subscription_json(p_user);
END
$function$;

CREATE OR REPLACE FUNCTION public.web_premium_set_default_card_v1(p_user uuid, p_card uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  PERFORM 1 FROM public.epoint_saved_cards WHERE id = p_card AND user_id = p_user AND status = 'active' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'WEB_PREMIUM_CARD_NOT_FOUND'; END IF;
  UPDATE public.epoint_saved_cards SET is_default = false, updated_at = now() WHERE user_id = p_user AND is_default AND id <> p_card;
  UPDATE public.epoint_saved_cards SET is_default = true, updated_at = now() WHERE id = p_card;
  UPDATE public.web_premium_subscriptions SET card_ref = p_card, updated_at = now()
   WHERE user_id = p_user AND status IN ('active', 'past_due', 'cancelled');
  RETURN public.web_premium_cards_json(p_user);
END
$function$;

-- Removing the only card of a renewing subscription is refused: add another card or cancel first.
CREATE OR REPLACE FUNCTION public.web_premium_remove_card_v1(p_user uuid, p_card uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  c public.epoint_saved_cards%ROWTYPE;
  other uuid;
BEGIN
  SELECT * INTO c FROM public.epoint_saved_cards WHERE id = p_card AND user_id = p_user AND status IN ('active', 'pending') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'WEB_PREMIUM_CARD_NOT_FOUND'; END IF;
  SELECT id INTO other FROM public.epoint_saved_cards
   WHERE user_id = p_user AND status = 'active' AND id <> c.id ORDER BY is_default DESC, created_at DESC LIMIT 1;
  IF other IS NULL AND c.status = 'active' AND EXISTS (SELECT 1 FROM public.web_premium_subscriptions
       WHERE user_id = p_user AND status IN ('active', 'past_due') AND NOT cancel_at_period_end) THEN
    RAISE EXCEPTION 'WEB_PREMIUM_CARD_NEEDED';
  END IF;
  UPDATE public.epoint_saved_cards SET status = 'removed', is_default = false, updated_at = now() WHERE id = c.id;
  IF c.is_default AND other IS NOT NULL THEN
    UPDATE public.epoint_saved_cards SET is_default = true, updated_at = now() WHERE id = other;
  END IF;
  UPDATE public.web_premium_subscriptions SET card_ref = other, updated_at = now()
   WHERE user_id = p_user AND card_ref = c.id AND status IN ('active', 'past_due', 'cancelled');
  RETURN public.web_premium_cards_json(p_user);
END
$function$;

-- ── Grants ──────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'web_premium_campaign_v1()', 'web_premium_subscription_json(uuid)', 'web_premium_cards_json(uuid)',
    'web_premium_charges_json(uuid,integer)', 'web_premium_account_v1(uuid)', 'web_premium_subscribe_start_v1(uuid,text)',
    'web_premium_card_pending_v1(uuid,text,text,uuid)', 'web_premium_card_result_v1(text,boolean,text,text,text)',
    'web_premium_charge_for_card_v1(text)', 'qc_earn_web_premium_charge_v1(uuid)',
    'web_premium_charge_paid_v1(uuid,numeric,text,text,text)', 'web_premium_charge_failed_v1(uuid,text)',
    'web_premium_renewals_due_v1(integer)', 'web_premium_renewal_claim_v1(uuid)', 'web_premium_housekeeping_v1()',
    'web_premium_cancel_v1(uuid)', 'web_premium_resume_v1(uuid)', 'web_premium_change_plan_v1(uuid,text)',
    'web_premium_set_default_card_v1(uuid,uuid)', 'web_premium_remove_card_v1(uuid,uuid)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', f);
  END LOOP;
  FOREACH f IN ARRAY ARRAY['web_premium_my_subscription_v1()', 'web_premium_my_cards_v1()', 'web_premium_my_charges_v1(integer)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', f);
  END LOOP;
END $$;

-- ── Ownership, CDC and writer-guard enrollment of the new relations ─────────────────────
DO $$
DECLARE t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pgadmin') THEN
    FOREACH t IN ARRAY ARRAY['epoint_saved_cards', 'web_premium_subscriptions', 'web_premium_charges'] LOOP
      EXECUTE format('ALTER TABLE public.%I OWNER TO pgadmin', t);
    END LOOP;
  END IF;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['epoint_saved_cards', 'web_premium_subscriptions', 'web_premium_charges'] LOOP
    INSERT INTO _anacan_gcp_migration.guarded_relations (schema_name, table_name, primary_key)
    VALUES ('public', t, ARRAY['id'])
    ON CONFLICT DO NOTHING;
    EXECUTE format('DROP TRIGGER IF EXISTS anacan_gcp_writer_guard ON public.%I', t);
    EXECUTE format('DROP TRIGGER IF EXISTS anacan_gcp_change ON public.%I', t);
    EXECUTE format('DROP TRIGGER IF EXISTS anacan_gcp_truncate ON public.%I', t);
    EXECUTE format('CREATE TRIGGER anacan_gcp_writer_guard BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION _anacan_gcp_migration.guard_write()', t);
    EXECUTE format('CREATE TRIGGER anacan_gcp_change AFTER INSERT OR DELETE OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION _anacan_gcp_migration.capture_change()', t);
    EXECUTE format('CREATE TRIGGER anacan_gcp_truncate AFTER TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION _anacan_gcp_migration.capture_change()', t);
  END LOOP;
  IF (SELECT count(*) FROM _anacan_gcp_migration.guarded_relations WHERE schema_name = 'public'
        AND table_name IN ('epoint_saved_cards', 'web_premium_subscriptions', 'web_premium_charges')) <> 3
     OR (SELECT count(*) FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relname IN ('epoint_saved_cards', 'web_premium_subscriptions', 'web_premium_charges')
            AND tg.tgname IN ('anacan_gcp_writer_guard', 'anacan_gcp_change', 'anacan_gcp_truncate')) <> 9 THEN
    RAISE EXCEPTION 'WEB_PREMIUM_SUBSCRIPTIONS_GUARD_ENROLLMENT_INCOMPLETE';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
