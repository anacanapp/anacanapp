-- Baby Milestones table for dynamic milestone tracking
CREATE TABLE public.baby_milestones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  milestone_id TEXT NOT NULL,
  achieved_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, milestone_id)
);

-- Enable RLS
ALTER TABLE public.baby_milestones ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own milestones" 
ON public.baby_milestones FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own milestones" 
ON public.baby_milestones FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own milestones" 
ON public.baby_milestones FOR DELETE 
USING (auth.uid() = user_id);

-- Partners can view linked user's milestones
CREATE POLICY "Partners can view linked user milestones"
ON public.baby_milestones FOR SELECT
USING (user_id = get_user_linked_partner_id(auth.uid()));

-- Achievements table for all user types
CREATE TABLE public.user_achievements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  achievement_id TEXT NOT NULL,
  achievement_type TEXT NOT NULL, -- 'flow', 'bump', 'mommy', 'partner', 'general'
  achieved_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, achievement_id)
);

-- Enable RLS
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own achievements" 
ON public.user_achievements FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own achievements" 
ON public.user_achievements FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own achievements" 
ON public.user_achievements FOR UPDATE 
USING (auth.uid() = user_id);

-- Add index for performance
CREATE INDEX idx_baby_milestones_user_id ON public.baby_milestones(user_id);
CREATE INDEX idx_user_achievements_user_id ON public.user_achievements(user_id);
CREATE INDEX idx_user_achievements_type ON public.user_achievements(achievement_type);

-- Enable realtime for achievements
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_achievements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.baby_milestones;