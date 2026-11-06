-- QayğıCash (2026-11-06, owner approved): Anacan's own cashback programme.
--
-- Users earn a bonus (0.5–5 %, own products only; partner products 0 %) on Premium (App Store / Google Play /
-- anacan.az), PDF books, cakes and Anacan-brand Aptek products, and spend it on later Aptek / cake / book
-- orders (up to max_redeem_pct of the order). Spending it on Premium exists but is off by default
-- (premium_redeem, per plan, price and platform; granted through a RevenueCat promotional entitlement by the
-- qaygicash-premium function). The programme is per country (cashback_programs); only AZ / AZN exists.
--
-- Money is integer qəpik (bigint *_minor). Earned bonus is a lot (cashback_lots) that becomes available after the
-- hold period (14 days physical, 7 digital) and expires expiry_months later; time decides the state, so no timer
-- or cron is added. Spending reserves lots FIFO by expiry (cashback_redemptions), commits when the order is
-- paid/delivered and is released when it fails or is cancelled. A reversed earning that was already spent is
-- taken from other lots, then kept as debt and settled from the next earnings. cashback_ledger is append-only.
--
-- Earning and spending follow the existing order state, inside the database (status triggers):
--   orders (store aptek)  delivered → commit + earn on cashback_own products; cancelled → release + reverse
--   cake_orders (app)     delivered → commit + earn;                           cancelled → release + reverse
--   book_orders           paid → commit + earn; failed/cancelled → release;    refunded → release + reverse
--   web_subscriptions     epoint pass linked to a user → earn (premium_yearly / premium_monthly)
-- App Store / Google Play earnings come from the revenuecat-webhook function (qc_earn_store_v1).
--
-- Applied by /home/anacan-runner/run-sql.py (psql as supabase_admin, ON_ERROR_STOP, one transaction).
-- New relations are enrolled for CDC / writer guard; changed relations must already be guarded.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '180s';

DO $$
BEGIN
  IF to_regclass('_anacan_gcp_migration.guarded_relations') IS NULL THEN RAISE EXCEPTION 'QC_GUARD_CATALOG_MISSING'; END IF;
  IF (SELECT count(*) FROM _anacan_gcp_migration.guarded_relations WHERE schema_name = 'public'
       AND table_name IN ('orders', 'cake_orders', 'book_orders', 'products', 'web_subscriptions', 'web_premium_orders')) <> 6 THEN
    RAISE EXCEPTION 'QC_CHANGED_RELATIONS_NOT_GUARDED';
  END IF;
END $$;

-- ── Changed relations ──────────────────────────────────────────────────────────────────
ALTER TABLE public.orders      ADD COLUMN IF NOT EXISTS cashback_used numeric(10,2) NOT NULL DEFAULT 0 CHECK (cashback_used >= 0);
ALTER TABLE public.cake_orders ADD COLUMN IF NOT EXISTS cashback_used numeric(10,2) NOT NULL DEFAULT 0 CHECK (cashback_used >= 0);
ALTER TABLE public.book_orders ADD COLUMN IF NOT EXISTS cashback_used numeric(10,2) NOT NULL DEFAULT 0 CHECK (cashback_used >= 0);
-- Anacan-brand products earn the own_shop rate; everything else is a partner product (0 %).
ALTER TABLE public.products    ADD COLUMN IF NOT EXISTS cashback_own boolean NOT NULL DEFAULT false;
GRANT SELECT (cashback_used) ON public.book_orders TO authenticated;

-- ── New relations ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cashback_programs (
  country text PRIMARY KEY CHECK (country ~ '^[A-Z]{2}$'),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'live', 'paused')),
  hold_days_physical int NOT NULL DEFAULT 14 CHECK (hold_days_physical BETWEEN 0 AND 60),
  hold_days_digital int NOT NULL DEFAULT 7 CHECK (hold_days_digital BETWEEN 0 AND 60),
  expiry_months int NOT NULL DEFAULT 12 CHECK (expiry_months BETWEEN 1 AND 36),
  max_redeem_pct int NOT NULL DEFAULT 30 CHECK (max_redeem_pct BETWEEN 1 AND 100),
  min_redeem_minor int NOT NULL DEFAULT 100 CHECK (min_redeem_minor BETWEEN 1 AND 100000),
  monthly_earn_cap_minor int NOT NULL DEFAULT 10000 CHECK (monthly_earn_cap_minor BETWEEN 0 AND 10000000),
  control_pct int NOT NULL DEFAULT 0 CHECK (control_pct BETWEEN 0 AND 50),
  redeem_channels text[] NOT NULL DEFAULT ARRAY['aptek', 'cake', 'book']
    CHECK (redeem_channels <@ ARRAY['aptek', 'cake', 'book']),
  premium_redeem jsonb NOT NULL DEFAULT '{"enabled": false, "monthly": {"enabled": false, "price_minor": 399},
    "yearly": {"enabled": false, "price_minor": 2699}, "platforms": {"ios": false, "android": false, "web": false}}'::jsonb
    CHECK (jsonb_typeof(premium_redeem) = 'object'),
  terms_version int NOT NULL DEFAULT 1 CHECK (terms_version >= 1),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

CREATE TABLE IF NOT EXISTS public.cashback_rules (
  country text NOT NULL REFERENCES public.cashback_programs (country),
  channel text NOT NULL CHECK (channel IN ('premium_yearly', 'premium_monthly', 'book', 'cake', 'own_shop', 'partner', 'affiliate')),
  rate_bp int NOT NULL CHECK (rate_bp = 0 OR rate_bp BETWEEN 50 AND 500),
  own_product boolean NOT NULL,
  -- App Store / Google Play Premium earns on this fixed local base, not on the storefront price.
  fixed_base_minor bigint CHECK (fixed_base_minor IS NULL OR fixed_base_minor > 0),
  version int NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  PRIMARY KEY (country, channel),
  CHECK (own_product OR rate_bp = 0)
);

CREATE TABLE IF NOT EXISTS public.cashback_wallets (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  country text NOT NULL REFERENCES public.cashback_programs (country),
  currency text NOT NULL,
  debt_minor bigint NOT NULL DEFAULT 0 CHECK (debt_minor >= 0),
  cohort text NOT NULL DEFAULT 'member' CHECK (cohort IN ('member', 'control')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cashback_lots (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  country text NOT NULL,
  channel text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('aptek_order', 'cake_order', 'book_order', 'web_premium', 'store', 'adjust')),
  source_id text NOT NULL CHECK (length(source_id) BETWEEN 1 AND 160),
  rate_bp int NOT NULL,
  base_minor bigint NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  remaining_minor bigint NOT NULL CHECK (remaining_minor >= 0 AND remaining_minor <= amount_minor),
  available_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  state text NOT NULL DEFAULT 'ok' CHECK (state IN ('ok', 'reversed')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_type, source_id)
);
CREATE INDEX IF NOT EXISTS cashback_lots_user_idx ON public.cashback_lots (user_id, expires_at);

CREATE TABLE IF NOT EXISTS public.cashback_redemptions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  order_type text NOT NULL CHECK (order_type IN ('aptek', 'cake', 'book', 'premium')),
  order_id text NOT NULL CHECK (length(order_id) BETWEEN 1 AND 80),
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'committed', 'released')),
  allocations jsonb NOT NULL DEFAULT '[]'::jsonb,
  reserved_until timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_type, order_id)
);
CREATE INDEX IF NOT EXISTS cashback_redemptions_user_idx ON public.cashback_redemptions (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.cashback_ledger (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('earn', 'redeem', 'release', 'reverse', 'adjust', 'cap', 'debt')),
  amount_minor bigint NOT NULL,
  lot_id bigint,
  redemption_id bigint,
  idempotency_key text NOT NULL UNIQUE,
  actor text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cashback_ledger_user_idx ON public.cashback_ledger (user_id, id DESC);

CREATE TABLE IF NOT EXISTS public.cashback_admin_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  admin_id uuid,
  action text NOT NULL,
  target text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['cashback_programs', 'cashback_rules', 'cashback_wallets', 'cashback_lots',
                           'cashback_redemptions', 'cashback_ledger', 'cashback_admin_log'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.qc_ledger_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'QC_LEDGER_APPEND_ONLY'; END $$;
DROP TRIGGER IF EXISTS qc_ledger_append_only ON public.cashback_ledger;
CREATE TRIGGER qc_ledger_append_only BEFORE UPDATE OR DELETE ON public.cashback_ledger
  FOR EACH ROW EXECUTE FUNCTION public.qc_ledger_append_only();

-- ── Seed: Azerbaijan (owner approved 2026-11-06) ────────────────────────────────────────
INSERT INTO public.cashback_programs (country, currency, status) VALUES ('AZ', 'AZN', 'live') ON CONFLICT (country) DO NOTHING;
INSERT INTO public.cashback_rules (country, channel, rate_bp, own_product, fixed_base_minor) VALUES
  ('AZ', 'premium_yearly', 500, true, 2699),
  ('AZ', 'premium_monthly', 300, true, 399),
  ('AZ', 'book', 500, true, NULL),
  ('AZ', 'cake', 300, true, NULL),
  ('AZ', 'own_shop', 500, true, NULL),
  ('AZ', 'partner', 0, false, NULL),
  ('AZ', 'affiliate', 0, false, NULL)
ON CONFLICT (country, channel) DO NOTHING;

-- ── Internal helpers (service role / definer only) ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qc_to_minor(p numeric) RETURNS bigint LANGUAGE sql IMMUTABLE AS $$
  SELECT round(coalesce(p, 0) * 100)::bigint $$;

-- Wallet row, created on first use in the given country, locked for the caller's transaction.
CREATE OR REPLACE FUNCTION public.qc_wallet_lock(p_user uuid, p_country text)
RETURNS public.cashback_wallets LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE w public.cashback_wallets; p public.cashback_programs;
BEGIN
  SELECT * INTO w FROM public.cashback_wallets WHERE user_id = p_user FOR UPDATE;
  IF FOUND OR p_country IS NULL THEN RETURN w; END IF;
  SELECT * INTO p FROM public.cashback_programs WHERE country = p_country;
  IF NOT FOUND THEN RETURN NULL; END IF;
  INSERT INTO public.cashback_wallets (user_id, country, currency, cohort)
  VALUES (p_user, p.country, p.currency,
          CASE WHEN p.control_pct > 0 AND abs(hashtext(p_user::text)) % 100 < p.control_pct THEN 'control' ELSE 'member' END)
  ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO w FROM public.cashback_wallets WHERE user_id = p_user FOR UPDATE;
  RETURN w;
END $$;

CREATE OR REPLACE FUNCTION public.qc_available_minor(p_user uuid) RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT coalesce(sum(remaining_minor), 0)::bigint FROM public.cashback_lots
   WHERE user_id = p_user AND state = 'ok' AND available_at <= now() AND expires_at > now() $$;

-- Takes up to p_amount from the user's lots, soonest expiry first. Available lots only, or pending ones too
-- (used to settle a reversed, already spent bonus). Returns [{lot, amount}].
CREATE OR REPLACE FUNCTION public.qc_take(p_user uuid, p_amount bigint, p_include_pending boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE r record; left_ bigint := p_amount; t bigint; alloc jsonb := '[]'::jsonb;
BEGIN
  FOR r IN SELECT id, remaining_minor FROM public.cashback_lots
            WHERE user_id = p_user AND state = 'ok' AND remaining_minor > 0 AND expires_at > now()
              AND (p_include_pending OR available_at <= now())
            ORDER BY (available_at > now()), expires_at, id FOR UPDATE LOOP
    EXIT WHEN left_ <= 0;
    t := least(r.remaining_minor, left_);
    UPDATE public.cashback_lots SET remaining_minor = remaining_minor - t WHERE id = r.id;
    alloc := alloc || jsonb_build_object('lot', r.id, 'amount', t);
    left_ := left_ - t;
  END LOOP;
  RETURN alloc;
END $$;

CREATE OR REPLACE FUNCTION public.qc_alloc_total(a jsonb) RETURNS bigint LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(sum((e->>'amount')::bigint), 0)::bigint FROM jsonb_array_elements(coalesce(a, '[]'::jsonb)) e $$;

-- Earn: idempotent per (source_type, source_id). Returns the lot id, or NULL when nothing is earned.
CREATE OR REPLACE FUNCTION public.qc_earn(p_user uuid, p_country text, p_channel text, p_source_type text,
  p_source_id text, p_base_minor bigint, p_digital boolean, p_actor text, p_note text DEFAULT NULL)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  prog public.cashback_programs; rul public.cashback_rules; w public.cashback_wallets;
  v_base bigint; v_amt bigint; v_month bigint; v_take bigint; v_lot bigint; v_avail timestamptz;
BEGIN
  IF p_user IS NULL OR coalesce(p_base_minor, 0) <= 0 THEN RETURN NULL; END IF;
  SELECT id INTO v_lot FROM public.cashback_lots WHERE source_type = p_source_type AND source_id = p_source_id;
  IF FOUND THEN RETURN v_lot; END IF;
  SELECT * INTO prog FROM public.cashback_programs WHERE country = p_country AND status IN ('live', 'paused');
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO rul FROM public.cashback_rules WHERE country = p_country AND channel = p_channel;
  IF NOT FOUND OR rul.rate_bp = 0 OR NOT rul.own_product THEN RETURN NULL; END IF;
  w := public.qc_wallet_lock(p_user, p_country);
  IF w.user_id IS NULL OR w.country <> p_country OR w.cohort = 'control' THEN RETURN NULL; END IF;

  v_base := CASE WHEN p_source_type = 'store' AND rul.fixed_base_minor IS NOT NULL THEN rul.fixed_base_minor ELSE p_base_minor END;
  v_amt := (v_base * rul.rate_bp) / 10000;  -- floor: never more than the rate
  SELECT coalesce(sum(amount_minor), 0) INTO v_month FROM public.cashback_lots
   WHERE user_id = p_user AND state = 'ok' AND source_type <> 'adjust'
     AND created_at >= (date_trunc('month', now() AT TIME ZONE 'Asia/Baku') AT TIME ZONE 'Asia/Baku');
  IF v_amt > prog.monthly_earn_cap_minor - v_month THEN
    INSERT INTO public.cashback_ledger (user_id, kind, amount_minor, idempotency_key, actor, note)
    VALUES (p_user, 'cap', greatest(prog.monthly_earn_cap_minor - v_month, 0) - v_amt,
            'cap:' || p_source_type || ':' || p_source_id, p_actor, 'monthly cap') ON CONFLICT DO NOTHING;
    v_amt := greatest(prog.monthly_earn_cap_minor - v_month, 0);
  END IF;
  IF v_amt <= 0 THEN RETURN NULL; END IF;

  v_take := least(w.debt_minor, v_amt);
  v_avail := now() + make_interval(days => CASE WHEN p_digital THEN prog.hold_days_digital ELSE prog.hold_days_physical END);
  INSERT INTO public.cashback_lots (user_id, country, channel, source_type, source_id, rate_bp, base_minor, amount_minor,
                                    remaining_minor, available_at, expires_at, note)
  VALUES (p_user, p_country, p_channel, p_source_type, p_source_id, rul.rate_bp, v_base, v_amt, v_amt - v_take,
          v_avail, v_avail + make_interval(months => prog.expiry_months), p_note)
  ON CONFLICT (source_type, source_id) DO NOTHING
  RETURNING id INTO v_lot;
  IF v_lot IS NULL THEN RETURN NULL; END IF;
  INSERT INTO public.cashback_ledger (user_id, kind, amount_minor, lot_id, idempotency_key, actor, note)
  VALUES (p_user, 'earn', v_amt, v_lot, 'earn:' || p_source_type || ':' || p_source_id, p_actor, p_channel);
  IF v_take > 0 THEN
    UPDATE public.cashback_wallets SET debt_minor = debt_minor - v_take WHERE user_id = p_user;
    INSERT INTO public.cashback_ledger (user_id, kind, amount_minor, lot_id, idempotency_key, actor, note)
    VALUES (p_user, 'debt', -v_take, v_lot, 'debt:' || p_source_type || ':' || p_source_id, p_actor, 'debt settled from new bonus');
  END IF;
  RETURN v_lot;
END $$;

-- Reverse an earning (refund / cancellation). The spent part is taken from other lots, the rest becomes debt.
CREATE OR REPLACE FUNCTION public.qc_reverse(p_source_type text, p_source_id text, p_actor text, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE l public.cashback_lots; v_used bigint; v_taken bigint;
BEGIN
  SELECT * INTO l FROM public.cashback_lots WHERE source_type = p_source_type AND source_id = p_source_id FOR UPDATE;
  IF NOT FOUND OR l.state = 'reversed' THEN RETURN; END IF;
  PERFORM public.qc_wallet_lock(l.user_id, NULL);
  v_used := l.amount_minor - l.remaining_minor;
  UPDATE public.cashback_lots SET state = 'reversed', remaining_minor = 0 WHERE id = l.id;
  INSERT INTO public.cashback_ledger (user_id, kind, amount_minor, lot_id, idempotency_key, actor, note)
  VALUES (l.user_id, 'reverse', -l.amount_minor, l.id, 'reverse:' || l.id, p_actor, p_note);
  IF v_used > 0 THEN
    v_taken := public.qc_alloc_total(public.qc_take(l.user_id, v_used, true));
    IF v_used - v_taken > 0 THEN
      UPDATE public.cashback_wallets SET debt_minor = debt_minor + (v_used - v_taken) WHERE user_id = l.user_id;
    END IF;
    INSERT INTO public.cashback_ledger (user_id, kind, amount_minor, lot_id, idempotency_key, actor, note)
    VALUES (l.user_id, 'debt', v_used - v_taken, l.id, 'reverse-debt:' || l.id, p_actor,
            format('spent %s, taken from other bonus %s', v_used, v_taken));
  END IF;
END $$;

-- Reserve bonus for an order. Raises QC_* errors the apps translate.
CREATE OR REPLACE FUNCTION public.qc_reserve(p_user uuid, p_order_type text, p_order_id text, p_amount bigint,
  p_order_total bigint, p_hold_minutes int, p_skip_limits boolean, p_actor text)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE w public.cashback_wallets; prog public.cashback_programs; v_alloc jsonb; v_id bigint;
BEGIN
  IF coalesce(p_amount, 0) <= 0 THEN RETURN NULL; END IF;
  w := public.qc_wallet_lock(p_user, NULL);
  IF w.user_id IS NULL THEN RAISE EXCEPTION 'QC_INSUFFICIENT'; END IF;
  SELECT * INTO prog FROM public.cashback_programs WHERE country = w.country;
  IF prog.status <> 'live' THEN RAISE EXCEPTION 'QC_PAUSED'; END IF;
  IF w.cohort = 'control' THEN RAISE EXCEPTION 'QC_NOT_AVAILABLE'; END IF;
  IF NOT p_skip_limits THEN
    IF NOT (p_order_type = ANY (prog.redeem_channels)) THEN RAISE EXCEPTION 'QC_CHANNEL_CLOSED'; END IF;
    IF p_amount < prog.min_redeem_minor THEN RAISE EXCEPTION 'QC_BELOW_MIN'; END IF;
    IF p_amount > (coalesce(p_order_total, 0) * prog.max_redeem_pct) / 100 THEN RAISE EXCEPTION 'QC_ABOVE_MAX'; END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM public.cashback_redemptions WHERE order_type = p_order_type AND order_id = p_order_id) THEN
    RAISE EXCEPTION 'QC_ALREADY_APPLIED';
  END IF;
  IF public.qc_available_minor(p_user) < p_amount THEN RAISE EXCEPTION 'QC_INSUFFICIENT'; END IF;
  v_alloc := public.qc_take(p_user, p_amount, false);
  IF public.qc_alloc_total(v_alloc) <> p_amount THEN RAISE EXCEPTION 'QC_INSUFFICIENT'; END IF;
  INSERT INTO public.cashback_redemptions (user_id, order_type, order_id, amount_minor, allocations, reserved_until)
  VALUES (p_user, p_order_type, p_order_id, p_amount, v_alloc,
          CASE WHEN p_hold_minutes IS NULL THEN NULL ELSE now() + make_interval(mins => p_hold_minutes) END)
  RETURNING id INTO v_id;
  INSERT INTO public.cashback_ledger (user_id, kind, amount_minor, redemption_id, idempotency_key, actor, note)
  VALUES (p_user, 'redeem', -p_amount, v_id, 'redeem:' || v_id, p_actor, p_order_type || ':' || p_order_id);
  RETURN v_id;
END $$;

-- Give reserved (or committed, for a cancelled/refunded order) bonus back to its lots.
CREATE OR REPLACE FUNCTION public.qc_release(p_order_type text, p_order_id text, p_actor text, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE r public.cashback_redemptions; e jsonb; v_n int;
BEGIN
  SELECT * INTO r FROM public.cashback_redemptions WHERE order_type = p_order_type AND order_id = p_order_id FOR UPDATE;
  IF NOT FOUND OR r.status = 'released' THEN RETURN; END IF;
  PERFORM public.qc_wallet_lock(r.user_id, NULL);
  FOR e IN SELECT * FROM jsonb_array_elements(r.allocations) LOOP
    UPDATE public.cashback_lots SET remaining_minor = remaining_minor + (e->>'amount')::bigint
     WHERE id = (e->>'lot')::bigint AND state = 'ok';
  END LOOP;
  UPDATE public.cashback_redemptions SET status = 'released', updated_at = now(), note = coalesce(p_note, note) WHERE id = r.id;
  SELECT count(*) INTO v_n FROM public.cashback_ledger WHERE redemption_id = r.id AND kind = 'release';
  INSERT INTO public.cashback_ledger (user_id, kind, amount_minor, redemption_id, idempotency_key, actor, note)
  VALUES (r.user_id, 'release', r.amount_minor, r.id, 'release:' || r.id || ':' || v_n, p_actor, p_note);
END $$;

-- Commit a reservation when the order is paid / delivered. A reservation released earlier (stale card checkout
-- that was paid after all) is taken again; whatever is no longer there becomes debt.
CREATE OR REPLACE FUNCTION public.qc_commit(p_order_type text, p_order_id text, p_actor text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE r public.cashback_redemptions; v_alloc jsonb; v_taken bigint; v_n int;
BEGIN
  SELECT * INTO r FROM public.cashback_redemptions WHERE order_type = p_order_type AND order_id = p_order_id FOR UPDATE;
  IF NOT FOUND OR r.status = 'committed' THEN RETURN; END IF;
  IF r.status = 'released' THEN
    PERFORM public.qc_wallet_lock(r.user_id, NULL);
    v_alloc := public.qc_take(r.user_id, r.amount_minor, true);
    v_taken := public.qc_alloc_total(v_alloc);
    IF r.amount_minor - v_taken > 0 THEN
      UPDATE public.cashback_wallets SET debt_minor = debt_minor + (r.amount_minor - v_taken) WHERE user_id = r.user_id;
    END IF;
    SELECT count(*) INTO v_n FROM public.cashback_ledger WHERE redemption_id = r.id AND kind = 'redeem';
    INSERT INTO public.cashback_ledger (user_id, kind, amount_minor, redemption_id, idempotency_key, actor, note)
    VALUES (r.user_id, 'redeem', -r.amount_minor, r.id, 'redeem:' || r.id || ':' || v_n, p_actor, 'paid after release');
    UPDATE public.cashback_redemptions SET allocations = v_alloc WHERE id = r.id;
  END IF;
  UPDATE public.cashback_redemptions SET status = 'committed', reserved_until = NULL, updated_at = now() WHERE id = r.id;
END $$;

-- Card checkouts that never came back release their reservation after reserved_until.
CREATE OR REPLACE FUNCTION public.qc_release_stale(p_user uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE r record;
BEGIN
  FOR r IN SELECT order_type, order_id FROM public.cashback_redemptions
            WHERE user_id = p_user AND status = 'reserved' AND reserved_until IS NOT NULL AND reserved_until < now() LOOP
    PERFORM public.qc_release(r.order_type, r.order_id, 'system:stale', 'checkout not completed');
  END LOOP;
END $$;

-- ── Order status triggers (never block the order flow) ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.qc_orders_status() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_own numeric; v_factor numeric; v_base bigint;
BEGIN
  BEGIN
    IF NEW.status = 'delivered' THEN
      PERFORM public.qc_commit('aptek', NEW.id::text, 'trigger:orders');
      SELECT coalesce(sum(oi.total_price), 0) INTO v_own FROM public.order_items oi
        JOIN public.products p ON p.id = oi.product_id WHERE oi.order_id = NEW.id AND p.cashback_own;
      IF v_own > 0 AND coalesce(NEW.subtotal, 0) > 0 THEN
        v_factor := greatest(NEW.subtotal - coalesce(NEW.discount_amount, 0) - coalesce(NEW.cashback_used, 0), 0);
        v_base := floor(v_own * v_factor * 100 / NEW.subtotal)::bigint;  -- own lines' share of what was paid
        PERFORM public.qc_earn(NEW.user_id, 'AZ', 'own_shop', 'aptek_order', NEW.id::text, v_base, false, 'trigger:orders');
      END IF;
    ELSIF NEW.status = 'cancelled' THEN
      PERFORM public.qc_release('aptek', NEW.id::text, 'trigger:orders', 'order cancelled');
      PERFORM public.qc_reverse('aptek_order', NEW.id::text, 'trigger:orders', 'order cancelled');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'qaygicash orders trigger skipped: %', SQLERRM;
  END;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS qc_orders_status ON public.orders;
CREATE TRIGGER qc_orders_status AFTER UPDATE OF status ON public.orders FOR EACH ROW
  WHEN (NEW.store = 'aptek' AND NEW.user_id IS NOT NULL AND NEW.status IS DISTINCT FROM OLD.status)
  EXECUTE FUNCTION public.qc_orders_status();

CREATE OR REPLACE FUNCTION public.qc_cake_status() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  BEGIN
    IF NEW.status = 'delivered' THEN
      PERFORM public.qc_commit('cake', NEW.id::text, 'trigger:cake_orders');
      PERFORM public.qc_earn(NEW.user_id, 'AZ', 'cake', 'cake_order', NEW.id::text, public.qc_to_minor(NEW.total_price), false, 'trigger:cake_orders');
    ELSIF NEW.status = 'cancelled' THEN
      PERFORM public.qc_release('cake', NEW.id::text, 'trigger:cake_orders', 'order cancelled');
      PERFORM public.qc_reverse('cake_order', NEW.id::text, 'trigger:cake_orders', 'order cancelled');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'qaygicash cake trigger skipped: %', SQLERRM;
  END;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS qc_cake_status ON public.cake_orders;
CREATE TRIGGER qc_cake_status AFTER UPDATE OF status ON public.cake_orders FOR EACH ROW
  WHEN (NEW.user_id IS NOT NULL AND NEW.channel = 'app' AND NEW.status IS DISTINCT FROM OLD.status)
  EXECUTE FUNCTION public.qc_cake_status();

CREATE OR REPLACE FUNCTION public.qc_book_status() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  BEGIN
    IF NEW.status = 'paid' THEN
      PERFORM public.qc_commit('book', NEW.id::text, 'trigger:book_orders');
      PERFORM public.qc_earn(NEW.user_id, 'AZ', 'book', 'book_order', NEW.id::text, public.qc_to_minor(NEW.amount), true, 'trigger:book_orders');
    ELSIF NEW.status IN ('failed', 'cancelled') THEN
      PERFORM public.qc_release('book', NEW.id::text, 'trigger:book_orders', 'payment not completed');
    ELSIF NEW.status = 'refunded' THEN
      PERFORM public.qc_release('book', NEW.id::text, 'trigger:book_orders', 'order refunded');
      PERFORM public.qc_reverse('book_order', NEW.id::text, 'trigger:book_orders', 'order refunded');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'qaygicash book trigger skipped: %', SQLERRM;
  END;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS qc_book_status ON public.book_orders;
CREATE TRIGGER qc_book_status AFTER UPDATE OF status ON public.book_orders FOR EACH ROW
  WHEN (NEW.user_id IS NOT NULL AND NEW.status IS DISTINCT FROM OLD.status)
  EXECUTE FUNCTION public.qc_book_status();

-- anacan.az Premium passes (Epoint) earn once the pass is linked to an account.
CREATE OR REPLACE FUNCTION public.qc_web_premium() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_amount numeric;
BEGIN
  BEGIN
    SELECT amount INTO v_amount FROM public.web_premium_orders
     WHERE 'epoint_' || id::text = NEW.provider_subscription_id AND status = 'paid';
    IF v_amount IS NOT NULL THEN
      PERFORM public.qc_earn(NEW.user_id, 'AZ', CASE WHEN NEW.plan = 'yearly' THEN 'premium_yearly' ELSE 'premium_monthly' END,
                             'web_premium', NEW.provider_subscription_id, public.qc_to_minor(v_amount), true, 'trigger:web_subscriptions');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'qaygicash web premium trigger skipped: %', SQLERRM;
  END;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS qc_web_premium ON public.web_subscriptions;
CREATE TRIGGER qc_web_premium AFTER INSERT OR UPDATE OF user_id ON public.web_subscriptions FOR EACH ROW
  WHEN (NEW.provider = 'epoint' AND NEW.user_id IS NOT NULL)
  EXECUTE FUNCTION public.qc_web_premium();

-- ── Service-role entry points (edge functions) ─────────────────────────────────────────
-- App Store / Google Play purchase or renewal (revenuecat-webhook). Country = storefront country.
CREATE OR REPLACE FUNCTION public.qc_earn_store_v1(p_user uuid, p_transaction text, p_plan text, p_country text)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF p_plan NOT IN ('yearly', 'monthly') OR p_transaction IS NULL OR length(p_transaction) > 150 THEN RETURN NULL; END IF;
  RETURN public.qc_earn(p_user, upper(coalesce(p_country, '')), 'premium_' || p_plan, 'store', p_transaction,
                        1, true, 'system:revenuecat');  -- base comes from the rule's fixed_base_minor
END $$;

CREATE OR REPLACE FUNCTION public.qc_reverse_store_v1(p_transaction text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT public.qc_reverse('store', p_transaction, 'system:revenuecat', 'store refund') $$;

-- Book checkout (book-checkout function): reserve before the Epoint request, the book trigger commits/releases.
CREATE OR REPLACE FUNCTION public.qc_reserve_book_v1(p_user uuid, p_order_id uuid, p_amount_minor bigint, p_total_minor bigint)
RETURNS bigint LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT public.qc_reserve(p_user, 'book', p_order_id::text, p_amount_minor, p_total_minor, 40, false, 'app:book-checkout') $$;

CREATE OR REPLACE FUNCTION public.qc_release_book_v1(p_order_id uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT public.qc_release('book', p_order_id::text, 'app:book-checkout', 'checkout failed') $$;

-- Premium bought with QayğıCash (qaygicash-premium function). Off unless premium_redeem enables the plan and
-- the platform. The function grants the RevenueCat promotional entitlement and then commits, or releases.
CREATE OR REPLACE FUNCTION public.qc_premium_reserve_v1(p_user uuid, p_plan text, p_platform text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE w public.cashback_wallets; prog public.cashback_programs; cfg jsonb; v_price bigint; v_order text; v_id bigint;
BEGIN
  IF p_plan NOT IN ('monthly', 'yearly') OR p_platform NOT IN ('ios', 'android', 'web') THEN RAISE EXCEPTION 'QC_BAD_REQUEST'; END IF;
  SELECT * INTO w FROM public.cashback_wallets WHERE user_id = p_user;
  IF NOT FOUND THEN RAISE EXCEPTION 'QC_INSUFFICIENT'; END IF;
  SELECT * INTO prog FROM public.cashback_programs WHERE country = w.country;
  cfg := prog.premium_redeem;
  IF prog.status <> 'live' OR coalesce((cfg->>'enabled')::boolean, false) IS NOT TRUE
     OR coalesce((cfg->p_plan->>'enabled')::boolean, false) IS NOT TRUE
     OR coalesce((cfg->'platforms'->>p_platform)::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'QC_PREMIUM_CLOSED';
  END IF;
  v_price := (cfg->p_plan->>'price_minor')::bigint;
  IF v_price IS NULL OR v_price <= 0 THEN RAISE EXCEPTION 'QC_PREMIUM_CLOSED'; END IF;
  IF EXISTS (SELECT 1 FROM public.cashback_redemptions WHERE user_id = p_user AND order_type = 'premium'
              AND status = 'reserved' AND reserved_until > now()) THEN
    RAISE EXCEPTION 'QC_ALREADY_APPLIED';
  END IF;
  v_order := gen_random_uuid()::text;
  v_id := public.qc_reserve(p_user, 'premium', v_order, v_price, v_price, 15, true, 'app:qaygicash-premium');
  UPDATE public.cashback_redemptions SET note = p_plan || ':' || p_platform WHERE id = v_id;
  RETURN jsonb_build_object('order_id', v_order, 'price_minor', v_price, 'plan', p_plan);
END $$;

CREATE OR REPLACE FUNCTION public.qc_premium_finish_v1(p_order_id text, p_success boolean, p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF p_success THEN PERFORM public.qc_commit('premium', p_order_id, 'app:qaygicash-premium');
  ELSE PERFORM public.qc_release('premium', p_order_id, 'app:qaygicash-premium', left(coalesce(p_note, 'grant failed'), 200));
  END IF;
END $$;

-- ── App (signed-in) ─────────────────────────────────────────────────────────────────────
-- The programme for this person: wallet country, else profile country, else the request's geo country.
CREATE OR REPLACE FUNCTION public.qaygicash_wallet_v1() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_uid uuid := auth.uid(); w public.cashback_wallets; prog public.cashback_programs; v_country text;
  v_avail bigint; v_pend bigint; v_soon bigint; v_next timestamptz; v_rates jsonb; cfg jsonb;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('enabled', false); END IF;
  PERFORM public.qc_release_stale(v_uid);
  SELECT * INTO w FROM public.cashback_wallets WHERE user_id = v_uid;
  v_country := coalesce(w.country, (SELECT upper(country_code) FROM public.profiles WHERE user_id = v_uid),
                        (SELECT upper(public.request_geo_country())));
  SELECT * INTO prog FROM public.cashback_programs WHERE country = v_country AND status IN ('live', 'paused');
  IF NOT FOUND OR coalesce(w.cohort, 'member') = 'control' THEN RETURN jsonb_build_object('enabled', false); END IF;

  SELECT coalesce(sum(remaining_minor) FILTER (WHERE available_at <= now()), 0),
         coalesce(sum(remaining_minor) FILTER (WHERE available_at > now()), 0),
         coalesce(sum(remaining_minor) FILTER (WHERE available_at <= now() AND expires_at < now() + interval '30 days'), 0),
         min(expires_at) FILTER (WHERE available_at <= now() AND remaining_minor > 0)
    INTO v_avail, v_pend, v_soon, v_next
    FROM public.cashback_lots WHERE user_id = v_uid AND state = 'ok' AND expires_at > now();
  SELECT coalesce(jsonb_object_agg(channel, rate_bp), '{}'::jsonb) INTO v_rates FROM public.cashback_rules WHERE country = prog.country;
  cfg := prog.premium_redeem;
  RETURN jsonb_build_object(
    'enabled', true, 'status', prog.status, 'country', prog.country, 'currency', prog.currency,
    'available_minor', v_avail, 'pending_minor', v_pend, 'expiring_30d_minor', v_soon, 'next_expiry_at', v_next,
    'debt_minor', coalesce(w.debt_minor, 0), 'rates', v_rates,
    'hold_days_physical', prog.hold_days_physical, 'hold_days_digital', prog.hold_days_digital,
    'expiry_months', prog.expiry_months, 'max_redeem_pct', prog.max_redeem_pct, 'min_redeem_minor', prog.min_redeem_minor,
    'redeem_channels', to_jsonb(prog.redeem_channels), 'terms_version', prog.terms_version,
    'premium_redeem', jsonb_build_object(
      'enabled', prog.status = 'live' AND coalesce((cfg->>'enabled')::boolean, false),
      'monthly', jsonb_build_object('enabled', coalesce((cfg->'monthly'->>'enabled')::boolean, false), 'price_minor', (cfg->'monthly'->>'price_minor')::bigint),
      'yearly', jsonb_build_object('enabled', coalesce((cfg->'yearly'->>'enabled')::boolean, false), 'price_minor', (cfg->'yearly'->>'price_minor')::bigint),
      'platforms', coalesce(cfg->'platforms', '{}'::jsonb)));
END $$;

CREATE OR REPLACE FUNCTION public.qaygicash_history_v1(p_limit int DEFAULT 60) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT coalesce(jsonb_agg(x ORDER BY (x->>'at') DESC), '[]'::jsonb) FROM (
    SELECT x FROM (
      SELECT jsonb_build_object('id', 'l' || l.id, 'type', 'earn', 'channel', l.channel, 'source_type', l.source_type,
        'amount_minor', l.amount_minor, 'remaining_minor', l.remaining_minor, 'rate_bp', l.rate_bp,
        'status', CASE WHEN l.state = 'reversed' THEN 'reversed' WHEN l.expires_at <= now() THEN 'expired'
                       WHEN l.available_at > now() THEN 'pending' ELSE 'available' END,
        'at', l.created_at, 'available_at', l.available_at, 'expires_at', l.expires_at) AS x
        FROM public.cashback_lots l WHERE l.user_id = auth.uid()
      UNION ALL
      SELECT jsonb_build_object('id', 'r' || r.id, 'type', 'redeem', 'channel', r.order_type,
        'amount_minor', r.amount_minor, 'status', r.status, 'at', r.created_at)
        FROM public.cashback_redemptions r WHERE r.user_id = auth.uid()
    ) s ORDER BY (x->>'at') DESC LIMIT least(greatest(coalesce(p_limit, 60), 1), 200)
  ) t $$;

-- Apply bonus to the person's own app cake order right after placing it (cash / transfer on delivery).
CREATE OR REPLACE FUNCTION public.qaygicash_redeem_cake_v1(p_order_id uuid, p_amount numeric) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_uid uuid := auth.uid(); o public.cake_orders; v_amt bigint := public.qc_to_minor(p_amount);
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'QC_AUTH_REQUIRED' USING ERRCODE = '42501'; END IF;
  SELECT * INTO o FROM public.cake_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR o.user_id IS DISTINCT FROM v_uid OR o.channel <> 'app' OR o.status <> 'pending'
     OR coalesce(o.payment_status, 'pending') <> 'pending' OR o.cashback_used > 0 OR o.created_at < now() - interval '30 minutes' THEN
    RAISE EXCEPTION 'QC_ORDER_NOT_ELIGIBLE';
  END IF;
  PERFORM public.qc_reserve(v_uid, 'cake', o.id::text, v_amt, public.qc_to_minor(o.total_price), NULL, false, 'app:cake');
  UPDATE public.cake_orders SET cashback_used = round(v_amt / 100.0, 2), total_price = total_price - round(v_amt / 100.0, 2), updated_at = now()
   WHERE id = o.id;
  RETURN jsonb_build_object('order_id', o.id, 'cashback_used', round(v_amt / 100.0, 2), 'total_price', o.total_price - round(v_amt / 100.0, 2));
END $$;

-- ── Aptek order: optional QayğıCash (p_cashback, AZN). Old clients keep calling it without the argument. ──
DROP FUNCTION IF EXISTS public.place_aptek_order(jsonb, text, text, text, jsonb, text, text);
CREATE OR REPLACE FUNCTION public.place_aptek_order(
  p_items jsonb,
  p_coupon text,
  p_slot text,
  p_payment text,
  p_address jsonb,
  p_phone text,
  p_notes text DEFAULT NULL,
  p_cashback numeric DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_cfg jsonb;
  v_lines int;
  v_subtotal numeric(10,2) := 0;
  v_bundle_off numeric(10,2) := 0;
  v_coupon_off numeric(10,2) := 0;
  v_ship numeric(10,2) := 0;
  v_total numeric(10,2);
  v_bundle jsonb;
  v_pct numeric;
  v_coupon public.coupons%ROWTYPE;
  v_code text := nullif(upper(btrim(coalesce(p_coupon, ''))), '');
  v_order public.orders%ROWTYPE;
  v_cb bigint := public.qc_to_minor(greatest(coalesce(p_cashback, 0), 0));
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'APTEK_AUTH_REQUIRED' USING ERRCODE = '42501'; END IF;

  SELECT CASE WHEN jsonb_typeof(value) = 'string' THEN (value #>> '{}')::jsonb ELSE value END
    INTO v_cfg FROM public.app_settings WHERE key = 'aptek_config';
  IF v_cfg IS NULL OR coalesce((v_cfg->>'enabled')::boolean, false) IS NOT TRUE THEN
    IF NOT public.has_role(v_uid, 'admin') THEN RAISE EXCEPTION 'APTEK_DISABLED'; END IF;
  END IF;

  IF p_payment NOT IN ('cash', 'card_on_delivery') THEN RAISE EXCEPTION 'APTEK_BAD_PAYMENT'; END IF;
  IF p_slot IS NULL OR NOT (coalesce(v_cfg->'slots', '[]'::jsonb) ? p_slot) THEN RAISE EXCEPTION 'APTEK_BAD_SLOT'; END IF;
  IF p_phone IS NULL OR btrim(p_phone) !~ '^\+?[0-9][0-9 ()-]{6,19}$' THEN RAISE EXCEPTION 'APTEK_BAD_PHONE'; END IF;
  IF p_address IS NULL OR jsonb_typeof(p_address) <> 'object' OR char_length(btrim(coalesce(p_address->>'line', ''))) NOT BETWEEN 5 AND 300
     OR pg_column_size(p_address) > 2048 THEN
    RAISE EXCEPTION 'APTEK_BAD_ADDRESS';
  END IF;
  IF p_notes IS NOT NULL AND char_length(p_notes) > 500 THEN RAISE EXCEPTION 'APTEK_BAD_NOTES'; END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN RAISE EXCEPTION 'APTEK_BAD_ITEMS'; END IF;

  -- Lines are locked and priced from the catalogue; client prices are never read.
  CREATE TEMP TABLE IF NOT EXISTS _aptek_lines (product_id uuid PRIMARY KEY, sku text, name text, unit numeric(10,2), qty int) ON COMMIT DROP;
  TRUNCATE _aptek_lines;
  INSERT INTO _aptek_lines (product_id, sku, name, unit, qty)
  SELECT p.id, p.sku, p.name, p.price, i.qty
  FROM (SELECT (e->>'product_id')::uuid AS product_id, sum((e->>'quantity')::int) AS qty
        FROM jsonb_array_elements(p_items) e GROUP BY 1) i
  JOIN public.products p ON p.id = i.product_id AND p.store = 'aptek' AND p.is_active IS TRUE
  WHERE i.qty BETWEEN 1 AND 20;
  GET DIAGNOSTICS v_lines = ROW_COUNT;
  IF v_lines = 0 OR v_lines > 50
     OR v_lines <> (SELECT count(DISTINCT e->>'product_id') FROM jsonb_array_elements(p_items) e) THEN
    RAISE EXCEPTION 'APTEK_BAD_ITEMS';
  END IF;
  PERFORM 1 FROM public.products p JOIN _aptek_lines l ON l.product_id = p.id ORDER BY p.id FOR UPDATE OF p;
  IF EXISTS (SELECT 1 FROM public.products p JOIN _aptek_lines l ON l.product_id = p.id WHERE p.stock IS NOT NULL AND p.stock < l.qty) THEN
    RAISE EXCEPTION 'APTEK_OUT_OF_STOCK';
  END IF;

  SELECT coalesce(sum(unit * qty), 0) INTO v_subtotal FROM _aptek_lines;

  -- Each complete bundle in the cart takes bundle_discount_pct off one unit of each of its items.
  v_pct := least(greatest(coalesce((v_cfg->>'bundle_discount_pct')::numeric, 0), 0), 50);
  FOR v_bundle IN SELECT * FROM jsonb_array_elements(coalesce(v_cfg->'bundles', '[]'::jsonb)) LOOP
    IF jsonb_array_length(coalesce(v_bundle->'skus', '[]'::jsonb)) > 0
       AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(v_bundle->'skus') s(sku)
                       WHERE NOT EXISTS (SELECT 1 FROM _aptek_lines l WHERE l.sku = s.sku)) THEN
      v_bundle_off := v_bundle_off + round((SELECT sum(l.unit) FROM _aptek_lines l
        WHERE l.sku IN (SELECT jsonb_array_elements_text(v_bundle->'skus'))) * v_pct / 100, 2);
    END IF;
  END LOOP;

  IF v_code IS NOT NULL THEN
    SELECT * INTO v_coupon FROM public.coupons WHERE upper(code) = v_code FOR UPDATE;
    IF NOT FOUND OR v_coupon.is_active IS NOT TRUE
       OR NOT (v_coupon.applicable_to && ARRAY['aptek', 'all'])
       OR (v_coupon.starts_at IS NOT NULL AND v_coupon.starts_at > now())
       OR (v_coupon.expires_at IS NOT NULL AND v_coupon.expires_at < now())
       OR (v_coupon.max_uses IS NOT NULL AND coalesce(v_coupon.used_count, 0) >= v_coupon.max_uses)
       OR (v_coupon.min_order_amount IS NOT NULL AND v_subtotal < v_coupon.min_order_amount) THEN
      RAISE EXCEPTION 'APTEK_BAD_COUPON';
    END IF;
    v_coupon_off := CASE WHEN v_coupon.discount_type = 'percentage'
      THEN round((v_subtotal - v_bundle_off) * least(v_coupon.discount_value, 100) / 100, 2)
      ELSE least(v_coupon.discount_value, v_subtotal - v_bundle_off) END;
  END IF;

  v_ship := CASE WHEN v_subtotal - v_bundle_off - v_coupon_off >= coalesce((v_cfg->>'free_shipping_min')::numeric, 0)
                 THEN 0 ELSE coalesce((v_cfg->>'shipping_fee')::numeric, 0) END;
  v_total := greatest(v_subtotal - v_bundle_off - v_coupon_off, 0) + v_ship;

  INSERT INTO public.orders (user_id, order_number, status, total_amount, shipping_address, notes, store, delivery_slot,
                             payment_method, phone, subtotal, discount_amount, shipping_fee, coupon_code)
  VALUES (v_uid, '', 'pending', v_total, p_address, nullif(btrim(coalesce(p_notes, '')), ''), 'aptek', p_slot,
          p_payment, btrim(p_phone), v_subtotal, v_bundle_off + v_coupon_off, v_ship, v_coupon.code)
  RETURNING * INTO v_order;

  -- QayğıCash: up to max_redeem_pct of the goods after discounts (delivery excluded); the courier collects the rest.
  IF v_cb > 0 THEN
    PERFORM public.qc_reserve(v_uid, 'aptek', v_order.id::text, v_cb,
                              public.qc_to_minor(greatest(v_subtotal - v_bundle_off - v_coupon_off, 0)), NULL, false, 'app:aptek');
    v_total := v_total - round(v_cb / 100.0, 2);
    UPDATE public.orders SET total_amount = v_total, cashback_used = round(v_cb / 100.0, 2) WHERE id = v_order.id;
  END IF;

  INSERT INTO public.order_items (order_id, product_id, product_name, quantity, unit_price, total_price)
  SELECT v_order.id, l.product_id, l.name, l.qty, l.unit, l.unit * l.qty FROM _aptek_lines l;

  UPDATE public.products p SET stock = p.stock - l.qty, sales_count = p.sales_count + l.qty
  FROM _aptek_lines l WHERE p.id = l.product_id AND p.stock IS NOT NULL;
  IF v_coupon.id IS NOT NULL THEN
    UPDATE public.coupons SET used_count = coalesce(used_count, 0) + 1 WHERE id = v_coupon.id;
  END IF;
  DELETE FROM public.cart_items c USING _aptek_lines l WHERE c.user_id = v_uid AND c.product_id = l.product_id;

  RETURN jsonb_build_object('order_id', v_order.id, 'order_number', v_order.order_number, 'subtotal', v_subtotal,
    'discount', v_bundle_off + v_coupon_off, 'shipping', v_ship, 'cashback', round(v_cb / 100.0, 2), 'total', v_total);
END;
$$;
REVOKE ALL ON FUNCTION public.place_aptek_order(jsonb, text, text, text, jsonb, text, text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.place_aptek_order(jsonb, text, text, text, jsonb, text, text, numeric) TO authenticated;

-- ── Admin ───────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qc_require_admin() RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'QC_ADMIN_ONLY' USING ERRCODE = '42501'; END IF;
  RETURN auth.uid();
END $$;

CREATE OR REPLACE FUNCTION public.qaygicash_admin_overview_v1() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  PERFORM public.qc_require_admin();
  RETURN jsonb_build_object(
    'programs', (SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.country), '[]'::jsonb) FROM public.cashback_programs p),
    'rules', (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.country, r.channel), '[]'::jsonb) FROM public.cashback_rules r),
    'liability_available_minor', (SELECT coalesce(sum(remaining_minor), 0) FROM public.cashback_lots WHERE state = 'ok' AND available_at <= now() AND expires_at > now()),
    'liability_pending_minor', (SELECT coalesce(sum(remaining_minor), 0) FROM public.cashback_lots WHERE state = 'ok' AND available_at > now()),
    'debt_minor', (SELECT coalesce(sum(debt_minor), 0) FROM public.cashback_wallets),
    'issued_30d_minor', (SELECT coalesce(sum(amount_minor), 0) FROM public.cashback_lots WHERE created_at > now() - interval '30 days' AND source_type <> 'adjust'),
    'redeemed_30d_minor', (SELECT coalesce(sum(amount_minor), 0) FROM public.cashback_redemptions WHERE status = 'committed' AND updated_at > now() - interval '30 days'),
    'expired_minor', (SELECT coalesce(sum(remaining_minor), 0) FROM public.cashback_lots WHERE state = 'ok' AND expires_at <= now()),
    'wallets', (SELECT count(*) FROM public.cashback_wallets),
    'own_products', (SELECT count(*) FROM public.products WHERE cashback_own),
    'by_channel_30d', (SELECT coalesce(jsonb_object_agg(channel, s), '{}'::jsonb) FROM
      (SELECT channel, sum(amount_minor) s FROM public.cashback_lots WHERE created_at > now() - interval '30 days' GROUP BY 1) c),
    'log', (SELECT coalesce(jsonb_agg(to_jsonb(l) ORDER BY l.id DESC), '[]'::jsonb) FROM
      (SELECT * FROM public.cashback_admin_log ORDER BY id DESC LIMIT 30) l));
END $$;

CREATE OR REPLACE FUNCTION public.qaygicash_admin_set_program_v1(p_country text, p_patch jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_admin uuid := public.qc_require_admin(); p public.cashback_programs; k text;
BEGIN
  p_country := upper(btrim(coalesce(p_country, '')));
  IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' THEN RAISE EXCEPTION 'QC_BAD_REQUEST'; END IF;
  FOR k IN SELECT jsonb_object_keys(p_patch) LOOP
    IF k NOT IN ('currency', 'status', 'hold_days_physical', 'hold_days_digital', 'expiry_months', 'max_redeem_pct',
                 'min_redeem_minor', 'monthly_earn_cap_minor', 'control_pct', 'redeem_channels', 'premium_redeem', 'terms_version') THEN
      RAISE EXCEPTION 'QC_BAD_FIELD %', k;
    END IF;
  END LOOP;
  SELECT * INTO p FROM public.cashback_programs WHERE country = p_country FOR UPDATE;
  IF NOT FOUND THEN
    IF NOT (p_patch ? 'currency') THEN RAISE EXCEPTION 'QC_CURRENCY_REQUIRED'; END IF;
    INSERT INTO public.cashback_programs (country, currency, status) VALUES (p_country, upper(p_patch->>'currency'), 'draft');
    -- New countries start from the AZ categories, all at 0 % until set.
    INSERT INTO public.cashback_rules (country, channel, rate_bp, own_product)
    SELECT p_country, channel, 0, own_product FROM public.cashback_rules WHERE country = 'AZ' ON CONFLICT DO NOTHING;
    SELECT * INTO p FROM public.cashback_programs WHERE country = p_country FOR UPDATE;
  ELSIF p_patch ? 'currency' AND upper(p_patch->>'currency') <> p.currency
        AND (p.status <> 'draft' OR EXISTS (SELECT 1 FROM public.cashback_wallets WHERE country = p_country)) THEN
    RAISE EXCEPTION 'QC_CURRENCY_LOCKED';
  END IF;
  IF p_patch ? 'premium_redeem' AND (jsonb_typeof(p_patch->'premium_redeem') <> 'object'
     OR coalesce((p_patch->'premium_redeem'->'monthly'->>'price_minor')::bigint, 1) <= 0
     OR coalesce((p_patch->'premium_redeem'->'yearly'->>'price_minor')::bigint, 1) <= 0) THEN
    RAISE EXCEPTION 'QC_BAD_PREMIUM_CONFIG';
  END IF;
  UPDATE public.cashback_programs SET
    currency = coalesce(upper(p_patch->>'currency'), currency),
    status = coalesce(p_patch->>'status', status),
    hold_days_physical = coalesce((p_patch->>'hold_days_physical')::int, hold_days_physical),
    hold_days_digital = coalesce((p_patch->>'hold_days_digital')::int, hold_days_digital),
    expiry_months = coalesce((p_patch->>'expiry_months')::int, expiry_months),
    max_redeem_pct = coalesce((p_patch->>'max_redeem_pct')::int, max_redeem_pct),
    min_redeem_minor = coalesce((p_patch->>'min_redeem_minor')::int, min_redeem_minor),
    monthly_earn_cap_minor = coalesce((p_patch->>'monthly_earn_cap_minor')::int, monthly_earn_cap_minor),
    control_pct = coalesce((p_patch->>'control_pct')::int, control_pct),
    redeem_channels = coalesce((SELECT array_agg(x) FROM jsonb_array_elements_text(p_patch->'redeem_channels') x), redeem_channels),
    premium_redeem = coalesce(premium_redeem || (p_patch->'premium_redeem'), premium_redeem),
    terms_version = coalesce((p_patch->>'terms_version')::int, terms_version),
    updated_at = now(), updated_by = v_admin
  WHERE country = p_country RETURNING * INTO p;
  INSERT INTO public.cashback_admin_log (admin_id, action, target, detail) VALUES (v_admin, 'set_program', p_country, p_patch);
  RETURN to_jsonb(p);
END $$;

CREATE OR REPLACE FUNCTION public.qaygicash_admin_set_rule_v1(p_country text, p_channel text, p_rate_bp int,
  p_own boolean, p_fixed_base_minor bigint DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_admin uuid := public.qc_require_admin(); r public.cashback_rules;
BEGIN
  INSERT INTO public.cashback_rules (country, channel, rate_bp, own_product, fixed_base_minor, updated_by)
  VALUES (upper(p_country), p_channel, p_rate_bp, p_own, p_fixed_base_minor, v_admin)
  ON CONFLICT (country, channel) DO UPDATE SET rate_bp = EXCLUDED.rate_bp, own_product = EXCLUDED.own_product,
    fixed_base_minor = EXCLUDED.fixed_base_minor, version = cashback_rules.version + 1, updated_at = now(), updated_by = v_admin
  RETURNING * INTO r;
  INSERT INTO public.cashback_admin_log (admin_id, action, target, detail)
  VALUES (v_admin, 'set_rule', upper(p_country) || ':' || p_channel,
          jsonb_build_object('rate_bp', p_rate_bp, 'own', p_own, 'fixed_base_minor', p_fixed_base_minor));
  RETURN to_jsonb(r);
END $$;

CREATE OR REPLACE FUNCTION public.qaygicash_admin_user_v1(p_query text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, auth AS $$
DECLARE v_user uuid; v_email text;
BEGIN
  PERFORM public.qc_require_admin();
  p_query := lower(btrim(coalesce(p_query, '')));
  IF p_query ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT id, email INTO v_user, v_email FROM auth.users WHERE id = p_query::uuid;
  ELSE
    SELECT id, email INTO v_user, v_email FROM auth.users WHERE lower(email) = p_query LIMIT 1;
  END IF;
  IF v_user IS NULL THEN RETURN jsonb_build_object('found', false); END IF;
  RETURN jsonb_build_object('found', true, 'user_id', v_user, 'email', v_email,
    'wallet', (SELECT to_jsonb(w) FROM public.cashback_wallets w WHERE user_id = v_user),
    'available_minor', public.qc_available_minor(v_user),
    'pending_minor', (SELECT coalesce(sum(remaining_minor), 0) FROM public.cashback_lots WHERE user_id = v_user AND state = 'ok' AND available_at > now()),
    'lots', (SELECT coalesce(jsonb_agg(to_jsonb(l) ORDER BY l.id DESC), '[]'::jsonb) FROM (SELECT * FROM public.cashback_lots WHERE user_id = v_user ORDER BY id DESC LIMIT 100) l),
    'redemptions', (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.id DESC), '[]'::jsonb) FROM (SELECT * FROM public.cashback_redemptions WHERE user_id = v_user ORDER BY id DESC LIMIT 100) r),
    'ledger', (SELECT coalesce(jsonb_agg(to_jsonb(g) ORDER BY g.id DESC), '[]'::jsonb) FROM (SELECT * FROM public.cashback_ledger WHERE user_id = v_user ORDER BY id DESC LIMIT 100) g));
END $$;

-- Manual correction: ±100 ₼ at most per entry, reason required; positive entries are available at once.
CREATE OR REPLACE FUNCTION public.qaygicash_admin_adjust_v1(p_user uuid, p_amount_minor bigint, p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_admin uuid := public.qc_require_admin(); w public.cashback_wallets; prog public.cashback_programs;
        v_key text := gen_random_uuid()::text; v_taken bigint; v_lot bigint;
BEGIN
  IF p_amount_minor IS NULL OR p_amount_minor = 0 OR abs(p_amount_minor) > 10000 THEN RAISE EXCEPTION 'QC_BAD_AMOUNT'; END IF;
  IF char_length(btrim(coalesce(p_reason, ''))) < 5 THEN RAISE EXCEPTION 'QC_REASON_REQUIRED'; END IF;
  w := public.qc_wallet_lock(p_user, coalesce((SELECT country FROM public.cashback_wallets WHERE user_id = p_user),
                                              (SELECT upper(country_code) FROM public.profiles WHERE user_id = p_user), 'AZ'));
  IF w.user_id IS NULL THEN RAISE EXCEPTION 'QC_NO_PROGRAM'; END IF;
  SELECT * INTO prog FROM public.cashback_programs WHERE country = w.country;
  IF p_amount_minor > 0 THEN
    INSERT INTO public.cashback_lots (user_id, country, channel, source_type, source_id, rate_bp, base_minor, amount_minor,
                                      remaining_minor, available_at, expires_at, note)
    VALUES (p_user, w.country, 'adjust', 'adjust', v_key, 0, 0, p_amount_minor, p_amount_minor, now(),
            now() + make_interval(months => prog.expiry_months), btrim(p_reason)) RETURNING id INTO v_lot;
  ELSE
    v_taken := public.qc_alloc_total(public.qc_take(p_user, -p_amount_minor, true));
    IF -p_amount_minor - v_taken > 0 THEN
      UPDATE public.cashback_wallets SET debt_minor = debt_minor + (-p_amount_minor - v_taken) WHERE user_id = p_user;
    END IF;
  END IF;
  INSERT INTO public.cashback_ledger (user_id, kind, amount_minor, lot_id, idempotency_key, actor, note)
  VALUES (p_user, 'adjust', p_amount_minor, v_lot, 'adjust:' || v_key, 'admin:' || v_admin, btrim(p_reason));
  INSERT INTO public.cashback_admin_log (admin_id, action, target, detail)
  VALUES (v_admin, 'adjust', p_user::text, jsonb_build_object('amount_minor', p_amount_minor, 'reason', btrim(p_reason)));
  RETURN jsonb_build_object('ok', true, 'available_minor', public.qc_available_minor(p_user));
END $$;

CREATE OR REPLACE FUNCTION public.qaygicash_admin_products_v1() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  PERFORM public.qc_require_admin();
  RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'brand', brand, 'store', store, 'price', price,
           'is_active', is_active, 'cashback_own', cashback_own) ORDER BY cashback_own DESC, brand, name), '[]'::jsonb)
          FROM public.products WHERE store = 'aptek');
END $$;

CREATE OR REPLACE FUNCTION public.qaygicash_admin_set_product_own_v1(p_product uuid, p_own boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_admin uuid := public.qc_require_admin();
BEGIN
  UPDATE public.products SET cashback_own = coalesce(p_own, false) WHERE id = p_product;
  INSERT INTO public.cashback_admin_log (admin_id, action, target, detail)
  VALUES (v_admin, 'set_product_own', p_product::text, jsonb_build_object('own', p_own));
END $$;

-- ── Grants ──────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'qc_ledger_append_only()', 'qc_to_minor(numeric)', 'qc_wallet_lock(uuid,text)', 'qc_available_minor(uuid)',
    'qc_take(uuid,bigint,boolean)', 'qc_alloc_total(jsonb)', 'qc_earn(uuid,text,text,text,text,bigint,boolean,text,text)',
    'qc_reverse(text,text,text,text)', 'qc_reserve(uuid,text,text,bigint,bigint,integer,boolean,text)',
    'qc_release(text,text,text,text)', 'qc_commit(text,text,text)', 'qc_release_stale(uuid)',
    'qc_orders_status()', 'qc_cake_status()', 'qc_book_status()', 'qc_web_premium()',
    'qc_earn_store_v1(uuid,text,text,text)', 'qc_reverse_store_v1(text)', 'qc_reserve_book_v1(uuid,uuid,bigint,bigint)',
    'qc_release_book_v1(uuid)', 'qc_premium_reserve_v1(uuid,text,text)', 'qc_premium_finish_v1(text,boolean,text)',
    'qc_require_admin()'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', f);
  END LOOP;
  FOREACH f IN ARRAY ARRAY[
    'qaygicash_wallet_v1()', 'qaygicash_history_v1(integer)', 'qaygicash_redeem_cake_v1(uuid,numeric)',
    'qaygicash_admin_overview_v1()', 'qaygicash_admin_set_program_v1(text,jsonb)',
    'qaygicash_admin_set_rule_v1(text,text,integer,boolean,bigint)', 'qaygicash_admin_user_v1(text)',
    'qaygicash_admin_adjust_v1(uuid,bigint,text)', 'qaygicash_admin_products_v1()',
    'qaygicash_admin_set_product_own_v1(uuid,boolean)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', f);
  END LOOP;
  -- qc_require_admin and qc_to_minor are called from authenticated definer functions only (definer rights).
END $$;

-- ── Ownership, CDC and writer-guard enrollment ──────────────────────────────────────────
DO $$
DECLARE t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pgadmin') THEN
    FOREACH t IN ARRAY ARRAY['cashback_programs', 'cashback_rules', 'cashback_wallets', 'cashback_lots',
                             'cashback_redemptions', 'cashback_ledger', 'cashback_admin_log'] LOOP
      EXECUTE format('ALTER TABLE public.%I OWNER TO pgadmin', t);
    END LOOP;
    EXECUTE 'ALTER FUNCTION public.place_aptek_order(jsonb, text, text, text, jsonb, text, text, numeric) OWNER TO pgadmin';
  END IF;
END $$;

INSERT INTO _anacan_gcp_migration.guarded_relations (schema_name, table_name, primary_key) VALUES
  ('public', 'cashback_programs', ARRAY['country']),
  ('public', 'cashback_rules', ARRAY['country', 'channel']),
  ('public', 'cashback_wallets', ARRAY['user_id']),
  ('public', 'cashback_lots', ARRAY['id']),
  ('public', 'cashback_redemptions', ARRAY['id']),
  ('public', 'cashback_ledger', ARRAY['id']),
  ('public', 'cashback_admin_log', ARRAY['id'])
ON CONFLICT DO NOTHING;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['cashback_programs', 'cashback_rules', 'cashback_wallets', 'cashback_lots',
                           'cashback_redemptions', 'cashback_ledger', 'cashback_admin_log'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS anacan_gcp_writer_guard ON public.%I', t);
    EXECUTE format('DROP TRIGGER IF EXISTS anacan_gcp_change ON public.%I', t);
    EXECUTE format('DROP TRIGGER IF EXISTS anacan_gcp_truncate ON public.%I', t);
    EXECUTE format('CREATE TRIGGER anacan_gcp_writer_guard BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION _anacan_gcp_migration.guard_write()', t);
    EXECUTE format('CREATE TRIGGER anacan_gcp_change AFTER INSERT OR DELETE OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION _anacan_gcp_migration.capture_change()', t);
    EXECUTE format('CREATE TRIGGER anacan_gcp_truncate AFTER TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION _anacan_gcp_migration.capture_change()', t);
    IF (SELECT count(*) FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relname = t
           AND tg.tgname IN ('anacan_gcp_writer_guard', 'anacan_gcp_change', 'anacan_gcp_truncate')) <> 3 THEN
      RAISE EXCEPTION 'QC_GUARD_ENROLLMENT_INCOMPLETE %', t;
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
