-- ============================================================
-- Təhlükəsizlik Paketi
--   1) blood_pressure_logs — qan təzyiqi izləyicisi (preeklampsiya)
--   2) tool_configs: 'blood-pressure' + 'danger-signs' alətləri
--   3) user_preferences: privacy toggle-larının persist edilməsi
-- ============================================================

-- ------------------------------------------------------------
-- 1) Qan təzyiqi qeydləri
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.blood_pressure_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  systolic SMALLINT NOT NULL CHECK (systolic BETWEEN 50 AND 260),
  diastolic SMALLINT NOT NULL CHECK (diastolic BETWEEN 30 AND 200),
  pulse SMALLINT CHECK (pulse BETWEEN 30 AND 220),
  measured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bp_logs_user_date
  ON public.blood_pressure_logs (user_id, measured_at DESC);

ALTER TABLE public.blood_pressure_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own bp logs" ON public.blood_pressure_logs;
CREATE POLICY "Users manage own bp logs"
  ON public.blood_pressure_logs
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 2) Alət qeydiyyatı
-- ------------------------------------------------------------
INSERT INTO public.tool_configs
  (tool_id, name, name_az, description, description_az, icon, color, bg_color, life_stages, sort_order, is_active)
VALUES
  ('blood-pressure', 'Blood Pressure', 'Qan Təzyiqi', 'Track blood pressure & preeclampsia risk', 'Təzyiqi izləyin — preeklampsiya nəzarəti', 'HeartPulse', 'text-rose-600', 'bg-rose-50', '{flow,bump,mommy}', 7, true),
  ('danger-signs', 'Danger Signs', 'Təhlükə Əlamətləri', 'Urgent pregnancy warning signs', 'Təcili müraciət tələb edən əlamətlər', 'ShieldAlert', 'text-red-600', 'bg-red-50', '{bump,mommy}', 4, true)
ON CONFLICT (tool_id) DO UPDATE SET
  name_az = EXCLUDED.name_az,
  description_az = EXCLUDED.description_az,
  icon = EXCLUDED.icon,
  is_active = EXCLUDED.is_active;

-- ------------------------------------------------------------
-- 3) Privacy toggle persist (əvvəllər yalnız local state idi)
-- ------------------------------------------------------------
ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS privacy_profile_visible BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS privacy_show_in_community BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS privacy_allow_messages BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS privacy_share_analytics BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS privacy_location_sharing BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS privacy_notification_sounds BOOLEAN NOT NULL DEFAULT true;
