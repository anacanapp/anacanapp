
-- Fix baby_milestones unique constraint to include child_id
ALTER TABLE public.baby_milestones DROP CONSTRAINT IF EXISTS baby_milestones_user_id_milestone_id_key;

-- Create new unique constraint that includes child_id (using COALESCE for null child_id)
CREATE UNIQUE INDEX baby_milestones_user_child_milestone_unique 
ON public.baby_milestones (user_id, milestone_id, COALESCE(child_id, '00000000-0000-0000-0000-000000000000'));
