CREATE TABLE public.pregnancy_fetus_illustrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month_number INTEGER NOT NULL UNIQUE,
  image_url TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  title TEXT,
  title_az TEXT,
  title_en TEXT,
  title_ru TEXT,
  title_tr TEXT,
  title_kk TEXT,
  title_de TEXT,
  title_ar TEXT,
  title_ka TEXT,
  title_uz TEXT,
  description TEXT,
  description_az TEXT,
  description_en TEXT,
  description_ru TEXT,
  description_tr TEXT,
  description_kk TEXT,
  description_de TEXT,
  description_ar TEXT,
  description_ka TEXT,
  description_uz TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.pregnancy_fetus_illustrations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pregnancy_fetus_illustrations TO authenticated;
GRANT ALL ON public.pregnancy_fetus_illustrations TO service_role;

ALTER TABLE public.pregnancy_fetus_illustrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read fetus illustrations"
  ON public.pregnancy_fetus_illustrations FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins can manage fetus illustrations"
  ON public.pregnancy_fetus_illustrations FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));