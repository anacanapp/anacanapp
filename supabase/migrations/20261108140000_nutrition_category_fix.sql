-- anacan-nutrition-category-fix (2026-11-08): data-only fix for the "nursing" meal type.
--
-- The nursing row (meal_id = 'nursing') was seeded with the snack category text in the wrong
-- column: time_range = 'Əlavə qida' ("supplementary food") instead of the "any time" label the
-- snack row uses ('İstənilən vaxt'). Some copies also carried that text as name_az. The app has
-- patched this on the client (src/components/tools/Nutrition.tsx); that patch stays as a
-- harmless fallback until this is applied everywhere.
--
-- Precise and idempotent: only the nursing row, and only while it still holds the bad text.
-- No schema, policy, grant or trigger change. meal_types must already be CDC/writer-guard
-- enrolled; the migration refuses otherwise.
--
-- Applied by /home/anacan-runner/run-sql.py (psql as supabase_admin, ON_ERROR_STOP).

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- ── The changed relation must already be guarded ───────────────────────────────
DO $$
BEGIN
  IF to_regclass('_anacan_gcp_migration.guarded_relations') IS NULL THEN
    RAISE EXCEPTION 'NUTRITION_GUARD_CATALOG_MISSING';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM _anacan_gcp_migration.guarded_relations
                 WHERE schema_name = 'public' AND table_name = 'meal_types')
     OR NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE n.nspname = 'public' AND c.relname = 'meal_types'
                      AND tg.tgname = 'anacan_gcp_writer_guard') THEN
    RAISE EXCEPTION 'NUTRITION_GUARD_ENROLLMENT_INCOMPLETE';
  END IF;
END $$;

-- ── Nursing row: category text out of time_range / name_az ─────────────────────
UPDATE public.meal_types
   SET time_range = 'İstənilən vaxt'
 WHERE meal_id = 'nursing'
   AND btrim(time_range) = 'Əlavə qida';

UPDATE public.meal_types
   SET name_az = 'Əmizdirmə'
 WHERE meal_id = 'nursing'
   AND btrim(name_az) = 'Əlavə qida';

COMMIT;
