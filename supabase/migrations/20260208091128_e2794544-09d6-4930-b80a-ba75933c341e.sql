-- Add life_stage column to blog_posts table
-- Values: 'flow' (menstruation), 'bump' (pregnancy), 'mommy' (baby care), 'all' (all stages)
ALTER TABLE public.blog_posts 
ADD COLUMN life_stage text DEFAULT 'all';

-- Add comment for documentation
COMMENT ON COLUMN public.blog_posts.life_stage IS 'Target life stage: flow, bump, mommy, or all';

-- Update existing posts based on their categories
UPDATE public.blog_posts 
SET life_stage = CASE 
  WHEN category ILIKE '%hamilə%' OR category ILIKE '%pregnancy%' OR category ILIKE '%doğuş%' THEN 'bump'
  WHEN category ILIKE '%ana%' OR category ILIKE '%bebek%' OR category ILIKE '%körpə%' OR category ILIKE '%uşaq%' THEN 'mommy'
  WHEN category ILIKE '%menstr%' OR category ILIKE '%dövr%' OR category ILIKE '%cycle%' THEN 'flow'
  ELSE 'all'
END;