-- User consents for the legal documents v2.0 (Terms of Use, Privacy Policy, Medical disclaimer).
--
-- The Terms / Privacy Policy v2.0 promise: Terms accepted at sign-up through an unticked checkbox, health data
-- processed only with a separate explicit consent (withdrawable in Privacy settings), minimum age 16, marketing as
-- a separate optional consent, and the consent time + document version recorded. This migration stores that record.
--
-- * user_consents: append-only log, one row per decision (kind, granted, document_version, text_variant, source,
--   app_version). Kinds: terms, health_data, age_16, marketing (all users), ai_assistant (first use of Anacan.AI),
--   child_data and marketing_email / marketing_push / marketing_sms (Türkiye KVKK / 6563 İYS channels; marketing
--   = any channel). text_variant 'kvkk_tr' marks the owner's KVKK Açık Rıza wording shown to Türkiye users.
--   The latest row per (user, kind) is the current state. Rows are never updated; account deletion cascades.
-- * record_consents_v1(p_items, p_source, p_app_version): the signed-in user records one or more decisions for the
--   current document version (SECURITY DEFINER, auth.uid() required). terms and age_16 can only be granted;
--   every other kind can be granted or withdrawn.
-- * my_consents_v1(): the consent gate configuration and the latest state per kind for the signed-in user.
-- * app_settings.consent_gate = {"enabled": true, "version": "2.0"}: switch and current document version
--   (read server-side by the two RPCs; not added to the public allowlist).
--
-- Applied by /home/anacan-runner/run-sql.py (psql as supabase_admin, ON_ERROR_STOP, one transaction).
-- The new relation is CDC/writer guarded below; see the .cdc.json manifest.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

DO $$
BEGIN
  IF to_regclass('_anacan_gcp_migration.guarded_relations') IS NULL THEN
    RAISE EXCEPTION 'USER_CONSENTS_GUARD_CATALOG_MISSING';
  END IF;
  IF (SELECT count(*) FROM _anacan_gcp_migration.guarded_relations
       WHERE schema_name = 'public' AND table_name IN ('app_settings')) <> 1 THEN
    RAISE EXCEPTION 'USER_CONSENTS_EXISTING_RELATIONS_NOT_GUARDED';
  END IF;
END $$;

-- ── Table (append-only, own rows only) ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('terms', 'health_data', 'age_16', 'marketing', 'child_data', 'ai_assistant', 'marketing_email', 'marketing_push', 'marketing_sms')),
  granted boolean NOT NULL,
  document_version text NOT NULL CHECK (document_version ~ '^[0-9]{1,4}(\.[0-9]{1,4}){0,3}$'),
  text_variant text CHECK (text_variant IS NULL OR text_variant IN ('default', 'kvkk_tr')),
  source text CHECK (source IS NULL OR source IN ('ios', 'android', 'web')),
  app_version text CHECK (app_version IS NULL OR char_length(app_version) <= 32),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_consents_user_kind_idx ON public.user_consents (user_id, kind, created_at DESC);

ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_consents FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.user_consents TO authenticated;
GRANT ALL ON public.user_consents TO service_role;
DROP POLICY IF EXISTS user_consents_select_own ON public.user_consents;
CREATE POLICY user_consents_select_own ON public.user_consents
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS user_consents_insert_own ON public.user_consents;
CREATE POLICY user_consents_insert_own ON public.user_consents
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Append-only: a decision is never rewritten; a change is a new row. (Account deletion cascades as DELETE.)
CREATE OR REPLACE FUNCTION public.user_consents_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  RAISE EXCEPTION 'USER_CONSENTS_APPEND_ONLY';
END
$function$;
REVOKE ALL ON FUNCTION public.user_consents_append_only() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS user_consents_no_update ON public.user_consents;
CREATE TRIGGER user_consents_no_update BEFORE UPDATE ON public.user_consents
  FOR EACH ROW EXECUTE FUNCTION public.user_consents_append_only();

-- ── Gate configuration ────────────────────────────────────────────────────────────────
INSERT INTO public.app_settings (key, value, description)
SELECT 'consent_gate', '{"enabled": true, "version": "2.0"}'::jsonb,
       'Razılıq ekranı (İstifadə Şərtləri / Məxfilik Siyasəti / sağlamlıq məlumatı / 16+ / marketinq): enabled və cari sənəd versiyası'
 WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'consent_gate');

-- {enabled, version}; a malformed setting keeps the gate off rather than locking anyone out.
CREATE OR REPLACE FUNCTION public.consent_gate_config_v1()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v jsonb;
  ver text;
BEGIN
  SELECT value INTO v FROM public.app_settings WHERE key = 'consent_gate';
  IF v IS NULL OR jsonb_typeof(v) <> 'object' THEN
    RETURN jsonb_build_object('enabled', false, 'version', NULL);
  END IF;
  ver := v->>'version';
  IF ver IS NULL OR ver !~ '^[0-9]{1,4}(\.[0-9]{1,4}){0,3}$' THEN
    RETURN jsonb_build_object('enabled', false, 'version', NULL);
  END IF;
  RETURN jsonb_build_object('enabled', COALESCE((v->>'enabled')::boolean, false), 'version', ver);
EXCEPTION WHEN others THEN
  RETURN jsonb_build_object('enabled', false, 'version', NULL);
END
$function$;

-- {gate: {enabled, version}, consents: {kind: {granted, document_version, source, created_at}}} for auth.uid().
CREATE OR REPLACE FUNCTION public.my_consents_v1()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  latest jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'CONSENT_AUTH_REQUIRED'; END IF;
  SELECT COALESCE(jsonb_object_agg(l.kind, jsonb_build_object(
           'granted', l.granted, 'document_version', l.document_version, 'text_variant', l.text_variant,
           'source', l.source, 'created_at', l.created_at)), '{}'::jsonb)
    INTO latest
    FROM (
      SELECT DISTINCT ON (c.kind) c.kind, c.granted, c.document_version, c.text_variant, c.source, c.created_at
        FROM public.user_consents c
       WHERE c.user_id = uid
       ORDER BY c.kind, c.created_at DESC, c.id DESC
    ) l;
  RETURN jsonb_build_object('gate', public.consent_gate_config_v1(), 'consents', latest);
END
$function$;

-- p_items: [{"kind": "terms", "granted": true, "version": "2.0", "variant": "kvkk_tr"?}, ...] (1–12 items, current version only).
CREATE OR REPLACE FUNCTION public.record_consents_v1(p_items jsonb, p_source text DEFAULT NULL, p_app_version text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  gate jsonb := public.consent_gate_config_v1();
  current_version text := gate->>'version';
  item jsonb;
  k text;
  g boolean;
  ver text;
  src text := NULLIF(btrim(COALESCE(p_source, '')), '');
  app text := NULLIF(left(btrim(COALESCE(p_app_version, '')), 32), '');
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'CONSENT_AUTH_REQUIRED'; END IF;
  IF current_version IS NULL THEN RAISE EXCEPTION 'CONSENT_VERSION_UNAVAILABLE'; END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) < 1 OR jsonb_array_length(p_items) > 12 THEN
    RAISE EXCEPTION 'CONSENT_ITEMS_INVALID';
  END IF;
  IF src IS NOT NULL AND src NOT IN ('ios', 'android', 'web') THEN RAISE EXCEPTION 'CONSENT_SOURCE_INVALID'; END IF;

  -- Validate everything first; insert only when the whole batch is valid.
  FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    IF jsonb_typeof(item) <> 'object' OR jsonb_typeof(item->'granted') <> 'boolean' THEN
      RAISE EXCEPTION 'CONSENT_ITEMS_INVALID';
    END IF;
    k := item->>'kind';
    g := (item->>'granted')::boolean;
    ver := item->>'version';
    IF k IS NULL OR k NOT IN ('terms', 'health_data', 'age_16', 'marketing', 'child_data', 'ai_assistant', 'marketing_email', 'marketing_push', 'marketing_sms') THEN RAISE EXCEPTION 'CONSENT_KIND_INVALID'; END IF;
    IF item->>'variant' IS NOT NULL AND item->>'variant' NOT IN ('default', 'kvkk_tr') THEN
      RAISE EXCEPTION 'CONSENT_VARIANT_INVALID';
    END IF;
    IF ver IS DISTINCT FROM current_version THEN RAISE EXCEPTION 'CONSENT_VERSION_MISMATCH'; END IF;
    IF k IN ('terms', 'age_16') AND g IS NOT TRUE THEN RAISE EXCEPTION 'CONSENT_REQUIRED_NOT_WITHDRAWABLE'; END IF;
  END LOOP;

  INSERT INTO public.user_consents (user_id, kind, granted, document_version, text_variant, source, app_version)
  SELECT uid, e->>'kind', (e->>'granted')::boolean, e->>'version', e->>'variant', src, app
    FROM jsonb_array_elements(p_items) e;

  RETURN public.my_consents_v1();
END
$function$;

-- ── Grants ──────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE f text;
BEGIN
  REVOKE ALL ON FUNCTION public.consent_gate_config_v1() FROM PUBLIC, anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.consent_gate_config_v1() TO service_role;
  FOREACH f IN ARRAY ARRAY['my_consents_v1()', 'record_consents_v1(jsonb,text,text)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', f);
  END LOOP;
END $$;

-- ── Ownership, CDC and writer-guard enrollment of the new relation ──────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pgadmin') THEN
    EXECUTE 'ALTER TABLE public.user_consents OWNER TO pgadmin';
  END IF;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['user_consents'] LOOP
    INSERT INTO _anacan_gcp_migration.guarded_relations (schema_name, table_name, primary_key)
    VALUES ('public', t, ARRAY['id'])
    ON CONFLICT DO NOTHING;
    EXECUTE format('DROP TRIGGER IF EXISTS anacan_gcp_writer_guard ON public.%I', t);
    EXECUTE format('DROP TRIGGER IF EXISTS anacan_gcp_change ON public.%I', t);
    EXECUTE format('DROP TRIGGER IF EXISTS anacan_gcp_truncate ON public.%I', t);
    EXECUTE format('CREATE TRIGGER anacan_gcp_writer_guard BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION _anacan_gcp_migration.guard_write()', t);
    EXECUTE format('CREATE TRIGGER anacan_gcp_change AFTER INSERT OR DELETE OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION _anacan_gcp_migration.capture_change()', t);
    EXECUTE format('CREATE TRIGGER anacan_gcp_truncate AFTER TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION _anacan_gcp_migration.capture_change()', t);
  END LOOP;
  IF (SELECT count(*) FROM _anacan_gcp_migration.guarded_relations WHERE schema_name = 'public'
        AND table_name IN ('user_consents')) <> 1
     OR (SELECT count(*) FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relname IN ('user_consents')
            AND tg.tgname IN ('anacan_gcp_writer_guard', 'anacan_gcp_change', 'anacan_gcp_truncate')) <> 3 THEN
    RAISE EXCEPTION 'USER_CONSENTS_GUARD_ENROLLMENT_INCOMPLETE';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
