-- Premium push plan additions (owner request 2026-11-13, "Hamısını əlavə et").
-- 1) Abandoned anacan.az Premium checkout reminder now also runs outside campaigns: web_premium_checkout_nudges_due_v1
--    claims from web_premium_offer_v1 (campaign while active, else the standard price) and returns the offer kind so
--    the copy and link match (campaign page vs /premium/abune). Same rules otherwise.
-- 2) premium_lifecycle_pushes: one row per lifecycle push (dedupe key user + kind + ref), CDC + writer guard.
--    * store_expiring: App Store / Google Play Premium whose auto-renew is off (subscriptions.cancelled_at, set from
--      RevenueCat unsubscribe_detected_at) and that ends in 24-72 hours; one push per period end, sent between 10:00
--      and 20:00 in the user's own timezone. anacan.az web subscribers are excluded (their own e-mails handle it).
--    * web_renewal_failed / web_expired: push next to the existing e-mail when a saved-card renewal fails or ends.
-- Called from web-premium-renew ({"mode":"nudge"} 15-minute timer and the daily run); no new timer.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

DO $$
BEGIN
  IF to_regclass('_anacan_gcp_migration.guarded_relations') IS NULL THEN
    RAISE EXCEPTION 'PREMIUM_PUSH_GUARD_CATALOG_MISSING';
  END IF;
  IF to_regprocedure('public.web_premium_offer_v1()') IS NULL OR to_regclass('public.web_premium_checkout_nudges') IS NULL
     OR to_regclass('public.subscriptions') IS NULL OR to_regclass('public.user_preferences') IS NULL THEN
    RAISE EXCEPTION 'PREMIUM_PUSH_BASE_MISSING';
  END IF;
END $$;

-- ── 1) Checkout reminder: campaign or standard offer ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.web_premium_checkout_nudges_due_v1(p_limit integer DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  c jsonb := public.web_premium_offer_v1();
  v_kind text := coalesce(c->>'kind', 'standard');
  ends timestamptz;
  v_due jsonb;
BEGIN
  IF coalesce((c->>'active')::boolean, false) IS NOT TRUE THEN
    RETURN jsonb_build_object('campaign_active', false, 'offer_active', false, 'due', '[]'::jsonb);
  END IF;
  ends := CASE WHEN v_kind = 'campaign' THEN nullif(c->>'ends_at', '')::timestamptz END;
  IF ends IS NOT NULL AND ends < now() + interval '20 minutes' THEN
    RETURN jsonb_build_object('campaign_active', true, 'offer_active', true, 'kind', v_kind, 'closing', true, 'due', '[]'::jsonb);
  END IF;

  WITH latest AS (
    SELECT DISTINCT ON (ch.user_id) ch.id, ch.user_id, ch.plan, ch.status, ch.amount, ch.created_at, ch.updated_at
      FROM public.web_premium_charges ch
     WHERE ch.kind = 'initial' AND ch.created_at > now() - interval '25 hours'
     ORDER BY ch.user_id, ch.created_at DESC
  ), due AS (
    SELECT l.* FROM latest l
     WHERE l.status = 'failed'
       AND l.amount >= 1                                         -- 0,01 ₼ test charges never trigger a reminder
       AND l.created_at <= now() - interval '30 minutes'
       AND l.created_at >= now() - interval '24 hours'
       AND l.updated_at <= now() - interval '5 minutes'
       AND NOT EXISTS (SELECT 1 FROM public.web_premium_charges p
                        WHERE p.user_id = l.user_id AND (p.status = 'paid' AND p.created_at >= l.created_at - interval '1 day'
                                                         OR p.status = 'pending'))
       AND NOT EXISTS (SELECT 1 FROM public.web_premium_subscriptions s
                        WHERE s.user_id = l.user_id AND s.status IN ('active', 'past_due', 'cancelled'))
       AND NOT EXISTS (SELECT 1 FROM public.web_premium_checkout_nudges n
                        WHERE n.user_id = l.user_id AND n.created_at > now() - interval '7 days')
       AND NOT EXISTS (SELECT 1 FROM (SELECT su.plan_type, su.expires_at FROM public.subscriptions su
                                        WHERE su.user_id = l.user_id ORDER BY su.updated_at DESC LIMIT 1) cur
                        WHERE cur.plan_type <> 'free' AND (cur.expires_at IS NULL OR cur.expires_at > now()))
     ORDER BY l.created_at
     LIMIT greatest(1, least(coalesce(p_limit, 50), 200))
  ), claimed AS (
    INSERT INTO public.web_premium_checkout_nudges (user_id, charge_id, plan)
    SELECT user_id, id, plan FROM due
    ON CONFLICT (charge_id) DO NOTHING
    RETURNING id, user_id, plan
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object('nudge_id', id, 'user_id', user_id, 'plan', plan)), '[]'::jsonb) INTO v_due FROM claimed;

  -- campaign_active stays true for any live offer so older callers keep sending; kind tells campaign from standard.
  RETURN jsonb_build_object('campaign_active', true, 'offer_active', true, 'kind', v_kind, 'ends_at', ends, 'due', v_due);
END
$function$;

-- ── 2) Lifecycle pushes ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.premium_lifecycle_pushes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('store_expiring', 'web_renewal_failed', 'web_expired')),
  ref text NOT NULL CHECK (length(ref) BETWEEN 1 AND 100),
  push_sent integer CHECK (push_sent IS NULL OR push_sent BETWEEN 0 AND 50),
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  UNIQUE (user_id, kind, ref)
);
CREATE INDEX IF NOT EXISTS premium_lifecycle_pushes_kind_idx ON public.premium_lifecycle_pushes (kind, created_at DESC);
ALTER TABLE public.premium_lifecycle_pushes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.premium_lifecycle_pushes FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.premium_lifecycle_pushes TO service_role;

-- Store Premium ending soon with auto-renew off; claims rows and returns user, language and trial flag.
CREATE OR REPLACE FUNCTION public.premium_store_expiring_due_v1(p_limit integer DEFAULT 100)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE v_due jsonb;
BEGIN
  WITH cand AS (
    SELECT DISTINCT ON (s.user_id) s.user_id, s.expires_at, coalesce(s.is_trial, false) AS is_trial
      FROM public.subscriptions s
     WHERE s.plan_type IN ('premium', 'premium_plus')
       AND s.status IN ('active', 'cancelled')
       AND s.cancelled_at IS NOT NULL
       AND s.expires_at BETWEEN now() + interval '24 hours' AND now() + interval '72 hours'
     ORDER BY s.user_id, s.updated_at DESC
  ), due AS (
    SELECT c.*, coalesce(up.language, 'az') AS language
      FROM cand c
      LEFT JOIN public.user_preferences up ON up.user_id = c.user_id
     WHERE NOT EXISTS (SELECT 1 FROM public.web_premium_subscriptions w
                        WHERE w.user_id = c.user_id AND w.status IN ('active', 'past_due', 'cancelled'))
       AND NOT public.has_role(c.user_id, 'admin')
       -- 10:00-20:00 in the user's timezone (unknown or invalid zone: Baku).
       AND extract(hour FROM now() AT TIME ZONE coalesce(
             (SELECT z.name FROM pg_timezone_names z WHERE z.name = up.timezone LIMIT 1), 'Asia/Baku')) BETWEEN 10 AND 19
       AND NOT EXISTS (SELECT 1 FROM public.premium_lifecycle_pushes p
                        WHERE p.user_id = c.user_id AND p.kind = 'store_expiring' AND p.created_at > now() - interval '20 days')
     ORDER BY c.expires_at
     LIMIT greatest(1, least(coalesce(p_limit, 100), 300))
  ), claimed AS (
    INSERT INTO public.premium_lifecycle_pushes (user_id, kind, ref)
    SELECT user_id, 'store_expiring', to_char(expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI') FROM due
    ON CONFLICT (user_id, kind, ref) DO NOTHING
    RETURNING id, user_id
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object('push_id', c.id, 'user_id', c.user_id, 'language', d.language, 'trial', d.is_trial)), '[]'::jsonb)
    INTO v_due FROM claimed c JOIN due d ON d.user_id = c.user_id;
  RETURN jsonb_build_object('due', v_due);
END
$function$;

-- Claims a web renewal push once per charge (ref = charge id); returns the row id or NULL when already sent.
CREATE OR REPLACE FUNCTION public.premium_web_push_claim_v1(p_user uuid, p_kind text, p_ref text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $function$
  INSERT INTO public.premium_lifecycle_pushes (user_id, kind, ref)
  SELECT p_user, p_kind, left(p_ref, 100)
   WHERE p_user IS NOT NULL AND p_kind IN ('web_renewal_failed', 'web_expired') AND coalesce(p_ref, '') <> ''
  ON CONFLICT (user_id, kind, ref) DO NOTHING
  RETURNING id;
$function$;

CREATE OR REPLACE FUNCTION public.premium_lifecycle_push_sent_v1(p_id uuid, p_push integer)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $function$
  UPDATE public.premium_lifecycle_pushes
     SET push_sent = greatest(0, least(coalesce(p_push, 0), 50)), sent_at = now()
   WHERE id = p_id;
$function$;

REVOKE ALL ON FUNCTION public.premium_store_expiring_due_v1(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.premium_web_push_claim_v1(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.premium_lifecycle_push_sent_v1(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.premium_store_expiring_due_v1(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.premium_web_push_claim_v1(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.premium_lifecycle_push_sent_v1(uuid, integer) TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pgadmin') THEN
    ALTER TABLE public.premium_lifecycle_pushes OWNER TO pgadmin;
    ALTER FUNCTION public.premium_store_expiring_due_v1(integer) OWNER TO pgadmin;
    ALTER FUNCTION public.premium_web_push_claim_v1(uuid, text, text) OWNER TO pgadmin;
    ALTER FUNCTION public.premium_lifecycle_push_sent_v1(uuid, integer) OWNER TO pgadmin;
  END IF;
END $$;

-- ── CDC and writer-guard enrollment ─────────────────────────────────────────────────────
INSERT INTO _anacan_gcp_migration.guarded_relations (schema_name, table_name, primary_key)
VALUES ('public', 'premium_lifecycle_pushes', ARRAY['id'])
ON CONFLICT DO NOTHING;

DO $$
BEGIN
  DROP TRIGGER IF EXISTS anacan_gcp_writer_guard ON public.premium_lifecycle_pushes;
  DROP TRIGGER IF EXISTS anacan_gcp_change ON public.premium_lifecycle_pushes;
  DROP TRIGGER IF EXISTS anacan_gcp_truncate ON public.premium_lifecycle_pushes;
  CREATE TRIGGER anacan_gcp_writer_guard BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON public.premium_lifecycle_pushes
    FOR EACH STATEMENT EXECUTE FUNCTION _anacan_gcp_migration.guard_write();
  CREATE TRIGGER anacan_gcp_change AFTER INSERT OR DELETE OR UPDATE ON public.premium_lifecycle_pushes
    FOR EACH ROW EXECUTE FUNCTION _anacan_gcp_migration.capture_change();
  CREATE TRIGGER anacan_gcp_truncate AFTER TRUNCATE ON public.premium_lifecycle_pushes
    FOR EACH STATEMENT EXECUTE FUNCTION _anacan_gcp_migration.capture_change();
  IF (SELECT count(*) FROM _anacan_gcp_migration.guarded_relations
       WHERE schema_name = 'public' AND table_name = 'premium_lifecycle_pushes') <> 1
     OR (SELECT count(*) FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relname = 'premium_lifecycle_pushes'
            AND tg.tgname IN ('anacan_gcp_writer_guard', 'anacan_gcp_change', 'anacan_gcp_truncate')) <> 3 THEN
    RAISE EXCEPTION 'PREMIUM_PUSH_GUARD_ENROLLMENT_INCOMPLETE';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
