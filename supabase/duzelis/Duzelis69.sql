-- Duzelis69 (2026-10-30): partner rebuild phase 4 — night shift and birth plan.
--
--   * partner_night_shifts: who gets up with the baby on each night (mother / partner),
--     done flag, wake-up count and a short note. One row per family and date.
--   * birth_plans: the mother's birth wishes as bounded JSON, one row per mother.
--   * Both tables are reachable only through SECURITY DEFINER RPCs; the family is the
--     caller (mother) or the mother the caller is mutually linked to (partner).
--   * Both new relations are enrolled in CDC and writer guarding like every other
--     Google relation (see the enrollment block below); the migration refuses otherwise.
--
-- Applied once on Google (psql as supabase_admin, one transaction). No cron, no timer.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

DO $$
BEGIN
  IF to_regclass('_anacan_gcp_migration.guarded_relations') IS NULL THEN
    RAISE EXCEPTION 'PARTNER_P4_GUARD_CATALOG_MISSING';
  END IF;
END $$;

-- ── Tables ────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.partner_night_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mother_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shift_date date NOT NULL,
  assignee text NOT NULL CHECK (assignee IN ('mother', 'partner')),
  is_done boolean NOT NULL DEFAULT false,
  wakeups smallint CHECK (wakeups IS NULL OR wakeups BETWEEN 0 AND 20),
  note text CHECK (note IS NULL OR char_length(note) <= 280),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mother_id, shift_date)
);

CREATE TABLE IF NOT EXISTS public.birth_plans (
  mother_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(plan) = 'object' AND octet_length(plan::text) <= 16000),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.partner_night_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.birth_plans ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.partner_night_shifts, public.birth_plans FROM anon, authenticated;
GRANT ALL ON public.partner_night_shifts, public.birth_plans TO service_role;

-- ── Family: the mother's user id for the caller ──────────────────────────────────────
-- Mother: herself. Partner: the mother he is mutually linked to. Otherwise NULL.
CREATE OR REPLACE FUNCTION public.partner_family_mother_v1()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $$
  SELECT CASE
    WHEN me.life_stage IS DISTINCT FROM 'partner' THEN me.user_id
    ELSE (SELECT w.user_id FROM public.profiles w
          WHERE w.id = public.get_user_linked_partner_id(auth.uid()) AND w.life_stage IS DISTINCT FROM 'partner')
  END
  FROM public.profiles me WHERE me.user_id = auth.uid();
$$;

-- ── Night shift ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.night_shifts_v1(p_from date, p_to date)
RETURNS TABLE (shift_date date, assignee text, is_done boolean, wakeups smallint, note text, updated_by_me boolean, updated_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $$
DECLARE mother uuid := public.partner_family_mother_v1();
BEGIN
  IF mother IS NULL THEN RAISE EXCEPTION 'NIGHT_SHIFT_NO_FAMILY' USING ERRCODE = '42501'; END IF;
  IF p_from IS NULL OR p_to IS NULL OR p_to < p_from OR p_to - p_from > 62 THEN
    RAISE EXCEPTION 'NIGHT_SHIFT_INVALID_RANGE' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY SELECT s.shift_date, s.assignee, s.is_done, s.wakeups, s.note, s.updated_by = auth.uid(), s.updated_at
    FROM public.partner_night_shifts s
   WHERE s.mother_id = mother AND s.shift_date BETWEEN p_from AND p_to
   ORDER BY s.shift_date;
END $$;

-- p_assignee NULL clears the night.
CREATE OR REPLACE FUNCTION public.night_shift_set_v1(p_date date, p_assignee text, p_is_done boolean DEFAULT false, p_wakeups smallint DEFAULT NULL, p_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $$
DECLARE mother uuid := public.partner_family_mother_v1();
BEGIN
  IF mother IS NULL THEN RAISE EXCEPTION 'NIGHT_SHIFT_NO_FAMILY' USING ERRCODE = '42501'; END IF;
  IF p_date IS NULL OR p_date < current_date - 31 OR p_date > current_date + 31 THEN
    RAISE EXCEPTION 'NIGHT_SHIFT_INVALID_DATE' USING ERRCODE = '22023';
  END IF;
  IF p_assignee IS NULL THEN
    DELETE FROM public.partner_night_shifts WHERE mother_id = mother AND shift_date = p_date;
    RETURN;
  END IF;
  INSERT INTO public.partner_night_shifts (mother_id, shift_date, assignee, is_done, wakeups, note, updated_by)
  VALUES (mother, p_date, p_assignee, coalesce(p_is_done, false), p_wakeups, nullif(btrim(p_note), ''), auth.uid())
  ON CONFLICT (mother_id, shift_date) DO UPDATE
    SET assignee = excluded.assignee, is_done = excluded.is_done, wakeups = excluded.wakeups,
        note = excluded.note, updated_by = excluded.updated_by, updated_at = now();
END $$;

-- ── Birth plan ──────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.birth_plan_get_v1()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $$
DECLARE mother uuid := public.partner_family_mother_v1(); out jsonb;
BEGIN
  IF mother IS NULL THEN RAISE EXCEPTION 'BIRTH_PLAN_NO_FAMILY' USING ERRCODE = '42501'; END IF;
  SELECT jsonb_build_object('plan', b.plan, 'updated_at', b.updated_at, 'updated_by_me', b.updated_by = auth.uid(),
                            'is_mother', mother = auth.uid())
    INTO out FROM public.birth_plans b WHERE b.mother_id = mother;
  RETURN coalesce(out, jsonb_build_object('plan', '{}'::jsonb, 'updated_at', NULL, 'updated_by_me', false, 'is_mother', mother = auth.uid()));
END $$;

-- Saves only when nobody changed the plan since p_expected_updated_at (NULL = new plan).
CREATE OR REPLACE FUNCTION public.birth_plan_save_v1(p_plan jsonb, p_expected_updated_at timestamptz DEFAULT NULL)
RETURNS timestamptz
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $$
DECLARE mother uuid := public.partner_family_mother_v1(); current_at timestamptz; saved_at timestamptz;
BEGIN
  IF mother IS NULL THEN RAISE EXCEPTION 'BIRTH_PLAN_NO_FAMILY' USING ERRCODE = '42501'; END IF;
  IF p_plan IS NULL OR jsonb_typeof(p_plan) <> 'object' OR octet_length(p_plan::text) > 16000 THEN
    RAISE EXCEPTION 'BIRTH_PLAN_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT b.updated_at INTO current_at FROM public.birth_plans b WHERE b.mother_id = mother FOR UPDATE;
  IF current_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'BIRTH_PLAN_CHANGED' USING ERRCODE = '40001';
  END IF;
  INSERT INTO public.birth_plans (mother_id, plan, updated_by)
  VALUES (mother, p_plan, auth.uid())
  ON CONFLICT (mother_id) DO UPDATE SET plan = excluded.plan, updated_by = excluded.updated_by, updated_at = clock_timestamp()
  RETURNING updated_at INTO saved_at;
  RETURN saved_at;
END $$;

-- ── Ownership and grants ────────────────────────────────────────────────────────────
ALTER TABLE public.partner_night_shifts OWNER TO pgadmin;
ALTER TABLE public.birth_plans OWNER TO pgadmin;
ALTER FUNCTION public.partner_family_mother_v1() OWNER TO pgadmin;
ALTER FUNCTION public.night_shifts_v1(date, date) OWNER TO pgadmin;
ALTER FUNCTION public.night_shift_set_v1(date, text, boolean, smallint, text) OWNER TO pgadmin;
ALTER FUNCTION public.birth_plan_get_v1() OWNER TO pgadmin;
ALTER FUNCTION public.birth_plan_save_v1(jsonb, timestamptz) OWNER TO pgadmin;
REVOKE ALL ON FUNCTION public.partner_family_mother_v1(), public.night_shifts_v1(date, date),
  public.night_shift_set_v1(date, text, boolean, smallint, text), public.birth_plan_get_v1(),
  public.birth_plan_save_v1(jsonb, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.partner_family_mother_v1(), public.night_shifts_v1(date, date),
  public.night_shift_set_v1(date, text, boolean, smallint, text), public.birth_plan_get_v1(),
  public.birth_plan_save_v1(jsonb, timestamptz) TO authenticated, service_role;

-- ── CDC and writer-guard enrollment of the two new relations ──────────────────────────
-- @@ENROLLMENT@@

NOTIFY pgrst, 'reload schema';
COMMIT;
