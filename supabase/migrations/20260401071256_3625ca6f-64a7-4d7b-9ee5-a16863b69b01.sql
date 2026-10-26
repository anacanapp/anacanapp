
-- Table to store individual period day logs (Apple Health style)
CREATE TABLE public.period_day_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  log_date DATE NOT NULL,
  flow_intensity TEXT DEFAULT 'medium',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, log_date)
);

-- Enable RLS
ALTER TABLE public.period_day_logs ENABLE ROW LEVEL SECURITY;

-- Users can only see their own period logs
CREATE POLICY "Users can view own period logs"
  ON public.period_day_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own period logs
CREATE POLICY "Users can insert own period logs"
  ON public.period_day_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own period logs
CREATE POLICY "Users can delete own period logs"
  ON public.period_day_logs FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can update their own period logs
CREATE POLICY "Users can update own period logs"
  ON public.period_day_logs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX idx_period_day_logs_user_date ON public.period_day_logs(user_id, log_date);
