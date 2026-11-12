-- Anacan Recap: admins follow the same date as everyone (owner request 2026-11-12).
-- app_settings.recap_2026 gains optional admin_start_at / admin_end_at; when set, admins use them instead of
-- start_at / end_at (e.g. to test before launch). Both are edited in Admin -> Tənzimləmələr -> Anacan Recap.
-- Only the availability check of anacan_recap_v1 changes (live definition taken as the base); app_settings is
-- already CDC/writer guarded. Applied with run-sql.py.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE OR REPLACE FUNCTION public.anacan_recap_v1(p_year integer DEFAULT 2026)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_admin boolean;
  cfg jsonb;
  v_start timestamptz;
  v_end timestamptz;
  y0 timestamptz;
  y1 timestamptz;
  d0 date;
  d1 date;
  p public.profiles;
  v_days int; v_streak int; v_hour int; v_tools jsonb; v_stages jsonb; v_first timestamptz;
  v_ai int; v_reads int; v_likes int; v_comments int; v_posts int; v_games int; v_ach int;
  flow jsonb := NULL; bump jsonb := NULL; mommy jsonb := NULL;
  c public.user_children;
  v_feed int; v_sleep_n int; v_sleep_h numeric; v_diaper int; v_night int; v_ms jsonb; v_ms_n int;
  v_w0 numeric; v_w1 numeric; v_photos int; v_growth int; v_feed_rank int; v_longest_sleep numeric;
  v_kick_s int; v_kicks int; v_kick_max int; v_kick_rank int; v_bag int; v_names int; v_week0 int; v_week1 int;
  v_cycles int; v_cyc_avg numeric; v_per_avg numeric; v_pdays int; v_flog int; v_sym text; v_mood numeric; v_water int; v_flow_rank int;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('available', false, 'reason', 'auth'); END IF;
  IF p_year IS NULL OR p_year < 2025 OR p_year > 2030 THEN p_year := 2026; END IF;
  v_admin := public.has_role(v_uid, 'admin');
  SELECT CASE WHEN jsonb_typeof(value) = 'string' THEN (value #>> '{}')::jsonb ELSE value END INTO cfg
    FROM public.app_settings WHERE key = 'recap_' || p_year;
  -- 2026-11-12: admins follow the same window as everyone, unless admin_start_at / admin_end_at are set
  -- (Admin -> Tənzimləmələr -> Anacan Recap): then admins use their own dates.
  v_start := CASE WHEN v_admin AND nullif(cfg->>'admin_start_at', '') IS NOT NULL THEN (cfg->>'admin_start_at')::timestamptz
                  ELSE (cfg->>'start_at')::timestamptz END;
  v_end := CASE WHEN v_admin AND nullif(cfg->>'admin_end_at', '') IS NOT NULL THEN (cfg->>'admin_end_at')::timestamptz
                ELSE (cfg->>'end_at')::timestamptz END;
  IF NOT (coalesce((cfg->>'enabled')::boolean, false)
       AND now() >= coalesce(v_start, 'infinity')
       AND now() <= coalesce(v_end, 'infinity')) THEN
    RETURN jsonb_build_object('available', false, 'reason', 'not_yet', 'opens_at', v_start);
  END IF;

  d0 := make_date(p_year, 1, 1); d1 := make_date(p_year + 1, 1, 1);
  y0 := d0::timestamp AT TIME ZONE 'Asia/Baku'; y1 := d1::timestamp AT TIME ZONE 'Asia/Baku';
  SELECT * INTO p FROM public.profiles WHERE user_id = v_uid;

  -- ── App life ──────────────────────────────────────────────────────────────────────
  WITH days AS (SELECT DISTINCT (created_at AT TIME ZONE 'Asia/Baku')::date d FROM public.analytics_events
                 WHERE user_id = v_uid AND created_at >= y0 AND created_at < y1),
       g AS (SELECT d, d - (row_number() OVER (ORDER BY d))::int grp FROM days)
  SELECT (SELECT count(*) FROM days), coalesce((SELECT max(n) FROM (SELECT count(*) n FROM g GROUP BY grp) s), 0)
    INTO v_days, v_streak;
  SELECT extract(hour FROM created_at AT TIME ZONE 'Asia/Baku')::int INTO v_hour FROM public.analytics_events
   WHERE user_id = v_uid AND created_at >= y0 AND created_at < y1 GROUP BY 1 ORDER BY count(*) DESC LIMIT 1;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', t, 'count', n) ORDER BY n DESC), '[]'::jsonb) INTO v_tools FROM (
    SELECT event_data->>'tool_id' t, count(*) n FROM public.analytics_events
     WHERE user_id = v_uid AND event_name = 'tool_opened' AND created_at >= y0 AND created_at < y1 AND event_data ? 'tool_id'
     GROUP BY 1 ORDER BY 2 DESC LIMIT 3) x;
  SELECT coalesce(jsonb_agg(s ORDER BY f), '[]'::jsonb) INTO v_stages FROM (
    SELECT life_stage s, min(created_at) f FROM public.analytics_events
     WHERE user_id = v_uid AND created_at >= y0 AND created_at < y1 AND life_stage IN ('flow', 'bump', 'mommy') GROUP BY 1) x;
  SELECT min(created_at) INTO v_first FROM public.analytics_events WHERE user_id = v_uid AND created_at >= y0 AND created_at < y1;
  SELECT count(*) INTO v_ai FROM public.ai_chat_messages WHERE user_id = v_uid AND role = 'user' AND created_at >= y0 AND created_at < y1;
  SELECT count(*) INTO v_reads FROM public.community_post_reads WHERE user_id = v_uid AND seen_at >= y0 AND seen_at < y1;
  SELECT count(*) INTO v_likes FROM public.post_likes WHERE user_id = v_uid AND created_at >= y0 AND created_at < y1;
  SELECT count(*) INTO v_comments FROM public.post_comments WHERE user_id = v_uid AND created_at >= y0 AND created_at < y1;
  SELECT count(*) INTO v_posts FROM public.community_posts WHERE user_id = v_uid AND created_at >= y0 AND created_at < y1;
  SELECT coalesce(sum(total_plays), 0) INTO v_games FROM public.game_scores WHERE user_id = v_uid AND updated_at >= y0;
  SELECT count(*) INTO v_ach FROM public.user_achievements WHERE user_id = v_uid AND achieved_at >= y0 AND achieved_at < y1;

  -- ── Mommy: the active (or first) child ───────────────────────────────────────────
  SELECT * INTO c FROM public.user_children WHERE user_id = v_uid ORDER BY is_active DESC NULLS LAST, sort_order, created_at LIMIT 1;
  SELECT count(*) FILTER (WHERE log_type = 'feeding'),
         count(*) FILTER (WHERE log_type = 'sleep'),
         coalesce(sum(extract(epoch FROM (end_time - start_time)) / 3600) FILTER (WHERE log_type = 'sleep' AND end_time > start_time
                                                                              AND end_time - start_time < interval '14 hours'), 0),
         count(*) FILTER (WHERE log_type = 'diaper'),
         count(*) FILTER (WHERE log_type = 'feeding' AND extract(hour FROM start_time AT TIME ZONE 'Asia/Baku') < 5),
         coalesce(max(extract(epoch FROM (end_time - start_time)) / 3600) FILTER (WHERE log_type = 'sleep' AND end_time > start_time
                                                                              AND end_time - start_time < interval '14 hours'), 0)
    INTO v_feed, v_sleep_n, v_sleep_h, v_diaper, v_night, v_longest_sleep
    FROM public.baby_logs WHERE user_id = v_uid AND start_time >= y0 AND start_time < y1;
  SELECT count(*), coalesce(jsonb_agg(milestone_id ORDER BY achieved_at) FILTER (WHERE milestone_id IS NOT NULL), '[]'::jsonb)
    INTO v_ms_n, v_ms FROM public.baby_milestones WHERE user_id = v_uid AND achieved_at >= y0 AND achieved_at < y1;
  SELECT (array_agg(weight_kg ORDER BY entry_date))[1], (array_agg(weight_kg ORDER BY entry_date DESC))[1], count(*)
    INTO v_w0, v_w1, v_growth FROM public.baby_growth WHERE user_id = v_uid AND entry_date >= d0 AND entry_date < d1 AND weight_kg > 0;
  SELECT count(*) INTO v_photos FROM public.baby_photos WHERE user_id = v_uid AND created_at >= y0 AND created_at < y1;
  IF v_feed > 0 THEN
    SELECT round(100.0 * count(*) FILTER (WHERE n > v_feed) / greatest(count(*), 1))::int INTO v_feed_rank
      FROM (SELECT count(*) n FROM public.baby_logs WHERE log_type = 'feeding' AND start_time >= y0 AND start_time < y1 GROUP BY user_id) s;
  END IF;
  IF c.id IS NOT NULL OR v_feed + v_sleep_n + v_diaper + v_ms_n > 0 THEN
    mommy := jsonb_build_object(
      'child_name', nullif(btrim(coalesce(c.name, p.baby_name, '')), ''), 'child_birth_date', coalesce(c.birth_date, p.baby_birth_date),
      'born_this_year', coalesce(c.birth_date, p.baby_birth_date) >= d0 AND coalesce(c.birth_date, p.baby_birth_date) < d1,
      'feedings', v_feed, 'night_feedings', v_night, 'sleeps', v_sleep_n, 'sleep_hours', round(v_sleep_h),
      'longest_sleep_hours', round(v_longest_sleep, 1), 'diapers', v_diaper,
      'milestones', v_ms_n, 'milestone_ids', v_ms, 'growth_entries', v_growth,
      'weight_start_kg', v_w0, 'weight_end_kg', v_w1, 'photos', v_photos, 'feedings_top_pct', v_feed_rank);
  END IF;

  -- ── Bump ───────────────────────────────────────────────────────────────────────────
  SELECT count(*), coalesce(sum(kick_count), 0), coalesce(max(kick_count), 0) INTO v_kick_s, v_kicks, v_kick_max
    FROM public.kick_sessions WHERE user_id = v_uid AND session_date >= d0 AND session_date < d1;
  IF v_kick_s > 0 THEN
    SELECT round(100.0 * count(*) FILTER (WHERE n > v_kicks) / greatest(count(*), 1))::int INTO v_kick_rank
      FROM (SELECT sum(kick_count) n FROM public.kick_sessions WHERE session_date >= d0 AND session_date < d1 GROUP BY user_id) s;
  END IF;
  SELECT count(*) FILTER (WHERE is_checked) INTO v_bag FROM public.hospital_bag_items WHERE user_id = v_uid;
  SELECT count(*) INTO v_names FROM public.favorite_names WHERE user_id = v_uid AND created_at >= y0 AND created_at < y1;
  IF p.due_date IS NOT NULL THEN
    -- Pregnancy weeks lived inside this year (week = 40 - weeks until due date).
    v_week0 := greatest(0, least(42, 40 - ceil((p.due_date - greatest(d0, (p.due_date - 280)))::numeric / 7)::int));
    v_week1 := greatest(0, least(42, 40 - ceil((p.due_date - least(d1 - 1, current_date, p.due_date))::numeric / 7)::int));
  END IF;
  IF p.life_stage = 'bump' OR v_kick_s > 0 OR (v_stages ? 'bump') THEN
    bump := jsonb_build_object('due_date', p.due_date, 'week_start', v_week0, 'week_end', v_week1,
      'kick_sessions', v_kick_s, 'kicks', v_kicks, 'max_kicks_session', v_kick_max, 'kicks_top_pct', v_kick_rank,
      'bag_items_ready', v_bag, 'favorite_names', v_names);
  END IF;

  -- ── Flow ───────────────────────────────────────────────────────────────────────────
  SELECT count(*), round(avg(cycle_length) FILTER (WHERE cycle_length BETWEEN 15 AND 60), 1),
         round(avg(period_length) FILTER (WHERE period_length BETWEEN 1 AND 15), 1)
    INTO v_cycles, v_cyc_avg, v_per_avg FROM public.cycle_history WHERE user_id = v_uid AND start_date >= d0 AND start_date < d1;
  SELECT count(*) INTO v_pdays FROM public.period_day_logs WHERE user_id = v_uid AND log_date >= d0 AND log_date < d1;
  SELECT count(*), round(avg(mood), 1), coalesce(sum(water_glasses), 0) INTO v_flog, v_mood, v_water
    FROM public.flow_daily_logs WHERE user_id = v_uid AND log_date >= d0 AND log_date < d1;
  SELECT s INTO v_sym FROM (SELECT unnest(symptoms) s FROM public.flow_daily_logs WHERE user_id = v_uid AND log_date >= d0 AND log_date < d1) x
   GROUP BY 1 ORDER BY count(*) DESC LIMIT 1;
  IF v_flog > 0 THEN
    SELECT round(100.0 * count(*) FILTER (WHERE n > v_flog) / greatest(count(*), 1))::int INTO v_flow_rank
      FROM (SELECT count(*) n FROM public.flow_daily_logs WHERE log_date >= d0 AND log_date < d1 GROUP BY user_id) s;
  END IF;
  IF p.life_stage = 'flow' OR v_cycles + v_pdays + v_flog > 0 OR (v_stages ? 'flow') THEN
    flow := jsonb_build_object('cycles', v_cycles, 'avg_cycle_length', v_cyc_avg, 'avg_period_length', v_per_avg,
      'period_days_logged', v_pdays, 'days_logged', v_flog, 'top_symptom', v_sym, 'mood_avg', v_mood,
      'water_glasses', v_water, 'logging_top_pct', v_flow_rank, 'goal', p.flow_goal);
  END IF;

  RETURN jsonb_build_object(
    'available', true, 'preview', v_admin AND NOT (coalesce((cfg->>'enabled')::boolean, false) AND now() >= coalesce((cfg->>'start_at')::timestamptz, 'infinity')),
    'year', p_year, 'name', nullif(btrim(split_part(coalesce(p.name, ''), ' ', 1)), ''), 'stage', p.life_stage,
    'stages', v_stages, 'member_since', p.created_at, 'first_open_this_year', v_first,
    'days_active', v_days, 'longest_streak', v_streak, 'favorite_hour', v_hour, 'top_tools', v_tools,
    'ai_questions', v_ai, 'posts_read', v_reads, 'likes', v_likes, 'comments', v_comments, 'posts', v_posts,
    'game_plays', v_games, 'achievements', v_ach, 'is_premium', p.is_premium,
    'flow', flow, 'bump', bump, 'mommy', mommy, 'generated_at', now());
END $function$;

ALTER FUNCTION public.anacan_recap_v1(int) OWNER TO supabase_admin;
NOTIFY pgrst, 'reload schema';
COMMIT;
