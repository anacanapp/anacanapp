-- ============================================================
-- Son17: Push bildiriÅŸlÉ™rinin lokallaÅŸdÄ±rÄ±lmasÄ±
-- 1) pregnancy_day_notifications + mommy_day_notifications:
--    title_ru/body_ru/title_tr/body_tr sÃ¼tunlarÄ± (send-daily-notifications
--    pickLang() artÄ±q bu sÃ¼tunlarÄ± oxumaÄŸa hazÄ±rdÄ±r)
-- 2) scheduled_notifications: 10 statik ÅŸablonun en/ru/tr tÉ™rcÃ¼mÉ™si
--    (notification_type Ã¼zrÉ™ unikal uyÄŸunlaÅŸdÄ±rma)
-- ============================================================

-- 1) SÃ¼tunlar
ALTER TABLE public.pregnancy_day_notifications
  ADD COLUMN IF NOT EXISTS title_ru TEXT,
  ADD COLUMN IF NOT EXISTS body_ru  TEXT,
  ADD COLUMN IF NOT EXISTS title_tr TEXT,
  ADD COLUMN IF NOT EXISTS body_tr  TEXT;

ALTER TABLE public.mommy_day_notifications
  ADD COLUMN IF NOT EXISTS title_ru TEXT,
  ADD COLUMN IF NOT EXISTS body_ru  TEXT,
  ADD COLUMN IF NOT EXISTS title_tr TEXT,
  ADD COLUMN IF NOT EXISTS body_tr  TEXT;

-- AZURE: bu sütunları normalda 20260813160000_notifications_i18n_ru_tr.sql əlavə edir,
-- lakin onun fayl-adı vaxt möhürü (16:00:00) bu fayldan (15:00:35) SONRA olduğu üçün
-- xronoloji sırayla tətbiq edərkən aşağıdakı UPDATE bu sütunlar hələ mövcud olmadan
-- işə düşür — ordinal timestamp bug. Idempotent (IF NOT EXISTS) olduğu üçün burada
-- əvvəlcədən əlavə etmək təhlükəsizdir (20260813160000 sonra yenidən cəhd etsə də NOTICE/skip olar).
ALTER TABLE public.scheduled_notifications
  ADD COLUMN IF NOT EXISTS title_ru text,
  ADD COLUMN IF NOT EXISTS title_tr text,
  ADD COLUMN IF NOT EXISTS body_ru text,
  ADD COLUMN IF NOT EXISTS body_tr text;

-- 2) Statik ÅŸablonlar (Fable tÉ™rcÃ¼mÉ™si; en yalnÄ±z boÅŸdursa doldurulur)
UPDATE public.scheduled_notifications AS n SET
  title_en = COALESCE(NULLIF(n.title_en, ''), v.ten),
  body_en  = COALESCE(NULLIF(n.body_en,  ''), v.ben),
  title_ru = v.tru, body_ru = v.bru,
  title_tr = v.ttr, body_tr = v.btr
FROM (VALUES
  ('daily_tip',
   'Daily Reminder ðŸ’§', 'Don''t forget to drink water! Drink 8 glasses a day for your health.',
   'ÐÐ°Ð¿Ð¾Ð¼Ð¸Ð½Ð°Ð½Ð¸Ðµ Ð´Ð½Ñ ðŸ’§', 'ÐÐµ Ð·Ð°Ð±Ñ‹Ð²Ð°Ð¹Ñ‚Ðµ Ð¿Ð¸Ñ‚ÑŒ Ð²Ð¾Ð´Ñƒ! Ð”Ð»Ñ Ð·Ð´Ð¾Ñ€Ð¾Ð²ÑŒÑ Ð²Ñ‹Ð¿Ð¸Ð²Ð°Ð¹Ñ‚Ðµ 8 ÑÑ‚Ð°ÐºÐ°Ð½Ð¾Ð² Ð² Ð´ÐµÐ½ÑŒ.',
   'GÃ¼nÃ¼n HatÄ±rlatmasÄ± ðŸ’§', 'Su iÃ§meyi unutmayÄ±n! SaÄŸlÄ±ÄŸÄ±nÄ±z iÃ§in gÃ¼nde 8 bardak su iÃ§in.'),
  ('morning_greeting',
   'Have a Great Morning â˜€ï¸', 'Have a wonderful day! Take some time for yourself today.',
   'Ð”Ð¾Ð±Ñ€Ð¾Ð³Ð¾ ÑƒÑ‚Ñ€Ð° â˜€ï¸', 'Ð¥Ð¾Ñ€Ð¾ÑˆÐµÐ³Ð¾ Ð´Ð½Ñ! Ð£Ð´ÐµÐ»Ð¸Ñ‚Ðµ ÑÐµÐ³Ð¾Ð´Ð½Ñ Ð²Ñ€ÐµÐ¼Ñ ÑÐµÐ±Ðµ.',
   'GÃ¼zel Bir Sabah â˜€ï¸', 'GÃ¼nÃ¼nÃ¼z hayÄ±rlÄ± olsun! BugÃ¼n kendinize zaman ayÄ±rÄ±n.'),
  ('vitamin_reminder',
   'Vitamin Time ðŸ’Š', 'Don''t forget to take your daily vitamins!',
   'Ð’Ñ€ÐµÐ¼Ñ Ð²Ð¸Ñ‚Ð°Ð¼Ð¸Ð½Ð¾Ð² ðŸ’Š', 'ÐÐµ Ð·Ð°Ð±ÑƒÐ´ÑŒÑ‚Ðµ Ð¿Ñ€Ð¸Ð½ÑÑ‚ÑŒ ÐµÐ¶ÐµÐ´Ð½ÐµÐ²Ð½Ñ‹Ðµ Ð²Ð¸Ñ‚Ð°Ð¼Ð¸Ð½Ñ‹!',
   'Vitamin ZamanÄ± ðŸ’Š', 'GÃ¼nlÃ¼k vitaminlerinizi almayÄ± unutmayÄ±n!'),
  ('exercise_reminder',
   'Time to Move ðŸš¶â€â™€ï¸', 'A short walk is good for your health.',
   'Ð’Ñ€ÐµÐ¼Ñ Ð´Ð²Ð¸Ð¶ÐµÐ½Ð¸Ñ ðŸš¶â€â™€ï¸', 'ÐÐµÐ±Ð¾Ð»ÑŒÑˆÐ°Ñ Ð¿Ñ€Ð¾Ð³ÑƒÐ»ÐºÐ° Ð¿Ð¾Ð»ÐµÐ·Ð½Ð° Ð´Ð»Ñ Ð²Ð°ÑˆÐµÐ³Ð¾ Ð·Ð´Ð¾Ñ€Ð¾Ð²ÑŒÑ.',
   'Hareket ZamanÄ± ðŸš¶â€â™€ï¸', 'KÄ±sa bir yÃ¼rÃ¼yÃ¼ÅŸe Ã§Ä±kmak saÄŸlÄ±ÄŸÄ±nÄ±z iÃ§in faydalÄ±dÄ±r.'),
  ('kick_counter',
   'Baby Kicks ðŸ‘¶', 'Don''t forget to log your baby''s movements today!',
   'Ð¢Ð¾Ð»Ñ‡ÐºÐ¸ Ð¼Ð°Ð»Ñ‹ÑˆÐ° ðŸ‘¶', 'ÐÐµ Ð·Ð°Ð±ÑƒÐ´ÑŒÑ‚Ðµ Ð¾Ñ‚Ð¼ÐµÑ‚Ð¸Ñ‚ÑŒ Ð´Ð²Ð¸Ð¶ÐµÐ½Ð¸Ñ Ð¼Ð°Ð»Ñ‹ÑˆÐ° ÑÐµÐ³Ð¾Ð´Ð½Ñ!',
   'BebeÄŸin Tekmeleri ðŸ‘¶', 'BugÃ¼n bebeÄŸinizin hareketlerini kaydetmeyi unutmayÄ±n!'),
  ('self_care',
   'Self-Care â˜•', 'Rest is very important during pregnancy. Take a little break.',
   'Ð—Ð°Ð±Ð¾Ñ‚Ð° Ð¾ ÑÐµÐ±Ðµ â˜•', 'ÐžÑ‚Ð´Ñ‹Ñ… Ð¾Ñ‡ÐµÐ½ÑŒ Ð²Ð°Ð¶ÐµÐ½ Ð²Ð¾ Ð²Ñ€ÐµÐ¼Ñ Ð±ÐµÑ€ÐµÐ¼ÐµÐ½Ð½Ð¾ÑÑ‚Ð¸. ÐÐµÐ¼Ð½Ð¾Ð³Ð¾ Ð¾Ñ‚Ð´Ð¾Ñ…Ð½Ð¸Ñ‚Ðµ.',
   'Kendinize Ã–zen â˜•', 'Hamilelikte dinlenmek Ã§ok Ã¶nemlidir. Biraz dinlenin.'),
  ('daily_log',
   'Health Journal ðŸ“‹', 'Log your mood and symptoms for today.',
   'Ð”Ð½ÐµÐ²Ð½Ð¸Ðº Ð·Ð´Ð¾Ñ€Ð¾Ð²ÑŒÑ ðŸ“‹', 'ÐžÑ‚Ð¼ÐµÑ‚ÑŒÑ‚Ðµ ÑÐµÐ³Ð¾Ð´Ð½ÑÑˆÐ½ÐµÐµ Ð½Ð°ÑÑ‚Ñ€Ð¾ÐµÐ½Ð¸Ðµ Ð¸ ÑÐ¸Ð¼Ð¿Ñ‚Ð¾Ð¼Ñ‹.',
   'SaÄŸlÄ±k GÃ¼nlÃ¼ÄŸÃ¼ ðŸ“‹', 'BugÃ¼nkÃ¼ ruh halinizi ve semptomlarÄ±nÄ±zÄ± kaydedin.'),
  ('period_reminder',
   'Period Reminder ðŸ“…', 'Your next period is approaching. Be prepared!',
   'ÐÐ°Ð¿Ð¾Ð¼Ð¸Ð½Ð°Ð½Ð¸Ðµ Ð¾ Ð¼ÐµÐ½ÑÑ‚Ñ€ÑƒÐ°Ñ†Ð¸Ð¸ ðŸ“…', 'ÐŸÑ€Ð¸Ð±Ð»Ð¸Ð¶Ð°ÐµÑ‚ÑÑ Ð´Ð°Ñ‚Ð° ÑÐ»ÐµÐ´ÑƒÑŽÑ‰ÐµÐ¹ Ð¼ÐµÐ½ÑÑ‚Ñ€ÑƒÐ°Ñ†Ð¸Ð¸. Ð‘ÑƒÐ´ÑŒÑ‚Ðµ Ð³Ð¾Ñ‚Ð¾Ð²Ñ‹!',
   'Regl HatÄ±rlatmasÄ± ðŸ“…', 'Bir sonraki regl tarihiniz yaklaÅŸÄ±yor. HazÄ±rlÄ±klÄ± olun!'),
  ('mommy_tip',
   'Motherhood is Beautiful ðŸ’•', 'Every moment with your baby is precious. Cherish these moments!',
   'Ð‘Ñ‹Ñ‚ÑŒ Ð¼Ð°Ð¼Ð¾Ð¹ Ð¿Ñ€ÐµÐºÑ€Ð°ÑÐ½Ð¾ ðŸ’•', 'ÐšÐ°Ð¶Ð´Ð¾Ðµ Ð¼Ð³Ð½Ð¾Ð²ÐµÐ½Ð¸Ðµ Ñ Ð¼Ð°Ð»Ñ‹ÑˆÐ¾Ð¼ Ð±ÐµÑÑ†ÐµÐ½Ð½Ð¾. Ð¦ÐµÐ½Ð¸Ñ‚Ðµ ÑÑ‚Ð¸ Ð¼Ð¾Ð¼ÐµÐ½Ñ‚Ñ‹!',
   'Anne Olmak GÃ¼zeldir ðŸ’•', 'BebeÄŸinizle her an deÄŸerlidir. Bu anlarÄ±n kÄ±ymetini bilin!'),
  ('partner_tip',
   'Partner Support ðŸ’ª', 'Don''t forget to support your partner today!',
   'ÐŸÐ¾Ð´Ð´ÐµÑ€Ð¶ÐºÐ° Ð¿Ð°Ñ€Ñ‚Ð½Ñ‘Ñ€Ð° ðŸ’ª', 'ÐÐµ Ð·Ð°Ð±ÑƒÐ´ÑŒÑ‚Ðµ Ð¿Ð¾Ð´Ð´ÐµÑ€Ð¶Ð°Ñ‚ÑŒ ÑÐ²Ð¾ÑŽ ÑÑƒÐ¿Ñ€ÑƒÐ³Ñƒ ÑÐµÐ³Ð¾Ð´Ð½Ñ!',
   'Partner DesteÄŸi ðŸ’ª', 'EÅŸinize bugÃ¼n destek olmayÄ± unutmayÄ±n!')
) AS v(ntype, ten, ben, tru, bru, ttr, btr)
WHERE n.notification_type = v.ntype;

-- Timer kanal adı açarları (ru/tr/en) — Son17-yə əlavə
INSERT INTO public.translations (key, lang, value, namespace) VALUES
  ('livetimer_channel_name', 'ru', 'Таймеры', 'common'),
  ('livetimer_channel_name', 'tr', 'Zamanlayıcılar', 'common'),
  ('livetimer_channel_name', 'en', 'Timers', 'common'),
  ('livetimer_channel_desc', 'ru', 'Активные таймеры кормления / сна', 'common'),
  ('livetimer_channel_desc', 'tr', 'Aktif emzirme / uyku zamanlayıcıları', 'common'),
  ('livetimer_channel_desc', 'en', 'Active feeding / sleep timers', 'common')
ON CONFLICT (key, lang) DO NOTHING;
