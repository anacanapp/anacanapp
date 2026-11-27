-- Partner sales tracking: clicks, pixel and server reports, attribution, isolation and grants.
-- Runs in one transaction and rolls back. Prints PARTNER_TRACKING_OK when every check passes.
BEGIN;
SET LOCAL client_min_messages = warning;

DO $$
DECLARE
  u_admin uuid := gen_random_uuid(); u_owner uuid := gen_random_uuid(); u_viewer uuid := gen_random_uuid();
  u_mom uuid := gen_random_uuid(); u_out uuid := gen_random_uuid();
  pa uuid; pb uuid; prod uuid; prod_b uuid; key_a text; key_b text; secret text; sh text; r jsonb; ord uuid; n int;
  tok text := 'tokA_' || replace(gen_random_uuid()::text, '-', '');
  tok_old text := 'tokO_' || replace(gen_random_uuid()::text, '-', '');
  tok_b text := 'tokB_' || replace(gen_random_uuid()::text, '-', '');
BEGIN
  INSERT INTO auth.users (id, email) VALUES (u_admin, 'a@x.az'), (u_owner, 'o@x.az'), (u_viewer, 'v@x.az'), (u_mom, 'm@x.az'), (u_out, 'x@x.az');
  INSERT INTO public.user_roles (user_id, role) VALUES (u_admin, 'admin');
  INSERT INTO public.shop_partners (slug, name, website_url, status, commission_pct) VALUES ('trk-a', 'Track A', 'https://olivia.az', 'live', 7) RETURNING id INTO pa;
  INSERT INTO public.shop_partners (slug, name, website_url, status, commission_pct) VALUES ('trk-b', 'Track B', 'https://other.az', 'live', 5) RETURNING id INTO pb;
  INSERT INTO public.shop_partner_members (partner_id, user_id, role) VALUES (pa, u_owner, 'owner'), (pa, u_viewer, 'viewer');
  INSERT INTO public.products (name, category, store, price, is_active, partner_id) VALUES ('Siveno gel', 'olivia', 'olivia', 15.99, false, pa) RETURNING id INTO prod;
  INSERT INTO public.products (name, category, store, price, is_active, partner_id) VALUES ('Other', 'x', 'x', 3, false, pb) RETURNING id INTO prod_b;
  UPDATE public.shop_partners SET tracking_key = public._shop_partner_new_key() WHERE id IN (pa, pb);
  SELECT tracking_key INTO key_a FROM public.shop_partners WHERE id = pa;
  SELECT tracking_key INTO key_b FROM public.shop_partners WHERE id = pb;

  -- clicks from the app
  PERFORM set_config('request.jwt.claim.sub', u_mom::text, true);
  IF NOT public.shop_partner_click_v1(prod, tok, 'shop_baby') THEN RAISE EXCEPTION 'T1 click not stored'; END IF;
  IF public.shop_partner_click_v1(prod, 'bad token!', 'shop') THEN RAISE EXCEPTION 'T2 bad token stored'; END IF;
  IF public.shop_partner_click_v1(prod, tok, 'shop') THEN RAISE EXCEPTION 'T3 duplicate token stored twice'; END IF;
  PERFORM public.shop_partner_click_v1(prod, tok_old, 'shop');
  UPDATE public.shop_partner_clicks SET created_at = now() - interval '45 days' WHERE token = tok_old;
  PERFORM public.shop_partner_click_v1(prod_b, tok_b, 'shop');
  PERFORM set_config('request.jwt.claim.sub', '', true);
  IF public.shop_partner_click_v1(prod, 'anon_' || replace(gen_random_uuid()::text, '-', ''), 'shop') THEN RAISE EXCEPTION 'T4 anonymous click stored'; END IF;

  -- browser pixel
  r := public.shop_partner_conversion_v1(key_a, NULL, 'https://www.olivia.az', jsonb_build_object('order_id', 'OL-1001', 'total', 31.98, 'click', tok,
        'items', jsonb_build_array(jsonb_build_object('sku', '00-10023595', 'name', 'Siveno', 'quantity', 2, 'price', 15.99), 'junk'), 'status', 'delivered'));
  IF NOT (r->>'attributed')::boolean OR r->>'by' <> 'click' OR r->>'status' <> 'pending' THEN RAISE EXCEPTION 'T5 pixel: %', r; END IF;
  ord := (r->>'order')::uuid;
  IF (SELECT jsonb_array_length(items) FROM public.shop_partner_orders WHERE id = ord) <> 1 THEN RAISE EXCEPTION 'T6 item filter'; END IF;
  IF (SELECT user_id FROM public.shop_partner_orders WHERE id = ord) <> u_mom THEN RAISE EXCEPTION 'T7 user link'; END IF;
  r := public.shop_partner_conversion_v1(key_a, NULL, 'https://olivia.az', jsonb_build_object('order_id', 'OL-1001', 'total', 1, 'click', tok));
  IF NOT coalesce((r->>'duplicate')::boolean, false) OR (SELECT amount FROM public.shop_partner_orders WHERE id = ord) <> 31.98 THEN RAISE EXCEPTION 'T8 pixel overwrite: %', r; END IF;
  r := public.shop_partner_conversion_v1(key_a, NULL, 'https://evil-olivia.az', jsonb_build_object('order_id', 'OL-1002', 'total', 5, 'click', tok));
  IF r->>'error' <> 'origin_not_allowed' THEN RAISE EXCEPTION 'T9 origin: %', r; END IF;
  r := public.shop_partner_conversion_v1(key_a, NULL, NULL, jsonb_build_object('order_id', 'OL-1003', 'total', 5, 'click', tok));
  IF r->>'error' <> 'origin_not_allowed' THEN RAISE EXCEPTION 'T10 no origin: %', r; END IF;
  r := public.shop_partner_conversion_v1('pk_' || repeat('0', 32), NULL, 'https://olivia.az', '{}'::jsonb);
  IF r->>'error' <> 'unknown_key' THEN RAISE EXCEPTION 'T11 key: %', r; END IF;

  -- attribution rules
  r := public.shop_partner_conversion_v1(key_a, NULL, 'https://olivia.az', jsonb_build_object('order_id', 'OL-2000', 'total', 9));
  IF (r->>'attributed')::boolean OR EXISTS (SELECT 1 FROM public.shop_partner_orders WHERE external_order_id = 'OL-2000') THEN RAISE EXCEPTION 'T12 unattributed stored'; END IF;
  r := public.shop_partner_conversion_v1(key_a, NULL, 'https://olivia.az', jsonb_build_object('order_id', 'OL-2001', 'total', 9, 'click', tok_old));
  IF (r->>'attributed')::boolean THEN RAISE EXCEPTION 'T13 click outside window attributed'; END IF;
  r := public.shop_partner_conversion_v1(key_a, NULL, 'https://olivia.az', jsonb_build_object('order_id', 'OL-2002', 'total', 9, 'click', tok_b));
  IF (r->>'attributed')::boolean THEN RAISE EXCEPTION 'T14 other partner click attributed'; END IF;

  -- server reports need the secret
  r := public.shop_partner_conversion_v1(key_a, repeat('a', 64), NULL, jsonb_build_object('order_id', 'OL-1001', 'total', 31.98, 'status', 'delivered'));
  IF r->>'error' <> 'invalid_secret' THEN RAISE EXCEPTION 'T15 secret before set: %', r; END IF;
  PERFORM set_config('request.jwt.claim.sub', u_viewer::text, true);
  BEGIN PERFORM public.shop_partner_tracking_secret_v1(pa); RAISE EXCEPTION 'T16 viewer made a secret';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  PERFORM set_config('request.jwt.claim.sub', u_owner::text, true);
  r := public.shop_partner_tracking_secret_v1(pa);
  secret := r->>'secret';
  IF secret !~ '^sk_[a-f0-9]{64}$' OR r->>'key' <> key_a THEN RAISE EXCEPTION 'T17 secret: %', r; END IF;
  IF EXISTS (SELECT 1 FROM public.shop_partners WHERE id = pa AND tracking_secret_hash = secret) THEN RAISE EXCEPTION 'T18 raw secret stored'; END IF;
  sh := encode(sha256(convert_to(secret, 'UTF8')), 'hex');
  r := public.shop_partner_conversion_v1(key_a, sh, NULL, jsonb_build_object('order_id', 'OL-1001', 'total', 31.98, 'status', 'delivered'));
  IF NOT coalesce((r->>'updated')::boolean, false) THEN RAISE EXCEPTION 'T19 server update: %', r; END IF;
  IF (SELECT status || source || verified::text FROM public.shop_partner_orders WHERE id = ord) <> 'deliveredservertrue' THEN RAISE EXCEPTION 'T20 status'; END IF;
  r := public.shop_partner_conversion_v1(key_b, sh, NULL, jsonb_build_object('order_id', 'OL-1001', 'total', 1, 'status', 'returned'));
  IF r->>'error' <> 'invalid_secret' THEN RAISE EXCEPTION 'T21 cross-partner secret: %', r; END IF;

  -- coupons
  r := public.shop_partner_conversion_v1(key_a, sh, NULL, jsonb_build_object('order_id', 'OL-3000', 'total', 20, 'coupon', 'anacan10'));
  IF (r->>'attributed')::boolean THEN RAISE EXCEPTION 'T22 unknown coupon attributed'; END IF;
  PERFORM public.shop_partner_tracking_settings_v1(pa, jsonb_build_object('coupons', jsonb_build_array('anacan10', ' Anacan10 ')));
  IF (SELECT tracking_coupons FROM public.shop_partners WHERE id = pa) <> ARRAY['ANACAN10'] THEN RAISE EXCEPTION 'T23 coupon normalise'; END IF;
  r := public.shop_partner_conversion_v1(key_a, sh, NULL, jsonb_build_object('order_id', 'OL-3001', 'total', 20, 'coupon', 'anacan10', 'status', 'confirmed'));
  IF r->>'by' <> 'coupon' THEN RAISE EXCEPTION 'T24 coupon: %', r; END IF;
  BEGIN PERFORM public.shop_partner_tracking_settings_v1(pa, '{"attribution_days": 60}'::jsonb); RAISE EXCEPTION 'T25 owner changed window';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  -- panel numbers: delivered 31.98 + confirmed 20 at 7 %
  r := public.shop_partner_tracking_v1(pa, NULL, NULL, false);
  IF (r->'summary'->>'orders')::int <> 2 OR (r->'summary'->>'commission')::numeric <> round((31.98 + 20) * 0.07, 2) OR (r->'summary'->>'clicks')::int < 1 THEN
    RAISE EXCEPTION 'T26 summary: %', r->'summary';
  END IF;
  IF jsonb_array_length(r->'orders') <> 2 OR r->>'key' <> key_a OR NOT (r->>'has_secret')::boolean THEN RAISE EXCEPTION 'T27 panel payload'; END IF;
  IF r::text LIKE '%' || secret || '%' OR r::text LIKE '%' || sh || '%' THEN RAISE EXCEPTION 'T28 secret leaked to panel'; END IF;

  -- manual status, roles and isolation
  PERFORM set_config('request.jwt.claim.sub', u_viewer::text, true);
  BEGIN PERFORM public.shop_partner_order_status_v1(pa, ord, 'returned'); RAISE EXCEPTION 'T29 viewer set status';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  PERFORM set_config('request.jwt.claim.sub', u_out::text, true);
  BEGIN PERFORM public.shop_partner_tracking_v1(pa, NULL, NULL, false); RAISE EXCEPTION 'T30 outsider read tracking';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  PERFORM set_config('request.jwt.claim.sub', u_owner::text, true);
  BEGIN PERFORM public.shop_partner_order_status_v1(pb, ord, 'returned'); RAISE EXCEPTION 'T31 owner touched another partner';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  PERFORM public.shop_partner_order_status_v1(pa, ord, 'returned');
  r := public.shop_partner_tracking_v1(pa, NULL, NULL, false);
  IF (r->'summary'->>'commission')::numeric <> round(20 * 0.07, 2) THEN RAISE EXCEPTION 'T32 returned still paid: %', r->'summary'; END IF;
  PERFORM set_config('request.jwt.claim.sub', u_admin::text, true);
  PERFORM public.shop_partner_tracking_settings_v1(pa, '{"attribution_days": 14}'::jsonb);
  IF (SELECT attribution_days FROM public.shop_partners WHERE id = pa) <> 14 THEN RAISE EXCEPTION 'T33 admin window'; END IF;

  -- grants
  IF has_function_privilege('authenticated', 'public.shop_partner_conversion_v1(text, text, text, jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.shop_partner_conversion_v1(text, text, text, jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.shop_partner_click_v1(uuid, text, text)', 'EXECUTE')
     OR has_table_privilege('authenticated', 'public.shop_partner_orders', 'SELECT')
     OR has_table_privilege('authenticated', 'public.shop_partner_clicks', 'SELECT') THEN
    RAISE EXCEPTION 'T34 grants too wide';
  END IF;
  SELECT count(*) INTO n FROM public.shop_partner_audit WHERE partner_id = pa AND action IN ('tracking_secret', 'tracking_settings', 'order_status');
  IF n < 4 THEN RAISE EXCEPTION 'T35 audit rows: %', n; END IF;
  RAISE WARNING 'PARTNER_TRACKING_OK';
END $$;

ROLLBACK;
