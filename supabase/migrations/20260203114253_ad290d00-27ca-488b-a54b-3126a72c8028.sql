
-- 1. Horoscope Element Configurations
CREATE TABLE public.horoscope_elements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  element_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  name_az TEXT,
  icon TEXT NOT NULL DEFAULT 'Sparkles',
  color TEXT NOT NULL DEFAULT '#8B5CF6',
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.horoscope_elements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read horoscope_elements" ON public.horoscope_elements FOR SELECT USING (true);
CREATE POLICY "Admin manage horoscope_elements" ON public.horoscope_elements FOR ALL USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.horoscope_elements (element_key, name, name_az, icon, color, sort_order) VALUES
  ('fire', 'Fire', 'Od', 'Flame', '#EF4444', 1),
  ('earth', 'Earth', 'Torpaq', 'Mountain', '#22C55E', 2),
  ('air', 'Air', 'Hava', 'Wind', '#3B82F6', 3),
  ('water', 'Water', 'Su', 'Droplets', '#06B6D4', 4);

-- 2. Horoscope Loading Steps
CREATE TABLE public.horoscope_loading_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  step_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  label_az TEXT,
  icon TEXT NOT NULL DEFAULT 'Star',
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.horoscope_loading_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read horoscope_loading_steps" ON public.horoscope_loading_steps FOR SELECT USING (true);
CREATE POLICY "Admin manage horoscope_loading_steps" ON public.horoscope_loading_steps FOR ALL USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.horoscope_loading_steps (step_key, label, label_az, icon, sort_order) VALUES
  ('calculating', 'Calculating planetary positions...', 'Planet mövqeləri hesablanır...', 'Sparkles', 1),
  ('analyzing', 'Analyzing cosmic connections...', 'Kosmik əlaqələr analiz edilir...', 'Stars', 2),
  ('reading', 'Reading the celestial map...', 'Səma xəritəsi oxunur...', 'Moon', 3),
  ('preparing', 'Preparing your cosmic report...', 'Kosmik hesabatınız hazırlanır...', 'FileText', 4);

-- 3. Time Options for Horoscope
CREATE TABLE public.time_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  option_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  label_az TEXT,
  hour_value INT,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.time_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read time_options" ON public.time_options FOR SELECT USING (true);
CREATE POLICY "Admin manage time_options" ON public.time_options FOR ALL USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.time_options (option_key, label, label_az, hour_value, sort_order) VALUES
  ('unknown', 'Bilmirəm', 'Bilmirəm', NULL, 0),
  ('morning', 'Səhər (06:00-12:00)', 'Səhər (06:00-12:00)', 9, 1),
  ('afternoon', 'Günorta (12:00-18:00)', 'Günorta (12:00-18:00)', 15, 2),
  ('evening', 'Axşam (18:00-00:00)', 'Axşam (18:00-00:00)', 21, 3),
  ('night', 'Gecə (00:00-06:00)', 'Gecə (00:00-06:00)', 3, 4);

-- 4. Cry Type Labels
CREATE TABLE public.cry_type_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cry_type TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  label_az TEXT,
  emoji TEXT DEFAULT '😢',
  color TEXT DEFAULT '#EF4444',
  description_az TEXT,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.cry_type_labels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read cry_type_labels" ON public.cry_type_labels FOR SELECT USING (true);
CREATE POLICY "Admin manage cry_type_labels" ON public.cry_type_labels FOR ALL USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.cry_type_labels (cry_type, label, label_az, emoji, color, description_az, sort_order) VALUES
  ('hungry', 'Hungry', 'Ac', '🍼', '#F59E0B', 'Körpəniz ac ola bilər', 1),
  ('tired', 'Tired', 'Yorğun', '😴', '#8B5CF6', 'Körpəniz yuxulamaq istəyir', 2),
  ('discomfort', 'Discomfort', 'Narahat', '😣', '#EF4444', 'Körpəniz narahatdır', 3),
  ('pain', 'Pain', 'Ağrı', '😢', '#DC2626', 'Körpəniz ağrı hiss edə bilər', 4),
  ('attention', 'Needs Attention', 'Diqqət istəyir', '🤗', '#3B82F6', 'Körpəniz sizinlə olmaq istəyir', 5),
  ('overstimulated', 'Overstimulated', 'Həddən artıq stimulyasiya', '😵', '#6366F1', 'Körpəniz yorulub', 6),
  ('colic', 'Colic', 'Kolik', '😖', '#EC4899', 'Mədə ağrısı ola bilər', 7),
  ('unknown', 'Unknown', 'Naməlum', '❓', '#6B7280', 'Səbəbi müəyyən edilmədi', 8);

-- 5. Poop Color Labels
CREATE TABLE public.poop_color_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  color_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  label_az TEXT,
  emoji TEXT DEFAULT '💩',
  hex_color TEXT DEFAULT '#8B4513',
  status TEXT DEFAULT 'normal',
  description_az TEXT,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.poop_color_labels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read poop_color_labels" ON public.poop_color_labels FOR SELECT USING (true);
CREATE POLICY "Admin manage poop_color_labels" ON public.poop_color_labels FOR ALL USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.poop_color_labels (color_key, label, label_az, emoji, hex_color, status, description_az, sort_order) VALUES
  ('yellow', 'Yellow', 'Sarı', '🟡', '#FCD34D', 'normal', 'Normal - ana südü ilə qidalanan körpələrdə tez-tez görülür', 1),
  ('brown', 'Brown', 'Qəhvəyi', '🟤', '#8B4513', 'normal', 'Normal - sağlam nəcis', 2),
  ('green', 'Green', 'Yaşıl', '🟢', '#22C55E', 'normal', 'Adətən normal - qida və ya dərmanlardan ola bilər', 3),
  ('black', 'Black', 'Qara', '⚫', '#1F2937', 'warning', 'Həkimə müraciət edin - dəmir preparatları və ya həzm qanaxması', 4),
  ('red', 'Red', 'Qırmızı', '🔴', '#EF4444', 'danger', 'Dərhal həkimə müraciət! - qan ola bilər', 5),
  ('white', 'White', 'Ağ', '⚪', '#F3F4F6', 'danger', 'Dərhal həkimə müraciət! - qaraciyər problemi ola bilər', 6),
  ('orange', 'Orange', 'Narıncı', '🟠', '#F97316', 'normal', 'Normal - beta-karotin olan qidalardan', 7);

-- 6. Temperature Emoji Mapping (for Weather)
CREATE TABLE public.temperature_emojis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  min_temp INT NOT NULL,
  max_temp INT NOT NULL,
  emoji TEXT NOT NULL,
  label TEXT NOT NULL,
  label_az TEXT,
  clothing_tip_az TEXT,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.temperature_emojis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read temperature_emojis" ON public.temperature_emojis FOR SELECT USING (true);
CREATE POLICY "Admin manage temperature_emojis" ON public.temperature_emojis FOR ALL USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.temperature_emojis (min_temp, max_temp, emoji, label, label_az, clothing_tip_az, sort_order) VALUES
  (-50, 0, '🥶', 'Freezing', 'Dondurucu', 'Qalın palto, şapka, əlcək mütləqdir', 1),
  (1, 10, '❄️', 'Cold', 'Soyuq', 'Qış paltarları geyinin', 2),
  (11, 15, '🌬️', 'Cool', 'Sərin', 'Yüngül gödəkçə tövsiyə olunur', 3),
  (16, 20, '🌤️', 'Mild', 'Mülayim', 'Sviter və ya nazik gödəkçə', 4),
  (21, 25, '☀️', 'Warm', 'İsti', 'Yüngül paltar yetərlidir', 5),
  (26, 30, '🌡️', 'Hot', 'Çox isti', 'Açıq rəngli, nəfəs alan paltarlar', 6),
  (31, 50, '🔥', 'Very Hot', 'Həddən artıq isti', 'Günəşdən qorunun, çox su için', 7);

-- 7. Marketplace Categories
CREATE TABLE public.marketplace_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  label_az TEXT,
  emoji TEXT DEFAULT '📦',
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.marketplace_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read marketplace_categories" ON public.marketplace_categories FOR SELECT USING (true);
CREATE POLICY "Admin manage marketplace_categories" ON public.marketplace_categories FOR ALL USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.marketplace_categories (category_key, label, label_az, emoji, sort_order) VALUES
  ('all', 'All', 'Hamısı', '📦', 0),
  ('clothing', 'Clothing', 'Geyim', '👕', 1),
  ('toys', 'Toys', 'Oyuncaqlar', '🧸', 2),
  ('furniture', 'Furniture', 'Mebel', '🪑', 3),
  ('strollers', 'Strollers', 'Arabalar', '🚼', 4),
  ('feeding', 'Feeding', 'Qidalanma', '🍼', 5),
  ('safety', 'Safety', 'Təhlükəsizlik', '🛡️', 6),
  ('books', 'Books', 'Kitablar', '📚', 7),
  ('other', 'Other', 'Digər', '📦', 8);

-- 8. Product Conditions
CREATE TABLE public.product_conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condition_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  label_az TEXT,
  emoji TEXT DEFAULT '✨',
  color TEXT DEFAULT '#22C55E',
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.product_conditions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read product_conditions" ON public.product_conditions FOR SELECT USING (true);
CREATE POLICY "Admin manage product_conditions" ON public.product_conditions FOR ALL USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.product_conditions (condition_key, label, label_az, emoji, color, sort_order) VALUES
  ('new', 'New', 'Yeni', '✨', '#22C55E', 1),
  ('like_new', 'Like New', 'Yeni kimi', '🌟', '#3B82F6', 2),
  ('good', 'Good', 'Yaxşı', '👍', '#F59E0B', 3),
  ('fair', 'Fair', 'Orta', '👌', '#6B7280', 4);

-- 9. Age Ranges for Products
CREATE TABLE public.age_ranges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  range_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  label_az TEXT,
  min_months INT DEFAULT 0,
  max_months INT,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.age_ranges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read age_ranges" ON public.age_ranges FOR SELECT USING (true);
CREATE POLICY "Admin manage age_ranges" ON public.age_ranges FOR ALL USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.age_ranges (range_key, label, label_az, min_months, max_months, sort_order) VALUES
  ('all', 'All Ages', 'Bütün yaşlar', 0, NULL, 0),
  ('0-3', '0-3 months', '0-3 ay', 0, 3, 1),
  ('3-6', '3-6 months', '3-6 ay', 3, 6, 2),
  ('6-12', '6-12 months', '6-12 ay', 6, 12, 3),
  ('1-2', '1-2 years', '1-2 yaş', 12, 24, 4),
  ('2-4', '2-4 years', '2-4 yaş', 24, 48, 5),
  ('4+', '4+ years', '4+ yaş', 48, NULL, 6);

-- 10. Provider Types (Doctors/Hospitals)
CREATE TABLE public.provider_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  label_az TEXT,
  emoji TEXT DEFAULT '🏥',
  color TEXT DEFAULT '#3B82F6',
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.provider_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read provider_types" ON public.provider_types FOR SELECT USING (true);
CREATE POLICY "Admin manage provider_types" ON public.provider_types FOR ALL USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.provider_types (type_key, label, label_az, emoji, color, sort_order) VALUES
  ('hospital', 'Hospital', 'Xəstəxana', '🏥', '#EF4444', 1),
  ('clinic', 'Clinic', 'Klinika', '🏪', '#3B82F6', 2),
  ('doctor', 'Doctor', 'Həkim', '👨‍⚕️', '#22C55E', 3),
  ('pharmacy', 'Pharmacy', 'Aptek', '💊', '#8B5CF6', 4),
  ('laboratory', 'Laboratory', 'Laboratoriya', '🔬', '#F59E0B', 5);

-- 11. Day Labels
CREATE TABLE public.day_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  label_az TEXT,
  short_label TEXT,
  short_label_az TEXT,
  day_number INT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.day_labels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read day_labels" ON public.day_labels FOR SELECT USING (true);
CREATE POLICY "Admin manage day_labels" ON public.day_labels FOR ALL USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.day_labels (day_key, label, label_az, short_label, short_label_az, day_number) VALUES
  ('monday', 'Monday', 'Bazar ertəsi', 'Mon', 'B.e', 1),
  ('tuesday', 'Tuesday', 'Çərşənbə axşamı', 'Tue', 'Ç.a', 2),
  ('wednesday', 'Wednesday', 'Çərşənbə', 'Wed', 'Ç', 3),
  ('thursday', 'Thursday', 'Cümə axşamı', 'Thu', 'C.a', 4),
  ('friday', 'Friday', 'Cümə', 'Fri', 'C', 5),
  ('saturday', 'Saturday', 'Şənbə', 'Sat', 'Ş', 6),
  ('sunday', 'Sunday', 'Bazar', 'Sun', 'B', 0);

-- 12. Exercise Daily Tips
CREATE TABLE public.exercise_daily_tips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tip TEXT NOT NULL,
  tip_az TEXT,
  emoji TEXT DEFAULT '💡',
  trimester INT[],
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.exercise_daily_tips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read exercise_daily_tips" ON public.exercise_daily_tips FOR SELECT USING (true);
CREATE POLICY "Admin manage exercise_daily_tips" ON public.exercise_daily_tips FOR ALL USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.exercise_daily_tips (tip, tip_az, emoji, trimester, sort_order) VALUES
  ('Stay hydrated during exercise', 'Məşq zamanı kifayət qədər su için', '💧', ARRAY[1,2,3], 1),
  ('Listen to your body', 'Bədəninizi dinləyin və yorulduqda istirahət edin', '🧘', ARRAY[1,2,3], 2),
  ('Warm up before exercise', 'Məşqdən əvvəl istiləşin', '🔥', ARRAY[1,2,3], 3),
  ('Avoid lying flat after first trimester', 'Birinci trimestrdan sonra uzanmaqdan çəkinin', '⚠️', ARRAY[2,3], 4),
  ('Walking is great for pregnancy', 'Gəzinti hamiləlik üçün əladır', '🚶‍♀️', ARRAY[1,2,3], 5),
  ('Breathe deeply during exercises', 'Məşq zamanı dərin nəfəs alın', '🌬️', ARRAY[1,2,3], 6),
  ('Pelvic floor exercises are important', 'Pelvik döşəmə məşqləri vacibdir', '💪', ARRAY[1,2,3], 7),
  ('Consult your doctor before starting', 'Başlamazdan əvvəl həkiminizlə məsləhətləşin', '👨‍⚕️', ARRAY[1,2,3], 8);
