-- Second-hand market safety (App Store 1.2) and the mother's height (2026-11-08).
--
--   * market_reports: a user reports a listing, a user, or a conversation (reason + optional note).
--     RLS: the reporter inserts her own pending row and reads her own rows; admins
--     (has_role(auth.uid(), 'admin')) read and update every row. A BEFORE INSERT trigger
--     (SECURITY DEFINER) fixes the reporter to auth.uid(), checks that a reported conversation really
--     exists between the two users, fills the listing owner for a listing report and stores a small
--     evidence snapshot (listing text, or the last 30 messages of that conversation), because admins
--     cannot read marketplace_messages directly.
--     post_reports (community) is not reused: its post_id is NOT NULL with a foreign key to community_posts.
--   * market_blocks: one row per (blocker, blocked). RLS: own rows only. The app hides the blocked
--     user's listings and messages for the blocker. user_blocks is not reused: it holds admin bans.
--   * marketplace_messages gains a BEFORE INSERT trigger: a message is refused (MARKET_BLOCKED, 42501)
--     when either side has blocked the other, and (MARKET_MESSAGE_TARGET_INVALID) unless the sender or
--     the receiver owns the listing. Existing policies are unchanged.
--   * profiles gains height_cm (numeric, nullable, 120-220) for the pregnancy weight tracker; the app keeps
--     the device copy as a fallback and uploads an existing device value once.
--
-- Applied by /home/anacan-runner/run-sql.py (psql as supabase_admin, ON_ERROR_STOP, one transaction).
-- The two new relations are enrolled in CDC and writer guarding here; profiles and marketplace_messages
-- must already be enrolled with all three standard triggers (the migration refuses otherwise and does not
-- drop or recreate their triggers). No cron or timer. Not applied yet.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

DO $$
DECLARE t text;
BEGIN
  IF to_regclass('_anacan_gcp_migration.guarded_relations') IS NULL THEN
    RAISE EXCEPTION 'MARKET_SAFETY_GUARD_CATALOG_MISSING';
  END IF;
  IF to_regprocedure('public.has_role(uuid, public.app_role)') IS NULL THEN
    RAISE EXCEPTION 'MARKET_SAFETY_HAS_ROLE_MISSING';
  END IF;
  IF to_regclass('public.marketplace_listings') IS NULL OR to_regclass('public.marketplace_messages') IS NULL
     OR to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'MARKET_SAFETY_BASE_MISSING';
  END IF;
  FOREACH t IN ARRAY ARRAY['profiles', 'marketplace_messages'] LOOP
    IF (SELECT count(*) FROM _anacan_gcp_migration.guarded_relations
         WHERE schema_name = 'public' AND table_name = t) <> 1
       OR (SELECT count(*) FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relname = t AND NOT tg.tgisinternal
              AND tg.tgname IN ('anacan_gcp_writer_guard', 'anacan_gcp_change', 'anacan_gcp_truncate')) <> 3 THEN
      RAISE EXCEPTION 'MARKET_SAFETY_EXISTING_ENROLLMENT_INCOMPLETE: %', t;
    END IF;
  END LOOP;
END $$;

-- ── Reports ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.market_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('listing', 'user', 'conversation')),
  listing_id uuid,
  reported_user_id uuid,
  reason text NOT NULL CHECK (reason IN ('spam', 'scam', 'inappropriate', 'harassment', 'prohibited', 'other')),
  note text CHECK (note IS NULL OR char_length(note) <= 500),
  evidence jsonb CHECK (evidence IS NULL OR (jsonb_typeof(evidence) = 'object' AND octet_length(evidence::text) <= 65536)),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  admin_note text CHECK (admin_note IS NULL OR char_length(admin_note) <= 1000),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (target_type <> 'listing' OR listing_id IS NOT NULL),
  CHECK (target_type <> 'user' OR reported_user_id IS NOT NULL),
  CHECK (target_type <> 'conversation' OR (listing_id IS NOT NULL AND reported_user_id IS NOT NULL)),
  CHECK (reported_user_id IS NULL OR reported_user_id <> reporter_id)
);
-- One open report per reporter and target (a second tap is answered as "already reported").
CREATE UNIQUE INDEX IF NOT EXISTS market_reports_one_pending_idx
  ON public.market_reports (reporter_id, target_type,
    COALESCE(listing_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(reported_user_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS market_reports_status_created_idx ON public.market_reports (status, created_at DESC);

ALTER TABLE public.market_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.market_reports FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON public.market_reports TO authenticated;
GRANT ALL ON public.market_reports TO service_role;
DROP POLICY IF EXISTS market_reports_insert_own ON public.market_reports;
CREATE POLICY market_reports_insert_own ON public.market_reports
  FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid() AND status = 'pending' AND reviewed_by IS NULL AND reviewed_at IS NULL AND admin_note IS NULL);
DROP POLICY IF EXISTS market_reports_read_own ON public.market_reports;
CREATE POLICY market_reports_read_own ON public.market_reports
  FOR SELECT TO authenticated
  USING (reporter_id = auth.uid());
DROP POLICY IF EXISTS market_reports_admin_read ON public.market_reports;
CREATE POLICY market_reports_admin_read ON public.market_reports
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS market_reports_admin_update ON public.market_reports;
CREATE POLICY market_reports_admin_update ON public.market_reports
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.market_report_prepare()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_owner uuid;
  v_listing jsonb;
  v_messages jsonb;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.reporter_id := auth.uid();
  END IF;
  NEW.status := 'pending';
  NEW.reviewed_by := NULL;
  NEW.reviewed_at := NULL;
  NEW.admin_note := NULL;
  NEW.created_at := now();
  NEW.note := NULLIF(btrim(NEW.note), '');

  IF NEW.listing_id IS NOT NULL THEN
    SELECT l.user_id, jsonb_build_object('title', l.title, 'description', left(l.description, 2000),
             'status', l.status, 'images', to_jsonb(l.images), 'owner', l.user_id)
      INTO v_owner, v_listing
      FROM public.marketplace_listings l WHERE l.id = NEW.listing_id;
    IF v_owner IS NULL THEN
      RAISE EXCEPTION 'MARKET_REPORT_LISTING_MISSING' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF NEW.target_type = 'listing' THEN
    NEW.reported_user_id := v_owner;
    NEW.evidence := jsonb_build_object('listing', v_listing);
  ELSIF NEW.target_type = 'conversation' THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object('sender_id', m.sender_id, 'content', left(m.content, 1000),
             'created_at', m.created_at) ORDER BY m.created_at), '[]'::jsonb)
      INTO v_messages
      FROM (SELECT * FROM public.marketplace_messages mm
             WHERE mm.listing_id = NEW.listing_id
               AND ((mm.sender_id = NEW.reporter_id AND mm.receiver_id = NEW.reported_user_id)
                 OR (mm.sender_id = NEW.reported_user_id AND mm.receiver_id = NEW.reporter_id))
             ORDER BY mm.created_at DESC LIMIT 30) m;
    IF jsonb_array_length(v_messages) = 0 THEN
      RAISE EXCEPTION 'MARKET_REPORT_CONVERSATION_MISSING' USING ERRCODE = '22023';
    END IF;
    NEW.evidence := jsonb_build_object('listing', v_listing, 'messages', v_messages);
  ELSE
    NEW.evidence := CASE WHEN v_listing IS NULL THEN NULL ELSE jsonb_build_object('listing', v_listing) END;
  END IF;

  IF NEW.reported_user_id IS NOT NULL AND NEW.reported_user_id = NEW.reporter_id THEN
    RAISE EXCEPTION 'MARKET_REPORT_SELF' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS market_reports_prepare ON public.market_reports;
CREATE TRIGGER market_reports_prepare BEFORE INSERT ON public.market_reports
  FOR EACH ROW EXECUTE FUNCTION public.market_report_prepare();

-- ── Blocks (own rows only) ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.market_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
CREATE INDEX IF NOT EXISTS market_blocks_blocked_idx ON public.market_blocks (blocked_id, blocker_id);

ALTER TABLE public.market_blocks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.market_blocks FROM PUBLIC, anon;
GRANT SELECT, INSERT, DELETE ON public.market_blocks TO authenticated;
GRANT ALL ON public.market_blocks TO service_role;
DROP POLICY IF EXISTS market_blocks_own ON public.market_blocks;
CREATE POLICY market_blocks_own ON public.market_blocks
  FOR ALL TO authenticated
  USING (blocker_id = auth.uid())
  WITH CHECK (blocker_id = auth.uid());
DROP POLICY IF EXISTS market_blocks_admin_read ON public.market_blocks;
CREATE POLICY market_blocks_admin_read ON public.market_blocks
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ── Server-side message guard (blocks either way; only to or from the listing owner) ──
CREATE OR REPLACE FUNCTION public.market_message_guard()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF EXISTS (SELECT 1 FROM public.market_blocks b
              WHERE (b.blocker_id = NEW.receiver_id AND b.blocked_id = NEW.sender_id)
                 OR (b.blocker_id = NEW.sender_id AND b.blocked_id = NEW.receiver_id)) THEN
    RAISE EXCEPTION 'MARKET_BLOCKED' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.marketplace_listings l
                  WHERE l.id = NEW.listing_id AND (l.user_id = NEW.receiver_id OR l.user_id = NEW.sender_id)) THEN
    RAISE EXCEPTION 'MARKET_MESSAGE_TARGET_INVALID' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS market_messages_block_guard ON public.marketplace_messages;
CREATE TRIGGER market_messages_block_guard BEFORE INSERT ON public.marketplace_messages
  FOR EACH ROW EXECUTE FUNCTION public.market_message_guard();

REVOKE ALL ON FUNCTION public.market_report_prepare(), public.market_message_guard() FROM PUBLIC, anon, authenticated;

-- ── Mother's height (pregnancy weight tracker) ─────────────────────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS height_cm numeric(5,1)
  CHECK (height_cm IS NULL OR (height_cm >= 120 AND height_cm <= 220));
COMMENT ON COLUMN public.profiles.height_cm IS 'Mother''s height in cm (120-220) for the IOM pre-pregnancy BMI range in the weight tracker; NULL = not asked yet.';

-- ── Ownership ──────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pgadmin') THEN
    EXECUTE 'ALTER TABLE public.market_reports OWNER TO pgadmin';
    EXECUTE 'ALTER TABLE public.market_blocks OWNER TO pgadmin';
    EXECUTE 'ALTER FUNCTION public.market_report_prepare() OWNER TO pgadmin';
    EXECUTE 'ALTER FUNCTION public.market_message_guard() OWNER TO pgadmin';
  END IF;
END $$;

-- ── CDC and writer-guard enrollment of the two new relations ───────────────────────────
INSERT INTO _anacan_gcp_migration.guarded_relations (schema_name, table_name, primary_key) VALUES
  ('public', 'market_reports', ARRAY['id']),
  ('public', 'market_blocks', ARRAY['id'])
ON CONFLICT DO NOTHING;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['market_reports', 'market_blocks'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS anacan_gcp_writer_guard ON public.%I', t);
    EXECUTE format('DROP TRIGGER IF EXISTS anacan_gcp_change ON public.%I', t);
    EXECUTE format('DROP TRIGGER IF EXISTS anacan_gcp_truncate ON public.%I', t);
    EXECUTE format('CREATE TRIGGER anacan_gcp_writer_guard BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION _anacan_gcp_migration.guard_write()', t);
    EXECUTE format('CREATE TRIGGER anacan_gcp_change AFTER INSERT OR DELETE OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION _anacan_gcp_migration.capture_change()', t);
    EXECUTE format('CREATE TRIGGER anacan_gcp_truncate AFTER TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION _anacan_gcp_migration.capture_change()', t);
  END LOOP;
  IF (SELECT count(*) FROM _anacan_gcp_migration.guarded_relations WHERE schema_name = 'public'
      AND table_name IN ('market_reports', 'market_blocks')) <> 2
     OR (SELECT count(*) FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relname IN ('market_reports', 'market_blocks')
           AND tg.tgname IN ('anacan_gcp_writer_guard', 'anacan_gcp_change', 'anacan_gcp_truncate')) <> 6
     OR (SELECT count(*) FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relname IN ('profiles', 'marketplace_messages') AND NOT tg.tgisinternal
           AND tg.tgname IN ('anacan_gcp_writer_guard', 'anacan_gcp_change', 'anacan_gcp_truncate')) <> 6 THEN
    RAISE EXCEPTION 'MARKET_SAFETY_GUARD_ENROLLMENT_INCOMPLETE';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
