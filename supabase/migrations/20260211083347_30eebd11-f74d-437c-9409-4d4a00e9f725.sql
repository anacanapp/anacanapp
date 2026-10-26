ALTER TABLE public.admin_recipes ADD COLUMN life_stages text[] DEFAULT '{}';

COMMENT ON COLUMN public.admin_recipes.life_stages IS 'Life stages this recipe applies to: flow, bump, mommy';