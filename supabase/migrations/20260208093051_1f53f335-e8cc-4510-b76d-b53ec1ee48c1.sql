-- Flow Daily Logs table for symptom, mood, sleep, temperature tracking
CREATE TABLE IF NOT EXISTS public.flow_daily_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  -- Mood (1-5 scale)
  mood INTEGER CHECK (mood >= 1 AND mood <= 5),
  -- Energy level (1-5 scale)
  energy_level INTEGER CHECK (energy_level >= 1 AND energy_level <= 5),
  -- Symptoms (array of symptom keys)
  symptoms TEXT[] DEFAULT '{}',
  -- Pain level (0-10)
  pain_level INTEGER CHECK (pain_level >= 0 AND pain_level <= 10),
  -- Flow intensity (none, spotting, light, medium, heavy)
  flow_intensity TEXT CHECK (flow_intensity IN ('none', 'spotting', 'light', 'medium', 'heavy')),
  -- Sleep tracking
  sleep_hours NUMERIC(3,1) CHECK (sleep_hours >= 0 AND sleep_hours <= 24),
  sleep_quality INTEGER CHECK (sleep_quality >= 1 AND sleep_quality <= 5),
  -- Temperature tracking (BBT)
  temperature NUMERIC(4,2) CHECK (temperature >= 35 AND temperature <= 42),
  -- Water intake (glasses)
  water_glasses INTEGER DEFAULT 0 CHECK (water_glasses >= 0),
  -- Notes
  notes TEXT,
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Unique constraint per user per day
  UNIQUE(user_id, log_date)
);

-- Cycle History table for tracking past cycles
CREATE TABLE IF NOT EXISTS public.cycle_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  cycle_number INTEGER NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  cycle_length INTEGER,
  period_length INTEGER,
  ovulation_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, cycle_number)
);

-- Flow Reminders table
CREATE TABLE IF NOT EXISTS public.flow_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('period_start', 'period_end', 'ovulation', 'fertile_start', 'fertile_end', 'pms', 'pill', 'custom')),
  days_before INTEGER DEFAULT 0,
  time_of_day TIME DEFAULT '09:00',
  is_enabled BOOLEAN DEFAULT true,
  title TEXT,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, reminder_type)
);

-- Enable RLS
ALTER TABLE public.flow_daily_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cycle_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_reminders ENABLE ROW LEVEL SECURITY;

-- RLS Policies for flow_daily_logs
CREATE POLICY "Users can view own flow logs" ON public.flow_daily_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own flow logs" ON public.flow_daily_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own flow logs" ON public.flow_daily_logs
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own flow logs" ON public.flow_daily_logs
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for cycle_history
CREATE POLICY "Users can view own cycle history" ON public.cycle_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cycle history" ON public.cycle_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cycle history" ON public.cycle_history
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own cycle history" ON public.cycle_history
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for flow_reminders
CREATE POLICY "Users can view own flow reminders" ON public.flow_reminders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own flow reminders" ON public.flow_reminders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own flow reminders" ON public.flow_reminders
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own flow reminders" ON public.flow_reminders
  FOR DELETE USING (auth.uid() = user_id);

-- Flow Symptoms Database (admin-configurable)
CREATE TABLE IF NOT EXISTS public.flow_symptoms_db (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symptom_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  label_az TEXT,
  emoji TEXT,
  category TEXT DEFAULT 'physical' CHECK (category IN ('physical', 'emotional', 'digestive', 'skin', 'other')),
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS for symptoms_db (public read)
ALTER TABLE public.flow_symptoms_db ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active symptoms" ON public.flow_symptoms_db
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage symptoms" ON public.flow_symptoms_db
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Insert default symptoms
INSERT INTO public.flow_symptoms_db (symptom_key, label, label_az, emoji, category, sort_order) VALUES
  ('cramps', 'Cramps', 'Sancı', '😣', 'physical', 1),
  ('headache', 'Headache', 'Baş ağrısı', '🤕', 'physical', 2),
  ('back_pain', 'Back pain', 'Bel ağrısı', '🔙', 'physical', 3),
  ('breast_tenderness', 'Breast tenderness', 'Döş həssaslığı', '💗', 'physical', 4),
  ('fatigue', 'Fatigue', 'Yorğunluq', '😴', 'physical', 5),
  ('bloating', 'Bloating', 'Şişkinlik', '🫄', 'physical', 6),
  ('nausea', 'Nausea', 'Ürək bulanması', '🤢', 'digestive', 7),
  ('constipation', 'Constipation', 'Qəbizlik', '😖', 'digestive', 8),
  ('diarrhea', 'Diarrhea', 'İshal', '🚽', 'digestive', 9),
  ('cravings', 'Cravings', 'İştah', '🍫', 'digestive', 10),
  ('mood_swings', 'Mood swings', 'Əhval dəyişikliyi', '🎭', 'emotional', 11),
  ('anxiety', 'Anxiety', 'Narahatlıq', '😰', 'emotional', 12),
  ('irritability', 'Irritability', 'Əsəbilik', '😤', 'emotional', 13),
  ('sadness', 'Sadness', 'Kədər', '😢', 'emotional', 14),
  ('acne', 'Acne', 'Sızanaq', '😖', 'skin', 15),
  ('oily_skin', 'Oily skin', 'Yağlı dəri', '✨', 'skin', 16),
  ('insomnia', 'Insomnia', 'Yuxusuzluq', '🌙', 'other', 17),
  ('hot_flashes', 'Hot flashes', 'İstililik hissi', '🔥', 'other', 18),
  ('dizziness', 'Dizziness', 'Başgicəllənmə', '💫', 'other', 19),
  ('tender_muscles', 'Tender muscles', 'Əzələ ağrısı', '💪', 'physical', 20)
ON CONFLICT (symptom_key) DO NOTHING;

-- Insert default reminders configuration
INSERT INTO public.flow_reminders (user_id, reminder_type, days_before, time_of_day, is_enabled, title, message)
SELECT 
  p.user_id,
  r.reminder_type,
  r.days_before,
  r.time_of_day::TIME,
  r.is_enabled,
  r.title,
  r.message
FROM public.profiles p
CROSS JOIN (
  VALUES 
    ('period_start', 2, '09:00', true, 'Period yaxınlaşır', 'Perioda 2 gün qaldı'),
    ('ovulation', 1, '09:00', true, 'Ovulyasiya yaxınlaşır', 'Sabah ovulyasiya günüdür'),
    ('fertile_start', 1, '09:00', true, 'Məhsuldar günlər başlayır', 'Sabahdan məhsuldar günlər başlayır')
) AS r(reminder_type, days_before, time_of_day, is_enabled, title, message)
WHERE p.life_stage = 'flow'
ON CONFLICT (user_id, reminder_type) DO NOTHING;