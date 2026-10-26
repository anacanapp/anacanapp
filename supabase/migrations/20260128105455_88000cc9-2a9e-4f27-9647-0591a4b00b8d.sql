-- Create quick_actions table for dashboard quick action buttons
CREATE TABLE public.quick_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  life_stage TEXT NOT NULL DEFAULT 'mommy',
  age_group TEXT NOT NULL DEFAULT 'all',
  icon TEXT NOT NULL,
  label TEXT NOT NULL,
  label_az TEXT,
  tool_key TEXT NOT NULL,
  color_from TEXT NOT NULL DEFAULT 'pink-400',
  color_to TEXT NOT NULL DEFAULT 'rose-500',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create development_tips table for age-based tips
CREATE TABLE public.development_tips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  age_group TEXT NOT NULL,
  emoji TEXT NOT NULL,
  title TEXT NOT NULL,
  title_az TEXT,
  content TEXT NOT NULL,
  content_az TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.quick_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.development_tips ENABLE ROW LEVEL SECURITY;

-- Public read policies (content is public)
CREATE POLICY "Quick actions are publicly readable"
  ON public.quick_actions FOR SELECT
  USING (true);

CREATE POLICY "Development tips are publicly readable"
  ON public.development_tips FOR SELECT
  USING (true);

-- Admin write policies
CREATE POLICY "Admins can manage quick actions"
  ON public.quick_actions FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage development tips"
  ON public.development_tips FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Insert dummy data for quick_actions (newborn)
INSERT INTO public.quick_actions (life_stage, age_group, icon, label, label_az, tool_key, color_from, color_to, sort_order) VALUES
('mommy', 'newborn', 'Baby', 'Cry', 'Ağlama', 'cry-translator', 'pink-400', 'rose-500', 1),
('mommy', 'newborn', 'Thermometer', 'Poop', 'Nəcis', 'poop-scanner', 'amber-400', 'orange-500', 2),
('mommy', 'newborn', 'Music', 'White Noise', 'Ağ Səs', 'white-noise', 'violet-400', 'purple-500', 3),
('mommy', 'newborn', 'AlertCircle', 'First Aid', 'İlk Yardım', 'first-aid', 'red-400', 'rose-600', 4);

-- Insert dummy data for quick_actions (older babies)
INSERT INTO public.quick_actions (life_stage, age_group, icon, label, label_az, tool_key, color_from, color_to, sort_order) VALUES
('mommy', 'older', 'Sparkles', 'Play', 'Oyun', 'smart-play', 'emerald-400', 'teal-500', 1),
('mommy', 'older', 'BookOpen', 'Fairy Tale', 'Nağıl', 'fairy-tales', 'violet-400', 'purple-500', 2),
('mommy', 'older', 'Camera', 'Photo', 'Foto', 'baby-photo', 'pink-400', 'rose-500', 3),
('mommy', 'older', 'Stethoscope', 'Doctor', 'Həkim', 'doctor-report', 'blue-400', 'cyan-500', 4);

-- Insert dummy data for development_tips (newborn 0-3 months)
INSERT INTO public.development_tips (age_group, emoji, title, title_az, content, content_az, sort_order) VALUES
('newborn', '👁️', 'Eye Contact', 'Göz Təması', 'Make eye contact with your baby at 20-30 cm distance', 'Körpənizlə 20-30 sm məsafədə göz təması qurun', 1),
('newborn', '🎵', 'Sound Games', 'Səs Oyunları', 'Make soft sounds, baby is learning to recognize voices', 'Yumşaq səslər çıxarın, körpə səsləri tanımağı öyrənir', 2),
('newborn', '🤲', 'Tummy Time', 'Qarın Üstə', 'Place baby on tummy for 3-5 minutes daily', 'Gündə 3-5 dəqiqə qarın üstə yatırın', 3);

-- Insert dummy data for development_tips (infant 3-6 months)
INSERT INTO public.development_tips (age_group, emoji, title, title_az, content, content_az, sort_order) VALUES
('infant', '🧸', 'Grasping Objects', 'Əşya Tutma', 'Develop grasping skills with colorful toys', 'Rəngli oyuncaqlarla tutma bacarığını inkişaf etdirin', 1),
('infant', '📖', 'Reading Books', 'Kitab Oxuma', 'Show picture books, helps language development', 'Təsvirli kitablar göstərin, dil inkişafına kömək edir', 2),
('infant', '🎶', 'Music', 'Musiqi', 'Sing children songs, develops sense of rhythm', 'Uşaq mahnıları oxuyun, ritm hissi inkişaf edir', 3);

-- Insert dummy data for development_tips (older 6+ months)
INSERT INTO public.development_tips (age_group, emoji, title, title_az, content, content_az, sort_order) VALUES
('older', '🥣', 'Solid Foods', 'Əlavə Qida', 'Gradually introduce new flavors', 'Yeni dadları tədricən tanışdırın', 1),
('older', '🚶', 'Movement', 'Hərəkət', 'Support crawling and sitting exercises', 'Sürünmə və oturma məşqləri dəstəkləyin', 2),
('older', '🗣️', 'Speech', 'Danışıq', 'Repeat simple words, speeds up language development', 'Sadə sözləri təkrarlayın, dil inkişafı sürətlənir', 3);