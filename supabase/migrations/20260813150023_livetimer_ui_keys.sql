-- ============================================================
-- Live Timer UI açarları (kilid ekranı bildirişi mətnləri) — ru/tr/en
-- ON CONFLICT DO NOTHING — idempotent.
-- ============================================================
INSERT INTO public.translations (key, lang, value, namespace) VALUES
  ('livetimer_davam_edir', 'ru', 'Идёт — нажмите кнопку, чтобы остановить', 'common'),
  ('livetimer_dayandir',   'ru', 'Остановить', 'common'),
  ('livetimer_davam_edir', 'tr', 'Devam ediyor — durdurmak için düğmeye basın', 'common'),
  ('livetimer_dayandir',   'tr', 'Durdur', 'common'),
  ('livetimer_davam_edir', 'en', 'Running — tap the button to stop', 'common'),
  ('livetimer_dayandir',   'en', 'Stop', 'common')
ON CONFLICT (key, lang) DO NOTHING;
