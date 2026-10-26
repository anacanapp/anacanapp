-- EPDS Questions table for depression assessment
CREATE TABLE public.epds_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question_number INT NOT NULL,
  question_text TEXT NOT NULL,
  question_text_az TEXT,
  options JSONB NOT NULL DEFAULT '[]',
  is_reverse_scored BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Mood levels table
CREATE TABLE public.mood_levels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mood_value INT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  label_az TEXT,
  emoji TEXT NOT NULL,
  color TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Breathing exercises table
CREATE TABLE public.breathing_exercises (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  name_az TEXT,
  description TEXT,
  description_az TEXT,
  icon TEXT,
  color TEXT,
  inhale_seconds INT NOT NULL DEFAULT 4,
  hold_seconds INT DEFAULT 0,
  exhale_seconds INT NOT NULL DEFAULT 4,
  hold_after_exhale_seconds INT DEFAULT 0,
  total_cycles INT DEFAULT 4,
  benefits TEXT[],
  benefits_az TEXT[],
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Noise thresholds table
CREATE TABLE public.noise_thresholds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  threshold_key TEXT NOT NULL UNIQUE,
  min_db INT NOT NULL,
  max_db INT,
  label TEXT NOT NULL,
  label_az TEXT,
  color TEXT,
  emoji TEXT,
  description TEXT,
  description_az TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.epds_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mood_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.breathing_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.noise_thresholds ENABLE ROW LEVEL SECURITY;

-- Public read policies (content is public)
CREATE POLICY "Anyone can read EPDS questions" ON public.epds_questions FOR SELECT USING (true);
CREATE POLICY "Anyone can read mood levels" ON public.mood_levels FOR SELECT USING (true);
CREATE POLICY "Anyone can read breathing exercises" ON public.breathing_exercises FOR SELECT USING (true);
CREATE POLICY "Anyone can read noise thresholds" ON public.noise_thresholds FOR SELECT USING (true);

-- Admin write policies
CREATE POLICY "Admins can manage EPDS questions" ON public.epds_questions FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage mood levels" ON public.mood_levels FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage breathing exercises" ON public.breathing_exercises FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage noise thresholds" ON public.noise_thresholds FOR ALL USING (public.has_role(auth.uid(), 'admin'));