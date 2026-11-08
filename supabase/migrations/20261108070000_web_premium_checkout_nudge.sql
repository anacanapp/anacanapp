-- Abandoned web checkout reminder (anacan.az Premium campaign, Epoint).
-- A buyer who opened the bank page and left without paying (charge failed: link expired, 3-D Secure, decline) gets
-- ONE e-mail + push 30 minutes to 24 hours later, while the campaign is still open, unless they have paid since,
-- are trying again right now (pending charge), already have Premium, or were reminded in the last 7 days.
-- The web-premium-renew function (mode "nudge", 15-minute timer) claims due users here and records what it sent.
-- The new relation is enrolled in CDC and writer guarding (refuses without the guard catalog).
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

DO $$
BEGIN
  IF to_regclass('_anacan_gcp_migration.guarded_relations') IS NULL THEN
    RAISE EXCEPTION 'WEB_PREMIUM_NUDGE_GUARD_CATALOG_MISSING';
  END IF;
  IF to_regclass('public.web_premium_charges') IS NULL OR to_regprocedure('public.web_premium_campaign_v1()') IS NULL THEN
    RAISE EXCEPTION 'WEB_PREMIUM_NUDGE_BASE_MISSING';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.web_premium_checkout_nudges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  charge_id uuid NOT NULL UNIQUE REFERENCES public.web_premium_charges(id) ON DELETE CASCADE,
  plan text NOT NULL CHECK (plan IN ('monthly', 'yearly')),
  email_sent boolean,
  push_sent integer CHECK (push_sent IS NULL OR push_sent BETWEEN 0 AND 50),
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
CREATE INDEX IF NOT EXISTS web_premium_checkout_nudges_user_idx ON public.web_premium_checkout_nudges (user_id, created_at DESC);
ALTER TABLE public.web_premium_checkout_nudges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.web_premium_checkout_nudges FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.web_premium_checkout_nudges TO service_role;

-- Claims up to p_limit users to remind (one row per user: their latest abandoned initial charge) and returns them.
CREATE OR REPLACE FUNCTION public.web_premium_checkout_nudges_due_v1(p_limit integer DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  c jsonb := public.web_premium_campaign_v1();
  ends timestamptz;
  v_due jsonb;
BEGIN
  IF coalesce((c->>'active')::boolean, false) IS NOT TRUE THEN
    RETURN jsonb_build_object('campaign_active', false, 'due', '[]'::jsonb);
  END IF;
  ends := nullif(c->>'ends_at', '')::timestamptz;
  IF ends IS NOT NULL AND ends < now() + interval '20 minutes' THEN
    RETURN jsonb_build_object('campaign_active', true, 'closing', true, 'due', '[]'::jsonb);
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

  RETURN jsonb_build_object('campaign_active', true, 'ends_at', ends, 'due', v_due);
END
$function$;

-- Records what was actually delivered for a claimed reminder.
CREATE OR REPLACE FUNCTION public.web_premium_checkout_nudge_sent_v1(p_nudge uuid, p_email boolean, p_push integer)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $function$
  UPDATE public.web_premium_checkout_nudges
     SET email_sent = p_email, push_sent = greatest(0, least(coalesce(p_push, 0), 50)), sent_at = now()
   WHERE id = p_nudge;
$function$;

REVOKE ALL ON FUNCTION public.web_premium_checkout_nudges_due_v1(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.web_premium_checkout_nudge_sent_v1(uuid, boolean, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.web_premium_checkout_nudges_due_v1(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.web_premium_checkout_nudge_sent_v1(uuid, boolean, integer) TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pgadmin') THEN
    ALTER TABLE public.web_premium_checkout_nudges OWNER TO pgadmin;
  END IF;
END $$;

-- ── CDC and writer-guard enrollment ─────────────────────────────────────────────────────
INSERT INTO _anacan_gcp_migration.guarded_relations (schema_name, table_name, primary_key)
VALUES ('public', 'web_premium_checkout_nudges', ARRAY['id'])
ON CONFLICT DO NOTHING;

DO $$
BEGIN
  DROP TRIGGER IF EXISTS anacan_gcp_writer_guard ON public.web_premium_checkout_nudges;
  DROP TRIGGER IF EXISTS anacan_gcp_change ON public.web_premium_checkout_nudges;
  DROP TRIGGER IF EXISTS anacan_gcp_truncate ON public.web_premium_checkout_nudges;
  CREATE TRIGGER anacan_gcp_writer_guard BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON public.web_premium_checkout_nudges
    FOR EACH STATEMENT EXECUTE FUNCTION _anacan_gcp_migration.guard_write();
  CREATE TRIGGER anacan_gcp_change AFTER INSERT OR DELETE OR UPDATE ON public.web_premium_checkout_nudges
    FOR EACH ROW EXECUTE FUNCTION _anacan_gcp_migration.capture_change();
  CREATE TRIGGER anacan_gcp_truncate AFTER TRUNCATE ON public.web_premium_checkout_nudges
    FOR EACH STATEMENT EXECUTE FUNCTION _anacan_gcp_migration.capture_change();
  IF (SELECT count(*) FROM _anacan_gcp_migration.guarded_relations
       WHERE schema_name = 'public' AND table_name = 'web_premium_checkout_nudges') <> 1
     OR (SELECT count(*) FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relname = 'web_premium_checkout_nudges'
            AND tg.tgname IN ('anacan_gcp_writer_guard', 'anacan_gcp_change', 'anacan_gcp_truncate')) <> 3 THEN
    RAISE EXCEPTION 'WEB_PREMIUM_NUDGE_GUARD_ENROLLMENT_INCOMPLETE';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
