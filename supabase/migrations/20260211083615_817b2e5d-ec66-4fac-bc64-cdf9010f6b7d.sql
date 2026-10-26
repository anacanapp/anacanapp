-- Rename life_stages to tags for clarity
ALTER TABLE public.admin_recipes RENAME COLUMN life_stages TO tags;

-- Create recipe_tags table for admin-managed sub-categories
CREATE TABLE public.recipe_tags (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tag_id text NOT NULL UNIQUE,
  name text NOT NULL,
  name_az text,
  emoji text DEFAULT '🏷️',
  sort_order int DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.recipe_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read recipe_tags" ON public.recipe_tags FOR SELECT USING (true);
CREATE POLICY "Admins can manage recipe_tags" ON public.recipe_tags FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Seed default tags
INSERT INTO public.recipe_tags (tag_id, name, name_az, emoji, sort_order) VALUES
  ('general', 'General', 'Ümumi', '🍽️', 1),
  ('pregnancy', 'Pregnancy', 'Hamiləlik', '🤰', 2),
  ('postpartum', 'Postpartum', 'Doğum Sonrası', '🤱', 3),
  ('iron_rich', 'Iron Rich', 'Qan Artıran', '🩸', 4),
  ('milk_boost', 'Milk Boosting', 'Süd Artıran', '🍼', 5),
  ('baby_food', 'Baby Food', 'Uşaq', '👶', 6),
  ('pain_relief', 'Pain Relief', 'Ağrıkəsici', '💊', 7),
  ('energy', 'Energy', 'Enerji Verən', '⚡', 8),
  ('vitamin_rich', 'Vitamin Rich', 'Vitaminli', '🍊', 9);