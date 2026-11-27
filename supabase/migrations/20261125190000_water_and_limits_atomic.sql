-- Atomic water taps and free daily limits (audit Phase 2, M1 / M4).
--
-- M1 water: the app added a glass as "todayLog.water_intake + 1" from React state and upserted the total. Two quick taps
--    saved +1 instead of +2, and with the app open across midnight the first tap saved yesterday's total + 1 as today.
--    increment_water_intake_v1(p_log_date, p_delta, p_op_id) adds the delta on the server in one upsert on the existing
--    UNIQUE (user_id, log_date) of public.daily_logs. p_log_date is the phone's local calendar day at tap time.
--    p_op_id is the client operation UUID (the offline outbox entry id): an op id seen before is not applied again, so a
--    retry after a lost answer or an offline replay never double counts. The op ids live in the new, RPC-only relation
--    public.water_intake_ops (no client grants, kept 40 days per user, pruned on the user's next tap).
--    Result {water_intake, applied, log_date}; water_intake is clamped to 0..20000 (glasses today, ml in old rows).
--
-- M4 limits: the app keyed the day with toISOString() (UTC: Baku reset at 04:00) and did read-then-update, so parallel
--    calls passed the limit or lost counts. usage_consume_v1(p_feature, p_time_zone) computes the user's local day from
--    the IANA zone (validated against pg_timezone_names, fallback Asia/Baku), reads the limit from
--    app_settings.free_limits (same keys and defaults as the app / _shared/usage-limit.ts) and increments
--    public.usage_tracking only while usage_count < limit, in one INSERT … ON CONFLICT … WHERE statement.
--    usage_add_seconds_v1(p_seconds, p_time_zone) does the same for white noise seconds (no limit check: the player
--    stops itself). Premium bypass stays in the app (unchanged semantics): free users only call these.
--
-- Relations: public.water_intake_ops is NEW (RLS on, no client grants, CDC + writer guard enrolled below).
-- public.daily_logs and public.usage_tracking get new writer functions only, no schema change; both must already be
-- guarded (the migration refuses otherwise). See the .cdc.json next to this file.
-- Apply with /home/anacan-runner/run-sql.py on anacan-gcp-candidate. Not applied by the author of this migration.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
DECLARE t text;
BEGIN
  IF to_regclass('_anacan_gcp_migration.guarded_relations') IS NULL THEN RAISE EXCEPTION 'WATER_LIMITS_GUARD_CATALOG_MISSING'; END IF;
  FOREACH t IN ARRAY ARRAY['daily_logs', 'usage_tracking'] LOOP
    IF NOT EXISTS (SELECT 1 FROM _anacan_gcp_migration.guarded_relations WHERE schema_name = 'public' AND table_name = t)
       OR NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
                      WHERE n.nspname = 'public' AND c.relname = t AND tg.tgname = 'anacan_gcp_writer_guard') THEN
      RAISE EXCEPTION 'WATER_LIMITS_GUARD_ENROLLMENT_INCOMPLETE: %', t;
    END IF;
  END LOOP;
  -- ON CONFLICT targets: a unique index on exactly these columns (constraint or plain unique index).
  IF NOT EXISTS (SELECT 1 FROM pg_index i WHERE i.indrelid = 'public.daily_logs'::regclass AND i.indisunique AND i.indpred IS NULL
                   AND ARRAY(SELECT a.attname::text FROM unnest(i.indkey::int2[]) WITH ORDINALITY k(attnum, ord)
                             JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum ORDER BY k.ord)
                       = ARRAY['user_id', 'log_date']) THEN
    RAISE EXCEPTION 'WATER_LIMITS_DAILY_LOGS_UNIQUE_MISSING';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_index i WHERE i.indrelid = 'public.usage_tracking'::regclass AND i.indisunique AND i.indpred IS NULL
                   AND ARRAY(SELECT a.attname::text FROM unnest(i.indkey::int2[]) WITH ORDINALITY k(attnum, ord)
                             JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum ORDER BY k.ord)
                       = ARRAY['user_id', 'feature_type', 'usage_date']) THEN
    RAISE EXCEPTION 'WATER_LIMITS_USAGE_UNIQUE_MISSING';
  END IF;
END $$;

-- ───────────── new relation: processed water operations (idempotency) ─────────────
CREATE TABLE IF NOT EXISTS public.water_intake_ops (
  op_id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date date NOT NULL,
  delta integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS water_intake_ops_user_idx ON public.water_intake_ops (user_id, created_at);

ALTER TABLE public.water_intake_ops ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.water_intake_ops FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.water_intake_ops TO service_role;
INSERT INTO _anacan_gcp_migration.guarded_relations (schema_name, table_name, primary_key)
VALUES ('public', 'water_intake_ops', ARRAY['op_id']) ON CONFLICT DO NOTHING;
DROP TRIGGER IF EXISTS anacan_gcp_writer_guard ON public.water_intake_ops;
DROP TRIGGER IF EXISTS anacan_gcp_change ON public.water_intake_ops;
DROP TRIGGER IF EXISTS anacan_gcp_truncate ON public.water_intake_ops;
CREATE TRIGGER anacan_gcp_writer_guard BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON public.water_intake_ops
  FOR EACH STATEMENT EXECUTE FUNCTION _anacan_gcp_migration.guard_write();
CREATE TRIGGER anacan_gcp_change AFTER INSERT OR DELETE OR UPDATE ON public.water_intake_ops
  FOR EACH ROW EXECUTE FUNCTION _anacan_gcp_migration.capture_change();
CREATE TRIGGER anacan_gcp_truncate AFTER TRUNCATE ON public.water_intake_ops
  FOR EACH STATEMENT EXECUTE FUNCTION _anacan_gcp_migration.capture_change();

-- ───────────── helpers ─────────────
-- Local calendar day in the caller's IANA zone; unknown / empty / hostile input falls back to Asia/Baku.
CREATE OR REPLACE FUNCTION public._anacan_local_day(p_time_zone text)
RETURNS date LANGUAGE plpgsql STABLE SET search_path = pg_catalog, public AS $$
DECLARE tz text := btrim(coalesce(p_time_zone, ''));
BEGIN
  IF tz = '' OR length(tz) > 64 OR NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = tz) THEN tz := 'Asia/Baku'; END IF;
  RETURN (now() AT TIME ZONE tz)::date;
END $$;

-- Free daily count limit: app_settings.free_limits[<feature>_count_per_day] (jsonb object or JSON string), else default.
CREATE OR REPLACE FUNCTION public._anacan_free_daily_limit(p_feature text)
RETURNS integer LANGUAGE plpgsql STABLE SET search_path = pg_catalog, public AS $$
DECLARE
  v jsonb;
  cfg jsonb;
  dflt integer := CASE p_feature WHEN 'ai_chat' THEN 10 WHEN 'cry_translator' THEN 3 WHEN 'poop_scanner' THEN 3
                                 WHEN 'fairy_tale' THEN 3 WHEN 'horoscope' THEN 2 WHEN 'baby_insight' THEN 2 END;
BEGIN
  SELECT value INTO v FROM public.app_settings WHERE key = 'free_limits';
  IF jsonb_typeof(v) = 'string' THEN
    BEGIN v := (v #>> '{}')::jsonb; EXCEPTION WHEN others THEN v := NULL; END;
  END IF;
  cfg := v -> (p_feature || '_count_per_day');
  IF jsonb_typeof(cfg) = 'number' AND (cfg #>> '{}')::numeric >= 0 THEN
    RETURN least(floor((cfg #>> '{}')::numeric), 1000000)::integer;
  END IF;
  RETURN dflt;
END $$;

REVOKE ALL ON FUNCTION public._anacan_local_day(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._anacan_free_daily_limit(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._anacan_local_day(text) TO service_role;
GRANT EXECUTE ON FUNCTION public._anacan_free_daily_limit(text) TO service_role;

-- ───────────── M1: atomic water increment ─────────────
CREATE OR REPLACE FUNCTION public.increment_water_intake_v1(p_log_date date, p_delta integer, p_op_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  uid uuid := auth.uid();
  today_utc date := (now() AT TIME ZONE 'UTC')::date;
  v integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501'; END IF;
  IF p_log_date IS NULL OR p_delta IS NULL OR p_delta = 0 OR abs(p_delta) > 50 THEN
    RAISE EXCEPTION 'invalid water delta' USING ERRCODE = '22023';
  END IF;

  IF p_op_id IS NOT NULL THEN
    -- Already applied (retry / replay): report the current value without adding again.
    IF EXISTS (SELECT 1 FROM public.water_intake_ops WHERE op_id = p_op_id) THEN
      SELECT coalesce(water_intake, 0) INTO v FROM public.daily_logs d
       WHERE d.user_id = uid AND d.log_date = (SELECT o.log_date FROM public.water_intake_ops o WHERE o.op_id = p_op_id AND o.user_id = uid);
      RETURN jsonb_build_object('water_intake', coalesce(v, 0), 'applied', false, 'log_date', p_log_date);
    END IF;
  END IF;

  -- Local day of the phone: at most one day ahead of UTC (UTC+14), queued taps up to 31 days old.
  IF p_log_date > today_utc + 1 OR p_log_date < today_utc - 31 THEN
    RAISE EXCEPTION 'water log_date out of range' USING ERRCODE = '22023';
  END IF;

  IF p_op_id IS NOT NULL THEN
    INSERT INTO public.water_intake_ops (op_id, user_id, log_date, delta) VALUES (p_op_id, uid, p_log_date, p_delta)
    ON CONFLICT (op_id) DO NOTHING;
    IF NOT FOUND THEN -- a concurrent call with the same op id won
      SELECT coalesce(water_intake, 0) INTO v FROM public.daily_logs WHERE user_id = uid AND log_date = p_log_date;
      RETURN jsonb_build_object('water_intake', coalesce(v, 0), 'applied', false, 'log_date', p_log_date);
    END IF;
    DELETE FROM public.water_intake_ops WHERE user_id = uid AND created_at < now() - interval '40 days';
  END IF;

  INSERT INTO public.daily_logs AS d (user_id, log_date, water_intake)
  VALUES (uid, p_log_date, greatest(0, least(20000, p_delta)))
  ON CONFLICT (user_id, log_date) DO UPDATE
    SET water_intake = greatest(0, least(20000, coalesce(d.water_intake, 0) + p_delta))
  RETURNING d.water_intake INTO v;

  RETURN jsonb_build_object('water_intake', v, 'applied', true, 'log_date', p_log_date);
END $$;

REVOKE ALL ON FUNCTION public.increment_water_intake_v1(date, integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_water_intake_v1(date, integer, uuid) TO authenticated, service_role;

-- ───────────── M4: atomic free daily limit ─────────────
CREATE OR REPLACE FUNCTION public.usage_consume_v1(p_feature text, p_time_zone text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  uid uuid := auth.uid();
  f text := lower(btrim(coalesce(p_feature, '')));
  d date := public._anacan_local_day(p_time_zone);
  lim integer;
  used integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501'; END IF;
  IF f NOT IN ('ai_chat', 'cry_translator', 'poop_scanner', 'fairy_tale', 'horoscope', 'baby_insight') THEN
    RAISE EXCEPTION 'unknown daily feature' USING ERRCODE = '22023';
  END IF;
  lim := public._anacan_free_daily_limit(f);

  IF lim > 0 THEN
    -- Check and count in one statement: the row lock of ON CONFLICT serialises parallel calls.
    INSERT INTO public.usage_tracking AS u (user_id, feature_type, usage_date, usage_count)
    VALUES (uid, f, d, 1)
    ON CONFLICT (user_id, feature_type, usage_date) DO UPDATE
      SET usage_count = u.usage_count + 1, updated_at = now()
      WHERE u.usage_count < lim
    RETURNING u.usage_count INTO used;
    IF used IS NOT NULL THEN
      RETURN jsonb_build_object('allowed', true, 'used', used, 'limit', lim, 'usage_date', d);
    END IF;
  END IF;

  SELECT usage_count INTO used FROM public.usage_tracking WHERE user_id = uid AND feature_type = f AND usage_date = d;
  RETURN jsonb_build_object('allowed', false, 'used', coalesce(used, 0), 'limit', lim, 'usage_date', d);
END $$;

-- White noise seconds for the local day (atomic add; the player enforces the limit from the returned total).
CREATE OR REPLACE FUNCTION public.usage_add_seconds_v1(p_seconds integer, p_time_zone text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  uid uuid := auth.uid();
  s integer := greatest(0, least(coalesce(p_seconds, 0), 3600));
  d date := public._anacan_local_day(p_time_zone);
  total integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501'; END IF;
  INSERT INTO public.usage_tracking AS u (user_id, feature_type, usage_date, usage_seconds)
  VALUES (uid, 'white_noise', d, s)
  ON CONFLICT (user_id, feature_type, usage_date) DO UPDATE
    SET usage_seconds = least(u.usage_seconds + s, 86400), updated_at = now()
  RETURNING u.usage_seconds INTO total;
  RETURN jsonb_build_object('used_seconds', total, 'usage_date', d);
END $$;

REVOKE ALL ON FUNCTION public.usage_consume_v1(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.usage_add_seconds_v1(integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.usage_consume_v1(text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.usage_add_seconds_v1(integer, text) TO authenticated, service_role;

COMMIT;
