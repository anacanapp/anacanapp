-- Tərbiyə CMS (2026-11-08): version history of the editor overrides.
--
--   * parenting_content_override_history: every insert / update / delete of public.parenting_content_overrides
--     is recorded by a trigger (the override key, patch, draft, published, the action and who did it), so a revert
--     (which deletes the override row) or an overwritten draft can be looked at and restored. Rows are append-only;
--     RLS: admins read (has_role(auth.uid(), 'admin')), nobody writes directly (the SECURITY DEFINER trigger does).
--   * Existing override rows get one 'baseline' entry so items edited before this migration have a version.
--   * admin_parenting_override_history_v1: an item's versions, newest first.
--   * admin_parenting_override_restore_v1: restores one version as a draft or publishes it, through
--     admin_parenting_override_save_v1 (same checks and row logic); the new history entry is marked 'restore'.
--
-- Applied by /home/anacan-runner/run-sql.py (psql as supabase_admin, ON_ERROR_STOP, one transaction).
-- The new relation is enrolled in CDC and writer guarding here (the migration refuses without the guard catalog or
-- the earlier Tərbiyə CMS migration). No cron or timer.
-- Not applied yet: the admin UI works without it (no history panel until it is applied).

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

DO $$
BEGIN
  IF to_regclass('_anacan_gcp_migration.guarded_relations') IS NULL THEN
    RAISE EXCEPTION 'PARENTING_HISTORY_GUARD_CATALOG_MISSING';
  END IF;
  IF to_regprocedure('public.has_role(uuid, public.app_role)') IS NULL THEN
    RAISE EXCEPTION 'PARENTING_HISTORY_HAS_ROLE_MISSING';
  END IF;
  IF to_regclass('public.parenting_content_overrides') IS NULL
     OR to_regprocedure('public.admin_parenting_override_save_v1(text, text, text, jsonb, text)') IS NULL THEN
    RAISE EXCEPTION 'PARENTING_HISTORY_CMS_MISSING';
  END IF;
END $$;

-- ── History table (admin read only, append-only) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.parenting_content_override_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  override_id uuid,
  language text NOT NULL CHECK (language ~ '^[a-z]{2,3}$'),
  item_type text NOT NULL CHECK (item_type IN ('article', 'sos', 'programme', 'programme_day', 'tip', 'band', 'area', 'quiz')),
  item_id text NOT NULL CHECK (item_id ~ '^[a-z0-9][a-z0-9:_-]{0,79}$'),
  patch jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(patch) = 'object' AND octet_length(patch::text) <= 65536),
  draft jsonb
    CHECK (draft IS NULL OR (jsonb_typeof(draft) = 'object' AND octet_length(draft::text) <= 65536)),
  published boolean NOT NULL DEFAULT false,
  action text NOT NULL CHECK (action IN ('baseline', 'draft', 'publish', 'unpublish', 'revert', 'restore', 'edit')),
  edited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS parenting_content_override_history_item_idx
  ON public.parenting_content_override_history (language, item_type, item_id, created_at DESC);

ALTER TABLE public.parenting_content_override_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.parenting_content_override_history FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.parenting_content_override_history TO authenticated;
GRANT ALL ON public.parenting_content_override_history TO service_role;
DROP POLICY IF EXISTS parenting_content_override_history_admin_read ON public.parenting_content_override_history;
CREATE POLICY parenting_content_override_history_admin_read ON public.parenting_content_override_history
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ── Ownership ──────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pgadmin') THEN
    EXECUTE 'ALTER TABLE public.parenting_content_override_history OWNER TO pgadmin';
  END IF;
END $$;

-- ── CDC and writer-guard enrollment of the new relation ────────────────────────────────
INSERT INTO _anacan_gcp_migration.guarded_relations (schema_name, table_name, primary_key) VALUES
  ('public', 'parenting_content_override_history', ARRAY['id'])
ON CONFLICT DO NOTHING;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['parenting_content_override_history'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS anacan_gcp_writer_guard ON public.%I', t);
    EXECUTE format('DROP TRIGGER IF EXISTS anacan_gcp_change ON public.%I', t);
    EXECUTE format('DROP TRIGGER IF EXISTS anacan_gcp_truncate ON public.%I', t);
    EXECUTE format('CREATE TRIGGER anacan_gcp_writer_guard BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION _anacan_gcp_migration.guard_write()', t);
    EXECUTE format('CREATE TRIGGER anacan_gcp_change AFTER INSERT OR DELETE OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION _anacan_gcp_migration.capture_change()', t);
    EXECUTE format('CREATE TRIGGER anacan_gcp_truncate AFTER TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION _anacan_gcp_migration.capture_change()', t);
  END LOOP;
  IF (SELECT count(*) FROM _anacan_gcp_migration.guarded_relations WHERE schema_name = 'public'
      AND table_name IN ('parenting_content_override_history', 'parenting_content_overrides')) <> 2
     OR (SELECT count(*) FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relname IN ('parenting_content_override_history', 'parenting_content_overrides')
           AND tg.tgname IN ('anacan_gcp_writer_guard', 'anacan_gcp_change', 'anacan_gcp_truncate')) <> 6 THEN
    RAISE EXCEPTION 'PARENTING_HISTORY_GUARD_ENROLLMENT_INCOMPLETE';
  END IF;
END $$;

-- ── History trigger on the overrides ───────────────────────────────────────────────────
-- Action: 'revert' for a delete (the deleted row's last patch / draft / published are kept, so the text that was
-- live can be restored), 'publish' when a row becomes
-- published or is published again, 'unpublish' when it stops being published, 'draft' otherwise; a restore RPC
-- marks its own write 'restore' (transaction-local setting).
CREATE OR REPLACE FUNCTION public.parenting_override_history_capture()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.parenting_content_overrides;
  v_action text;
  v_marked text := NULLIF(current_setting('anacan.parenting_history_action', true), '');
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_row := OLD;
    v_action := 'revert';
  ELSE
    v_row := NEW;
    IF v_marked = 'restore' THEN
      v_action := 'restore';
    ELSIF NEW.published AND (TG_OP = 'INSERT' OR NOT OLD.published OR NEW.published_at IS DISTINCT FROM OLD.published_at) THEN
      v_action := 'publish';
    ELSIF TG_OP = 'UPDATE' AND OLD.published AND NOT NEW.published THEN
      v_action := 'unpublish';
    ELSIF TG_OP = 'UPDATE' AND NEW.draft IS NOT DISTINCT FROM OLD.draft AND NEW.patch IS NOT DISTINCT FROM OLD.patch
          AND NEW.published = OLD.published THEN
      RETURN NULL; -- nothing an editor would call a version changed
    ELSIF NEW.draft IS DISTINCT FROM (CASE WHEN TG_OP = 'UPDATE' THEN OLD.draft END) THEN
      v_action := 'draft';
    ELSE
      v_action := 'edit';
    END IF;
  END IF;
  INSERT INTO public.parenting_content_override_history
    (override_id, language, item_type, item_id, patch, draft, published, action, edited_by)
  VALUES
    (v_row.id, v_row.language, v_row.item_type, v_row.item_id, COALESCE(v_row.patch, '{}'::jsonb), v_row.draft,
     v_row.published, v_action,
     COALESCE(auth.uid(), v_row.updated_by));
  RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.parenting_override_history_capture() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS parenting_override_history ON public.parenting_content_overrides;
CREATE TRIGGER parenting_override_history
  AFTER INSERT OR UPDATE OR DELETE ON public.parenting_content_overrides
  FOR EACH ROW EXECUTE FUNCTION public.parenting_override_history_capture();

-- One baseline version for rows edited before the history existed (only on the first run).
INSERT INTO public.parenting_content_override_history
  (override_id, language, item_type, item_id, patch, draft, published, action, edited_by, created_at)
SELECT o.id, o.language, o.item_type, o.item_id, o.patch, o.draft, o.published, 'baseline', o.updated_by, o.updated_at
  FROM public.parenting_content_overrides o
 WHERE NOT EXISTS (SELECT 1 FROM public.parenting_content_override_history h
                    WHERE h.language = o.language AND h.item_type = o.item_type AND h.item_id = o.item_id);

-- ── Admin RPCs ─────────────────────────────────────────────────────────────────────────
-- One item's versions, newest first.
CREATE OR REPLACE FUNCTION public.admin_parenting_override_history_v1(
  p_language text, p_item_type text, p_item_id text, p_limit integer DEFAULT 50
)
RETURNS TABLE (
  id uuid, patch jsonb, draft jsonb, published boolean, action text, edited_by uuid, created_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT h.id, h.patch, h.draft, h.published, h.action, h.edited_by, h.created_at
      FROM public.parenting_content_override_history h
     WHERE h.language = p_language AND h.item_type = p_item_type AND h.item_id = p_item_id
     ORDER BY h.created_at DESC, h.id DESC
     LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
END;
$function$;

-- Restore one version: its text (the draft when it was an unpublished draft, else the live patch) becomes the
-- item's draft ('draft') or is published ('publish'), through admin_parenting_override_save_v1.
CREATE OR REPLACE FUNCTION public.admin_parenting_override_restore_v1(p_history_id uuid, p_action text DEFAULT 'draft')
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_h public.parenting_content_override_history;
  v_patch jsonb;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_action NOT IN ('draft', 'publish') THEN
    RAISE EXCEPTION 'PARENTING_OVERRIDE_ACTION_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_h FROM public.parenting_content_override_history WHERE id = p_history_id;
  IF v_h.id IS NULL THEN
    RAISE EXCEPTION 'PARENTING_HISTORY_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  v_patch := CASE WHEN v_h.published THEN v_h.patch ELSE COALESCE(v_h.draft, v_h.patch) END;
  PERFORM set_config('anacan.parenting_history_action', 'restore', true);
  v_result := public.admin_parenting_override_save_v1(v_h.language, v_h.item_type, v_h.item_id, v_patch, p_action);
  PERFORM set_config('anacan.parenting_history_action', '', true);
  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_parenting_override_history_v1(text, text, text, integer),
  public.admin_parenting_override_restore_v1(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_parenting_override_history_v1(text, text, text, integer),
  public.admin_parenting_override_restore_v1(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
