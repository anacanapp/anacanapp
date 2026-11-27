-- Epoint compliance evidence (2026-11-11, owner request: Epoint asked for proof per transaction).
--   * book_orders.consent_at / consent_version: the buyer ticked "immediate delivery + loss of withdrawal right +
--     terms" before paying (website checkout requires it from now on; app checkout records it when sent).
--   * web_premium_subscriptions.consent_at / consent_version: the Premium auto-renew + saved-card consent.
--   * book_download_events: every PDF hand-out (email link or account), with time, channel, IP and user agent.
--   * admin_epoint_evidence_v1(query): admins look up an Epoint transaction ID, order ID or buyer e-mail and get
--     the full evidence (order, payment, delivery, consent, subscription) for the admin panel "Epoint sübutu".
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

ALTER TABLE public.book_orders ADD COLUMN IF NOT EXISTS consent_at timestamptz;
ALTER TABLE public.book_orders ADD COLUMN IF NOT EXISTS consent_version text CHECK (consent_version IS NULL OR length(consent_version) <= 40);
ALTER TABLE public.web_premium_subscriptions ADD COLUMN IF NOT EXISTS consent_at timestamptz;
ALTER TABLE public.web_premium_subscriptions ADD COLUMN IF NOT EXISTS consent_version text CHECK (consent_version IS NULL OR length(consent_version) <= 40);

CREATE TABLE IF NOT EXISTS public.book_download_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.book_orders(id) ON DELETE SET NULL,
  book_id text NOT NULL CHECK (length(book_id) <= 40),
  user_id uuid,
  via text NOT NULL CHECK (via IN ('email_link', 'account')),
  ip text CHECK (ip IS NULL OR length(ip) <= 64),
  user_agent text CHECK (user_agent IS NULL OR length(user_agent) <= 300),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS book_download_events_order_idx ON public.book_download_events (order_id, created_at);
CREATE INDEX IF NOT EXISTS book_download_events_user_idx ON public.book_download_events (user_id, created_at) WHERE user_id IS NOT NULL;
ALTER TABLE public.book_download_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.book_download_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.book_download_events TO service_role;
ALTER TABLE public.book_download_events OWNER TO pgadmin;

-- Evidence lookup for admins. q: Epoint transaction ID, our order ID (uuid) or the buyer's e-mail.
CREATE OR REPLACE FUNCTION public.admin_epoint_evidence_v1(p_query text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  q text := btrim(coalesce(p_query, ''));
  is_email boolean;
  result jsonb := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501'; END IF;
  IF length(q) < 4 OR length(q) > 254 THEN RETURN result; END IF;
  is_email := position('@' IN q) > 1;
  q := CASE WHEN is_email THEN lower(q) ELSE q END;

  -- PDF books
  result := result || coalesce((SELECT jsonb_agg(jsonb_build_object(
      'type', 'book', 'order_id', o.id, 'provider_transaction', o.provider_transaction, 'provider_status', o.provider_status,
      'status', o.status, 'provider', o.provider, 'channel', o.channel, 'amount', o.amount, 'currency', o.currency,
      'created_at', o.created_at, 'paid_at', o.paid_at, 'email', o.email, 'name', coalesce(o.customer_name, p.name),
      'phone', o.customer_phone, 'user_id', o.user_id,
      'product', (SELECT string_agg(c.title, ' | ' ORDER BY c.sort_order) FROM public.book_catalog c WHERE c.id = ANY(o.book_ids)),
      'items', cardinality(o.book_ids), 'unit_price', o.unit_price,
      'granted_at', (SELECT min(e.granted_at) FROM public.book_entitlements e WHERE e.order_id = o.id),
      'email_sent_at', o.email_sent_at, 'consent_at', o.consent_at, 'consent_version', o.consent_version,
      'downloads', coalesce((SELECT jsonb_agg(jsonb_build_object('at', d.created_at, 'book_id', d.book_id, 'via', d.via, 'ip', d.ip, 'user_agent', d.user_agent) ORDER BY d.created_at)
                             FROM public.book_download_events d WHERE d.order_id = o.id OR (d.order_id IS NULL AND d.user_id = o.user_id AND d.book_id = ANY(o.book_ids))), '[]'::jsonb)
    ) ORDER BY o.created_at DESC)
    FROM public.book_orders o LEFT JOIN public.profiles p ON p.user_id = o.user_id
    WHERE (NOT is_email AND (o.id::text = q OR o.provider_transaction = q)) OR (is_email AND lower(o.email) = q)), '[]'::jsonb);

  -- Web Premium charges (initial and renewals)
  result := result || coalesce((SELECT jsonb_agg(jsonb_build_object(
      'type', 'premium', 'order_id', ch.id, 'provider_transaction', ch.provider_transaction, 'status', ch.status, 'error', ch.error,
      'kind', ch.kind, 'plan', ch.plan, 'amount', ch.amount, 'currency', ch.currency, 'created_at', ch.created_at, 'paid_at', ch.paid_at,
      'period_start', ch.period_start, 'period_end', ch.period_end, 'email', u.email, 'name', p.name, 'user_id', ch.user_id,
      'product', 'Anacan Premium, ' || CASE WHEN ch.plan = 'yearly' THEN '12 ay' ELSE '1 ay' END || coalesce(' · kampaniya: ' || s.campaign, ''),
      'subscription_id', s.id, 'subscription_status', s.status, 'subscription_created_at', s.created_at, 'cancel_at_period_end', s.cancel_at_period_end,
      'cancelled_at', s.cancelled_at, 'ended_at', s.ended_at, 'current_period_end', s.current_period_end,
      'card_mask', k.mask, 'card_saved_at', k.created_at, 'consent_at', s.consent_at, 'consent_version', s.consent_version
    ) ORDER BY ch.created_at DESC)
    FROM public.web_premium_charges ch JOIN public.web_premium_subscriptions s ON s.id = ch.subscription_id
    LEFT JOIN auth.users u ON u.id = ch.user_id LEFT JOIN public.profiles p ON p.user_id = ch.user_id
    LEFT JOIN public.epoint_saved_cards k ON k.id = ch.card_ref
    WHERE (NOT is_email AND (ch.id::text = q OR ch.provider_transaction = q)) OR (is_email AND lower(u.email) = q)), '[]'::jsonb);

  -- Cake orders paid by card (Epoint)
  result := result || coalesce((SELECT jsonb_agg(jsonb_build_object(
      'type', 'cake', 'order_id', c.id, 'provider_transaction', c.provider_transaction, 'status', c.status, 'payment_status', c.payment_status,
      'amount', c.total_price, 'currency', 'AZN', 'created_at', c.created_at, 'paid_at', c.paid_at, 'email', c.customer_email,
      'name', c.customer_name, 'phone', c.contact_phone, 'user_id', c.user_id, 'product', c.custom_text,
      'delivery_date', c.delivery_date, 'delivery_address', c.delivery_address, 'channel', c.channel
    ) ORDER BY c.created_at DESC)
    FROM public.cake_orders c
    WHERE (NOT is_email AND (c.id::text = q OR c.provider_transaction = q)) OR (is_email AND lower(c.customer_email) = q)), '[]'::jsonb);
  RETURN result;
END $$;
ALTER FUNCTION public.admin_epoint_evidence_v1(text) OWNER TO pgadmin;
REVOKE ALL ON FUNCTION public.admin_epoint_evidence_v1(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_epoint_evidence_v1(text) TO authenticated, service_role;

-- CDC/writer guard for the new relation (same contract as Duzelis73).
DO $$
BEGIN
  INSERT INTO _anacan_gcp_migration.guarded_relations(schema_name, table_name, primary_key)
  VALUES ('public', 'book_download_events', ARRAY['id']) ON CONFLICT DO NOTHING;
  DROP TRIGGER IF EXISTS anacan_gcp_writer_guard ON public.book_download_events;
  DROP TRIGGER IF EXISTS anacan_gcp_change ON public.book_download_events;
  DROP TRIGGER IF EXISTS anacan_gcp_truncate ON public.book_download_events;
  CREATE TRIGGER anacan_gcp_writer_guard BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON public.book_download_events FOR EACH STATEMENT EXECUTE FUNCTION _anacan_gcp_migration.guard_write();
  CREATE TRIGGER anacan_gcp_change AFTER INSERT OR DELETE OR UPDATE ON public.book_download_events FOR EACH ROW EXECUTE FUNCTION _anacan_gcp_migration.capture_change();
  CREATE TRIGGER anacan_gcp_truncate AFTER TRUNCATE ON public.book_download_events FOR EACH STATEMENT EXECUTE FUNCTION _anacan_gcp_migration.capture_change();
  IF (SELECT count(*) FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = 'book_download_events'
         AND tg.tgname IN ('anacan_gcp_writer_guard', 'anacan_gcp_change', 'anacan_gcp_truncate')) <> 3 THEN
    RAISE EXCEPTION 'BOOK_DOWNLOAD_EVENTS_GUARD_INCOMPLETE';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
