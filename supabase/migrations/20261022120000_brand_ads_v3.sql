-- anacan-brand-ads-v3 (2026-10-22): lead forms, native templates, multi-tier and
-- life-stage targeting, brand drafts with administrator approval and an
-- aggregated, k-anonymous audience report.
--
-- Aligned with the live Google runtime (read-only inspection 2026-10-22):
--   * applied by /home/anacan-runner/run-sql.py (psql as supabase_admin, ON_ERROR_STOP);
--   * every new relation is registered in _anacan_gcp_migration.guarded_relations and gets
--     the same anacan_gcp_change / anacan_gcp_truncate / anacan_gcp_writer_guard triggers
--     as the existing brand relations (changed relations banners/ad_delivery_receipts are
--     already guarded); no cron/timer is added;
--   * new objects are owned by pgadmin like the existing brand-ads objects;
--   * the v1/v2 RPCs keep their bodies; brand_banner_eligible_v1 only gains a
--     requires_v3 refusal so v2 inventory, v1 measurement and the legacy SELECT policy
--     never serve a creative whose targeting or lead form they cannot evaluate.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- ── Lead forms (brand-owned; `live` is the administrator-approved snapshot) ──────
CREATE TABLE IF NOT EXISTS public.ad_lead_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.ad_brands(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 100),
  fields jsonb NOT NULL CHECK (jsonb_typeof(fields) = 'array'),
  copy jsonb NOT NULL CHECK (jsonb_typeof(copy) = 'object'),
  privacy_url text CHECK (privacy_url IS NULL OR privacy_url ~ '^https://[^[:space:]@/]+(/[^[:space:]]*)?$'),
  retention_days smallint NOT NULL DEFAULT 90 CHECK (retention_days BETWEEN 1 AND 90),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending','approved','rejected','archived')),
  live jsonb,
  review_note text CHECK (review_note IS NULL OR char_length(review_note) <= 500),
  revision integer NOT NULL DEFAULT 1,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  reviewed_by uuid,
  reviewed_at timestamptz
);
CREATE INDEX IF NOT EXISTS ad_lead_forms_brand_idx ON public.ad_lead_forms (brand_id, updated_at DESC);

-- ── Leads: personal data visible ONLY to the owning brand's active members ──────
-- No life stage, pregnancy week, child, premium or profile attribute is stored here.
CREATE TABLE IF NOT EXISTS public.ad_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.ad_lead_forms(id) ON DELETE CASCADE,
  brand_id uuid NOT NULL REFERENCES public.ad_brands(id) ON DELETE CASCADE,
  banner_id uuid,
  creative_id uuid,
  delivery_id uuid,
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  form_revision integer NOT NULL,
  answers jsonb NOT NULL CHECK (jsonb_typeof(answers) = 'object' AND pg_column_size(answers) <= 4096),
  language text NOT NULL,
  consent_text text NOT NULL CHECK (char_length(consent_text) BETWEEN 1 AND 2000),
  consent_at timestamptz NOT NULL,
  request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  UNIQUE (actor_id, request_id)
);
CREATE INDEX IF NOT EXISTS ad_leads_brand_idx ON public.ad_leads (brand_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ad_leads_actor_form_idx ON public.ad_leads (actor_id, form_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ad_leads_expiry_idx ON public.ad_leads (expires_at);

-- ── Brand creative drafts (brand edits, administrator approves) ────────────────
CREATE TABLE IF NOT EXISTS public.ad_creative_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.ad_brands(id) ON DELETE CASCADE,
  banner_id uuid REFERENCES public.banners(id) ON DELETE SET NULL,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object' AND pg_column_size(payload) <= 65536),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending','approved','rejected','archived')),
  review_note text CHECK (review_note IS NULL OR char_length(review_note) <= 500),
  revision integer NOT NULL DEFAULT 1,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  reviewed_by uuid,
  reviewed_at timestamptz
);
CREATE INDEX IF NOT EXISTS ad_creative_drafts_brand_idx ON public.ad_creative_drafts (brand_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS ad_creative_drafts_pending_idx ON public.ad_creative_drafts (submitted_at) WHERE status = 'pending';

-- ── Changed relation: banners ───────────────────────────────────────────────────
ALTER TABLE public.banners
  ADD COLUMN IF NOT EXISTS audience_tiers text[],
  ADD COLUMN IF NOT EXISTS native_template text,
  ADD COLUMN IF NOT EXISTS creative_options jsonb,
  ADD COLUMN IF NOT EXISTS creative_copy jsonb,
  ADD COLUMN IF NOT EXISTS lead_form_id uuid REFERENCES public.ad_lead_forms(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS target_pregnancy_week_min smallint,
  ADD COLUMN IF NOT EXISTS target_pregnancy_week_max smallint,
  ADD COLUMN IF NOT EXISTS target_pregnancy_weeks smallint[],
  ADD COLUMN IF NOT EXISTS target_child_age_min_days integer,
  ADD COLUMN IF NOT EXISTS target_child_age_max_days integer;

ALTER TABLE public.banners ADD COLUMN IF NOT EXISTS requires_v3 boolean GENERATED ALWAYS AS (
  lead_form_id IS NOT NULL OR link_type = 'lead_form'
  OR target_pregnancy_week_min IS NOT NULL OR target_pregnancy_week_max IS NOT NULL
  OR coalesce(cardinality(target_pregnancy_weeks), 0) > 0
  OR target_child_age_min_days IS NOT NULL OR target_child_age_max_days IS NOT NULL
  OR coalesce('premium' = ANY(audience_tiers), false)
) STORED;

-- Widen the live link_type check to the new in-app lead destination.
ALTER TABLE public.banners DROP CONSTRAINT IF EXISTS banners_link_type_check;
ALTER TABLE public.banners DROP CONSTRAINT IF EXISTS banners_link_type_v3_check;
ALTER TABLE public.banners ADD CONSTRAINT banners_link_type_v3_check
  CHECK (link_type IS NULL OR link_type IN ('external','internal','tool','lead_form'));
ALTER TABLE public.banners DROP CONSTRAINT IF EXISTS banners_audience_tiers_v3_check;
ALTER TABLE public.banners ADD CONSTRAINT banners_audience_tiers_v3_check
  CHECK (audience_tiers IS NULL OR (cardinality(audience_tiers) BETWEEN 1 AND 2 AND audience_tiers <@ ARRAY['free','premium']::text[]));
ALTER TABLE public.banners DROP CONSTRAINT IF EXISTS banners_native_template_v3_check;
ALTER TABLE public.banners ADD CONSTRAINT banners_native_template_v3_check
  CHECK (native_template IS NULL OR native_template IN ('classic','spotlight','split','minimal','offer','expert'));
-- CHECK cannot hold a subquery; individual week values are bounded by ad_creative_payload_v1.
ALTER TABLE public.banners DROP CONSTRAINT IF EXISTS banners_pregnancy_week_v3_check;
ALTER TABLE public.banners ADD CONSTRAINT banners_pregnancy_week_v3_check CHECK (
  (target_pregnancy_week_min IS NULL OR target_pregnancy_week_min BETWEEN 1 AND 42)
  AND (target_pregnancy_week_max IS NULL OR target_pregnancy_week_max BETWEEN 1 AND 42)
  AND (target_pregnancy_week_min IS NULL OR target_pregnancy_week_max IS NULL OR target_pregnancy_week_min <= target_pregnancy_week_max)
  AND (target_pregnancy_weeks IS NULL OR cardinality(target_pregnancy_weeks) <= 42));
ALTER TABLE public.banners DROP CONSTRAINT IF EXISTS banners_child_age_v3_check;
ALTER TABLE public.banners ADD CONSTRAINT banners_child_age_v3_check CHECK (
  (target_child_age_min_days IS NULL OR target_child_age_min_days BETWEEN 0 AND 2190)
  AND (target_child_age_max_days IS NULL OR target_child_age_max_days BETWEEN 0 AND 2190)
  AND (target_child_age_min_days IS NULL OR target_child_age_max_days IS NULL OR target_child_age_min_days <= target_child_age_max_days));

-- Legacy native clients read `banners` directly; hide v3-only creatives from them
-- (branded ones are also refused by brand_banner_legacy_audience_v1 below).
DROP POLICY IF EXISTS banners_v3_hidden_from_legacy ON public.banners;
CREATE POLICY banners_v3_hidden_from_legacy ON public.banners AS RESTRICTIVE FOR SELECT
  USING (NOT requires_v3 OR public.has_role(auth.uid(), 'admin'));

-- ── Changed relation: delivery receipts carry coarse audience buckets ───────────
ALTER TABLE public.ad_delivery_receipts ADD COLUMN IF NOT EXISTS audience jsonb;
CREATE INDEX IF NOT EXISTS ad_delivery_receipts_audience_idx
  ON public.ad_delivery_receipts (brand_id, metric_day) WHERE audience IS NOT NULL;

-- ── Private relations: RPC-only, like the source-brand-ads-v1 relations ─────────
ALTER TABLE public.ad_lead_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_creative_drafts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ad_lead_forms, public.ad_leads, public.ad_creative_drafts FROM PUBLIC, anon, authenticated, service_role;

-- ── Audience facts (server-derived; the client never supplies them) ────────────
CREATE OR REPLACE FUNCTION public.brand_ads_week_bucket_v1(p_week integer) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = pg_catalog, public AS $$
  SELECT CASE WHEN p_week IS NULL THEN NULL WHEN p_week <= 4 THEN '1-4'
    ELSE ((p_week - 1) / 4 * 4 + 1)::text || '-' || least(42, (p_week - 1) / 4 * 4 + 4)::text END
$$;
CREATE OR REPLACE FUNCTION public.brand_ads_child_bucket_v1(p_days integer) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = pg_catalog, public AS $$
  SELECT CASE WHEN p_days IS NULL THEN NULL WHEN p_days < 91 THEN '0-3m' WHEN p_days < 183 THEN '3-6m'
    WHEN p_days < 365 THEN '6-12m' WHEN p_days < 730 THEN '12-24m' WHEN p_days < 1095 THEN '24-36m' ELSE '36m+' END
$$;

CREATE OR REPLACE FUNCTION public.brand_ads_audience_facts_v1(p_actor uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_profile record; v_lmp date; v_week integer; v_birth date; v_days integer; v_access jsonb; v_premium boolean := false;
BEGIN
  SELECT life_stage, last_period_date, due_date, baby_birth_date, upper(country_code) AS country
    INTO v_profile FROM public.profiles WHERE user_id = p_actor LIMIT 1;
  -- Same convention as src/lib/pregnancy-utils.ts: LMP first, else due date − 280 days, week = floor(days/7).
  v_lmp := coalesce(v_profile.last_period_date::date, v_profile.due_date::date - 280);
  IF v_profile.life_stage = 'bump' AND v_lmp IS NOT NULL AND current_date >= v_lmp THEN
    v_week := least(40, greatest(0, (current_date - v_lmp) / 7));
  END IF;
  SELECT birth_date::date INTO v_birth FROM public.user_children
    WHERE user_id = p_actor AND coalesce(is_active, true) AND birth_date::date <= current_date
    ORDER BY birth_date DESC LIMIT 1;
  v_birth := coalesce(v_birth, v_profile.baby_birth_date::date);
  IF v_birth IS NOT NULL AND v_birth <= current_date THEN v_days := current_date - v_birth; END IF;
  v_access := public.get_premium_access_v1(p_actor);
  v_premium := coalesce((v_access #>> '{own,active}')::boolean, false) OR coalesce((v_access #>> '{household,active}')::boolean, false);
  RETURN jsonb_build_object(
    'stage', coalesce(v_profile.life_stage, 'unknown'),
    'week', v_week,
    'trimester', CASE WHEN v_week IS NULL THEN NULL WHEN v_week < 14 THEN '1' WHEN v_week < 28 THEN '2' ELSE '3' END,
    'week_bucket', public.brand_ads_week_bucket_v1(v_week),
    'child_days', v_days,
    'child_age_bucket', public.brand_ads_child_bucket_v1(v_days),
    'country', coalesce(nullif(v_profile.country, ''), 'unknown'),
    'tier', CASE WHEN v_premium THEN 'premium' ELSE 'free' END);
END $$;

-- Mirrors matchesBrandTargeting() in src/lib/ads/brandTargeting.ts.
CREATE OR REPLACE FUNCTION public.brand_ads_targeting_matches_v1(b public.banners, p_facts jsonb, p_language text, p_branded boolean)
RETURNS boolean LANGUAGE plpgsql STABLE SET search_path = pg_catalog, public AS $$
DECLARE
  v_tiers text[] := coalesce(b.audience_tiers, CASE WHEN p_branded THEN ARRAY['free'] WHEN coalesce(b.is_premium_only, false) THEN ARRAY['premium'] ELSE ARRAY['free','premium'] END);
  v_week integer := (p_facts->>'week')::integer; v_days integer := (p_facts->>'child_days')::integer;
  v_has_week boolean := b.target_pregnancy_week_min IS NOT NULL OR b.target_pregnancy_week_max IS NOT NULL OR coalesce(cardinality(b.target_pregnancy_weeks), 0) > 0;
  v_has_child boolean := b.target_child_age_min_days IS NOT NULL OR b.target_child_age_max_days IS NOT NULL;
  v_week_ok boolean; v_child_ok boolean;
BEGIN
  IF NOT (p_facts->>'tier') = ANY(v_tiers) THEN RETURN false; END IF;
  IF coalesce(cardinality(b.target_life_stages), 0) > 0 AND NOT (p_facts->>'stage') = ANY(b.target_life_stages) THEN RETURN false; END IF;
  IF coalesce(cardinality(b.target_languages), 0) > 0 AND NOT p_language = ANY(b.target_languages) THEN RETURN false; END IF;
  IF coalesce(cardinality(b.target_countries), 0) > 0 AND NOT (p_facts->>'country') = ANY(b.target_countries) THEN RETURN false; END IF;
  IF NOT v_has_week AND NOT v_has_child THEN RETURN true; END IF;
  v_week_ok := v_has_week AND v_week IS NOT NULL
    AND (b.target_pregnancy_week_min IS NULL OR v_week >= b.target_pregnancy_week_min)
    AND (b.target_pregnancy_week_max IS NULL OR v_week <= b.target_pregnancy_week_max)
    AND (coalesce(cardinality(b.target_pregnancy_weeks), 0) = 0 OR v_week = ANY(b.target_pregnancy_weeks));
  v_child_ok := v_has_child AND v_days IS NOT NULL
    AND (b.target_child_age_min_days IS NULL OR v_days >= b.target_child_age_min_days)
    AND (b.target_child_age_max_days IS NULL OR v_days <= b.target_child_age_max_days);
  -- Pregnancy and child windows are alternatives (e.g. week 34–40 OR newborn 0–90 days).
  RETURN coalesce(v_week_ok, false) OR coalesce(v_child_ok, false);
END $$;

-- v3 eligibility: the live v1 rules (blocked users, valid language, active window,
-- active brand, community block) with v3 tier and life-stage targeting in place of
-- the v1 "brand ads never reach Premium" rule.
CREATE OR REPLACE FUNCTION public.brand_banner_eligible_v3(p_banner uuid, p_actor uuid, p_language text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE b public.banners; branded boolean;
BEGIN
  IF p_actor IS NULL OR public.is_user_blocked(p_actor, 'full') OR NOT public.community_language_valid_v1(p_language) THEN RETURN false; END IF;
  SELECT * INTO b FROM public.banners WHERE id = p_banner;
  IF NOT FOUND OR NOT coalesce(b.is_active, false) OR b.start_date > now() OR b.end_date <= now() THEN RETURN false; END IF;
  SELECT EXISTS(SELECT 1 FROM public.ad_brand_creatives WHERE banner_id = b.id) INTO branded;
  IF branded AND NOT EXISTS(SELECT 1 FROM public.ad_brand_creatives c JOIN public.ad_brands r ON r.id = c.brand_id
                            WHERE c.banner_id = b.id AND r.is_active AND c.deleted_at IS NULL) THEN RETURN false; END IF;
  IF b.link_type = 'lead_form' AND NOT EXISTS(SELECT 1 FROM public.ad_lead_forms f JOIN public.ad_brand_creatives c ON c.brand_id = f.brand_id
      WHERE f.id = b.lead_form_id AND c.banner_id = b.id AND c.deleted_at IS NULL AND f.live IS NOT NULL AND f.status <> 'archived') THEN RETURN false; END IF;
  IF NOT public.brand_ads_targeting_matches_v1(b, public.brand_ads_audience_facts_v1(p_actor), p_language, branded) THEN RETURN false; END IF;
  IF b.placement = 'community_top' AND public.is_user_blocked(p_actor, 'community') THEN RETURN false; END IF;
  RETURN true;
END $$;

-- Live v1 body plus one refusal: v3-only creatives never reach v2 inventory, v1
-- measurement or the legacy SELECT policy (brand_banner_readable_v1).
CREATE OR REPLACE FUNCTION public.brand_banner_eligible_v1(p_banner uuid, p_actor uuid, p_language text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE b public.banners;profile jsonb;premium jsonb;paid boolean;branded boolean;
BEGIN
 IF p_actor IS NULL OR public.is_user_blocked(p_actor,'full') OR NOT public.community_language_valid_v1(p_language) THEN RETURN false; END IF;
 SELECT * INTO b FROM public.banners WHERE id=p_banner;
 IF NOT FOUND OR NOT coalesce(b.is_active,false) OR b.start_date>now() OR b.end_date<=now() THEN RETURN false; END IF;
 IF coalesce(b.requires_v3,false) THEN RETURN false; END IF;
 SELECT to_jsonb(p) INTO profile FROM public.profiles p WHERE user_id=p_actor;
 IF coalesce(cardinality(b.target_life_stages),0)>0 AND NOT coalesce(profile->>'life_stage'=ANY(b.target_life_stages),false) THEN RETURN false; END IF;
 IF coalesce(cardinality(b.target_languages),0)>0 AND NOT(p_language=ANY(b.target_languages)) THEN RETURN false; END IF;
 IF coalesce(cardinality(b.target_countries),0)>0 AND NOT coalesce(upper(profile->>'country_code')=ANY(b.target_countries),false) THEN RETURN false; END IF;
 SELECT EXISTS(SELECT 1 FROM public.ad_brand_creatives WHERE banner_id=b.id) INTO branded;
 IF branded AND NOT EXISTS(SELECT 1 FROM public.ad_brand_creatives c JOIN public.ad_brands r ON r.id=c.brand_id WHERE c.banner_id=b.id AND r.is_active AND c.deleted_at IS NULL) THEN RETURN false; END IF;
 IF branded OR coalesce(b.is_premium_only,false) THEN
  premium:=public.get_premium_access_v1(p_actor);paid:=coalesce((premium#>>'{own,active}')::boolean,false) OR coalesce((premium#>>'{household,active}')::boolean,false);
  IF branded AND paid OR coalesce(b.is_premium_only,false) AND NOT paid THEN RETURN false; END IF;
 END IF;
 IF b.placement='community_top' AND public.is_user_blocked(p_actor,'community') THEN RETURN false; END IF;
 RETURN true;
END $function$;

-- Creative copy for languages without `banners.*_xx` columns is flattened into the row.
CREATE OR REPLACE FUNCTION public.brand_ads_row_v3(b public.banners, p_brand public.ad_brands, p_creative public.ad_brand_creatives)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = pg_catalog, public AS $$
  SELECT to_jsonb(b) - ARRAY['requires_v3','creative_copy','view_count','click_count']
    || coalesce((SELECT jsonb_object_agg(f.field || '_' || l.lang, f.value)
        FROM jsonb_each(coalesce(b.creative_copy, '{}'::jsonb)) l(lang, body),
             jsonb_each_text(CASE WHEN jsonb_typeof(l.body) = 'object' THEN l.body ELSE '{}'::jsonb END) f(field, value)
        WHERE f.field IN ('title','description','button_text') AND l.lang ~ '^[a-z]{2}$' AND f.value <> ''), '{}'::jsonb)
    || jsonb_build_object('measurement_version', 3, 'branded', p_creative.id IS NOT NULL,
        'sponsor_name', p_brand.name, 'sponsor_logo', p_brand.logo_url, 'creative_revision', p_creative.revision,
        'lead_form', b.lead_form_id IS NOT NULL AND b.link_type = 'lead_form')
$$;

-- ── Inventory v3 (mirrors get_banner_inventory_v2) ──────────────────────────────
CREATE OR REPLACE FUNCTION public.get_banner_inventory_v3(p_actor uuid, p_placement text, p_language text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE result jsonb;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_actor THEN RAISE EXCEPTION 'BRAND_ADS_ACCOUNT_CHANGED' USING ERRCODE = '42501'; END IF;
  IF p_placement IS NULL OR p_placement NOT IN ('home_top','home_middle','home_bottom','tools_top','tools_bottom','profile_top','community_top','ai_chat_top') THEN
    RAISE EXCEPTION 'BRAND_ADS_INVALID_PLACEMENT';
  END IF;
  SELECT coalesce(jsonb_agg(x.value ORDER BY x.sort_order, x.id), '[]') INTO result FROM (
    SELECT b.id, b.sort_order, public.brand_ads_row_v3(b, r, c) value
    FROM public.banners b LEFT JOIN public.ad_brand_creatives c ON c.banner_id = b.id LEFT JOIN public.ad_brands r ON r.id = c.brand_id
    WHERE b.placement = p_placement AND public.brand_banner_eligible_v3(b.id, p_actor, p_language)
      AND (b.max_impressions_per_user IS NULL OR coalesce((SELECT seen_count FROM public.banner_impressions WHERE banner_id = b.id AND user_id = p_actor), 0) < b.max_impressions_per_user)
    ORDER BY b.sort_order, b.id LIMIT 20) x;
  RETURN result;
END $$;

-- ── Measurement v2 for v3 creatives (mirrors issue/record v1, adds audience) ───
CREATE OR REPLACE FUNCTION public.issue_brand_ad_delivery_v2(p_actor uuid, p_banner uuid, p_exposure uuid, p_platform text, p_language text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE c public.ad_brand_creatives; b public.banners; r public.ad_delivery_receipts; v_facts jsonb;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_actor THEN RAISE EXCEPTION 'BRAND_ADS_ACCOUNT_CHANGED' USING ERRCODE = '42501'; END IF;
  IF p_exposure IS NULL OR p_platform IS NULL OR p_platform NOT IN ('web','ios','android') THEN RAISE EXCEPTION 'BRAND_ADS_INVALID_EVENT'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_actor::text, 341));
  SELECT * INTO r FROM public.ad_delivery_receipts WHERE id = p_exposure;
  IF FOUND THEN
    IF r.actor_id IS DISTINCT FROM p_actor OR r.creative_id <> p_banner OR r.platform <> p_platform OR r.language IS DISTINCT FROM p_language THEN
      RAISE EXCEPTION 'BRAND_ADS_REQUEST_CONFLICT' USING ERRCODE = '42501';
    END IF;
    RETURN jsonb_build_object('id', r.id, 'expires_at', r.expires_at);
  END IF;
  SELECT * INTO c FROM public.ad_brand_creatives WHERE banner_id = p_banner AND deleted_at IS NULL;
  IF NOT FOUND OR NOT public.brand_banner_eligible_v3(p_banner, p_actor, p_language) THEN RETURN NULL; END IF;
  IF public.has_role(p_actor, 'admin') OR EXISTS(SELECT 1 FROM public.ad_brand_members WHERE brand_id = c.brand_id AND user_id = p_actor AND is_active) THEN RETURN NULL; END IF;
  PERFORM 1 FROM public.ad_brands WHERE id = c.brand_id AND is_active FOR SHARE; IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO b FROM public.banners WHERE id = p_banner FOR SHARE; IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO c FROM public.ad_brand_creatives WHERE banner_id = p_banner AND deleted_at IS NULL FOR SHARE;
  IF NOT FOUND OR NOT public.brand_banner_eligible_v3(p_banner, p_actor, p_language) THEN RETURN NULL; END IF;
  IF b.placement IN ('home_middle','ai_chat_top') THEN RETURN NULL; END IF;
  IF b.max_impressions_per_user IS NOT NULL AND coalesce((SELECT seen_count FROM public.banner_impressions WHERE banner_id = p_banner AND user_id = p_actor), 0) >= b.max_impressions_per_user THEN RETURN NULL; END IF;
  IF (SELECT count(*) FROM public.ad_delivery_receipts WHERE actor_id = p_actor AND issued_at > now() - interval '1 minute') >= 100 THEN RETURN NULL; END IF;
  v_facts := public.brand_ads_audience_facts_v1(p_actor);
  INSERT INTO public.ad_delivery_receipts(id, actor_id, creative_id, brand_id, placement, platform, revision, language, expires_at, audience)
  VALUES (p_exposure, p_actor, c.id, c.brand_id, b.placement, p_platform, c.revision, p_language,
          least(clock_timestamp() + interval '15 minutes', coalesce(b.end_date, 'infinity')),
          -- Only coarse buckets are retained; exact week/day values never leave this function.
          jsonb_build_object('stage', v_facts->'stage', 'trimester', v_facts->'trimester', 'week_bucket', v_facts->'week_bucket',
            'child_age_bucket', v_facts->'child_age_bucket', 'country', v_facts->'country', 'tier', v_facts->'tier'))
  RETURNING * INTO r;
  RETURN jsonb_build_object('id', r.id, 'expires_at', r.expires_at);
END $$;

CREATE OR REPLACE FUNCTION public.record_brand_ad_event_v2(p_actor uuid, p_delivery uuid, p_event text, p_visible_ms integer DEFAULT 0)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE r public.ad_delivery_receipts; c public.ad_brand_creatives; b public.banners; tz text; new_view boolean; new_click boolean;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_actor THEN RAISE EXCEPTION 'BRAND_ADS_ACCOUNT_CHANGED' USING ERRCODE = '42501'; END IF;
  IF p_event IS NULL OR p_event NOT IN ('impression','click') OR p_visible_ms IS NULL OR p_visible_ms NOT BETWEEN 0 AND 3600000 THEN RAISE EXCEPTION 'BRAND_ADS_INVALID_EVENT'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_actor::text, 341));
  SELECT * INTO r FROM public.ad_delivery_receipts WHERE id = p_delivery AND actor_id = p_actor AND audience IS NOT NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'BRAND_ADS_DELIVERY_UNAVAILABLE' USING ERRCODE = '42501'; END IF;
  IF p_event = 'impression' AND r.impression_at IS NOT NULL OR p_event = 'click' AND r.clicked_at IS NOT NULL THEN RETURN true; END IF;
  SELECT report_timezone INTO tz FROM public.ad_brands WHERE id = r.brand_id AND is_active FOR SHARE; IF NOT FOUND THEN RETURN false; END IF;
  SELECT * INTO b FROM public.banners WHERE id = r.creative_id FOR SHARE; IF NOT FOUND THEN RETURN false; END IF;
  SELECT * INTO c FROM public.ad_brand_creatives WHERE id = r.creative_id FOR SHARE;
  IF NOT FOUND OR c.revision <> r.revision OR r.expires_at <= clock_timestamp() OR NOT public.brand_banner_eligible_v3(b.id, p_actor, r.language) THEN RETURN false; END IF;
  IF public.has_role(p_actor, 'admin') OR EXISTS(SELECT 1 FROM public.ad_brand_members WHERE brand_id = r.brand_id AND user_id = p_actor AND is_active) THEN RETURN false; END IF;
  IF p_event = 'impression' AND (p_visible_ms < 1000 OR clock_timestamp() < r.issued_at + interval '1 second') THEN RETURN false; END IF;
  IF p_event = 'click' AND b.link_type = 'lead_form' THEN
    IF b.lead_form_id IS NULL THEN RETURN false; END IF;
  ELSIF p_event = 'click' THEN
    IF coalesce(b.link_url, '') = '' OR coalesce(b.link_type, '') NOT IN ('external','internal','tool') THEN RETURN false; END IF;
    IF b.link_type = 'external' AND b.link_url !~ '^https?://[^[:space:]<>]+$' THEN RETURN false; END IF;
  END IF;
  new_view := r.impression_at IS NULL; new_click := p_event = 'click' AND r.clicked_at IS NULL;
  IF new_view AND b.max_impressions_per_user IS NOT NULL AND coalesce((SELECT seen_count FROM public.banner_impressions WHERE banner_id = b.id AND user_id = p_actor), 0) >= b.max_impressions_per_user THEN RETURN false; END IF;
  IF new_view THEN
    r.impression_at := clock_timestamp(); r.metric_day := (r.impression_at AT TIME ZONE tz)::date;
    INSERT INTO public.banner_impressions(banner_id, user_id, seen_count, first_seen_at, last_seen_at) VALUES (b.id, p_actor, 1, now(), now())
      ON CONFLICT (banner_id, user_id) DO UPDATE SET seen_count = banner_impressions.seen_count + 1, last_seen_at = now();
  END IF;
  UPDATE public.ad_delivery_receipts SET impression_at = r.impression_at, metric_day = r.metric_day,
    impression_kind = CASE WHEN new_view THEN CASE p_event WHEN 'click' THEN 'interaction' ELSE 'visible' END ELSE impression_kind END,
    clicked_at = CASE WHEN new_click THEN clock_timestamp() ELSE clicked_at END WHERE id = r.id;
  INSERT INTO public.ad_metrics_daily(brand_id, creative_id, metric_day, placement, platform, impressions, clicks)
  VALUES (r.brand_id, r.creative_id, r.metric_day, r.placement, r.platform, 1, new_click::integer)
  ON CONFLICT (brand_id, creative_id, metric_day, placement, platform) DO UPDATE SET impressions = ad_metrics_daily.impressions + new_view::integer,
    clicks = ad_metrics_daily.clicks + new_click::integer, updated_at = now();
  RETURN true;
END $$;

-- ── k-anonymous audience report (single-dimension breakdowns only) ─────────────
CREATE OR REPLACE FUNCTION public.brand_audience_report_v1(p_brand uuid, p_from date, p_to date, p_placement text DEFAULT NULL, p_ad uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  k constant integer := 20;
  v_dims constant text[] := ARRAY['placement','platform','language','country','tier','stage','trimester','week_bucket','child_age_bucket'];
  v_dim text; v_rows jsonb; v_out jsonb := '{}'::jsonb; v_reach integer; v_brand public.ad_brands;
BEGIN
  PERFORM public.brand_ads_access_v1(p_brand);
  SELECT * INTO v_brand FROM public.ad_brands WHERE id = p_brand;
  -- At least seven whole days: narrow windows make differencing between reports easier.
  IF p_from IS NULL OR p_to IS NULL OR p_to < p_from OR p_to - p_from > 365 OR p_to - p_from < 6 THEN
    RAISE EXCEPTION 'BRAND_ADS_INVALID_FILTER' USING ERRCODE = '22023';
  END IF;
  SELECT count(DISTINCT r.actor_id) INTO v_reach FROM public.ad_delivery_receipts r
  WHERE r.brand_id = p_brand AND r.audience IS NOT NULL AND r.impression_at IS NOT NULL AND r.metric_day BETWEEN p_from AND p_to
    AND (p_placement IS NULL OR r.placement = p_placement) AND (p_ad IS NULL OR r.creative_id = p_ad);
  IF v_reach < k THEN
    RETURN jsonb_build_object('protocol', 'anacan-brand-audience-v1', 'brand', p_brand, 'from', p_from, 'to', p_to, 'k', k,
      'available', false, 'dimensions', '{}'::jsonb, 'timezone', v_brand.report_timezone, 'refreshed_at', now());
  END IF;
  FOREACH v_dim IN ARRAY v_dims LOOP
    WITH scope AS (
      SELECT r.actor_id, r.clicked_at IS NOT NULL AS clicked,
             coalesce(nullif((r.audience || jsonb_build_object('placement', r.placement, 'platform', r.platform, 'language', r.language))->>v_dim, ''), 'unknown') AS bucket
      FROM public.ad_delivery_receipts r
      WHERE r.brand_id = p_brand AND r.audience IS NOT NULL AND r.impression_at IS NOT NULL AND r.metric_day BETWEEN p_from AND p_to
        AND (p_placement IS NULL OR r.placement = p_placement) AND (p_ad IS NULL OR r.creative_id = p_ad)
    ), raw AS (
      SELECT bucket, count(DISTINCT actor_id)::int AS reach, count(*)::int AS impressions, count(*) FILTER (WHERE clicked)::int AS clicks
      FROM scope GROUP BY 1
    ), ranked AS (
      SELECT *, reach < k AS small, row_number() OVER (ORDER BY reach, bucket) AS rn FROM raw
    ), flagged AS (
      -- Complementary suppression: one hidden bucket could be derived from the
      -- others, so the smallest visible bucket is hidden with it.
      SELECT *, small OR ((SELECT count(*) FROM ranked WHERE small) = 1
                          AND rn = (SELECT min(rn) FROM ranked WHERE NOT small)) AS hidden FROM ranked
    ), merged AS (
      SELECT bucket, reach, impressions, clicks, false AS other FROM flagged WHERE NOT hidden
      UNION ALL
      SELECT 'other', count(DISTINCT s.actor_id)::int, count(*)::int, count(*) FILTER (WHERE s.clicked)::int, true
      FROM scope s WHERE s.bucket IN (SELECT bucket FROM flagged WHERE hidden)
      HAVING count(*) > 0
    )
    SELECT coalesce(jsonb_agg(jsonb_build_object('bucket', bucket, 'reach', reach, 'impressions', impressions, 'clicks', clicks, 'other', other)
             ORDER BY other, impressions DESC, bucket) FILTER (WHERE reach >= k), '[]'::jsonb)
      INTO v_rows FROM merged;
    v_out := v_out || jsonb_build_object(v_dim, v_rows);
  END LOOP;
  RETURN jsonb_build_object('protocol', 'anacan-brand-audience-v1', 'brand', p_brand, 'from', p_from, 'to', p_to, 'k', k,
    'available', true, 'reach', v_reach, 'dimensions', v_out, 'timezone', v_brand.report_timezone, 'refreshed_at', now());
END $$;

-- ── Lead form payload validation ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ad_lead_form_payload_v1(p jsonb) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path = pg_catalog, public AS $$
DECLARE v_fields jsonb := '[]'::jsonb; f jsonb; v_keys text[] := '{}'; v_copy jsonb := '{}'::jsonb; l record; v_lang jsonb;
BEGIN
  IF jsonb_typeof(p->'fields') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'fields') NOT BETWEEN 1 AND 6 THEN RAISE EXCEPTION 'BRAND_ADS_INVALID_FILTER' USING ERRCODE = '22023'; END IF;
  FOR f IN SELECT * FROM jsonb_array_elements(p->'fields') LOOP
    IF f->>'key' IS NULL OR f->>'key' NOT IN ('name','phone','email','question_1','question_2','question_3') OR (f->>'key') = ANY(v_keys) THEN
      RAISE EXCEPTION 'BRAND_ADS_INVALID_FILTER' USING ERRCODE = '22023';
    END IF;
    v_keys := v_keys || (f->>'key');
    v_fields := v_fields || jsonb_build_array(jsonb_build_object('key', f->>'key', 'required', coalesce((f->>'required')::boolean, false)));
  END LOOP;
  IF NOT (v_keys && ARRAY['phone','email']) THEN RAISE EXCEPTION 'BRAND_ADS_INVALID_FILTER' USING ERRCODE = '22023'; END IF;
  FOR l IN SELECT * FROM jsonb_each(CASE WHEN jsonb_typeof(p->'copy') = 'object' THEN p->'copy' ELSE '{}'::jsonb END) LOOP
    IF l.key !~ '^[a-z]{2}$' OR jsonb_typeof(l.value) <> 'object' THEN CONTINUE; END IF;
    SELECT jsonb_object_agg(key, left(btrim(value), CASE WHEN key = 'consent' THEN 2000 ELSE 300 END)) INTO v_lang
    FROM jsonb_each_text(l.value) WHERE key IN ('title','intro','consent','success','question_1','question_2','question_3') AND btrim(value) <> '';
    IF v_lang ? 'title' AND v_lang ? 'consent' THEN v_copy := v_copy || jsonb_build_object(l.key, v_lang); END IF;
  END LOOP;
  IF v_copy = '{}'::jsonb THEN RAISE EXCEPTION 'BRAND_ADS_INVALID_FILTER' USING ERRCODE = '22023'; END IF;
  RETURN jsonb_build_object('fields', v_fields, 'copy', v_copy);
END $$;

CREATE OR REPLACE FUNCTION public.ad_lead_form_public_v1(f public.ad_lead_forms, p_language text) RETURNS jsonb
LANGUAGE sql STABLE SET search_path = pg_catalog, public AS $$
  SELECT jsonb_build_object('id', f.id, 'revision', (f.live->>'revision')::int, 'fields', f.live->'fields',
    'copy', coalesce(f.live->'copy'->p_language, f.live->'copy'->'en', f.live->'copy'->'az',
                     (SELECT value FROM jsonb_each(f.live->'copy') ORDER BY key LIMIT 1)),
    'language', CASE WHEN f.live->'copy' ? p_language THEN p_language WHEN f.live->'copy' ? 'en' THEN 'en' WHEN f.live->'copy' ? 'az' THEN 'az'
      ELSE (SELECT key FROM jsonb_each(f.live->'copy') ORDER BY key LIMIT 1) END,
    'privacy_url', f.live->>'privacy_url', 'retention_days', (f.live->>'retention_days')::int)
$$;

-- ── Consumer lead form RPCs ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_ad_lead_form_v1(p_banner uuid, p_language text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_form public.ad_lead_forms; v_banner public.banners;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'BRAND_ADS_ACCESS_DENIED' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_banner FROM public.banners WHERE id = p_banner AND link_type = 'lead_form';
  IF NOT FOUND OR NOT public.brand_banner_eligible_v3(p_banner, auth.uid(), p_language) THEN RETURN NULL; END IF;
  SELECT f.* INTO v_form FROM public.ad_lead_forms f JOIN public.ad_brand_creatives c ON c.brand_id = f.brand_id AND c.banner_id = p_banner AND c.deleted_at IS NULL
    WHERE f.id = v_banner.lead_form_id AND f.live IS NOT NULL AND f.status <> 'archived';
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN public.ad_lead_form_public_v1(v_form, p_language)
    || jsonb_build_object('sponsor_name', (SELECT name FROM public.ad_brands WHERE id = v_form.brand_id));
END $$;

CREATE OR REPLACE FUNCTION public.submit_ad_lead_v1(p_banner uuid, p_delivery uuid, p_answers jsonb, p_language text, p_consent boolean, p_request uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_actor uuid := auth.uid(); v_form jsonb; v_row public.ad_lead_forms; v_creative public.ad_brand_creatives; v_existing uuid;
  v_clean jsonb := '{}'::jsonb; f jsonb; v_value text; v_id uuid;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'BRAND_ADS_ACCESS_DENIED' USING ERRCODE = '42501'; END IF;
  IF p_consent IS NOT TRUE OR p_request IS NULL OR jsonb_typeof(p_answers) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'BRAND_ADS_INVALID_FILTER' USING ERRCODE = '22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_actor::text, 342));
  SELECT id INTO v_existing FROM public.ad_leads WHERE actor_id = v_actor AND request_id = p_request;
  IF FOUND THEN RETURN jsonb_build_object('id', v_existing, 'duplicate', true); END IF;
  -- Bounded opportunistic retention purge; no new cron/timer is introduced.
  DELETE FROM public.ad_leads WHERE id IN (SELECT id FROM public.ad_leads WHERE expires_at < now() LIMIT 500);
  IF (SELECT count(*) FROM public.ad_leads WHERE actor_id = v_actor AND created_at > now() - interval '1 day') >= 10 THEN
    RAISE EXCEPTION 'BRAND_ADS_RATE_LIMITED' USING ERRCODE = 'P0001';
  END IF;
  v_form := public.get_ad_lead_form_v1(p_banner, p_language);
  IF v_form IS NULL THEN RAISE EXCEPTION 'BRAND_ADS_ACCESS_DENIED' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_row FROM public.ad_lead_forms WHERE id = (v_form->>'id')::uuid;
  SELECT * INTO v_creative FROM public.ad_brand_creatives WHERE banner_id = p_banner AND deleted_at IS NULL;
  SELECT id INTO v_existing FROM public.ad_leads WHERE actor_id = v_actor AND form_id = v_row.id AND created_at > now() - interval '30 days' LIMIT 1;
  IF FOUND THEN RETURN jsonb_build_object('id', v_existing, 'duplicate', true); END IF;
  FOR f IN SELECT * FROM jsonb_array_elements(v_form->'fields') LOOP
    v_value := left(btrim(coalesce(p_answers->>(f->>'key'), '')), CASE WHEN f->>'key' LIKE 'question_%' THEN 500 ELSE 254 END);
    IF v_value = '' THEN
      IF (f->>'required')::boolean THEN RAISE EXCEPTION 'BRAND_ADS_INVALID_FILTER' USING ERRCODE = '22023'; END IF;
      CONTINUE;
    END IF;
    IF f->>'key' = 'email' AND v_value !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$' THEN RAISE EXCEPTION 'BRAND_ADS_INVALID_FILTER' USING ERRCODE = '22023'; END IF;
    IF f->>'key' = 'phone' THEN
      v_value := regexp_replace(v_value, '[[:space:]().-]', '', 'g');
      IF v_value !~ '^\+?[0-9]{7,15}$' THEN RAISE EXCEPTION 'BRAND_ADS_INVALID_FILTER' USING ERRCODE = '22023'; END IF;
    END IF;
    v_clean := v_clean || jsonb_build_object(f->>'key', v_value);
  END LOOP;
  IF v_clean = '{}'::jsonb THEN RAISE EXCEPTION 'BRAND_ADS_INVALID_FILTER' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.ad_leads (form_id, brand_id, banner_id, creative_id, delivery_id, actor_id, form_revision, answers, language,
    consent_text, consent_at, request_id, expires_at)
  VALUES (v_row.id, v_row.brand_id, p_banner, v_creative.id,
    (SELECT id FROM public.ad_delivery_receipts WHERE id = p_delivery AND actor_id = v_actor),
    v_actor, (v_form->>'revision')::int, v_clean, v_form->>'language', v_form->'copy'->>'consent', now(), p_request,
    now() + make_interval(days => (v_form->>'retention_days')::int))
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('id', v_id, 'duplicate', false);
END $$;

-- ── Brand portal: leads (owner brand only, every read audited) ─────────────────
CREATE OR REPLACE FUNCTION public.brand_leads_v1(p_brand uuid, p_form uuid DEFAULT NULL, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0, p_export boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_rows jsonb; v_total integer;
BEGIN
  PERFORM public.brand_ads_access_v1(p_brand);
  -- Administrators manage the programme but never read another company's leads.
  IF NOT EXISTS (SELECT 1 FROM public.ad_brand_members WHERE brand_id = p_brand AND user_id = auth.uid() AND is_active) THEN
    RAISE EXCEPTION 'BRAND_ADS_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.ad_leads WHERE brand_id = p_brand AND expires_at < now();
  SELECT count(*) INTO v_total FROM public.ad_leads WHERE brand_id = p_brand AND (p_form IS NULL OR form_id = p_form);
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'form_id', l.form_id, 'form_name', f.name, 'answers', l.answers,
           'language', l.language, 'consent_text', l.consent_text, 'consent_at', l.consent_at, 'created_at', l.created_at,
           'expires_at', l.expires_at, 'banner_id', l.banner_id) ORDER BY l.created_at DESC), '[]'::jsonb) INTO v_rows
  FROM (SELECT * FROM public.ad_leads WHERE brand_id = p_brand AND (p_form IS NULL OR form_id = p_form)
        ORDER BY created_at DESC LIMIT CASE WHEN p_export THEN 5000 ELSE least(greatest(coalesce(p_limit, 50), 1), 200) END
        OFFSET CASE WHEN p_export THEN 0 ELSE greatest(coalesce(p_offset, 0), 0) END) l
  JOIN public.ad_lead_forms f ON f.id = l.form_id;
  INSERT INTO public.ad_brand_audit (id, action, actor_id, args_hash, brand_id, response, target_id)
  VALUES (gen_random_uuid(), CASE WHEN p_export THEN 'lead_export' ELSE 'lead_read' END, auth.uid(),
          md5(concat_ws(':', p_brand, p_form, p_limit, p_offset, p_export)), p_brand,
          jsonb_build_object('rows', jsonb_array_length(v_rows), 'total', v_total), p_form);
  RETURN jsonb_build_object('protocol', 'anacan-brand-leads-v1', 'brand', p_brand, 'total', v_total, 'leads', v_rows,
    'export_truncated', p_export AND v_total > 5000);
END $$;

CREATE OR REPLACE FUNCTION public.brand_lead_forms_v1(p_brand uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  PERFORM public.brand_ads_access_v1(p_brand);
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name, 'fields', fields, 'copy', copy, 'privacy_url', privacy_url,
      'retention_days', retention_days, 'status', status, 'live', live IS NOT NULL, 'review_note', review_note, 'revision', revision,
      'updated_at', updated_at, 'leads', (SELECT count(*) FROM public.ad_leads l WHERE l.form_id = f.id)) ORDER BY updated_at DESC)
    FROM public.ad_lead_forms f WHERE brand_id = p_brand), '[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.brand_lead_form_save_v1(p_brand uuid, p_form uuid, p_payload jsonb, p_submit boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_clean jsonb; v_id uuid; v_retention integer := coalesce((p_payload->>'retention_days')::int, 90);
BEGIN
  PERFORM public.brand_ads_access_v1(p_brand);
  v_clean := public.ad_lead_form_payload_v1(p_payload);
  IF v_retention NOT BETWEEN 1 AND 90 OR char_length(btrim(coalesce(p_payload->>'name', ''))) NOT BETWEEN 1 AND 100
     OR coalesce(p_payload->>'privacy_url', '') <> '' AND p_payload->>'privacy_url' !~ '^https://[^[:space:]@/]+(/[^[:space:]]*)?$' THEN
    RAISE EXCEPTION 'BRAND_ADS_INVALID_FILTER' USING ERRCODE = '22023';
  END IF;
  IF p_form IS NULL THEN
    INSERT INTO public.ad_lead_forms (brand_id, name, fields, copy, privacy_url, retention_days, status, created_by, submitted_at)
    VALUES (p_brand, btrim(p_payload->>'name'), v_clean->'fields', v_clean->'copy', nullif(p_payload->>'privacy_url', ''), v_retention,
            CASE WHEN p_submit THEN 'pending' ELSE 'draft' END, auth.uid(), CASE WHEN p_submit THEN now() END)
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.ad_lead_forms SET name = btrim(p_payload->>'name'), fields = v_clean->'fields', copy = v_clean->'copy',
      privacy_url = nullif(p_payload->>'privacy_url', ''), retention_days = v_retention, revision = revision + 1,
      status = CASE WHEN p_submit THEN 'pending' ELSE 'draft' END, submitted_at = CASE WHEN p_submit THEN now() ELSE submitted_at END,
      review_note = NULL, updated_at = now()
    WHERE id = p_form AND brand_id = p_brand AND status <> 'archived' RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'BRAND_ADS_ACCESS_DENIED' USING ERRCODE = '42501'; END IF;
  END IF;
  RETURN jsonb_build_object('id', v_id);
END $$;

-- ── Brand creative drafts ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ad_creative_payload_v1(p_brand uuid, p jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v jsonb; v_copy jsonb := '{}'::jsonb; l record; v_lang jsonb; v_weeks smallint[];
BEGIN
  IF p->>'placement' IS NULL OR p->>'placement' NOT IN ('home_top','home_middle','home_bottom','tools_top','tools_bottom','profile_top','community_top','ai_chat_top')
     OR coalesce(p->>'banner_type', 'native') NOT IN ('native','image')
     OR coalesce(p->>'native_template', 'classic') NOT IN ('classic','spotlight','split','minimal','offer','expert')
     OR coalesce(p->>'link_type', 'external') NOT IN ('external','lead_form') THEN
    RAISE EXCEPTION 'BRAND_ADS_INVALID_FILTER' USING ERRCODE = '22023';
  END IF;
  IF p->>'link_type' = 'lead_form' AND NOT EXISTS (SELECT 1 FROM public.ad_lead_forms WHERE id = (p->>'lead_form_id')::uuid AND brand_id = p_brand) THEN
    RAISE EXCEPTION 'BRAND_ADS_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  IF coalesce(p->>'link_type', 'external') = 'external' AND coalesce(p->>'link_url', '') !~ '^https://[^[:space:]@/]+(/[^[:space:]]*)?$' THEN
    RAISE EXCEPTION 'BRAND_ADS_INVALID_FILTER' USING ERRCODE = '22023';
  END IF;
  IF (coalesce(p->>'image_url', '') <> '' AND p->>'image_url' !~ '^https://[^[:space:]@/]+(/[^[:space:]]*)?$')
     OR coalesce(p->>'background_color', '#F48155') !~ '^#[0-9A-Fa-f]{6}$' OR coalesce(p->>'text_color', '#FFFFFF') !~ '^#[0-9A-Fa-f]{6}$' THEN
    RAISE EXCEPTION 'BRAND_ADS_INVALID_FILTER' USING ERRCODE = '22023';
  END IF;
  FOR l IN SELECT * FROM jsonb_each(CASE WHEN jsonb_typeof(p->'copy') = 'object' THEN p->'copy' ELSE '{}'::jsonb END) LOOP
    IF l.key !~ '^[a-z]{2}$' OR jsonb_typeof(l.value) <> 'object' THEN CONTINUE; END IF;
    SELECT jsonb_object_agg(key, left(btrim(value), CASE WHEN key = 'description' THEN 240 ELSE 80 END)) INTO v_lang
    FROM jsonb_each_text(l.value) WHERE key IN ('title','description','button_text') AND btrim(value) <> '';
    IF v_lang ? 'title' THEN v_copy := v_copy || jsonb_build_object(l.key, v_lang); END IF;
  END LOOP;
  IF v_copy = '{}'::jsonb THEN RAISE EXCEPTION 'BRAND_ADS_INVALID_FILTER' USING ERRCODE = '22023'; END IF;
  SELECT array_agg(DISTINCT w::smallint ORDER BY w::smallint) INTO v_weeks
    FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(p->'target_pregnancy_weeks') = 'array' THEN p->'target_pregnancy_weeks' ELSE '[]'::jsonb END) w
    WHERE w ~ '^[0-9]{1,2}$' AND w::int BETWEEN 1 AND 42;
  v := jsonb_build_object(
    'placement', p->>'placement', 'banner_type', coalesce(p->>'banner_type', 'native'),
    'native_template', coalesce(p->>'native_template', 'classic'),
    'creative_options', jsonb_strip_nulls(jsonb_build_object('offer_code', left(p->'creative_options'->>'offer_code', 24),
      'expert_name', left(p->'creative_options'->>'expert_name', 60), 'expert_role', left(p->'creative_options'->>'expert_role', 60))),
    'image_url', nullif(p->>'image_url', ''), 'background_color', coalesce(p->>'background_color', '#F48155'),
    'text_color', coalesce(p->>'text_color', '#FFFFFF'), 'link_type', coalesce(p->>'link_type', 'external'),
    'link_url', CASE WHEN coalesce(p->>'link_type', 'external') = 'external' THEN p->>'link_url' END,
    'lead_form_id', CASE WHEN p->>'link_type' = 'lead_form' THEN p->>'lead_form_id' END, 'copy', v_copy,
    'audience_tiers', (SELECT coalesce(jsonb_agg(DISTINCT t), '["free"]'::jsonb) FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(p->'audience_tiers') = 'array' THEN p->'audience_tiers' ELSE '["free"]'::jsonb END) t WHERE t IN ('free','premium')),
    'target_life_stages', (SELECT jsonb_agg(DISTINCT s) FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(p->'target_life_stages') = 'array' THEN p->'target_life_stages' ELSE '[]'::jsonb END) s WHERE s IN ('flow','bump','mommy','partner')),
    'target_languages', (SELECT jsonb_agg(DISTINCT s) FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(p->'target_languages') = 'array' THEN p->'target_languages' ELSE '[]'::jsonb END) s WHERE s ~ '^[a-z]{2}$'),
    'target_countries', (SELECT jsonb_agg(DISTINCT upper(s)) FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(p->'target_countries') = 'array' THEN p->'target_countries' ELSE '[]'::jsonb END) s WHERE s ~ '^[A-Za-z]{2}$'),
    'target_pregnancy_week_min', (p->>'target_pregnancy_week_min')::smallint, 'target_pregnancy_week_max', (p->>'target_pregnancy_week_max')::smallint,
    'target_pregnancy_weeks', to_jsonb(v_weeks),
    'target_child_age_min_days', (p->>'target_child_age_min_days')::int, 'target_child_age_max_days', (p->>'target_child_age_max_days')::int,
    'start_date', p->>'start_date', 'end_date', p->>'end_date');
  IF (v->>'target_pregnancy_week_min')::int NOT BETWEEN 1 AND 42 OR (v->>'target_pregnancy_week_max')::int NOT BETWEEN 1 AND 42
     OR (v->>'target_pregnancy_week_min')::int > (v->>'target_pregnancy_week_max')::int
     OR (v->>'target_child_age_min_days')::int NOT BETWEEN 0 AND 2190 OR (v->>'target_child_age_max_days')::int NOT BETWEEN 0 AND 2190
     OR (v->>'target_child_age_min_days')::int > (v->>'target_child_age_max_days')::int THEN
    RAISE EXCEPTION 'BRAND_ADS_INVALID_FILTER' USING ERRCODE = '22023';
  END IF;
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.brand_creative_drafts_v1(p_brand uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  PERFORM public.brand_ads_access_v1(p_brand);
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'banner_id', banner_id, 'payload', payload, 'status', status,
      'review_note', review_note, 'revision', revision, 'updated_at', updated_at) ORDER BY updated_at DESC)
    FROM public.ad_creative_drafts WHERE brand_id = p_brand AND status <> 'archived'), '[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.brand_creative_draft_save_v1(p_brand uuid, p_draft uuid, p_banner uuid, p_payload jsonb, p_submit boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_clean jsonb; v_id uuid;
BEGIN
  PERFORM public.brand_ads_access_v1(p_brand);
  IF p_banner IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.ad_brand_creatives WHERE banner_id = p_banner AND brand_id = p_brand AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'BRAND_ADS_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  v_clean := public.ad_creative_payload_v1(p_brand, p_payload);
  IF p_draft IS NULL THEN
    INSERT INTO public.ad_creative_drafts (brand_id, banner_id, payload, status, created_by, submitted_at)
    VALUES (p_brand, p_banner, v_clean, CASE WHEN p_submit THEN 'pending' ELSE 'draft' END, auth.uid(), CASE WHEN p_submit THEN now() END)
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.ad_creative_drafts SET payload = v_clean, revision = revision + 1, review_note = NULL, updated_at = now(),
      status = CASE WHEN p_submit THEN 'pending' ELSE 'draft' END, submitted_at = CASE WHEN p_submit THEN now() ELSE submitted_at END
    WHERE id = p_draft AND brand_id = p_brand AND status IN ('draft','rejected','pending') RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'BRAND_ADS_ACCESS_DENIED' USING ERRCODE = '42501'; END IF;
  END IF;
  RETURN jsonb_build_object('id', v_id);
END $$;

-- ── Administrator review (/brands/manage) ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_brand_review_queue_v1() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  PERFORM public.brand_ads_admin_v1();
  RETURN jsonb_build_object(
    'creatives', coalesce((SELECT jsonb_agg(jsonb_build_object('id', d.id, 'brand_id', d.brand_id, 'brand_name', b.name, 'banner_id', d.banner_id,
        'payload', d.payload, 'revision', d.revision, 'submitted_at', d.submitted_at) ORDER BY d.submitted_at)
      FROM public.ad_creative_drafts d JOIN public.ad_brands b ON b.id = d.brand_id WHERE d.status = 'pending'), '[]'::jsonb),
    -- Lead form copy only; administrators never receive lead answers.
    'lead_forms', coalesce((SELECT jsonb_agg(jsonb_build_object('id', f.id, 'brand_id', f.brand_id, 'brand_name', b.name, 'name', f.name,
        'fields', f.fields, 'copy', f.copy, 'privacy_url', f.privacy_url, 'retention_days', f.retention_days, 'revision', f.revision,
        'submitted_at', f.submitted_at) ORDER BY f.submitted_at)
      FROM public.ad_lead_forms f JOIN public.ad_brands b ON b.id = f.brand_id WHERE f.status = 'pending'), '[]'::jsonb));
END $$;

CREATE OR REPLACE FUNCTION public.admin_brand_review_v1(p_kind text, p_id uuid, p_revision integer, p_approve boolean, p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE d public.ad_creative_drafts; f public.ad_lead_forms; p jsonb; v_banner uuid; l record;
  v_columns constant text[] := ARRAY['az','en','es','fr','hi','id','ja','ko','nl','pl','pt','ru','sv','tr','vi','zh'];
BEGIN
  PERFORM public.brand_ads_admin_v1();
  IF p_kind = 'lead_form' THEN
    SELECT * INTO f FROM public.ad_lead_forms WHERE id = p_id AND status = 'pending' AND revision = p_revision FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'BRAND_ADS_OWNERSHIP_LOCKED' USING ERRCODE = 'P0001'; END IF;
    UPDATE public.ad_lead_forms SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END, review_note = left(p_note, 500),
      reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now(),
      live = CASE WHEN p_approve THEN jsonb_build_object('fields', fields, 'copy', copy, 'privacy_url', privacy_url,
        'retention_days', retention_days, 'revision', revision) ELSE live END
    WHERE id = f.id;
    INSERT INTO public.ad_brand_audit (id, action, actor_id, args_hash, brand_id, response, target_id)
    VALUES (gen_random_uuid(), 'lead_form_review', auth.uid(), md5(concat_ws(':', p_id, p_revision, p_approve)), f.brand_id, jsonb_build_object('approved', p_approve), p_id);
    RETURN jsonb_build_object('id', p_id, 'status', CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END);
  ELSIF p_kind IS DISTINCT FROM 'creative' THEN RAISE EXCEPTION 'BRAND_ADS_INVALID_FILTER' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO d FROM public.ad_creative_drafts WHERE id = p_id AND status = 'pending' AND revision = p_revision FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'BRAND_ADS_OWNERSHIP_LOCKED' USING ERRCODE = 'P0001'; END IF;
  IF NOT p_approve THEN
    UPDATE public.ad_creative_drafts SET status = 'rejected', review_note = left(p_note, 500), reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now() WHERE id = d.id;
    INSERT INTO public.ad_brand_audit (id, action, actor_id, args_hash, brand_id, response, target_id)
    VALUES (gen_random_uuid(), 'creative_review', auth.uid(), md5(concat_ws(':', p_id, p_revision, false)), d.brand_id, jsonb_build_object('approved', false), p_id);
    RETURN jsonb_build_object('id', p_id, 'status', 'rejected');
  END IF;
  p := public.ad_creative_payload_v1(d.brand_id, d.payload);
  IF d.banner_id IS NULL THEN
    -- New creatives start inactive; the administrator activates them in the banner console.
    INSERT INTO public.banners (title, placement, banner_type, is_active, is_premium_only, sort_order)
    VALUES (p->'copy'->(SELECT min(key) FROM jsonb_each(p->'copy'))->>'title', p->>'placement', p->>'banner_type', false, false, 100)
    RETURNING id INTO v_banner;
  ELSE v_banner := d.banner_id;
  END IF;
  UPDATE public.banners SET
    title = coalesce(p->'copy'->'az'->>'title', p->'copy'->'en'->>'title', title),
    description = coalesce(p->'copy'->'az'->>'description', p->'copy'->'en'->>'description'),
    button_text = coalesce(p->'copy'->'az'->>'button_text', p->'copy'->'en'->>'button_text'),
    placement = p->>'placement', banner_type = p->>'banner_type', native_template = p->>'native_template',
    creative_options = p->'creative_options', creative_copy = p->'copy', image_url = p->>'image_url',
    background_color = p->>'background_color', text_color = p->>'text_color', link_type = p->>'link_type',
    link_url = p->>'link_url', lead_form_id = (p->>'lead_form_id')::uuid,
    audience_tiers = ARRAY(SELECT jsonb_array_elements_text(p->'audience_tiers')),
    target_life_stages = CASE WHEN jsonb_typeof(p->'target_life_stages') = 'array' THEN ARRAY(SELECT jsonb_array_elements_text(p->'target_life_stages')) END,
    target_languages = CASE WHEN jsonb_typeof(p->'target_languages') = 'array' THEN ARRAY(SELECT jsonb_array_elements_text(p->'target_languages')) END,
    target_countries = CASE WHEN jsonb_typeof(p->'target_countries') = 'array' THEN ARRAY(SELECT jsonb_array_elements_text(p->'target_countries')) END,
    target_pregnancy_week_min = (p->>'target_pregnancy_week_min')::smallint, target_pregnancy_week_max = (p->>'target_pregnancy_week_max')::smallint,
    target_pregnancy_weeks = CASE WHEN jsonb_typeof(p->'target_pregnancy_weeks') = 'array' THEN ARRAY(SELECT jsonb_array_elements_text(p->'target_pregnancy_weeks')::smallint) END,
    target_child_age_min_days = (p->>'target_child_age_min_days')::int, target_child_age_max_days = (p->>'target_child_age_max_days')::int,
    start_date = (p->>'start_date')::timestamptz, end_date = (p->>'end_date')::timestamptz, updated_at = now()
  WHERE id = v_banner;
  -- Mirror per-language copy into the legacy translation columns that exist.
  FOR l IN SELECT key, value FROM jsonb_each(p->'copy') WHERE key = ANY(v_columns) LOOP
    EXECUTE format('UPDATE public.banners SET %I = $1, %I = $2, %I = $3 WHERE id = $4', 'title_' || l.key, 'description_' || l.key, 'button_text_' || l.key)
      USING l.value->>'title', l.value->>'description', l.value->>'button_text', v_banner;
  END LOOP;
  IF d.banner_id IS NULL THEN
    PERFORM public.admin_brand_action_v1(p_action => 'assign_banner', p_brand => d.brand_id, p_target => v_banner,
      p_payload => '{}'::jsonb, p_request => d.id);
  END IF;
  UPDATE public.ad_creative_drafts SET status = 'approved', banner_id = v_banner, review_note = left(p_note, 500),
    reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now() WHERE id = d.id;
  INSERT INTO public.ad_brand_audit (id, action, actor_id, args_hash, brand_id, response, target_id)
  VALUES (gen_random_uuid(), 'creative_review', auth.uid(), md5(concat_ws(':', p_id, p_revision, true)), d.brand_id, jsonb_build_object('banner', v_banner), p_id);
  RETURN jsonb_build_object('id', p_id, 'status', 'approved', 'banner_id', v_banner);
END $$;

CREATE OR REPLACE FUNCTION public.get_brand_ads_v3_contract_v1() RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path = pg_catalog, public AS $$
  SELECT jsonb_build_object('protocol', 'anacan-brand-ads-v3', 'k_anonymity', 20, 'lead_retention_days_max', 90,
    'templates', jsonb_build_array('classic','spotlight','split','minimal','offer','expert'),
    'relations', jsonb_build_array('ad_lead_forms','ad_leads','ad_creative_drafts','banners','ad_delivery_receipts'))
$$;

-- ── Grants: internal helpers are not callable; client RPCs need a session ───────
REVOKE ALL ON FUNCTION
  public.brand_ads_week_bucket_v1(integer), public.brand_ads_child_bucket_v1(integer),
  public.brand_ads_audience_facts_v1(uuid), public.brand_ads_targeting_matches_v1(public.banners, jsonb, text, boolean),
  public.brand_banner_eligible_v3(uuid, uuid, text), public.brand_ads_row_v3(public.banners, public.ad_brands, public.ad_brand_creatives),
  public.ad_lead_form_payload_v1(jsonb), public.ad_lead_form_public_v1(public.ad_lead_forms, text), public.ad_creative_payload_v1(uuid, jsonb),
  public.get_banner_inventory_v3(uuid, text, text), public.issue_brand_ad_delivery_v2(uuid, uuid, uuid, text, text),
  public.record_brand_ad_event_v2(uuid, uuid, text, integer), public.brand_audience_report_v1(uuid, date, date, text, uuid),
  public.get_ad_lead_form_v1(uuid, text), public.submit_ad_lead_v1(uuid, uuid, jsonb, text, boolean, uuid),
  public.brand_leads_v1(uuid, uuid, integer, integer, boolean), public.brand_lead_forms_v1(uuid),
  public.brand_lead_form_save_v1(uuid, uuid, jsonb, boolean), public.brand_creative_drafts_v1(uuid),
  public.brand_creative_draft_save_v1(uuid, uuid, uuid, jsonb, boolean), public.admin_brand_review_queue_v1(),
  public.admin_brand_review_v1(text, uuid, integer, boolean, text), public.get_brand_ads_v3_contract_v1()
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION
  public.get_banner_inventory_v3(uuid, text, text), public.issue_brand_ad_delivery_v2(uuid, uuid, uuid, text, text),
  public.record_brand_ad_event_v2(uuid, uuid, text, integer), public.brand_audience_report_v1(uuid, date, date, text, uuid),
  public.get_ad_lead_form_v1(uuid, text), public.submit_ad_lead_v1(uuid, uuid, jsonb, text, boolean, uuid),
  public.brand_leads_v1(uuid, uuid, integer, integer, boolean), public.brand_lead_forms_v1(uuid),
  public.brand_lead_form_save_v1(uuid, uuid, jsonb, boolean), public.brand_creative_drafts_v1(uuid),
  public.brand_creative_draft_save_v1(uuid, uuid, uuid, jsonb, boolean), public.admin_brand_review_queue_v1(),
  public.admin_brand_review_v1(text, uuid, integer, boolean, text), public.get_brand_ads_v3_contract_v1()
TO authenticated;

-- ── CDC + writer guard enrollment (same shape as every guarded relation) ────────
DO $$
DECLARE t text;
BEGIN
  IF to_regclass('_anacan_gcp_migration.guarded_relations') IS NULL THEN
    RAISE EXCEPTION 'BRAND_ADS_GUARD_CATALOG_MISSING';
  END IF;
  FOREACH t IN ARRAY ARRAY['ad_lead_forms','ad_leads','ad_creative_drafts'] LOOP
    INSERT INTO _anacan_gcp_migration.guarded_relations (schema_name, table_name, primary_key)
    SELECT 'public', t, ARRAY['id'] WHERE NOT EXISTS (
      SELECT 1 FROM _anacan_gcp_migration.guarded_relations WHERE schema_name = 'public' AND table_name = t);
    EXECUTE format('DROP TRIGGER IF EXISTS anacan_gcp_writer_guard ON public.%I', t);
    EXECUTE format('DROP TRIGGER IF EXISTS anacan_gcp_change ON public.%I', t);
    EXECUTE format('DROP TRIGGER IF EXISTS anacan_gcp_truncate ON public.%I', t);
    EXECUTE format('CREATE TRIGGER anacan_gcp_writer_guard BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION _anacan_gcp_migration.guard_write()', t);
    EXECUTE format('CREATE TRIGGER anacan_gcp_change AFTER INSERT OR DELETE OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION _anacan_gcp_migration.capture_change()', t);
    EXECUTE format('CREATE TRIGGER anacan_gcp_truncate AFTER TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION _anacan_gcp_migration.capture_change()', t);
  END LOOP;
  -- Changed relations must already be guarded; refuse to continue otherwise.
  IF (SELECT count(*) FROM _anacan_gcp_migration.guarded_relations WHERE schema_name = 'public'
      AND table_name IN ('banners','ad_delivery_receipts','ad_lead_forms','ad_leads','ad_creative_drafts')) <> 5
     OR (SELECT count(DISTINCT c.relname) FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid
         WHERE tg.tgname = 'anacan_gcp_writer_guard' AND c.relname IN ('banners','ad_delivery_receipts','ad_lead_forms','ad_leads','ad_creative_drafts')) <> 5 THEN
    RAISE EXCEPTION 'BRAND_ADS_GUARD_ENROLLMENT_INCOMPLETE';
  END IF;
END $$;

-- ── Ownership: same owner as the existing brand-ads objects ─────────────────────
DO $$
DECLARE r record;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pgadmin') THEN
    EXECUTE 'ALTER TABLE public.ad_lead_forms OWNER TO pgadmin';
    EXECUTE 'ALTER TABLE public.ad_leads OWNER TO pgadmin';
    EXECUTE 'ALTER TABLE public.ad_creative_drafts OWNER TO pgadmin';
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname IN ('brand_ads_week_bucket_v1','brand_ads_child_bucket_v1','brand_ads_audience_facts_v1',
        'brand_ads_targeting_matches_v1','brand_banner_eligible_v3','brand_ads_row_v3','get_banner_inventory_v3','issue_brand_ad_delivery_v2',
        'record_brand_ad_event_v2','brand_audience_report_v1','ad_lead_form_payload_v1','ad_lead_form_public_v1','get_ad_lead_form_v1',
        'submit_ad_lead_v1','brand_leads_v1','brand_lead_forms_v1','brand_lead_form_save_v1','ad_creative_payload_v1','brand_creative_drafts_v1',
        'brand_creative_draft_save_v1','admin_brand_review_queue_v1','admin_brand_review_v1','get_brand_ads_v3_contract_v1') LOOP
      EXECUTE format('ALTER FUNCTION %s OWNER TO pgadmin', r.sig);
    END LOOP;
  END IF;
END $$;

COMMIT;
