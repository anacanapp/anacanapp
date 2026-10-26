
-- Create mommy day notifications table (1-1460 days, multiple per day)
CREATE TABLE public.mommy_day_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  day_number INTEGER NOT NULL CHECK (day_number >= 1 AND day_number <= 1460),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  emoji TEXT DEFAULT '👶',
  send_time TEXT NOT NULL DEFAULT '09:00',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast lookup
CREATE INDEX idx_mommy_day_notifications_day ON public.mommy_day_notifications(day_number);
CREATE INDEX idx_mommy_day_notifications_active ON public.mommy_day_notifications(is_active);

-- Enable RLS
ALTER TABLE public.mommy_day_notifications ENABLE ROW LEVEL SECURITY;

-- Public read for all authenticated users
CREATE POLICY "Anyone can read mommy day notifications"
  ON public.mommy_day_notifications FOR SELECT
  TO authenticated
  USING (true);

-- Admin manage
CREATE POLICY "Admins can manage mommy day notifications"
  ON public.mommy_day_notifications FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Updated_at trigger
CREATE TRIGGER update_mommy_day_notifications_updated_at
  BEFORE UPDATE ON public.mommy_day_notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
