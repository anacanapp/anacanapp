-- Duzelis18: Mini Oyunlar (Birlesdir/Saglam Sebet) ucun lokal Error Boundary
-- elave edildi (evvelki vezyyetde bu oyun ekranlarinin etrafinda HEC bir
-- lokal xeta-tutma yoxdu idi -- hemin yerde bas veren HER HANSI gozlenilmez
-- xeta butun tetbiqi (App.tsx-deki root ErrorBoundary vasitesile) sixirdi,
-- istifadecinin "minified react error" kimi gorduyu de mehz budur).
-- Bu 3 yeni acar o lokal fallback ekraninin metnleridir.
-- Idempotent -- safe to re-run.

INSERT INTO public.translations (key, lang, value, namespace) VALUES
  ('minigames_crash_title', 'az', 'Oyunda gözlənilməz xəta baş verdi', 'common'),
  ('minigames_crash_title', 'en', 'An unexpected error occurred in the game', 'common'),
  ('minigames_crash_title', 'ru', 'В игре произошла непредвиденная ошибка', 'common'),
  ('minigames_crash_title', 'tr', 'Oyunda beklenmedik bir hata oluştu', 'common'),
  ('minigames_crash_title', 'kk', 'Ойында күтпеген қате орын алды', 'common'),
  ('minigames_crash_title', 'de', 'Im Spiel ist ein unerwarteter Fehler aufgetreten', 'common'),
  ('minigames_crash_title', 'ar', 'حدث خطأ غير متوقع في اللعبة', 'common'),
  ('minigames_crash_desc', 'az', 'Narahat olmayın, irəliləyişiniz saxlanılıb. Səviyyələrə qayıdıb yenidən cəhd edə bilərsiniz.', 'common'),
  ('minigames_crash_desc', 'en', 'Don''t worry, your progress has been saved. You can go back to levels and try again.', 'common'),
  ('minigames_crash_desc', 'ru', 'Не волнуйтесь, ваш прогресс сохранён. Вы можете вернуться к уровням и попробовать снова.', 'common'),
  ('minigames_crash_desc', 'tr', 'Endişelenmeyin, ilerlemeniz kaydedildi. Seviyelere dönüp tekrar deneyebilirsiniz.', 'common'),
  ('minigames_crash_desc', 'kk', 'Уайымдамаңыз, прогресс сақталды. Деңгейлерге оралып, қайта көре аласыз.', 'common'),
  ('minigames_crash_desc', 'de', 'Keine Sorge, Ihr Fortschritt wurde gespeichert. Sie können zu den Levels zurückkehren und es erneut versuchen.', 'common'),
  ('minigames_crash_desc', 'ar', 'لا تقلقي، تم حفظ تقدمك. يمكنك العودة إلى المستويات والمحاولة مرة أخرى.', 'common'),
  ('minigames_crash_back_button', 'az', 'Səviyyələrə qayıt', 'common'),
  ('minigames_crash_back_button', 'en', 'Back to levels', 'common'),
  ('minigames_crash_back_button', 'ru', 'Вернуться к уровням', 'common'),
  ('minigames_crash_back_button', 'tr', 'Seviyelere dön', 'common'),
  ('minigames_crash_back_button', 'kk', 'Деңгейлерге оралу', 'common'),
  ('minigames_crash_back_button', 'de', 'Zurück zu den Levels', 'common'),
  ('minigames_crash_back_button', 'ar', 'العودة إلى المستويات', 'common')
ON CONFLICT (key, lang) DO UPDATE SET value = EXCLUDED.value;
