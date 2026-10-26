-- Create baby growth tracking table
CREATE TABLE public.baby_growth (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  weight_kg NUMERIC(4,2) NULL,
  height_cm NUMERIC(5,1) NULL,
  head_cm NUMERIC(4,1) NULL,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.baby_growth ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own growth entries"
ON public.baby_growth FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own growth entries"
ON public.baby_growth FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own growth entries"
ON public.baby_growth FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own growth entries"
ON public.baby_growth FOR DELETE
USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_baby_growth_user_date ON public.baby_growth(user_id, entry_date DESC);