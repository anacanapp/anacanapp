-- Gündəlik Bilik Yarışı / Daily quiz (owner request 2026-11-13).
--   * quiz_questions: one row per question per language; rows sharing group_id are translations of one question.
--     Admins edit them directly (RLS, Admin → Bilik Yarışı); apps never read the table, only the RPCs below, so the
--     correct answer is not sent before the player answers.
--   * quiz_attempts: one per user per Baku day. The set (questions_per_day) is picked on start: questions the player
--     has not had in the last 60 days first, then a per-user shuffle. Scoring is server-side: 20 points per correct
--     answer, +20 for a perfect round. Streak = consecutive Baku days with a finished round.
--   * Weekly league (Monday-Sunday, Baku) from the week's points: bronze < 150, silver < 350, gold >= 350.
--     Leaderboard per language, first name only (profiles.name), blocked users left out.
--   * Settings: app_settings.daily_quiz {enabled, languages[], questions_per_day, seconds_per_question}.
--     A language is playable only when it is listed AND has at least questions_per_day active questions.
-- New relations are enrolled in CDC and writer guarding.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

DO $$
BEGIN
  IF to_regclass('_anacan_gcp_migration.guarded_relations') IS NULL THEN RAISE EXCEPTION 'DAILY_QUIZ_GUARD_CATALOG_MISSING'; END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL DEFAULT gen_random_uuid(),
  language text NOT NULL DEFAULT 'az' CHECK (language ~ '^[a-z]{2}$'),
  category text NOT NULL CHECK (category IN ('pregnancy', 'baby_food', 'sleep', 'development', 'health', 'safety', 'postpartum')),
  question text NOT NULL CHECK (length(btrim(question)) BETWEEN 5 AND 300),
  options jsonb NOT NULL CHECK (jsonb_typeof(options) = 'array' AND jsonb_array_length(options) = 4),
  correct_index smallint NOT NULL CHECK (correct_index BETWEEN 0 AND 3),
  explanation text NOT NULL DEFAULT '' CHECK (length(explanation) <= 600),
  source text CHECK (source IS NULL OR length(source) <= 120),
  article_url text CHECK (article_url IS NULL OR article_url ~ '^(https://(www\.)?anacan\.az/|anacan://|/)[A-Za-z0-9/_?=&.%#-]{0,200}$'),
  is_active boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  UNIQUE (group_id, language)
);
CREATE INDEX IF NOT EXISTS quiz_questions_lang_idx ON public.quiz_questions (language, is_active);
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quiz_questions FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_questions TO authenticated;
GRANT ALL ON public.quiz_questions TO service_role;
DROP POLICY IF EXISTS quiz_questions_admin ON public.quiz_questions;
CREATE POLICY quiz_questions_admin ON public.quiz_questions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.quiz_questions_touch_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.options) e
              WHERE jsonb_typeof(e) <> 'string' OR length(btrim(e #>> '{}')) NOT BETWEEN 1 AND 120) THEN
    RAISE EXCEPTION 'QUIZ_OPTIONS_INVALID' USING ERRCODE = '22023';
  END IF;
  NEW.question := btrim(NEW.question); NEW.explanation := btrim(NEW.explanation);
  NEW.updated_at := now();
  NEW.updated_by := coalesce(auth.uid(), NEW.updated_by);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS quiz_questions_touch ON public.quiz_questions;
CREATE TRIGGER quiz_questions_touch BEFORE INSERT OR UPDATE ON public.quiz_questions
  FOR EACH ROW EXECUTE FUNCTION public.quiz_questions_touch_v1();

CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  quiz_date date NOT NULL,
  language text NOT NULL CHECK (language ~ '^[a-z]{2}$'),
  question_ids uuid[] NOT NULL CHECK (cardinality(question_ids) BETWEEN 1 AND 20),
  answers smallint[],
  correct smallint,
  score integer,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  UNIQUE (user_id, quiz_date)
);
CREATE INDEX IF NOT EXISTS quiz_attempts_week_idx ON public.quiz_attempts (language, quiz_date) WHERE finished_at IS NOT NULL;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quiz_attempts FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.quiz_attempts TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pgadmin') THEN
    ALTER TABLE public.quiz_questions OWNER TO pgadmin;
    ALTER TABLE public.quiz_attempts OWNER TO pgadmin;
    ALTER FUNCTION public.quiz_questions_touch_v1() OWNER TO pgadmin;
  END IF;
END $$;

INSERT INTO public.app_settings (key, value, description)
SELECT 'daily_quiz', '{"enabled": true, "languages": ["az"], "questions_per_day": 5, "seconds_per_question": 20}'::jsonb,
       'Gündəlik Bilik Yarışı: enabled, playable languages, questions per day, seconds per question'
 WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'daily_quiz');

-- ── Helpers ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.daily_quiz_config_v1()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v jsonb; n int; s int;
BEGIN
  SELECT value INTO v FROM public.app_settings WHERE key = 'daily_quiz';
  IF jsonb_typeof(v) = 'string' THEN v := (v #>> '{}')::jsonb; END IF;
  IF jsonb_typeof(v) IS DISTINCT FROM 'object' THEN v := '{}'::jsonb; END IF;
  n := least(greatest(coalesce((v->>'questions_per_day')::int, 5), 3), 10);
  s := least(greatest(coalesce((v->>'seconds_per_question')::int, 20), 10), 60);
  RETURN jsonb_build_object('enabled', coalesce((v->>'enabled')::boolean, false),
    'languages', CASE WHEN jsonb_typeof(v->'languages') = 'array' THEN v->'languages' ELSE '[]'::jsonb END,
    'questions_per_day', n, 'seconds_per_question', s);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('enabled', false, 'languages', '[]'::jsonb, 'questions_per_day', 5, 'seconds_per_question', 20);
END $$;

CREATE OR REPLACE FUNCTION public.daily_quiz_today_v1() RETURNS date
LANGUAGE sql STABLE SET search_path = pg_catalog, public AS $$ SELECT (now() AT TIME ZONE 'Asia/Baku')::date $$;

CREATE OR REPLACE FUNCTION public.daily_quiz_league_v1(p_points int) RETURNS text
LANGUAGE sql IMMUTABLE AS $$ SELECT CASE WHEN p_points >= 350 THEN 'gold' WHEN p_points >= 150 THEN 'silver' ELSE 'bronze' END $$;

-- Player summary: streak, totals, this week's points and league, weekly leaderboard (top 10 + the player).
CREATE OR REPLACE FUNCTION public.daily_quiz_summary_v1(p_user uuid, p_language text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  today date := public.daily_quiz_today_v1();
  wk date := date_trunc('week', public.daily_quiz_today_v1())::date;
  d date; streak int := 0; total int; week_pts int; top jsonb; me jsonb;
BEGIN
  d := CASE WHEN EXISTS (SELECT 1 FROM public.quiz_attempts WHERE user_id = p_user AND quiz_date = today AND finished_at IS NOT NULL)
            THEN today ELSE today - 1 END;
  WHILE EXISTS (SELECT 1 FROM public.quiz_attempts WHERE user_id = p_user AND quiz_date = d AND finished_at IS NOT NULL) LOOP
    streak := streak + 1; d := d - 1;
    EXIT WHEN streak >= 3650;
  END LOOP;
  SELECT coalesce(sum(score), 0) INTO total FROM public.quiz_attempts WHERE user_id = p_user AND finished_at IS NOT NULL;
  SELECT coalesce(sum(score), 0) INTO week_pts FROM public.quiz_attempts
   WHERE user_id = p_user AND finished_at IS NOT NULL AND quiz_date >= wk;

  WITH board AS (
    SELECT a.user_id, sum(a.score)::int AS points, max(a.finished_at) AS last_at
      FROM public.quiz_attempts a
     WHERE a.language = p_language AND a.quiz_date >= wk AND a.finished_at IS NOT NULL
       AND NOT public.is_user_blocked(a.user_id, 'full')
     GROUP BY a.user_id
  ), ranked AS (
    SELECT b.*, rank() OVER (ORDER BY b.points DESC, b.last_at ASC) AS rnk FROM board b
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object('rank', r.rnk, 'points', r.points, 'me', r.user_id = p_user,
           'name', nullif(left(split_part(btrim(coalesce(p.name, '')), ' ', 1), 20), ''), 'avatar', p.avatar_url) ORDER BY r.rnk), '[]'::jsonb),
         (SELECT jsonb_build_object('rank', x.rnk, 'points', x.points) FROM ranked x WHERE x.user_id = p_user)
    INTO top, me
    FROM (SELECT * FROM ranked ORDER BY rnk LIMIT 10) r LEFT JOIN public.profiles p ON p.user_id = r.user_id;

  RETURN jsonb_build_object('streak', streak, 'total_points', total, 'week_points', week_pts,
    'league', public.daily_quiz_league_v1(week_pts), 'week_start', wk,
    'leaderboard', jsonb_build_object('top', top, 'me', me));
END $$;

-- State for the quiz home screen.
CREATE OR REPLACE FUNCTION public.daily_quiz_state_v1(p_language text DEFAULT 'az')
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  uid uuid := auth.uid(); cfg jsonb := public.daily_quiz_config_v1();
  lang text := lower(left(coalesce(p_language, 'az'), 2)); a public.quiz_attempts; playable boolean;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501'; END IF;
  playable := (cfg->>'enabled')::boolean AND cfg->'languages' ? lang
    AND (SELECT count(*) FROM public.quiz_questions WHERE language = lang AND is_active) >= (cfg->>'questions_per_day')::int;
  SELECT * INTO a FROM public.quiz_attempts WHERE user_id = uid AND quiz_date = public.daily_quiz_today_v1();
  RETURN jsonb_build_object('enabled', playable OR public.has_role(uid, 'admin'::public.app_role) AND
           (SELECT count(*) FROM public.quiz_questions WHERE language = lang AND is_active) >= (cfg->>'questions_per_day')::int,
    'language', lang, 'date', public.daily_quiz_today_v1(),
    'questions_per_day', cfg->'questions_per_day', 'seconds_per_question', cfg->'seconds_per_question',
    'today', CASE WHEN a.id IS NULL THEN jsonb_build_object('status', 'none')
                  WHEN a.finished_at IS NULL THEN jsonb_build_object('status', 'started')
                  ELSE jsonb_build_object('status', 'done', 'correct', a.correct, 'total', cardinality(a.question_ids), 'score', a.score) END)
    || public.daily_quiz_summary_v1(uid, lang);
END $$;

-- Starts (or resumes) today's round and returns its questions without the answers.
CREATE OR REPLACE FUNCTION public.daily_quiz_start_v1(p_language text DEFAULT 'az')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  uid uuid := auth.uid(); cfg jsonb := public.daily_quiz_config_v1(); today date := public.daily_quiz_today_v1();
  lang text := lower(left(coalesce(p_language, 'az'), 2)); n int; a public.quiz_attempts; ids uuid[];
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF NOT ((public.daily_quiz_state_v1(lang)->>'enabled')::boolean) THEN RAISE EXCEPTION 'QUIZ_UNAVAILABLE' USING ERRCODE = '22023'; END IF;
  n := (cfg->>'questions_per_day')::int;
  PERFORM pg_advisory_xact_lock(hashtextextended('daily_quiz:' || uid::text, 0));
  SELECT * INTO a FROM public.quiz_attempts WHERE user_id = uid AND quiz_date = today;
  IF a.id IS NOT NULL AND a.finished_at IS NOT NULL THEN RAISE EXCEPTION 'QUIZ_ALREADY_DONE' USING ERRCODE = '22023'; END IF;
  IF a.id IS NULL THEN
    SELECT array_agg(q.id ORDER BY q.recent, q.shuffle) INTO ids FROM (
      SELECT x.id,
             EXISTS (SELECT 1 FROM public.quiz_attempts h WHERE h.user_id = uid AND h.quiz_date > today - 60 AND x.id = ANY (h.question_ids)) AS recent,
             md5(x.group_id::text || uid::text || today::text) AS shuffle
        FROM public.quiz_questions x WHERE x.language = lang AND x.is_active
       ORDER BY 2, 3 LIMIT n) q;
    INSERT INTO public.quiz_attempts (user_id, quiz_date, language, question_ids) VALUES (uid, today, lang, ids) RETURNING * INTO a;
  END IF;
  RETURN jsonb_build_object('date', today, 'seconds_per_question', cfg->'seconds_per_question',
    'questions', (SELECT jsonb_agg(jsonb_build_object('id', q.id, 'category', q.category, 'question', q.question, 'options', q.options)
                                   ORDER BY array_position(a.question_ids, q.id))
                    FROM public.quiz_questions q WHERE q.id = ANY (a.question_ids)));
END $$;

-- Finishes today's round: p_answers holds the chosen option per question in order (-1 = no answer / time out).
CREATE OR REPLACE FUNCTION public.daily_quiz_submit_v1(p_answers integer[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  uid uuid := auth.uid(); a public.quiz_attempts; n int; c int := 0; s int; results jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('daily_quiz:' || uid::text, 0));
  SELECT * INTO a FROM public.quiz_attempts WHERE user_id = uid AND quiz_date = public.daily_quiz_today_v1() FOR UPDATE;
  IF a.id IS NULL THEN RAISE EXCEPTION 'QUIZ_NOT_STARTED' USING ERRCODE = '22023'; END IF;
  IF a.finished_at IS NOT NULL THEN RAISE EXCEPTION 'QUIZ_ALREADY_DONE' USING ERRCODE = '22023'; END IF;
  n := cardinality(a.question_ids);
  IF p_answers IS NULL OR cardinality(p_answers) <> n OR EXISTS (SELECT 1 FROM unnest(p_answers) v WHERE v IS NULL OR v NOT BETWEEN -1 AND 3) THEN
    RAISE EXCEPTION 'QUIZ_ANSWERS_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT count(*) FILTER (WHERE q.correct_index = p_answers[i]),
         jsonb_agg(jsonb_build_object('id', q.id, 'chosen', p_answers[i], 'correct_index', q.correct_index,
                                      'explanation', q.explanation, 'article_url', q.article_url) ORDER BY i)
    INTO c, results
    FROM generate_subscripts(a.question_ids, 1) i JOIN public.quiz_questions q ON q.id = a.question_ids[i];
  s := c * 20 + CASE WHEN c = n THEN 20 ELSE 0 END;
  UPDATE public.quiz_attempts SET answers = p_answers::smallint[], correct = c, score = s, finished_at = now() WHERE id = a.id;
  RETURN jsonb_build_object('correct', c, 'total', n, 'score', s, 'perfect', c = n, 'results', results)
         || public.daily_quiz_summary_v1(uid, a.language);
END $$;

-- ── Admin statistics ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_daily_quiz_stats_v1(p_language text DEFAULT 'az', p_days integer DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE lang text := lower(left(coalesce(p_language, 'az'), 2)); since date := public.daily_quiz_today_v1() - least(greatest(coalesce(p_days, 30), 1), 365);
  wk date := date_trunc('week', public.daily_quiz_today_v1())::date;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN RAISE EXCEPTION 'ADMIN_ONLY' USING ERRCODE = '42501'; END IF;
  RETURN jsonb_build_object(
    'config', public.daily_quiz_config_v1(),
    'languages', (SELECT coalesce(jsonb_object_agg(l.language, jsonb_build_object('total', l.total, 'active', l.active)), '{}'::jsonb)
                    FROM (SELECT language, count(*) total, count(*) FILTER (WHERE is_active) active FROM public.quiz_questions GROUP BY 1) l),
    'days', (SELECT coalesce(jsonb_agg(jsonb_build_object('date', d.quiz_date, 'players', d.players, 'finished', d.finished, 'avg_correct', d.avg_correct) ORDER BY d.quiz_date DESC), '[]'::jsonb)
               FROM (SELECT quiz_date, count(*) players, count(finished_at) finished, round(avg(correct)::numeric, 2) avg_correct
                       FROM public.quiz_attempts WHERE language = lang AND quiz_date >= since GROUP BY 1) d),
    'totals', (SELECT jsonb_build_object('players', count(DISTINCT user_id), 'rounds', count(finished_at), 'perfect', count(*) FILTER (WHERE correct = cardinality(question_ids)))
                 FROM public.quiz_attempts WHERE language = lang AND quiz_date >= since),
    'questions', (SELECT coalesce(jsonb_object_agg(t.qid, jsonb_build_object('answered', t.answered, 'correct', t.correct)), '{}'::jsonb)
                    FROM (SELECT a.question_ids[i] qid, count(*) answered, count(*) FILTER (WHERE q.correct_index = a.answers[i]) correct
                            FROM public.quiz_attempts a CROSS JOIN LATERAL generate_subscripts(a.question_ids, 1) i
                            JOIN public.quiz_questions q ON q.id = a.question_ids[i]
                           WHERE a.finished_at IS NOT NULL AND a.language = lang AND a.quiz_date >= since GROUP BY 1) t),
    'leaderboard', (SELECT coalesce(jsonb_agg(jsonb_build_object('rank', r.rnk, 'points', r.points, 'rounds', r.rounds,
                       'name', coalesce(nullif(btrim(p.name), ''), '—'), 'user_id', r.user_id) ORDER BY r.rnk), '[]'::jsonb)
                      FROM (SELECT user_id, sum(score)::int points, count(*) rounds, rank() OVER (ORDER BY sum(score) DESC) rnk
                              FROM public.quiz_attempts WHERE language = lang AND quiz_date >= wk AND finished_at IS NOT NULL
                             GROUP BY user_id ORDER BY 2 DESC LIMIT 50) r LEFT JOIN public.profiles p ON p.user_id = r.user_id),
    'week_start', wk);
END $$;

-- Settings (admin): languages, questions per day, seconds, on/off.
CREATE OR REPLACE FUNCTION public.admin_daily_quiz_settings_v1(p_settings jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN RAISE EXCEPTION 'ADMIN_ONLY' USING ERRCODE = '42501'; END IF;
  IF jsonb_typeof(p_settings) <> 'object' OR jsonb_typeof(p_settings->'languages') <> 'array'
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_settings->'languages') e WHERE jsonb_typeof(e) <> 'string' OR (e #>> '{}') !~ '^[a-z]{2}$') THEN
    RAISE EXCEPTION 'QUIZ_SETTINGS_INVALID' USING ERRCODE = '22023';
  END IF;
  v := jsonb_build_object('enabled', coalesce((p_settings->>'enabled')::boolean, true), 'languages', p_settings->'languages',
         'questions_per_day', least(greatest(coalesce((p_settings->>'questions_per_day')::int, 5), 3), 10),
         'seconds_per_question', least(greatest(coalesce((p_settings->>'seconds_per_question')::int, 20), 10), 60));
  UPDATE public.app_settings SET value = v, updated_at = now() WHERE key = 'daily_quiz';
  IF NOT FOUND THEN INSERT INTO public.app_settings (key, value) VALUES ('daily_quiz', v); END IF;
  RETURN public.daily_quiz_config_v1();
END $$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['daily_quiz_config_v1()', 'daily_quiz_today_v1()', 'daily_quiz_league_v1(integer)', 'daily_quiz_summary_v1(uuid, text)',
                           'daily_quiz_state_v1(text)', 'daily_quiz_start_v1(text)', 'daily_quiz_submit_v1(integer[])',
                           'admin_daily_quiz_stats_v1(text, integer)', 'admin_daily_quiz_settings_v1(jsonb)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pgadmin') THEN EXECUTE format('ALTER FUNCTION public.%s OWNER TO pgadmin', f); END IF;
  END LOOP;
  REVOKE EXECUTE ON FUNCTION public.daily_quiz_summary_v1(uuid, text) FROM authenticated;
  GRANT EXECUTE ON FUNCTION public.daily_quiz_summary_v1(uuid, text) TO service_role;
  GRANT EXECUTE ON FUNCTION public.daily_quiz_state_v1(text), public.daily_quiz_start_v1(text), public.daily_quiz_submit_v1(integer[]),
                            public.admin_daily_quiz_stats_v1(text, integer), public.admin_daily_quiz_settings_v1(jsonb),
                            public.daily_quiz_config_v1(), public.daily_quiz_today_v1(), public.daily_quiz_league_v1(integer)
    TO authenticated, service_role;
END $$;

-- ── CDC and writer-guard enrollment ─────────────────────────────────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['quiz_questions', 'quiz_attempts'] LOOP
    INSERT INTO _anacan_gcp_migration.guarded_relations (schema_name, table_name, primary_key)
    VALUES ('public', t, ARRAY['id']) ON CONFLICT DO NOTHING;
    EXECUTE format('DROP TRIGGER IF EXISTS anacan_gcp_writer_guard ON public.%I', t);
    EXECUTE format('DROP TRIGGER IF EXISTS anacan_gcp_change ON public.%I', t);
    EXECUTE format('DROP TRIGGER IF EXISTS anacan_gcp_truncate ON public.%I', t);
    EXECUTE format('CREATE TRIGGER anacan_gcp_writer_guard BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION _anacan_gcp_migration.guard_write()', t);
    EXECUTE format('CREATE TRIGGER anacan_gcp_change AFTER INSERT OR DELETE OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION _anacan_gcp_migration.capture_change()', t);
    EXECUTE format('CREATE TRIGGER anacan_gcp_truncate AFTER TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION _anacan_gcp_migration.capture_change()', t);
    IF (SELECT count(*) FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relname = t
           AND tg.tgname IN ('anacan_gcp_writer_guard', 'anacan_gcp_change', 'anacan_gcp_truncate')) <> 3 THEN
      RAISE EXCEPTION 'DAILY_QUIZ_GUARD_INCOMPLETE %', t;
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
