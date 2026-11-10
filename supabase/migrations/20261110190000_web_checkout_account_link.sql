-- Web checkout account link (11.11 foreign pages): a Dodo checkout started by a signed-in Anacan account
-- records that account (web_checkouts.user_id, set only by dodo-checkout from a verified session token).
-- The webhook then links the subscription through its checkout (web_subscriptions.checkout_id), so
-- Premium opens on that account at once, with no email matching. Email linking stays as the fallback
-- for checkouts started without a session (sponsor links, older funnels).
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

ALTER TABLE public.web_checkouts ADD COLUMN IF NOT EXISTS user_id uuid;
CREATE INDEX IF NOT EXISTS web_checkouts_user_idx ON public.web_checkouts (user_id) WHERE user_id IS NOT NULL;

-- Links one subscription to the account that started its checkout. Never overwrites an existing link;
-- ignores accounts that no longer exist. Returns the subscription's user_id after the call (may be null).
CREATE OR REPLACE FUNCTION public.web_subscription_link_checkout_v1(p_subscription_id text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target uuid;
BEGIN
  SELECT wc.user_id INTO target
    FROM public.web_subscriptions ws
    JOIN public.web_checkouts wc ON wc.id = ws.checkout_id
   WHERE ws.provider_subscription_id = p_subscription_id AND wc.user_id IS NOT NULL;
  IF target IS NOT NULL AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = target) THEN
    UPDATE public.web_subscriptions SET user_id = target, updated_at = now()
     WHERE provider_subscription_id = p_subscription_id AND user_id IS NULL;
  END IF;
  SELECT user_id INTO target FROM public.web_subscriptions WHERE provider_subscription_id = p_subscription_id;
  RETURN target;
END $$;

ALTER FUNCTION public.web_subscription_link_checkout_v1(text) OWNER TO pgadmin;
REVOKE ALL ON FUNCTION public.web_subscription_link_checkout_v1(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.web_subscription_link_checkout_v1(text) TO service_role;

-- web_checkouts is already enrolled (Duzelis73); confirm its guard and CDC triggers are still in place.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM _anacan_gcp_migration.guarded_relations WHERE schema_name = 'public' AND table_name = 'web_checkouts')
     OR (SELECT count(*) FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relname = 'web_checkouts'
            AND tg.tgname IN ('anacan_gcp_writer_guard', 'anacan_gcp_change', 'anacan_gcp_truncate')) <> 3 THEN
    RAISE EXCEPTION 'WEB_CHECKOUTS_GUARD_MISSING';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
