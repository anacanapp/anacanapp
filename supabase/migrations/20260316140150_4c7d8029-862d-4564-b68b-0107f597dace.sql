
-- User vitamin schedules table
CREATE TABLE public.user_vitamin_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  vitamin_name TEXT NOT NULL,
  icon_emoji TEXT NOT NULL DEFAULT '💊',
  scheduled_time TIME NOT NULL,
  days_of_week INTEGER[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  notification_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_vitamin_schedules ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own vitamin schedules"
  ON public.user_vitamin_schedules FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own vitamin schedules"
  ON public.user_vitamin_schedules FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own vitamin schedules"
  ON public.user_vitamin_schedules FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own vitamin schedules"
  ON public.user_vitamin_schedules FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Vitamin intake log
CREATE TABLE public.vitamin_intake_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  schedule_id UUID REFERENCES public.user_vitamin_schedules(id) ON DELETE CASCADE,
  vitamin_name TEXT NOT NULL,
  taken_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vitamin_intake_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own vitamin logs"
  ON public.vitamin_intake_logs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own vitamin logs"
  ON public.vitamin_intake_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own vitamin logs"
  ON public.vitamin_intake_logs FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
