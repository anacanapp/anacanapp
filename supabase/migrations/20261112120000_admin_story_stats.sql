-- Story statistics for admins (owner request 2026-11-12). Reads the existing analytics events the app already sends
-- for dashboard stories (event 'tool_used', tool_id 'stories', action story_open / story_complete / story_cta /
-- story_download / story_quiz_ok / story_quiz_no, item_id = story id). Only users who allowed analytics in the app
-- send these events, so the numbers cover consenting users.
-- Read-only admin functions, no relation created or changed (no CDC change). Applied with run-sql.py.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE OR REPLACE FUNCTION public.admin_story_stats_v1(p_days int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  since timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)));
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501';
  END IF;
  RETURN (
    WITH ev AS (
      SELECT user_id, event_data->>'action' AS action, event_data->>'item_id' AS story, created_at
        FROM public.analytics_events
       WHERE event_name = 'tool_used' AND event_data->>'tool_id' = 'stories' AND created_at >= since
    )
    SELECT jsonb_build_object(
      'since', since,
      'totals', (SELECT jsonb_build_object(
          'opens', count(*) FILTER (WHERE action = 'story_open'),
          'viewers', count(DISTINCT user_id) FILTER (WHERE action = 'story_open'),
          'completes', count(*) FILTER (WHERE action = 'story_complete'),
          'cta', count(*) FILTER (WHERE action = 'story_cta'),
          'downloads', count(*) FILTER (WHERE action = 'story_download')) FROM ev),
      'stories', coalesce((SELECT jsonb_agg(row_to_json(s) ORDER BY s.opens DESC) FROM (
          SELECT story AS id,
                 count(*) FILTER (WHERE action = 'story_open') AS opens,
                 count(DISTINCT user_id) FILTER (WHERE action = 'story_open') AS viewers,
                 count(*) FILTER (WHERE action = 'story_complete') AS completes,
                 count(DISTINCT user_id) FILTER (WHERE action = 'story_complete') AS completers,
                 count(*) FILTER (WHERE action = 'story_cta') AS cta,
                 count(*) FILTER (WHERE action = 'story_download') AS downloads,
                 count(*) FILTER (WHERE action = 'story_quiz_ok') AS quiz_ok,
                 count(*) FILTER (WHERE action = 'story_quiz_no') AS quiz_no,
                 max(created_at) AS last_at
            FROM ev WHERE story IS NOT NULL GROUP BY story) s), '[]'::jsonb),
      'days', coalesce((SELECT jsonb_agg(row_to_json(d) ORDER BY d.day) FROM (
          SELECT (created_at AT TIME ZONE 'Asia/Baku')::date AS day,
                 count(*) FILTER (WHERE action = 'story_open') AS opens,
                 count(DISTINCT user_id) FILTER (WHERE action = 'story_open') AS viewers
            FROM ev GROUP BY 1) d), '[]'::jsonb)
    ));
END $$;

-- Who watched: per person (optionally one story), most recent first, at most 300 rows.
CREATE OR REPLACE FUNCTION public.admin_story_viewers_v1(p_story text DEFAULT NULL, p_days int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  since timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)));
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501';
  END IF;
  RETURN coalesce((SELECT jsonb_agg(row_to_json(v) ORDER BY v.last_at DESC) FROM (
    SELECT e.user_id, p.name, p.email,
           count(*) FILTER (WHERE e.event_data->>'action' = 'story_open') AS opens,
           count(DISTINCT e.event_data->>'item_id') FILTER (WHERE e.event_data->>'action' = 'story_open') AS stories,
           count(*) FILTER (WHERE e.event_data->>'action' = 'story_complete') AS completes,
           count(*) FILTER (WHERE e.event_data->>'action' = 'story_cta') AS cta,
           max(e.created_at) AS last_at
      FROM public.analytics_events e
      LEFT JOIN public.profiles p ON p.user_id = e.user_id
     WHERE e.event_name = 'tool_used' AND e.event_data->>'tool_id' = 'stories' AND e.created_at >= since
       AND (p_story IS NULL OR e.event_data->>'item_id' = p_story)
     GROUP BY e.user_id, p.name, p.email
     ORDER BY max(e.created_at) DESC
     LIMIT 300) v), '[]'::jsonb);
END $$;

ALTER FUNCTION public.admin_story_stats_v1(int) OWNER TO pgadmin;
ALTER FUNCTION public.admin_story_viewers_v1(text, int) OWNER TO pgadmin;
REVOKE ALL ON FUNCTION public.admin_story_stats_v1(int) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_story_viewers_v1(text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_story_stats_v1(int) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_story_viewers_v1(text, int) TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
