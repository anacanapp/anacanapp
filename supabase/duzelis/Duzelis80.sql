-- Duzelis80.sql — (1) separate server-side AI quota counters, (2) optional deep link on admin push campaigns.
-- Applied once on Google (psql as supabase_admin). No new relation; existing relations stay CDC/writer guarded.
--
-- (1) AI quota double count. The app increments usage_tracking(feature) BEFORE calling the AI function,
--     and the AI function then checks `used < limit` on the SAME row and increments it again after the
--     answer. With the configured ai_chat limit 3, a free user got 1 answer a day, not 3.
--     The shared server module now counts in its own row `<feature>_srv` for the features the app
--     pre-consumes (ai_chat, cry_translator, poop_scanner, horoscope). fairy_tale and baby_insight are
--     only read by the app, so they keep a single (server) counter. The app's own row and UI are unchanged.
ALTER TABLE public.usage_tracking DROP CONSTRAINT IF EXISTS usage_tracking_feature_type_check;
ALTER TABLE public.usage_tracking ADD CONSTRAINT usage_tracking_feature_type_check CHECK (feature_type = ANY (ARRAY[
  'white_noise','baby_photoshoot','ai_chat','cry_translator','poop_scanner','fairy_tale','horoscope','baby_insight','baby_chat_ai',
  'ai_chat_srv','cry_translator_srv','poop_scanner_srv','horoscope_srv']::text[]));

-- (2) Campaign deep link. Stored in audience_snapshot.deeplink and bound into payloadHash, so the link is
--     as immutable as title/body/segment. Only in-app schemes are accepted. Callers that do not pass
--     p_deeplink (the current admin build) behave exactly as before.
CREATE OR REPLACE FUNCTION public.admin_notification_deeplink_ok_v1(p text) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path TO 'pg_catalog' AS $$
  SELECT p IS NULL OR (length(p) <= 200 AND p ~ '^(anacan|com\.atlasoon\.anacan)://[A-Za-z0-9/_?=&.-]{1,180}$')
$$;

DROP FUNCTION IF EXISTS public.admin_notification_create_v1(uuid,text,text,jsonb,text);
CREATE FUNCTION public.admin_notification_create_v1(p_id uuid, p_title text, p_body text, p_segment jsonb, p_fingerprint text, p_deeplink text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
 SET "TimeZone" TO 'UTC'
AS $function$
DECLARE s jsonb; preview jsonb; existing public.bulk_push_notifications; payload_hash text; link text;
BEGIN
 PERFORM public.admin_assert_access_v1(); s:=public.admin_notification_segment_v1(p_segment);
 link:=nullif(btrim(coalesce(p_deeplink,'')),'');
 IF p_id IS NULL OR length(btrim(p_title)) NOT BETWEEN 1 AND 120 OR length(btrim(p_body)) NOT BETWEEN 1 AND 2000
   OR p_title IS NULL OR p_body IS NULL OR p_fingerprint IS NULL OR p_fingerprint !~ '^[a-f0-9]{64}$'
   OR NOT public.admin_notification_deeplink_ok_v1(link) THEN RAISE EXCEPTION 'admin_invalid_campaign'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_id::text,40));
 SELECT * INTO existing FROM public.bulk_push_notifications WHERE id=p_id;
 IF FOUND THEN
   IF existing.created_by IS DISTINCT FROM auth.uid() OR existing.title<>btrim(p_title) OR existing.body<>btrim(p_body)
     OR existing.segment IS DISTINCT FROM s OR (existing.audience_snapshot->>'deeplink') IS DISTINCT FROM link
     THEN RAISE EXCEPTION 'admin_campaign_id_conflict'; END IF;
   RETURN public.admin_notification_status_v1(p_id);
 END IF;
 preview:=public.admin_notification_preview_v1(s);
 IF preview->>'fingerprint'<>p_fingerprint THEN RAISE EXCEPTION 'admin_audience_changed'; END IF;
 IF (preview->>'devices')::int=0 THEN RAISE EXCEPTION 'admin_empty_audience'; END IF;
 payload_hash:=encode(sha256(convert_to(btrim(p_title)||'|'||btrim(p_body)||'|'||s::text||coalesce('|'||link,''),'UTF8')),'hex');
 INSERT INTO public.bulk_push_notifications(id,title,body,target_audience,status,created_by,segment,audience_snapshot)
 VALUES(p_id,btrim(p_title),btrim(p_body),'__segment_v1__','pending',auth.uid(),s,
   preview||jsonb_build_object('payloadHash',payload_hash)||CASE WHEN link IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('deeplink',link) END);
 INSERT INTO public.admin_notification_deliveries(campaign_id,user_id,token_id,token_hash,platform)
 SELECT p_id,user_id,token_id,token_hash,platform FROM public.admin_notification_audience_v1(s) WHERE eligible;
 IF (SELECT count(*) FROM public.admin_notification_deliveries WHERE campaign_id=p_id)<>(preview->>'devices')::int
 OR (SELECT encode(sha256(convert_to(s::text||'|'||coalesce(string_agg(user_id::text||':'||token_id::text||':'||token_hash||':'||platform,'|' ORDER BY token_id),''),'UTF8')),'hex')
   FROM public.admin_notification_deliveries WHERE campaign_id=p_id)<>p_fingerprint THEN RAISE EXCEPTION 'admin_audience_changed'; END IF;
 RETURN public.admin_notification_status_v1(p_id);
END $function$;
ALTER FUNCTION public.admin_notification_create_v1(uuid,text,text,jsonb,text,text) OWNER TO pgadmin;
REVOKE ALL ON FUNCTION public.admin_notification_create_v1(uuid,text,text,jsonb,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_notification_create_v1(uuid,text,text,jsonb,text,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_notification_claim_v1(p_id uuid, p_claim uuid, p_limit integer DEFAULT 50)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE campaign public.bulk_push_notifications; rows jsonb; link text;
BEGIN
 IF coalesce(auth.role(),'')<>'service_role' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='service_role_required'; END IF;
 IF p_claim IS NULL OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'admin_invalid_batch'; END IF;
 SELECT * INTO STRICT campaign FROM public.bulk_push_notifications WHERE id=p_id AND segment IS NOT NULL FOR UPDATE;
 link:=campaign.audience_snapshot->>'deeplink';
 IF campaign.target_audience<>'__segment_v1__' OR NOT public.admin_notification_deeplink_ok_v1(link)
   OR campaign.audience_snapshot->>'payloadHash' IS DISTINCT FROM
   encode(sha256(convert_to(campaign.title||'|'||campaign.body||'|'||campaign.segment::text||coalesce('|'||link,''),'UTF8')),'hex') THEN RAISE EXCEPTION 'admin_campaign_changed'; END IF;
 UPDATE public.admin_notification_deliveries SET state='unknown',error_code='worker_interrupted',finished_at=now()
 WHERE campaign_id=p_id AND state='claimed' AND claimed_at<now()-interval '5 minutes';
 IF coalesce((campaign.audience_snapshot->>'cancelled')::boolean,false) THEN
   RETURN jsonb_build_object('items','[]'::jsonb,'status',public.admin_notification_status_v1(p_id)); END IF;
 WITH eligible AS MATERIALIZED(SELECT a.* FROM public.admin_notification_audience_v1(campaign.segment) a WHERE a.eligible)
 UPDATE public.admin_notification_deliveries d SET state='skipped',error_code='eligibility_changed',finished_at=now()
 WHERE d.campaign_id=p_id AND d.state='pending' AND NOT EXISTS(SELECT 1 FROM eligible e WHERE e.user_id=d.user_id AND e.token_id=d.token_id AND e.token_hash=d.token_hash);
 WITH chosen AS (SELECT id FROM public.admin_notification_deliveries WHERE campaign_id=p_id AND state='pending' ORDER BY id LIMIT p_limit FOR UPDATE SKIP LOCKED),
 claimed AS (UPDATE public.admin_notification_deliveries d SET state='claimed',claim_id=p_claim,claimed_at=now() FROM chosen c WHERE d.id=c.id RETURNING d.*)
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',c.id,'token',t.token,'tokenId',t.id,'userId',c.user_id,'platform',c.platform,
   'sound',coalesce(u.sound_enabled,true)) ORDER BY c.id),'[]') INTO rows FROM claimed c JOIN public.device_tokens t ON t.id=c.token_id
   AND t.user_id=c.user_id AND encode(sha256(convert_to(t.token,'UTF8')),'hex')=c.token_hash AND t.platform=c.platform
 LEFT JOIN public.user_preferences u ON u.user_id=c.user_id;
 UPDATE public.bulk_push_notifications SET status=CASE WHEN jsonb_array_length(rows)>0 THEN 'sending' ELSE status END WHERE id=p_id;
 RETURN jsonb_build_object('items',rows,'title',campaign.title,'body',campaign.body,'deeplink',link,'status',public.admin_notification_status_v1(p_id));
END $function$;

NOTIFY pgrst, 'reload schema';
