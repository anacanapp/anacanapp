-- Tenant isolation checks for 20261117090000_shop_partners.sql. Runs in one transaction and rolls back.
-- psql -v ON_ERROR_STOP=1 -f supabase/tests/shop_partners_isolation.sql  (fails with an exception on any broken rule)
BEGIN;
CREATE TEMP TABLE t_ids (k text PRIMARY KEY, v text);
GRANT ALL ON t_ids TO authenticated, anon;
INSERT INTO auth.users (id, email) VALUES
  ('a0000000-0000-4000-8000-00000000000a', 'qa-admin@example.test'),
  ('b0000000-0000-4000-8000-00000000000b', 'qa-owner-a@example.test'),
  ('c0000000-0000-4000-8000-00000000000c', 'qa-owner-b@example.test'),
  ('d0000000-0000-4000-8000-00000000000d', 'qa-user@example.test'),
  ('e0000000-0000-4000-8000-00000000000e', 'qa-viewer-a@example.test');
INSERT INTO public.user_roles (user_id, role) VALUES ('a0000000-0000-4000-8000-00000000000a', 'admin');

CREATE OR REPLACE FUNCTION pg_temp.act(u text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', coalesce(u, ''), true);
  PERFORM set_config('request.jwt.claims', CASE WHEN u IS NULL THEN '' ELSE json_build_object('sub', u, 'role', 'authenticated')::text END, true);
END $$;
CREATE OR REPLACE FUNCTION pg_temp.expect_fail(sql text, code text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE sql; EXCEPTION WHEN others THEN
    IF SQLERRM NOT LIKE '%' || code || '%' THEN RAISE EXCEPTION 'expected % got %', code, SQLERRM; END IF; RETURN; END;
  RAISE EXCEPTION 'expected failure % for %', code, sql;
END $$;

SET LOCAL ROLE authenticated;
-- admin creates two partners and a product for each
SELECT pg_temp.act('a0000000-0000-4000-8000-00000000000a');
INSERT INTO t_ids SELECT 'A', public.shop_partner_admin_save_v1(NULL, '{"slug":"qa-a","name":"QA A"}')::text;
INSERT INTO t_ids SELECT 'B', public.shop_partner_admin_save_v1(NULL, '{"slug":"qa-b","name":"QA B"}')::text;
INSERT INTO t_ids SELECT 'PA', public.shop_partner_product_save_v1((SELECT v::uuid FROM t_ids WHERE k='A'), NULL, '{"name":"Alpha","price":"5","tags":["baby","nope","bag","baby"]}')::text;
INSERT INTO t_ids SELECT 'PB', public.shop_partner_product_save_v1((SELECT v::uuid FROM t_ids WHERE k='B'), NULL, '{"name":"Beta","price":"7"}')::text;
DO $$ BEGIN IF (SELECT tags FROM public.products WHERE id = (SELECT v::uuid FROM t_ids WHERE k='PA')) <> ARRAY['baby','bag'] THEN RAISE EXCEPTION 'tags filter/order'; END IF; END $$;
-- invites: owner of A, viewer of A, owner of B
INSERT INTO t_ids SELECT 'IA', public.shop_partner_invite_v1((SELECT v::uuid FROM t_ids WHERE k='A'), 'QA-Owner-A@example.test', 'owner')->>'token';
INSERT INTO t_ids SELECT 'IV', public.shop_partner_invite_v1((SELECT v::uuid FROM t_ids WHERE k='A'), 'qa-viewer-a@example.test', 'viewer')->>'token';
INSERT INTO t_ids SELECT 'IB', public.shop_partner_invite_v1((SELECT v::uuid FROM t_ids WHERE k='B'), 'qa-owner-b@example.test', 'owner')->>'token';

-- wrong email cannot claim; right email can; a token works once
SELECT pg_temp.act('d0000000-0000-4000-8000-00000000000d');
SELECT pg_temp.expect_fail($$SELECT public.shop_partner_accept_invite_v1((SELECT v FROM t_ids WHERE k='IA'))$$, 'INVITE_EMAIL_MISMATCH');
SELECT pg_temp.act('b0000000-0000-4000-8000-00000000000b');
SELECT public.shop_partner_accept_invite_v1((SELECT v FROM t_ids WHERE k='IA'));
SELECT pg_temp.act('e0000000-0000-4000-8000-00000000000e');
SELECT public.shop_partner_accept_invite_v1((SELECT v FROM t_ids WHERE k='IV'));
SELECT pg_temp.act('c0000000-0000-4000-8000-00000000000c');
SELECT public.shop_partner_accept_invite_v1((SELECT v FROM t_ids WHERE k='IB'));
SELECT pg_temp.expect_fail($$SELECT public.shop_partner_accept_invite_v1('0000000000000000000000000000000000000000')$$, 'INVITE_INVALID');

-- owner B sees only B; cannot read or write A
DO $$ BEGIN IF jsonb_array_length(public.shop_partner_me_v1()->'partners') <> 1 OR public.shop_partner_me_v1()->'partners'->0->>'slug' <> 'qa-b' THEN RAISE EXCEPTION 'me scope'; END IF; END $$;
SELECT pg_temp.expect_fail($$SELECT public.shop_partner_products_v1((SELECT v::uuid FROM t_ids WHERE k='A'))$$, 'PARTNER_FORBIDDEN');
SELECT pg_temp.expect_fail($$SELECT public.shop_partner_dashboard_v1((SELECT v::uuid FROM t_ids WHERE k='A'), NULL, NULL)$$, 'PARTNER_FORBIDDEN');
-- B cannot edit A's product through its own partner id
SELECT pg_temp.expect_fail($$SELECT public.shop_partner_product_save_v1((SELECT v::uuid FROM t_ids WHERE k='B'), (SELECT v::uuid FROM t_ids WHERE k='PA'), '{"name":"Hack","price":"1"}')$$, 'PRODUCT_NOT_FOUND');
SELECT pg_temp.expect_fail($$SELECT public.shop_partner_sale_save_v1((SELECT v::uuid FROM t_ids WHERE k='B'), NULL, json_build_object('sale_date', current_date, 'quantity', 1, 'revenue', 3, 'product_id', (SELECT v FROM t_ids WHERE k='PA'))::jsonb)$$, 'PRODUCT_NOT_FOUND');
DO $$ BEGIN IF public.shop_partner_products_bulk_v1((SELECT v::uuid FROM t_ids WHERE k='B'), ARRAY[(SELECT v::uuid FROM t_ids WHERE k='PA')], 'delete') <> 0 THEN RAISE EXCEPTION 'bulk crossed partners'; END IF; END $$;
-- B is not admin
SELECT pg_temp.expect_fail($$SELECT public.shop_partner_admin_list_v1()$$, 'ADMIN_ONLY');
SELECT pg_temp.expect_fail($$SELECT public.shop_partner_admin_clear_v1((SELECT v::uuid FROM t_ids WHERE k='A'))$$, 'ADMIN_ONLY');
-- direct table access is closed
SELECT pg_temp.expect_fail($$SELECT * FROM public.shop_partner_events$$, 'permission denied');
SELECT pg_temp.expect_fail($$SELECT * FROM public.shop_partner_members$$, 'permission denied');

-- owner A edits price/stock, creates a pending campaign; viewer A cannot write
SELECT pg_temp.act('b0000000-0000-4000-8000-00000000000b');
SELECT public.shop_partner_product_save_v1((SELECT v::uuid FROM t_ids WHERE k='A'), (SELECT v::uuid FROM t_ids WHERE k='PA'), '{"name":"Alpha","price":"4.50","original_price":"6","stock":"3","tags":["baby"]}');
INSERT INTO t_ids SELECT 'CA', public.shop_partner_campaign_save_v1((SELECT v::uuid FROM t_ids WHERE k='A'), NULL,
  json_build_object('title','Payız', 'discount_pct', 20, 'starts_at', now() - interval '1 hour', 'ends_at', now() + interval '7 days')::jsonb)::text;
SELECT pg_temp.act('e0000000-0000-4000-8000-00000000000e');
SELECT pg_temp.expect_fail($$SELECT public.shop_partner_product_save_v1((SELECT v::uuid FROM t_ids WHERE k='A'), (SELECT v::uuid FROM t_ids WHERE k='PA'), '{"name":"X","price":"1"}')$$, 'PARTNER_FORBIDDEN');
SELECT pg_temp.expect_fail($$SELECT public.shop_partner_invite_v1((SELECT v::uuid FROM t_ids WHERE k='A'), 'x@example.test', 'owner')$$, 'PARTNER_FORBIDDEN');
DO $$ BEGIN IF jsonb_array_length(public.shop_partner_products_v1((SELECT v::uuid FROM t_ids WHERE k='A'))) <> 1 THEN RAISE EXCEPTION 'viewer read'; END IF; END $$;

-- storefront: admin_only partners are hidden from ordinary users and anon, visible to admin and members
SELECT pg_temp.act('d0000000-0000-4000-8000-00000000000d');
DO $$ BEGIN IF jsonb_array_length(public.shop_storefront_v1()->'products') <> 0 THEN RAISE EXCEPTION 'user sees hidden store'; END IF; END $$;
SELECT public.shop_partner_track_v1(ARRAY[(SELECT v::uuid FROM t_ids WHERE k='PA')], 'open', 'shop');
SELECT pg_temp.act('b0000000-0000-4000-8000-00000000000b');
DO $$ BEGIN IF jsonb_array_length(public.shop_storefront_v1()->'products') <> 1 THEN RAISE EXCEPTION 'member storefront'; END IF;
  IF public.shop_storefront_v1()->'products'->0->'campaign' <> 'null'::jsonb THEN RAISE EXCEPTION 'pending campaign applied'; END IF; END $$;
-- admin approves, sets A live; campaign price shows for everyone
SELECT pg_temp.act('a0000000-0000-4000-8000-00000000000a');
SELECT public.shop_partner_campaign_review_v1((SELECT v::uuid FROM t_ids WHERE k='CA'), 'approved', 'ok');
SELECT public.shop_partner_admin_save_v1((SELECT v::uuid FROM t_ids WHERE k='A'), '{"name":"QA A","status":"live","commission_pct":"10"}');
SELECT pg_temp.act('d0000000-0000-4000-8000-00000000000d');
DO $$ DECLARE s jsonb := public.shop_storefront_v1(); BEGIN
  IF jsonb_array_length(s->'products') <> 1 OR (s->'products'->0->'campaign'->>'price')::numeric <> 3.60 THEN RAISE EXCEPTION 'live storefront %', s; END IF;
  IF jsonb_array_length(s->'partners') <> 1 THEN RAISE EXCEPTION 'partner list leak'; END IF; END $$;
SELECT public.shop_partner_track_v1(ARRAY[(SELECT v::uuid FROM t_ids WHERE k='PA'), (SELECT v::uuid FROM t_ids WHERE k='PB')], 'impression', 'home');
SELECT public.shop_partner_track_v1(ARRAY[(SELECT v::uuid FROM t_ids WHERE k='PA')], 'impression', 'home');
SELECT public.shop_partner_track_v1(ARRAY[(SELECT v::uuid FROM t_ids WHERE k='PA')], 'site', 'shop');
RESET ROLE;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.shop_partner_events WHERE event = 'impression') <> 1 THEN RAISE EXCEPTION 'impression dedup / hidden partner tracked'; END IF;
  IF (SELECT count(*) FROM public.shop_partner_events WHERE event = 'open') <> 0 THEN RAISE EXCEPTION 'hidden store tracked'; END IF;
END $$;
SET LOCAL ROLE authenticated;
-- owner A: sales + dashboard exclude internal traffic
SELECT pg_temp.act('b0000000-0000-4000-8000-00000000000b');
SELECT public.shop_partner_sale_save_v1((SELECT v::uuid FROM t_ids WHERE k='A'), NULL, json_build_object('sale_date', (now() AT TIME ZONE 'Asia/Baku')::date, 'quantity', 2, 'revenue', 9, 'product_id', (SELECT v FROM t_ids WHERE k='PA'))::jsonb);
SELECT public.shop_partner_track_v1(ARRAY[(SELECT v::uuid FROM t_ids WHERE k='PA')], 'open', 'shop');
DO $$ DECLARE d jsonb := public.shop_partner_dashboard_v1((SELECT v::uuid FROM t_ids WHERE k='A'), NULL, NULL); BEGIN
  IF (d->'kpis'->>'impressions')::int <> 1 OR (d->'kpis'->>'site')::int <> 1 OR (d->'kpis'->>'opens')::int <> 0 THEN RAISE EXCEPTION 'dashboard kpis %', d->'kpis'; END IF;
  IF (d->'sales'->>'revenue')::numeric <> 9 OR (d->'sales'->>'commission')::numeric <> 0.90 THEN RAISE EXCEPTION 'dashboard sales %', d->'sales'; END IF;
  IF (d->>'internal_events')::int <> 1 THEN RAISE EXCEPTION 'internal count'; END IF;
  IF jsonb_array_length(d->'daily') <> 30 THEN RAISE EXCEPTION 'daily range'; END IF; END $$;
DO $$ BEGIN IF (SELECT count(*) FROM jsonb_array_elements(public.shop_partner_audit_v1((SELECT v::uuid FROM t_ids WHERE k='A')))) < 4 THEN RAISE EXCEPTION 'audit'; END IF; END $$;
-- anon storefront
SELECT pg_temp.act(NULL);
RESET ROLE; SET LOCAL ROLE anon;
DO $$ BEGIN IF jsonb_array_length(public.shop_storefront_v1()->'products') <> 1 THEN RAISE EXCEPTION 'anon live storefront'; END IF; END $$;
SELECT pg_temp.expect_fail($$SELECT public.shop_partner_me_v1()$$, 'permission denied');
RESET ROLE;
-- admin import + clear
SET LOCAL ROLE authenticated;
SELECT pg_temp.act('a0000000-0000-4000-8000-00000000000a');
DO $$ BEGIN
  IF public.shop_partner_admin_import_v1((SELECT v::uuid FROM t_ids WHERE k='B'), '[{"name":"One","price":"1","tags":["gift"]},{"name":"Two","price":"2"}]') <> 2 THEN RAISE EXCEPTION 'import'; END IF;
  IF (SELECT array_agg(name ORDER BY sales_count DESC) FROM public.products WHERE partner_id = (SELECT v::uuid FROM t_ids WHERE k='B')) <> ARRAY['One','Two'] THEN RAISE EXCEPTION 'import order'; END IF;
  IF public.shop_partner_admin_clear_v1((SELECT v::uuid FROM t_ids WHERE k='B')) <> 2 THEN RAISE EXCEPTION 'clear'; END IF;
  IF (SELECT count(*) FROM public.products WHERE partner_id = (SELECT v::uuid FROM t_ids WHERE k='A')) <> 1 THEN RAISE EXCEPTION 'clear crossed partners'; END IF;
END $$;
RESET ROLE;
SELECT 'SHOP_PARTNERS_ISOLATION_OK';
ROLLBACK;
