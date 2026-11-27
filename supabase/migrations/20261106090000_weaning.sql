-- Süddən ayırma (2026-11-06): gradual weaning tool for children 12+ months (Ana module only).
--
--   * weaning_plans: the mother's plan for a child: pace (gentle 7 days / medium 4 days per step; no one-day
--     option), night mode, the steps (jsonb array {id,type,n,start,len,status}), status
--     (active|paused|finished|cancelled) and why a paused plan is paused (doctor = red-flag check-in);
--   * weaning_checkins: her daily check-in (child mood, wet diapers, sick child, breast fullness, lump, redness,
--     fever, own mood) and the tone of the result the app showed;
--   * both are private: RLS own rows only, no partner or family sharing; the app writes them with supabase-js
--     (client-generated ids, idempotent upserts from the offline queue);
--   * tool_configs gets the free, mommy-only 'weaning' tool (the client hides it below 9 months and while
--     app_settings.weaning_tool is 'off');
--   * app_settings.weaning_tool ('on' | 'off', default 'off') is the admin switch (Admin → Tənzimləmələr) and is
--     added to the public allowlist RPC.
--
-- Applied by /home/anacan-runner/run-sql.py (psql as supabase_admin, ON_ERROR_STOP, one transaction).
-- The two new relations are enrolled in CDC and writer guarding; tool_configs and app_settings already are.
-- No cron or timer is added.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

DO $$
BEGIN
  IF to_regclass('_anacan_gcp_migration.guarded_relations') IS NULL THEN
    RAISE EXCEPTION 'WEANING_GUARD_CATALOG_MISSING';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM _anacan_gcp_migration.guarded_relations WHERE schema_name = 'public' AND table_name = 'tool_configs')
     OR NOT EXISTS (SELECT 1 FROM _anacan_gcp_migration.guarded_relations WHERE schema_name = 'public' AND table_name = 'app_settings') THEN
    RAISE EXCEPTION 'WEANING_EXISTING_RELATIONS_NOT_GUARDED';
  END IF;
  IF to_regclass('public.user_children') IS NULL THEN
    RAISE EXCEPTION 'WEANING_USER_CHILDREN_MISSING';
  END IF;
END $$;

-- ── Plans (own rows only) ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.weaning_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  child_id uuid REFERENCES public.user_children(id) ON DELETE CASCADE,
  pace text NOT NULL CHECK (pace IN ('gentle', 'medium')),
  night_mode text NOT NULL DEFAULT 'last' CHECK (night_mode IN ('last', 'separate')),
  steps jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(steps) = 'array' AND jsonb_array_length(steps) BETWEEN 1 AND 12 AND octet_length(steps::text) <= 8000),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'finished', 'cancelled')),
  pause_reason text CHECK (pause_reason IS NULL OR pause_reason IN ('doctor', 'manual')),
  started_at date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS weaning_plans_user_idx ON public.weaning_plans (user_id, updated_at DESC);

ALTER TABLE public.weaning_plans ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.weaning_plans FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weaning_plans TO authenticated;
GRANT ALL ON public.weaning_plans TO service_role;
DROP POLICY IF EXISTS weaning_plans_own ON public.weaning_plans;
CREATE POLICY weaning_plans_own ON public.weaning_plans
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND (child_id IS NULL OR EXISTS (SELECT 1 FROM public.user_children c WHERE c.id = child_id AND c.user_id = auth.uid()))
  );

-- ── Daily check-ins (own rows only) ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.weaning_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.weaning_plans(id) ON DELETE SET NULL,
  date date NOT NULL,
  child_mood text CHECK (child_mood IS NULL OR child_mood IN ('happy', 'ok', 'sad')),
  wet_diapers text CHECK (wet_diapers IS NULL OR wet_diapers IN ('ok', 'few')),
  child_sick boolean NOT NULL DEFAULT false,
  breast_fullness text CHECK (breast_fullness IS NULL OR breast_fullness IN ('none', 'some', 'much')),
  lump boolean NOT NULL DEFAULT false,
  redness boolean NOT NULL DEFAULT false,
  fever boolean NOT NULL DEFAULT false,
  mother_mood text CHECK (mother_mood IS NULL OR mother_mood IN ('good', 'mixed', 'low')),
  result_tone text NOT NULL CHECK (result_tone IN ('mint', 'amber', 'red', 'sky')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS weaning_checkins_user_idx ON public.weaning_checkins (user_id, date DESC);
CREATE INDEX IF NOT EXISTS weaning_checkins_plan_idx ON public.weaning_checkins (plan_id) WHERE plan_id IS NOT NULL;

ALTER TABLE public.weaning_checkins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.weaning_checkins FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weaning_checkins TO authenticated;
GRANT ALL ON public.weaning_checkins TO service_role;
DROP POLICY IF EXISTS weaning_checkins_own ON public.weaning_checkins;
CREATE POLICY weaning_checkins_own ON public.weaning_checkins
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND date BETWEEN current_date - 400 AND current_date + 1
    AND (plan_id IS NULL OR EXISTS (SELECT 1 FROM public.weaning_plans p WHERE p.id = plan_id AND p.user_id = auth.uid()))
  );

-- ── Tool row: free, Ana (mommy) module only ────────────────────────────────────────────
INSERT INTO public.tool_configs
  (tool_id, name, name_az, name_en, description, description_az, description_en, icon, color, bg_color, life_stages,
   sort_order, is_active, is_premium, premium_type, premium_limit, flow_active, bump_active, mommy_active)
VALUES
  ('weaning', 'Süddən ayırma', 'Süddən ayırma', 'Weaning',
   'Tədricən, uşağa zərərsiz ayırma planı, gündəlik check-in və bələdçi',
   'Tədricən, uşağa zərərsiz ayırma planı, gündəlik check-in və bələdçi',
   'A gentle, gradual weaning plan, daily check-in and guide',
   'Sprout', 'text-emerald-600', 'bg-emerald-50', '{mommy}', 40, true, false, 'none', 0, false, false, true)
ON CONFLICT (tool_id) DO UPDATE SET
  is_premium = false, premium_type = 'none', premium_limit = 0,
  life_stages = '{mommy}', flow_active = false, bump_active = false, mommy_active = true,
  icon = EXCLUDED.icon, updated_at = now();

-- ── Admin switch (default off) and the public allowlist ───────────────────────────────
INSERT INTO public.app_settings (key, value, description)
SELECT 'weaning_tool', '"off"'::jsonb, 'Süddən ayırma aləti (Ana modulu, uşaq 9+ ay): on / off'
 WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'weaning_tool');

CREATE OR REPLACE FUNCTION public.get_public_app_setting(p_key text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      'premium_sponsor', 'bottom_nav_style', 'profile_layout',
      'inapp_onboarding', 'inapp_onboarding_since', 'weaning_tool'
    ]::text[]);
$function$;

-- ── Ownership ──────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pgadmin') THEN
    EXECUTE 'ALTER TABLE public.weaning_plans OWNER TO pgadmin';
    EXECUTE 'ALTER TABLE public.weaning_checkins OWNER TO pgadmin';
  END IF;
END $$;

-- ── CDC and writer-guard enrollment of the two new relations ───────────────────────────
INSERT INTO _anacan_gcp_migration.guarded_relations (schema_name, table_name, primary_key) VALUES
  ('public', 'weaning_plans', ARRAY['id']),
  ('public', 'weaning_checkins', ARRAY['id'])
ON CONFLICT DO NOTHING;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['weaning_plans', 'weaning_checkins'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS anacan_gcp_writer_guard ON public.%I', t);
    EXECUTE format('DROP TRIGGER IF EXISTS anacan_gcp_change ON public.%I', t);
    EXECUTE format('DROP TRIGGER IF EXISTS anacan_gcp_truncate ON public.%I', t);
    EXECUTE format('CREATE TRIGGER anacan_gcp_writer_guard BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION _anacan_gcp_migration.guard_write()', t);
    EXECUTE format('CREATE TRIGGER anacan_gcp_change AFTER INSERT OR DELETE OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION _anacan_gcp_migration.capture_change()', t);
    EXECUTE format('CREATE TRIGGER anacan_gcp_truncate AFTER TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION _anacan_gcp_migration.capture_change()', t);
  END LOOP;
  IF (SELECT count(*) FROM _anacan_gcp_migration.guarded_relations WHERE schema_name = 'public'
      AND table_name IN ('weaning_plans', 'weaning_checkins')) <> 2
     OR (SELECT count(*) FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relname IN ('weaning_plans', 'weaning_checkins')
           AND tg.tgname IN ('anacan_gcp_writer_guard', 'anacan_gcp_change', 'anacan_gcp_truncate')) <> 6 THEN
    RAISE EXCEPTION 'WEANING_GUARD_ENROLLMENT_INCOMPLETE';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
