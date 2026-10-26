-- Create flow-specific tables for enhanced functionality

-- Flow tips for each phase
CREATE TABLE IF NOT EXISTS public.flow_phase_tips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phase TEXT NOT NULL CHECK (phase IN ('menstrual', 'follicular', 'ovulation', 'luteal')),
  tip_text TEXT NOT NULL,
  tip_text_az TEXT,
  emoji TEXT DEFAULT '💡',
  category TEXT DEFAULT 'general',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Flow symptoms database
CREATE TABLE IF NOT EXISTS public.flow_symptoms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  symptom_id TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  label_az TEXT,
  emoji TEXT NOT NULL,
  category TEXT DEFAULT 'common',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Flow cycle insights (articles/tips for flow users)
CREATE TABLE IF NOT EXISTS public.flow_insights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  title_az TEXT,
  content TEXT NOT NULL,
  content_az TEXT,
  phase TEXT,
  emoji TEXT DEFAULT '📚',
  category TEXT DEFAULT 'health',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- App branding settings for images
CREATE TABLE IF NOT EXISTS public.app_branding (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  image_url TEXT,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.flow_phase_tips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_symptoms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_branding ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Anyone can read flow phase tips" ON public.flow_phase_tips FOR SELECT USING (true);
CREATE POLICY "Anyone can read flow symptoms" ON public.flow_symptoms FOR SELECT USING (true);
CREATE POLICY "Anyone can read flow insights" ON public.flow_insights FOR SELECT USING (true);
CREATE POLICY "Anyone can read app branding" ON public.app_branding FOR SELECT USING (true);

-- Admin write access
CREATE POLICY "Admins can manage flow phase tips" ON public.flow_phase_tips FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can manage flow symptoms" ON public.flow_symptoms FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can manage flow insights" ON public.flow_insights FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can manage app branding" ON public.app_branding FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default branding
INSERT INTO public.app_branding (key, description) VALUES
('splash_screen', 'Tətbiq açılarkən görünən şəkil'),
('login_logo', 'Giriş ekranındakı logo')
ON CONFLICT (key) DO NOTHING;

-- Insert default flow symptoms
INSERT INTO public.flow_symptoms (symptom_id, label, label_az, emoji, category, sort_order) VALUES
('headache', 'Headache', 'Baş ağrısı', '🤕', 'pain', 1),
('cramps', 'Cramps', 'Sancı', '😣', 'pain', 2),
('backpain', 'Back pain', 'Bel ağrısı', '🔙', 'pain', 3),
('tired', 'Fatigue', 'Yorğunluq', '😴', 'energy', 4),
('mood', 'Mood swings', 'Əhval dəyişikliyi', '😤', 'emotional', 5),
('anxiety', 'Anxiety', 'Narahatlıq', '😰', 'emotional', 6),
('bloating', 'Bloating', 'Şişkinlik', '🎈', 'digestive', 7),
('nausea', 'Nausea', 'Ürək bulanması', '🤢', 'digestive', 8),
('acne', 'Acne', 'Sızanaq', '😔', 'skin', 9),
('breast_tenderness', 'Breast tenderness', 'Döş həssaslığı', '💔', 'pain', 10),
('insomnia', 'Insomnia', 'Yuxusuzluq', '😵‍💫', 'sleep', 11),
('cravings', 'Food cravings', 'Yemək istəyi', '🍫', 'appetite', 12)
ON CONFLICT (symptom_id) DO NOTHING;

-- Insert flow phase tips
INSERT INTO public.flow_phase_tips (phase, tip_text, tip_text_az, emoji, category, sort_order) VALUES
-- Menstrual phase
('menstrual', 'Increase iron intake', 'Dəmir qəbulunu artırın', '🥬', 'nutrition', 1),
('menstrual', 'Use a heating pad for cramps', 'Sancı üçün isti su torbası istifadə edin', '♨️', 'comfort', 2),
('menstrual', 'Stay hydrated', 'Yetərli su için', '💧', 'hydration', 3),
('menstrual', 'Rest and take it easy', 'İstirahət edin, özünüzə yumşaq olun', '🛋️', 'rest', 4),
('menstrual', 'Light stretching can help', 'Yüngül gərilmə hərəkətləri kömək edə bilər', '🧘', 'exercise', 5),
-- Follicular phase
('follicular', 'Great time to start new projects', 'Yeni layihələrə başlamaq üçün əla vaxtdır', '🚀', 'productivity', 1),
('follicular', 'Energy levels are rising', 'Enerji səviyyəniz artır', '⚡', 'energy', 2),
('follicular', 'Try high-intensity workouts', 'İntensiv məşqlər edə bilərsiniz', '🏃‍♀️', 'exercise', 3),
('follicular', 'Social activities are easier now', 'Sosial fəaliyyətlər indi daha asandır', '👥', 'social', 4),
('follicular', 'Skin may be clearer', 'Dəri daha təmiz ola bilər', '✨', 'skin', 5),
-- Ovulation phase
('ovulation', 'Peak fertility window', 'Ən yüksək fertil dövrü', '🌟', 'fertility', 1),
('ovulation', 'Communication skills are enhanced', 'Ünsiyyət bacarıqlarınız güclüdür', '💬', 'social', 2),
('ovulation', 'Highest energy levels', 'Enerji ən yüksək səviyyədədir', '🔋', 'energy', 3),
('ovulation', 'Great for important meetings', 'Mühüm görüşlər üçün idealdır', '📅', 'productivity', 4),
('ovulation', 'Libido may increase', 'Libido arta bilər', '💕', 'wellness', 5),
-- Luteal phase
('luteal', 'Take magnesium supplements', 'Maqnezium qəbul edin', '💊', 'supplements', 1),
('luteal', 'Reduce stress levels', 'Stress azaldın', '🧘‍♀️', 'mental', 2),
('luteal', 'Get adequate sleep', 'Yetərli yuxu alın', '😴', 'sleep', 3),
('luteal', 'Limit caffeine and salt', 'Kofein və duzu məhdudlaşdırın', '🚫', 'nutrition', 4),
('luteal', 'Practice self-care', 'Özünüzə qayğı göstərin', '💆‍♀️', 'wellness', 5)
ON CONFLICT DO NOTHING;

-- Insert flow insights
INSERT INTO public.flow_insights (title, title_az, content, content_az, phase, emoji, category, sort_order) VALUES
('Understanding Your Cycle', 'Dövrünüzü Anlamaq', 'Your menstrual cycle is divided into four phases...', 'Menstrual dövrünüz dörd fazaya bölünür: Menstruasiya, Follikulyar, Ovulyasiya və Luteal. Hər faza fərqli hormonal dəyişikliklərlə müşayiət olunur.', NULL, '📖', 'education', 1),
('Nutrition During Menstruation', 'Menstruasiya Zamanı Qidalanma', 'Focus on iron-rich foods...', 'Menstruasiya zamanı dəmir zəngin qidalar - ispanaq, ətin qırmızı növləri, qarabağayar yeyin. B12 vitamini də vacibdir.', 'menstrual', '🥗', 'nutrition', 2),
('Exercise and Your Cycle', 'Məşq və Dövrünüz', 'Adjust your workout intensity...', 'Məşq intensivliyini dövrünüzə uyğunlaşdırın. Follikulyar fazada intensiv, luteal fazada yüngül məşqlər tövsiyə olunur.', NULL, '🏋️', 'fitness', 3),
('Tracking Fertility', 'Fertilliyi İzləmək', 'Learn about your fertile window...', 'Fertil pəncərəniz ovulyasiyadan 5 gün əvvəl və 1 gün sonra davam edir. Bu müddət hamiləlik üçün ən əlverişli vaxtdır.', 'ovulation', '📊', 'fertility', 4),
('Managing PMS', 'PMS İdarəetmə', 'Tips for managing premenstrual symptoms...', 'PMS simptomlarını idarə etmək üçün maqnezium, B6 vitamini qəbul edin, stress azaldın və yetərli yuxu alın.', 'luteal', '🌙', 'health', 5);
