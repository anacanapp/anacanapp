-- Duzelis84.sql — partner_day_stage_stats_v1(p_date): the woman's day by HER stage, for the partner's
-- daily summary screen (native 48). Function only; masked by her partner_sharing_settings. Google.
--   mommy → feeds, feed_ml, sleep_min, diapers (share_baby_logs)
--   flow  → cycle_day, cycle_length, phase (share_cycle)
--   bump  → stage only (kicks/contractions already come from partner_daily_summaries_v1)
CREATE OR REPLACE FUNCTION public.partner_day_stage_stats_v1(p_date date)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'pg_catalog' AS $$
DECLARE owner uuid := public.get_linked_partner_user_id(auth.uid()); prof record; result jsonb; clen int; plen int; cday int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = '42501'; END IF;
  IF owner IS NULL OR p_date IS NULL THEN RETURN NULL; END IF;
  SELECT p.life_stage, p.last_period_date, p.cycle_length, p.period_length INTO prof FROM public.profiles p WHERE p.user_id = owner;
  result := jsonb_build_object('stage', prof.life_stage);
  IF prof.life_stage = 'mommy' AND public.partner_can_see_v1(owner, 'baby_logs') THEN
    SELECT result || jsonb_build_object(
      'feeds', count(*) FILTER (WHERE b.log_type = 'feeding'),
      'feed_ml', coalesce(sum(b.amount_ml) FILTER (WHERE b.log_type = 'feeding'), 0),
      'sleep_min', coalesce(sum(greatest(0, extract(epoch FROM (b.end_time - b.start_time)) / 60))
                     FILTER (WHERE b.log_type = 'sleep' AND b.end_time IS NOT NULL), 0)::int,
      'diapers', count(*) FILTER (WHERE b.log_type = 'diaper'))
      INTO result
      FROM public.baby_logs b
     WHERE b.user_id = owner AND (b.start_time AT TIME ZONE 'Asia/Baku')::date = p_date;
  ELSIF prof.life_stage = 'flow' AND public.partner_can_see_v1(owner, 'cycle') AND prof.last_period_date IS NOT NULL THEN
    clen := greatest(coalesce(prof.cycle_length, 28), 15); plen := greatest(coalesce(prof.period_length, 5), 1);
    cday := ((p_date - prof.last_period_date) % clen + clen) % clen + 1;
    result := result || jsonb_build_object('cycle_day', cday, 'cycle_length', clen,
      'phase', CASE WHEN cday <= plen THEN 'menstrual' WHEN cday BETWEEN clen - 18 AND clen - 11 THEN 'fertile'
                    WHEN cday < clen - 18 THEN 'follicular' ELSE 'luteal' END);
  END IF;
  RETURN result;
END $$;
ALTER FUNCTION public.partner_day_stage_stats_v1(date) OWNER TO pgadmin;
REVOKE ALL ON FUNCTION public.partner_day_stage_stats_v1(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.partner_day_stage_stats_v1(date) TO authenticated;
NOTIFY pgrst, 'reload schema';
