-- Epoint evidence archive (2026-11-11, owner: "keep the evidence for every transaction").
-- Every Epoint payment gets a fixed evidence snapshot (order, payment, delivery, consent, subscription) with a SHA-256
-- of its content, taken automatically when the payment is confirmed (paid_at set) and, for PDF books, again when the
-- delivery e-mail is sent. Existing paid transactions are back-filled. Archiving never blocks a payment (errors only
-- raise a warning). Admins see the snapshots in "Epoint sübutu" (admin_epoint_evidence_v1 adds `archive`).
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

CREATE TABLE IF NOT EXISTS public.epoint_evidence_archive (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('book', 'premium', 'cake')),
  order_id uuid NOT NULL,
  provider_transaction text,
  reason text NOT NULL CHECK (reason IN ('paid', 'delivered', 'backfill')),
  snapshot jsonb NOT NULL,
  sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  captured_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS epoint_evidence_archive_order_idx ON public.epoint_evidence_archive (order_id, captured_at);
CREATE INDEX IF NOT EXISTS epoint_evidence_archive_txn_idx ON public.epoint_evidence_archive (provider_transaction) WHERE provider_transaction IS NOT NULL;
ALTER TABLE public.epoint_evidence_archive ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.epoint_evidence_archive FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.epoint_evidence_archive TO service_role;
ALTER TABLE public.epoint_evidence_archive OWNER TO pgadmin;

-- Internal builder (same output as the admin lookup, without the admin check). Service role / definer use only.
CREATE OR REPLACE FUNCTION public.epoint_evidence_build_v1(p_query text)
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
ALTER FUNCTION public.epoint_evidence_build_v1(text) OWNER TO pgadmin;
REVOKE ALL ON FUNCTION public.epoint_evidence_build_v1(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.epoint_evidence_build_v1(text) TO service_role;

-- Stores one snapshot of one order's evidence.
CREATE OR REPLACE FUNCTION public.epoint_evidence_capture_v1(p_kind text, p_order uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE item jsonb;
BEGIN
  SELECT e INTO item FROM jsonb_array_elements(public.epoint_evidence_build_v1(p_order::text)) e
   WHERE e->>'type' = p_kind AND e->>'order_id' = p_order::text LIMIT 1;
  IF item IS NULL THEN RETURN; END IF;
  INSERT INTO public.epoint_evidence_archive (kind, order_id, provider_transaction, reason, snapshot, sha256)
  VALUES (p_kind, p_order, item->>'provider_transaction', p_reason, item, encode(sha256(convert_to(item::text, 'UTF8')), 'hex'));
END $$;
ALTER FUNCTION public.epoint_evidence_capture_v1(text, uuid, text) OWNER TO pgadmin;
REVOKE ALL ON FUNCTION public.epoint_evidence_capture_v1(text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.epoint_evidence_capture_v1(text, uuid, text) TO service_role;

-- Row triggers: snapshot on payment confirmation (and PDF delivery e-mail). Never blocks the payment write.
CREATE OR REPLACE FUNCTION public.epoint_evidence_capture_trigger_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE kind text := TG_ARGV[0];
BEGIN
  BEGIN
    IF NEW.paid_at IS NOT NULL AND OLD.paid_at IS NULL THEN
      PERFORM public.epoint_evidence_capture_v1(kind, NEW.id, 'paid');
    END IF;
    -- email_sent_at exists on book_orders only: read it through jsonb so other tables never touch the field.
    IF kind = 'book' AND (to_jsonb(NEW)->>'email_sent_at') IS NOT NULL AND (to_jsonb(OLD)->>'email_sent_at') IS NULL AND NEW.paid_at IS NOT NULL THEN
      PERFORM public.epoint_evidence_capture_v1(kind, NEW.id, 'delivered');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'epoint evidence archive failed for % %: %', kind, NEW.id, SQLERRM;
  END;
  RETURN NULL;
END $$;
ALTER FUNCTION public.epoint_evidence_capture_trigger_v1() OWNER TO pgadmin;
REVOKE ALL ON FUNCTION public.epoint_evidence_capture_trigger_v1() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS epoint_evidence_capture ON public.book_orders;
CREATE TRIGGER epoint_evidence_capture AFTER UPDATE OF paid_at, email_sent_at ON public.book_orders
  FOR EACH ROW WHEN (NEW.provider = 'epoint') EXECUTE FUNCTION public.epoint_evidence_capture_trigger_v1('book');
DROP TRIGGER IF EXISTS epoint_evidence_capture ON public.web_premium_charges;
CREATE TRIGGER epoint_evidence_capture AFTER UPDATE OF paid_at ON public.web_premium_charges
  FOR EACH ROW EXECUTE FUNCTION public.epoint_evidence_capture_trigger_v1('premium');
DROP TRIGGER IF EXISTS epoint_evidence_capture ON public.cake_orders;
CREATE TRIGGER epoint_evidence_capture AFTER UPDATE OF paid_at ON public.cake_orders
  FOR EACH ROW WHEN (NEW.provider_transaction IS NOT NULL) EXECUTE FUNCTION public.epoint_evidence_capture_trigger_v1('cake');

-- Admin lookup: the live evidence plus every saved snapshot of that order.
CREATE OR REPLACE FUNCTION public.admin_epoint_evidence_v1(p_query text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501'; END IF;
  RETURN coalesce((SELECT jsonb_agg(e || jsonb_build_object('archive', coalesce((SELECT jsonb_agg(jsonb_build_object('captured_at', a.captured_at, 'reason', a.reason, 'sha256', a.sha256) ORDER BY a.captured_at)
      FROM public.epoint_evidence_archive a WHERE a.order_id = (e->>'order_id')::uuid AND a.kind = e->>'type'), '[]'::jsonb)))
    FROM jsonb_array_elements(public.epoint_evidence_build_v1(p_query)) e), '[]'::jsonb);
END $$;

-- CDC/writer guard for the new relation.
DO $$
BEGIN
  INSERT INTO _anacan_gcp_migration.guarded_relations(schema_name, table_name, primary_key)
  VALUES ('public', 'epoint_evidence_archive', ARRAY['id']) ON CONFLICT DO NOTHING;
  DROP TRIGGER IF EXISTS anacan_gcp_writer_guard ON public.epoint_evidence_archive;
  DROP TRIGGER IF EXISTS anacan_gcp_change ON public.epoint_evidence_archive;
  DROP TRIGGER IF EXISTS anacan_gcp_truncate ON public.epoint_evidence_archive;
  CREATE TRIGGER anacan_gcp_writer_guard BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON public.epoint_evidence_archive FOR EACH STATEMENT EXECUTE FUNCTION _anacan_gcp_migration.guard_write();
  CREATE TRIGGER anacan_gcp_change AFTER INSERT OR DELETE OR UPDATE ON public.epoint_evidence_archive FOR EACH ROW EXECUTE FUNCTION _anacan_gcp_migration.capture_change();
  CREATE TRIGGER anacan_gcp_truncate AFTER TRUNCATE ON public.epoint_evidence_archive FOR EACH STATEMENT EXECUTE FUNCTION _anacan_gcp_migration.capture_change();
END $$;

-- Back-fill: one snapshot for every Epoint payment already confirmed.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT 'book' k, id FROM public.book_orders WHERE provider = 'epoint' AND paid_at IS NOT NULL
           UNION ALL SELECT 'premium', id FROM public.web_premium_charges WHERE paid_at IS NOT NULL
           UNION ALL SELECT 'cake', id FROM public.cake_orders WHERE paid_at IS NOT NULL AND provider_transaction IS NOT NULL LOOP
    IF NOT EXISTS (SELECT 1 FROM public.epoint_evidence_archive a WHERE a.order_id = r.id AND a.kind = r.k) THEN
      PERFORM public.epoint_evidence_capture_v1(r.k, r.id, 'backfill');
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
