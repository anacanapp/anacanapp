-- Partner sales tracking (owner 2026-11-17): measure every sale that a partner store (Olivia first) gets from Anacan,
-- also when the order is placed on the partner's own website or app (cooperation model V2).
--
-- Flow
--   1. The app opens the partner page with ?anacan_click=<token>. The token is random, made on the device, and
--      registered here by shop_partner_click_v1 (who, which product, which placement).
--   2. The Anacan tracking script (public/sdk/anacan-partner.js) on the partner site keeps the token in a first-party
--      cookie for the attribution window and reports the order from the thank-you page ("pixel"), and/or the partner's
--      server reports order creation and status changes with its secret key ("server", the reliable path).
--   3. The partner-conversion edge function hands the report to shop_partner_conversion_v1 (service_role only), which
--      checks the key, the secret or the page origin, the click (same partner, inside the window) or an Anacan
--      coupon, and stores one row per partner order. Orders without an Anacan click or coupon are not stored.
--   4. The partner panel shows clicks, orders, statuses and the commission; partners can also set a status by hand.
--
-- Relations (CDC + writer guard, RLS on, no client grants):
--   shop_partner_clicks   one row per outbound click token
--   shop_partner_orders   one row per attributed partner order (unique per partner + external order id)
-- shop_partners gains tracking_key (public), tracking_secret_hash (sha256 of the secret; the secret is shown once),
-- tracking_secret_set_at, attribution_days (default 30) and tracking_coupons (Anacan promo codes at the partner).
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

DO $$
BEGIN
  IF to_regclass('_anacan_gcp_migration.guarded_relations') IS NULL THEN RAISE EXCEPTION 'PARTNER_TRACKING_GUARD_CATALOG_MISSING'; END IF;
  IF to_regclass('public.shop_partners') IS NULL THEN RAISE EXCEPTION 'PARTNER_TRACKING_NEEDS_SHOP_PARTNERS'; END IF;
END $$;

ALTER TABLE public.shop_partners ADD COLUMN IF NOT EXISTS tracking_key text UNIQUE CHECK (tracking_key IS NULL OR tracking_key ~ '^pk_[a-f0-9]{32}$');
ALTER TABLE public.shop_partners ADD COLUMN IF NOT EXISTS tracking_secret_hash text CHECK (tracking_secret_hash IS NULL OR tracking_secret_hash ~ '^[a-f0-9]{64}$');
ALTER TABLE public.shop_partners ADD COLUMN IF NOT EXISTS tracking_secret_set_at timestamptz;
ALTER TABLE public.shop_partners ADD COLUMN IF NOT EXISTS attribution_days integer NOT NULL DEFAULT 30 CHECK (attribution_days BETWEEN 1 AND 90);
ALTER TABLE public.shop_partners ADD COLUMN IF NOT EXISTS tracking_coupons text[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS public.shop_partner_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE CHECK (token ~ '^[A-Za-z0-9_-]{20,64}$'),
  partner_id uuid NOT NULL REFERENCES public.shop_partners(id) ON DELETE CASCADE,
  product_id uuid,
  user_id uuid NOT NULL,
  placement text NOT NULL DEFAULT 'shop' CHECK (length(placement) <= 40),
  internal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shop_partner_clicks_partner_idx ON public.shop_partner_clicks (partner_id, created_at);
CREATE INDEX IF NOT EXISTS shop_partner_clicks_user_idx ON public.shop_partner_clicks (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.shop_partner_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.shop_partners(id) ON DELETE CASCADE,
  external_order_id text NOT NULL CHECK (external_order_id ~ '^[A-Za-z0-9._:#/-]{1,100}$'),
  click_id uuid REFERENCES public.shop_partner_clicks(id) ON DELETE SET NULL,
  coupon text CHECK (coupon IS NULL OR length(coupon) <= 40),
  user_id uuid,
  amount numeric(12,2) NOT NULL CHECK (amount >= 0 AND amount <= 1000000),
  currency text NOT NULL DEFAULT 'AZN' CHECK (currency ~ '^[A-Z]{3}$'),
  items jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(items) = 'array'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'delivered', 'cancelled', 'returned')),
  commission_pct numeric(5,2) CHECK (commission_pct IS NULL OR commission_pct BETWEEN 0 AND 100),
  source text NOT NULL CHECK (source IN ('pixel', 'server', 'manual')),
  verified boolean NOT NULL DEFAULT false,
  test boolean NOT NULL DEFAULT false,
  ordered_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (partner_id, external_order_id)
);
CREATE INDEX IF NOT EXISTS shop_partner_orders_partner_idx ON public.shop_partner_orders (partner_id, ordered_at);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['shop_partner_clicks', 'shop_partner_orders'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    INSERT INTO _anacan_gcp_migration.guarded_relations (schema_name, table_name, primary_key) VALUES ('public', t, ARRAY['id']) ON CONFLICT DO NOTHING;
    EXECUTE format('DROP TRIGGER IF EXISTS anacan_gcp_writer_guard ON public.%I', t);
    EXECUTE format('DROP TRIGGER IF EXISTS anacan_gcp_change ON public.%I', t);
    EXECUTE format('DROP TRIGGER IF EXISTS anacan_gcp_truncate ON public.%I', t);
    EXECUTE format('CREATE TRIGGER anacan_gcp_writer_guard BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION _anacan_gcp_migration.guard_write()', t);
    EXECUTE format('CREATE TRIGGER anacan_gcp_change AFTER INSERT OR DELETE OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION _anacan_gcp_migration.capture_change()', t);
    EXECUTE format('CREATE TRIGGER anacan_gcp_truncate AFTER TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION _anacan_gcp_migration.capture_change()', t);
  END LOOP;
END $$;

-- Host of an https URL or Origin header, lower-case, without "www.". NULL when it is not one.
CREATE OR REPLACE FUNCTION public._shop_partner_host(p_url text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = pg_catalog AS $$
  SELECT nullif(regexp_replace(lower(substring(coalesce(p_url, '') FROM '^https://([^/:?#]+)')), '^www\.', ''), '')
$$;

CREATE OR REPLACE FUNCTION public._shop_partner_new_key()
RETURNS text LANGUAGE sql VOLATILE SET search_path = pg_catalog, public AS $$
  SELECT 'pk_' || replace(gen_random_uuid()::text, '-', '')
$$;

-- ───────────── app: register an outbound click ─────────────
CREATE OR REPLACE FUNCTION public.shop_partner_click_v1(p_product uuid, p_token text, p_placement text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE uid uuid := auth.uid(); pid uuid; pstatus text; is_internal boolean;
  place text := left(coalesce(nullif(regexp_replace(lower(coalesce(p_placement, '')), '[^a-z0-9_:-]', '', 'g'), ''), 'shop'), 40);
BEGIN
  IF uid IS NULL OR p_product IS NULL OR p_token IS NULL OR p_token !~ '^[A-Za-z0-9_-]{20,64}$' THEN RETURN false; END IF;
  SELECT pr.partner_id, sp.status INTO pid, pstatus FROM public.products pr JOIN public.shop_partners sp ON sp.id = pr.partner_id WHERE pr.id = p_product;
  IF pid IS NULL THEN RETURN false; END IF;
  is_internal := public.has_role(uid, 'admin'::public.app_role) OR EXISTS (SELECT 1 FROM public.shop_partner_members m WHERE m.partner_id = pid AND m.user_id = uid);
  IF pstatus <> 'live' AND NOT is_internal THEN RETURN false; END IF;
  IF (SELECT count(*) FROM public.shop_partner_clicks c WHERE c.user_id = uid AND c.created_at > now() - interval '1 hour') >= 120 THEN RETURN false; END IF;
  INSERT INTO public.shop_partner_clicks (token, partner_id, product_id, user_id, placement, internal)
    VALUES (p_token, pid, p_product, uid, place, is_internal) ON CONFLICT (token) DO NOTHING;
  RETURN FOUND;
END $$;

-- ───────────── partner site / server: report an order (service_role only, via the partner-conversion function) ─────────────
-- p_secret_sha256: sha256 hex of the bearer secret (NULL for the browser pixel). p_origin: the browser Origin header.
CREATE OR REPLACE FUNCTION public.shop_partner_conversion_v1(p_key text, p_secret_sha256 text, p_origin text, p_order jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE p public.shop_partners%ROWTYPE; is_server boolean; ext text; v_amount numeric; v_currency text; v_items jsonb; v_status text;
  v_click text; v_coupon text; v_test boolean; v_at timestamptz; c public.shop_partner_clicks%ROWTYPE; v_by text; cur public.shop_partner_orders%ROWTYPE;
  oid uuid; site text; org text;
BEGIN
  IF p_key IS NULL OR p_key !~ '^pk_[a-f0-9]{32}$' THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid_key'); END IF;
  SELECT * INTO p FROM public.shop_partners WHERE tracking_key = p_key;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'unknown_key'); END IF;
  IF p.status = 'paused' THEN RETURN jsonb_build_object('ok', false, 'error', 'partner_paused'); END IF;
  is_server := p_secret_sha256 IS NOT NULL;
  IF is_server AND (p.tracking_secret_hash IS NULL OR p_secret_sha256 IS DISTINCT FROM p.tracking_secret_hash) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_secret');
  END IF;
  IF NOT is_server THEN
    site := public._shop_partner_host(p.website_url); org := public._shop_partner_host(p_origin);
    IF site IS NULL OR org IS NULL OR NOT (org = site OR org LIKE '%.' || site) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'origin_not_allowed');
    END IF;
  END IF;
  IF p_order IS NULL OR jsonb_typeof(p_order) <> 'object' THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid_order'); END IF;

  ext := btrim(coalesce(p_order->>'order_id', ''));
  IF ext !~ '^[A-Za-z0-9._:#/-]{1,100}$' THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid_order_id'); END IF;
  BEGIN
    v_amount := round((p_order->>'total')::numeric, 2);
    v_at := coalesce((p_order->>'ordered_at')::timestamptz, now());
    v_test := coalesce((p_order->>'test')::boolean, false);
  EXCEPTION WHEN others THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid_number');
  END;
  IF v_amount IS NULL OR v_amount < 0 OR v_amount > 1000000 THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid_total'); END IF;
  IF v_at > now() + interval '1 day' OR v_at < now() - interval '400 days' THEN v_at := now(); END IF;
  v_currency := upper(coalesce(nullif(p_order->>'currency', ''), 'AZN'));
  IF v_currency !~ '^[A-Z]{3}$' THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid_currency'); END IF;
  v_items := coalesce(p_order->'items', '[]'::jsonb);
  IF jsonb_typeof(v_items) <> 'array' THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid_items'); END IF;
  -- keep only the known item fields, at most 50 lines
  SELECT coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'sku', left(i->>'sku', 64), 'name', left(i->>'name', 160),
      'quantity', CASE WHEN (i->>'quantity') ~ '^[0-9]{1,5}$' THEN (i->>'quantity')::int END,
      'price', CASE WHEN (i->>'price') ~ '^[0-9]{1,7}(\.[0-9]{1,4})?$' THEN round((i->>'price')::numeric, 2) END))), '[]'::jsonb)
    INTO v_items FROM (SELECT x AS i FROM jsonb_array_elements(v_items) x WHERE jsonb_typeof(x) = 'object' LIMIT 50) s;
  v_status := lower(coalesce(nullif(p_order->>'status', ''), 'pending'));
  IF v_status NOT IN ('pending', 'confirmed', 'delivered', 'cancelled', 'returned') THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid_status'); END IF;
  IF NOT is_server THEN v_status := 'pending'; END IF;
  v_click := nullif(btrim(coalesce(p_order->>'click', '')), '');
  v_coupon := upper(nullif(btrim(coalesce(p_order->>'coupon', '')), ''));

  SELECT * INTO cur FROM public.shop_partner_orders WHERE partner_id = p.id AND external_order_id = ext FOR UPDATE;
  IF FOUND THEN
    IF NOT is_server THEN RETURN jsonb_build_object('ok', true, 'duplicate', true, 'order', cur.id, 'status', cur.status); END IF;
    UPDATE public.shop_partner_orders SET amount = v_amount, currency = v_currency,
        items = CASE WHEN jsonb_array_length(v_items) > 0 THEN v_items ELSE items END,
        status = v_status, source = 'server', verified = true, updated_at = now()
      WHERE id = cur.id;
    RETURN jsonb_build_object('ok', true, 'updated', true, 'order', cur.id, 'status', v_status);
  END IF;

  IF v_click IS NOT NULL AND v_click ~ '^[A-Za-z0-9_-]{20,64}$' THEN
    SELECT * INTO c FROM public.shop_partner_clicks
      WHERE token = v_click AND partner_id = p.id AND created_at > v_at - make_interval(days => p.attribution_days) AND created_at <= v_at + interval '1 hour';
    IF FOUND THEN v_by := 'click'; END IF;
  END IF;
  IF v_by IS NULL AND v_coupon IS NOT NULL AND v_coupon = ANY (p.tracking_coupons) THEN v_by := 'coupon'; END IF;
  IF v_by IS NULL THEN RETURN jsonb_build_object('ok', true, 'attributed', false); END IF;

  INSERT INTO public.shop_partner_orders (partner_id, external_order_id, click_id, coupon, user_id, amount, currency, items, status,
      commission_pct, source, verified, test, ordered_at)
    VALUES (p.id, ext, CASE WHEN v_by = 'click' THEN c.id END, v_coupon, CASE WHEN v_by = 'click' THEN c.user_id END, v_amount, v_currency, v_items,
      v_status, p.commission_pct, CASE WHEN is_server THEN 'server' ELSE 'pixel' END, is_server, v_test OR coalesce(c.internal, false), v_at)
    RETURNING id INTO oid;
  RETURN jsonb_build_object('ok', true, 'attributed', true, 'by', v_by, 'order', oid, 'status', v_status);
END $$;

-- ───────────── partner panel ─────────────
CREATE OR REPLACE FUNCTION public.shop_partner_tracking_v1(p_partner uuid, p_from date, p_to date, p_test boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE t date := least(coalesce(p_to, (now() AT TIME ZONE 'Asia/Baku')::date), (now() AT TIME ZONE 'Asia/Baku')::date);
  f date; t0 timestamptz; t1 timestamptz; p public.shop_partners%ROWTYPE; r text;
BEGIN
  r := public._shop_partner_need(p_partner, 'viewer');
  SELECT * INTO p FROM public.shop_partners WHERE id = p_partner;
  IF p.tracking_key IS NULL AND r IN ('admin', 'owner') THEN
    UPDATE public.shop_partners SET tracking_key = public._shop_partner_new_key(), updated_at = now() WHERE id = p_partner RETURNING * INTO p;
  END IF;
  f := greatest(coalesce(p_from, t - 29), t - 365);
  IF f > t THEN f := t; END IF;
  t0 := f::timestamp AT TIME ZONE 'Asia/Baku'; t1 := (t + 1)::timestamp AT TIME ZONE 'Asia/Baku';
  RETURN (
    WITH o AS (
      SELECT * FROM public.shop_partner_orders WHERE partner_id = p_partner AND ordered_at >= t0 AND ordered_at < t1 AND test = coalesce(p_test, false)
    ), cl AS (
      SELECT * FROM public.shop_partner_clicks WHERE partner_id = p_partner AND created_at >= t0 AND created_at < t1 AND internal = coalesce(p_test, false)
    )
    SELECT jsonb_build_object(
      'from', f, 'to', t, 'test', coalesce(p_test, false),
      'key', p.tracking_key, 'has_secret', p.tracking_secret_hash IS NOT NULL, 'secret_set_at', p.tracking_secret_set_at,
      'attribution_days', p.attribution_days, 'coupons', to_jsonb(p.tracking_coupons), 'website_url', p.website_url,
      'commission_pct', p.commission_pct,
      'last_order_at', (SELECT max(updated_at) FROM public.shop_partner_orders WHERE partner_id = p_partner),
      'last_pixel_at', (SELECT max(created_at) FROM public.shop_partner_orders WHERE partner_id = p_partner AND source = 'pixel'),
      'last_server_at', (SELECT max(updated_at) FROM public.shop_partner_orders WHERE partner_id = p_partner AND verified),
      'summary', (SELECT jsonb_build_object(
          'clicks', (SELECT count(*) FROM cl),
          'orders', count(*), 'amount', coalesce(sum(amount), 0),
          'pending', count(*) FILTER (WHERE status = 'pending'), 'confirmed', count(*) FILTER (WHERE status = 'confirmed'),
          'delivered', count(*) FILTER (WHERE status = 'delivered'), 'cancelled', count(*) FILTER (WHERE status = 'cancelled'),
          'returned', count(*) FILTER (WHERE status = 'returned'),
          'payable_amount', coalesce(sum(amount) FILTER (WHERE status IN ('confirmed', 'delivered')), 0),
          'commission', coalesce(round(sum(amount * coalesce(commission_pct, 0) / 100) FILTER (WHERE status IN ('confirmed', 'delivered')), 2), 0),
          'expected_commission', coalesce(round(sum(amount * coalesce(commission_pct, 0) / 100) FILTER (WHERE status IN ('pending', 'confirmed', 'delivered')), 2), 0),
          'by_click', count(*) FILTER (WHERE click_id IS NOT NULL), 'by_coupon', count(*) FILTER (WHERE click_id IS NULL),
          'verified', count(*) FILTER (WHERE verified)) FROM o),
      'orders', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'order_id', o.external_order_id, 'amount', o.amount, 'currency', o.currency,
            'status', o.status, 'source', o.source, 'verified', o.verified, 'by', CASE WHEN o.click_id IS NOT NULL THEN 'click' ELSE 'coupon' END,
            'coupon', o.coupon, 'items', o.items, 'commission', round(o.amount * coalesce(o.commission_pct, 0) / 100, 2),
            'product_name', pr.name, 'placement', c.placement, 'ordered_at', o.ordered_at, 'updated_at', o.updated_at)
            ORDER BY o.ordered_at DESC), '[]'::jsonb)
          FROM (SELECT * FROM o ORDER BY ordered_at DESC LIMIT 300) o
          LEFT JOIN public.shop_partner_clicks c ON c.id = o.click_id LEFT JOIN public.products pr ON pr.id = c.product_id)
    )
  );
END $$;

-- New server secret (owner/admin). The secret is returned once; only its sha256 is kept.
CREATE OR REPLACE FUNCTION public.shop_partner_tracking_secret_v1(p_partner uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE secret text := 'sk_' || replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''); k text;
BEGIN
  PERFORM public._shop_partner_need(p_partner, 'owner');
  UPDATE public.shop_partners SET tracking_key = coalesce(tracking_key, public._shop_partner_new_key()),
      tracking_secret_hash = encode(sha256(convert_to(secret, 'UTF8')), 'hex'), tracking_secret_set_at = now(), updated_at = now()
    WHERE id = p_partner RETURNING tracking_key INTO k;
  PERFORM public._shop_partner_log(p_partner, 'tracking_secret', NULL, '{}'::jsonb);
  RETURN jsonb_build_object('key', k, 'secret', secret);
END $$;

-- Coupons (owner/admin) and attribution window (admin, it is a contract term).
CREATE OR REPLACE FUNCTION public.shop_partner_tracking_settings_v1(p_partner uuid, p_data jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE r text := public._shop_partner_need(p_partner, 'owner'); codes text[]; days integer;
BEGIN
  IF p_data ? 'coupons' THEN
    IF jsonb_typeof(p_data->'coupons') <> 'array' THEN RAISE EXCEPTION 'TRACKING_COUPONS' USING ERRCODE = '22023'; END IF;
    SELECT coalesce(array_agg(DISTINCT upper(btrim(x))), '{}') INTO codes FROM jsonb_array_elements_text(p_data->'coupons') x WHERE btrim(x) <> '';
    IF cardinality(codes) > 20 OR EXISTS (SELECT 1 FROM unnest(codes) z WHERE z !~ '^[A-Z0-9_-]{3,40}$') THEN
      RAISE EXCEPTION 'TRACKING_COUPONS' USING ERRCODE = '22023';
    END IF;
    UPDATE public.shop_partners SET tracking_coupons = codes, updated_at = now() WHERE id = p_partner;
  END IF;
  IF p_data ? 'attribution_days' THEN
    IF r <> 'admin' THEN RAISE EXCEPTION 'ADMIN_ONLY' USING ERRCODE = '42501'; END IF;
    BEGIN days := (p_data->>'attribution_days')::integer; EXCEPTION WHEN others THEN days := NULL; END;
    IF days IS NULL OR days NOT BETWEEN 1 AND 90 THEN RAISE EXCEPTION 'TRACKING_DAYS' USING ERRCODE = '22023'; END IF;
    UPDATE public.shop_partners SET attribution_days = days, updated_at = now() WHERE id = p_partner;
  END IF;
  PERFORM public._shop_partner_log(p_partner, 'tracking_settings', NULL, p_data - 'secret');
END $$;

-- Status set by hand in the panel (for partners that do not report statuses from their server).
CREATE OR REPLACE FUNCTION public.shop_partner_order_status_v1(p_partner uuid, p_order uuid, p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  PERFORM public._shop_partner_need(p_partner, 'manager');
  IF p_status IS NULL OR p_status NOT IN ('pending', 'confirmed', 'delivered', 'cancelled', 'returned') THEN RAISE EXCEPTION 'ORDER_STATUS' USING ERRCODE = '22023'; END IF;
  UPDATE public.shop_partner_orders SET status = p_status, updated_at = now() WHERE id = p_order AND partner_id = p_partner;
  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  PERFORM public._shop_partner_log(p_partner, 'order_status', p_order, jsonb_build_object('status', p_status));
END $$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['public._shop_partner_host(text)', 'public._shop_partner_new_key()',
      'public.shop_partner_click_v1(uuid, text, text)', 'public.shop_partner_conversion_v1(text, text, text, jsonb)',
      'public.shop_partner_tracking_v1(uuid, date, date, boolean)', 'public.shop_partner_tracking_secret_v1(uuid)',
      'public.shop_partner_tracking_settings_v1(uuid, jsonb)', 'public.shop_partner_order_status_v1(uuid, uuid, text)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
  FOREACH f IN ARRAY ARRAY['public.shop_partner_click_v1(uuid, text, text)', 'public.shop_partner_tracking_v1(uuid, date, date, boolean)',
      'public.shop_partner_tracking_secret_v1(uuid)', 'public.shop_partner_tracking_settings_v1(uuid, jsonb)',
      'public.shop_partner_order_status_v1(uuid, uuid, text)'] LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP;
END $$;

-- Every partner gets a public tracking key now (the secret is created by the owner in the panel).
UPDATE public.shop_partners SET tracking_key = public._shop_partner_new_key() WHERE tracking_key IS NULL;

DO $$
BEGIN
  IF (SELECT count(*) FROM _anacan_gcp_migration.guarded_relations WHERE schema_name = 'public' AND table_name IN ('shop_partner_clicks', 'shop_partner_orders')) <> 2
     OR (SELECT count(*) FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relname IN ('shop_partner_clicks', 'shop_partner_orders')
            AND tg.tgname IN ('anacan_gcp_writer_guard', 'anacan_gcp_change', 'anacan_gcp_truncate')) <> 6 THEN
    RAISE EXCEPTION 'PARTNER_TRACKING_GUARD_ENROLLMENT_INCOMPLETE';
  END IF;
  IF has_function_privilege('anon', 'public.shop_partner_conversion_v1(text, text, text, jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.shop_partner_conversion_v1(text, text, text, jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'PARTNER_TRACKING_CONVERSION_EXPOSED';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
