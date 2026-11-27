-- partner_children_v1(): her active children for the linked partner, now always with due_date (2026-11-09).
--
-- The partner's Tərbiyə milestone check uses corrected age for a preterm baby (birth date + due date), as the
-- mother's side already does from user_children.due_date. The partner reads her children only through this
-- RPC. Duzelis83.sql defined it; this migration makes the migrations directory hold the definition and makes
-- sure the deployed function returns due_date, whatever shape it has now.
--
--   * Same rules as Duzelis83: SECURITY DEFINER, search_path pg_catalog, owner pgadmin, NOT_AUTHENTICATED
--     for a caller without a session, nothing at all unless the woman shares baby logs
--     (partner_can_see_v1(owner, 'baby_logs')), only her is_active children, same order.
--   * RETURNS TABLE changes cannot go through CREATE OR REPLACE when the column list differs, so the
--     function is dropped and recreated inside this one transaction, with owner and grants restored
--     (EXECUTE for authenticated only; revoked from PUBLIC and anon). No other object depends on it.
--   * If the deployed function already matches Duzelis83 (it returned due_date there), this is a no-op
--     re-creation with identical behaviour.
--
-- Function only: no new or changed relation, no CDC or writer-guard change, no cron or timer.
-- The app tolerates the old function (a child without due_date gets calendar age).
-- Applied by /home/anacan-runner/run-sql.py (psql as supabase_admin, ON_ERROR_STOP, one transaction).
-- Not applied yet.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
BEGIN
  IF to_regclass('public.user_children') IS NULL OR to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'PARTNER_CHILDREN_RELATIONS_MISSING';
  END IF;
  IF to_regprocedure('public.get_linked_partner_user_id(uuid)') IS NULL
     OR to_regprocedure('public.partner_can_see_v1(uuid, text)') IS NULL THEN
    RAISE EXCEPTION 'PARTNER_CHILDREN_HELPERS_MISSING';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_attribute
                  WHERE attrelid = 'public.user_children'::regclass AND attname = 'due_date' AND NOT attisdropped) THEN
    RAISE EXCEPTION 'PARTNER_CHILDREN_DUE_DATE_COLUMN_MISSING';
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.partner_children_v1();

CREATE FUNCTION public.partner_children_v1()
RETURNS TABLE(id uuid, name text, birth_date date, gender text, avatar_emoji text, sort_order integer, due_date date, is_current boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'pg_catalog' AS $function$
DECLARE owner uuid := public.get_linked_partner_user_id(auth.uid());
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = '42501'; END IF;
  IF owner IS NULL OR NOT public.partner_can_see_v1(owner, 'baby_logs') THEN RETURN; END IF;
  RETURN QUERY
    SELECT c.id, c.name, c.birth_date, c.gender, c.avatar_emoji, c.sort_order, c.due_date,
           (c.birth_date = p.baby_birth_date AND lower(btrim(c.name)) = lower(btrim(coalesce(p.baby_name, ''))))
      FROM public.user_children c JOIN public.profiles p ON p.user_id = c.user_id
     WHERE c.user_id = owner AND c.is_active
     ORDER BY c.birth_date DESC NULLS LAST, c.sort_order NULLS LAST, c.created_at;
END $function$;

ALTER FUNCTION public.partner_children_v1() OWNER TO pgadmin;
REVOKE ALL ON FUNCTION public.partner_children_v1() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.partner_children_v1() TO authenticated;

DO $$
DECLARE fn oid := to_regprocedure('public.partner_children_v1()');
BEGIN
  IF fn IS NULL
     OR NOT (SELECT prosecdef FROM pg_proc WHERE oid = fn)
     OR pg_get_function_result(fn) NOT LIKE '%due_date date%'
     OR has_function_privilege('anon', fn, 'EXECUTE')
     OR NOT has_function_privilege('authenticated', fn, 'EXECUTE') THEN
    RAISE EXCEPTION 'PARTNER_CHILDREN_VERIFY_FAILED';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
