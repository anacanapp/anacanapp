-- Duzelis74 (2026-10-31): e-mail verification code for e-mail/password sign-ups, and web Premium linking for
-- accounts whose e-mail was verified this way.
--
--   * Email sign-up is auto-confirmed by Auth (mailer_autoconfirm), so the e-mail address is not proven.
--     New e-mail/password accounts (no Google/Apple identity) created after the switch is turned on must enter
--     a 6-digit code sent to their e-mail before onboarding. Older accounts are never asked.
--   * email_verifications: one row per user (current e-mail, code hash, expiry, attempts, send counters,
--     verified_at). RLS on, no client access; the email-verification function writes it with service_role.
--   * email_verification_state_v1(): for the signed-in user — {required, verified, email}.
--   * app_settings.email_verification = {"enabled": false, "required_since": null} is the switch. Turning it on
--     sets required_since; only accounts created after it are asked.
--   * web_subscription_link_user_v1 / web_subscription_link_email_v1 (Duzelis73) also accept an e-mail verified
--     with this code, so Premium bought on anacan.az attaches once the same e-mail is verified in the app.
--   * New relation email_verifications is CDC/writer guarded below. No cron or timer.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

CREATE TABLE IF NOT EXISTS public.email_verifications (
  user_id uuid PRIMARY KEY,
  email text NOT NULL CHECK (email = lower(email)),
  code_hash text,
  code_expires_at timestamptz,
  attempts smallint NOT NULL DEFAULT 0,
  sends_in_window smallint NOT NULL DEFAULT 0,
  window_started_at timestamptz,
  last_sent_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.email_verifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_verifications FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.email_verifications TO service_role;
ALTER TABLE public.email_verifications OWNER TO pgadmin;

INSERT INTO public.app_settings (key, value, description)
SELECT 'email_verification', '{"enabled": false, "required_since": null}'::jsonb,
       'E-mail code for new e-mail/password sign-ups (on: accounts created after required_since)'
WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'email_verification');

-- Whether the signed-in user must verify her e-mail now.
CREATE OR REPLACE FUNCTION public.email_verification_state_v1()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  setting jsonb;
  since timestamptz;
  account record;
  social boolean;
  verified timestamptz;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;
  SELECT u.email, u.created_at INTO account FROM auth.users u WHERE u.id = me;
  SELECT v.verified_at INTO verified FROM public.email_verifications v
   WHERE v.user_id = me AND v.email = lower(coalesce(account.email, ''));
  SELECT value INTO setting FROM public.app_settings WHERE key = 'email_verification';
  IF jsonb_typeof(setting) = 'string' THEN setting := (setting #>> '{}')::jsonb; END IF;
  since := nullif(setting->>'required_since', '')::timestamptz;
  social := EXISTS (SELECT 1 FROM auth.identities i WHERE i.user_id = me AND i.provider IN ('google', 'apple'));
  RETURN jsonb_build_object(
    'required', coalesce((setting->>'enabled')::boolean, false) AND since IS NOT NULL AND account.created_at >= since
                AND NOT social AND coalesce(account.email, '') <> '' AND verified IS NULL,
    'verified', verified IS NOT NULL,
    'email', account.email);
END $$;
ALTER FUNCTION public.email_verification_state_v1() OWNER TO pgadmin;
REVOKE ALL ON FUNCTION public.email_verification_state_v1() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.email_verification_state_v1() TO authenticated, service_role;

-- Web purchases also attach to an e-mail proven with the code (same address as the account's current e-mail).
CREATE OR REPLACE FUNCTION public.web_subscription_link_user_v1(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  linked integer;
BEGIN
  IF p_user_id IS NULL THEN RETURN 0; END IF;
  UPDATE public.web_subscriptions ws
     SET user_id = p_user_id, updated_at = now()
   WHERE ws.user_id IS NULL
     AND ws.email IN (
       SELECT lower(i.identity_data->>'email') FROM auth.identities i
        WHERE i.user_id = p_user_id AND i.provider IN ('google', 'apple')
          AND coalesce(i.identity_data->>'email', '') <> ''
          AND coalesce((i.identity_data->>'email_verified')::boolean, true)
       UNION
       SELECT v.email FROM public.email_verifications v JOIN auth.users u ON u.id = v.user_id
        WHERE v.user_id = p_user_id AND v.verified_at IS NOT NULL AND v.email = lower(u.email));
  GET DIAGNOSTICS linked = ROW_COUNT;
  RETURN linked;
END $$;

CREATE OR REPLACE FUNCTION public.web_subscription_link_email_v1(p_subscription_id text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target uuid;
  matches integer;
BEGIN
  WITH owners AS (
    SELECT i.user_id FROM public.web_subscriptions ws
      JOIN auth.identities i ON lower(i.identity_data->>'email') = ws.email AND i.provider IN ('google', 'apple')
       AND coalesce((i.identity_data->>'email_verified')::boolean, true)
     WHERE ws.provider_subscription_id = p_subscription_id
    UNION
    SELECT v.user_id FROM public.web_subscriptions ws
      JOIN public.email_verifications v ON v.email = ws.email AND v.verified_at IS NOT NULL
      JOIN auth.users u ON u.id = v.user_id AND lower(u.email) = v.email
     WHERE ws.provider_subscription_id = p_subscription_id)
  SELECT count(DISTINCT user_id), min(user_id::text)::uuid INTO matches, target FROM owners;
  IF matches <> 1 THEN
    SELECT user_id INTO target FROM public.web_subscriptions WHERE provider_subscription_id = p_subscription_id;
    RETURN target;
  END IF;
  UPDATE public.web_subscriptions SET user_id = target, updated_at = now()
   WHERE provider_subscription_id = p_subscription_id AND user_id IS NULL;
  SELECT user_id INTO target FROM public.web_subscriptions WHERE provider_subscription_id = p_subscription_id;
  RETURN target;
END $$;
ALTER FUNCTION public.web_subscription_link_user_v1(uuid) OWNER TO pgadmin;
ALTER FUNCTION public.web_subscription_link_email_v1(text) OWNER TO pgadmin;
REVOKE ALL ON FUNCTION public.web_subscription_link_user_v1(uuid), public.web_subscription_link_email_v1(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.web_subscription_link_user_v1(uuid), public.web_subscription_link_email_v1(text) TO service_role;

-- CDC/writer guard enrollment for the new relation.
INSERT INTO _anacan_gcp_migration.guarded_relations (schema_name, table_name, primary_key)
VALUES ('public', 'email_verifications', ARRAY['user_id']) ON CONFLICT DO NOTHING;
DROP TRIGGER IF EXISTS anacan_gcp_writer_guard ON public.email_verifications;
DROP TRIGGER IF EXISTS anacan_gcp_change ON public.email_verifications;
DROP TRIGGER IF EXISTS anacan_gcp_truncate ON public.email_verifications;
CREATE TRIGGER anacan_gcp_writer_guard BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON public.email_verifications
  FOR EACH STATEMENT EXECUTE FUNCTION _anacan_gcp_migration.guard_write();
CREATE TRIGGER anacan_gcp_change AFTER INSERT OR DELETE OR UPDATE ON public.email_verifications
  FOR EACH ROW EXECUTE FUNCTION _anacan_gcp_migration.capture_change();
CREATE TRIGGER anacan_gcp_truncate AFTER TRUNCATE ON public.email_verifications
  FOR EACH STATEMENT EXECUTE FUNCTION _anacan_gcp_migration.capture_change();
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM _anacan_gcp_migration.guarded_relations WHERE schema_name = 'public' AND table_name = 'email_verifications')
     OR (SELECT count(*) FROM pg_trigger WHERE tgrelid = 'public.email_verifications'::regclass
          AND tgname IN ('anacan_gcp_writer_guard', 'anacan_gcp_change', 'anacan_gcp_truncate')) <> 3 THEN
    RAISE EXCEPTION 'EMAIL_VERIFICATION_GUARD_ENROLLMENT_INCOMPLETE';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
