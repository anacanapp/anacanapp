-- =====================================================
-- Migration: Remaining hardcoded data to backend
-- =====================================================

-- 1. PLACE CATEGORIES (MomFriendlyMap)
CREATE TABLE IF NOT EXISTS public.place_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  label_az TEXT,
  icon_name TEXT NOT NULL DEFAULT 'MapPin',
  color_gradient TEXT DEFAULT 'from-pink-500 to-rose-600',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.place_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view place categories" ON public.place_categories FOR SELECT USING (true);
CREATE POLICY "Admins can manage place categories" ON public.place_categories FOR ALL USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.place_categories (category_key, label, label_az, icon_name, color_gradient, sort_order) VALUES
  ('all', 'All', 'Hamısı', 'MapPin', 'from-pink-500 to-rose-600', 0),
  ('cafe', 'Cafe', 'Kafe', 'Utensils', 'from-amber-500 to-orange-600', 1),
  ('restaurant', 'Restaurant', 'Restoran', 'Utensils', 'from-red-500 to-rose-600', 2),
  ('mall', 'Mall', 'Mall', 'Building2', 'from-blue-500 to-indigo-600', 3),
  ('park', 'Park', 'Park', 'TreePine', 'from-emerald-500 to-green-600', 4),
  ('hospital', 'Hospital', 'Xəstəxana', 'Heart', 'from-rose-500 to-pink-600', 5),
  ('metro', 'Metro', 'Metro', 'Train', 'from-violet-500 to-purple-600', 6),
  ('pharmacy', 'Pharmacy', 'Aptek', 'Pill', 'from-cyan-500 to-teal-600', 7),
  ('playground', 'Playground', 'Oyun Meydançası', 'PlayCircle', 'from-fuchsia-500 to-pink-600', 8)
ON CONFLICT (category_key) DO NOTHING;

-- 2. PLACE AMENITIES (MomFriendlyMap)
CREATE TABLE IF NOT EXISTS public.place_amenities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amenity_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  label_az TEXT,
  emoji TEXT DEFAULT '✅',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.place_amenities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view place amenities" ON public.place_amenities FOR SELECT USING (true);
CREATE POLICY "Admins can manage place amenities" ON public.place_amenities FOR ALL USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.place_amenities (amenity_key, label, label_az, emoji, sort_order) VALUES
  ('has_breastfeeding_room', 'Breastfeeding room', 'Əmizdirmə otağı', '🤱', 1),
  ('has_changing_table', 'Changing table', 'Dəyişdirmə masası', '👶', 2),
  ('has_elevator', 'Elevator', 'Lift', '🛗', 3),
  ('has_ramp', 'Ramp', 'Pandus', '♿', 4),
  ('has_stroller_access', 'Stroller access', 'Araba ilə giriş', '🚼', 5),
  ('has_kids_menu', 'Kids menu', 'Uşaq menyusu', '🍽️', 6),
  ('has_play_area', 'Play area', 'Oyun guşəsi', '🎠', 7),
  ('has_high_chair', 'High chair', 'Uşaq oturacağı', '🪑', 8),
  ('has_parking', 'Parking', 'Parkinq', '🅿️', 9)
ON CONFLICT (amenity_key) DO NOTHING;

-- 3. PARTNER ACHIEVEMENTS
CREATE TABLE IF NOT EXISTS public.partner_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  achievement_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  name_az TEXT,
  emoji TEXT NOT NULL DEFAULT '🏆',
  description TEXT,
  description_az TEXT,
  unlock_condition TEXT,
  unlock_threshold INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.partner_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view partner achievements" ON public.partner_achievements FOR SELECT USING (true);
CREATE POLICY "Admins can manage partner achievements" ON public.partner_achievements FOR ALL USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.partner_achievements (achievement_key, name, name_az, emoji, unlock_condition, unlock_threshold, sort_order) VALUES
  ('first_love', 'First Love', 'İlk Sevgi', '💕', 'always_unlocked', 0, 1),
  ('supporter', 'Supporter', 'Dəstəkçi', '🤝', 'always_unlocked', 0, 2),
  ('caring', 'Caring', 'Qayğıkeş', '🌟', 'completed_surprises', 3, 3),
  ('super_partner', 'Super Partner', 'Super Partner', '🏆', 'completed_surprises', 10, 4),
  ('family_hero', 'Family Hero', 'Ailə Qəhrəmanı', '👑', 'surprise_points', 500, 5)
ON CONFLICT (achievement_key) DO NOTHING;

-- 4. PARTNER MENU ITEMS
CREATE TABLE IF NOT EXISTS public.partner_menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  label_az TEXT,
  icon_name TEXT NOT NULL DEFAULT 'Settings',
  route TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.partner_menu_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view partner menu items" ON public.partner_menu_items FOR SELECT USING (true);
CREATE POLICY "Admins can manage partner menu items" ON public.partner_menu_items FOR ALL USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.partner_menu_items (menu_key, label, label_az, icon_name, route, sort_order) VALUES
  ('notifications', 'Notifications', 'Bildirişlər', 'Bell', 'notifications', 1),
  ('partner-privacy', 'Privacy', 'Gizlilik', 'Shield', 'partner-privacy', 2),
  ('help', 'Help', 'Yardım', 'HelpCircle', 'help', 3)
ON CONFLICT (menu_key) DO NOTHING;

-- 5. TRIMESTER INFO (AdminTrimesterTips)
CREATE TABLE IF NOT EXISTS public.trimester_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trimester_number INTEGER NOT NULL UNIQUE,
  label TEXT NOT NULL,
  label_az TEXT,
  emoji TEXT NOT NULL DEFAULT '🌱',
  color_class TEXT DEFAULT 'bg-green-500/10 border-green-500/30',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.trimester_info ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view trimester info" ON public.trimester_info FOR SELECT USING (true);
CREATE POLICY "Admins can manage trimester info" ON public.trimester_info FOR ALL USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.trimester_info (trimester_number, label, label_az, emoji, color_class) VALUES
  (1, '1st Trimester', '1-ci Trimester', '🌱', 'bg-green-500/10 border-green-500/30'),
  (2, '2nd Trimester', '2-ci Trimester', '🌸', 'bg-amber-500/10 border-amber-500/30'),
  (3, '3rd Trimester', '3-cü Trimester', '🍼', 'bg-primary/10 border-primary/30')
ON CONFLICT (trimester_number) DO NOTHING;

-- 6. SKILL CATEGORIES (SmartPlayBox / AdminPlayActivities)
CREATE TABLE IF NOT EXISTS public.skill_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  label_az TEXT,
  emoji TEXT DEFAULT '✨',
  icon_name TEXT DEFAULT 'Star',
  color TEXT DEFAULT 'bg-gray-500',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.skill_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view skill categories" ON public.skill_categories FOR SELECT USING (true);
CREATE POLICY "Admins can manage skill categories" ON public.skill_categories FOR ALL USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.skill_categories (skill_key, label, label_az, emoji, icon_name, color, sort_order) VALUES
  ('motor', 'Motor Skills', 'Motor Bacarıqları', '🏃', 'Move', 'bg-blue-500', 1),
  ('sensory', 'Sensory Development', 'Hissi İnkişaf', '👁️', 'Eye', 'bg-purple-500', 2),
  ('cognitive', 'Cognitive', 'İdrak', '🧠', 'Brain', 'bg-amber-500', 3),
  ('language', 'Language', 'Dil', '💬', 'MessageCircle', 'bg-green-500', 4),
  ('social', 'Social', 'Sosial', '👥', 'Users', 'bg-pink-500', 5)
ON CONFLICT (skill_key) DO NOTHING;

-- 7. SURPRISE CATEGORIES (for Partner Profile getCategoryLabel)
CREATE TABLE IF NOT EXISTS public.surprise_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  label_az TEXT,
  emoji TEXT DEFAULT '✨',
  color_gradient TEXT DEFAULT 'from-blue-500 to-indigo-600',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.surprise_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view surprise categories" ON public.surprise_categories FOR SELECT USING (true);
CREATE POLICY "Admins can manage surprise categories" ON public.surprise_categories FOR ALL USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.surprise_categories (category_key, label, label_az, emoji, color_gradient, sort_order) VALUES
  ('romantic', 'Romantic', 'Romantik', '❤️', 'from-pink-500 to-rose-600', 1),
  ('care', 'Care', 'Qayğı', '🤗', 'from-violet-500 to-purple-600', 2),
  ('adventure', 'Adventure', 'Macəra', '🌟', 'from-amber-500 to-orange-600', 3),
  ('gift', 'Gift', 'Hədiyyə', '🎁', 'from-emerald-500 to-teal-600', 4)
ON CONFLICT (category_key) DO NOTHING;