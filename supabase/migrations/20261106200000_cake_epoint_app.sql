-- In-app cake orders are paid only by card through Epoint (owner decision 2026-11-06: no cash, no card-to-card).
-- The cake-checkout function creates the order (channel 'app', payment_method 'epoint', server prices) and may
-- reserve QayğıCash for it; the shared Epoint callback commits the bonus when the card payment is confirmed and
-- cancels the order (which releases the bonus through qc_cake_status) when it fails. Functions only; no relation changes.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.qc_reserve_cake_epoint_v1(p_user uuid, p_order_id uuid, p_amount_minor bigint, p_total_minor bigint)
RETURNS bigint LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT public.qc_reserve(p_user, 'cake', p_order_id::text, p_amount_minor, p_total_minor, 60, false, 'app:cake-checkout') $$;

CREATE OR REPLACE FUNCTION public.qc_commit_cake_v1(p_order_id uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT public.qc_commit('cake', p_order_id::text, 'epoint:cake') $$;

REVOKE ALL ON FUNCTION public.qc_reserve_cake_epoint_v1(uuid, uuid, bigint, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.qc_commit_cake_v1(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.qc_reserve_cake_epoint_v1(uuid, uuid, bigint, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.qc_commit_cake_v1(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
