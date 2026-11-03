-- Duzelis82.sql — the profile's "current child" (baby_name, baby_birth_date, baby_gender) must be an
-- ACTIVE child. Extends Duzelis81 (birth date only). No app update.
--
-- Why: the partner screens show profiles.baby_name / baby_gender. A mother deleted the child "Alp"; her
-- profile kept "Alp" (Duzelis81 had already moved the date to the remaining child "Atlas"), so her partner
-- still saw "Alp". On 2026-11-03: 79 profiles had a date of an active child but another name, 20 had no
-- name, 2 matched no active child.
--
-- Rule (children list is the source of truth):
--   1. name + date match an active child (twins included) -> untouched;
--   2. only the date matches -> take that child's name and gender (first by sort_order);
--   3. nothing matches -> take the youngest active child's name, date and gender.
-- Users without active children are untouched. Existing relations only (CDC/writer guarded); Google.

CREATE OR REPLACE FUNCTION public.sync_profile_child_birth_date_v1(p_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE prof record; pick record;
BEGIN
  IF p_user IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_children c WHERE c.user_id = p_user AND c.is_active) THEN RETURN; END IF;
  SELECT p.baby_name, p.baby_birth_date, p.baby_gender INTO prof FROM public.profiles p WHERE p.user_id = p_user;
  IF NOT FOUND THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.user_children c WHERE c.user_id = p_user AND c.is_active
              AND c.birth_date = prof.baby_birth_date
              AND lower(btrim(c.name)) = lower(btrim(coalesce(prof.baby_name, '')))) THEN RETURN; END IF;
  SELECT c.name, c.birth_date, c.gender INTO pick FROM public.user_children c
   WHERE c.user_id = p_user AND c.is_active AND c.birth_date = prof.baby_birth_date
   ORDER BY c.sort_order NULLS LAST, c.created_at LIMIT 1;
  IF NOT FOUND THEN
    SELECT c.name, c.birth_date, c.gender INTO pick FROM public.user_children c
     WHERE c.user_id = p_user AND c.is_active
     ORDER BY c.birth_date DESC NULLS LAST, c.sort_order NULLS LAST, c.created_at LIMIT 1;
  END IF;
  IF NOT FOUND THEN RETURN; END IF;
  UPDATE public.profiles p
     SET baby_name = coalesce(nullif(btrim(pick.name), ''), p.baby_name),
         baby_birth_date = coalesce(pick.birth_date, p.baby_birth_date),
         baby_gender = coalesce(pick.gender, p.baby_gender)
   WHERE p.user_id = p_user;
END $$;
ALTER FUNCTION public.sync_profile_child_birth_date_v1(uuid) OWNER TO pgadmin;
REVOKE ALL ON FUNCTION public.sync_profile_child_birth_date_v1(uuid) FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sync_profile_child_birth_date ON public.user_children;
CREATE TRIGGER trg_sync_profile_child_birth_date
  AFTER INSERT OR DELETE OR UPDATE OF is_active, birth_date, name, gender ON public.user_children
  FOR EACH ROW EXECUTE FUNCTION public.trg_sync_profile_child_birth_date_v1();

SELECT count(*) AS repaired FROM (
  SELECT public.sync_profile_child_birth_date_v1(p.user_id)
    FROM public.profiles p
   WHERE EXISTS (SELECT 1 FROM public.user_children c WHERE c.user_id = p.user_id AND c.is_active)
     AND NOT EXISTS (SELECT 1 FROM public.user_children c WHERE c.user_id = p.user_id AND c.is_active
                      AND c.birth_date = p.baby_birth_date
                      AND lower(btrim(c.name)) = lower(btrim(coalesce(p.baby_name, ''))))
) q;
