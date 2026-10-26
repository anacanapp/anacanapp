
-- 1. vaccine_countries
CREATE TABLE public.vaccine_countries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name_az text NOT NULL,
  name_en text NOT NULL,
  flag_emoji text DEFAULT '🌍',
  source_url text,
  source_label text,
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.vaccine_countries TO anon, authenticated;
GRANT ALL ON public.vaccine_countries TO service_role;
ALTER TABLE public.vaccine_countries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Vaccine countries are viewable by everyone" ON public.vaccine_countries FOR SELECT USING (true);
CREATE POLICY "Only admins can manage vaccine countries" ON public.vaccine_countries FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_vaccine_countries_updated_at BEFORE UPDATE ON public.vaccine_countries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. vaccines (catalog per country)
CREATE TABLE public.vaccines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL REFERENCES public.vaccine_countries(code) ON DELETE CASCADE,
  code text NOT NULL,
  name_az text NOT NULL,
  name_en text,
  short_description_az text,
  full_description_az text,
  disease_az text,
  route_az text,
  side_effects_az text,
  contraindications_az text,
  is_mandatory boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  color_hex text DEFAULT '#F28155',
  source_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (country_code, code)
);
GRANT SELECT ON public.vaccines TO anon, authenticated;
GRANT ALL ON public.vaccines TO service_role;
ALTER TABLE public.vaccines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Vaccines viewable by everyone" ON public.vaccines FOR SELECT USING (true);
CREATE POLICY "Only admins manage vaccines" ON public.vaccines FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE INDEX idx_vaccines_country ON public.vaccines(country_code);
CREATE TRIGGER trg_vaccines_updated_at BEFORE UPDATE ON public.vaccines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. vaccine_schedules (doses per vaccine)
CREATE TABLE public.vaccine_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vaccine_id uuid NOT NULL REFERENCES public.vaccines(id) ON DELETE CASCADE,
  country_code text NOT NULL,
  dose_number integer NOT NULL DEFAULT 1,
  dose_label_az text NOT NULL,
  recommended_age_days integer NOT NULL,
  age_label_az text NOT NULL,
  min_age_days integer,
  max_age_days integer,
  notes_az text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.vaccine_schedules TO anon, authenticated;
GRANT ALL ON public.vaccine_schedules TO service_role;
ALTER TABLE public.vaccine_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Schedules viewable by everyone" ON public.vaccine_schedules FOR SELECT USING (true);
CREATE POLICY "Only admins manage schedules" ON public.vaccine_schedules FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE INDEX idx_vaccine_schedules_country ON public.vaccine_schedules(country_code, recommended_age_days);
CREATE INDEX idx_vaccine_schedules_vaccine ON public.vaccine_schedules(vaccine_id);
CREATE TRIGGER trg_vaccine_schedules_updated_at BEFORE UPDATE ON public.vaccine_schedules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. child_vaccinations (per-child status tracker)
CREATE TABLE public.child_vaccinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  child_id uuid NOT NULL REFERENCES public.user_children(id) ON DELETE CASCADE,
  vaccine_schedule_id uuid NOT NULL REFERENCES public.vaccine_schedules(id) ON DELETE CASCADE,
  country_code text NOT NULL,
  administered_at date,
  is_skipped boolean NOT NULL DEFAULT false,
  skip_reason text,
  location_az text,
  batch_number text,
  notes text,
  reminder_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (child_id, vaccine_schedule_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.child_vaccinations TO authenticated;
GRANT ALL ON public.child_vaccinations TO service_role;
ALTER TABLE public.child_vaccinations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own child vaccinations" ON public.child_vaccinations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own child vaccinations" ON public.child_vaccinations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own child vaccinations" ON public.child_vaccinations FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own child vaccinations" ON public.child_vaccinations FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins manage all child vaccinations" ON public.child_vaccinations FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE INDEX idx_child_vacc_child ON public.child_vaccinations(child_id);
CREATE INDEX idx_child_vacc_user ON public.child_vaccinations(user_id);
CREATE TRIGGER trg_child_vacc_updated_at BEFORE UPDATE ON public.child_vaccinations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. add country_code to user_children
ALTER TABLE public.user_children ADD COLUMN IF NOT EXISTS country_code text NOT NULL DEFAULT 'AZ';
