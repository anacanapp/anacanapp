-- Duzelis65.sql — Tsikl uzunluğu anomaliyaları proqnozu dəyişmir
--
-- record_period_days profilin cycle_length dəyərini son tamamlanmış tsikllərin
-- çəkili ortalamasından öyrənirdi (15–60 gün). 42 və 53 günlük gecikmələr belə
-- "norma" sayılır, 28 günlük tsikli olan istifadəçidə proqnoz 49 günə qalxırdı.
-- İndi yalnız 21–35 günlük (klinik normal) tsikllər öyrədir; ən azı iki belə
-- tsikl yoxdursa istifadəçinin öz dəyəri saxlanılır. cycle_history yazılışı,
-- RLS, writer guard/CDC trigerləri və funksiya imzası dəyişmir.
--
-- İCRA (Google): VM-də anacan-postgres konteynerində bir transaksiyada.

BEGIN;
CREATE OR REPLACE FUNCTION public.record_period_days(p_expected_user_id uuid, p_dates date[], p_flow text DEFAULT 'unspecified'::text, p_complete boolean DEFAULT false, p_preserve_existing boolean DEFAULT false, p_daily_log jsonb DEFAULT NULL::jsonb, p_timezone text DEFAULT 'UTC'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_today date;
  v_dates date[];
  v_profile public.profiles%ROWTYPE;
  v_cycle public.cycle_history%ROWTYPE;
  v_start date;
  v_observed_start date;
  v_count integer;
  v_episode date[];
  v_anchor date;
  v_diff integer;
  v_cycle_length integer;
  v_completed_count integer;
  v_new_cycle boolean := false;
  v_assignments text;
  v_daily jsonb;
  v_health jsonb := '[]'::jsonb;
BEGIN
  IF v_uid IS NULL OR v_uid IS DISTINCT FROM p_expected_user_id THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED_OR_ACCOUNT_CHANGED' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name=p_timezone) THEN
    RAISE EXCEPTION 'INVALID_TIMEZONE' USING ERRCODE = '22023';
  END IF;
  v_today := (pg_catalog.now() AT TIME ZONE p_timezone)::date;
  SELECT array_agg(DISTINCT d ORDER BY d) INTO v_dates FROM unnest(p_dates) d;
  IF cardinality(v_dates) IS NULL OR cardinality(v_dates) NOT BETWEEN 1 AND 90
    OR array_position(v_dates,NULL) IS NOT NULL
    OR EXISTS (SELECT 1 FROM unnest(v_dates) d WHERE d>v_today)
    OR (p_flow IS NOT NULL AND p_flow NOT IN ('unspecified','light','medium','heavy','none','spotting','clear'))
    OR (p_flow IS NULL AND p_daily_log IS NULL) THEN
    RAISE EXCEPTION 'INVALID_PERIOD_RECORD' USING ERRCODE = '22023';
  END IF;
  -- Serialize this user's day/history writes; all access remains protected by RLS.
  SELECT * INTO v_profile FROM public.profiles WHERE user_id=v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROFILE_NOT_READY'; END IF;

  IF p_daily_log IS NOT NULL THEN
    IF cardinality(v_dates)<>1 OR jsonb_typeof(p_daily_log)<>'object'
      OR EXISTS (SELECT 1 FROM jsonb_object_keys(p_daily_log) k WHERE k NOT IN
        ('mood','energy_level','symptoms','pain_level','sleep_hours','sleep_quality',
         'temperature','water_glasses','notes','cervical_mucus','sexual_activity','libido','ovulation_test')) THEN
      RAISE EXCEPTION 'INVALID_DAILY_LOG_FIELDS' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.flow_daily_logs(user_id,log_date) VALUES(v_uid,v_dates[1])
      ON CONFLICT(user_id,log_date) DO NOTHING;
    SELECT string_agg(format('%1$I=src.%1$I',k),',') INTO v_assignments FROM jsonb_object_keys(p_daily_log) k;
    IF v_assignments IS NOT NULL THEN
      EXECUTE format('UPDATE public.flow_daily_logs t SET %s,updated_at=now()
        FROM jsonb_populate_record(NULL::public.flow_daily_logs,$1) src WHERE t.user_id=$2 AND t.log_date=$3',v_assignments)
        USING p_daily_log,v_uid,v_dates[1];
    END IF;
  END IF;

  IF p_flow='clear' THEN
    DELETE FROM public.period_day_logs WHERE user_id=v_uid AND log_date=ANY(v_dates);
    UPDATE public.flow_daily_logs SET flow_intensity=NULL,updated_at=now()
      WHERE user_id=v_uid AND log_date=ANY(v_dates);
  ELSIF p_flow IS NOT NULL THEN
    IF p_preserve_existing THEN
      INSERT INTO public.period_day_logs(user_id,log_date,flow_intensity)
        SELECT v_uid,d,p_flow FROM unnest(v_dates) d ON CONFLICT(user_id,log_date) DO NOTHING;
    ELSE
      INSERT INTO public.period_day_logs(user_id,log_date,flow_intensity)
        SELECT v_uid,d,p_flow FROM unnest(v_dates) d
        ON CONFLICT(user_id,log_date) DO UPDATE SET flow_intensity=excluded.flow_intensity;
    END IF;
    INSERT INTO public.flow_daily_logs(user_id,log_date,flow_intensity)
      SELECT v_uid,log_date,CASE WHEN flow_intensity IN ('none','spotting','light','medium','heavy') THEN flow_intensity ELSE NULL END
      FROM public.period_day_logs WHERE user_id=v_uid AND log_date=ANY(v_dates)
      ON CONFLICT(user_id,log_date) DO UPDATE SET flow_intensity=excluded.flow_intensity,updated_at=now();
  END IF;

  IF p_flow IS NOT NULL THEN
    -- Keep the existing 12-day editing tolerance; a missed diary day is not a new cycle.
    WITH ordered AS (
      SELECT log_date,lag(log_date) OVER(ORDER BY log_date) AS previous
      FROM public.period_day_logs WHERE user_id=v_uid AND log_date<=v_today
        AND (flow_intensity IS NULL OR flow_intensity NOT IN ('none','spotting'))
    ), grouped AS (
      SELECT log_date,sum(CASE WHEN previous IS NULL OR log_date-previous>12 THEN 1 ELSE 0 END)
        OVER(ORDER BY log_date) AS episode FROM ordered
    )
    SELECT min(log_date),count(*)::integer,array_agg(log_date ORDER BY log_date)
      INTO v_start,v_count,v_episode FROM grouped GROUP BY episode ORDER BY episode DESC LIMIT 1;
    v_observed_start := v_start;
    SELECT * INTO v_cycle FROM public.cycle_history WHERE user_id=v_uid ORDER BY cycle_number DESC LIMIT 1;
    v_anchor := coalesce(v_cycle.start_date,v_profile.last_period_date);

    IF v_profile.life_stage='flow' AND v_start IS NOT NULL
      AND (v_anchor IS NULL OR v_start>=v_anchor-12)
      AND (v_anchor IS NULL OR v_dates[cardinality(v_dates)]>=v_anchor-12) THEN
      -- An explicit start already exists: adding day 2/3 must not move it forward.
      IF v_anchor IS NOT NULL AND v_start BETWEEN v_anchor AND v_anchor+12
        AND NOT (v_anchor=ANY(v_dates) AND p_flow IN ('clear','none','spotting')) THEN
        v_start := v_anchor;
      END IF;
      v_diff := v_start-v_cycle.start_date;
      IF v_cycle.id IS NULL THEN
        INSERT INTO public.cycle_history(user_id,cycle_number,start_date,period_length)
          VALUES(v_uid,1,v_start,v_count);
      ELSIF abs(v_diff)<=12 THEN
        UPDATE public.cycle_history SET start_date=v_start,period_length=v_count WHERE id=v_cycle.id AND user_id=v_uid;
        IF v_diff<>0 THEN
          UPDATE public.cycle_history SET end_date=v_start,
            cycle_length=CASE WHEN v_start-start_date BETWEEN 15 AND 60 THEN v_start-start_date ELSE NULL END
            WHERE user_id=v_uid AND cycle_number=v_cycle.cycle_number-1;
        END IF;
      ELSIF v_diff>12 THEN
        UPDATE public.cycle_history SET end_date=v_start,
          cycle_length=CASE WHEN v_diff BETWEEN 15 AND 60 THEN v_diff ELSE NULL END WHERE id=v_cycle.id AND user_id=v_uid;
        INSERT INTO public.cycle_history(user_id,cycle_number,start_date,period_length)
          VALUES(v_uid,v_cycle.cycle_number+1,v_start,v_count);
        v_new_cycle := true;
      END IF;
      UPDATE public.profiles SET last_period_date=v_start,
        -- A first observed day does NOT change a typical five-day period into one day.
        period_length=CASE WHEN p_complete AND v_count BETWEEN 1 AND 15 THEN v_count
          WHEN v_count BETWEEN 2 AND 15 THEN greatest(coalesce(period_length,5),v_count) ELSE period_length END
        WHERE user_id=v_uid;
      -- Duzelis65: only clinically normal cycles (21-35 days) teach the typical length;
      -- a 53-day delay is an anomaly, not the user's new norm.
      WITH recent AS (
        SELECT cycle_number,cycle_length FROM public.cycle_history WHERE user_id=v_uid AND cycle_length BETWEEN 21 AND 35
          ORDER BY cycle_number DESC LIMIT 6
      ), weighted AS (
        SELECT cycle_length,count(*) OVER() - row_number() OVER(ORDER BY cycle_number DESC) + 1 AS weight FROM recent
      ) SELECT round(sum(cycle_length*weight)::numeric/nullif(sum(weight),0))::integer,count(*)::integer
        INTO v_cycle_length,v_completed_count FROM weighted;
      IF v_completed_count>=2 THEN
        UPDATE public.profiles SET cycle_length=v_cycle_length WHERE user_id=v_uid;
      END IF;
    END IF;

    SELECT coalesce(jsonb_agg(jsonb_build_object('date',d,
      'flow',coalesce(l.flow_intensity,CASE WHEN l.id IS NULL THEN 'clear' ELSE 'unspecified' END),
      'cycleStart',l.id IS NOT NULL AND (l.flow_intensity IS NULL OR l.flow_intensity NOT IN ('none','spotting'))
        AND NOT EXISTS (SELECT 1 FROM public.period_day_logs prev WHERE prev.user_id=v_uid
          AND prev.log_date<d AND prev.log_date>=d-12
          AND (prev.flow_intensity IS NULL OR prev.flow_intensity NOT IN ('none','spotting')))) ORDER BY d),'[]'::jsonb) INTO v_health
      FROM (SELECT unnest(v_dates) d UNION SELECT unnest(v_episode) d) dates
      LEFT JOIN public.period_day_logs l ON l.user_id=v_uid AND l.log_date=dates.d;
  END IF;
  SELECT * INTO v_profile FROM public.profiles WHERE user_id=v_uid;
  IF p_daily_log IS NOT NULL THEN
    SELECT to_jsonb(l) INTO v_daily FROM public.flow_daily_logs l WHERE l.user_id=v_uid AND l.log_date=v_dates[1];
  END IF;
  RETURN jsonb_build_object('ok',true,'userId',v_uid,'dates',v_dates,'flow',p_flow,'dailyLog',v_daily,
    'profile',jsonb_build_object('last_period_date',v_profile.last_period_date,'period_length',v_profile.period_length,'cycle_length',v_profile.cycle_length),
    'healthDays',v_health);
END $function$;

NOTIFY pgrst, 'reload schema';
COMMIT;
