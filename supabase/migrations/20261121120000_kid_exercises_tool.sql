-- Uşaq məşqləri (2026-11-21): 141 illustrated movement exercises from birth to 5 years, 25 app languages.
-- A code tool (src/lib/code-tools.ts): name, content and visibility live in the app (Ana module). The app shows the
-- tile even before this row exists; the row only lets the admin order it, switch it per stage and make it Premium
-- in Admin → Alət sıralaması. Stored with is_active = false ON PURPOSE, like the other code tools, so older native
-- builds (which read only is_active rows and do not know this tool) never show it. Progress stays on the phone.
-- tool_configs is already a guarded relation (CDC + writer guard); this adds one row and widens the read policy.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
BEGIN
  IF (SELECT count(*) FROM _anacan_gcp_migration.guarded_relations WHERE schema_name = 'public' AND table_name = 'tool_configs') <> 1 THEN
    RAISE EXCEPTION 'KID_EXERCISES_TOOL_GUARD_MISSING';
  END IF;
END $$;

INSERT INTO public.tool_configs (tool_id, name, name_az, icon, life_stages, is_active, flow_active, bump_active, mommy_active,
                                 sort_order, flow_order, bump_order, mommy_order, is_premium, premium_type)
SELECT 'kid-exercises', 'Uşaq məşqləri', 'Uşaq məşqləri', 'PersonStanding', ARRAY['mommy']::text[], false, false, false, true,
       936, 936, 936, 936, false, 'none'
 WHERE NOT EXISTS (SELECT 1 FROM public.tool_configs WHERE tool_id = 'kid-exercises');

DROP POLICY IF EXISTS "Anyone can view code tools" ON public.tool_configs;
CREATE POLICY "Anyone can view code tools" ON public.tool_configs FOR SELECT
  USING (tool_id = ANY (ARRAY['cakes','mini-games','baby-tracker','sleep-training','solid-food-guide','parenting','play-together','kid-exercises']));

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.tool_configs WHERE tool_id = 'kid-exercises' AND NOT is_active AND mommy_active) THEN
    RAISE EXCEPTION 'KID_EXERCISES_ROW_INVALID';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
