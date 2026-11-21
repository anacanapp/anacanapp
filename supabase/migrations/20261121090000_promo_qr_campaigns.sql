-- QR Premium campaigns (owner 2026-11-21): everyone who signs up through a campaign QR / code gets Anacan Premium
-- automatically. Each campaign sets its own duration, who may redeem (new accounts only or everyone), a use limit and
-- a date window; admins create and switch campaigns in Admin › QR kampaniyalar.
--
-- Relations (both CDC + writer guard, RLS on, no client table grants; access only through the RPCs below):
--   promo_campaigns    code (shown in the QR link app.anacan.az/h/<CODE>), title, duration, eligibility, limits
--   promo_redemptions  one row per user and campaign: reserved → granted | failed
-- The grant itself is a RevenueCat promotional entitlement made by the promo-redeem function, so it survives the
-- store sync like a purchase (profile flags alone are overwritten; see docs/REVENUECAT_PROMOTIONAL_PREMIUM.md).
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

DO $$
BEGIN
  IF to_regclass('_anacan_gcp_migration.guarded_relations') IS NULL THEN RAISE EXCEPTION 'PROMO_GUARD_CATALOG_MISSING'; END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.promo_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9][A-Z0-9-]{2,31}$'),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 80),
  duration text NOT NULL CHECK (duration IN ('weekly', 'monthly', 'two_month', 'three_month', 'six_month', 'yearly', 'lifetime')),
  eligibility text NOT NULL DEFAULT 'new_users' CHECK (eligibility IN ('new_users', 'everyone')),
  new_user_days integer NOT NULL DEFAULT 7 CHECK (new_user_days BETWEEN 1 AND 90),
  max_uses integer CHECK (max_uses IS NULL OR max_uses BETWEEN 1 AND 1000000),
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  notes text CHECK (notes IS NULL OR length(notes) <= 1000),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS public.promo_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.promo_campaigns(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'granted', 'failed')),
  note text CHECK (note IS NULL OR length(note) <= 200),
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  UNIQUE (campaign_id, user_id)
);
CREATE INDEX IF NOT EXISTS promo_redemptions_campaign_idx ON public.promo_redemptions (campaign_id, status);
-- One campaign Premium per person: a second QR cannot stack another gift on the same account.
CREATE UNIQUE INDEX IF NOT EXISTS promo_redemptions_one_granted_per_user ON public.promo_redemptions (user_id) WHERE status = 'granted';

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['promo_campaigns', 'promo_redemptions'] LOOP
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

-- A reservation that never finished (function crash) stops counting after 10 minutes.
CREATE OR REPLACE FUNCTION public._promo_used(p_campaign uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT count(*)::integer FROM public.promo_redemptions
  WHERE campaign_id = p_campaign AND (status = 'granted' OR (status = 'reserved' AND created_at > now() - interval '10 minutes'))
$$;

CREATE OR REPLACE FUNCTION public._promo_state(c public.promo_campaigns)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT CASE
    WHEN NOT c.is_active THEN 'inactive'
    WHEN c.starts_at > now() THEN 'not_started'
    WHEN c.ends_at IS NOT NULL AND c.ends_at <= now() THEN 'expired'
    WHEN c.max_uses IS NOT NULL AND public._promo_used(c.id) >= c.max_uses THEN 'full'
    ELSE 'active'
  END
$$;

-- Landing page (anon too): is this code usable and what does it give? No counts or internal notes leave the server.
CREATE OR REPLACE FUNCTION public.promo_campaign_public_v1(p_code text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE c public.promo_campaigns;
BEGIN
  SELECT * INTO c FROM public.promo_campaigns WHERE code = upper(btrim(coalesce(p_code, '')));
  IF NOT FOUND THEN RETURN jsonb_build_object('state', 'not_found'); END IF;
  RETURN jsonb_build_object('state', public._promo_state(c), 'code', c.code, 'title', c.title, 'duration', c.duration,
    'eligibility', c.eligibility, 'ends_at', c.ends_at);
END $$;

-- Called by the promo-redeem function (service role) before the RevenueCat grant.
CREATE OR REPLACE FUNCTION public.promo_reserve_v1(p_user uuid, p_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE c public.promo_campaigns; st text; created timestamptz; prev public.promo_redemptions; rid uuid;
BEGIN
  IF p_user IS NULL THEN RAISE EXCEPTION 'PROMO_USER' USING ERRCODE = '22023'; END IF;
  SELECT * INTO c FROM public.promo_campaigns WHERE code = upper(btrim(coalesce(p_code, ''))) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROMO_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  st := public._promo_state(c);
  IF st <> 'active' THEN RAISE EXCEPTION 'PROMO_%', upper(st) USING ERRCODE = '22023'; END IF;
  IF EXISTS (SELECT 1 FROM public.promo_redemptions WHERE user_id = p_user AND status = 'granted') THEN
    RAISE EXCEPTION 'PROMO_ALREADY_USED' USING ERRCODE = '23505';
  END IF;
  IF c.eligibility = 'new_users' THEN
    SELECT u.created_at INTO created FROM auth.users u WHERE u.id = p_user;
    IF created IS NULL OR created < now() - make_interval(days => c.new_user_days) THEN
      RAISE EXCEPTION 'PROMO_NOT_NEW_USER' USING ERRCODE = '22023';
    END IF;
  END IF;
  SELECT * INTO prev FROM public.promo_redemptions WHERE campaign_id = c.id AND user_id = p_user FOR UPDATE;
  IF FOUND THEN
    IF prev.status = 'reserved' AND prev.created_at > now() - interval '10 minutes' THEN RAISE EXCEPTION 'PROMO_IN_PROGRESS' USING ERRCODE = '55P03'; END IF;
    UPDATE public.promo_redemptions SET status = 'reserved', created_at = now(), finished_at = NULL, note = NULL WHERE id = prev.id RETURNING id INTO rid;
  ELSE
    INSERT INTO public.promo_redemptions (campaign_id, user_id) VALUES (c.id, p_user) RETURNING id INTO rid;
  END IF;
  RETURN jsonb_build_object('redemption_id', rid, 'duration', c.duration, 'title', c.title);
END $$;

CREATE OR REPLACE FUNCTION public.promo_finish_v1(p_redemption uuid, p_success boolean, p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  UPDATE public.promo_redemptions SET status = CASE WHEN p_success THEN 'granted' ELSE 'failed' END,
    finished_at = now(), note = left(p_note, 200)
  WHERE id = p_redemption AND status = 'reserved';
END $$;

-- ───────────── admin ─────────────
CREATE OR REPLACE FUNCTION public._promo_require_admin()
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN RAISE EXCEPTION 'ADMIN_ONLY' USING ERRCODE = '42501'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.promo_admin_list_v1()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  PERFORM public._promo_require_admin();
  RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', c.id, 'code', c.code, 'title', c.title, 'duration', c.duration, 'eligibility', c.eligibility,
      'new_user_days', c.new_user_days, 'max_uses', c.max_uses, 'starts_at', c.starts_at, 'ends_at', c.ends_at,
      'is_active', c.is_active, 'notes', c.notes, 'created_at', c.created_at, 'state', public._promo_state(c),
      'granted', (SELECT count(*) FROM public.promo_redemptions r WHERE r.campaign_id = c.id AND r.status = 'granted'),
      'failed', (SELECT count(*) FROM public.promo_redemptions r WHERE r.campaign_id = c.id AND r.status = 'failed'),
      'last_granted_at', (SELECT max(r.finished_at) FROM public.promo_redemptions r WHERE r.campaign_id = c.id AND r.status = 'granted'))
    ORDER BY c.created_at DESC), '[]'::jsonb) FROM public.promo_campaigns c);
END $$;

CREATE OR REPLACE FUNCTION public.promo_admin_save_v1(p_id uuid, p_data jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_id uuid; v_code text := upper(btrim(coalesce(p_data->>'code', '')));
BEGIN
  PERFORM public._promo_require_admin();
  IF p_id IS NULL THEN
    INSERT INTO public.promo_campaigns (code, title, duration, eligibility, new_user_days, max_uses, starts_at, ends_at, is_active, notes, created_by)
    VALUES (v_code, btrim(coalesce(p_data->>'title', '')), p_data->>'duration', coalesce(p_data->>'eligibility', 'new_users'),
      coalesce((p_data->>'new_user_days')::integer, 7), nullif(p_data->>'max_uses', '')::integer,
      coalesce(nullif(p_data->>'starts_at', '')::timestamptz, now()), nullif(p_data->>'ends_at', '')::timestamptz,
      coalesce((p_data->>'is_active')::boolean, true), nullif(btrim(coalesce(p_data->>'notes', '')), ''), auth.uid())
    RETURNING id INTO v_id;
  ELSE
    -- The code is printed on QR posters, so it never changes after creation.
    UPDATE public.promo_campaigns SET title = btrim(coalesce(p_data->>'title', title)), duration = coalesce(p_data->>'duration', duration),
      eligibility = coalesce(p_data->>'eligibility', eligibility), new_user_days = coalesce((p_data->>'new_user_days')::integer, new_user_days),
      max_uses = CASE WHEN p_data ? 'max_uses' THEN nullif(p_data->>'max_uses', '')::integer ELSE max_uses END,
      starts_at = coalesce(nullif(p_data->>'starts_at', '')::timestamptz, starts_at),
      ends_at = CASE WHEN p_data ? 'ends_at' THEN nullif(p_data->>'ends_at', '')::timestamptz ELSE ends_at END,
      is_active = coalesce((p_data->>'is_active')::boolean, is_active),
      notes = CASE WHEN p_data ? 'notes' THEN nullif(btrim(coalesce(p_data->>'notes', '')), '') ELSE notes END,
      updated_at = now()
    WHERE id = p_id RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'PROMO_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  END IF;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.promo_admin_redemptions_v1(p_campaign uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  PERFORM public._promo_require_admin();
  RETURN (SELECT coalesce(jsonb_agg(x ORDER BY x->>'created_at' DESC), '[]'::jsonb) FROM (
    SELECT jsonb_build_object('id', r.id, 'user_id', r.user_id, 'status', r.status, 'note', r.note, 'created_at', r.created_at,
      'finished_at', r.finished_at, 'name', p.name, 'email', u.email) AS x
    FROM public.promo_redemptions r
    LEFT JOIN public.profiles p ON p.user_id = r.user_id
    LEFT JOIN auth.users u ON u.id = r.user_id
    WHERE r.campaign_id = p_campaign
    ORDER BY r.created_at DESC LIMIT 500) s);
END $$;

-- ───────────── grants ─────────────
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['_promo_used(uuid)', '_promo_state(public.promo_campaigns)', 'promo_campaign_public_v1(text)',
    'promo_reserve_v1(uuid,text)', 'promo_finish_v1(uuid,boolean,text)', '_promo_require_admin()', 'promo_admin_list_v1()',
    'promo_admin_save_v1(uuid,jsonb)', 'promo_admin_redemptions_v1(uuid)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', f);
  END LOOP;
  GRANT EXECUTE ON FUNCTION public.promo_campaign_public_v1(text) TO anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.promo_admin_list_v1() TO authenticated;
  GRANT EXECUTE ON FUNCTION public.promo_admin_save_v1(uuid, jsonb) TO authenticated;
  GRANT EXECUTE ON FUNCTION public.promo_admin_redemptions_v1(uuid) TO authenticated;
END $$;

DO $$
BEGIN
  IF (SELECT count(*) FROM _anacan_gcp_migration.guarded_relations WHERE schema_name = 'public' AND table_name IN ('promo_campaigns', 'promo_redemptions')) <> 2
     OR (SELECT count(*) FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relname IN ('promo_campaigns', 'promo_redemptions')
            AND tg.tgname IN ('anacan_gcp_writer_guard', 'anacan_gcp_change', 'anacan_gcp_truncate')) <> 6 THEN
    RAISE EXCEPTION 'PROMO_GUARD_ENROLLMENT_INCOMPLETE';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
