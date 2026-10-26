-- Duzelis38: Apple/Google ilə qeydiyyatda ad heç vaxt soruşulmurdu (native
-- OAuth axını ID token-dən kənar profil məlumatı göndərmirdi) →
-- handle_new_user() trigger-i defolt olaraq 'İstifadəçi' yazırdı. İndi
-- onboarding-in İLK addımı olaraq MƏCBURİ ad sorğusu əlavə edildi (həm yeni
-- OAuth istifadəçiləri, həm də adı hələ də bu placeholder olan mövcud
-- hesablar üçün, növbəti giriş zamanı bir dəfə).
-- QEYD: translations cədvəli ru/tr/kk/de/ar üçün overlay kimi seed
-- fayllarından ÜSTÜNDÜR (bax src/lib/i18n.ts loadTranslations) — bu
-- sətirlər yazılmasa, kod/seed dəyişikliyinə baxmayaraq həmin 5 dildə
-- yeni ad-addımı mətni göstərilməyəcəkdi (untranslated_ fallback qalacaqdı).
-- Idempotent — safe to re-run.

INSERT INTO public.translations (key, lang, value, namespace) VALUES
  ('ponb_name_title', 'az', 'Necə çağıraq sizi?', 'common'),
  ('ponb_name_title', 'en', 'What should we call you?', 'common'),
  ('ponb_name_title', 'ru', 'Как вас называть?', 'common'),
  ('ponb_name_title', 'tr', 'Size nasıl hitap edelim?', 'common'),
  ('ponb_name_title', 'kk', 'Сізді қалай атайық?', 'common'),
  ('ponb_name_title', 'de', 'Wie sollen wir dich nennen?', 'common'),
  ('ponb_name_title', 'ar', 'بماذا نناديكِ؟', 'common'),

  ('ponb_name_sub', 'az', 'Tətbiqi tam sizə uyğunlaşdıraq', 'common'),
  ('ponb_name_sub', 'en', 'Let''s personalize the app just for you', 'common'),
  ('ponb_name_sub', 'ru', 'Давайте персонализируем приложение для вас', 'common'),
  ('ponb_name_sub', 'tr', 'Uygulamayı sizin için kişiselleştirelim', 'common'),
  ('ponb_name_sub', 'kk', 'Қолданбаны сізге арнап жекелендірейік', 'common'),
  ('ponb_name_sub', 'de', 'Lass uns die App ganz auf dich zuschneiden', 'common'),
  ('ponb_name_sub', 'ar', 'دعينا نخصص التطبيق لكِ بالكامل', 'common'),

  ('ponb_name_label', 'az', 'Adınız', 'common'),
  ('ponb_name_label', 'en', 'Your name', 'common'),
  ('ponb_name_label', 'ru', 'Ваше имя', 'common'),
  ('ponb_name_label', 'tr', 'Adınız', 'common'),
  ('ponb_name_label', 'kk', 'Атыңыз', 'common'),
  ('ponb_name_label', 'de', 'Dein Name', 'common'),
  ('ponb_name_label', 'ar', 'اسمكِ', 'common'),

  ('ponb_name_ph', 'az', 'məs. Aylin', 'common'),
  ('ponb_name_ph', 'en', 'e.g. Emily', 'common'),
  ('ponb_name_ph', 'ru', 'напр. Айгуль', 'common'),
  ('ponb_name_ph', 'tr', 'örn. Elif', 'common'),
  ('ponb_name_ph', 'kk', 'мыс. Айгүл', 'common'),
  ('ponb_name_ph', 'de', 'z. B. Lena', 'common'),
  ('ponb_name_ph', 'ar', 'مثال: سارة', 'common'),

  ('onboardingscreen_adinizi_deyin_baslik', 'az', 'Necə çağıraq sizi?', 'common'),
  ('onboardingscreen_adinizi_deyin_baslik', 'en', 'What should we call you?', 'common'),
  ('onboardingscreen_adinizi_deyin_baslik', 'ru', 'Как вас называть?', 'common'),
  ('onboardingscreen_adinizi_deyin_baslik', 'tr', 'Size nasıl hitap edelim?', 'common'),
  ('onboardingscreen_adinizi_deyin_baslik', 'kk', 'Сізді қалай атайық?', 'common'),
  ('onboardingscreen_adinizi_deyin_baslik', 'de', 'Wie sollen wir dich nennen?', 'common'),
  ('onboardingscreen_adinizi_deyin_baslik', 'ar', 'بماذا نناديكِ؟', 'common'),

  ('onboardingscreen_adinizi_deyin_alt', 'az', 'Tətbiqi tam sizə uyğunlaşdıraq', 'common'),
  ('onboardingscreen_adinizi_deyin_alt', 'en', 'Let''s personalize the app just for you', 'common'),
  ('onboardingscreen_adinizi_deyin_alt', 'ru', 'Давайте персонализируем приложение для вас', 'common'),
  ('onboardingscreen_adinizi_deyin_alt', 'tr', 'Uygulamayı sizin için kişiselleştirelim', 'common'),
  ('onboardingscreen_adinizi_deyin_alt', 'kk', 'Қолданбаны сізге арнап жекелендірейік', 'common'),
  ('onboardingscreen_adinizi_deyin_alt', 'de', 'Lass uns die App ganz auf dich zuschneiden', 'common'),
  ('onboardingscreen_adinizi_deyin_alt', 'ar', 'دعينا نخصص التطبيق لكِ بالكامل', 'common')
ON CONFLICT (key, lang) DO UPDATE SET value = EXCLUDED.value;
