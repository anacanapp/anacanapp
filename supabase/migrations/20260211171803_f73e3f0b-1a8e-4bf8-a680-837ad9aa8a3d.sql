
-- Create table for "Anaya Mesaj" daily messages (1-1460 days)
CREATE TABLE public.mommy_daily_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  day_number INTEGER NOT NULL,
  message TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT mommy_daily_messages_day_check CHECK (day_number >= 1 AND day_number <= 1460)
);

-- Unique constraint on day_number
CREATE UNIQUE INDEX idx_mommy_daily_messages_day ON public.mommy_daily_messages(day_number);

-- Enable RLS
ALTER TABLE public.mommy_daily_messages ENABLE ROW LEVEL SECURITY;

-- Public read for active messages
CREATE POLICY "Anyone can read active mommy daily messages"
  ON public.mommy_daily_messages FOR SELECT
  USING (is_active = true);

-- Admin full access
CREATE POLICY "Admins can manage mommy daily messages"
  ON public.mommy_daily_messages FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_mommy_daily_messages_updated_at
  BEFORE UPDATE ON public.mommy_daily_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
