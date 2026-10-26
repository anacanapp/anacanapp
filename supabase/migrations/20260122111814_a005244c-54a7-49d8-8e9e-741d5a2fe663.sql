-- Drop existing RESTRICTIVE policies and recreate as PERMISSIVE

-- admin_recipes
DROP POLICY IF EXISTS "Admins can manage recipes" ON public.admin_recipes;
DROP POLICY IF EXISTS "Anyone can view active recipes" ON public.admin_recipes;

CREATE POLICY "Admins can manage recipes" 
ON public.admin_recipes FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view active recipes" 
ON public.admin_recipes FOR SELECT 
USING (is_active = true);

-- weekly_tips
DROP POLICY IF EXISTS "Admins can manage tips" ON public.weekly_tips;
DROP POLICY IF EXISTS "Anyone can view active tips" ON public.weekly_tips;

CREATE POLICY "Admins can manage tips" 
ON public.weekly_tips FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view active tips" 
ON public.weekly_tips FOR SELECT 
USING (is_active = true);

-- safety_items
DROP POLICY IF EXISTS "Admins can manage safety items" ON public.safety_items;
DROP POLICY IF EXISTS "Anyone can view active safety items" ON public.safety_items;

CREATE POLICY "Admins can manage safety items" 
ON public.safety_items FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view active safety items" 
ON public.safety_items FOR SELECT 
USING (is_active = true);

-- baby_names_db
DROP POLICY IF EXISTS "Admins can manage names" ON public.baby_names_db;
DROP POLICY IF EXISTS "Anyone can view active names" ON public.baby_names_db;

CREATE POLICY "Admins can manage names" 
ON public.baby_names_db FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view active names" 
ON public.baby_names_db FOR SELECT 
USING (is_active = true);

-- hospital_bag_templates
DROP POLICY IF EXISTS "Admins can manage templates" ON public.hospital_bag_templates;
DROP POLICY IF EXISTS "Anyone can view active templates" ON public.hospital_bag_templates;

CREATE POLICY "Admins can manage templates" 
ON public.hospital_bag_templates FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view active templates" 
ON public.hospital_bag_templates FOR SELECT 
USING (is_active = true);

-- nutrition_tips
DROP POLICY IF EXISTS "Admins can manage nutrition tips" ON public.nutrition_tips;
DROP POLICY IF EXISTS "Anyone can view active nutrition tips" ON public.nutrition_tips;

CREATE POLICY "Admins can manage nutrition tips" 
ON public.nutrition_tips FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view active nutrition tips" 
ON public.nutrition_tips FOR SELECT 
USING (is_active = true);