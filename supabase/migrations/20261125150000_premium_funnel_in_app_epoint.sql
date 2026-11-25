-- Premium purchase funnel, source attribution and in-app Epoint card payment (owner requests 2026-11-25).
--
-- 1) app_settings.in_app_epoint = {enabled, countries[], platforms:{android, ios, web}}: whether the app paywall offers
--    "pay with an Azerbaijani card (Epoint)" next to the store purchase. Seeded for AZ with Android + web on and iOS
--    off (Apple 3.1.1: the owner switches iOS on only after a store review decision). Added to the public allowlist of
--    get_public_app_setting in place (pg_get_functiondef), so every key added on the live database since is kept, as in
--    20261113230000_daily_quiz_tool.sql. web-premium re-checks the setting on the server for page 'app'.
--
-- 2) Funnel and attribution, inside the app's privacy model (internal analytics_events are consent-gated):
--    premium_funnel_daily       day × event × source × platform × life_stage × country → count. No user id.
--    premium_funnel_throttle    (user, event, source) → last hit; keeps "paywall_shown" to once per source per 10 min.
--                               Operational only, never reported; rows older than a day are removed on the user's next hit.
--    premium_purchase_intents   the moment a user taps buy (source, platform, plan): the transactional record that lets a
--                               purchase be attributed to the paywall placement that sold it. Kept 90 days per user.
--    premium_purchases          one row per paid period start (store purchase / renewal, Epoint charge, promotional grant),
--                               written only by the server (revenuecat-sync, Epoint callback) through
--                               premium_purchase_record_v1; idempotent on provider_ref. source = the user's latest intent
--                               in the 48 h before the purchase, 'renewal' for renewals, else 'unknown'.
--    admin_premium_funnel_v1    admin-only report: funnel by source / platform / country / stage, purchases by source,
--                               cancellations by reason (subscription_cancellations).
--
-- All four relations: RLS on, no client table grants (RPCs only), CDC + writer guard (.cdc.json next to this file).
-- Apply with /home/anacan-runner/run-sql.py on anacan-gcp-candidate. Not applied by the author of this migration.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

DO $$
BEGIN
  IF to_regclass('_anacan_gcp_migration.guarded_relations') IS NULL THEN RAISE EXCEPTION 'PREMIUM_FUNNEL_GUARD_CATALOG_MISSING'; END IF;
  IF (SELECT count(*) FROM _anacan_gcp_migration.guarded_relations WHERE schema_name = 'public' AND table_name = 'app_settings') <> 1 THEN
    RAISE EXCEPTION 'PREMIUM_FUNNEL_APP_SETTINGS_GUARD_MISSING';
  END IF;
END $$;

-- ───────────── relations ─────────────
CREATE TABLE IF NOT EXISTS public.premium_funnel_daily (
  day date NOT NULL,
  event text NOT NULL CHECK (event IN ('paywall_shown', 'paywall_clicked', 'purchase_started', 'purchase_cancelled',
                                       'purchase_failed', 'purchase_pending', 'restore_clicked', 'epoint_started')),
  source text NOT NULL CHECK (source ~ '^[a-z0-9_:.-]{1,48}$'),
  platform text NOT NULL CHECK (platform IN ('ios', 'android', 'web', 'unknown')),
  life_stage text NOT NULL CHECK (life_stage IN ('flow', 'bump', 'mommy', 'partner', 'unknown')),
  country text NOT NULL CHECK (country ~ '^[A-Z]{2}$'),
  count integer NOT NULL DEFAULT 0 CHECK (count >= 0),
  PRIMARY KEY (day, event, source, platform, life_stage, country)
);

CREATE TABLE IF NOT EXISTS public.premium_funnel_throttle (
  user_id uuid NOT NULL,
  event text NOT NULL,
  source text NOT NULL,
  last_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, event, source)
);
CREATE INDEX IF NOT EXISTS premium_funnel_throttle_user_idx ON public.premium_funnel_throttle (user_id, last_at DESC);

CREATE TABLE IF NOT EXISTS public.premium_purchase_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source text NOT NULL CHECK (source ~ '^[a-z0-9_:.-]{1,48}$'),
  platform text NOT NULL CHECK (platform IN ('ios', 'android', 'web', 'unknown')),
  plan text NOT NULL CHECK (plan IN ('monthly', 'yearly', 'lifetime', 'offer', 'unknown')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS premium_purchase_intents_user_idx ON public.premium_purchase_intents (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.premium_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL CHECK (provider IN ('app_store', 'play_store', 'epoint', 'promo', 'other')),
  product_id text CHECK (product_id IS NULL OR length(product_id) <= 160),
  plan text NOT NULL CHECK (plan IN ('monthly', 'yearly', 'lifetime', 'other')),
  amount numeric(12, 2) CHECK (amount IS NULL OR amount >= 0),
  currency text CHECK (currency IS NULL OR currency ~ '^[A-Z]{3}$'),
  source text NOT NULL CHECK (source ~ '^[a-z0-9_:.-]{1,48}$'),
  platform text NOT NULL CHECK (platform IN ('ios', 'android', 'web', 'unknown')),
  first_purchase boolean NOT NULL DEFAULT false,
  provider_ref text NOT NULL UNIQUE CHECK (length(provider_ref) BETWEEN 3 AND 200),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS premium_purchases_user_idx ON public.premium_purchases (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS premium_purchases_created_idx ON public.premium_purchases (created_at DESC);

DO $$
DECLARE t text; pk text[];
BEGIN
  FOREACH t IN ARRAY ARRAY['premium_funnel_daily', 'premium_funnel_throttle', 'premium_purchase_intents', 'premium_purchases'] LOOP
    pk := CASE t WHEN 'premium_funnel_daily' THEN ARRAY['day', 'event', 'source', 'platform', 'life_stage', 'country']
                 WHEN 'premium_funnel_throttle' THEN ARRAY['user_id', 'event', 'source']
                 ELSE ARRAY['id'] END;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    INSERT INTO _anacan_gcp_migration.guarded_relations (schema_name, table_name, primary_key) VALUES ('public', t, pk) ON CONFLICT DO NOTHING;
    EXECUTE format('DROP TRIGGER IF EXISTS anacan_gcp_writer_guard ON public.%I', t);
    EXECUTE format('DROP TRIGGER IF EXISTS anacan_gcp_change ON public.%I', t);
    EXECUTE format('DROP TRIGGER IF EXISTS anacan_gcp_truncate ON public.%I', t);
    EXECUTE format('CREATE TRIGGER anacan_gcp_writer_guard BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION _anacan_gcp_migration.guard_write()', t);
    EXECUTE format('CREATE TRIGGER anacan_gcp_change AFTER INSERT OR DELETE OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION _anacan_gcp_migration.capture_change()', t);
    EXECUTE format('CREATE TRIGGER anacan_gcp_truncate AFTER TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION _anacan_gcp_migration.capture_change()', t);
  END LOOP;
END $$;

-- ───────────── normalisers ─────────────
CREATE OR REPLACE FUNCTION public._premium_funnel_source(p text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = pg_catalog, public AS $$
  SELECT CASE WHEN v ~ '^[a-z0-9_:.-]{1,48}$' THEN v ELSE 'other' END
  FROM (SELECT left(regexp_replace(lower(btrim(coalesce(p, ''))), '[^a-z0-9_:.-]+', '_', 'g'), 48) AS v) s
$$;

CREATE OR REPLACE FUNCTION public._premium_funnel_platform(p text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = pg_catalog, public AS $$
  SELECT CASE WHEN lower(coalesce(p, '')) IN ('ios', 'android', 'web') THEN lower(p) ELSE 'unknown' END
$$;

-- ───────────── user RPCs ─────────────
-- Fire-and-forget counter from the paywall. Country and (fallback) life stage come from the caller's profile.
-- Returns true when counted, false when throttled / ignored (never raises for bad input: the client never waits on it).
CREATE OR REPLACE FUNCTION public.premium_funnel_hit_v1(p_event text, p_source text, p_platform text, p_life_stage text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  uid uuid := auth.uid();
  ev text := lower(btrim(coalesce(p_event, '')));
  src text := public._premium_funnel_source(p_source);
  plat text := public._premium_funnel_platform(p_platform);
  stage text := lower(btrim(coalesce(p_life_stage, '')));
  ctry text;
  profile_stage text;
  gap interval;
  prev timestamptz;
BEGIN
  IF uid IS NULL THEN RETURN false; END IF;
  IF ev NOT IN ('paywall_shown', 'paywall_clicked', 'purchase_started', 'purchase_cancelled', 'purchase_failed',
                'purchase_pending', 'restore_clicked', 'epoint_started') THEN RETURN false; END IF;
  -- A runaway client (or random sources) cannot grow the tables: at most 60 distinct counted hits per user per hour.
  IF (SELECT count(*) FROM public.premium_funnel_throttle WHERE user_id = uid AND last_at > now() - interval '1 hour') >= 60 THEN
    RETURN false;
  END IF;
  gap := CASE ev WHEN 'paywall_shown' THEN interval '10 minutes' ELSE interval '10 seconds' END;
  SELECT last_at INTO prev FROM public.premium_funnel_throttle WHERE user_id = uid AND event = ev AND source = src FOR UPDATE;
  IF prev IS NOT NULL AND prev > now() - gap THEN RETURN false; END IF;
  INSERT INTO public.premium_funnel_throttle (user_id, event, source, last_at) VALUES (uid, ev, src, now())
  ON CONFLICT (user_id, event, source) DO UPDATE SET last_at = EXCLUDED.last_at;
  DELETE FROM public.premium_funnel_throttle WHERE user_id = uid AND last_at < now() - interval '1 day';

  SELECT upper(btrim(coalesce(p.country_code, ''))), p.life_stage INTO ctry, profile_stage
    FROM public.profiles p WHERE p.user_id = uid LIMIT 1;
  IF ctry IS NULL OR ctry !~ '^[A-Z]{2}$' THEN ctry := 'ZZ'; END IF;
  IF stage NOT IN ('flow', 'bump', 'mommy', 'partner') THEN stage := lower(coalesce(profile_stage, '')); END IF;
  IF stage NOT IN ('flow', 'bump', 'mommy', 'partner') THEN stage := 'unknown'; END IF;

  INSERT INTO public.premium_funnel_daily AS d (day, event, source, platform, life_stage, country, count)
  VALUES ((now() AT TIME ZONE 'Asia/Baku')::date, ev, src, plat, stage, ctry, 1)
  ON CONFLICT (day, event, source, platform, life_stage, country) DO UPDATE SET count = d.count + 1;
  RETURN true;
END $$;

-- The buy tap. Kept so the server can attribute the purchase that follows (premium_purchase_record_v1).
CREATE OR REPLACE FUNCTION public.premium_purchase_intent_v1(p_source text, p_platform text, p_plan text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  uid uuid := auth.uid();
  src text := public._premium_funnel_source(p_source);
  plat text := public._premium_funnel_platform(p_platform);
  pl text := CASE WHEN lower(coalesce(p_plan, '')) IN ('monthly', 'yearly', 'lifetime', 'offer') THEN lower(p_plan) ELSE 'unknown' END;
BEGIN
  IF uid IS NULL THEN RETURN false; END IF;
  -- Double taps and runaway clients: one intent per source/plan per 5 s, at most 50 a day.
  IF EXISTS (SELECT 1 FROM public.premium_purchase_intents WHERE user_id = uid AND source = src AND plan = pl
             AND created_at > now() - interval '5 seconds') THEN RETURN false; END IF;
  IF (SELECT count(*) FROM public.premium_purchase_intents WHERE user_id = uid AND created_at > now() - interval '1 day') >= 50 THEN
    RETURN false;
  END IF;
  INSERT INTO public.premium_purchase_intents (user_id, source, platform, plan) VALUES (uid, src, plat, pl);
  DELETE FROM public.premium_purchase_intents WHERE user_id = uid AND created_at < now() - interval '90 days';
  RETURN true;
END $$;

-- ───────────── server RPC (service_role only) ─────────────
-- Records one paid period start. p_kind 'renewal' → source 'renewal', never a first purchase. Otherwise the source is
-- the user's latest intent in the 48 h before p_purchased_at, and first_purchase is true when the user has no earlier
-- non-renewal purchase. Idempotent: the same provider_ref returns the stored row with recorded = false.
CREATE OR REPLACE FUNCTION public.premium_purchase_record_v1(p_user uuid, p_provider text, p_product text, p_plan text,
  p_amount numeric, p_currency text, p_provider_ref text, p_kind text DEFAULT 'initial', p_platform text DEFAULT NULL,
  p_purchased_at timestamptz DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  bought_at timestamptz := least(coalesce(p_purchased_at, now()), now());
  prov text := CASE WHEN p_provider IN ('app_store', 'play_store', 'epoint', 'promo') THEN p_provider ELSE 'other' END;
  pl text := CASE WHEN p_plan IN ('monthly', 'yearly', 'lifetime') THEN p_plan ELSE 'other' END;
  renewal boolean := coalesce(p_kind, 'initial') = 'renewal';
  intent public.premium_purchase_intents;
  src text;
  plat text;
  is_first boolean;
  existing public.premium_purchases;
  rid uuid;
BEGIN
  IF p_user IS NULL THEN RAISE EXCEPTION 'PREMIUM_PURCHASE_USER' USING ERRCODE = '22023'; END IF;
  IF p_provider_ref IS NULL OR length(p_provider_ref) NOT BETWEEN 3 AND 200 THEN RAISE EXCEPTION 'PREMIUM_PURCHASE_REF' USING ERRCODE = '22023'; END IF;
  SELECT * INTO existing FROM public.premium_purchases WHERE provider_ref = p_provider_ref;
  IF FOUND THEN RETURN jsonb_build_object('recorded', false, 'id', existing.id, 'source', existing.source); END IF;

  IF NOT renewal THEN
    SELECT * INTO intent FROM public.premium_purchase_intents
     WHERE user_id = p_user AND created_at <= bought_at + interval '5 minutes' AND created_at > bought_at - interval '48 hours'
     ORDER BY created_at DESC LIMIT 1;
  END IF;
  src := CASE WHEN renewal THEN 'renewal' WHEN intent.id IS NOT NULL THEN intent.source ELSE 'unknown' END;
  plat := public._premium_funnel_platform(coalesce(p_platform, intent.platform,
            CASE prov WHEN 'app_store' THEN 'ios' WHEN 'play_store' THEN 'android' WHEN 'epoint' THEN 'web' ELSE NULL END));
  is_first := NOT renewal AND prov <> 'promo'
           AND NOT EXISTS (SELECT 1 FROM public.premium_purchases WHERE user_id = p_user AND source <> 'renewal' AND provider <> 'promo');

  INSERT INTO public.premium_purchases (user_id, provider, product_id, plan, amount, currency, source, platform, first_purchase, provider_ref, created_at)
  VALUES (p_user, prov, left(p_product, 160), pl, CASE WHEN p_amount >= 0 THEN round(p_amount, 2) END,
          CASE WHEN upper(coalesce(p_currency, '')) ~ '^[A-Z]{3}$' THEN upper(p_currency) END,
          src, plat, is_first, p_provider_ref, bought_at)
  ON CONFLICT (provider_ref) DO NOTHING
  RETURNING id INTO rid;
  IF rid IS NULL THEN
    SELECT * INTO existing FROM public.premium_purchases WHERE provider_ref = p_provider_ref;
    RETURN jsonb_build_object('recorded', false, 'id', existing.id, 'source', existing.source);
  END IF;
  RETURN jsonb_build_object('recorded', true, 'id', rid, 'source', src, 'first_purchase', is_first);
END $$;

-- ───────────── admin report ─────────────
CREATE OR REPLACE FUNCTION public.admin_premium_funnel_v1(p_days integer DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  n_days integer := greatest(1, least(coalesce(p_days, 30), 180));
  since_day date := (now() AT TIME ZONE 'Asia/Baku')::date - (n_days - 1);
  since timestamptz := now() - make_interval(days => n_days);
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'days', n_days, 'since', since_day,
    -- funnel by placement and audience over the period
    'funnel', coalesce((SELECT jsonb_agg(row_to_json(f) ORDER BY f.count DESC) FROM (
        SELECT event, source, platform, country, life_stage, sum(count)::integer AS count
          FROM public.premium_funnel_daily WHERE day >= since_day
         GROUP BY event, source, platform, country, life_stage
         ORDER BY sum(count) DESC LIMIT 2000) f), '[]'::jsonb),
    -- one line per day and event (trend)
    'daily', coalesce((SELECT jsonb_agg(row_to_json(d) ORDER BY d.day, d.event) FROM (
        SELECT day, event, sum(count)::integer AS count FROM public.premium_funnel_daily WHERE day >= since_day
         GROUP BY day, event) d), '[]'::jsonb),
    'purchases', coalesce((SELECT jsonb_agg(row_to_json(p) ORDER BY p.count DESC) FROM (
        SELECT source, provider, platform, plan, first_purchase, currency, count(*)::integer AS count, sum(amount) AS amount
          FROM public.premium_purchases WHERE created_at >= since
         GROUP BY source, provider, platform, plan, first_purchase, currency) p), '[]'::jsonb),
    'intents', coalesce((SELECT jsonb_agg(row_to_json(i) ORDER BY i.count DESC) FROM (
        SELECT source, platform, plan, count(*)::integer AS count, count(DISTINCT user_id)::integer AS users
          FROM public.premium_purchase_intents WHERE created_at >= since
         GROUP BY source, platform, plan) i), '[]'::jsonb),
    'cancellations', coalesce((SELECT jsonb_agg(row_to_json(c) ORDER BY c.count DESC) FROM (
        SELECT reason_code, cancel_flow, count(*)::integer AS count, count(*) FILTER (WHERE was_trial)::integer AS trials
          FROM public.subscription_cancellations WHERE created_at >= since
         GROUP BY reason_code, cancel_flow) c), '[]'::jsonb));
END $$;

-- ───────────── grants ─────────────
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['_premium_funnel_source(text)', '_premium_funnel_platform(text)',
    'premium_funnel_hit_v1(text,text,text,text)', 'premium_purchase_intent_v1(text,text,text)',
    'premium_purchase_record_v1(uuid,text,text,text,numeric,text,text,text,text,timestamptz)', 'admin_premium_funnel_v1(integer)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', f);
  END LOOP;
  GRANT EXECUTE ON FUNCTION public.premium_funnel_hit_v1(text, text, text, text) TO authenticated;
  GRANT EXECUTE ON FUNCTION public.premium_purchase_intent_v1(text, text, text) TO authenticated;
  GRANT EXECUTE ON FUNCTION public.admin_premium_funnel_v1(integer) TO authenticated;
END $$;

-- ───────────── in_app_epoint setting ─────────────
INSERT INTO public.app_settings (key, value, description)
SELECT 'in_app_epoint',
       jsonb_build_object('enabled', true, 'countries', jsonb_build_array('AZ'),
                          'platforms', jsonb_build_object('android', true, 'ios', false, 'web', true)),
       'Tətbiq paywall-ında Epoint kartla Premium ödənişi: ölkələr və platformalar (iOS Apple 3.1.1 səbəbilə default bağlı)'
 WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'in_app_epoint');

DO $$
DECLARE def text;
BEGIN
  def := pg_get_functiondef('public.get_public_app_setting(text)'::regprocedure);
  IF position('''in_app_epoint''' IN def) = 0 THEN
    IF position(']::text[]' IN def) = 0 THEN RAISE EXCEPTION 'PUBLIC_SETTING_ALLOWLIST_SHAPE_CHANGED'; END IF;
    def := regexp_replace(def, '\]::text\[\]', ', ''in_app_epoint'']::text[]');
    EXECUTE def;
  END IF;
  IF position('''in_app_epoint''' IN pg_get_functiondef('public.get_public_app_setting(text)'::regprocedure)) = 0
     OR position('''daily_quiz''' IN pg_get_functiondef('public.get_public_app_setting(text)'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'PUBLIC_SETTING_ALLOWLIST_NOT_EXTENDED';
  END IF;
  IF public.get_public_app_setting('in_app_epoint') IS NULL OR public.get_public_app_setting('dashboard_stories') IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_SETTING_ALLOWLIST_INCOMPLETE';
  END IF;
END $$;

-- ───────────── verification ─────────────
DO $$
BEGIN
  IF (SELECT count(*) FROM _anacan_gcp_migration.guarded_relations WHERE schema_name = 'public'
        AND table_name IN ('premium_funnel_daily', 'premium_funnel_throttle', 'premium_purchase_intents', 'premium_purchases')) <> 4
     OR (SELECT count(*) FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relname IN ('premium_funnel_daily', 'premium_funnel_throttle', 'premium_purchase_intents', 'premium_purchases')
            AND tg.tgname IN ('anacan_gcp_writer_guard', 'anacan_gcp_change', 'anacan_gcp_truncate')) <> 12 THEN
    RAISE EXCEPTION 'PREMIUM_FUNNEL_GUARD_ENROLLMENT_INCOMPLETE';
  END IF;
  IF has_table_privilege('authenticated', 'public.premium_purchases', 'SELECT')
     OR has_table_privilege('authenticated', 'public.premium_purchase_intents', 'INSERT')
     OR has_table_privilege('anon', 'public.premium_funnel_daily', 'SELECT')
     OR has_function_privilege('authenticated', 'public.premium_purchase_record_v1(uuid,text,text,text,numeric,text,text,text,text,timestamptz)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.premium_funnel_hit_v1(text,text,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'PREMIUM_FUNNEL_GRANTS_TOO_WIDE';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
