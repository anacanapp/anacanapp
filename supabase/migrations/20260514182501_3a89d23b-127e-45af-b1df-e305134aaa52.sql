
INSERT INTO public.app_settings (key, value, description)
VALUES ('mommy_hero_variant', '"classic"'::jsonb, 'Mommy dashboard hero design variant: classic | aurora | storybook')
ON CONFLICT (key) DO NOTHING;
