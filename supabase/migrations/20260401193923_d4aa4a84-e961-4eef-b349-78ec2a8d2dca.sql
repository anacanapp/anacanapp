
-- Add hero and quick access configuration columns to tool_configs
ALTER TABLE public.tool_configs ADD COLUMN IF NOT EXISTS is_hero boolean DEFAULT false;
ALTER TABLE public.tool_configs ADD COLUMN IF NOT EXISTS hero_order integer DEFAULT 0;
ALTER TABLE public.tool_configs ADD COLUMN IF NOT EXISTS hero_gradient text DEFAULT NULL;
ALTER TABLE public.tool_configs ADD COLUMN IF NOT EXISTS hero_subtitle text DEFAULT NULL;
ALTER TABLE public.tool_configs ADD COLUMN IF NOT EXISTS hero_badge text DEFAULT NULL;
ALTER TABLE public.tool_configs ADD COLUMN IF NOT EXISTS is_quick_access boolean DEFAULT false;
ALTER TABLE public.tool_configs ADD COLUMN IF NOT EXISTS quick_access_order integer DEFAULT 0;
ALTER TABLE public.tool_configs ADD COLUMN IF NOT EXISTS quick_access_gradient text DEFAULT NULL;

-- Set initial hero tools
UPDATE public.tool_configs SET is_hero = true, hero_order = 1, hero_gradient = 'from-violet-600 via-purple-600 to-fuchsia-600', hero_subtitle = 'AI ilə unikal körpə şəkilləri yaradın', hero_badge = '✨ AI' WHERE tool_id = 'photoshoot';
UPDATE public.tool_configs SET is_hero = true, hero_order = 2, hero_gradient = 'from-amber-500 via-orange-500 to-red-500', hero_subtitle = 'Hamiləlik və analıq üçün ləzzətli yeməklər', hero_badge = '🍽️ Reseptlər' WHERE tool_id = 'recipes';

-- Set initial quick access tools
UPDATE public.tool_configs SET is_quick_access = true, quick_access_order = 1, quick_access_gradient = 'from-emerald-500 to-teal-500' WHERE tool_id = 'safety';
UPDATE public.tool_configs SET is_quick_access = true, quick_access_order = 2, quick_access_gradient = 'from-red-500 to-rose-500' WHERE tool_id = 'first-aid';
UPDATE public.tool_configs SET is_quick_access = true, quick_access_order = 3, quick_access_gradient = 'from-blue-500 to-cyan-500' WHERE tool_id = 'doctors';
