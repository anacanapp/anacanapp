-- Daily quiz: per-question answers with instant feedback (2026-11-13). Functions only, no relation changes.
--   * daily_quiz_answer_v1(p_index, p_choice): stores the answer to question p_index (0-based) of today's round once,
--     then returns its correct index and explanation. An answer cannot be changed after it is revealed.
--     p_choice -1 = time ran out.
--   * daily_quiz_finish_v1(): finishes today's round from the stored answers (unanswered = -1) and returns the result.
--   * daily_quiz_start_v1 now also returns the answers stored so far, so a round can be resumed.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

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
    INSERT INTO public.quiz_attempts (user_id, quiz_date, language, question_ids, answers)
    VALUES (uid, today, lang, ids, array_fill(NULL::smallint, ARRAY[cardinality(ids)])) RETURNING * INTO a;
  END IF;
  RETURN jsonb_build_object('date', today, 'seconds_per_question', cfg->'seconds_per_question',
    'answers', to_jsonb(coalesce(a.answers, array_fill(NULL::smallint, ARRAY[cardinality(a.question_ids)]))),
    'questions', (SELECT jsonb_agg(jsonb_build_object('id', q.id, 'category', q.category, 'question', q.question, 'options', q.options)
                                   ORDER BY array_position(a.question_ids, q.id))
                    FROM public.quiz_questions q WHERE q.id = ANY (a.question_ids)));
END $$;

CREATE OR REPLACE FUNCTION public.daily_quiz_answer_v1(p_index integer, p_choice integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE uid uuid := auth.uid(); a public.quiz_attempts; q public.quiz_questions; ans smallint[]; chosen smallint;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF p_choice IS NULL OR p_choice NOT BETWEEN -1 AND 3 THEN RAISE EXCEPTION 'QUIZ_ANSWERS_INVALID' USING ERRCODE = '22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('daily_quiz:' || uid::text, 0));
  SELECT * INTO a FROM public.quiz_attempts WHERE user_id = uid AND quiz_date = public.daily_quiz_today_v1() FOR UPDATE;
  IF a.id IS NULL THEN RAISE EXCEPTION 'QUIZ_NOT_STARTED' USING ERRCODE = '22023'; END IF;
  IF a.finished_at IS NOT NULL THEN RAISE EXCEPTION 'QUIZ_ALREADY_DONE' USING ERRCODE = '22023'; END IF;
  IF p_index IS NULL OR p_index < 0 OR p_index >= cardinality(a.question_ids) THEN RAISE EXCEPTION 'QUIZ_ANSWERS_INVALID' USING ERRCODE = '22023'; END IF;
  ans := coalesce(a.answers, array_fill(NULL::smallint, ARRAY[cardinality(a.question_ids)]));
  chosen := ans[p_index + 1];
  IF chosen IS NULL THEN
    chosen := p_choice; ans[p_index + 1] := chosen;
    UPDATE public.quiz_attempts SET answers = ans WHERE id = a.id;
  END IF;
  SELECT * INTO q FROM public.quiz_questions WHERE id = a.question_ids[p_index + 1];
  RETURN jsonb_build_object('index', p_index, 'chosen', chosen, 'correct_index', q.correct_index, 'correct', chosen = q.correct_index,
                            'explanation', q.explanation, 'article_url', q.article_url);
END $$;

CREATE OR REPLACE FUNCTION public.daily_quiz_finish_v1()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE uid uuid := auth.uid(); a public.quiz_attempts;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501'; END IF;
  SELECT * INTO a FROM public.quiz_attempts WHERE user_id = uid AND quiz_date = public.daily_quiz_today_v1();
  IF a.id IS NULL THEN RAISE EXCEPTION 'QUIZ_NOT_STARTED' USING ERRCODE = '22023'; END IF;
  RETURN public.daily_quiz_submit_v1(ARRAY(SELECT coalesce(a.answers[i], -1)::int FROM generate_subscripts(a.question_ids, 1) i ORDER BY i));
END $$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['daily_quiz_start_v1(text)', 'daily_quiz_answer_v1(integer, integer)', 'daily_quiz_finish_v1()'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', f);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pgadmin') THEN EXECUTE format('ALTER FUNCTION public.%s OWNER TO pgadmin', f); END IF;
  END LOOP;
  -- Answers are revealed one by one now, so a client must not submit a whole new answer list: only
  -- daily_quiz_finish_v1 (SECURITY DEFINER, stored answers) may call submit.
  REVOKE EXECUTE ON FUNCTION public.daily_quiz_submit_v1(integer[]) FROM authenticated;
  GRANT EXECUTE ON FUNCTION public.daily_quiz_submit_v1(integer[]) TO service_role;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
