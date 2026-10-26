
-- Create table for admin-managed recipes
CREATE TABLE public.admin_recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'pregnancy',
  ingredients jsonb NOT NULL DEFAULT '[]',
  instructions jsonb NOT NULL DEFAULT '[]',
  prep_time integer,
  cook_time integer,
  servings integer,
  image_url text,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create table for weekly tips/recommendations
CREATE TABLE public.weekly_tips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_number integer NOT NULL,
  life_stage text NOT NULL DEFAULT 'pregnancy',
  title text NOT NULL,
  content text NOT NULL,
  tips jsonb DEFAULT '[]',
  image_url text,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create table for safety lookup items
CREATE TABLE public.safety_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_az text,
  category text NOT NULL DEFAULT 'food',
  safety_level text NOT NULL DEFAULT 'safe',
  description text,
  description_az text,
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create table for baby names database
CREATE TABLE public.baby_names_db (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  gender text NOT NULL DEFAULT 'unisex',
  origin text,
  meaning text,
  meaning_az text,
  popularity integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create table for hospital bag templates
CREATE TABLE public.hospital_bag_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name text NOT NULL,
  item_name_az text,
  category text NOT NULL,
  is_essential boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create table for nutrition tips
CREATE TABLE public.nutrition_tips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  category text NOT NULL DEFAULT 'pregnancy',
  trimester integer,
  calories integer,
  nutrients jsonb DEFAULT '[]',
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create table for user blocks
CREATE TABLE public.user_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  blocked_by uuid NOT NULL,
  reason text,
  block_type text NOT NULL DEFAULT 'community',
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

-- Add premium badge support to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_premium boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS premium_until timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS badge_type text DEFAULT 'user';

-- Enable RLS on all new tables
ALTER TABLE public.admin_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_tips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safety_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.baby_names_db ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospital_bag_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_tips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

-- RLS policies for admin_recipes
CREATE POLICY "Anyone can view active recipes" ON public.admin_recipes FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage recipes" ON public.admin_recipes FOR ALL USING (has_role(auth.uid(), 'admin'));

-- RLS policies for weekly_tips
CREATE POLICY "Anyone can view active tips" ON public.weekly_tips FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage tips" ON public.weekly_tips FOR ALL USING (has_role(auth.uid(), 'admin'));

-- RLS policies for safety_items
CREATE POLICY "Anyone can view active safety items" ON public.safety_items FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage safety items" ON public.safety_items FOR ALL USING (has_role(auth.uid(), 'admin'));

-- RLS policies for baby_names_db
CREATE POLICY "Anyone can view active names" ON public.baby_names_db FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage names" ON public.baby_names_db FOR ALL USING (has_role(auth.uid(), 'admin'));

-- RLS policies for hospital_bag_templates
CREATE POLICY "Anyone can view active templates" ON public.hospital_bag_templates FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage templates" ON public.hospital_bag_templates FOR ALL USING (has_role(auth.uid(), 'admin'));

-- RLS policies for nutrition_tips
CREATE POLICY "Anyone can view active nutrition tips" ON public.nutrition_tips FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage nutrition tips" ON public.nutrition_tips FOR ALL USING (has_role(auth.uid(), 'admin'));

-- RLS policies for user_blocks
CREATE POLICY "Admins can manage blocks" ON public.user_blocks FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can see if they are blocked" ON public.user_blocks FOR SELECT USING (auth.uid() = user_id);

-- Update community posts policy to allow admin deletion
DROP POLICY IF EXISTS "Admins can manage all posts" ON public.community_posts;
CREATE POLICY "Admins can manage all posts" ON public.community_posts FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Update comments policy to allow admin deletion
DROP POLICY IF EXISTS "Admins can manage all comments" ON public.post_comments;
CREATE POLICY "Admins can manage all comments" ON public.post_comments FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Create indexes
CREATE INDEX idx_admin_recipes_category ON public.admin_recipes(category);
CREATE INDEX idx_weekly_tips_week ON public.weekly_tips(week_number, life_stage);
CREATE INDEX idx_safety_items_category ON public.safety_items(category);
CREATE INDEX idx_baby_names_gender ON public.baby_names_db(gender);
CREATE INDEX idx_user_blocks_user ON public.user_blocks(user_id);
CREATE INDEX idx_profiles_premium ON public.profiles(is_premium);

-- Update triggers
CREATE TRIGGER update_admin_recipes_updated_at BEFORE UPDATE ON public.admin_recipes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_weekly_tips_updated_at BEFORE UPDATE ON public.weekly_tips FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_safety_items_updated_at BEFORE UPDATE ON public.safety_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_hospital_bag_templates_updated_at BEFORE UPDATE ON public.hospital_bag_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_nutrition_tips_updated_at BEFORE UPDATE ON public.nutrition_tips FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
