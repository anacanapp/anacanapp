-- Duzelis71 (2026-10-31): "Körpəmdən mesajlar" AI replies (server function baby-chat-reply).
--
--   * usage_tracking.feature_type also allows 'baby_chat_ai' (per-user daily AI reply count);
--   * app_settings 'baby_chat_ai' = {"enabled": false, "daily_limit": 20}: the kill switch, OFF until an
--     admin turns it on in Admin → Premium → limits. Off means curated replies only.
--   * Both relations are already CDC/writer guarded; the migration refuses otherwise. No new relation.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
BEGIN
  IF (SELECT count(*) FROM _anacan_gcp_migration.guarded_relations
      WHERE schema_name = 'public' AND table_name IN ('usage_tracking', 'app_settings')) <> 2
     OR (SELECT count(DISTINCT c.relname) FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND tg.tgname = 'anacan_gcp_writer_guard'
           AND c.relname IN ('usage_tracking', 'app_settings')) <> 2 THEN
    RAISE EXCEPTION 'BABY_CHAT_AI_GUARD_ENROLLMENT_INCOMPLETE';
  END IF;
END $$;

ALTER TABLE public.usage_tracking DROP CONSTRAINT IF EXISTS usage_tracking_feature_type_check;
ALTER TABLE public.usage_tracking ADD CONSTRAINT usage_tracking_feature_type_check CHECK (feature_type = ANY (ARRAY[
  'white_noise', 'baby_photoshoot', 'ai_chat', 'cry_translator', 'poop_scanner', 'fairy_tale', 'horoscope', 'baby_insight',
  'baby_chat_ai']));

INSERT INTO public.app_settings (key, value, description)
SELECT 'baby_chat_ai', '{"enabled": false, "daily_limit": 20}'::jsonb,
       'Körpəmdən mesajlar: AI replies on/off and daily limit per user'
WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'baby_chat_ai');

COMMIT;
