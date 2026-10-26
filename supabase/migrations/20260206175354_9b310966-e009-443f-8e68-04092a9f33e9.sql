
-- Default shopping items (platform recommendations)
CREATE TABLE public.default_shopping_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  name_az TEXT,
  category TEXT DEFAULT 'general',
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  life_stage TEXT DEFAULT 'all',
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.default_shopping_items ENABLE ROW LEVEL SECURITY;

-- Everyone can read active items
CREATE POLICY "Anyone can read active default shopping items"
  ON public.default_shopping_items
  FOR SELECT
  USING (is_active = true);

-- Only admins can manage
CREATE POLICY "Admins can manage default shopping items"
  ON public.default_shopping_items
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Premium page features configuration
CREATE TABLE public.premium_features (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  title_az TEXT,
  description TEXT,
  description_az TEXT,
  icon TEXT DEFAULT '✨',
  is_included_free BOOLEAN DEFAULT false,
  is_included_premium BOOLEAN DEFAULT true,
  is_included_premium_plus BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.premium_features ENABLE ROW LEVEL SECURITY;

-- Everyone can read active features
CREATE POLICY "Anyone can read active premium features"
  ON public.premium_features
  FOR SELECT
  USING (is_active = true);

-- Only admins can manage
CREATE POLICY "Admins can manage premium features"
  ON public.premium_features
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Premium pricing plans
CREATE TABLE public.premium_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  name_az TEXT,
  description TEXT,
  description_az TEXT,
  price_monthly DECIMAL(10,2) DEFAULT 0,
  price_yearly DECIMAL(10,2) DEFAULT 0,
  currency TEXT DEFAULT 'AZN',
  badge_text TEXT,
  badge_text_az TEXT,
  is_popular BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.premium_plans ENABLE ROW LEVEL SECURITY;

-- Everyone can read active plans
CREATE POLICY "Anyone can read active premium plans"
  ON public.premium_plans
  FOR SELECT
  USING (is_active = true);

-- Only admins can manage
CREATE POLICY "Admins can manage premium plans"
  ON public.premium_plans
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Insert default plans
INSERT INTO public.premium_plans (plan_key, name, name_az, price_monthly, price_yearly, is_popular, sort_order) VALUES
  ('free', 'Free', 'Pulsuz', 0, 0, false, 1),
  ('premium', 'Premium', 'Premium', 9.99, 79.99, true, 2),
  ('premium_plus', 'Premium+', 'Premium+', 14.99, 119.99, false, 3);

-- Insert some default shopping items
INSERT INTO public.default_shopping_items (name, name_az, category, priority, life_stage, sort_order) VALUES
  ('Baby diapers', 'Körpə bezləri', 'baby_care', 'high', 'all', 1),
  ('Baby wipes', 'Nəm salfetlər', 'baby_care', 'high', 'all', 2),
  ('Baby bottles', 'Biberon', 'feeding', 'high', 'all', 3),
  ('Breast pump', 'Süd sağma aparatı', 'feeding', 'medium', 'pregnant', 4),
  ('Baby clothes (0-3 months)', 'Körpə paltarları (0-3 ay)', 'clothing', 'high', 'pregnant', 5),
  ('Baby blanket', 'Körpə yorğanı', 'bedding', 'medium', 'all', 6),
  ('Prenatal vitamins', 'Hamiləlik vitaminləri', 'health', 'high', 'pregnant', 7),
  ('Nursing pillow', 'Əmizdirmə yastığı', 'feeding', 'medium', 'pregnant', 8),
  ('Baby monitor', 'Körpə monitoru', 'safety', 'medium', 'all', 9),
  ('Stroller', 'Uşaq arabası', 'transport', 'high', 'pregnant', 10);

-- Insert default premium features
INSERT INTO public.premium_features (title, title_az, icon, is_included_free, is_included_premium, is_included_premium_plus, sort_order) VALUES
  ('Basic tracking', 'Əsas izləmə', '📊', true, true, true, 1),
  ('AI Doctor Chat', 'AI Həkim Çatı', '🤖', false, true, true, 2),
  ('Unlimited White Noise', 'Limitsiz Ağ Səs', '🔊', false, true, true, 3),
  ('Baby Photoshoot', 'Körpə Fotosessiya', '📸', false, true, true, 4),
  ('Priority Support', 'Prioritet Dəstək', '⭐', false, false, true, 5),
  ('Family Sharing', 'Ailə Paylaşımı', '👨‍👩‍👧', false, false, true, 6);
