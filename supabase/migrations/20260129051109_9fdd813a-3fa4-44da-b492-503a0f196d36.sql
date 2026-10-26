-- Create banners table for managing app banners
CREATE TABLE public.banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  title_az TEXT,
  description TEXT,
  description_az TEXT,
  image_url TEXT,
  link_url TEXT,
  link_type TEXT DEFAULT 'external' CHECK (link_type IN ('external', 'internal', 'tool')),
  placement TEXT NOT NULL CHECK (placement IN ('home_top', 'home_middle', 'home_bottom', 'tools_top', 'tools_bottom', 'profile_top', 'community_top', 'ai_chat_top')),
  banner_type TEXT DEFAULT 'image' CHECK (banner_type IN ('native', 'image')),
  background_color TEXT,
  text_color TEXT,
  button_text TEXT,
  button_text_az TEXT,
  is_active BOOLEAN DEFAULT true,
  is_premium_only BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  click_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

-- Everyone can read active banners
CREATE POLICY "Anyone can view active banners"
ON public.banners
FOR SELECT
USING (is_active = true AND (start_date IS NULL OR start_date <= now()) AND (end_date IS NULL OR end_date >= now()));

-- Admins can manage all banners
CREATE POLICY "Admins can manage banners"
ON public.banners
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Insert demo banners
INSERT INTO public.banners (title, title_az, description, description_az, placement, banner_type, background_color, text_color, button_text, button_text_az, link_url, link_type, sort_order) VALUES
('Premium Subscription', 'Premium Abunəlik', 'Unlock all features and get unlimited access', 'Bütün funksiyaları açın və limitsiz giriş əldə edin', 'home_top', 'native', '#F48155', '#FFFFFF', 'Subscribe Now', 'İndi Abunə Ol', '/billing', 'internal', 1),
('Baby Names Tool', 'Körpə Adları', 'Find the perfect name for your baby', 'Körpəniz üçün mükəmməl ad tapın', 'home_middle', 'native', '#8B5CF6', '#FFFFFF', 'Explore Names', 'Adları Kəşf Et', 'baby-names', 'tool', 2),
('Join Our Community', 'Cəmiyyətimizə Qoşulun', 'Connect with other parents and share experiences', 'Digər valideynlərlə əlaqə saxlayın və təcrübələri paylaşın', 'tools_top', 'native', '#10B981', '#FFFFFF', 'Join Now', 'İndi Qoşul', '/community', 'internal', 1),
('Health Tips', 'Sağlamlıq Məsləhətləri', 'Daily tips for a healthy pregnancy', 'Sağlam hamiləlik üçün gündəlik məsləhətlər', 'profile_top', 'native', '#3B82F6', '#FFFFFF', 'Read More', 'Daha Çox Oxu', 'https://anacan.az/blog', 'external', 1);