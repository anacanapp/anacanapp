-- Code tools in Admin → Alət sıralaması (2026-11-09).
-- Tortlar, Mini oyunlar, Körpə izləyicisi, Yuxu təlimi, Əlavə qida bələdçisi and Tərbiyə are tiles the app adds in
-- code (their name, text and access rules live in code, src/lib/code-tools.ts). They get a tool_configs row so the
-- admin can order them and switch them per stage like every other tool.
-- Rows are stored with is_active = false ON PURPOSE: older native builds read only is_active rows and add these
-- tiles themselves, so they never show a duplicate. New builds read these rows by tool_id and use the stage flags.
-- Initial order keeps today's app layout: Tortlar and Mini oyunlar first, the others last.
-- Data only; tool_configs is already a guarded relation (CDC + writer guard), so this runs through run-sql.py.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
BEGIN
  IF (SELECT count(*) FROM _anacan_gcp_migration.guarded_relations WHERE schema_name = 'public' AND table_name = 'tool_configs') <> 1 THEN
    RAISE EXCEPTION 'CODE_TOOL_ROWS_GUARD_MISSING';
  END IF;
END $$;

INSERT INTO public.tool_configs (tool_id, name, name_az, icon, life_stages, is_active, flow_active, bump_active, mommy_active,
                                 sort_order, flow_order, bump_order, mommy_order, is_premium, premium_type)
SELECT v.tool_id, v.name, v.name, v.icon, v.stages, false, v.fa, v.ba, v.ma, v.ord, v.ord, v.ord, v.ord, false, 'none'
  FROM (VALUES
    ('cakes',            'Tortlar',               'Cake',           ARRAY['bump','mommy']::text[],        false, true,  true,  -20),
    ('mini-games',       'Mini oyunlar',          'Gamepad2',       ARRAY['flow','bump','mommy']::text[], true,  true,  true,  -10),
    ('baby-tracker',     'Körpə izləyicisi',      'Baby',           ARRAY['mommy']::text[],               false, false, true,  900),
    ('sleep-training',   'Yuxu təlimi',           'MoonStar',       ARRAY['mommy']::text[],               false, false, true,  910),
    ('solid-food-guide', 'Əlavə qida bələdçisi',  'Salad',          ARRAY['mommy']::text[],               false, false, true,  920),
    ('parenting',        'Tərbiyə',               'HeartHandshake', ARRAY['mommy']::text[],               false, false, true,  930)
  ) AS v(tool_id, name, icon, stages, fa, ba, ma, ord)
 WHERE NOT EXISTS (SELECT 1 FROM public.tool_configs t WHERE t.tool_id = v.tool_id);

DO $$
BEGIN
  IF (SELECT count(*) FROM public.tool_configs
       WHERE tool_id IN ('cakes','mini-games','baby-tracker','sleep-training','solid-food-guide','parenting')) <> 6 THEN
    RAISE EXCEPTION 'CODE_TOOL_ROWS_INCOMPLETE';
  END IF;
  IF EXISTS (SELECT 1 FROM public.tool_configs
              WHERE tool_id IN ('cakes','mini-games','baby-tracker','sleep-training','solid-food-guide','parenting') AND is_active) THEN
    RAISE EXCEPTION 'CODE_TOOL_ROWS_MUST_STAY_INACTIVE_FOR_OLD_BUILDS';
  END IF;
END $$;

COMMIT;
