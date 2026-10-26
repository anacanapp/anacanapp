
CREATE TABLE public.intro_slides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT,
  description TEXT,
  icon_name TEXT NOT NULL DEFAULT 'Heart',
  gradient TEXT NOT NULL DEFAULT 'from-pink-500 to-rose-600',
  bg_decor TEXT DEFAULT 'bg-pink-100 dark:bg-pink-900/20',
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.intro_slides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active intro slides"
  ON public.intro_slides FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage intro slides"
  ON public.intro_slides FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
