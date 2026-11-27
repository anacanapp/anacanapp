-- QayğıCash Premium money-leak guard: qc_premium_mark_pending (migration 20261126140000).
-- Verifies that pinning a still-reserved Premium bonus clears its hold so the 15-minute stale sweep can no longer
-- release it (the bonus is NOT handed back while Premium stays granted), that a plain stale reserved order is still
-- released, idempotency, that a committed order is left alone, NOT-FOUND is a no-op, and grants. Depends on
-- 20261106150000 and 20261126140000. Runs in one transaction and rolls back. Prints QC_PREMIUM_RECONCILE_OK.
BEGIN;
SET LOCAL client_min_messages = warning;

DO $$
DECLARE
  u uuid := gen_random_uuid();
  pin text := 'pin-' || gen_random_uuid()::text;
  ctl text := 'ctl-' || gen_random_uuid()::text;
  cmt text := 'cmt-' || gen_random_uuid()::text;
  s text; ru timestamptz; n int;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (u, 'qcr@x.az');

  -- A granted-but-uncommitted Premium reservation whose 15-minute hold has already lapsed, plus a plain stale
  -- reservation (the control), both with empty allocations so qc_release touches no lots.
  INSERT INTO public.cashback_redemptions (user_id, order_type, order_id, amount_minor, status, allocations, reserved_until, note)
  VALUES (u, 'premium', pin, 500, 'reserved', '[]'::jsonb, now() - interval '1 min', 'monthly:ios'),
         (u, 'premium', ctl, 300, 'reserved', '[]'::jsonb, now() - interval '1 min', 'monthly:ios'),
         (u, 'premium', cmt, 400, 'committed', '[]'::jsonb, NULL, 'monthly:ios');

  -- Pin the granted order.
  PERFORM public.qc_premium_mark_pending(pin, 'reconcile: rc promo monthly granted, finish failed');
  SELECT status, reserved_until INTO s, ru FROM public.cashback_redemptions WHERE order_type = 'premium' AND order_id = pin;
  IF s <> 'reserved' OR ru IS NOT NULL THEN RAISE EXCEPTION 'T1 pin did not clear the hold: status=% reserved_until=%', s, ru; END IF;

  -- The stale sweep must skip the pinned order but release the plain stale one.
  PERFORM public.qc_release_stale(u);
  SELECT status INTO s FROM public.cashback_redemptions WHERE order_type = 'premium' AND order_id = pin;
  IF s <> 'reserved' THEN RAISE EXCEPTION 'T2 pinned bonus was released by stale sweep: %', s; END IF;
  SELECT status INTO s FROM public.cashback_redemptions WHERE order_type = 'premium' AND order_id = ctl;
  IF s <> 'released' THEN RAISE EXCEPTION 'T3 control stale order was not released: %', s; END IF;

  -- A reconciliation row is logged for follow-up.
  SELECT count(*) INTO n FROM public.cashback_admin_log WHERE action = 'premium_reconcile_pending' AND target = pin;
  IF n < 1 THEN RAISE EXCEPTION 'T4 no reconcile log row'; END IF;

  -- Idempotent: pinning again keeps it reserved with no hold.
  PERFORM public.qc_premium_mark_pending(pin, 'again');
  SELECT status, reserved_until INTO s, ru FROM public.cashback_redemptions WHERE order_type = 'premium' AND order_id = pin;
  IF s <> 'reserved' OR ru IS NOT NULL THEN RAISE EXCEPTION 'T5 not idempotent: status=% reserved_until=%', s, ru; END IF;

  -- A committed order is left exactly as it is (no status/hold change).
  PERFORM public.qc_premium_mark_pending(cmt, 'should not change');
  SELECT status, reserved_until INTO s, ru FROM public.cashback_redemptions WHERE order_type = 'premium' AND order_id = cmt;
  IF s <> 'committed' OR ru IS NOT NULL THEN RAISE EXCEPTION 'T6 committed order changed: status=% reserved_until=%', s, ru; END IF;

  -- Unknown order: a no-op, no new reservation.
  PERFORM public.qc_premium_mark_pending('does-not-exist', 'noop');
  SELECT count(*) INTO n FROM public.cashback_redemptions WHERE order_id = 'does-not-exist';
  IF n <> 0 THEN RAISE EXCEPTION 'T7 unknown order created a row'; END IF;

  -- Grants: service_role only.
  IF has_function_privilege('anon', 'public.qc_premium_mark_pending(text,text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.qc_premium_mark_pending(text,text)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.qc_premium_mark_pending(text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'T8 grants';
  END IF;

  RAISE WARNING 'QC_PREMIUM_RECONCILE_OK';
END $$;

ROLLBACK;
