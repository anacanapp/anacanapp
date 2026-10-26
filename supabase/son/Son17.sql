-- ============================================================
-- Son17: Push bildirişlərinin lokallaşdırılması
-- 1) pregnancy_day_notifications + mommy_day_notifications:
--    title_ru/body_ru/title_tr/body_tr sütunları (send-daily-notifications
--    pickLang() artıq bu sütunları oxumağa hazırdır)
-- 2) scheduled_notifications: 10 statik şablonun en/ru/tr tərcüməsi
--    (notification_type üzrə unikal uyğunlaşdırma)
-- ============================================================

-- 1) Sütunlar
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

-- 2) Statik şablonlar (Fable tərcüməsi; en yalnız boşdursa doldurulur)
UPDATE public.scheduled_notifications AS n SET
  title_en = COALESCE(NULLIF(n.title_en, ''), v.ten),
  body_en  = COALESCE(NULLIF(n.body_en,  ''), v.ben),
  title_ru = v.tru, body_ru = v.bru,
  title_tr = v.ttr, body_tr = v.btr
FROM (VALUES
  ('daily_tip',
   'Daily Reminder 💧', 'Don''t forget to drink water! Drink 8 glasses a day for your health.',
   'Напоминание дня 💧', 'Не забывайте пить воду! Для здоровья выпивайте 8 стаканов в день.',
   'Günün Hatırlatması 💧', 'Su içmeyi unutmayın! Sağlığınız için günde 8 bardak su için.'),
  ('morning_greeting',
   'Have a Great Morning ☀️', 'Have a wonderful day! Take some time for yourself today.',
   'Доброго утра ☀️', 'Хорошего дня! Уделите сегодня время себе.',
   'Güzel Bir Sabah ☀️', 'Gününüz hayırlı olsun! Bugün kendinize zaman ayırın.'),
  ('vitamin_reminder',
   'Vitamin Time 💊', 'Don''t forget to take your daily vitamins!',
   'Время витаминов 💊', 'Не забудьте принять ежедневные витамины!',
   'Vitamin Zamanı 💊', 'Günlük vitaminlerinizi almayı unutmayın!'),
  ('exercise_reminder',
   'Time to Move 🚶‍♀️', 'A short walk is good for your health.',
   'Время движения 🚶‍♀️', 'Небольшая прогулка полезна для вашего здоровья.',
   'Hareket Zamanı 🚶‍♀️', 'Kısa bir yürüyüşe çıkmak sağlığınız için faydalıdır.'),
  ('kick_counter',
   'Baby Kicks 👶', 'Don''t forget to log your baby''s movements today!',
   'Толчки малыша 👶', 'Не забудьте отметить движения малыша сегодня!',
   'Bebeğin Tekmeleri 👶', 'Bugün bebeğinizin hareketlerini kaydetmeyi unutmayın!'),
  ('self_care',
   'Self-Care ☕', 'Rest is very important during pregnancy. Take a little break.',
   'Забота о себе ☕', 'Отдых очень важен во время беременности. Немного отдохните.',
   'Kendinize Özen ☕', 'Hamilelikte dinlenmek çok önemlidir. Biraz dinlenin.'),
  ('daily_log',
   'Health Journal 📋', 'Log your mood and symptoms for today.',
   'Дневник здоровья 📋', 'Отметьте сегодняшнее настроение и симптомы.',
   'Sağlık Günlüğü 📋', 'Bugünkü ruh halinizi ve semptomlarınızı kaydedin.'),
  ('period_reminder',
   'Period Reminder 📅', 'Your next period is approaching. Be prepared!',
   'Напоминание о менструации 📅', 'Приближается дата следующей менструации. Будьте готовы!',
   'Regl Hatırlatması 📅', 'Bir sonraki regl tarihiniz yaklaşıyor. Hazırlıklı olun!'),
  ('mommy_tip',
   'Motherhood is Beautiful 💕', 'Every moment with your baby is precious. Cherish these moments!',
   'Быть мамой прекрасно 💕', 'Каждое мгновение с малышом бесценно. Цените эти моменты!',
   'Anne Olmak Güzeldir 💕', 'Bebeğinizle her an değerlidir. Bu anların kıymetini bilin!'),
  ('partner_tip',
   'Partner Support 💪', 'Don''t forget to support your partner today!',
   'Поддержка партнёра 💪', 'Не забудьте поддержать свою супругу сегодня!',
   'Partner Desteği 💪', 'Eşinize bugün destek olmayı unutmayın!')
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

-- Yoxlama: hər iki sorğu 0 qaytarmalıdır
SELECT count(*) AS scheduled_terjumesiz
FROM public.scheduled_notifications WHERE title_ru IS NULL;

SELECT
  (SELECT count(*) FROM public.pregnancy_day_notifications WHERE title_ru IS NULL) AS preg_terjumesiz,
  (SELECT count(*) FROM public.mommy_day_notifications WHERE title_ru IS NULL) AS mommy_terjumesiz;
