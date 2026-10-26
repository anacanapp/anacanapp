-- Create partner_surprises table
CREATE TABLE public.partner_surprises (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  surprise_id TEXT NOT NULL,
  surprise_title TEXT NOT NULL,
  surprise_emoji TEXT NOT NULL,
  surprise_category TEXT NOT NULL,
  surprise_points INTEGER NOT NULL DEFAULT 0,
  planned_date DATE NOT NULL,
  completed_date TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.partner_surprises ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own surprises" 
  ON public.partner_surprises 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own surprises" 
  ON public.partner_surprises 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own surprises" 
  ON public.partner_surprises 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own surprises" 
  ON public.partner_surprises 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_partner_surprises_updated_at
  BEFORE UPDATE ON public.partner_surprises
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();