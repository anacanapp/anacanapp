-- QayğıCash: the wallet also returns the fixed base the store Premium bonus is computed on
-- (cashback_rules.fixed_base_minor), so the paywall's "+x ₼" line follows the admin setting.
-- Only qaygicash_wallet_v1 changes (function body); no relation changes.
BEGIN;
SET LOCAL lock_timeout = '5s';
CREATE OR REPLACE FUNCTION public.qaygicash_wallet_v1() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_uid uuid := auth.uid(); w public.cashback_wallets; prog public.cashback_programs; v_country text;
  v_avail bigint; v_pend bigint; v_soon bigint; v_next timestamptz; v_rates jsonb; v_bases jsonb; cfg jsonb;
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
  SELECT coalesce(jsonb_object_agg(replace(channel, 'premium_', ''), fixed_base_minor), '{}'::jsonb) INTO v_bases
    FROM public.cashback_rules WHERE country = prog.country AND channel IN ('premium_yearly', 'premium_monthly') AND fixed_base_minor IS NOT NULL;
  cfg := prog.premium_redeem;
  RETURN jsonb_build_object(
    'enabled', true, 'status', prog.status, 'country', prog.country, 'currency', prog.currency,
    'available_minor', v_avail, 'pending_minor', v_pend, 'expiring_30d_minor', v_soon, 'next_expiry_at', v_next,
    'debt_minor', coalesce(w.debt_minor, 0), 'rates', v_rates, 'premium_base_minor', v_bases,
    'hold_days_physical', prog.hold_days_physical, 'hold_days_digital', prog.hold_days_digital,
    'expiry_months', prog.expiry_months, 'max_redeem_pct', prog.max_redeem_pct, 'min_redeem_minor', prog.min_redeem_minor,
    'redeem_channels', to_jsonb(prog.redeem_channels), 'terms_version', prog.terms_version,
    'premium_redeem', jsonb_build_object(
      'enabled', prog.status = 'live' AND coalesce((cfg->>'enabled')::boolean, false),
      'monthly', jsonb_build_object('enabled', coalesce((cfg->'monthly'->>'enabled')::boolean, false), 'price_minor', (cfg->'monthly'->>'price_minor')::bigint),
      'yearly', jsonb_build_object('enabled', coalesce((cfg->'yearly'->>'enabled')::boolean, false), 'price_minor', (cfg->'yearly'->>'price_minor')::bigint),
      'platforms', coalesce(cfg->'platforms', '{}'::jsonb)));
END $$;
REVOKE ALL ON FUNCTION public.qaygicash_wallet_v1() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.qaygicash_wallet_v1() TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
