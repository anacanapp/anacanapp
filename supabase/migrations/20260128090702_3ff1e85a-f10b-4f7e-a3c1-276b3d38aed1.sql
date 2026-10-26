-- Add phase-specific active columns to tool_configs
ALTER TABLE public.tool_configs
ADD COLUMN IF NOT EXISTS flow_active boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS bump_active boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS mommy_active boolean DEFAULT true;

-- Update existing tools: set phase-specific active to match current life_stages
UPDATE public.tool_configs
SET 
  flow_active = 'flow' = ANY(life_stages) AND is_active,
  bump_active = 'bump' = ANY(life_stages) AND is_active,
  mommy_active = 'mommy' = ANY(life_stages) AND is_active;

-- Delete duplicate secondhand-market tool (keep second-hand-market)
DELETE FROM public.tool_configs WHERE tool_id = 'secondhand-market';