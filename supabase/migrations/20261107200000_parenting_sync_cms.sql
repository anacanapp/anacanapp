-- Tərbiyə (2026-11-07, part 2): account sync of the parent's state and editor overrides of the content (CMS).
--
--   * parenting_state: one row per account — the tool's state jsonb (age band, programme progress incl. pause,
--     quiz results, bookmarks with add/remove times, tombstones) and updated_at. The app keeps the device copy
--     first and merges it with this row in the background (union of bookmarks, max programme progress, newest
--     band / quiz). RLS: own row only; the partner's progress is his own row. The reminder preference never
--     leaves the phone.
--   * parenting_content_overrides: per language / item_type / item_id a jsonb patch of the item's text fields,
--     merged by the app over the bundled content. Everyone (anon included) reads published rows — only the
--     public columns (language, item_type, item_id, patch, published, updated_at); the draft and the editor are
--     not exposed. Writes only through SECURITY DEFINER admin RPCs (has_role(auth.uid(), 'admin')): save draft,
--     publish, unpublish, revert to bundled (delete).
--
-- Applied by /home/anacan-runner/run-sql.py (psql as supabase_admin, ON_ERROR_STOP, one transaction).
-- Both new relations are enrolled in CDC and writer guarding here (the migration refuses without the guard
-- catalog). No cron or timer: programme reminders are local notifications on the phone.
-- NOT APPLIED YET.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

DO $$
BEGIN
  IF to_regclass('_anacan_gcp_migration.guarded_relations') IS NULL THEN
    RAISE EXCEPTION 'PARENTING_GUARD_CATALOG_MISSING';
  END IF;
  IF to_regprocedure('public.has_role(uuid, public.app_role)') IS NULL THEN
    RAISE EXCEPTION 'PARENTING_HAS_ROLE_MISSING';
  END IF;
END $$;

-- ── Account state (own row only) ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.parenting_state (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  state jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(state) = 'object' AND octet_length(state::text) <= 65536),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.parenting_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.parenting_state FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parenting_state TO authenticated;
GRANT ALL ON public.parenting_state TO service_role;
DROP POLICY IF EXISTS parenting_state_own ON public.parenting_state;
CREATE POLICY parenting_state_own ON public.parenting_state
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── Content overrides (public read of published rows, admin writes via RPC) ────────────
CREATE TABLE IF NOT EXISTS public.parenting_content_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  language text NOT NULL CHECK (language ~ '^[a-z]{2,3}$'),
  item_type text NOT NULL CHECK (item_type IN ('article', 'sos', 'programme', 'programme_day', 'tip', 'band', 'area', 'quiz')),
  item_id text NOT NULL CHECK (item_id ~ '^[a-z0-9][a-z0-9:_-]{0,79}$'),
  patch jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(patch) = 'object' AND octet_length(patch::text) <= 65536),
  draft jsonb
    CHECK (draft IS NULL OR (jsonb_typeof(draft) = 'object' AND octet_length(draft::text) <= 65536)),
  published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (language, item_type, item_id)
);
CREATE INDEX IF NOT EXISTS parenting_content_overrides_published_idx
  ON public.parenting_content_overrides (language) WHERE published;

ALTER TABLE public.parenting_content_overrides ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.parenting_content_overrides FROM PUBLIC, anon, authenticated;
GRANT SELECT (language, item_type, item_id, patch, published, updated_at) ON public.parenting_content_overrides TO anon, authenticated;
GRANT ALL ON public.parenting_content_overrides TO service_role;
DROP POLICY IF EXISTS parenting_content_overrides_read_published ON public.parenting_content_overrides;
CREATE POLICY parenting_content_overrides_read_published ON public.parenting_content_overrides
  FOR SELECT TO anon, authenticated
  USING (published);

-- ── Admin RPCs ─────────────────────────────────────────────────────────────────────────
-- Every row of a language, drafts included (editor list).
CREATE OR REPLACE FUNCTION public.admin_parenting_overrides_v1(p_language text)
RETURNS TABLE (
  item_type text, item_id text, patch jsonb, draft jsonb, published boolean, published_at timestamptz,
  updated_by uuid, updated_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT o.item_type, o.item_id, o.patch, o.draft, o.published, o.published_at, o.updated_by, o.updated_at
      FROM public.parenting_content_overrides o
     WHERE o.language = p_language
     ORDER BY o.updated_at DESC;
END;
$function$;

-- p_action: 'draft' (store the editor's patch as draft), 'publish' (draft or p_patch becomes the live patch),
-- 'unpublish' (back to bundled for users, draft kept).
CREATE OR REPLACE FUNCTION public.admin_parenting_override_save_v1(
  p_language text, p_item_type text, p_item_id text, p_patch jsonb, p_action text
)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.parenting_content_overrides;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_action NOT IN ('draft', 'publish', 'unpublish') THEN
    RAISE EXCEPTION 'PARENTING_OVERRIDE_ACTION_INVALID' USING ERRCODE = '22023';
  END IF;
  IF p_patch IS NOT NULL AND jsonb_typeof(p_patch) <> 'object' THEN
    RAISE EXCEPTION 'PARENTING_OVERRIDE_PATCH_INVALID' USING ERRCODE = '22023';
  END IF;

  IF p_action = 'unpublish' THEN
    UPDATE public.parenting_content_overrides
       SET published = false, published_at = NULL,
           draft = COALESCE(draft, patch), updated_by = auth.uid(), updated_at = now()
     WHERE language = p_language AND item_type = p_item_type AND item_id = p_item_id
     RETURNING * INTO v_row;
  ELSIF p_action = 'draft' THEN
    INSERT INTO public.parenting_content_overrides (language, item_type, item_id, draft, updated_by)
    VALUES (p_language, p_item_type, p_item_id, COALESCE(p_patch, '{}'::jsonb), auth.uid())
    ON CONFLICT (language, item_type, item_id) DO UPDATE
       SET draft = COALESCE(p_patch, '{}'::jsonb), updated_by = auth.uid(), updated_at = now()
    RETURNING * INTO v_row;
  ELSE
    INSERT INTO public.parenting_content_overrides (language, item_type, item_id, patch, draft, published, published_at, updated_by)
    VALUES (p_language, p_item_type, p_item_id, COALESCE(p_patch, '{}'::jsonb), NULL, true, now(), auth.uid())
    ON CONFLICT (language, item_type, item_id) DO UPDATE
       SET patch = COALESCE(p_patch, public.parenting_content_overrides.draft, public.parenting_content_overrides.patch),
           draft = NULL, published = true, published_at = now(), updated_by = auth.uid(), updated_at = now()
    RETURNING * INTO v_row;
  END IF;

  IF v_row.id IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN jsonb_build_object(
    'item_type', v_row.item_type, 'item_id', v_row.item_id, 'patch', v_row.patch, 'draft', v_row.draft,
    'published', v_row.published, 'published_at', v_row.published_at, 'updated_at', v_row.updated_at
  );
END;
$function$;

-- Revert to the bundled text: the override row (live patch and draft) is removed.
CREATE OR REPLACE FUNCTION public.admin_parenting_override_revert_v1(p_language text, p_item_type text, p_item_id text)
RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.parenting_content_overrides
   WHERE language = p_language AND item_type = p_item_type AND item_id = p_item_id;
  RETURN FOUND;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_parenting_overrides_v1(text),
  public.admin_parenting_override_save_v1(text, text, text, jsonb, text),
  public.admin_parenting_override_revert_v1(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_parenting_overrides_v1(text),
  public.admin_parenting_override_save_v1(text, text, text, jsonb, text),
  public.admin_parenting_override_revert_v1(text, text, text) TO authenticated;

-- ── Ownership ──────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pgadmin') THEN
    EXECUTE 'ALTER TABLE public.parenting_state OWNER TO pgadmin';
    EXECUTE 'ALTER TABLE public.parenting_content_overrides OWNER TO pgadmin';
  END IF;
END $$;

-- ── CDC and writer-guard enrollment of the two new relations ───────────────────────────
INSERT INTO _anacan_gcp_migration.guarded_relations (schema_name, table_name, primary_key) VALUES
  ('public', 'parenting_state', ARRAY['user_id']),
  ('public', 'parenting_content_overrides', ARRAY['id'])
ON CONFLICT DO NOTHING;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['parenting_state', 'parenting_content_overrides'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS anacan_gcp_writer_guard ON public.%I', t);
    EXECUTE format('DROP TRIGGER IF EXISTS anacan_gcp_change ON public.%I', t);
    EXECUTE format('DROP TRIGGER IF EXISTS anacan_gcp_truncate ON public.%I', t);
    EXECUTE format('CREATE TRIGGER anacan_gcp_writer_guard BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION _anacan_gcp_migration.guard_write()', t);
    EXECUTE format('CREATE TRIGGER anacan_gcp_change AFTER INSERT OR DELETE OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION _anacan_gcp_migration.capture_change()', t);
    EXECUTE format('CREATE TRIGGER anacan_gcp_truncate AFTER TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION _anacan_gcp_migration.capture_change()', t);
  END LOOP;
  IF (SELECT count(*) FROM _anacan_gcp_migration.guarded_relations WHERE schema_name = 'public'
      AND table_name IN ('parenting_state', 'parenting_content_overrides')) <> 2
     OR (SELECT count(*) FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relname IN ('parenting_state', 'parenting_content_overrides')
           AND tg.tgname IN ('anacan_gcp_writer_guard', 'anacan_gcp_change', 'anacan_gcp_truncate')) <> 6 THEN
    RAISE EXCEPTION 'PARENTING_GUARD_ENROLLMENT_INCOMPLETE';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
