-- Duzelis11: Ananın öz yuxusunu izləmək üçün daily_logs-a sütun əlavəsi.
-- (Mommy mərhələsində əvvəllər YALNIZ körpənin yuxusu izlənirdi — bax
-- baby_logs/log_type='sleep' — ananın öz yuxusu heç yerdə yox idi. Flow
-- mərhələsində bu artıq flow_daily_logs.sleep_hours/sleep_quality kimi var,
-- eyni məntiq daily_logs-a (bump/mommy-nin ümumi gündəlik qeyd cədvəli) köçürülür.)
-- Idempotent — safe to re-run.

ALTER TABLE public.daily_logs
  ADD COLUMN IF NOT EXISTS sleep_hours numeric,
  ADD COLUMN IF NOT EXISTS sleep_quality integer;

COMMENT ON COLUMN public.daily_logs.sleep_hours IS 'Ananın öz yuxu müddəti (saat) — bump/mommy mərhələsində MotherSleepWidget vasitəsilə qeyd olunur';
COMMENT ON COLUMN public.daily_logs.sleep_quality IS 'Ananın öz yuxu keyfiyyəti (1-5) — flow_daily_logs.sleep_quality ilə eyni miqyas';

-- ============================================================
-- Yeni UI translation keys (Health inteqrasiyası + Mənim yuxum widget-i) —
-- DB overlay bütün 7 dil üçün (lokal seed faylları da birbaşa yeniləndi).
-- ============================================================
INSERT INTO public.translations (key, lang, value, namespace) VALUES
  ('health_mindfulness_title', 'az', 'Rahatlama (bu həftə)', 'health'),
  ('health_mindfulness_title', 'en', 'Relaxation (this week)', 'health'),
  ('health_mindfulness_title', 'ru', 'Расслабление (за неделю)', 'health'),
  ('health_mindfulness_title', 'tr', 'Rahatlama (bu hafta)', 'health'),
  ('health_mindfulness_title', 'kk', 'Демалу (осы аптада)', 'health'),
  ('health_mindfulness_title', 'de', 'Entspannung (diese Woche)', 'health'),
  ('health_mindfulness_title', 'ar', 'الاسترخاء (هذا الأسبوع)', 'health'),

  ('health_mindfulness_desc', 'az', 'Apple Health / Health Connect-dəki mindfulness sessiyalarınız', 'health'),
  ('health_mindfulness_desc', 'en', 'Your mindfulness sessions from Apple Health / Health Connect', 'health'),
  ('health_mindfulness_desc', 'ru', 'Ваши сеансы осознанности из Apple Health / Health Connect', 'health'),
  ('health_mindfulness_desc', 'tr', 'Apple Health / Health Connect''teki farkındalık seanslarınız', 'health'),
  ('health_mindfulness_desc', 'kk', 'Apple Health / Health Connect-тегі зейін сессияларыңыз', 'health'),
  ('health_mindfulness_desc', 'de', 'Ihre Achtsamkeitssitzungen aus Apple Health / Health Connect', 'health'),
  ('health_mindfulness_desc', 'ar', 'جلسات اليقظة الذهنية الخاصة بك من Apple Health / Health Connect', 'health'),

  ('mh_health_mindfulness_bridge', 'az', 'Bu həftə Apple Health / Health Connect-də {min} dəqiqə rahatlama qeydə alınıb', 'health'),
  ('mh_health_mindfulness_bridge', 'en', 'This week, {min} minutes of relaxation were recorded in Apple Health / Health Connect', 'health'),
  ('mh_health_mindfulness_bridge', 'ru', 'На этой неделе в Apple Health / Health Connect зафиксировано {min} минут релаксации', 'health'),
  ('mh_health_mindfulness_bridge', 'tr', 'Bu hafta Apple Health / Health Connect''te {min} dakika rahatlama kaydedildi', 'health'),
  ('mh_health_mindfulness_bridge', 'kk', 'Осы аптада Apple Health / Health Connect-те {min} минут демалу тіркелді', 'health'),
  ('mh_health_mindfulness_bridge', 'de', 'Diese Woche wurden {min} Minuten Entspannung in Apple Health / Health Connect erfasst', 'health'),
  ('mh_health_mindfulness_bridge', 'ar', 'تم تسجيل {min} دقيقة من الاسترخاء في Apple Health / Health Connect هذا الأسبوع', 'health'),

  ('exercises_health_real_activity', 'az', 'Bu həftə real fəaliyyətiniz (Health-dən)', 'health'),
  ('exercises_health_real_activity', 'en', 'Your real activity this week (from Health)', 'health'),
  ('exercises_health_real_activity', 'ru', 'Ваша реальная активность за неделю (из Health)', 'health'),
  ('exercises_health_real_activity', 'tr', 'Bu haftaki gerçek aktiviteniz (Health''ten)', 'health'),
  ('exercises_health_real_activity', 'kk', 'Осы аптадағы нақты белсенділігіңіз (Health-тен)', 'health'),
  ('exercises_health_real_activity', 'de', 'Ihre tatsächliche Aktivität diese Woche (aus Health)', 'health'),
  ('exercises_health_real_activity', 'ar', 'نشاطك الفعلي هذا الأسبوع (من Health)', 'health'),

  ('mother_sleep_title', 'az', 'Mənim yuxum', 'health'),
  ('mother_sleep_title', 'en', 'My sleep', 'health'),
  ('mother_sleep_title', 'ru', 'Мой сон', 'health'),
  ('mother_sleep_title', 'tr', 'Uykum', 'health'),
  ('mother_sleep_title', 'kk', 'Менің ұйқым', 'health'),
  ('mother_sleep_title', 'de', 'Mein Schlaf', 'health'),
  ('mother_sleep_title', 'ar', 'نومي', 'health'),

  ('mother_sleep_week_avg', 'az', 'həftəlik ort.', 'health'),
  ('mother_sleep_week_avg', 'en', 'weekly avg.', 'health'),
  ('mother_sleep_week_avg', 'ru', 'средн. за нед.', 'health'),
  ('mother_sleep_week_avg', 'tr', 'haftalık ort.', 'health'),
  ('mother_sleep_week_avg', 'kk', 'апталық орт.', 'health'),
  ('mother_sleep_week_avg', 'de', 'Wochendurchschn.', 'health'),
  ('mother_sleep_week_avg', 'ar', 'متوسط أسبوعي', 'health'),

  ('health_hour_short', 'az', 'saat', 'health'),
  ('health_hour_short', 'en', 'hr', 'health'),
  ('health_hour_short', 'ru', 'ч', 'health'),
  ('health_hour_short', 'tr', 'sa', 'health'),
  ('health_hour_short', 'kk', 'сағ', 'health'),
  ('health_hour_short', 'de', 'Std', 'health'),
  ('health_hour_short', 'ar', 'سا', 'health'),

  ('mother_sleep_logged_tap_edit', 'az', 'Bu gün qeyd olundu · dəyişmək üçün toxunun', 'health'),
  ('mother_sleep_logged_tap_edit', 'en', 'Logged today · tap to edit', 'health'),
  ('mother_sleep_logged_tap_edit', 'ru', 'Отмечено сегодня · нажмите, чтобы изменить', 'health'),
  ('mother_sleep_logged_tap_edit', 'tr', 'Bugün kaydedildi · düzenlemek için dokunun', 'health'),
  ('mother_sleep_logged_tap_edit', 'kk', 'Бүгін тіркелді · өзгерту үшін түртіңіз', 'health'),
  ('mother_sleep_logged_tap_edit', 'de', 'Heute erfasst · zum Bearbeiten tippen', 'health'),
  ('mother_sleep_logged_tap_edit', 'ar', 'تم التسجيل اليوم · اضغط للتعديل', 'health'),

  ('mother_sleep_cta', 'az', 'Yuxunuzu qeyd edin', 'health'),
  ('mother_sleep_cta', 'en', 'Log your sleep', 'health'),
  ('mother_sleep_cta', 'ru', 'Отметьте свой сон', 'health'),
  ('mother_sleep_cta', 'tr', 'Uykunuzu kaydedin', 'health'),
  ('mother_sleep_cta', 'kk', 'Ұйқыңызды тіркеңіз', 'health'),
  ('mother_sleep_cta', 'de', 'Erfassen Sie Ihren Schlaf', 'health'),
  ('mother_sleep_cta', 'ar', 'سجّلي نومك', 'health'),

  ('mother_sleep_hint', 'az', 'Bugünkü yuxu müddəti və keyfiyyəti', 'health'),
  ('mother_sleep_hint', 'en', 'Today''s sleep duration and quality', 'health'),
  ('mother_sleep_hint', 'ru', 'Сегодняшняя продолжительность и качество сна', 'health'),
  ('mother_sleep_hint', 'tr', 'Bugünkü uyku süresi ve kalitesi', 'health'),
  ('mother_sleep_hint', 'kk', 'Бүгінгі ұйқы ұзақтығы мен сапасы', 'health'),
  ('mother_sleep_hint', 'de', 'Heutige Schlafdauer und -qualität', 'health'),
  ('mother_sleep_hint', 'ar', 'مدة وجودة نومك اليوم', 'health'),

  ('common_saxlanilir', 'az', 'Saxlanılır...', 'common'),
  ('common_saxlanilir', 'en', 'Saving...', 'common'),
  ('common_saxlanilir', 'ru', 'Сохранение...', 'common'),
  ('common_saxlanilir', 'tr', 'Kaydediliyor...', 'common'),
  ('common_saxlanilir', 'kk', 'Сақталуда...', 'common'),
  ('common_saxlanilir', 'de', 'Wird gespeichert...', 'common'),
  ('common_saxlanilir', 'ar', 'جارٍ الحفظ...', 'common')
ON CONFLICT (key, lang) DO UPDATE SET value = EXCLUDED.value;
