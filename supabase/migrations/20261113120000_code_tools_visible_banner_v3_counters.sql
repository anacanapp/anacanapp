-- 2026-11-13 owner report fixes (no relation/data changes: one RLS policy and two function bodies).
--
-- 1) Tools page: "Körpə izləyicisi", "Yuxu təlimi", Tortlar, Mini oyunlar, Tərbiyə, Uşaqla oyun, Əlavə qida tiles
--    were missing for every non-admin user since 20261109120000_code_tool_rows. Those rows are stored with
--    is_active = false on purpose (older native builds query .eq('is_active', true) and add these tiles themselves),
--    but the only public SELECT policy is (is_active = true), so the current client's
--    .or(is_active.eq.true,tool_id.in.(code tools)) query got nothing back for them. Code tool rows are now readable;
--    older builds still filter is_active = true in their own query, so they see no duplicates.
--
-- 2) Banner counters: increment_banner_click / increment_banner_impression gate on brand_banner_eligible_v1, which
--    returns false for requires_v3 banners (served only by get_banner_inventory_v3, e.g. the PDF book banners), so
--    their click_count/view_count never moved. Unbranded requires_v3 banners are now checked with
--    brand_banner_eligible_v3 (the same rule their inventory uses). Everything else is unchanged.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DROP POLICY IF EXISTS "Anyone can view code tools" ON public.tool_configs;
CREATE POLICY "Anyone can view code tools" ON public.tool_configs FOR SELECT
  USING (tool_id = ANY (ARRAY['cakes','mini-games','baby-tracker','sleep-training','solid-food-guide','parenting','play-together']));

CREATE OR REPLACE FUNCTION public.banner_counter_eligible_v1(p_banner uuid, p_actor uuid, p_language text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE v3 boolean; branded boolean;
BEGIN
  SELECT coalesce(b.requires_v3, false), EXISTS(SELECT 1 FROM public.ad_brand_creatives c WHERE c.banner_id = b.id)
    INTO v3, branded FROM public.banners b WHERE b.id = p_banner;
  IF NOT FOUND THEN RETURN false; END IF;
  -- Branded creatives are measured only through record_brand_ad_event_*.
  IF v3 AND NOT branded THEN RETURN public.brand_banner_eligible_v3(p_banner, p_actor, p_language); END IF;
  RETURN public.brand_banner_eligible_v1(p_banner, p_actor, p_language);
END $function$;
ALTER FUNCTION public.banner_counter_eligible_v1(uuid, uuid, text) OWNER TO pgadmin;
REVOKE ALL ON FUNCTION public.banner_counter_eligible_v1(uuid, uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.increment_banner_click(p_banner_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE prior text;lang text;
BEGIN
 SELECT language INTO lang FROM public.user_preferences WHERE user_id=auth.uid();
 IF NOT public.banner_counter_eligible_v1(p_banner_id,auth.uid(),coalesce(lang,'az')) THEN RETURN; END IF;
 prior:=current_setting('anacan.brand_ad_counter',true);PERFORM set_config('anacan.brand_ad_counter',auth.uid()::text,true);
 UPDATE public.banners SET click_count=coalesce(click_count,0)+1 WHERE id=p_banner_id;
 PERFORM set_config('anacan.brand_ad_counter',coalesce(prior,''),true);
END $function$;

CREATE OR REPLACE FUNCTION public.increment_banner_impression(p_banner_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE prior text;lang text;
BEGIN
 SELECT language INTO lang FROM public.user_preferences WHERE user_id=auth.uid();
 IF NOT public.banner_counter_eligible_v1(p_banner_id,auth.uid(),coalesce(lang,'az')) THEN RETURN; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text,341));
 IF EXISTS(SELECT 1 FROM public.banners b WHERE id=p_banner_id AND max_impressions_per_user IS NOT NULL AND coalesce((SELECT seen_count FROM public.banner_impressions WHERE banner_id=b.id AND user_id=auth.uid()),0)>=max_impressions_per_user) THEN RETURN; END IF;
 INSERT INTO public.banner_impressions(banner_id,user_id,seen_count,first_seen_at,last_seen_at) VALUES(p_banner_id,auth.uid(),1,now(),now()) ON CONFLICT(banner_id,user_id) DO UPDATE SET seen_count=banner_impressions.seen_count+1,last_seen_at=now();
 prior:=current_setting('anacan.brand_ad_counter',true);PERFORM set_config('anacan.brand_ad_counter',auth.uid()::text,true);
 UPDATE public.banners SET view_count=coalesce(view_count,0)+1 WHERE id=p_banner_id;
 PERFORM set_config('anacan.brand_ad_counter',coalesce(prior,''),true);
END $function$;

NOTIFY pgrst, 'reload schema';
COMMIT;
