-- FAQs table for Help Center
CREATE TABLE public.faqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  question_az text,
  answer text NOT NULL,
  answer_az text,
  category text DEFAULT 'general',
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Support Categories table
CREATE TABLE public.support_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_key text NOT NULL UNIQUE,
  name text NOT NULL,
  name_az text,
  emoji text DEFAULT '📋',
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Weight Recommendations table for pregnancy
CREATE TABLE public.weight_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trimester integer NOT NULL,
  bmi_category text NOT NULL DEFAULT 'normal',
  min_gain_kg numeric NOT NULL,
  max_gain_kg numeric NOT NULL,
  weekly_gain_kg numeric,
  description text,
  description_az text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(trimester, bmi_category)
);

-- Enable RLS
ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weight_recommendations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for faqs
CREATE POLICY "Anyone can view active faqs" ON public.faqs
FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage faqs" ON public.faqs
FOR ALL USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for support_categories
CREATE POLICY "Anyone can view active support categories" ON public.support_categories
FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage support categories" ON public.support_categories
FOR ALL USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for weight_recommendations
CREATE POLICY "Anyone can view active weight recommendations" ON public.weight_recommendations
FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage weight recommendations" ON public.weight_recommendations
FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Insert default FAQs
INSERT INTO public.faqs (question, question_az, answer, answer_az, category, sort_order) VALUES
('What is Anacan?', 'Anacan nədir?', 'Anacan is a pregnancy tracking app', 'Anacan, qadınların menstruasiya dövrünü, hamiləliyi və analıq səyahətini izləmək üçün yaradılmış bir tətbiqdir.', 'general', 1),
('How does partner code work?', 'Partner kodu necə işləyir?', 'Partner code lets you share your journey', 'Partner kodu həyat yoldaşınızla hamiləlik səyahətinizi paylaşmağınıza imkan verir.', 'partner', 2),
('What is Premium?', 'Premium üzvlük nədir?', 'Premium gives you unlimited features', 'Premium üzvlük sizə limitsiz AI söhbət, körpə foto sessiyası təqdim edir.', 'billing', 3),
('Is my data secure?', 'Məlumatlarım necə qorunur?', 'All data is encrypted', 'Bütün məlumatlarınız şifrələnmiş şəkildə saxlanılır.', 'security', 4),
('How do I manage notifications?', 'Bildirişləri necə idarə edə bilərəm?', 'Go to Settings > Notifications', 'Ayarlar > Bildirişlər bölməsindən idarə edə bilərsiniz.', 'features', 5),
('How do I delete my account?', 'Hesabımı necə silə bilərəm?', 'Contact support to delete your account', 'Hesabınızı silmək üçün bizimlə əlaqə saxlayın.', 'account', 6),
('How do I change due date?', 'Doğum tariximi necə dəyişə bilərəm?', 'Go to Profile > Edit Profile', 'Profil > Profili Redaktə et bölməsindən dəyişə bilərsiniz.', 'features', 7),
('How does baby photoshoot work?', 'Körpə foto sessiyası necə işləyir?', 'AI generates baby photos', 'AI texnologiyası ilə körpənizin şəklini müxtəlif fonlarda görə bilərsiniz.', 'features', 8);

-- Insert default support categories
INSERT INTO public.support_categories (category_key, name, name_az, emoji, sort_order) VALUES
('general', 'General Question', 'Ümumi sual', '❓', 1),
('technical', 'Technical Issue', 'Texniki problem', '🔧', 2),
('billing', 'Billing', 'Ödəniş', '💳', 3),
('feature', 'Feature Request', 'Xüsusiyyət tələbi', '💡', 4),
('other', 'Other', 'Digər', '📋', 5);

-- Insert default weight recommendations
INSERT INTO public.weight_recommendations (trimester, bmi_category, min_gain_kg, max_gain_kg, weekly_gain_kg, description_az) VALUES
(1, 'underweight', 0.5, 2.0, 0.5, 'Birinci trimester üçün tövsiyə'),
(1, 'normal', 0.5, 2.0, 0.4, 'Birinci trimester üçün tövsiyə'),
(1, 'overweight', 0.5, 1.5, 0.3, 'Birinci trimester üçün tövsiyə'),
(2, 'underweight', 5.0, 8.0, 0.5, 'İkinci trimester üçün tövsiyə'),
(2, 'normal', 4.0, 6.0, 0.4, 'İkinci trimester üçün tövsiyə'),
(2, 'overweight', 2.0, 4.0, 0.3, 'İkinci trimester üçün tövsiyə'),
(3, 'underweight', 5.0, 6.0, 0.5, 'Üçüncü trimester üçün tövsiyə'),
(3, 'normal', 4.0, 5.0, 0.4, 'Üçüncü trimester üçün tövsiyə'),
(3, 'overweight', 2.0, 3.0, 0.3, 'Üçüncü trimester üçün tövsiyə');