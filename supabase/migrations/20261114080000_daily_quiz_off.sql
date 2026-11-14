-- Owner 2026-11-14: switch Gündəlik Bilik Yarışı off and take it out of the app (code removed in the same commit).
--  * app_settings.daily_quiz.enabled = false, so daily_quiz_state_v1 reports it unavailable (admins included once no
--    client calls it); the tool_configs row 'daily-quiz' is deleted and the code-tool read policy no longer lists it.
--  * quiz_questions (300 Azerbaijani questions) and quiz_attempts stay in the database untouched, so the quiz can be
--    restored later from git (20261113200000-250000 migrations and the removed client code).
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

UPDATE public.app_settings SET value = jsonb_set(value, '{enabled}', 'false'::jsonb), updated_at = now()
 WHERE key = 'daily_quiz' AND jsonb_typeof(value) = 'object';

DELETE FROM public.tool_configs WHERE tool_id = 'daily-quiz';

DROP POLICY IF EXISTS "Anyone can view code tools" ON public.tool_configs;
CREATE POLICY "Anyone can view code tools" ON public.tool_configs FOR SELECT
  USING (tool_id = ANY (ARRAY['cakes','mini-games','baby-tracker','sleep-training','solid-food-guide','parenting','play-together']));

NOTIFY pgrst, 'reload schema';
COMMIT;
