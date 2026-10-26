
-- 1) Extend notification_send_log
ALTER TABLE public.notification_send_log
  ADD COLUMN IF NOT EXISTS notification_type text,
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS error_code text;

CREATE INDEX IF NOT EXISTS idx_notif_send_log_type_status_sentat
  ON public.notification_send_log (notification_type, status, sent_at DESC);

-- Admins can view all rows for reporting
DROP POLICY IF EXISTS "Admins can view all notification logs" ON public.notification_send_log;
CREATE POLICY "Admins can view all notification logs"
ON public.notification_send_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 2) Per-run summary table for cron executions
CREATE TABLE IF NOT EXISTS public.notification_run_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  status text NOT NULL DEFAULT 'running',  -- running | success | error
  triggered_by text,                       -- cron | admin | manual
  sent_count int NOT NULL DEFAULT 0,
  failed_count int NOT NULL DEFAULT 0,
  skipped_count int NOT NULL DEFAULT 0,
  eligible_count int,
  baku_time text,
  active_slot text,
  reasons jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  payload jsonb
);

CREATE INDEX IF NOT EXISTS idx_notif_run_log_function_started
  ON public.notification_run_log (function_name, started_at DESC);

ALTER TABLE public.notification_run_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all run logs" ON public.notification_run_log;
CREATE POLICY "Admins can view all run logs"
ON public.notification_run_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 3) Admin status function (cron jobs + recent runs + today's send stats + timezone validation)
CREATE OR REPLACE FUNCTION public.get_notification_admin_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'cron'
AS $$
DECLARE
  result jsonb;
  is_admin boolean;
BEGIN
  is_admin := public.has_role(auth.uid(), 'admin');
  IF NOT is_admin THEN
    RAISE EXCEPTION 'Forbidden: admin role required';
  END IF;

  WITH
  jobs AS (
    SELECT
      j.jobid,
      j.jobname,
      j.schedule,
      j.active,
      j.command,
      (
        SELECT to_jsonb(r) FROM (
          SELECT d.status, d.return_message, d.start_time, d.end_time
          FROM cron.job_run_details d
          WHERE d.jobid = j.jobid
          ORDER BY d.start_time DESC
          LIMIT 1
        ) r
      ) AS last_run
    FROM cron.job j
    WHERE j.jobname LIKE 'send-%'
       OR j.jobname LIKE '%notification%'
       OR j.jobname LIKE '%reminder%'
  ),
  today_runs AS (
    SELECT function_name,
           count(*)                          AS runs,
           count(*) FILTER (WHERE status='success')  AS success_runs,
           count(*) FILTER (WHERE status='error')    AS error_runs,
           sum(sent_count)::int              AS sent_total,
           sum(failed_count)::int            AS failed_total,
           sum(skipped_count)::int           AS skipped_total,
           max(ended_at)                     AS last_ended_at
    FROM public.notification_run_log
    WHERE started_at >= (date_trunc('day', now() AT TIME ZONE 'Asia/Baku') AT TIME ZONE 'Asia/Baku')
    GROUP BY function_name
  ),
  today_sends AS (
    SELECT notification_type,
           status,
           coalesce(reason, '—') AS reason,
           count(*) AS cnt
    FROM public.notification_send_log
    WHERE sent_at >= (date_trunc('day', now() AT TIME ZONE 'Asia/Baku') AT TIME ZONE 'Asia/Baku')
    GROUP BY 1,2,3
  )
  SELECT jsonb_build_object(
    'server_utc',  to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SSOF'),
    'server_baku', to_char(now() AT TIME ZONE 'Asia/Baku', 'YYYY-MM-DD"T"HH24:MI:SS'),
    'cron_jobs',   (SELECT coalesce(jsonb_agg(to_jsonb(jobs)), '[]'::jsonb) FROM jobs),
    'today_runs',  (SELECT coalesce(jsonb_agg(to_jsonb(today_runs)), '[]'::jsonb) FROM today_runs),
    'today_sends', (SELECT coalesce(jsonb_agg(to_jsonb(today_sends)), '[]'::jsonb) FROM today_sends)
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_notification_admin_status() TO authenticated;
