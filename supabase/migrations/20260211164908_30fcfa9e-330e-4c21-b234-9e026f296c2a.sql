
CREATE TABLE public.baby_daily_info (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  day_number INTEGER NOT NULL UNIQUE CHECK (day_number >= 1 AND day_number <= 1460),
  info TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.baby_daily_info ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read baby daily info" ON public.baby_daily_info FOR SELECT USING (true);
CREATE POLICY "Admins can manage baby daily info" ON public.baby_daily_info FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_baby_daily_info_updated_at
  BEFORE UPDATE ON public.baby_daily_info
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_baby_daily_info_day ON public.baby_daily_info (day_number);
