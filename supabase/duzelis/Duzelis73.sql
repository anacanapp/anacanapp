-- Duzelis73 (2026-10-31): web purchases through Dodo Payments (Merchant of Record), for funnels on anacan.az.
--
--   * web_checkouts: one row per checkout started on anacan.az (email, plan, Dodo session id).
--   * web_subscriptions: the current state of each Dodo subscription, refreshed from the Dodo API on
--     every webhook. user_id is set only when the buyer's email belongs to an Anacan account whose
--     email is verified by Google or Apple (email sign-up is auto-confirmed here, so a plain e-mail
--     match would let anyone claim someone else's purchase).
--   * web_payment_webhooks: webhook-id ledger, so a redelivered event is applied once.
--   * web_subscription_link_user_v1(user) and web_entitlement_v1(user): service_role only. The shared
--     RevenueCat sync calls them and merges the web entitlement into subscriptions/profiles, so an app
--     open never removes Premium bought on the web.
--   * All three tables: RLS on; a user may read only her own linked subscriptions. Writes are
--     service_role only. New relations are CDC/writer guarded below.
--
-- Applied once on Google (psql as supabase_admin, one transaction). No cron or timer.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

CREATE TABLE IF NOT EXISTS public.web_checkouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'dodo' CHECK (provider = 'dodo'),
  email text NOT NULL CHECK (email = lower(email) AND length(email) BETWEEN 3 AND 254),
  plan text NOT NULL CHECK (plan IN ('monthly', 'yearly')),
  product_id text NOT NULL,
  language text NOT NULL DEFAULT 'az',
  source text NOT NULL DEFAULT 'anacan.az',
  test_mode boolean NOT NULL,
  session_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS web_checkouts_email_idx ON public.web_checkouts (email);

CREATE TABLE IF NOT EXISTS public.web_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'dodo' CHECK (provider = 'dodo'),
  provider_subscription_id text NOT NULL UNIQUE,
  provider_customer_id text,
  checkout_id uuid REFERENCES public.web_checkouts(id) ON DELETE SET NULL,
  email text NOT NULL CHECK (email = lower(email)),
  user_id uuid,
  product_id text NOT NULL,
  plan text NOT NULL CHECK (plan IN ('monthly', 'yearly')),
  status text NOT NULL,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  test_mode boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS web_subscriptions_user_idx ON public.web_subscriptions (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS web_subscriptions_unlinked_email_idx ON public.web_subscriptions (email) WHERE user_id IS NULL;

CREATE TABLE IF NOT EXISTS public.web_payment_webhooks (
  webhook_id text PRIMARY KEY,
  provider text NOT NULL DEFAULT 'dodo',
  event_type text NOT NULL,
  object_id text,
  received_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.web_checkouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.web_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.web_payment_webhooks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.web_checkouts, public.web_subscriptions, public.web_payment_webhooks FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.web_subscriptions TO authenticated;
GRANT ALL ON public.web_checkouts, public.web_subscriptions, public.web_payment_webhooks TO service_role;
DROP POLICY IF EXISTS web_subscriptions_own_read ON public.web_subscriptions;
CREATE POLICY web_subscriptions_own_read ON public.web_subscriptions FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Links unlinked web subscriptions to this user when the purchase email equals an email that Google or
-- Apple verified for this account. Returns how many rows were linked.
CREATE OR REPLACE FUNCTION public.web_subscription_link_user_v1(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  linked integer;
BEGIN
  IF p_user_id IS NULL THEN RETURN 0; END IF;
  UPDATE public.web_subscriptions ws
     SET user_id = p_user_id, updated_at = now()
   WHERE ws.user_id IS NULL
     AND ws.email IN (
       SELECT lower(i.identity_data->>'email') FROM auth.identities i
        WHERE i.user_id = p_user_id AND i.provider IN ('google', 'apple')
          AND coalesce(i.identity_data->>'email', '') <> ''
          AND coalesce((i.identity_data->>'email_verified')::boolean, true));
  GET DIAGNOSTICS linked = ROW_COUNT;
  RETURN linked;
END $$;

-- Links one subscription by its email (webhook path): only to an account with a matching Google/Apple
-- verified email, and only when exactly one such account exists.
CREATE OR REPLACE FUNCTION public.web_subscription_link_email_v1(p_subscription_id text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target uuid;
  matches integer;
BEGIN
  SELECT count(DISTINCT i.user_id), min(i.user_id::text)::uuid INTO matches, target
    FROM public.web_subscriptions ws
    JOIN auth.identities i ON lower(i.identity_data->>'email') = ws.email AND i.provider IN ('google', 'apple')
     AND coalesce((i.identity_data->>'email_verified')::boolean, true)
   WHERE ws.provider_subscription_id = p_subscription_id;
  IF matches <> 1 THEN
    SELECT user_id INTO target FROM public.web_subscriptions WHERE provider_subscription_id = p_subscription_id;
    RETURN target;
  END IF;
  UPDATE public.web_subscriptions SET user_id = target, updated_at = now()
   WHERE provider_subscription_id = p_subscription_id AND user_id IS NULL;
  SELECT user_id INTO target FROM public.web_subscriptions WHERE provider_subscription_id = p_subscription_id;
  RETURN target;
END $$;

-- The best current web entitlement of a user (active or in the payment grace period, not past its end).
CREATE OR REPLACE FUNCTION public.web_entitlement_v1(p_user_id uuid)
RETURNS TABLE (active boolean, plan text, expires_at timestamptz, cancel_at_period_end boolean, provider_subscription_id text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT true, ws.plan, ws.current_period_end, ws.cancel_at_period_end, ws.provider_subscription_id
    FROM public.web_subscriptions ws
   WHERE ws.user_id = p_user_id AND ws.status IN ('active', 'past_due')
     AND (ws.current_period_end IS NULL OR ws.current_period_end > now())
   ORDER BY ws.current_period_end DESC NULLS LAST
   LIMIT 1
$$;

ALTER TABLE public.web_checkouts OWNER TO pgadmin;
ALTER TABLE public.web_subscriptions OWNER TO pgadmin;
ALTER TABLE public.web_payment_webhooks OWNER TO pgadmin;
ALTER FUNCTION public.web_subscription_link_user_v1(uuid) OWNER TO pgadmin;
ALTER FUNCTION public.web_subscription_link_email_v1(text) OWNER TO pgadmin;
ALTER FUNCTION public.web_entitlement_v1(uuid) OWNER TO pgadmin;
REVOKE ALL ON FUNCTION public.web_subscription_link_user_v1(uuid), public.web_subscription_link_email_v1(text), public.web_entitlement_v1(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.web_subscription_link_user_v1(uuid), public.web_subscription_link_email_v1(text), public.web_entitlement_v1(uuid) TO service_role;

-- CDC/writer guard enrollment for the three new relations (same contract as Duzelis69).
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['web_checkouts', 'web_subscriptions', 'web_payment_webhooks'] LOOP
    INSERT INTO _anacan_gcp_migration.guarded_relations(schema_name, table_name, primary_key)
    VALUES ('public', t, CASE t WHEN 'web_payment_webhooks' THEN ARRAY['webhook_id'] ELSE ARRAY['id'] END)
    ON CONFLICT DO NOTHING;
    EXECUTE format('DROP TRIGGER IF EXISTS anacan_gcp_writer_guard ON public.%I', t);
    EXECUTE format('DROP TRIGGER IF EXISTS anacan_gcp_change ON public.%I', t);
    EXECUTE format('DROP TRIGGER IF EXISTS anacan_gcp_truncate ON public.%I', t);
    EXECUTE format('CREATE TRIGGER anacan_gcp_writer_guard BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION _anacan_gcp_migration.guard_write()', t);
    EXECUTE format('CREATE TRIGGER anacan_gcp_change AFTER INSERT OR DELETE OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION _anacan_gcp_migration.capture_change()', t);
    EXECUTE format('CREATE TRIGGER anacan_gcp_truncate AFTER TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION _anacan_gcp_migration.capture_change()', t);
  END LOOP;
  IF (SELECT count(*) FROM _anacan_gcp_migration.guarded_relations WHERE schema_name = 'public'
        AND table_name IN ('web_checkouts', 'web_subscriptions', 'web_payment_webhooks')) <> 3
     OR (SELECT count(*) FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relname IN ('web_checkouts', 'web_subscriptions', 'web_payment_webhooks')
            AND tg.tgname IN ('anacan_gcp_writer_guard', 'anacan_gcp_change', 'anacan_gcp_truncate')) <> 9 THEN
    RAISE EXCEPTION 'WEB_PAYMENTS_GUARD_ENROLLMENT_INCOMPLETE';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
