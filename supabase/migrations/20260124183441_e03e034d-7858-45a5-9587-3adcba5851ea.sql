-- 1. Məşqlər cədvəli
CREATE TABLE public.exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_az TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 10,
  calories INTEGER NOT NULL DEFAULT 50,
  level TEXT NOT NULL DEFAULT 'easy' CHECK (level IN ('easy', 'medium', 'hard')),
  trimester INTEGER[] DEFAULT '{1,2,3}',
  icon TEXT DEFAULT '🧘',
  description TEXT,
  steps JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Bəyaz küy səsləri
CREATE TABLE public.white_noise_sounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_az TEXT,
  emoji TEXT DEFAULT '🎵',
  color_gradient TEXT DEFAULT 'from-blue-400 to-cyan-500',
  audio_url TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Foto sessiya mövzuları
CREATE TABLE public.photoshoot_themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL CHECK (category IN ('background', 'outfit', 'accessory')),
  name TEXT NOT NULL,
  name_az TEXT,
  emoji TEXT,
  prompt_text TEXT,
  preview_url TEXT,
  is_premium BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Sürpriz ideyaları
CREATE TABLE public.surprise_ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  emoji TEXT DEFAULT '🎁',
  icon TEXT DEFAULT 'gift',
  category TEXT NOT NULL DEFAULT 'romantic' CHECK (category IN ('romantic', 'care', 'adventure', 'gift')),
  difficulty TEXT DEFAULT 'easy' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  points INTEGER DEFAULT 10,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Körpə inkişaf mərhələləri
CREATE TABLE public.baby_milestones_db (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_key TEXT UNIQUE NOT NULL,
  week_number INTEGER NOT NULL,
  label TEXT NOT NULL,
  label_az TEXT,
  emoji TEXT DEFAULT '👶',
  description TEXT,
  description_az TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Simptomlar
CREATE TABLE public.symptoms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symptom_key TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  label_az TEXT,
  icon TEXT DEFAULT '🤕',
  life_stages TEXT[] DEFAULT '{flow,bump,mommy}',
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Əhval seçimləri
CREATE TABLE public.mood_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  value INTEGER UNIQUE NOT NULL CHECK (value >= 1 AND value <= 5),
  label TEXT NOT NULL,
  label_az TEXT,
  emoji TEXT NOT NULL,
  color_class TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Ümumi qidalar (tez əlavə et)
CREATE TABLE public.common_foods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_az TEXT,
  calories INTEGER NOT NULL,
  emoji TEXT DEFAULT '🍽️',
  category TEXT DEFAULT 'general',
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. Mağaza kateqoriyaları
CREATE TABLE public.shop_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  name_az TEXT,
  emoji TEXT DEFAULT '📦',
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.white_noise_sounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photoshoot_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surprise_ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.baby_milestones_db ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.symptoms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mood_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.common_foods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_categories ENABLE ROW LEVEL SECURITY;

-- Public read policies (everyone can read active items)
CREATE POLICY "Anyone can read active exercises" ON public.exercises FOR SELECT USING (is_active = true);
CREATE POLICY "Anyone can read active sounds" ON public.white_noise_sounds FOR SELECT USING (is_active = true);
CREATE POLICY "Anyone can read active themes" ON public.photoshoot_themes FOR SELECT USING (is_active = true);
CREATE POLICY "Anyone can read active surprises" ON public.surprise_ideas FOR SELECT USING (is_active = true);
CREATE POLICY "Anyone can read active milestones" ON public.baby_milestones_db FOR SELECT USING (is_active = true);
CREATE POLICY "Anyone can read active symptoms" ON public.symptoms FOR SELECT USING (is_active = true);
CREATE POLICY "Anyone can read active moods" ON public.mood_options FOR SELECT USING (is_active = true);
CREATE POLICY "Anyone can read active foods" ON public.common_foods FOR SELECT USING (is_active = true);
CREATE POLICY "Anyone can read active categories" ON public.shop_categories FOR SELECT USING (is_active = true);

-- Admin full access policies
CREATE POLICY "Admins can manage exercises" ON public.exercises FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage sounds" ON public.white_noise_sounds FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage themes" ON public.photoshoot_themes FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage surprises" ON public.surprise_ideas FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage milestones" ON public.baby_milestones_db FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage symptoms" ON public.symptoms FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage moods" ON public.mood_options FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage foods" ON public.common_foods FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage shop categories" ON public.shop_categories FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));