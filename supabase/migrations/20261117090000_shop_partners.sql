-- Partner stores (owner 2026-11-17): every shop partner (Olivia first, more brands later) gets its own products,
-- statistics, campaigns, sales log, team and audit trail, scoped on the server to that partner only.
--
-- Relations (all CDC + writer guard, RLS on, no client table grants; access only through the RPCs below):
--   shop_partners          partner (slug, name, logo/icon, website, status admin_only|live|paused, commission)
--   shop_partner_members   user ↔ partner with role owner|manager|viewer
--   shop_partner_invites   one-time invite links (sha256 of the token is stored, the token is shown once)
--   shop_partner_events    storefront measurements (impression/open/add/site/bundle), internal = admin/member traffic
--   shop_partner_campaigns discount campaigns, pending → approved/rejected by Anacan admins, cancelled by the partner
--   shop_partner_sales     sales the partner records by hand (phase 1 sells on the partner's own site)
--   shop_partner_audit     who changed what (prices, stock, campaigns, team)
-- products gains partner_id + partner_listed. Partner products stay is_active = false: the storefront reads them only
-- through shop_storefront_v1, which shows a partner to everyone when live and to admins / its own members otherwise.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

DO $$
BEGIN
  IF to_regclass('_anacan_gcp_migration.guarded_relations') IS NULL THEN RAISE EXCEPTION 'SHOP_PARTNERS_GUARD_CATALOG_MISSING'; END IF;
  IF to_regclass('public.products') IS NULL THEN RAISE EXCEPTION 'SHOP_PARTNERS_PRODUCTS_MISSING'; END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.shop_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,39}$'),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 80),
  logo_url text CHECK (logo_url IS NULL OR length(logo_url) <= 500),
  icon_url text CHECK (icon_url IS NULL OR length(icon_url) <= 500),
  website_url text CHECK (website_url IS NULL OR website_url ~ '^https://' AND length(website_url) <= 300),
  brand_color text NOT NULL DEFAULT '#8A2BE2' CHECK (brand_color ~ '^#[0-9A-Fa-f]{6}$'),
  status text NOT NULL DEFAULT 'admin_only' CHECK (status IN ('admin_only', 'live', 'paused')),
  commission_pct numeric(5,2) CHECK (commission_pct IS NULL OR commission_pct BETWEEN 0 AND 100),
  contact_email text CHECK (contact_email IS NULL OR length(contact_email) <= 200),
  notes text CHECK (notes IS NULL OR length(notes) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shop_partner_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.shop_partners(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('owner', 'manager', 'viewer')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (partner_id, user_id)
);
CREATE INDEX IF NOT EXISTS shop_partner_members_user_idx ON public.shop_partner_members (user_id);

CREATE TABLE IF NOT EXISTS public.shop_partner_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.shop_partners(id) ON DELETE CASCADE,
  email text NOT NULL CHECK (length(email) BETWEEN 3 AND 200),
  role text NOT NULL CHECK (role IN ('owner', 'manager', 'viewer')),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_by uuid,
  accepted_at timestamptz,
  revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS shop_partner_invites_partner_idx ON public.shop_partner_invites (partner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.shop_partner_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.shop_partners(id) ON DELETE CASCADE,
  product_id uuid,
  user_id uuid NOT NULL,
  event text NOT NULL CHECK (event IN ('impression', 'open', 'add', 'site', 'bundle')),
  placement text NOT NULL DEFAULT 'shop' CHECK (length(placement) <= 40),
  internal boolean NOT NULL DEFAULT false,
  dedup_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shop_partner_events_partner_idx ON public.shop_partner_events (partner_id, created_at);
CREATE INDEX IF NOT EXISTS shop_partner_events_throttle_idx ON public.shop_partner_events (user_id, product_id, event, created_at DESC);

CREATE TABLE IF NOT EXISTS public.shop_partner_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.shop_partners(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 2 AND 120),
  description text CHECK (description IS NULL OR length(description) <= 1000),
  discount_pct numeric(5,2) NOT NULL CHECK (discount_pct >= 1 AND discount_pct <= 90),
  product_ids uuid[] NOT NULL DEFAULT '{}',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  review_note text CHECK (review_note IS NULL OR length(review_note) <= 1000),
  created_by uuid,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS shop_partner_campaigns_partner_idx ON public.shop_partner_campaigns (partner_id, status, ends_at);

CREATE TABLE IF NOT EXISTS public.shop_partner_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.shop_partners(id) ON DELETE CASCADE,
  product_id uuid,
  sale_date date NOT NULL,
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 100000),
  revenue numeric(12,2) NOT NULL CHECK (revenue >= 0 AND revenue <= 10000000),
  channel text NOT NULL DEFAULT 'partner_site' CHECK (channel IN ('partner_site', 'app', 'other')),
  note text CHECK (note IS NULL OR length(note) <= 500),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shop_partner_sales_partner_idx ON public.shop_partner_sales (partner_id, sale_date);

CREATE TABLE IF NOT EXISTS public.shop_partner_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.shop_partners(id) ON DELETE CASCADE,
  actor uuid,
  action text NOT NULL CHECK (length(action) <= 60),
  target uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shop_partner_audit_partner_idx ON public.shop_partner_audit (partner_id, created_at DESC);

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS partner_id uuid REFERENCES public.shop_partners(id) ON DELETE SET NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS partner_listed boolean NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS products_partner_idx ON public.products (partner_id) WHERE partner_id IS NOT NULL;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['shop_partners', 'shop_partner_members', 'shop_partner_invites', 'shop_partner_events',
                           'shop_partner_campaigns', 'shop_partner_sales', 'shop_partner_audit'] LOOP
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

-- ───────────── helpers (not callable by clients) ─────────────
CREATE OR REPLACE FUNCTION public._shop_partner_role(p_partner uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN NULL
    WHEN public.has_role(auth.uid(), 'admin'::public.app_role) THEN 'admin'
    ELSE (SELECT m.role FROM public.shop_partner_members m WHERE m.partner_id = p_partner AND m.user_id = auth.uid())
  END
$$;

CREATE OR REPLACE FUNCTION public._shop_partner_need(p_partner uuid, p_min text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE r text := public._shop_partner_role(p_partner);
  lvl integer := CASE r WHEN 'admin' THEN 4 WHEN 'owner' THEN 3 WHEN 'manager' THEN 2 WHEN 'viewer' THEN 1 ELSE 0 END;
  need integer := CASE p_min WHEN 'admin' THEN 4 WHEN 'owner' THEN 3 WHEN 'manager' THEN 2 ELSE 1 END;
BEGIN
  IF p_partner IS NULL OR NOT EXISTS (SELECT 1 FROM public.shop_partners WHERE id = p_partner) THEN
    RAISE EXCEPTION 'PARTNER_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF lvl < need THEN RAISE EXCEPTION 'PARTNER_FORBIDDEN' USING ERRCODE = '42501'; END IF;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public._shop_partner_log(p_partner uuid, p_action text, p_target uuid, p_payload jsonb)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  INSERT INTO public.shop_partner_audit (partner_id, actor, action, target, payload) VALUES (p_partner, auth.uid(), p_action, p_target, coalesce(p_payload, '{}'::jsonb))
$$;

-- Partners the caller may see in the storefront: live ones for everyone, others for admins and their own members.
CREATE OR REPLACE FUNCTION public._shop_visible_partners()
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT coalesce(array_agg(p.id), '{}') FROM public.shop_partners p
  WHERE p.status = 'live'
     OR (auth.uid() IS NOT NULL AND (public.has_role(auth.uid(), 'admin'::public.app_role)
         OR EXISTS (SELECT 1 FROM public.shop_partner_members m WHERE m.partner_id = p.id AND m.user_id = auth.uid())))
$$;

-- ───────────── app storefront ─────────────
CREATE OR REPLACE FUNCTION public.shop_storefront_v1()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE vis uuid[] := public._shop_visible_partners();
BEGIN
  RETURN jsonb_build_object(
    'partners', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'slug', p.slug, 'name', p.name, 'logo_url', p.logo_url, 'icon_url', p.icon_url,
        'website_url', p.website_url, 'brand_color', p.brand_color, 'status', p.status) ORDER BY p.name), '[]'::jsonb)
      FROM public.shop_partners p WHERE p.id = ANY (vis)),
    'products', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', pr.id, 'partner_id', pr.partner_id, 'sku', pr.sku, 'name', pr.name,
        'description', pr.description, 'price', pr.price, 'original_price', pr.original_price, 'image_url', pr.image_url,
        'source_url', pr.source_url, 'tags', pr.tags, 'stock', pr.stock, 'sales_count', pr.sales_count, 'campaign', c.obj)
        ORDER BY pr.sales_count DESC, pr.name), '[]'::jsonb)
      FROM public.products pr
      LEFT JOIN LATERAL (
        SELECT jsonb_build_object('id', c.id, 'title', c.title, 'discount_pct', c.discount_pct, 'ends_at', c.ends_at,
                 'price', round(pr.price * (1 - c.discount_pct / 100), 2)) AS obj
        FROM public.shop_partner_campaigns c
        WHERE c.partner_id = pr.partner_id AND c.status = 'approved' AND now() >= c.starts_at AND now() < c.ends_at
          AND (cardinality(c.product_ids) = 0 OR pr.id = ANY (c.product_ids))
        ORDER BY c.discount_pct DESC LIMIT 1) c ON true
      WHERE pr.partner_id = ANY (vis) AND pr.partner_listed AND (pr.stock IS NULL OR pr.stock > 0))
  );
END $$;

-- Batched measurements from the app. Impressions count once per user, product, placement and Baku day;
-- other events are throttled to one per 3 seconds. Admin and partner-member traffic is stored as internal.
CREATE OR REPLACE FUNCTION public.shop_partner_track_v1(p_products uuid[], p_event text, p_placement text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE uid uuid := auth.uid(); pid uuid; pstatus text; is_internal boolean; prod uuid; key text;
  place text := left(coalesce(nullif(regexp_replace(lower(coalesce(p_placement, '')), '[^a-z0-9_:-]', '', 'g'), ''), 'shop'), 40);
  adm boolean;
BEGIN
  IF uid IS NULL OR p_products IS NULL OR p_event IS NULL OR p_event NOT IN ('impression', 'open', 'add', 'site', 'bundle') THEN RETURN; END IF;
  adm := public.has_role(uid, 'admin'::public.app_role);
  FOREACH prod IN ARRAY p_products[1:60] LOOP
    SELECT pr.partner_id, sp.status INTO pid, pstatus FROM public.products pr JOIN public.shop_partners sp ON sp.id = pr.partner_id WHERE pr.id = prod;
    CONTINUE WHEN pid IS NULL;
    is_internal := adm OR EXISTS (SELECT 1 FROM public.shop_partner_members m WHERE m.partner_id = pid AND m.user_id = uid);
    CONTINUE WHEN pstatus <> 'live' AND NOT is_internal;
    key := NULL;
    IF p_event = 'impression' THEN
      key := uid::text || ':' || prod::text || ':' || place || ':' || to_char(now() AT TIME ZONE 'Asia/Baku', 'YYYY-MM-DD');
    ELSIF EXISTS (SELECT 1 FROM public.shop_partner_events e WHERE e.user_id = uid AND e.product_id = prod AND e.event = p_event
                  AND e.created_at > now() - interval '3 seconds') THEN
      CONTINUE;
    END IF;
    INSERT INTO public.shop_partner_events (partner_id, product_id, user_id, event, placement, internal, dedup_key)
      VALUES (pid, prod, uid, p_event, place, is_internal, key) ON CONFLICT (dedup_key) DO NOTHING;
  END LOOP;
END $$;

-- ───────────── partner panel ─────────────
CREATE OR REPLACE FUNCTION public.shop_partner_me_v1()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE uid uuid := auth.uid(); adm boolean;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('signed_in', false, 'is_admin', false, 'partners', '[]'::jsonb); END IF;
  adm := public.has_role(uid, 'admin'::public.app_role);
  RETURN jsonb_build_object('signed_in', true, 'is_admin', adm,
    'email', (SELECT u.email FROM auth.users u WHERE u.id = uid),
    'partners', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'slug', p.slug, 'name', p.name, 'logo_url', p.logo_url, 'icon_url', p.icon_url,
        'brand_color', p.brand_color, 'status', p.status, 'website_url', p.website_url, 'commission_pct', p.commission_pct,
        'role', CASE WHEN adm THEN 'admin' ELSE m.role END) ORDER BY p.name), '[]'::jsonb)
      FROM public.shop_partners p LEFT JOIN public.shop_partner_members m ON m.partner_id = p.id AND m.user_id = uid
      WHERE adm OR m.user_id IS NOT NULL));
END $$;

CREATE OR REPLACE FUNCTION public.shop_partner_accept_invite_v1(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE uid uuid := auth.uid(); inv public.shop_partner_invites%ROWTYPE; my_email text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF p_token IS NULL OR length(p_token) < 32 OR length(p_token) > 200 THEN RAISE EXCEPTION 'INVITE_INVALID' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO inv FROM public.shop_partner_invites WHERE token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex') FOR UPDATE;
  IF NOT FOUND OR inv.revoked_at IS NOT NULL OR inv.expires_at < now() THEN RAISE EXCEPTION 'INVITE_INVALID' USING ERRCODE = 'P0002'; END IF;
  IF inv.accepted_at IS NOT NULL THEN
    IF inv.accepted_by = uid THEN RETURN jsonb_build_object('partner_id', inv.partner_id); END IF;
    RAISE EXCEPTION 'INVITE_USED' USING ERRCODE = 'P0002';
  END IF;
  SELECT lower(u.email) INTO my_email FROM auth.users u WHERE u.id = uid;
  IF my_email IS DISTINCT FROM lower(btrim(inv.email)) THEN RAISE EXCEPTION 'INVITE_EMAIL_MISMATCH' USING ERRCODE = '42501'; END IF;
  INSERT INTO public.shop_partner_members (partner_id, user_id, role, created_by) VALUES (inv.partner_id, uid, inv.role, inv.created_by)
    ON CONFLICT (partner_id, user_id) DO UPDATE SET role = EXCLUDED.role;
  UPDATE public.shop_partner_invites SET accepted_by = uid, accepted_at = now() WHERE id = inv.id;
  INSERT INTO public.shop_partner_audit (partner_id, actor, action, target, payload) VALUES (inv.partner_id, uid, 'member_joined', uid, jsonb_build_object('role', inv.role));
  RETURN jsonb_build_object('partner_id', inv.partner_id);
END $$;

CREATE OR REPLACE FUNCTION public.shop_partner_dashboard_v1(p_partner uuid, p_from date, p_to date, p_internal boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE t date := least(coalesce(p_to, (now() AT TIME ZONE 'Asia/Baku')::date), (now() AT TIME ZONE 'Asia/Baku')::date);
  f date; t0 timestamptz; t1 timestamptz; comm numeric;
BEGIN
  PERFORM public._shop_partner_need(p_partner, 'viewer');
  f := greatest(coalesce(p_from, t - 29), t - 365);
  IF f > t THEN f := t; END IF;
  t0 := f::timestamp AT TIME ZONE 'Asia/Baku'; t1 := (t + 1)::timestamp AT TIME ZONE 'Asia/Baku';
  SELECT commission_pct INTO comm FROM public.shop_partners WHERE id = p_partner;
  RETURN (
    WITH ev AS (
      SELECT e.* FROM public.shop_partner_events e
      WHERE e.partner_id = p_partner AND e.created_at >= t0 AND e.created_at < t1 AND (p_internal OR NOT e.internal)
    ), sales AS (
      SELECT s.* FROM public.shop_partner_sales s WHERE s.partner_id = p_partner AND s.sale_date BETWEEN f AND t
    )
    SELECT jsonb_build_object(
      'from', f, 'to', t, 'commission_pct', comm,
      'kpis', (SELECT jsonb_build_object(
          'impressions', count(*) FILTER (WHERE event = 'impression'),
          'opens', count(*) FILTER (WHERE event = 'open'),
          'adds', count(*) FILTER (WHERE event = 'add'),
          'bundles', count(*) FILTER (WHERE event = 'bundle'),
          'site', count(*) FILTER (WHERE event = 'site'),
          'reach', count(DISTINCT user_id)) FROM ev),
      'sales', (SELECT jsonb_build_object('quantity', coalesce(sum(quantity), 0), 'revenue', coalesce(sum(revenue), 0),
          'commission', round(coalesce(sum(revenue), 0) * coalesce(comm, 0) / 100, 2), 'entries', count(*)) FROM sales),
      'daily', (SELECT coalesce(jsonb_agg(jsonb_build_object('d', d.day::date, 'impressions', coalesce(x.i, 0), 'opens', coalesce(x.o, 0),
            'adds', coalesce(x.a, 0), 'site', coalesce(x.s, 0), 'revenue', coalesce(y.r, 0)) ORDER BY d.day), '[]'::jsonb)
          FROM generate_series(f, t, interval '1 day') AS d(day)
          LEFT JOIN (SELECT (created_at AT TIME ZONE 'Asia/Baku')::date AS day,
              count(*) FILTER (WHERE event = 'impression') i, count(*) FILTER (WHERE event = 'open') o,
              count(*) FILTER (WHERE event IN ('add', 'bundle')) a, count(*) FILTER (WHERE event = 'site') s
            FROM ev GROUP BY 1) x ON x.day = d.day::date
          LEFT JOIN (SELECT sale_date AS day, sum(revenue) r FROM sales GROUP BY 1) y ON y.day = d.day::date),
      'products', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', pr.id, 'name', pr.name, 'image_url', pr.image_url, 'price', pr.price,
            'stock', pr.stock, 'listed', pr.partner_listed, 'impressions', coalesce(x.i, 0), 'opens', coalesce(x.o, 0),
            'adds', coalesce(x.a, 0), 'site', coalesce(x.s, 0), 'sold', coalesce(y.q, 0), 'revenue', coalesce(y.r, 0))
            ORDER BY coalesce(x.o, 0) + coalesce(x.a, 0) * 2 + coalesce(x.s, 0) * 3 DESC, coalesce(x.i, 0) DESC, pr.name), '[]'::jsonb)
          FROM public.products pr
          LEFT JOIN (SELECT product_id, count(*) FILTER (WHERE event = 'impression') i, count(*) FILTER (WHERE event = 'open') o,
              count(*) FILTER (WHERE event IN ('add', 'bundle')) a, count(*) FILTER (WHERE event = 'site') s FROM ev GROUP BY 1) x ON x.product_id = pr.id
          LEFT JOIN (SELECT product_id, sum(quantity) q, sum(revenue) r FROM sales GROUP BY 1) y ON y.product_id = pr.id
          WHERE pr.partner_id = p_partner),
      'placements', (SELECT coalesce(jsonb_agg(jsonb_build_object('placement', placement, 'impressions', i, 'opens', o, 'adds', a, 'site', s) ORDER BY i DESC), '[]'::jsonb)
          FROM (SELECT placement, count(*) FILTER (WHERE event = 'impression') i, count(*) FILTER (WHERE event = 'open') o,
              count(*) FILTER (WHERE event IN ('add', 'bundle')) a, count(*) FILTER (WHERE event = 'site') s FROM ev GROUP BY 1) z),
      'internal_events', (SELECT count(*) FROM public.shop_partner_events e WHERE e.partner_id = p_partner AND e.internal AND e.created_at >= t0 AND e.created_at < t1),
      'campaigns_active', (SELECT count(*) FROM public.shop_partner_campaigns c WHERE c.partner_id = p_partner AND c.status = 'approved' AND now() >= c.starts_at AND now() < c.ends_at)
    )
  );
END $$;

CREATE OR REPLACE FUNCTION public.shop_partner_products_v1(p_partner uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  PERFORM public._shop_partner_need(p_partner, 'viewer');
  RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('id', pr.id, 'sku', pr.sku, 'name', pr.name, 'description', pr.description,
      'price', pr.price, 'original_price', pr.original_price, 'stock', pr.stock, 'image_url', pr.image_url, 'source_url', pr.source_url,
      'tags', pr.tags, 'listed', pr.partner_listed, 'updated_at', pr.updated_at) ORDER BY pr.sales_count DESC, pr.name), '[]'::jsonb)
    FROM public.products pr WHERE pr.partner_id = p_partner);
END $$;

CREATE OR REPLACE FUNCTION public.shop_partner_product_save_v1(p_partner uuid, p_product uuid, p_data jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE slug text; v_name text := btrim(coalesce(p_data->>'name', '')); v_price numeric; v_old numeric; v_stock integer; v_img text; v_url text;
  v_desc text := nullif(btrim(coalesce(p_data->>'description', '')), ''); v_sku text := nullif(btrim(coalesce(p_data->>'sku', '')), '');
  v_tags text[]; v_listed boolean := coalesce((p_data->>'listed')::boolean, true); prev public.products%ROWTYPE; new_id uuid;
BEGIN
  PERFORM public._shop_partner_need(p_partner, 'manager');
  SELECT p.slug INTO slug FROM public.shop_partners p WHERE p.id = p_partner;
  BEGIN
    v_price := round((p_data->>'price')::numeric, 2);
    v_old := round(nullif(p_data->>'original_price', '')::numeric, 2);
    v_stock := nullif(p_data->>'stock', '')::integer;
  EXCEPTION WHEN others THEN RAISE EXCEPTION 'PRODUCT_INVALID_NUMBER' USING ERRCODE = '22023';
  END;
  v_img := nullif(btrim(coalesce(p_data->>'image_url', '')), '');
  v_url := nullif(btrim(coalesce(p_data->>'source_url', '')), '');
  SELECT coalesce(array_agg(s.x ORDER BY s.o), '{}') INTO v_tags FROM (
    SELECT DISTINCT ON (t.x) t.x, t.o FROM jsonb_array_elements_text(coalesce(p_data->'tags', '[]'::jsonb)) WITH ORDINALITY AS t(x, o)
    WHERE t.x IN ('bag', 'pregnant', 'newmom', 'baby', 'kid', 'cycle', 'gift') ORDER BY t.x, t.o) s;
  IF length(v_name) NOT BETWEEN 2 AND 160 THEN RAISE EXCEPTION 'PRODUCT_NAME' USING ERRCODE = '22023'; END IF;
  IF v_price IS NULL OR v_price < 0 OR v_price > 100000 THEN RAISE EXCEPTION 'PRODUCT_PRICE' USING ERRCODE = '22023'; END IF;
  IF v_old IS NOT NULL AND (v_old < v_price OR v_old > 100000) THEN RAISE EXCEPTION 'PRODUCT_OLD_PRICE' USING ERRCODE = '22023'; END IF;
  IF v_stock IS NOT NULL AND (v_stock < 0 OR v_stock > 1000000) THEN RAISE EXCEPTION 'PRODUCT_STOCK' USING ERRCODE = '22023'; END IF;
  IF v_img IS NOT NULL AND (length(v_img) > 500 OR v_img !~ '^(https://|/)') THEN RAISE EXCEPTION 'PRODUCT_IMAGE' USING ERRCODE = '22023'; END IF;
  IF v_url IS NOT NULL AND (length(v_url) > 500 OR v_url !~ '^https://') THEN RAISE EXCEPTION 'PRODUCT_URL' USING ERRCODE = '22023'; END IF;
  IF v_desc IS NOT NULL AND length(v_desc) > 1000 THEN RAISE EXCEPTION 'PRODUCT_DESCRIPTION' USING ERRCODE = '22023'; END IF;
  IF v_sku IS NOT NULL AND length(v_sku) > 64 THEN RAISE EXCEPTION 'PRODUCT_SKU' USING ERRCODE = '22023'; END IF;

  IF p_product IS NULL THEN
    INSERT INTO public.products (name, description, price, original_price, image_url, images, category, sku, store, kind, tags, source, source_url,
                                 stock, is_active, partner_id, partner_listed, sales_count, cashback_own)
      VALUES (v_name, v_desc, v_price, v_old, v_img, CASE WHEN v_img IS NULL THEN '{}' ELSE ARRAY[v_img] END, slug, v_sku, slug,
              v_tags[1], v_tags, slug, v_url, v_stock, false, p_partner, v_listed, 0, false)
      RETURNING id INTO new_id;
    PERFORM public._shop_partner_log(p_partner, 'product_created', new_id, jsonb_build_object('name', v_name, 'price', v_price, 'stock', v_stock));
    RETURN new_id;
  END IF;

  SELECT * INTO prev FROM public.products WHERE id = p_product AND partner_id = p_partner FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCT_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  UPDATE public.products SET name = v_name, description = v_desc, price = v_price, original_price = v_old, stock = v_stock,
      image_url = v_img, images = CASE WHEN v_img IS NULL THEN '{}' ELSE ARRAY[v_img] END, sku = v_sku, source_url = v_url,
      tags = v_tags, kind = v_tags[1], partner_listed = v_listed, updated_at = now()
    WHERE id = p_product;
  PERFORM public._shop_partner_log(p_partner, 'product_updated', p_product, jsonb_strip_nulls(jsonb_build_object(
    'name', CASE WHEN prev.name IS DISTINCT FROM v_name THEN jsonb_build_array(prev.name, v_name) END,
    'price', CASE WHEN prev.price IS DISTINCT FROM v_price THEN jsonb_build_array(prev.price, v_price) END,
    'original_price', CASE WHEN prev.original_price IS DISTINCT FROM v_old THEN jsonb_build_array(prev.original_price, v_old) END,
    'stock', CASE WHEN prev.stock IS DISTINCT FROM v_stock THEN jsonb_build_array(prev.stock, v_stock) END,
    'listed', CASE WHEN prev.partner_listed IS DISTINCT FROM v_listed THEN jsonb_build_array(prev.partner_listed, v_listed) END)));
  RETURN p_product;
END $$;

CREATE OR REPLACE FUNCTION public.shop_partner_products_bulk_v1(p_partner uuid, p_ids uuid[], p_action text, p_value numeric DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE n integer;
BEGIN
  PERFORM public._shop_partner_need(p_partner, 'manager');
  IF p_action = 'list' OR p_action = 'unlist' THEN
    UPDATE public.products SET partner_listed = (p_action = 'list'), updated_at = now() WHERE partner_id = p_partner AND id = ANY (coalesce(p_ids, '{}'));
  ELSIF p_action = 'stock' THEN
    IF p_value IS NOT NULL AND (p_value < 0 OR p_value > 1000000) THEN RAISE EXCEPTION 'PRODUCT_STOCK' USING ERRCODE = '22023'; END IF;
    UPDATE public.products SET stock = p_value::integer, updated_at = now() WHERE partner_id = p_partner AND id = ANY (coalesce(p_ids, '{}'));
  ELSIF p_action = 'delete' THEN
    DELETE FROM public.products WHERE partner_id = p_partner AND id = ANY (coalesce(p_ids, '{}'));
  ELSE
    RAISE EXCEPTION 'BULK_ACTION' USING ERRCODE = '22023';
  END IF;
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM public._shop_partner_log(p_partner, 'products_' || p_action, NULL, jsonb_build_object('count', n, 'value', p_value));
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.shop_partner_campaigns_v1(p_partner uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  PERFORM public._shop_partner_need(p_partner, 'viewer');
  RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'title', c.title, 'description', c.description, 'discount_pct', c.discount_pct,
      'product_ids', c.product_ids, 'starts_at', c.starts_at, 'ends_at', c.ends_at, 'status', c.status, 'review_note', c.review_note,
      'live', c.status = 'approved' AND now() >= c.starts_at AND now() < c.ends_at, 'created_at', c.created_at) ORDER BY c.created_at DESC), '[]'::jsonb)
    FROM public.shop_partner_campaigns c WHERE c.partner_id = p_partner);
END $$;

CREATE OR REPLACE FUNCTION public.shop_partner_campaign_save_v1(p_partner uuid, p_campaign uuid, p_data jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE r text; v_title text := btrim(coalesce(p_data->>'title', '')); v_desc text := nullif(btrim(coalesce(p_data->>'description', '')), '');
  v_pct numeric; v_start timestamptz; v_end timestamptz; v_ids uuid[]; v_status text; new_id uuid;
BEGIN
  r := public._shop_partner_need(p_partner, 'manager');
  BEGIN
    v_pct := round((p_data->>'discount_pct')::numeric, 2);
    v_start := (p_data->>'starts_at')::timestamptz;
    v_end := (p_data->>'ends_at')::timestamptz;
    SELECT coalesce(array_agg(pr.id), '{}') INTO v_ids FROM public.products pr
      WHERE pr.partner_id = p_partner AND pr.id IN (SELECT x::uuid FROM jsonb_array_elements_text(coalesce(p_data->'product_ids', '[]'::jsonb)) x);
  EXCEPTION WHEN others THEN RAISE EXCEPTION 'CAMPAIGN_INVALID' USING ERRCODE = '22023';
  END;
  IF length(v_title) NOT BETWEEN 2 AND 120 THEN RAISE EXCEPTION 'CAMPAIGN_TITLE' USING ERRCODE = '22023'; END IF;
  IF v_pct IS NULL OR v_pct < 1 OR v_pct > 90 THEN RAISE EXCEPTION 'CAMPAIGN_DISCOUNT' USING ERRCODE = '22023'; END IF;
  IF v_start IS NULL OR v_end IS NULL OR v_end <= v_start OR v_end > v_start + interval '180 days' OR v_end < now() THEN
    RAISE EXCEPTION 'CAMPAIGN_DATES' USING ERRCODE = '22023';
  END IF;
  IF v_desc IS NOT NULL AND length(v_desc) > 1000 THEN RAISE EXCEPTION 'CAMPAIGN_DESCRIPTION' USING ERRCODE = '22023'; END IF;
  -- Anacan admins publish directly; partner changes wait for review.
  v_status := CASE WHEN r = 'admin' THEN 'approved' ELSE 'pending' END;
  IF p_campaign IS NULL THEN
    INSERT INTO public.shop_partner_campaigns (partner_id, title, description, discount_pct, product_ids, starts_at, ends_at, status, created_by,
                                               reviewed_by, reviewed_at)
      VALUES (p_partner, v_title, v_desc, v_pct, v_ids, v_start, v_end, v_status, auth.uid(),
              CASE WHEN r = 'admin' THEN auth.uid() END, CASE WHEN r = 'admin' THEN now() END)
      RETURNING id INTO new_id;
  ELSE
    UPDATE public.shop_partner_campaigns SET title = v_title, description = v_desc, discount_pct = v_pct, product_ids = v_ids,
        starts_at = v_start, ends_at = v_end, status = v_status, review_note = NULL,
        reviewed_by = CASE WHEN r = 'admin' THEN auth.uid() END, reviewed_at = CASE WHEN r = 'admin' THEN now() END, updated_at = now()
      WHERE id = p_campaign AND partner_id = p_partner AND status <> 'cancelled'
      RETURNING id INTO new_id;
    IF new_id IS NULL THEN RAISE EXCEPTION 'CAMPAIGN_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  END IF;
  PERFORM public._shop_partner_log(p_partner, CASE WHEN p_campaign IS NULL THEN 'campaign_created' ELSE 'campaign_updated' END, new_id,
    jsonb_build_object('title', v_title, 'discount_pct', v_pct, 'starts_at', v_start, 'ends_at', v_end, 'products', cardinality(v_ids), 'status', v_status));
  RETURN new_id;
END $$;

CREATE OR REPLACE FUNCTION public.shop_partner_campaign_cancel_v1(p_partner uuid, p_campaign uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  PERFORM public._shop_partner_need(p_partner, 'manager');
  UPDATE public.shop_partner_campaigns SET status = 'cancelled', updated_at = now() WHERE id = p_campaign AND partner_id = p_partner;
  IF NOT FOUND THEN RAISE EXCEPTION 'CAMPAIGN_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  PERFORM public._shop_partner_log(p_partner, 'campaign_cancelled', p_campaign, '{}'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.shop_partner_sales_v1(p_partner uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  PERFORM public._shop_partner_need(p_partner, 'viewer');
  RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'sale_date', s.sale_date, 'product_id', s.product_id, 'product_name', pr.name,
      'quantity', s.quantity, 'revenue', s.revenue, 'channel', s.channel, 'note', s.note, 'created_at', s.created_at) ORDER BY s.sale_date DESC, s.created_at DESC), '[]'::jsonb)
    FROM public.shop_partner_sales s LEFT JOIN public.products pr ON pr.id = s.product_id
    WHERE s.partner_id = p_partner AND s.sale_date BETWEEN coalesce(p_from, '2000-01-01') AND coalesce(p_to, '2100-01-01'));
END $$;

CREATE OR REPLACE FUNCTION public.shop_partner_sale_save_v1(p_partner uuid, p_sale uuid, p_data jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_date date; v_qty integer; v_rev numeric; v_prod uuid; v_channel text := coalesce(nullif(p_data->>'channel', ''), 'partner_site');
  v_note text := nullif(btrim(coalesce(p_data->>'note', '')), ''); new_id uuid;
BEGIN
  PERFORM public._shop_partner_need(p_partner, 'manager');
  BEGIN
    v_date := (p_data->>'sale_date')::date; v_qty := (p_data->>'quantity')::integer; v_rev := round((p_data->>'revenue')::numeric, 2);
    v_prod := nullif(p_data->>'product_id', '')::uuid;
  EXCEPTION WHEN others THEN RAISE EXCEPTION 'SALE_INVALID' USING ERRCODE = '22023';
  END;
  IF v_date IS NULL OR v_date > (now() AT TIME ZONE 'Asia/Baku')::date OR v_date < '2026-01-01' THEN RAISE EXCEPTION 'SALE_DATE' USING ERRCODE = '22023'; END IF;
  IF v_qty IS NULL OR v_qty NOT BETWEEN 1 AND 100000 THEN RAISE EXCEPTION 'SALE_QUANTITY' USING ERRCODE = '22023'; END IF;
  IF v_rev IS NULL OR v_rev < 0 OR v_rev > 10000000 THEN RAISE EXCEPTION 'SALE_REVENUE' USING ERRCODE = '22023'; END IF;
  IF v_channel NOT IN ('partner_site', 'app', 'other') THEN RAISE EXCEPTION 'SALE_CHANNEL' USING ERRCODE = '22023'; END IF;
  IF v_note IS NOT NULL AND length(v_note) > 500 THEN RAISE EXCEPTION 'SALE_NOTE' USING ERRCODE = '22023'; END IF;
  IF v_prod IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.products WHERE id = v_prod AND partner_id = p_partner) THEN
    RAISE EXCEPTION 'PRODUCT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF p_sale IS NULL THEN
    INSERT INTO public.shop_partner_sales (partner_id, product_id, sale_date, quantity, revenue, channel, note, created_by)
      VALUES (p_partner, v_prod, v_date, v_qty, v_rev, v_channel, v_note, auth.uid()) RETURNING id INTO new_id;
  ELSE
    UPDATE public.shop_partner_sales SET product_id = v_prod, sale_date = v_date, quantity = v_qty, revenue = v_rev, channel = v_channel, note = v_note
      WHERE id = p_sale AND partner_id = p_partner RETURNING id INTO new_id;
    IF new_id IS NULL THEN RAISE EXCEPTION 'SALE_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  END IF;
  PERFORM public._shop_partner_log(p_partner, CASE WHEN p_sale IS NULL THEN 'sale_added' ELSE 'sale_updated' END, new_id,
    jsonb_build_object('date', v_date, 'quantity', v_qty, 'revenue', v_rev, 'product', v_prod));
  RETURN new_id;
END $$;

CREATE OR REPLACE FUNCTION public.shop_partner_sale_delete_v1(p_partner uuid, p_sale uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  PERFORM public._shop_partner_need(p_partner, 'manager');
  DELETE FROM public.shop_partner_sales WHERE id = p_sale AND partner_id = p_partner;
  IF NOT FOUND THEN RAISE EXCEPTION 'SALE_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  PERFORM public._shop_partner_log(p_partner, 'sale_deleted', p_sale, '{}'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.shop_partner_team_v1(p_partner uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  PERFORM public._shop_partner_need(p_partner, 'viewer');
  RETURN jsonb_build_object(
    'members', (SELECT coalesce(jsonb_agg(jsonb_build_object('user_id', m.user_id, 'email', u.email, 'role', m.role, 'created_at', m.created_at,
        'me', m.user_id = auth.uid()) ORDER BY m.created_at), '[]'::jsonb)
      FROM public.shop_partner_members m LEFT JOIN auth.users u ON u.id = m.user_id WHERE m.partner_id = p_partner),
    'invites', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'email', i.email, 'role', i.role, 'expires_at', i.expires_at, 'created_at', i.created_at)
        ORDER BY i.created_at DESC), '[]'::jsonb)
      FROM public.shop_partner_invites i WHERE i.partner_id = p_partner AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > now()));
END $$;

CREATE OR REPLACE FUNCTION public.shop_partner_invite_v1(p_partner uuid, p_email text, p_role text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''); v_email text := lower(btrim(coalesce(p_email, ''))); new_id uuid;
BEGIN
  PERFORM public._shop_partner_need(p_partner, 'owner');
  IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(v_email) > 200 THEN RAISE EXCEPTION 'INVITE_EMAIL' USING ERRCODE = '22023'; END IF;
  IF p_role NOT IN ('owner', 'manager', 'viewer') THEN RAISE EXCEPTION 'INVITE_ROLE' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.shop_partner_invites (partner_id, email, role, token_hash, expires_at, created_by)
    VALUES (p_partner, v_email, p_role, encode(sha256(convert_to(token, 'UTF8')), 'hex'), now() + interval '14 days', auth.uid())
    RETURNING id INTO new_id;
  PERFORM public._shop_partner_log(p_partner, 'invite_created', new_id, jsonb_build_object('email', v_email, 'role', p_role));
  RETURN jsonb_build_object('id', new_id, 'token', token);
END $$;

CREATE OR REPLACE FUNCTION public.shop_partner_invite_revoke_v1(p_partner uuid, p_invite uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  PERFORM public._shop_partner_need(p_partner, 'owner');
  UPDATE public.shop_partner_invites SET revoked_at = now() WHERE id = p_invite AND partner_id = p_partner AND accepted_at IS NULL;
  PERFORM public._shop_partner_log(p_partner, 'invite_revoked', p_invite, '{}'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.shop_partner_member_set_v1(p_partner uuid, p_user uuid, p_role text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE r text;
BEGIN
  r := public._shop_partner_need(p_partner, 'owner');
  IF p_user = auth.uid() AND r <> 'admin' THEN RAISE EXCEPTION 'MEMBER_SELF' USING ERRCODE = '42501'; END IF;
  IF p_role IS NULL THEN
    DELETE FROM public.shop_partner_members WHERE partner_id = p_partner AND user_id = p_user;
  ELSIF p_role IN ('owner', 'manager', 'viewer') THEN
    UPDATE public.shop_partner_members SET role = p_role WHERE partner_id = p_partner AND user_id = p_user;
  ELSE
    RAISE EXCEPTION 'MEMBER_ROLE' USING ERRCODE = '22023';
  END IF;
  PERFORM public._shop_partner_log(p_partner, CASE WHEN p_role IS NULL THEN 'member_removed' ELSE 'member_role' END, p_user, jsonb_build_object('role', p_role));
END $$;

CREATE OR REPLACE FUNCTION public.shop_partner_audit_v1(p_partner uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  PERFORM public._shop_partner_need(p_partner, 'viewer');
  RETURN (SELECT coalesce(jsonb_agg(x ORDER BY x.created_at DESC), '[]'::jsonb) FROM (
    SELECT a.id, a.action, a.target, a.payload, a.created_at, u.email AS actor_email
    FROM public.shop_partner_audit a LEFT JOIN auth.users u ON u.id = a.actor
    WHERE a.partner_id = p_partner ORDER BY a.created_at DESC LIMIT 300) x);
END $$;

-- ───────────── Anacan admin ─────────────
CREATE OR REPLACE FUNCTION public.shop_partner_admin_list_v1()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN RAISE EXCEPTION 'ADMIN_ONLY' USING ERRCODE = '42501'; END IF;
  RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'slug', p.slug, 'name', p.name, 'logo_url', p.logo_url, 'icon_url', p.icon_url,
      'website_url', p.website_url, 'brand_color', p.brand_color, 'status', p.status, 'commission_pct', p.commission_pct,
      'contact_email', p.contact_email, 'notes', p.notes, 'created_at', p.created_at,
      'products', (SELECT count(*) FROM public.products pr WHERE pr.partner_id = p.id),
      'listed', (SELECT count(*) FROM public.products pr WHERE pr.partner_id = p.id AND pr.partner_listed),
      'members', (SELECT count(*) FROM public.shop_partner_members m WHERE m.partner_id = p.id),
      'pending_campaigns', (SELECT count(*) FROM public.shop_partner_campaigns c WHERE c.partner_id = p.id AND c.status = 'pending'),
      'events_30d', (SELECT count(*) FROM public.shop_partner_events e WHERE e.partner_id = p.id AND NOT e.internal AND e.created_at > now() - interval '30 days'))
      ORDER BY p.name), '[]'::jsonb)
    FROM public.shop_partners p);
END $$;

CREATE OR REPLACE FUNCTION public.shop_partner_admin_save_v1(p_partner uuid, p_data jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE new_id uuid; v_status text := coalesce(nullif(p_data->>'status', ''), 'admin_only');
  v_comm numeric;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN RAISE EXCEPTION 'ADMIN_ONLY' USING ERRCODE = '42501'; END IF;
  BEGIN v_comm := nullif(p_data->>'commission_pct', '')::numeric; EXCEPTION WHEN others THEN RAISE EXCEPTION 'PARTNER_COMMISSION' USING ERRCODE = '22023'; END;
  IF p_partner IS NULL THEN
    INSERT INTO public.shop_partners (slug, name, logo_url, icon_url, website_url, brand_color, status, commission_pct, contact_email, notes)
      VALUES (lower(btrim(p_data->>'slug')), btrim(p_data->>'name'), nullif(btrim(coalesce(p_data->>'logo_url', '')), ''),
              nullif(btrim(coalesce(p_data->>'icon_url', '')), ''), nullif(btrim(coalesce(p_data->>'website_url', '')), ''),
              coalesce(nullif(p_data->>'brand_color', ''), '#8A2BE2'), v_status, v_comm,
              nullif(btrim(coalesce(p_data->>'contact_email', '')), ''), nullif(btrim(coalesce(p_data->>'notes', '')), ''))
      RETURNING id INTO new_id;
  ELSE
    UPDATE public.shop_partners SET name = btrim(p_data->>'name'), logo_url = nullif(btrim(coalesce(p_data->>'logo_url', '')), ''),
        icon_url = nullif(btrim(coalesce(p_data->>'icon_url', '')), ''), website_url = nullif(btrim(coalesce(p_data->>'website_url', '')), ''),
        brand_color = coalesce(nullif(p_data->>'brand_color', ''), brand_color), status = v_status, commission_pct = v_comm,
        contact_email = nullif(btrim(coalesce(p_data->>'contact_email', '')), ''), notes = nullif(btrim(coalesce(p_data->>'notes', '')), ''), updated_at = now()
      WHERE id = p_partner RETURNING id INTO new_id;
    IF new_id IS NULL THEN RAISE EXCEPTION 'PARTNER_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  END IF;
  PERFORM public._shop_partner_log(new_id, CASE WHEN p_partner IS NULL THEN 'partner_created' ELSE 'partner_updated' END, new_id,
    jsonb_build_object('status', v_status, 'commission_pct', v_comm));
  RETURN new_id;
END $$;

CREATE OR REPLACE FUNCTION public.shop_partner_campaign_review_v1(p_campaign uuid, p_decision text, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE pid uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN RAISE EXCEPTION 'ADMIN_ONLY' USING ERRCODE = '42501'; END IF;
  IF p_decision NOT IN ('approved', 'rejected') THEN RAISE EXCEPTION 'CAMPAIGN_DECISION' USING ERRCODE = '22023'; END IF;
  UPDATE public.shop_partner_campaigns SET status = p_decision, review_note = left(nullif(btrim(coalesce(p_note, '')), ''), 1000),
      reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
    WHERE id = p_campaign AND status IN ('pending', 'approved', 'rejected') RETURNING partner_id INTO pid;
  IF pid IS NULL THEN RAISE EXCEPTION 'CAMPAIGN_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  PERFORM public._shop_partner_log(pid, 'campaign_' || p_decision, p_campaign, jsonb_build_object('note', p_note));
END $$;

CREATE OR REPLACE FUNCTION public.shop_partner_admin_pending_v1()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN RAISE EXCEPTION 'ADMIN_ONLY' USING ERRCODE = '42501'; END IF;
  RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'partner_id', c.partner_id, 'partner_name', p.name, 'title', c.title,
      'description', c.description, 'discount_pct', c.discount_pct, 'products', cardinality(c.product_ids), 'starts_at', c.starts_at,
      'ends_at', c.ends_at, 'created_at', c.created_at) ORDER BY c.created_at), '[]'::jsonb)
    FROM public.shop_partner_campaigns c JOIN public.shop_partners p ON p.id = c.partner_id WHERE c.status = 'pending');
END $$;

CREATE OR REPLACE FUNCTION public.shop_partner_admin_clear_v1(p_partner uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE n integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN RAISE EXCEPTION 'ADMIN_ONLY' USING ERRCODE = '42501'; END IF;
  DELETE FROM public.products WHERE partner_id = p_partner;
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM public._shop_partner_log(p_partner, 'products_cleared', NULL, jsonb_build_object('count', n));
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.shop_partner_admin_import_v1(p_partner uuid, p_rows jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE item jsonb; n integer := 0; total integer; new_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN RAISE EXCEPTION 'ADMIN_ONLY' USING ERRCODE = '42501'; END IF;
  IF jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) > 1000 THEN RAISE EXCEPTION 'IMPORT_ROWS' USING ERRCODE = '22023'; END IF;
  total := jsonb_array_length(p_rows);
  DELETE FROM public.products WHERE partner_id = p_partner;
  FOR item IN SELECT value FROM jsonb_array_elements(p_rows) WITH ORDINALITY ORDER BY ordinality LOOP
    new_id := public.shop_partner_product_save_v1(p_partner, NULL, item);
    -- Keep the catalog order: sales_count carries the rank (nothing else reads it for partner rows).
    UPDATE public.products SET sales_count = total - n WHERE id = new_id;
    n := n + 1;
  END LOOP;
  PERFORM public._shop_partner_log(p_partner, 'products_imported', NULL, jsonb_build_object('count', n));
  RETURN n;
END $$;

-- ───────────── grants ─────────────
DO $$
DECLARE f regprocedure;
BEGIN
  FOR f IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND (p.proname LIKE 'shop\_partner\_%' OR p.proname LIKE '\_shop\_%' OR p.proname = 'shop_storefront_v1') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
  FOR f IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND (p.proname LIKE 'shop\_partner\_%' OR p.proname = 'shop_storefront_v1') LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP;
  GRANT EXECUTE ON FUNCTION public.shop_storefront_v1() TO anon;
END $$;

-- ───────────── seed: Olivia, and the products imported on 2026-11-16 ─────────────
INSERT INTO public.shop_partners (slug, name, logo_url, icon_url, website_url, brand_color, status, notes)
VALUES ('olivia', 'Olivia', '/partners/olivia/logo.png', '/partners/olivia/icon.png', 'https://olivia.az', '#9B16D9', 'admin_only',
        'Olivia.az e-commerce tərəfdaşlığı (2026-11-16). Birinci mərhələ: satış olivia.az-da, UTM ilə.')
ON CONFLICT (slug) DO NOTHING;
UPDATE public.products SET partner_id = (SELECT id FROM public.shop_partners WHERE slug = 'olivia')
  WHERE store = 'olivia' AND partner_id IS NULL;

DO $$
BEGIN
  IF (SELECT count(*) FROM _anacan_gcp_migration.guarded_relations WHERE schema_name = 'public' AND table_name IN
       ('shop_partners', 'shop_partner_members', 'shop_partner_invites', 'shop_partner_events', 'shop_partner_campaigns', 'shop_partner_sales', 'shop_partner_audit')) <> 7
     OR (SELECT count(*) FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relname LIKE 'shop\_partner%'
            AND tg.tgname IN ('anacan_gcp_writer_guard', 'anacan_gcp_change', 'anacan_gcp_truncate')) <> 21 THEN
    RAISE EXCEPTION 'SHOP_PARTNERS_GUARD_ENROLLMENT_INCOMPLETE';
  END IF;
  IF EXISTS (SELECT 1 FROM public.products WHERE store = 'olivia' AND partner_id IS NULL) THEN RAISE EXCEPTION 'SHOP_PARTNERS_OLIVIA_LINK'; END IF;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
