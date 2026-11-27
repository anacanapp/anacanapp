-- Daily quiz tile (2026-11-13). No new relations.
--  * tool_configs row for the code tool 'daily-quiz' (stored is_active = false like the other code tools, so older
--    builds never show it; the current client lists code rows by id). Free, all three stages.
--  * The public read policy for code tool rows gains 'daily-quiz'.
--  * get_public_app_setting's allowlist gains 'daily_quiz' (the live definition is extended in place, so keys added
--    since the last migration are kept).
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

INSERT INTO public.tool_configs (tool_id, name, name_az, icon, life_stages, is_active, flow_active, bump_active, mommy_active,
                                 sort_order, flow_order, bump_order, mommy_order, is_premium, premium_type)
SELECT 'daily-quiz', 'Bilik Yarışı', 'Bilik Yarışı', 'Lightbulb', ARRAY['flow', 'bump', 'mommy'], false, true, true, true,
       5, 5, 5, 5, false, 'none'
 WHERE NOT EXISTS (SELECT 1 FROM public.tool_configs WHERE tool_id = 'daily-quiz');

DROP POLICY IF EXISTS "Anyone can view code tools" ON public.tool_configs;
CREATE POLICY "Anyone can view code tools" ON public.tool_configs FOR SELECT
  USING (tool_id = ANY (ARRAY['cakes','mini-games','baby-tracker','sleep-training','solid-food-guide','parenting','play-together','daily-quiz']));

DO $$
DECLARE def text;
BEGIN
  def := pg_get_functiondef('public.get_public_app_setting(text)'::regprocedure);
  IF position('''daily_quiz''' IN def) = 0 THEN
    IF position(']::text[]' IN def) = 0 THEN RAISE EXCEPTION 'PUBLIC_SETTING_ALLOWLIST_SHAPE_CHANGED'; END IF;
    def := regexp_replace(def, '\]::text\[\]', ', ''daily_quiz'']::text[]');
    EXECUTE def;
  END IF;
  IF position('''daily_quiz''' IN pg_get_functiondef('public.get_public_app_setting(text)'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'PUBLIC_SETTING_ALLOWLIST_NOT_EXTENDED';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
