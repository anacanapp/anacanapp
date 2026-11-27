-- Minimum app version for banners (2026-11-09), enforced on the server so old builds respect it too.
-- A banner may set creative_options.min_app_version (e.g. "49"). The client's version comes from the
-- X-Anacan-Version request header when a build sends it (planned), else from the newest app_version the user
-- recorded in user_consents (the consent screen ships with 49.0, so a user with no such record is on an older build).
-- Combined with the platform guard (20261109170000) in banner_client_allowed_v1, used by inventory v3, v2 and the
-- restrictive RLS policy for direct reads. Admins pass the version check (testing). Banners without
-- min_app_version are unaffected. Function/policy only; public.banners and public.user_consents stay guarded.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
BEGIN
  IF (SELECT count(*) FROM _anacan_gcp_migration.guarded_relations WHERE schema_name = 'public' AND table_name = 'banners') <> 1
     OR to_regprocedure('public.banner_platform_allowed_v1(text[])') IS NULL THEN
    RAISE EXCEPTION 'BANNER_MIN_VERSION_PREREQ_MISSING';
  END IF;
END $$;

-- "50.0.1" -> {50,0,1}; NULL when not a version.
CREATE OR REPLACE FUNCTION public.app_version_parts_v1(p text)
RETURNS integer[]
LANGUAGE sql
IMMUTABLE
SET search_path TO 'pg_catalog'
AS $function$
  SELECT CASE WHEN p ~ '^\s*[0-9]+(\.[0-9]+)*\s*$' THEN string_to_array(trim(p), '.')::integer[] ELSE NULL END
$function$;

CREATE OR REPLACE FUNCTION public.request_app_version_v1(p_actor uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
  SELECT coalesce(
    nullif(trim(coalesce(nullif(current_setting('request.headers', true), '')::json->>'x-anacan-version', '')), ''),
    (SELECT c.app_version FROM public.user_consents c
      WHERE c.user_id = p_actor AND public.app_version_parts_v1(c.app_version) IS NOT NULL
      ORDER BY public.app_version_parts_v1(c.app_version) DESC LIMIT 1))
$function$;
REVOKE ALL ON FUNCTION public.request_app_version_v1(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.banner_client_allowed_v1(p_targets text[], p_options jsonb, p_actor uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE v_min integer[]; v_have integer[];
BEGIN
  IF NOT public.banner_platform_allowed_v1(p_targets) THEN RETURN false; END IF;
  v_min := public.app_version_parts_v1(p_options->>'min_app_version');
  IF v_min IS NULL THEN RETURN true; END IF;
  IF p_actor IS NOT NULL AND public.has_role(p_actor, 'admin'::public.app_role) THEN RETURN true; END IF;
  v_have := public.app_version_parts_v1(public.request_app_version_v1(p_actor));
  RETURN v_have IS NOT NULL AND v_have >= v_min;
END $function$;
REVOKE ALL ON FUNCTION public.banner_client_allowed_v1(text[], jsonb, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.banner_client_allowed_v1(text[], jsonb, uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_banner_inventory_v3(p_actor uuid, p_placement text, p_language text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
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
      AND public.banner_client_allowed_v1(b.target_platforms::text[], b.creative_options, p_actor)
      AND (b.max_impressions_per_user IS NULL OR coalesce((SELECT seen_count FROM public.banner_impressions WHERE banner_id = b.id AND user_id = p_actor), 0) < b.max_impressions_per_user)
    ORDER BY b.sort_order, b.id LIMIT 20) x;
  RETURN result;
END $function$;

CREATE OR REPLACE FUNCTION public.get_banner_inventory_v2(p_actor uuid, p_placement text, p_language text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_actor THEN RAISE EXCEPTION 'BRAND_ADS_ACCOUNT_CHANGED' USING ERRCODE='42501'; END IF;
 IF p_placement IS NULL OR p_placement NOT IN ('home_top','home_middle','home_bottom','tools_top','tools_bottom','profile_top','community_top','ai_chat_top') THEN RAISE EXCEPTION 'BRAND_ADS_INVALID_PLACEMENT'; END IF;
 SELECT coalesce(jsonb_agg(x.value ORDER BY x.sort_order,x.id),'[]') INTO result FROM(
   SELECT b.id,b.sort_order,to_jsonb(b)-ARRAY['view_count','click_count']||jsonb_build_object('measurement_version',2,'sponsor_name',r.name,'sponsor_logo',r.logo_url,'creative_revision',c.revision,'branded',c.id IS NOT NULL) value
  FROM public.banners b LEFT JOIN public.ad_brand_creatives c ON c.banner_id=b.id LEFT JOIN public.ad_brands r ON r.id=c.brand_id
  WHERE b.placement=p_placement AND public.brand_banner_eligible_v1(b.id,p_actor,p_language)
   AND public.banner_client_allowed_v1(b.target_platforms::text[], b.creative_options, p_actor)
   AND (b.max_impressions_per_user IS NULL OR coalesce((SELECT seen_count FROM public.banner_impressions WHERE banner_id=b.id AND user_id=p_actor),0)<b.max_impressions_per_user)
  ORDER BY b.sort_order,b.id LIMIT 20)x;
 RETURN result;
END $function$;

DROP POLICY IF EXISTS banners_platform_server_guard_v1 ON public.banners;
CREATE POLICY banners_platform_server_guard_v1 ON public.banners AS RESTRICTIVE FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.banner_client_allowed_v1(target_platforms::text[], creative_options, auth.uid()));

COMMIT;
NOTIFY pgrst, 'reload schema';
