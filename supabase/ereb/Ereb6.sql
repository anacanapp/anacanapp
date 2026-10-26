-- ============================================================
-- Ereb6 — Bug fix: "Vitamin" sözü Dashboard-da (a-trio) heç bir
-- dildə tərcümə olunmurdu (hardcode qalmışdı). Açar: dashboard_vitamin_8331ee
-- Bütün 7 dil üçün DB overlay (yerli seed fayllar artıq yeniləndi, bu isə
-- admin-panel redaktə imkanı və DB<->seed sinxronluğu üçündür).
-- İdempotentdir.
-- ============================================================

INSERT INTO public.translations (key, lang, value, namespace) VALUES
  ('dashboard_vitamin_8331ee', 'az', 'Vitamin', 'common'),
  ('dashboard_vitamin_8331ee', 'en', 'Vitamin', 'common'),
  ('dashboard_vitamin_8331ee', 'ru', 'Витамин', 'common'),
  ('dashboard_vitamin_8331ee', 'tr', 'Vitamin', 'common'),
  ('dashboard_vitamin_8331ee', 'kk', 'Дәрумен', 'common'),
  ('dashboard_vitamin_8331ee', 'de', 'Vitamin', 'common'),
  ('dashboard_vitamin_8331ee', 'ar', 'فيتامين', 'common')
ON CONFLICT (key, lang) DO UPDATE SET value = EXCLUDED.value;
