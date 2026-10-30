-- Duzelis70 (2026-10-30): partner notification choices.
--
--   * user_preferences gains push_partner_thanks, push_partner_shopping and
--     push_partner_contractions (default true). push_messages already exists.
--   * The push service (send-push-notification) asks claim_communication_notification_v2
--     before every send and sends nothing when it returns false. The existing function is
--     kept as claim_communication_notification_core_v2; the new wrapper with the same
--     signature still claims the interaction and writes the in-app notification, then
--     returns false when the target turned that partner type off. SOS and birth alerts
--     are never filtered.
--   * user_preferences is already CDC/writer guarded; the migration refuses otherwise.
--
-- Applied once on Google (psql as supabase_admin, one transaction). No new relation, cron or timer.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM _anacan_gcp_migration.guarded_relations WHERE schema_name = 'public' AND table_name = 'user_preferences')
     OR NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE n.nspname = 'public' AND c.relname = 'user_preferences' AND tg.tgname = 'anacan_gcp_writer_guard') THEN
    RAISE EXCEPTION 'PARTNER_PREFS_GUARD_ENROLLMENT_INCOMPLETE';
  END IF;
END $$;

ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS push_partner_thanks boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS push_partner_shopping boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS push_partner_contractions boolean NOT NULL DEFAULT true;

DO $$
BEGIN
  IF to_regprocedure('public.claim_communication_notification_core_v2(uuid,uuid,text,text,text,jsonb)') IS NULL THEN
    ALTER FUNCTION public.claim_communication_notification_v2(uuid, uuid, text, text, text, jsonb)
      RENAME TO claim_communication_notification_core_v2;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.claim_communication_notification_v2(p_interaction_id uuid, p_target_user_id uuid, p_kind text, p_title text, p_body text, p_data jsonb)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE claimed boolean; wanted boolean;
BEGIN
  claimed := public.claim_communication_notification_core_v2(p_interaction_id, p_target_user_id, p_kind, p_title, p_body, p_data);
  -- Only after a real claim (in-app notification written): skip the push for a partner type the target turned off.
  IF claimed IS NOT TRUE OR p_kind NOT IN ('thank_you', 'shopping_list', 'contraction_511') THEN RETURN claimed; END IF;
  SELECT CASE p_kind WHEN 'thank_you' THEN p.push_partner_thanks WHEN 'shopping_list' THEN p.push_partner_shopping
                     ELSE p.push_partner_contractions END
    INTO wanted FROM public.user_preferences p WHERE p.user_id = p_target_user_id;
  RETURN coalesce(wanted, true);
END $$;

ALTER FUNCTION public.claim_communication_notification_v2(uuid, uuid, text, text, text, jsonb) OWNER TO pgadmin;
REVOKE ALL ON FUNCTION public.claim_communication_notification_v2(uuid, uuid, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_communication_notification_core_v2(uuid, uuid, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_communication_notification_v2(uuid, uuid, text, text, text, jsonb) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
