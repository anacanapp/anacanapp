-- Duzelis81.sql — keep profiles.baby_birth_date pointing at a real (active) child. No app update.
--
-- Why: the mommy home shows the postpartum recovery card from profiles.baby_birth_date. That field is
-- written when a child is added/selected, but nothing reverted it when that child was later deactivated
-- or deleted. Example: a mother whose children were born 2025-10-17 and 2022-03-09 kept 2026-10-30 from
-- a removed child record, so the app treated her as 4 days postpartum. On 2026-11-03: 46 profiles pointed
-- at no active child, 20 of them inside the card window although their youngest active child was older.
--
-- Rule: when the profile date matches no ACTIVE child of that user but the user has active children, set
-- it to the youngest active child's birth date. A deliberately selected (older) child that is still active
-- is left alone. Users without active child rows are not touched.
-- Existing relations only (user_children, profiles are CDC/writer guarded); applied on Google.

CREATE OR REPLACE FUNCTION public.sync_profile_child_birth_date_v1(p_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE youngest date;
BEGIN
  IF p_user IS NULL THEN RETURN; END IF;
  SELECT max(c.birth_date) INTO youngest FROM public.user_children c WHERE c.user_id = p_user AND c.is_active;
  IF youngest IS NULL THEN RETURN; END IF;
  UPDATE public.profiles p SET baby_birth_date = youngest
   WHERE p.user_id = p_user
     AND (p.baby_birth_date IS NULL
          OR NOT EXISTS (SELECT 1 FROM public.user_children c
                          WHERE c.user_id = p_user AND c.is_active AND c.birth_date = p.baby_birth_date));
END $$;
ALTER FUNCTION public.sync_profile_child_birth_date_v1(uuid) OWNER TO pgadmin;
REVOKE ALL ON FUNCTION public.sync_profile_child_birth_date_v1(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_sync_profile_child_birth_date_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
  BEGIN
    PERFORM public.sync_profile_child_birth_date_v1(CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id ELSE NEW.user_id END);
  EXCEPTION WHEN OTHERS THEN
    NULL; -- never fail the child write itself
  END;
  RETURN NULL;
END $$;
ALTER FUNCTION public.trg_sync_profile_child_birth_date_v1() OWNER TO pgadmin;
REVOKE ALL ON FUNCTION public.trg_sync_profile_child_birth_date_v1() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sync_profile_child_birth_date ON public.user_children;
CREATE TRIGGER trg_sync_profile_child_birth_date
  AFTER INSERT OR DELETE OR UPDATE OF is_active, birth_date ON public.user_children
  FOR EACH ROW EXECUTE FUNCTION public.trg_sync_profile_child_birth_date_v1();

-- One-time repair of profiles that already point at no active child.
SELECT count(*) AS repaired FROM (
  SELECT public.sync_profile_child_birth_date_v1(p.user_id)
    FROM public.profiles p
   WHERE p.baby_birth_date IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.user_children c WHERE c.user_id = p.user_id AND c.is_active)
     AND NOT EXISTS (SELECT 1 FROM public.user_children c WHERE c.user_id = p.user_id AND c.is_active AND c.birth_date = p.baby_birth_date)
) q;
