-- Abandoned PDF book checkout reminder (owner request 2026-11-13).
-- A buyer who opened the Epoint bank page for books and left without paying (Epoint closes the session after about
-- 15 minutes and the order turns 'failed') gets ONE push about an hour later: "Səbətin səni gözləyir". The cart is kept
-- on the phone, and the push opens the book store (anacan://books).
-- Not reminded: technical failures (request_failed / cashback_refused), test amounts under 1 AZN, non-Azerbaijani
-- orders (the store is AZ only), buyers who paid for books since or have a pending book order, buyers who already own
-- every book of that order, and anyone reminded in the last 7 days.
-- web-premium-renew {"mode":"nudge"} (existing 15-minute timer anacan-web-premium-nudge) claims due rows here.
-- The new relation is enrolled in CDC and writer guarding (refuses without the guard catalog).
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

DO $$
BEGIN
  IF to_regclass('_anacan_gcp_migration.guarded_relations') IS NULL THEN
    RAISE EXCEPTION 'BOOK_NUDGE_GUARD_CATALOG_MISSING';
  END IF;
  IF to_regclass('public.book_orders') IS NULL OR to_regclass('public.book_entitlements') IS NULL THEN
    RAISE EXCEPTION 'BOOK_NUDGE_BASE_MISSING';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.book_checkout_nudges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  order_id uuid NOT NULL UNIQUE REFERENCES public.book_orders(id) ON DELETE CASCADE,
  push_sent integer CHECK (push_sent IS NULL OR push_sent BETWEEN 0 AND 50),
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
CREATE INDEX IF NOT EXISTS book_checkout_nudges_user_idx ON public.book_checkout_nudges (user_id, created_at DESC);
ALTER TABLE public.book_checkout_nudges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.book_checkout_nudges FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.book_checkout_nudges TO service_role;

-- Claims up to p_limit buyers to remind (their latest abandoned book order) and returns them.
CREATE OR REPLACE FUNCTION public.book_checkout_nudges_due_v1(p_limit integer DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE v_due jsonb;
BEGIN
  WITH latest AS (
    SELECT DISTINCT ON (o.user_id) o.id, o.user_id, o.status, o.provider_status, o.amount, o.language, o.book_ids, o.created_at, o.updated_at
      FROM public.book_orders o
     WHERE o.created_at > now() - interval '25 hours'
     ORDER BY o.user_id, o.created_at DESC
  ), due AS (
    SELECT l.* FROM latest l
     WHERE l.status = 'failed'
       AND coalesce(l.provider_status, '') NOT IN ('request_failed', 'cashback_refused')
       AND l.amount >= 1
       AND coalesce(l.language, 'az') = 'az'
       AND l.created_at <= now() - interval '60 minutes'
       AND l.created_at >= now() - interval '24 hours'
       AND l.updated_at <= now() - interval '5 minutes'
       AND NOT EXISTS (SELECT 1 FROM public.book_orders p
                        WHERE p.user_id = l.user_id AND (p.status = 'pending' OR p.status = 'paid' AND p.created_at >= l.created_at))
       AND EXISTS (SELECT 1 FROM unnest(l.book_ids) b(id)
                    WHERE NOT EXISTS (SELECT 1 FROM public.book_entitlements e WHERE e.user_id = l.user_id AND e.book_id = b.id))
       AND NOT EXISTS (SELECT 1 FROM public.book_checkout_nudges n
                        WHERE n.user_id = l.user_id AND n.created_at > now() - interval '7 days')
     ORDER BY l.created_at
     LIMIT greatest(1, least(coalesce(p_limit, 50), 200))
  ), claimed AS (
    INSERT INTO public.book_checkout_nudges (user_id, order_id)
    SELECT user_id, id FROM due
    ON CONFLICT (order_id) DO NOTHING
    RETURNING id, user_id, order_id
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object('nudge_id', c.id, 'user_id', c.user_id,
           'books', (SELECT cardinality(o.book_ids) FROM public.book_orders o WHERE o.id = c.order_id))), '[]'::jsonb)
    INTO v_due FROM claimed c;
  RETURN jsonb_build_object('due', v_due);
END
$function$;

-- Records what was actually delivered for a claimed reminder.
CREATE OR REPLACE FUNCTION public.book_checkout_nudge_sent_v1(p_nudge uuid, p_push integer)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $function$
  UPDATE public.book_checkout_nudges
     SET push_sent = greatest(0, least(coalesce(p_push, 0), 50)), sent_at = now()
   WHERE id = p_nudge;
$function$;

REVOKE ALL ON FUNCTION public.book_checkout_nudges_due_v1(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.book_checkout_nudge_sent_v1(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.book_checkout_nudges_due_v1(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.book_checkout_nudge_sent_v1(uuid, integer) TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pgadmin') THEN
    ALTER TABLE public.book_checkout_nudges OWNER TO pgadmin;
    ALTER FUNCTION public.book_checkout_nudges_due_v1(integer) OWNER TO pgadmin;
    ALTER FUNCTION public.book_checkout_nudge_sent_v1(uuid, integer) OWNER TO pgadmin;
  END IF;
END $$;

-- ── CDC and writer-guard enrollment ─────────────────────────────────────────────────────
INSERT INTO _anacan_gcp_migration.guarded_relations (schema_name, table_name, primary_key)
VALUES ('public', 'book_checkout_nudges', ARRAY['id'])
ON CONFLICT DO NOTHING;

DO $$
BEGIN
  DROP TRIGGER IF EXISTS anacan_gcp_writer_guard ON public.book_checkout_nudges;
  DROP TRIGGER IF EXISTS anacan_gcp_change ON public.book_checkout_nudges;
  DROP TRIGGER IF EXISTS anacan_gcp_truncate ON public.book_checkout_nudges;
  CREATE TRIGGER anacan_gcp_writer_guard BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON public.book_checkout_nudges
    FOR EACH STATEMENT EXECUTE FUNCTION _anacan_gcp_migration.guard_write();
  CREATE TRIGGER anacan_gcp_change AFTER INSERT OR DELETE OR UPDATE ON public.book_checkout_nudges
    FOR EACH ROW EXECUTE FUNCTION _anacan_gcp_migration.capture_change();
  CREATE TRIGGER anacan_gcp_truncate AFTER TRUNCATE ON public.book_checkout_nudges
    FOR EACH STATEMENT EXECUTE FUNCTION _anacan_gcp_migration.capture_change();
  IF (SELECT count(*) FROM _anacan_gcp_migration.guarded_relations
       WHERE schema_name = 'public' AND table_name = 'book_checkout_nudges') <> 1
     OR (SELECT count(*) FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relname = 'book_checkout_nudges'
            AND tg.tgname IN ('anacan_gcp_writer_guard', 'anacan_gcp_change', 'anacan_gcp_truncate')) <> 3 THEN
    RAISE EXCEPTION 'BOOK_NUDGE_GUARD_ENROLLMENT_INCOMPLETE';
  END IF;
END $$;

-- ── Admin banners: real (brand-measured) impressions and clicks ─────────────────────────
-- Banners carrying an ad_brand_creatives row (e.g. the "Anacan" PDF book banners) are measured through
-- ad_delivery_receipts / ad_metrics_daily, not the legacy banners.view_count / click_count. Admin only.
CREATE OR REPLACE FUNCTION public.admin_banner_measured_stats_v1()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE v jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'ADMIN_ONLY' USING ERRCODE = '42501'; END IF;
  SELECT coalesce(jsonb_object_agg(m.creative_id, jsonb_build_object('impressions', m.impressions, 'clicks', m.clicks)), '{}'::jsonb)
    INTO v
    FROM (SELECT creative_id, sum(impressions)::bigint AS impressions, sum(clicks)::bigint AS clicks
            FROM public.ad_metrics_daily GROUP BY creative_id) m;
  RETURN v;
END
$function$;
REVOKE ALL ON FUNCTION public.admin_banner_measured_stats_v1() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_banner_measured_stats_v1() TO authenticated, service_role;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pgadmin') THEN
    ALTER FUNCTION public.admin_banner_measured_stats_v1() OWNER TO pgadmin;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
