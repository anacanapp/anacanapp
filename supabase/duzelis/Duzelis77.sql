-- Duzelis77 (2026-11-01): "Who pays for Premium?" — let a spouse or family member pay for a user's
-- Anacan Premium through the anacan.az/p/<token> web page (Dodo Payments, Merchant of Record).
--
--   * premium_sponsor_links: one shareable link per request. token is the /p/<token> id. requester_user_id
--     is the account that gets Premium when the sponsor pays (NOT the payer). kind: 'partner' (spouse,
--     with the partner-mode message) or 'gift' (a plain payment request, e.g. a family member). The
--     sponsor chooses the plan on the web page, so plan is null until paid. Links expire after 7 days.
--     The sponsor never gets app access or any personal data — they only pay; Premium is granted to the
--     requester and shared to a linked partner by the existing household entitlement.
--   * create_premium_sponsor_link_v1(kind, relation, language): authenticated. Reuses the caller's live
--     link of the same kind when one has >1 day left, else makes a new one. Returns token + expires_at.
--   * premium_sponsor_link_info_v1(token): service_role (the sponsor-link-info function calls it). Returns
--     only safe, public fields for the pay page: the requester's first name, kind, validity, paid state.
--   * web_subscription_link_sponsor_v1(subscription_id, token): service_role (dodo-webhook). Validates the
--     token, points the web subscription at the requester and marks the link paid. Returns the requester.
--   * RLS on; a user reads only her own links; all writes are service_role (the create RPC is DEFINER).
--     The new relation is CDC/writer guarded below (same contract as Duzelis69/73).
--
-- Applied once on Google (psql as supabase_admin, one transaction). No cron or timer.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

CREATE TABLE IF NOT EXISTS public.premium_sponsor_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE CHECK (token ~ '^[A-Za-z0-9_-]{16,64}$'),
  requester_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('partner', 'gift')),
  relation text CHECK (relation IS NULL OR relation IN ('spouse', 'mother', 'father', 'sibling', 'family', 'other')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'expired', 'revoked')),
  plan text CHECK (plan IS NULL OR plan IN ('monthly', 'yearly')),
  language text NOT NULL DEFAULT 'az',
  provider_subscription_id text,
  paid_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS premium_sponsor_links_requester_idx ON public.premium_sponsor_links (requester_user_id, created_at DESC);

ALTER TABLE public.premium_sponsor_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.premium_sponsor_links FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.premium_sponsor_links TO authenticated;
GRANT ALL ON public.premium_sponsor_links TO service_role;
DROP POLICY IF EXISTS premium_sponsor_links_own_read ON public.premium_sponsor_links;
CREATE POLICY premium_sponsor_links_own_read ON public.premium_sponsor_links
  FOR SELECT TO authenticated USING (requester_user_id = auth.uid());

-- Create (or reuse) a sponsor link for the current user. Reusing a still-fresh pending link keeps the
-- shared URL stable if she taps again; expired/paid links are never reused.
CREATE OR REPLACE FUNCTION public.create_premium_sponsor_link_v1(p_kind text, p_relation text DEFAULT NULL, p_language text DEFAULT 'az')
RETURNS TABLE(token text, expires_at timestamptz, kind text, reused boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  v_kind text := CASE WHEN p_kind IN ('partner', 'gift') THEN p_kind ELSE NULL END;
  v_relation text := CASE WHEN p_relation IN ('spouse', 'mother', 'father', 'sibling', 'family', 'other') THEN p_relation ELSE NULL END;
  v_language text := coalesce(nullif(p_language, ''), 'az');
  v_tok text;
  v_exp timestamptz;
  existing public.premium_sponsor_links%ROWTYPE;
  recent integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED' USING errcode = '28000'; END IF;
  IF v_kind IS NULL THEN RAISE EXCEPTION 'INVALID_KIND' USING errcode = '22023'; END IF;

  -- Mark the caller's lapsed links expired (housekeeping, cheap).
  UPDATE public.premium_sponsor_links
     SET status = 'expired'
   WHERE requester_user_id = uid AND status = 'pending' AND expires_at <= now();

  -- Reuse a fresh pending link of the same kind (>1 day left) so repeated taps share one URL.
  SELECT * INTO existing FROM public.premium_sponsor_links
   WHERE requester_user_id = uid AND kind = v_kind AND status = 'pending' AND expires_at > now() + interval '1 day'
   ORDER BY created_at DESC LIMIT 1;
  IF FOUND THEN
    UPDATE public.premium_sponsor_links SET relation = v_relation, language = v_language WHERE id = existing.id;
    RETURN QUERY SELECT existing.token, existing.expires_at, existing.kind, true;
    RETURN;
  END IF;

  -- Light abuse limit: at most 20 links created per user per hour.
  SELECT count(*) INTO recent FROM public.premium_sponsor_links
   WHERE requester_user_id = uid AND created_at > now() - interval '1 hour';
  IF recent >= 20 THEN RAISE EXCEPTION 'TOO_MANY_LINKS' USING errcode = '53400'; END IF;

  v_tok := translate(encode(gen_random_bytes(18), 'base64'), '+/=', '-_');
  v_exp := now() + interval '7 days';
  INSERT INTO public.premium_sponsor_links(token, requester_user_id, kind, relation, language, expires_at)
  VALUES (v_tok, uid, v_kind, v_relation, v_language, v_exp);
  RETURN QUERY SELECT v_tok, v_exp, v_kind, false;
END $$;
ALTER FUNCTION public.create_premium_sponsor_link_v1(text, text, text) OWNER TO pgadmin;
REVOKE ALL ON FUNCTION public.create_premium_sponsor_link_v1(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_premium_sponsor_link_v1(text, text, text) TO authenticated, service_role;

-- Public, minimal info for the pay page. Returns only the requester's first name (never the full name,
-- e-mail or any health data), the kind, and validity. Expires lazily.
CREATE OR REPLACE FUNCTION public.premium_sponsor_link_info_v1(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec public.premium_sponsor_links%ROWTYPE;
  first_name text;
  is_valid boolean;
BEGIN
  SELECT * INTO rec FROM public.premium_sponsor_links WHERE token = p_token;
  IF NOT FOUND THEN RETURN jsonb_build_object('found', false); END IF;
  IF rec.status = 'pending' AND rec.expires_at <= now() THEN
    UPDATE public.premium_sponsor_links SET status = 'expired' WHERE id = rec.id;
    rec.status := 'expired';
  END IF;
  SELECT nullif(split_part(btrim(p.name), ' ', 1), '') INTO first_name FROM public.profiles p WHERE p.user_id = rec.requester_user_id;
  is_valid := rec.status = 'pending' AND rec.expires_at > now();
  RETURN jsonb_build_object(
    'found', true,
    'valid', is_valid,
    'status', rec.status,
    'kind', rec.kind,
    'firstName', left(coalesce(first_name, ''), 40),
    'language', rec.language,
    'expiresAt', rec.expires_at,
    'paid', rec.status = 'paid');
END $$;
ALTER FUNCTION public.premium_sponsor_link_info_v1(text) OWNER TO pgadmin;
REVOKE ALL ON FUNCTION public.premium_sponsor_link_info_v1(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.premium_sponsor_link_info_v1(text) TO service_role;

-- Webhook path: attach a paid Dodo subscription to the requester named by the token, and mark the link
-- paid. Idempotent. Returns the requester's user_id (or null if the token is unusable).
CREATE OR REPLACE FUNCTION public.web_subscription_link_sponsor_v1(p_subscription_id text, p_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec public.premium_sponsor_links%ROWTYPE;
  v_plan text;
BEGIN
  SELECT * INTO rec FROM public.premium_sponsor_links WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF rec.status = 'revoked' THEN RETURN NULL; END IF;
  -- Accept even a just-lapsed link if the payment itself arrived (sponsor paid before expiry).
  SELECT plan INTO v_plan FROM public.web_subscriptions WHERE provider_subscription_id = p_subscription_id;

  UPDATE public.web_subscriptions
     SET user_id = rec.requester_user_id, updated_at = now()
   WHERE provider_subscription_id = p_subscription_id AND user_id IS NULL;

  UPDATE public.premium_sponsor_links
     SET status = 'paid', paid_at = coalesce(paid_at, now()),
         provider_subscription_id = coalesce(provider_subscription_id, p_subscription_id),
         plan = coalesce(plan, v_plan)
   WHERE id = rec.id AND status <> 'paid';

  RETURN rec.requester_user_id;
END $$;
ALTER FUNCTION public.web_subscription_link_sponsor_v1(text, text) OWNER TO pgadmin;
REVOKE ALL ON FUNCTION public.web_subscription_link_sponsor_v1(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.web_subscription_link_sponsor_v1(text, text) TO service_role;

-- Feature gate (off until the app, functions and the anacan.az/p pay page are all live). app_settings is
-- already CDC/writer guarded, so this is just a seed + an allowlist entry for get_public_app_setting.
INSERT INTO public.app_settings (key, value, description)
SELECT 'premium_sponsor', '{"enabled": false}'::jsonb, 'Show the "someone else pays for Premium" option on the paywall'
WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'premium_sponsor');

CREATE OR REPLACE FUNCTION public.get_public_app_setting(p_key text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.value
  FROM public.app_settings a
  WHERE a.key = p_key
    AND a.key = ANY(ARRAY[
      'flow_mode_enabled', 'bump_mode_enabled', 'mommy_mode_enabled',
      'dark_mode_enabled', 'mommy_hero_variant', 'force_update',
      'affiliate_section_enabled', 'social_login_enabled',
      'premium_onboarding_enabled', 'community_header_flow',
      'community_header_bump', 'community_header_mommy',
      'premium_paywall_config', 'billing_page_config', 'free_limits',
      'premium_sponsor'
    ]::text[]);
$$;
GRANT EXECUTE ON FUNCTION public.get_public_app_setting(text) TO anon, authenticated;

-- CDC/writer guard enrollment for the new relation (same contract as Duzelis73).
DO $$
DECLARE
  t text := 'premium_sponsor_links';
BEGIN
  INSERT INTO _anacan_gcp_migration.guarded_relations(schema_name, table_name, primary_key)
  VALUES ('public', t, ARRAY['id']) ON CONFLICT DO NOTHING;
  EXECUTE format('DROP TRIGGER IF EXISTS anacan_gcp_writer_guard ON public.%I', t);
  EXECUTE format('DROP TRIGGER IF EXISTS anacan_gcp_change ON public.%I', t);
  EXECUTE format('DROP TRIGGER IF EXISTS anacan_gcp_truncate ON public.%I', t);
  EXECUTE format('CREATE TRIGGER anacan_gcp_writer_guard BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION _anacan_gcp_migration.guard_write()', t);
  EXECUTE format('CREATE TRIGGER anacan_gcp_change AFTER INSERT OR DELETE OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION _anacan_gcp_migration.capture_change()', t);
  EXECUTE format('CREATE TRIGGER anacan_gcp_truncate AFTER TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION _anacan_gcp_migration.capture_change()', t);
  IF (SELECT count(*) FROM _anacan_gcp_migration.guarded_relations WHERE schema_name = 'public' AND table_name = t) <> 1
     OR (SELECT count(*) FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relname = t
            AND tg.tgname IN ('anacan_gcp_writer_guard', 'anacan_gcp_change', 'anacan_gcp_truncate')) <> 3 THEN
    RAISE EXCEPTION 'SPONSOR_LINKS_GUARD_ENROLLMENT_INCOMPLETE';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
