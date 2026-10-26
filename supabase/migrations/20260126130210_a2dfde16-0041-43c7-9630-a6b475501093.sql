-- Create table for pregnancy day-specific notifications (0-280 days)
CREATE TABLE public.pregnancy_day_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_number INTEGER NOT NULL CHECK (day_number >= 0 AND day_number <= 280),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  emoji TEXT DEFAULT '👶',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(day_number)
);

-- Enable RLS
ALTER TABLE public.pregnancy_day_notifications ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read (for edge functions)
CREATE POLICY "Anyone can read pregnancy day notifications"
ON public.pregnancy_day_notifications FOR SELECT
TO authenticated
USING (true);

-- Only admins can modify
CREATE POLICY "Admins can manage pregnancy day notifications"
ON public.pregnancy_day_notifications FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create index for fast day lookup
CREATE INDEX idx_pregnancy_day_notifications_day ON public.pregnancy_day_notifications(day_number);

-- Create table for bulk push notifications
CREATE TABLE public.bulk_push_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  target_audience TEXT NOT NULL DEFAULT 'all',
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  total_sent INTEGER DEFAULT 0,
  total_failed INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bulk_push_notifications ENABLE ROW LEVEL SECURITY;

-- Admins can manage bulk notifications
CREATE POLICY "Admins can manage bulk push notifications"
ON public.bulk_push_notifications FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Add pregnancy_day column to profiles for tracking
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS pregnancy_day INTEGER DEFAULT NULL;

-- Add trigger for updated_at
CREATE TRIGGER update_pregnancy_day_notifications_updated_at
BEFORE UPDATE ON public.pregnancy_day_notifications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();