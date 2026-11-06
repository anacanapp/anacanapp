-- Web Premium paid with Epoint (anacan.az Premium funnel), next to the Dodo subscriptions.
--
-- Epoint takes one-off card payments in AZN, so web Premium bought with Epoint is a fixed-term pass
-- (1 month or 12 months) that does not renew. A paid order becomes a web_subscriptions row
-- (provider 'epoint', cancel_at_period_end = true), so web_entitlement_v1, the e-mail / sponsor linking and the
-- entitlement sync work unchanged. A new pass bought while one is running starts when the running one ends.
--
-- * web_subscriptions.provider: 'dodo' | 'epoint' (was 'dodo' only).
-- * web_premium_orders: one row per Epoint checkout (server-priced; service role only).
-- * web_premium_epoint_grant_v1(order, transaction, amount): idempotent, amount-checked grant (service role).
-- * app_settings.web_premium_epoint: {"enabled": true, "prices": {"monthly": 3.99, "yearly": 26.99}} (AZN).
--
-- Applied by /home/anacan-runner/run-sql.py (psql as supabase_admin, ON_ERROR_STOP, one transaction).
-- web_subscriptions and app_settings are already CDC/writer guarded; the new order table is enrolled here.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

DO $$
BEGIN
  IF to_regclass('_anacan_gcp_migration.guarded_relations') IS NULL THEN
    RAISE EXCEPTION 'WEB_PREMIUM_EPOINT_GUARD_CATALOG_MISSING';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM _anacan_gcp_migration.guarded_relations WHERE schema_name = 'public' AND table_name = 'web_subscriptions')
     OR NOT EXISTS (SELECT 1 FROM _anacan_gcp_migration.guarded_relations WHERE schema_name = 'public' AND table_name = 'app_settings') THEN
    RAISE EXCEPTION 'WEB_PREMIUM_EPOINT_EXISTING_RELATIONS_NOT_GUARDED';
  END IF;
END $$;

-- ── Provider ───────────────────────────────────────────────────────────────────────────
ALTER TABLE public.web_subscriptions DROP CONSTRAINT IF EXISTS web_subscriptions_provider_check;
ALTER TABLE public.web_subscriptions ADD CONSTRAINT web_subscriptions_provider_check CHECK (provider IN ('dodo', 'epoint'));

-- ── Orders ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.web_premium_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL CHECK (email = lower(email) AND length(email) BETWEEN 3 AND 254),
  plan text NOT NULL CHECK (plan IN ('monthly', 'yearly')),
  amount numeric(10, 2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'AZN' CHECK (currency = 'AZN'),
  language text NOT NULL DEFAULT 'az' CHECK (language ~ '^[a-z]{2}$'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed')),
  provider_transaction text,
  subscription_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS web_premium_orders_email_idx ON public.web_premium_orders (email, created_at DESC);
ALTER TABLE public.web_premium_orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.web_premium_orders FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.web_premium_orders TO service_role;

-- ── Grant (idempotent; the amount must equal the server price stored on the order) ─────
CREATE OR REPLACE FUNCTION public.web_premium_epoint_grant_v1(p_order_id uuid, p_transaction text, p_amount numeric)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  o public.web_premium_orders%ROWTYPE;
  sub_id text;
  starts timestamptz;
BEGIN
  SELECT * INTO o FROM public.web_premium_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'WEB_PREMIUM_ORDER_NOT_FOUND'; END IF;
  IF o.status = 'paid' THEN RETURN o.subscription_id; END IF;
  IF p_amount IS NULL OR abs(p_amount - o.amount) > 0.001 THEN RAISE EXCEPTION 'WEB_PREMIUM_AMOUNT_MISMATCH'; END IF;

  sub_id := 'epoint_' || o.id::text;
  -- A pass bought while another Epoint pass for this e-mail still runs starts when that one ends.
  SELECT greatest(now(), coalesce(max(current_period_end), now())) INTO starts
    FROM public.web_subscriptions
   WHERE provider = 'epoint' AND email = o.email AND status = 'active' AND current_period_end > now();

  INSERT INTO public.web_subscriptions (provider, provider_subscription_id, email, product_id, plan, status,
    current_period_end, cancel_at_period_end, test_mode, updated_at)
  VALUES ('epoint', sub_id, o.email, 'epoint_' || o.plan, o.plan, 'active',
    starts + CASE o.plan WHEN 'yearly' THEN interval '12 months' ELSE interval '1 month' END, true, false, now())
  ON CONFLICT (provider_subscription_id) DO NOTHING;

  UPDATE public.web_premium_orders
     SET status = 'paid', paid_at = now(), updated_at = now(), subscription_id = sub_id,
         provider_transaction = coalesce(left(p_transaction, 128), provider_transaction)
   WHERE id = o.id;
  RETURN sub_id;
END
$function$;
REVOKE ALL ON FUNCTION public.web_premium_epoint_grant_v1(uuid, text, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.web_premium_epoint_grant_v1(uuid, text, numeric) TO service_role;

-- ── Prices and switch (AZN) ─────────────────────────────────────────────────────────────
INSERT INTO public.app_settings (key, value, description)
SELECT 'web_premium_epoint', '{"enabled": true, "prices": {"monthly": 3.99, "yearly": 26.99}}'::jsonb,
       'anacan.az Premium funnel: Epoint (AZN) fixed-term passes; prices in AZN, server-side'
 WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'web_premium_epoint');

-- ── Ownership, CDC and writer-guard enrollment of the new relation ─────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pgadmin') THEN
    EXECUTE 'ALTER TABLE public.web_premium_orders OWNER TO pgadmin';
  END IF;
END $$;

INSERT INTO _anacan_gcp_migration.guarded_relations (schema_name, table_name, primary_key) VALUES
  ('public', 'web_premium_orders', ARRAY['id'])
ON CONFLICT DO NOTHING;

DO $$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS anacan_gcp_writer_guard ON public.web_premium_orders';
  EXECUTE 'DROP TRIGGER IF EXISTS anacan_gcp_change ON public.web_premium_orders';
  EXECUTE 'DROP TRIGGER IF EXISTS anacan_gcp_truncate ON public.web_premium_orders';
  EXECUTE 'CREATE TRIGGER anacan_gcp_writer_guard BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON public.web_premium_orders FOR EACH STATEMENT EXECUTE FUNCTION _anacan_gcp_migration.guard_write()';
  EXECUTE 'CREATE TRIGGER anacan_gcp_change AFTER INSERT OR DELETE OR UPDATE ON public.web_premium_orders FOR EACH ROW EXECUTE FUNCTION _anacan_gcp_migration.capture_change()';
  EXECUTE 'CREATE TRIGGER anacan_gcp_truncate AFTER TRUNCATE ON public.web_premium_orders FOR EACH STATEMENT EXECUTE FUNCTION _anacan_gcp_migration.capture_change()';
  IF (SELECT count(*) FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = 'web_premium_orders'
         AND tg.tgname IN ('anacan_gcp_writer_guard', 'anacan_gcp_change', 'anacan_gcp_truncate')) <> 3 THEN
    RAISE EXCEPTION 'WEB_PREMIUM_EPOINT_GUARD_ENROLLMENT_INCOMPLETE';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
