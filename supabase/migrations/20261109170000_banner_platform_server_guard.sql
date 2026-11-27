-- Banner platform targeting enforced on the server too (2026-11-09).
-- target_platforms was only filtered in the app (BannerSlot, builds from 2026-11-05), so older builds still showed
-- platform-targeted banners everywhere. The server now reads the request's User-Agent (PostgREST request.headers):
-- a request whose User-Agent says Android (WebView, Chrome, or the native Capacitor HTTP client "Dalvik/… Android …")
-- is "android", iPhone/iPad/iPod is "ios", anything else is unknown and left to the app's own filter.
-- A banner with target_platforms set is withheld from a known platform it does not list, on every read path:
-- get_banner_inventory_v3, get_banner_inventory_v2 and direct table reads (restrictive RLS policy; admins exempt).
-- Banners without target_platforms are unaffected. Function/policy only; public.banners stays a guarded relation.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
BEGIN
  IF (SELECT count(*) FROM _anacan_gcp_migration.guarded_relations WHERE schema_name = 'public' AND table_name = 'banners') <> 1 THEN
    RAISE EXCEPTION 'BANNER_PLATFORM_GUARD_CATALOG_MISSING';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.request_client_platform_v1()
RETURNS text
LANGUAGE sql
STABLE
SET search_path TO 'pg_catalog'
AS $function$
  SELECT CASE
    WHEN ua ~* 'android' THEN 'android'
    WHEN ua ~* '(iphone|ipad|ipod)' THEN 'ios'
    ELSE NULL END
  FROM (SELECT coalesce(nullif(current_setting('request.headers', true), '')::json->>'user-agent', '') AS ua) h
$function$;

CREATE OR REPLACE FUNCTION public.banner_platform_allowed_v1(p_targets text[])
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'pg_catalog', 'public'
AS $function$
  SELECT coalesce(cardinality(p_targets), 0) = 0
      OR public.request_client_platform_v1() IS NULL
      OR public.request_client_platform_v1() = ANY(p_targets)
$function$;

GRANT EXECUTE ON FUNCTION public.request_client_platform_v1() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.banner_platform_allowed_v1(text[]) TO anon, authenticated, service_role;

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
      AND public.banner_platform_allowed_v1(b.target_platforms::text[])
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
   AND public.banner_platform_allowed_v1(b.target_platforms::text[])
   AND (b.max_impressions_per_user IS NULL OR coalesce((SELECT seen_count FROM public.banner_impressions WHERE banner_id=b.id AND user_id=p_actor),0)<b.max_impressions_per_user)
  ORDER BY b.sort_order,b.id LIMIT 20)x;
 RETURN result;
END $function$;

DROP POLICY IF EXISTS banners_platform_server_guard_v1 ON public.banners;
CREATE POLICY banners_platform_server_guard_v1 ON public.banners AS RESTRICTIVE FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.banner_platform_allowed_v1(target_platforms::text[]));

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.banners'::regclass AND polname = 'banners_platform_server_guard_v1' AND NOT polpermissive) THEN
    RAISE EXCEPTION 'BANNER_PLATFORM_POLICY_MISSING';
  END IF;
END $$;

COMMIT;
NOTIFY pgrst, 'reload schema';
