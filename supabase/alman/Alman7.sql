-- ============================================================
-- Alman7 — common_saxla (PostCard redaktə düyməsi hardcoded idi)
-- ============================================================

INSERT INTO public.translations (key, lang, value, namespace) VALUES
  ('common_saxla', 'en', 'Save', 'common'),
  ('common_saxla', 'ru', 'Сохранить', 'common'),
  ('common_saxla', 'tr', 'Kaydet', 'common'),
  ('common_saxla', 'kk', 'Сақтау', 'common'),
  ('common_saxla', 'de', 'Speichern', 'common')
ON CONFLICT (key, lang) DO NOTHING;
