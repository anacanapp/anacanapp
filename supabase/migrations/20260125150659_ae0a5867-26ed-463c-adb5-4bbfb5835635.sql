-- Create partner_daily_tips table for dynamic "Tip of the Day" for partners
CREATE TABLE public.partner_daily_tips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tip_text TEXT NOT NULL,
  tip_text_az TEXT,
  tip_emoji TEXT DEFAULT '💡',
  life_stage TEXT NOT NULL DEFAULT 'bump',
  week_number INTEGER,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create onboarding_stages table for dynamic stage options
CREATE TABLE public.onboarding_stages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stage_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  title_az TEXT,
  subtitle TEXT,
  subtitle_az TEXT,
  description TEXT,
  description_az TEXT,
  emoji TEXT DEFAULT '👤',
  icon_name TEXT DEFAULT 'Heart',
  bg_gradient TEXT DEFAULT 'from-violet-500 to-purple-600',
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create multiples_options table for dynamic multiples selection
CREATE TABLE public.multiples_options (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  option_id TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  label_az TEXT,
  emoji TEXT NOT NULL,
  baby_count INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.partner_daily_tips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.multiples_options ENABLE ROW LEVEL SECURITY;

-- Anyone can read active content
CREATE POLICY "Anyone can view active partner tips" ON public.partner_daily_tips FOR SELECT USING (is_active = true);
CREATE POLICY "Anyone can view active onboarding stages" ON public.onboarding_stages FOR SELECT USING (is_active = true);
CREATE POLICY "Anyone can view active multiples options" ON public.multiples_options FOR SELECT USING (is_active = true);

-- Admins can manage
CREATE POLICY "Admins can manage partner tips" ON public.partner_daily_tips FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can manage onboarding stages" ON public.onboarding_stages FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can manage multiples options" ON public.multiples_options FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default data for onboarding stages
INSERT INTO public.onboarding_stages (stage_id, title, title_az, subtitle, subtitle_az, description, description_az, emoji, icon_name, bg_gradient, sort_order) VALUES
('flow', 'Track my cycle', 'Dövrümü izləmək', 'Menstruation calendar', 'Menstruasiya təqvimi', 'Track your cycle, predict ovulation', 'Dövrünüzü izləyin, ovulyasiyanı proqnozlaşdırın', '🌸', 'Calendar', 'from-rose-500 to-pink-600', 1),
('bump', 'My pregnancy', 'Hamiləliyim', 'Pregnancy tracker', 'Hamiləlik izləyicisi', 'Track your baby''s development week by week', 'Körpənizin inkişafını həftə-həftə izləyin', '🤰', 'Heart', 'from-violet-500 to-purple-600', 2),
('mommy', 'I have a baby', 'Körpəm var', 'Motherhood assistant', 'Analıq yardımçısı', 'Track your baby''s feeding, sleep and development', 'Körpənizin qidalanma, yuxu və inkişafını izləyin', '👶', 'Baby', 'from-emerald-500 to-teal-600', 3);

-- Insert default data for multiples options
INSERT INTO public.multiples_options (option_id, label, label_az, emoji, baby_count, sort_order) VALUES
('single', 'Single baby', 'Tək uşaq', '👶', 1, 1),
('twins', 'Twins', 'Əkiz', '👶👶', 2, 2),
('triplets', 'Triplets', 'Üçüz', '👶👶👶', 3, 3),
('quadruplets', 'Quadruplets', 'Dördüz', '👶👶👶👶', 4, 4);

-- Insert default partner daily tips
INSERT INTO public.partner_daily_tips (tip_text, tip_text_az, tip_emoji, life_stage, week_number, sort_order) VALUES
('Surprise her with her favorite snack today', 'Bu gün onu sevdiyi qəlyanaltı ilə təəccübləndirin', '🍫', 'bump', NULL, 1),
('Offer to give her a foot massage', 'Ona ayaq masajı etməyi təklif edin', '💆', 'bump', NULL, 2),
('Tell her how beautiful she looks today', 'Ona bu gün nə qədər gözəl göründüyünü söyləyin', '💕', 'bump', NULL, 3),
('Help with household chores without being asked', 'Soruşulmadan ev işlərinə kömək edin', '🧹', 'bump', NULL, 4),
('Plan a relaxing evening together', 'Birlikdə rahatladıcı bir axşam planlaşdırın', '🌙', 'bump', NULL, 5),
('Prepare breakfast for the new mom', 'Yeni ana üçün səhər yeməyi hazırlayın', '🍳', 'mommy', NULL, 1),
('Take the baby for a walk so she can rest', 'O istirahət edə bilsin deyə körpəni gəzintiyə aparın', '👶', 'mommy', NULL, 2),
('Remind her she is doing an amazing job', 'Ona əla iş gördüyünü xatırladın', '⭐', 'mommy', NULL, 3);

-- Update updated_at trigger
CREATE TRIGGER update_partner_daily_tips_updated_at
  BEFORE UPDATE ON public.partner_daily_tips
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();