-- Uşaqla oyun (2026-11-12): screen-free parent-child games, 6 months to 8 years, with Anacan PDF book links.
-- A code tool (src/lib/code-tools.ts): name, content and visibility live in the app (Ana module, Azerbaijani only).
-- This row only lets the admin order it and switch it per stage in Admin → Alət sıralaması. It is stored with
-- is_active = false ON PURPOSE, like the other code tools: older native builds read only is_active rows and do not
-- know this tool, so they never show it. Progress stays on the phone (no new relation).
-- Data only; tool_configs is already a guarded relation (CDC + writer guard). Applied with run-sql.py.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
BEGIN
  IF (SELECT count(*) FROM _anacan_gcp_migration.guarded_relations WHERE schema_name = 'public' AND table_name = 'tool_configs') <> 1 THEN
    RAISE EXCEPTION 'PLAY_TOGETHER_TOOL_GUARD_MISSING';
  END IF;
END $$;

INSERT INTO public.tool_configs (tool_id, name, name_az, icon, life_stages, is_active, flow_active, bump_active, mommy_active,
                                 sort_order, flow_order, bump_order, mommy_order, is_premium, premium_type)
SELECT 'play-together', 'Uşaqla oyun', 'Uşaqla oyun', 'Puzzle', ARRAY['mommy']::text[], false, false, false, true,
       935, 935, 935, 935, false, 'none'
 WHERE NOT EXISTS (SELECT 1 FROM public.tool_configs WHERE tool_id = 'play-together');

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.tool_configs WHERE tool_id = 'play-together' AND NOT is_active AND mommy_active) THEN
    RAISE EXCEPTION 'PLAY_TOGETHER_ROW_INVALID';
  END IF;
END $$;

COMMIT;
