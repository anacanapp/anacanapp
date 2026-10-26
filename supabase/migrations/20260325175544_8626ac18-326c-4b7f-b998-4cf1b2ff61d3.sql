
-- App Languages table
CREATE TABLE public.app_languages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(10) NOT NULL UNIQUE,
  name varchar(100) NOT NULL,
  native_name varchar(100) NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  regions jsonb NOT NULL DEFAULT '[]'::jsonb,
  disabled_tools jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  icon_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_languages ENABLE ROW LEVEL SECURITY;

-- Everyone can read languages
CREATE POLICY "Anyone can read languages"
  ON public.app_languages FOR SELECT
  TO authenticated, anon
  USING (true);

-- Only admins can modify
CREATE POLICY "Admins can manage languages"
  ON public.app_languages FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Translations table
CREATE TABLE public.translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key varchar(255) NOT NULL,
  lang varchar(10) NOT NULL REFERENCES public.app_languages(code) ON DELETE CASCADE,
  value text NOT NULL DEFAULT '',
  namespace varchar(100) NOT NULL DEFAULT 'common',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(key, lang)
);

CREATE INDEX idx_translations_lang ON public.translations(lang);
CREATE INDEX idx_translations_namespace ON public.translations(namespace);
CREATE INDEX idx_translations_key_lang ON public.translations(key, lang);

ALTER TABLE public.translations ENABLE ROW LEVEL SECURITY;

-- Everyone can read translations
CREATE POLICY "Anyone can read translations"
  ON public.translations FOR SELECT
  TO authenticated, anon
  USING (true);

-- Only admins can modify
CREATE POLICY "Admins can manage translations"
  ON public.translations FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed Azerbaijani as default active language
INSERT INTO public.app_languages (code, name, native_name, is_active, regions, sort_order)
VALUES 
  ('az', 'Azerbaijani', 'Azərbaycan', true, '["AZ"]'::jsonb, 1),
  ('en', 'English', 'English', false, '["US","GB","AU","CA"]'::jsonb, 2),
  ('tr', 'Turkish', 'Türkçe', false, '["TR"]'::jsonb, 3),
  ('ru', 'Russian', 'Русский', false, '["RU","KZ","BY"]'::jsonb, 4);
