-- QayğıCash Premium money-leak fix: a helper to pin a Premium bonus reservation when the RevenueCat grant
-- succeeded but the commit (qc_premium_finish_v1) could not be recorded (audit Phase 2, finding #4).
--
-- The leak. qaygicash-premium reserves the bonus (status='reserved', reserved_until = now() + 15 min), grants the
-- RevenueCat promotional entitlement, then commits the bonus with qc_premium_finish_v1 -> qc_commit. If the RC
-- grant succeeds but all three finish attempts fail, the reservation stays 'reserved' and the 15-minute stale
-- sweep (qc_release_stale, which releases status='reserved' AND reserved_until < now()) hands the bonus back to
-- the user while Premium stays granted = free Premium + bonus kept.
--
-- The fix. qc_premium_mark_pending clears reserved_until on a still-reserved Premium order, so the stale sweep
-- (reserved_until IS NOT NULL AND reserved_until < now()) can never release it; the bonus stays taken (not handed
-- back) until an operator reconciles the order (commit it, or refund the Premium). It also writes a
-- cashback_admin_log row flagging the order for follow-up. It touches only existing relations
-- (cashback_redemptions, cashback_admin_log) exactly as the existing qc_* definer functions do — no new relation,
-- no schema change, no CDC/.cdc.json. Idempotent (CREATE OR REPLACE; re-running on an already-pinned order is a
-- no-op for reserved_until). Depends on 20261106150000. The happy path (finish succeeds) never calls this.
-- Apply with /home/anacan-runner/run-sql.py on anacan-gcp-candidate. Not applied by the author of this migration.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
BEGIN
  IF to_regclass('public.cashback_redemptions') IS NULL OR to_regclass('public.cashback_admin_log') IS NULL
     OR to_regprocedure('public.qc_release_stale(uuid)') IS NULL THEN
    RAISE EXCEPTION 'QC_PREMIUM_RECONCILE_DEPENDENCY_MISSING: apply 20261106150000 first';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.qc_premium_mark_pending(p_order_id text, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE r public.cashback_redemptions;
BEGIN
  SELECT * INTO r FROM public.cashback_redemptions
    WHERE order_type = 'premium' AND order_id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  -- Only a still-reserved order is at risk of being handed back by qc_release_stale. Clearing the hold leaves the
  -- bonus taken (status stays 'reserved', allocations untouched) and immune to the stale sweep until it is
  -- reconciled. A committed / already-released order is left as it is.
  IF r.status = 'reserved' THEN
    UPDATE public.cashback_redemptions
       SET reserved_until = NULL,
           note = left(coalesce(p_note, note), 200),
           updated_at = now()
     WHERE id = r.id;
  END IF;

  INSERT INTO public.cashback_admin_log (admin_id, action, target, detail)
  VALUES (NULL, 'premium_reconcile_pending', p_order_id,
          jsonb_build_object('user_id', r.user_id, 'amount_minor', r.amount_minor,
                             'status', r.status, 'note', left(coalesce(p_note, ''), 200)));
END $$;

REVOKE ALL ON FUNCTION public.qc_premium_mark_pending(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.qc_premium_mark_pending(text, text) TO service_role;

COMMIT;
