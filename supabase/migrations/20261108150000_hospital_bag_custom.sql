-- Hospital bag: own items, hidden default items and live partner sync (2026-11-08).
--
--   * hospital_bag_items gains is_hidden (boolean, NOT NULL, default false). Default items (item_id = the
--     hospital_bag_templates id) are hidden or shown again instead of being deleted.
--   * The category check accepts 'partner' next to 'mom' / 'baby' / 'documents' (items for the partner).
--     Own items use item_id 'custom:<category>:<uuid>'; older partner items keep 'partner-<ms>'.
--   * Partners get a DELETE policy limited to own items (custom: / partner- ids) of the linked mother, with
--     the same IN-based partner match as 20260813150038_hospital_bag_partner_rls_fix.sql. The owner's
--     policies (own rows, all commands) and the partner SELECT / INSERT / UPDATE policies are unchanged.
--   * hospital_bag_items is added to the supabase_realtime publication when the publication exists and the
--     table is not in it yet, so the partner's phone sees changes live.
--
-- The app tolerates this migration missing: hidden default items are then remembered on the device and a
-- 'partner' item is stored with category 'mom' (its id still says 'partner').
--
-- Applied by /home/anacan-runner/run-sql.py (psql as supabase_admin, ON_ERROR_STOP, one transaction).
-- No new relation. hospital_bag_items must already be enrolled in CDC and writer guarding with all three
-- standard triggers (the migration refuses otherwise and does not drop or recreate them); the new column
-- is captured by the existing row trigger. No cron or timer. Not applied yet.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

DO $$
BEGIN
  IF to_regclass('_anacan_gcp_migration.guarded_relations') IS NULL THEN
    RAISE EXCEPTION 'HOSPITAL_BAG_GUARD_CATALOG_MISSING';
  END IF;
  IF to_regclass('public.hospital_bag_items') IS NULL OR to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'HOSPITAL_BAG_BASE_MISSING';
  END IF;
  IF (SELECT count(*) FROM _anacan_gcp_migration.guarded_relations
       WHERE schema_name = 'public' AND table_name = 'hospital_bag_items') <> 1
     OR (SELECT count(*) FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relname = 'hospital_bag_items' AND NOT tg.tgisinternal
            AND tg.tgname IN ('anacan_gcp_writer_guard', 'anacan_gcp_change', 'anacan_gcp_truncate')) <> 3 THEN
    RAISE EXCEPTION 'HOSPITAL_BAG_EXISTING_ENROLLMENT_INCOMPLETE';
  END IF;
END $$;

-- ── Hidden default items ───────────────────────────────────────────────────────────────
ALTER TABLE public.hospital_bag_items
  ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.hospital_bag_items.is_hidden IS 'Default item hidden by the user (shown again from the hidden list); own items are deleted instead';

-- ── Category 'partner' ─────────────────────────────────────────────────────────────────
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT con.conname
      FROM pg_constraint con
     WHERE con.conrelid = 'public.hospital_bag_items'::regclass
       AND con.contype = 'c'
       AND pg_get_constraintdef(con.oid) ILIKE '%category%'
  LOOP
    EXECUTE format('ALTER TABLE public.hospital_bag_items DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE public.hospital_bag_items
  ADD CONSTRAINT hospital_bag_items_category_check
  CHECK (category IN ('mom', 'baby', 'documents', 'partner'));

-- ── Partner may delete own items of the linked mother ──────────────────────────────────
DROP POLICY IF EXISTS "Partners can delete custom hospital bag items" ON public.hospital_bag_items;
CREATE POLICY "Partners can delete custom hospital bag items"
ON public.hospital_bag_items FOR DELETE
USING (
  (item_id LIKE 'custom:%' OR item_id LIKE 'partner-%')
  AND user_id IN (
    SELECT p.user_id FROM public.profiles p
    JOIN public.profiles me ON me.user_id = auth.uid()
    WHERE p.linked_partner_id = me.id
  )
);

-- ── Realtime ───────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables
                      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'hospital_bag_items') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.hospital_bag_items';
  END IF;
END $$;

-- ── Enrollment unchanged ───────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF (SELECT count(*) FROM _anacan_gcp_migration.guarded_relations
       WHERE schema_name = 'public' AND table_name = 'hospital_bag_items') <> 1
     OR (SELECT count(*) FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relname = 'hospital_bag_items' AND NOT tg.tgisinternal
            AND tg.tgname IN ('anacan_gcp_writer_guard', 'anacan_gcp_change', 'anacan_gcp_truncate')) <> 3 THEN
    RAISE EXCEPTION 'HOSPITAL_BAG_GUARD_ENROLLMENT_INCOMPLETE';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
