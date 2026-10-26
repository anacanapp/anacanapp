-- Create user_children table for multiple children support
CREATE TABLE public.user_children (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  birth_date DATE NOT NULL,
  gender TEXT DEFAULT 'unknown', -- 'boy', 'girl', 'unknown'
  avatar_emoji TEXT DEFAULT '👶',
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add child_id to teething logs
ALTER TABLE public.user_teething_logs 
ADD COLUMN child_id UUID REFERENCES public.user_children(id) ON DELETE CASCADE;

-- Add child_id to baby_growth
ALTER TABLE public.baby_growth 
ADD COLUMN child_id UUID REFERENCES public.user_children(id) ON DELETE CASCADE;

-- Add child_id to baby_logs
ALTER TABLE public.baby_logs 
ADD COLUMN child_id UUID REFERENCES public.user_children(id) ON DELETE CASCADE;

-- Add child_id to baby_milestones
ALTER TABLE public.baby_milestones 
ADD COLUMN child_id UUID REFERENCES public.user_children(id) ON DELETE CASCADE;

-- Enable RLS
ALTER TABLE public.user_children ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_children
CREATE POLICY "Users can view own children" ON public.user_children FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own children" ON public.user_children FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own children" ON public.user_children FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own children" ON public.user_children FOR DELETE USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_user_children_user_id ON public.user_children(user_id);
CREATE INDEX idx_teething_logs_child_id ON public.user_teething_logs(child_id);
CREATE INDEX idx_baby_growth_child_id ON public.baby_growth(child_id);
CREATE INDEX idx_baby_logs_child_id ON public.baby_logs(child_id);

-- Drop the old unique constraint and add new one with child_id
ALTER TABLE public.user_teething_logs DROP CONSTRAINT IF EXISTS user_teething_logs_user_id_tooth_id_key;
ALTER TABLE public.user_teething_logs ADD CONSTRAINT user_teething_logs_user_child_tooth_key UNIQUE(user_id, child_id, tooth_id);