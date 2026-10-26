-- Create meal_logs table for tracking daily food intake
CREATE TABLE public.meal_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  meal_type text NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  food_name text NOT NULL,
  calories integer NOT NULL DEFAULT 0,
  portion text,
  notes text,
  logged_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_meal_logs_user_id ON public.meal_logs(user_id);
CREATE INDEX idx_meal_logs_logged_at ON public.meal_logs(logged_at);

-- Enable RLS
ALTER TABLE public.meal_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for meal_logs
CREATE POLICY "Users can view their own meal logs"
ON public.meal_logs FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own meal logs"
ON public.meal_logs FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own meal logs"
ON public.meal_logs FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own meal logs"
ON public.meal_logs FOR DELETE
USING (auth.uid() = user_id);

-- Allow partners to view meal logs
CREATE POLICY "Partners can view linked user meal logs"
ON public.meal_logs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
    AND p.linked_partner_id = meal_logs.user_id
  )
);

-- Enable realtime for meal_logs
ALTER PUBLICATION supabase_realtime ADD TABLE public.meal_logs;