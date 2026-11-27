-- Duzelis75 (2026-11-01): baby illness journal, postpartum recovery and the "trying to conceive" goal.
--
--   * baby_illness_episodes / baby_illness_entries: an illness episode of a child (fever, cold…) with
--     temperature readings, medicines given (name, dose and interval exactly as the doctor said —
--     the app never calculates a dose) and symptoms. The family is the mother and her mutually linked
--     partner (partner_family_mother_v1 from Duzelis69): both read and write through SECURITY DEFINER
--     RPCs; the tables are not reachable directly.
--   * postpartum_checkins: the mother's own daily recovery check-in (bleeding, pain, stitches, mood,
--     warning signs, pelvic-floor sessions). Own rows only (RLS), never shared with the partner.
--   * profiles.birth_type (vaginal / cesarean) shapes the 6-week recovery plan.
--   * profiles.flow_goal ('track' | 'conceive') and profiles.ttc_state (bounded JSON: start month,
--     checklist, pregnancy tests). Daily LH / basal temperature / intimacy reuse flow_daily_logs.
--   * The three new relations are enrolled in CDC and writer guarding; profiles already is.
--
-- Applied once on Google (psql as supabase_admin, one transaction). No cron, no timer.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

DO $$
BEGIN
  IF to_regclass('_anacan_gcp_migration.guarded_relations') IS NULL THEN
    RAISE EXCEPTION 'D75_GUARD_CATALOG_MISSING';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM _anacan_gcp_migration.guarded_relations WHERE schema_name = 'public' AND table_name = 'profiles')
     OR NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE n.nspname = 'public' AND c.relname = 'profiles' AND tg.tgname = 'anacan_gcp_writer_guard') THEN
    RAISE EXCEPTION 'D75_PROFILES_GUARD_MISSING';
  END IF;
  IF to_regprocedure('public.partner_family_mother_v1()') IS NULL THEN
    RAISE EXCEPTION 'D75_FAMILY_FUNCTION_MISSING';
  END IF;
END $$;

-- ── Profiles ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS birth_type text CHECK (birth_type IS NULL OR birth_type IN ('vaginal', 'cesarean')),
  ADD COLUMN IF NOT EXISTS flow_goal text NOT NULL DEFAULT 'track' CHECK (flow_goal IN ('track', 'conceive')),
  ADD COLUMN IF NOT EXISTS ttc_state jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(ttc_state) = 'object' AND octet_length(ttc_state::text) <= 8000);

-- ── Illness journal ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.baby_illness_episodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mother_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  child_id uuid,
  child_name text CHECK (child_name IS NULL OR char_length(child_name) <= 60),
  kind text NOT NULL CHECK (kind IN ('fever', 'cold', 'stomach', 'ear', 'rash', 'teething', 'vaccine', 'other')),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  note text CHECK (note IS NULL OR char_length(note) <= 500),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS baby_illness_episodes_mother_idx ON public.baby_illness_episodes (mother_id, started_at DESC);

CREATE TABLE IF NOT EXISTS public.baby_illness_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid NOT NULL REFERENCES public.baby_illness_episodes(id) ON DELETE CASCADE,
  mother_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('temp', 'med', 'symptom')),
  at timestamptz NOT NULL,
  temp_c numeric(4,1) CHECK (temp_c IS NULL OR temp_c BETWEEN 34.0 AND 43.0),
  temp_method text CHECK (temp_method IS NULL OR temp_method IN ('armpit', 'ear', 'forehead', 'rectal', 'oral')),
  med_name text CHECK (med_name IS NULL OR char_length(med_name) BETWEEN 1 AND 60),
  dose text CHECK (dose IS NULL OR char_length(dose) <= 40),
  interval_hours numeric(4,1) CHECK (interval_hours IS NULL OR interval_hours BETWEEN 1 AND 48),
  remind boolean NOT NULL DEFAULT false,
  symptoms text[] CHECK (symptoms IS NULL OR cardinality(symptoms) <= 12),
  note text CHECK (note IS NULL OR char_length(note) <= 280),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((kind = 'temp' AND temp_c IS NOT NULL) OR (kind = 'med' AND med_name IS NOT NULL) OR kind = 'symptom')
);
CREATE INDEX IF NOT EXISTS baby_illness_entries_episode_idx ON public.baby_illness_entries (episode_id, at DESC);

ALTER TABLE public.baby_illness_episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.baby_illness_entries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.baby_illness_episodes, public.baby_illness_entries FROM anon, authenticated;
GRANT ALL ON public.baby_illness_episodes, public.baby_illness_entries TO service_role;

-- Episodes of the family, newest first, with entry counts and the latest temperature.
CREATE OR REPLACE FUNCTION public.illness_episodes_v1(p_limit int DEFAULT 20)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $$
DECLARE mother uuid := public.partner_family_mother_v1(); out jsonb;
BEGIN
  IF mother IS NULL THEN RAISE EXCEPTION 'ILLNESS_NO_FAMILY' USING ERRCODE = '42501'; END IF;
  SELECT coalesce(jsonb_agg(row_to_json(x) ORDER BY x.ended_at IS NOT NULL, x.started_at DESC), '[]'::jsonb) INTO out FROM (
    SELECT e.id, e.child_id, e.child_name, e.kind, e.started_at, e.ended_at, e.note,
           (SELECT count(*) FROM public.baby_illness_entries n WHERE n.episode_id = e.id) AS entries,
           (SELECT n.temp_c FROM public.baby_illness_entries n WHERE n.episode_id = e.id AND n.kind = 'temp' ORDER BY n.at DESC LIMIT 1) AS last_temp,
           (SELECT max(n.temp_c) FROM public.baby_illness_entries n WHERE n.episode_id = e.id AND n.kind = 'temp') AS max_temp
      FROM public.baby_illness_episodes e
     WHERE e.mother_id = mother
     ORDER BY e.ended_at IS NOT NULL, e.started_at DESC
     LIMIT least(greatest(coalesce(p_limit, 20), 1), 50)
  ) x;
  RETURN out;
END $$;

CREATE OR REPLACE FUNCTION public.illness_entries_v1(p_episode uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $$
DECLARE mother uuid := public.partner_family_mother_v1(); out jsonb;
BEGIN
  IF mother IS NULL THEN RAISE EXCEPTION 'ILLNESS_NO_FAMILY' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.baby_illness_episodes e WHERE e.id = p_episode AND e.mother_id = mother) THEN
    RAISE EXCEPTION 'ILLNESS_NOT_FOUND' USING ERRCODE = '42704';
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'id', n.id, 'kind', n.kind, 'at', n.at, 'temp_c', n.temp_c, 'temp_method', n.temp_method,
           'med_name', n.med_name, 'dose', n.dose, 'interval_hours', n.interval_hours, 'remind', n.remind,
           'symptoms', n.symptoms, 'note', n.note,
           'by', CASE WHEN n.created_by = mother THEN 'mother' WHEN n.created_by IS NULL THEN NULL ELSE 'partner' END,
           'by_me', n.created_by = auth.uid()) ORDER BY n.at DESC), '[]'::jsonb)
    INTO out FROM public.baby_illness_entries n WHERE n.episode_id = p_episode;
  RETURN out;
END $$;

CREATE OR REPLACE FUNCTION public.illness_episode_start_v1(p_kind text, p_child_id uuid DEFAULT NULL, p_child_name text DEFAULT NULL, p_started_at timestamptz DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $$
DECLARE mother uuid := public.partner_family_mother_v1(); new_id uuid;
BEGIN
  IF mother IS NULL THEN RAISE EXCEPTION 'ILLNESS_NO_FAMILY' USING ERRCODE = '42501'; END IF;
  IF p_started_at IS NOT NULL AND (p_started_at > now() + interval '10 minutes' OR p_started_at < now() - interval '30 days') THEN
    RAISE EXCEPTION 'ILLNESS_INVALID_DATE' USING ERRCODE = '22023';
  END IF;
  IF (SELECT count(*) FROM public.baby_illness_episodes e WHERE e.mother_id = mother AND e.ended_at IS NULL) >= 5 THEN
    RAISE EXCEPTION 'ILLNESS_TOO_MANY_OPEN' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.baby_illness_episodes (mother_id, child_id, child_name, kind, started_at, created_by)
  VALUES (mother, p_child_id, nullif(btrim(p_child_name), ''), p_kind, coalesce(p_started_at, now()), auth.uid())
  RETURNING id INTO new_id;
  RETURN new_id;
END $$;

-- p_ended true closes the episode (healed), false reopens it.
CREATE OR REPLACE FUNCTION public.illness_episode_close_v1(p_episode uuid, p_ended boolean DEFAULT true)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $$
DECLARE mother uuid := public.partner_family_mother_v1();
BEGIN
  IF mother IS NULL THEN RAISE EXCEPTION 'ILLNESS_NO_FAMILY' USING ERRCODE = '42501'; END IF;
  UPDATE public.baby_illness_episodes
     SET ended_at = CASE WHEN p_ended THEN now() ELSE NULL END, updated_at = now()
   WHERE id = p_episode AND mother_id = mother;
  IF NOT FOUND THEN RAISE EXCEPTION 'ILLNESS_NOT_FOUND' USING ERRCODE = '42704'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.illness_episode_delete_v1(p_episode uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $$
DECLARE mother uuid := public.partner_family_mother_v1();
BEGIN
  IF mother IS NULL THEN RAISE EXCEPTION 'ILLNESS_NO_FAMILY' USING ERRCODE = '42501'; END IF;
  DELETE FROM public.baby_illness_episodes WHERE id = p_episode AND mother_id = mother;
END $$;

CREATE OR REPLACE FUNCTION public.illness_entry_add_v1(p_episode uuid, p_entry jsonb)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $$
DECLARE
  mother uuid := public.partner_family_mother_v1();
  new_id uuid;
  v_at timestamptz;
  v_kind text;
BEGIN
  IF mother IS NULL THEN RAISE EXCEPTION 'ILLNESS_NO_FAMILY' USING ERRCODE = '42501'; END IF;
  IF p_entry IS NULL OR jsonb_typeof(p_entry) <> 'object' OR octet_length(p_entry::text) > 4000
     OR EXISTS (SELECT 1 FROM jsonb_object_keys(p_entry) k WHERE k NOT IN
       ('kind', 'at', 'temp_c', 'temp_method', 'med_name', 'dose', 'interval_hours', 'remind', 'symptoms', 'note')) THEN
    RAISE EXCEPTION 'ILLNESS_INVALID_ENTRY' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.baby_illness_episodes e WHERE e.id = p_episode AND e.mother_id = mother) THEN
    RAISE EXCEPTION 'ILLNESS_NOT_FOUND' USING ERRCODE = '42704';
  END IF;
  IF (SELECT count(*) FROM public.baby_illness_entries n WHERE n.episode_id = p_episode) >= 500 THEN
    RAISE EXCEPTION 'ILLNESS_TOO_MANY_ENTRIES' USING ERRCODE = '22023';
  END IF;
  v_kind := p_entry->>'kind';
  v_at := coalesce((p_entry->>'at')::timestamptz, now());
  IF v_at > now() + interval '10 minutes' OR v_at < now() - interval '30 days' THEN
    RAISE EXCEPTION 'ILLNESS_INVALID_DATE' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.baby_illness_entries (episode_id, mother_id, kind, at, temp_c, temp_method, med_name, dose,
                                           interval_hours, remind, symptoms, note, created_by)
  VALUES (p_episode, mother, v_kind, v_at,
          CASE WHEN v_kind = 'temp' THEN (p_entry->>'temp_c')::numeric END,
          CASE WHEN v_kind = 'temp' THEN nullif(p_entry->>'temp_method', '') END,
          CASE WHEN v_kind = 'med' THEN nullif(btrim(p_entry->>'med_name'), '') END,
          CASE WHEN v_kind = 'med' THEN nullif(btrim(p_entry->>'dose'), '') END,
          CASE WHEN v_kind = 'med' THEN (p_entry->>'interval_hours')::numeric END,
          v_kind = 'med' AND coalesce((p_entry->>'remind')::boolean, false),
          CASE WHEN p_entry ? 'symptoms' AND jsonb_typeof(p_entry->'symptoms') = 'array'
               THEN ARRAY(SELECT left(s, 40) FROM jsonb_array_elements_text(p_entry->'symptoms') s) END,
          nullif(btrim(p_entry->>'note'), ''), auth.uid())
  RETURNING id INTO new_id;
  UPDATE public.baby_illness_episodes SET updated_at = now() WHERE id = p_episode;
  RETURN new_id;
END $$;

CREATE OR REPLACE FUNCTION public.illness_entry_delete_v1(p_entry uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $$
DECLARE mother uuid := public.partner_family_mother_v1();
BEGIN
  IF mother IS NULL THEN RAISE EXCEPTION 'ILLNESS_NO_FAMILY' USING ERRCODE = '42501'; END IF;
  DELETE FROM public.baby_illness_entries WHERE id = p_entry AND mother_id = mother;
END $$;

-- ── Postpartum recovery check-ins (own rows only) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.postpartum_checkins (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day date NOT NULL,
  bleeding smallint CHECK (bleeding IS NULL OR bleeding BETWEEN 0 AND 3),
  pain smallint CHECK (pain IS NULL OR pain BETWEEN 0 AND 10),
  stitches text CHECK (stitches IS NULL OR stitches IN ('fine', 'sore', 'red', 'none')),
  mood smallint CHECK (mood IS NULL OR mood BETWEEN 1 AND 5),
  flags text[] NOT NULL DEFAULT '{}' CHECK (cardinality(flags) <= 12),
  kegel_sessions smallint NOT NULL DEFAULT 0 CHECK (kegel_sessions BETWEEN 0 AND 10),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);
ALTER TABLE public.postpartum_checkins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.postpartum_checkins FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.postpartum_checkins TO authenticated;
GRANT ALL ON public.postpartum_checkins TO service_role;
DROP POLICY IF EXISTS postpartum_checkins_own ON public.postpartum_checkins;
CREATE POLICY postpartum_checkins_own ON public.postpartum_checkins
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND day BETWEEN current_date - 400 AND current_date + 1);

-- ── Ownership and grants ────────────────────────────────────────────────────────────
ALTER TABLE public.baby_illness_episodes OWNER TO pgadmin;
ALTER TABLE public.baby_illness_entries OWNER TO pgadmin;
ALTER TABLE public.postpartum_checkins OWNER TO pgadmin;
ALTER FUNCTION public.illness_episodes_v1(int) OWNER TO pgadmin;
ALTER FUNCTION public.illness_entries_v1(uuid) OWNER TO pgadmin;
ALTER FUNCTION public.illness_episode_start_v1(text, uuid, text, timestamptz) OWNER TO pgadmin;
ALTER FUNCTION public.illness_episode_close_v1(uuid, boolean) OWNER TO pgadmin;
ALTER FUNCTION public.illness_episode_delete_v1(uuid) OWNER TO pgadmin;
ALTER FUNCTION public.illness_entry_add_v1(uuid, jsonb) OWNER TO pgadmin;
ALTER FUNCTION public.illness_entry_delete_v1(uuid) OWNER TO pgadmin;
REVOKE ALL ON FUNCTION public.illness_episodes_v1(int), public.illness_entries_v1(uuid),
  public.illness_episode_start_v1(text, uuid, text, timestamptz), public.illness_episode_close_v1(uuid, boolean),
  public.illness_episode_delete_v1(uuid), public.illness_entry_add_v1(uuid, jsonb), public.illness_entry_delete_v1(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.illness_episodes_v1(int), public.illness_entries_v1(uuid),
  public.illness_episode_start_v1(text, uuid, text, timestamptz), public.illness_episode_close_v1(uuid, boolean),
  public.illness_episode_delete_v1(uuid), public.illness_entry_add_v1(uuid, jsonb), public.illness_entry_delete_v1(uuid)
  TO authenticated, service_role;

-- ── CDC and writer-guard enrollment of the three new relations ───────────────────────────
INSERT INTO _anacan_gcp_migration.guarded_relations (schema_name, table_name, primary_key) VALUES
  ('public', 'baby_illness_episodes', ARRAY['id']),
  ('public', 'baby_illness_entries', ARRAY['id']),
  ('public', 'postpartum_checkins', ARRAY['user_id', 'day'])
ON CONFLICT DO NOTHING;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['baby_illness_episodes', 'baby_illness_entries', 'postpartum_checkins'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS anacan_gcp_writer_guard ON public.%I', t);
    EXECUTE format('DROP TRIGGER IF EXISTS anacan_gcp_change ON public.%I', t);
    EXECUTE format('DROP TRIGGER IF EXISTS anacan_gcp_truncate ON public.%I', t);
    EXECUTE format('CREATE TRIGGER anacan_gcp_writer_guard BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION _anacan_gcp_migration.guard_write()', t);
    EXECUTE format('CREATE TRIGGER anacan_gcp_change AFTER INSERT OR DELETE OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION _anacan_gcp_migration.capture_change()', t);
    EXECUTE format('CREATE TRIGGER anacan_gcp_truncate AFTER TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION _anacan_gcp_migration.capture_change()', t);
  END LOOP;
  IF (SELECT count(*) FROM _anacan_gcp_migration.guarded_relations WHERE schema_name = 'public'
      AND table_name IN ('baby_illness_episodes', 'baby_illness_entries', 'postpartum_checkins')) <> 3
     OR (SELECT count(*) FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relname IN ('baby_illness_episodes', 'baby_illness_entries', 'postpartum_checkins')
           AND tg.tgname IN ('anacan_gcp_writer_guard', 'anacan_gcp_change', 'anacan_gcp_truncate')) <> 9 THEN
    RAISE EXCEPTION 'D75_GUARD_ENROLLMENT_INCOMPLETE';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
