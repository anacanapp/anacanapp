-- Push campaigns: "app version below X" filter (2026-11-12, owner request: reach users on old app versions).
-- The version is the one each user's app last reported (public.app_client_seen: X-Anacan-Version or the iOS
-- native user agent). With the filter set, only users whose reported version is below X are included, and only
-- their device on the platform that reported it. Users with no reported version are not included.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

CREATE OR REPLACE FUNCTION public.admin_notification_segment_v1(p_segment jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE s jsonb:=coalesce(p_segment,'{}'); f jsonb; p jsonb; v text;
BEGIN
 IF jsonb_typeof(s)<>'object' OR s-ARRAY['countries','languages','modules','access','platforms','joinedFrom','joinedTo','appVersionBelow']<>'{}' THEN
   RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='admin_invalid_segment'; END IF;
 f:=public.admin_insight_filters_v1(s-ARRAY['platforms','joinedFrom','joinedTo','appVersionBelow'])-'search';
 p:=coalesce(s->'platforms','[]');
 IF jsonb_typeof(p)<>'array' OR jsonb_array_length(p)>2 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p) x WHERE x NOT IN ('"ios"','"android"')) THEN
   RAISE EXCEPTION 'admin_invalid_segment'; END IF;
 f:=f||jsonb_build_object('platforms',coalesce((SELECT jsonb_agg(x ORDER BY x) FROM (SELECT DISTINCT value x FROM jsonb_array_elements_text(p)) q),'[]'));
 IF (s ? 'joinedFrom' AND s->'joinedFrom'<>'null' AND (jsonb_typeof(s->'joinedFrom')<>'string' OR s->>'joinedFrom' !~ '^\d{4}-\d{2}-\d{2}$'))
 OR (s ? 'joinedTo' AND s->'joinedTo'<>'null' AND (jsonb_typeof(s->'joinedTo')<>'string' OR s->>'joinedTo' !~ '^\d{4}-\d{2}-\d{2}$')) THEN RAISE EXCEPTION 'admin_invalid_segment'; END IF;
 IF s->>'joinedFrom' IS NOT NULL THEN PERFORM (s->>'joinedFrom')::date; END IF;
 IF s->>'joinedTo' IS NOT NULL THEN PERFORM (s->>'joinedTo')::date; END IF;
 IF s->>'joinedFrom' IS NOT NULL AND s->>'joinedTo' IS NOT NULL AND (s->>'joinedFrom')::date>(s->>'joinedTo')::date THEN RAISE EXCEPTION 'admin_invalid_segment'; END IF;
 -- Optional app version ceiling ("below X"), e.g. "50.0".
 IF s ? 'appVersionBelow' AND s->'appVersionBelow'<>'null' AND (jsonb_typeof(s->'appVersionBelow')<>'string' OR s->>'appVersionBelow' !~ '^\d{1,4}(\.\d{1,4}){0,3}$') THEN
   RAISE EXCEPTION 'admin_invalid_segment'; END IF;
 v:=nullif(s->>'appVersionBelow','');
 RETURN f||jsonb_build_object('joinedFrom',s->>'joinedFrom','joinedTo',s->>'joinedTo')
   ||CASE WHEN v IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('appVersionBelow',v) END;
END $function$;

CREATE OR REPLACE FUNCTION public.admin_notification_audience_v1(p_segment jsonb)
 RETURNS TABLE(user_id uuid, token_id uuid, token_hash text, platform text, eligible boolean, reason text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
 WITH canonical_tokens AS (
   -- Resolve the latest owner globally BEFORE filtering the audience.
   SELECT DISTINCT ON(token) id,user_id,token,platform FROM public.device_tokens WHERE length(btrim(token))>0
   ORDER BY token,updated_at DESC,created_at DESC,id DESC
 ), members AS (
   SELECT m.*,coalesce(u.notifications_enabled,true) AND coalesce(u.push_enabled,true) AND coalesce(u.daily_push_enabled,true) opted_in,
     public.admin_notification_quiet_v1(u.silent_hours_enabled,u.silent_hours_start::text,u.silent_hours_end::text) quiet,
     seen.platform seen_platform
   FROM public.admin_member_facts_v1() m LEFT JOIN public.user_preferences u USING(user_id)
   LEFT JOIN public.app_client_seen seen ON seen.user_id=m.user_id
   WHERE public.admin_matches_insight_v1(p_segment||'{"search":""}',m.country,m.language,m.module,m.access_kind,m.billing_cycle,m.subscription_status,m.expires_at,m.name,m.email)
   AND (p_segment->>'joinedFrom' IS NULL OR m.joined_at>=(p_segment->>'joinedFrom')::date::timestamptz)
   AND (p_segment->>'joinedTo' IS NULL OR m.joined_at<((p_segment->>'joinedTo')::date+1)::timestamptz)
   AND (p_segment->>'appVersionBelow' IS NULL
        OR (seen.app_version IS NOT NULL AND public.app_version_cmp_v1(seen.app_version, p_segment->>'appVersionBelow')<0))
 ) SELECT m.user_id,t.id,encode(sha256(convert_to(t.token,'UTF8')),'hex'),t.platform,
   m.opted_in AND NOT m.quiet AND t.id IS NOT NULL,
   CASE WHEN NOT m.opted_in THEN 'opted_out' WHEN m.quiet THEN 'quiet_hours' WHEN t.id IS NULL THEN 'no_device' ELSE 'eligible' END
 FROM members m LEFT JOIN canonical_tokens t ON t.user_id=m.user_id AND t.platform IN ('ios','android')
   AND (p_segment->'platforms'='[]' OR p_segment->'platforms' ? t.platform)
   -- With a version filter, only the device on the platform that reported the old version.
   AND (p_segment->>'appVersionBelow' IS NULL OR t.platform=m.seen_platform)
$function$;

NOTIFY pgrst, 'reload schema';
COMMIT;
