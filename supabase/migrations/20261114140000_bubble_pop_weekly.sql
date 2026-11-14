-- Qabarcıq partlat (owner 2026-11-14, "qur"): a 90-second bubble game with a weekly leaderboard.
-- 1) submit_game_score_v1 accepts game 'qabarciq' (score 0..300000, level always 1) and, for every game, also keeps the
--    player's best score of the current week (Monday 00:00 Asia/Baku) in game_weekly_scores.
-- 2) game_weekly_scores: one row per user + game + week, CDC + writer guard. RLS on, no client grants; read only through
--    game_weekly_leaderboard_v1(game, limit): top rows of this week plus the caller's own rank and score.
-- Older builds keep working: the RPC signature and receipt are unchanged.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

DO $$
BEGIN
  IF to_regclass('_anacan_gcp_migration.guarded_relations') IS NULL THEN RAISE EXCEPTION 'BUBBLE_GUARD_CATALOG_MISSING'; END IF;
  IF to_regclass('public.game_scores') IS NULL OR to_regclass('public.game_score_receipts') IS NULL THEN
    RAISE EXCEPTION 'BUBBLE_GAME_SCORES_MISSING';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.game_weekly_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  game_id text NOT NULL,
  week_start date NOT NULL,
  best_score integer NOT NULL DEFAULT 0 CHECK (best_score >= 0),
  plays integer NOT NULL DEFAULT 1 CHECK (plays >= 1),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, game_id, week_start)
);
CREATE INDEX IF NOT EXISTS game_weekly_scores_board_idx ON public.game_weekly_scores (game_id, week_start, best_score DESC);
ALTER TABLE public.game_weekly_scores ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.game_weekly_scores FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.game_weekly_scores TO service_role;

CREATE OR REPLACE FUNCTION public.game_week_start_v1()
RETURNS date LANGUAGE sql STABLE SET search_path = pg_catalog, public AS $$
  SELECT date_trunc('week', (now() AT TIME ZONE 'Asia/Baku'))::date
$$;

CREATE OR REPLACE FUNCTION public.submit_game_score_v1(p_expected_user_id uuid, p_game_id text, p_submission_id uuid, p_score integer, p_level integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog', 'public' AS $function$
DECLARE actor uuid := auth.uid(); inserted integer; receipt public.game_score_receipts%ROWTYPE; result public.game_scores%ROWTYPE;
BEGIN
  IF actor IS NULL OR actor IS DISTINCT FROM p_expected_user_id THEN
    RAISE EXCEPTION USING ERRCODE='PT403',MESSAGE='game_score_account_changed';
  END IF;
  IF p_game_id IS NULL OR p_game_id NOT IN ('saglam-sebet','birlesdir','color-sort','qabarciq')
    OR p_submission_id IS NULL OR p_score IS NULL OR p_score NOT BETWEEN 0 AND 10000000
    OR p_level IS NULL OR p_level NOT BETWEEN 1 AND 10000
    OR (p_game_id = 'qabarciq' AND (p_score > 300000 OR p_level <> 1)) THEN
    RAISE EXCEPTION USING ERRCODE='PT400',MESSAGE='game_score_invalid_result';
  END IF;
  -- Actor-local cleanup avoids a global hot row. Receipts cover retries for 14 days.
  DELETE FROM public.game_score_receipts WHERE user_id=actor AND created_at<now()-interval '14 days';
  INSERT INTO public.game_score_receipts(user_id,game_id,submission_id,score,level)
    VALUES(actor,p_game_id,p_submission_id,p_score,p_level) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS inserted=ROW_COUNT;
  SELECT * INTO STRICT receipt FROM public.game_score_receipts
    WHERE user_id=actor AND game_id=p_game_id AND submission_id=p_submission_id;
  IF receipt.score<>p_score OR receipt.level<>p_level THEN
    RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='game_score_submission_conflict';
  END IF;
  IF inserted=1 THEN
    INSERT INTO public.game_scores(user_id,game_id,best_score,best_level,total_plays)
      VALUES(actor,p_game_id,p_score,p_level,1)
      ON CONFLICT(user_id,game_id) DO UPDATE SET
        best_score=greatest(game_scores.best_score,excluded.best_score),
        best_level=greatest(game_scores.best_level,excluded.best_level),
        total_plays=game_scores.total_plays+1;
    INSERT INTO public.game_weekly_scores(user_id,game_id,week_start,best_score,plays)
      VALUES(actor,p_game_id,public.game_week_start_v1(),p_score,1)
      ON CONFLICT(user_id,game_id,week_start) DO UPDATE SET
        best_score=greatest(game_weekly_scores.best_score,excluded.best_score),
        plays=game_weekly_scores.plays+1, updated_at=now();
  END IF;
  SELECT * INTO STRICT result FROM public.game_scores WHERE user_id=actor AND game_id=p_game_id;
  RETURN jsonb_build_object('userId',actor,'gameId',p_game_id,'submissionId',p_submission_id,
    'bestScore',result.best_score,'bestLevel',result.best_level,'totalPlays',result.total_plays,'duplicate',inserted=0);
END $function$;

-- Top rows of the current week + the caller's own rank. Ties: earlier update ranks higher.
CREATE OR REPLACE FUNCTION public.game_weekly_leaderboard_v1(p_game_id text, p_limit integer DEFAULT 20)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE actor uuid := auth.uid(); wk date := public.game_week_start_v1(); lim int := least(greatest(coalesce(p_limit, 20), 1), 50);
  me public.game_weekly_scores; my_rank int; top jsonb;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF p_game_id IS NULL OR p_game_id NOT IN ('saglam-sebet','birlesdir','color-sort','qabarciq') THEN
    RAISE EXCEPTION 'GAME_UNKNOWN' USING ERRCODE = '22023';
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('rank', r.rn, 'userId', r.user_id, 'score', r.best_score) ORDER BY r.rn), '[]'::jsonb)
    INTO top
    FROM (SELECT user_id, best_score, row_number() OVER (ORDER BY best_score DESC, updated_at) AS rn
            FROM public.game_weekly_scores WHERE game_id = p_game_id AND week_start = wk
           ORDER BY best_score DESC, updated_at LIMIT lim) r;
  SELECT * INTO me FROM public.game_weekly_scores WHERE user_id = actor AND game_id = p_game_id AND week_start = wk;
  IF me.id IS NOT NULL THEN
    SELECT 1 + count(*) INTO my_rank FROM public.game_weekly_scores
     WHERE game_id = p_game_id AND week_start = wk
       AND (best_score > me.best_score OR (best_score = me.best_score AND updated_at < me.updated_at));
  END IF;
  RETURN jsonb_build_object('weekStart', wk, 'weekEnds', (wk + 7)::timestamp AT TIME ZONE 'Asia/Baku',
    'players', (SELECT count(*) FROM public.game_weekly_scores WHERE game_id = p_game_id AND week_start = wk),
    'top', top, 'me', CASE WHEN me.id IS NULL THEN NULL ELSE jsonb_build_object('rank', my_rank, 'score', me.best_score, 'plays', me.plays) END);
END $$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['game_weekly_leaderboard_v1(text, integer)', 'submit_game_score_v1(uuid, text, uuid, integer, integer)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', f);
  END LOOP;
  REVOKE ALL ON FUNCTION public.game_week_start_v1() FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION public.game_week_start_v1() TO authenticated, service_role;
END $$;

-- ── CDC and writer-guard enrollment ─────────────────────────────────────────────────────
INSERT INTO _anacan_gcp_migration.guarded_relations (schema_name, table_name, primary_key)
VALUES ('public', 'game_weekly_scores', ARRAY['id'])
ON CONFLICT DO NOTHING;

DO $$
BEGIN
  DROP TRIGGER IF EXISTS anacan_gcp_writer_guard ON public.game_weekly_scores;
  DROP TRIGGER IF EXISTS anacan_gcp_change ON public.game_weekly_scores;
  DROP TRIGGER IF EXISTS anacan_gcp_truncate ON public.game_weekly_scores;
  CREATE TRIGGER anacan_gcp_writer_guard BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON public.game_weekly_scores
    FOR EACH STATEMENT EXECUTE FUNCTION _anacan_gcp_migration.guard_write();
  CREATE TRIGGER anacan_gcp_change AFTER INSERT OR DELETE OR UPDATE ON public.game_weekly_scores
    FOR EACH ROW EXECUTE FUNCTION _anacan_gcp_migration.capture_change();
  CREATE TRIGGER anacan_gcp_truncate AFTER TRUNCATE ON public.game_weekly_scores
    FOR EACH STATEMENT EXECUTE FUNCTION _anacan_gcp_migration.capture_change();
  IF (SELECT count(*) FROM _anacan_gcp_migration.guarded_relations
       WHERE schema_name = 'public' AND table_name = 'game_weekly_scores') <> 1
     OR (SELECT count(*) FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relname = 'game_weekly_scores'
            AND tg.tgname IN ('anacan_gcp_writer_guard', 'anacan_gcp_change', 'anacan_gcp_truncate')) <> 3 THEN
    RAISE EXCEPTION 'BUBBLE_GUARD_ENROLLMENT_INCOMPLETE';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
