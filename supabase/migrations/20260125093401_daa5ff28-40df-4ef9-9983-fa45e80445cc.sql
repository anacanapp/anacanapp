-- ===========================================
-- 1. PHOTOSHOOT THEMES (Background categories and themes)
-- ===========================================
CREATE TABLE IF NOT EXISTS public.photoshoot_backgrounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id text NOT NULL,
  category_name text NOT NULL,
  category_name_az text,
  theme_id text NOT NULL,
  theme_name text NOT NULL,
  theme_name_az text,
  theme_emoji text DEFAULT '🎨',
  prompt_template text,
  gender text DEFAULT 'unisex',
  preview_url text,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.photoshoot_eye_colors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  color_id text NOT NULL UNIQUE,
  color_name text NOT NULL,
  color_name_az text,
  hex_value text,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.photoshoot_hair_colors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  color_id text NOT NULL UNIQUE,
  color_name text NOT NULL,
  color_name_az text,
  hex_value text,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.photoshoot_hair_styles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  style_id text NOT NULL UNIQUE,
  style_name text NOT NULL,
  style_name_az text,
  emoji text DEFAULT '💇',
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.photoshoot_outfits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outfit_id text NOT NULL,
  outfit_name text NOT NULL,
  outfit_name_az text,
  emoji text DEFAULT '👕',
  gender text DEFAULT 'unisex',
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- ===========================================
-- 2. SAFETY CATEGORIES (safety_items already exists)
-- ===========================================
CREATE TABLE IF NOT EXISTS public.safety_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id text NOT NULL UNIQUE,
  name text NOT NULL,
  name_az text,
  emoji text DEFAULT '✨',
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Add missing columns to existing safety_items if needed
DO $$ BEGIN
  ALTER TABLE public.safety_items ADD COLUMN IF NOT EXISTS item_name_az text;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.safety_items ADD COLUMN IF NOT EXISTS description_az text;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.safety_items ADD COLUMN IF NOT EXISTS trimester_notes jsonb DEFAULT '{}';
EXCEPTION WHEN others THEN NULL;
END $$;

-- ===========================================
-- 3. SHOP CATEGORIES
-- ===========================================
CREATE TABLE IF NOT EXISTS public.shop_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id text NOT NULL UNIQUE,
  name text NOT NULL,
  name_az text,
  emoji text DEFAULT '🛍️',
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- ===========================================
-- 4. NUTRITION SETTINGS
-- ===========================================
CREATE TABLE IF NOT EXISTS public.nutrition_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  life_stage text NOT NULL UNIQUE,
  calories integer NOT NULL DEFAULT 2000,
  water_glasses integer NOT NULL DEFAULT 8,
  description text,
  description_az text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.meal_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id text NOT NULL UNIQUE,
  name text NOT NULL,
  name_az text,
  emoji text DEFAULT '🍽️',
  time_range text,
  life_stages text[] DEFAULT '{flow,bump,mommy}',
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.recipe_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id text NOT NULL,
  name text NOT NULL,
  name_az text,
  emoji text DEFAULT '🍽️',
  life_stage text,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- ===========================================
-- RLS POLICIES
-- ===========================================
ALTER TABLE public.photoshoot_backgrounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photoshoot_eye_colors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photoshoot_hair_colors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photoshoot_hair_styles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photoshoot_outfits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safety_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_categories ENABLE ROW LEVEL SECURITY;

-- Photoshoot policies
DROP POLICY IF EXISTS "Anyone can view active backgrounds" ON public.photoshoot_backgrounds;
CREATE POLICY "Anyone can view active backgrounds" ON public.photoshoot_backgrounds FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "Admins can manage backgrounds" ON public.photoshoot_backgrounds;
CREATE POLICY "Admins can manage backgrounds" ON public.photoshoot_backgrounds FOR ALL USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Anyone can view active eye colors" ON public.photoshoot_eye_colors;
CREATE POLICY "Anyone can view active eye colors" ON public.photoshoot_eye_colors FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "Admins can manage eye colors" ON public.photoshoot_eye_colors;
CREATE POLICY "Admins can manage eye colors" ON public.photoshoot_eye_colors FOR ALL USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Anyone can view active hair colors" ON public.photoshoot_hair_colors;
CREATE POLICY "Anyone can view active hair colors" ON public.photoshoot_hair_colors FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "Admins can manage hair colors" ON public.photoshoot_hair_colors;
CREATE POLICY "Admins can manage hair colors" ON public.photoshoot_hair_colors FOR ALL USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Anyone can view active hair styles" ON public.photoshoot_hair_styles;
CREATE POLICY "Anyone can view active hair styles" ON public.photoshoot_hair_styles FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "Admins can manage hair styles" ON public.photoshoot_hair_styles;
CREATE POLICY "Admins can manage hair styles" ON public.photoshoot_hair_styles FOR ALL USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Anyone can view active outfits" ON public.photoshoot_outfits;
CREATE POLICY "Anyone can view active outfits" ON public.photoshoot_outfits FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "Admins can manage outfits" ON public.photoshoot_outfits;
CREATE POLICY "Admins can manage outfits" ON public.photoshoot_outfits FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Safety category policies
DROP POLICY IF EXISTS "Anyone can view active safety categories" ON public.safety_categories;
CREATE POLICY "Anyone can view active safety categories" ON public.safety_categories FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "Admins can manage safety categories" ON public.safety_categories;
CREATE POLICY "Admins can manage safety categories" ON public.safety_categories FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Shop category policies
DROP POLICY IF EXISTS "Anyone can view active shop categories" ON public.shop_categories;
CREATE POLICY "Anyone can view active shop categories" ON public.shop_categories FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "Admins can manage shop categories" ON public.shop_categories;
CREATE POLICY "Admins can manage shop categories" ON public.shop_categories FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Nutrition policies
DROP POLICY IF EXISTS "Anyone can view active nutrition targets" ON public.nutrition_targets;
CREATE POLICY "Anyone can view active nutrition targets" ON public.nutrition_targets FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "Admins can manage nutrition targets" ON public.nutrition_targets;
CREATE POLICY "Admins can manage nutrition targets" ON public.nutrition_targets FOR ALL USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Anyone can view active meal types" ON public.meal_types;
CREATE POLICY "Anyone can view active meal types" ON public.meal_types FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "Admins can manage meal types" ON public.meal_types;
CREATE POLICY "Admins can manage meal types" ON public.meal_types FOR ALL USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Anyone can view active recipe categories" ON public.recipe_categories;
CREATE POLICY "Anyone can view active recipe categories" ON public.recipe_categories FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "Admins can manage recipe categories" ON public.recipe_categories;
CREATE POLICY "Admins can manage recipe categories" ON public.recipe_categories FOR ALL USING (has_role(auth.uid(), 'admin'));