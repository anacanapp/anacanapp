-- Server stories (owner request 2026-11-12): admins add, change or hide dashboard stories without an app update.
--   * app_stories: one row per story. story = the same StoryJson the app bundles (src/data/stories/az.ts), validated
--     again on the device (src/lib/server-stories.ts). action 'show' adds a story or replaces the bundled one with the
--     same id; action 'hide' hides the bundled story with that id. audience 'test' = admins only, 'all' = everyone who
--     already sees stories (app_settings.dashboard_stories). Optional starts_at / ends_at window.
--   * get_app_stories_v1(p_language): what the calling app should merge, already filtered by window and audience.
--     Builds that predate this migration never call it and keep their bundled stories.
-- Statistics need nothing new: admin_story_stats_v1 counts by story id, server stories included.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

CREATE TABLE IF NOT EXISTS public.app_stories (
  id text PRIMARY KEY CHECK (id ~ '^[a-z0-9][a-z0-9-]{1,63}$'),
  language text NOT NULL DEFAULT 'az' CHECK (language ~ '^[a-z]{2}$'),
  action text NOT NULL DEFAULT 'show' CHECK (action IN ('show', 'hide')),
  story jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(story) = 'object' AND octet_length(story::text) <= 100000),
  audience text NOT NULL DEFAULT 'test' CHECK (audience IN ('test', 'all')),
  enabled boolean NOT NULL DEFAULT false,
  starts_at timestamptz,
  ends_at timestamptz,
  sort_order int NOT NULL DEFAULT 0,
  note text CHECK (note IS NULL OR length(note) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CHECK (action = 'hide' OR (story ? 'slides' AND jsonb_typeof(story->'slides') = 'array'
                              AND jsonb_array_length(story->'slides') BETWEEN 1 AND 20)),
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);
ALTER TABLE public.app_stories ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_stories FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_stories TO authenticated;
GRANT ALL ON public.app_stories TO service_role;
DROP POLICY IF EXISTS app_stories_admin ON public.app_stories;
CREATE POLICY app_stories_admin ON public.app_stories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
ALTER TABLE public.app_stories OWNER TO pgadmin;

CREATE OR REPLACE FUNCTION public.app_stories_touch_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := coalesce(auth.uid(), NEW.updated_by);
  RETURN NEW;
END $$;
ALTER FUNCTION public.app_stories_touch_v1() OWNER TO pgadmin;
DROP TRIGGER IF EXISTS app_stories_touch ON public.app_stories;
CREATE TRIGGER app_stories_touch BEFORE INSERT OR UPDATE ON public.app_stories
  FOR EACH ROW EXECUTE FUNCTION public.app_stories_touch_v1();

-- Stories for the calling app: enabled, inside their window, for everyone or (test) for admins.
CREATE OR REPLACE FUNCTION public.get_app_stories_v1(p_language text DEFAULT 'az')
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'action', s.action, 'story', s.story, 'sort', s.sort_order,
                                               'updated_at', s.updated_at)
                            ORDER BY s.sort_order DESC, s.updated_at DESC), '[]'::jsonb)
  FROM public.app_stories s
  WHERE auth.uid() IS NOT NULL
    AND s.enabled
    AND s.language = lower(left(coalesce(p_language, 'az'), 2))
    AND (s.starts_at IS NULL OR s.starts_at <= now())
    AND (s.ends_at IS NULL OR s.ends_at > now())
    AND (s.audience = 'all' OR public.has_role(auth.uid(), 'admin'::public.app_role))
$$;
ALTER FUNCTION public.get_app_stories_v1(text) OWNER TO pgadmin;
REVOKE ALL ON FUNCTION public.get_app_stories_v1(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_app_stories_v1(text) TO authenticated, service_role;

-- CDC/writer guard for the new relation (same contract as Duzelis73).
DO $$
BEGIN
  INSERT INTO _anacan_gcp_migration.guarded_relations(schema_name, table_name, primary_key)
  VALUES ('public', 'app_stories', ARRAY['id']) ON CONFLICT DO NOTHING;
  DROP TRIGGER IF EXISTS anacan_gcp_writer_guard ON public.app_stories;
  DROP TRIGGER IF EXISTS anacan_gcp_change ON public.app_stories;
  DROP TRIGGER IF EXISTS anacan_gcp_truncate ON public.app_stories;
  CREATE TRIGGER anacan_gcp_writer_guard BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON public.app_stories FOR EACH STATEMENT EXECUTE FUNCTION _anacan_gcp_migration.guard_write();
  CREATE TRIGGER anacan_gcp_change AFTER INSERT OR DELETE OR UPDATE ON public.app_stories FOR EACH ROW EXECUTE FUNCTION _anacan_gcp_migration.capture_change();
  CREATE TRIGGER anacan_gcp_truncate AFTER TRUNCATE ON public.app_stories FOR EACH STATEMENT EXECUTE FUNCTION _anacan_gcp_migration.capture_change();
  IF (SELECT count(*) FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = 'app_stories'
         AND tg.tgname IN ('anacan_gcp_writer_guard', 'anacan_gcp_change', 'anacan_gcp_truncate')) <> 3 THEN
    RAISE EXCEPTION 'APP_STORIES_GUARD_INCOMPLETE';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
