-- Add category-specific sort orders to tool_configs table
ALTER TABLE public.tool_configs
ADD COLUMN IF NOT EXISTS flow_order integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS bump_order integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS mommy_order integer DEFAULT 0;

-- Update existing records to use current sort_order as base for all categories
UPDATE public.tool_configs 
SET flow_order = sort_order, 
    bump_order = sort_order, 
    mommy_order = sort_order 
WHERE flow_order = 0 AND bump_order = 0 AND mommy_order = 0;