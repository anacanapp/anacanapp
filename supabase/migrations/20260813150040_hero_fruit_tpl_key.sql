-- Bump hero fruit şablonu (təbii söz sırası hər dildə) — idempotent
INSERT INTO public.translations (key, lang, value, namespace) VALUES
  ('dashboard_hero_fruit_tpl', 'ru', 'Мамочка, сейчас я размером с {fruit}', 'common'),
  ('dashboard_hero_fruit_tpl', 'tr', 'Anneciğim şu an {fruit} büyüklükteyim', 'common'),
  ('dashboard_hero_fruit_tpl', 'en', 'Mommy, right now I''m the size of {fruit}', 'common')
ON CONFLICT (key, lang) DO NOTHING;
