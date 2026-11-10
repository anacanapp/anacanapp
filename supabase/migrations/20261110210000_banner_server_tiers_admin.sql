-- Server-enforced audience tier with an admin exemption (2026-11-10, owner: admins see the 11.11 banners whatever
-- their Premium state). A banner may set creative_options.server_tiers (e.g. ["free"]): for everyone except admins
-- the server then requires the reader's tier (free / premium, same rule as brand_ads_audience_facts_v1) to be listed.
-- Because the app's BannerSlot also filters by audience_tiers on the client, such a banner keeps
-- audience_tiers = {free,premium} so current builds render it for a Premium admin, while the server withholds it from
-- every other Premium reader on all read paths (inventory v3, inventory v2, restrictive RLS: banner_client_allowed_v1).
-- Banners without server_tiers are unaffected. Function only; public.banners stays guarded (no relation change).
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
BEGIN
  IF (SELECT count(*) FROM _anacan_gcp_migration.guarded_relations WHERE schema_name = 'public' AND table_name = 'banners') <> 1
     OR to_regprocedure('public.banner_client_allowed_v1(text[], jsonb, uuid)') IS NULL
     OR to_regprocedure('public.get_premium_access_v1(uuid)') IS NULL THEN
    RAISE EXCEPTION 'BANNER_SERVER_TIERS_PREREQ_MISSING';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.banner_client_allowed_v1(p_targets text[], p_options jsonb, p_actor uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE v_min integer[]; v_have integer[]; v_admin boolean; v_access jsonb; v_tier text;
BEGIN
  IF NOT public.banner_platform_allowed_v1(p_targets) THEN RETURN false; END IF;
  v_admin := p_actor IS NOT NULL AND public.has_role(p_actor, 'admin'::public.app_role);
  IF jsonb_typeof(p_options->'server_tiers') = 'array' AND jsonb_array_length(p_options->'server_tiers') > 0 AND NOT v_admin THEN
    v_tier := 'free';
    IF p_actor IS NOT NULL AND p_actor = auth.uid() THEN
      v_access := public.get_premium_access_v1(p_actor);
      IF coalesce((v_access #>> '{own,active}')::boolean, false) OR coalesce((v_access #>> '{household,active}')::boolean, false) THEN
        v_tier := 'premium';
      END IF;
    ELSIF p_actor IS NOT NULL THEN
      RETURN false; -- another account's tier cannot be read here: withhold
    END IF;
    IF NOT (p_options->'server_tiers') ? v_tier THEN RETURN false; END IF;
  END IF;
  v_min := public.app_version_parts_v1(p_options->>'min_app_version');
  IF v_min IS NULL THEN RETURN true; END IF;
  IF v_admin THEN RETURN true; END IF;
  v_have := public.app_version_parts_v1(public.request_app_version_v1(p_actor));
  RETURN v_have IS NOT NULL AND v_have >= v_min;
END $function$;
REVOKE ALL ON FUNCTION public.banner_client_allowed_v1(text[], jsonb, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.banner_client_allowed_v1(text[], jsonb, uuid) TO anon, authenticated, service_role;

-- 11.11 Poz-Aç banners: everyone in the audience sees them except Premium non-admins.
UPDATE public.banners
   SET audience_tiers = ARRAY['free', 'premium'],
       creative_options = coalesce(creative_options, '{}'::jsonb) || '{"server_tiers": ["free"]}'::jsonb,
       updated_at = now()
 WHERE image_url LIKE '%/banners/promo/1111-%-20261110.jpg';

COMMIT;
NOTIFY pgrst, 'reload schema';
