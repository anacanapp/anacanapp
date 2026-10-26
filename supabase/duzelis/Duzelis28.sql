-- Duzelis28: Əkiz/çoxdöllü hamiləlik üçün mətn adaptasiyası (yüksək-görünərlik
-- səthləri) — Dashboard hero başlığı, KickCounter mesajı, Partner həftəlik
-- kartı, Dr. Anacan AI qarşılama mesajı. 19 yeni açar (4 açar × 7 dil +
-- 1 açar × 6 dil, EN AIChatScreen.tsx-də ayrıca hardcode budaqda idarə olunur).
-- Idempotent — safe to re-run.

INSERT INTO public.translations (key, lang, value, namespace) VALUES
  ('dashboard_hero_fruit_tpl_multiple', 'az', 'Körpələriniz təxminən {fruit} boydadır', 'common'),
  ('dashboard_hero_fruit_tpl_multiple', 'en', 'Your babies are about {fruit}-sized', 'common'),
  ('dashboard_hero_fruit_tpl_multiple', 'ru', 'Ваши малыши сейчас размером примерно с {fruit}', 'common'),
  ('dashboard_hero_fruit_tpl_multiple', 'tr', 'Bebekleriniz yaklaşık {fruit} büyüklüğünde', 'common'),
  ('dashboard_hero_fruit_tpl_multiple', 'kk', 'Сәбилеріңіз шамамен {fruit} мөлшерінде', 'common'),
  ('dashboard_hero_fruit_tpl_multiple', 'de', 'Ihre Babys sind etwa so groß wie {fruit}', 'common'),
  ('dashboard_hero_fruit_tpl_multiple', 'ar', 'أطفالك بحجم {fruit} تقريباً', 'common'),
  ('kickcounter_ela_gedir_korpeleriniz_aktivdir', 'az', 'Əla gedir! Körpələriniz aktivdir 💪', 'common'),
  ('kickcounter_ela_gedir_korpeleriniz_aktivdir', 'en', 'Going great! Your babies are active 💪', 'common'),
  ('kickcounter_ela_gedir_korpeleriniz_aktivdir', 'ru', 'Отлично! Ваши малыши активны 💪', 'common'),
  ('kickcounter_ela_gedir_korpeleriniz_aktivdir', 'tr', 'Harika gidiyor! Bebekleriniz aktif 💪', 'common'),
  ('kickcounter_ela_gedir_korpeleriniz_aktivdir', 'kk', 'Керемет! Сәбилеріңіз белсенді 💪', 'common'),
  ('kickcounter_ela_gedir_korpeleriniz_aktivdir', 'de', 'Läuft super! Ihre Babys sind aktiv 💪', 'common'),
  ('kickcounter_ela_gedir_korpeleriniz_aktivdir', 'ar', 'ممتاز! أطفالك نشيطون 💪', 'common'),
  ('partnerv2_hefte_korpeleriniz', 'az', 'həftə — körpələriniz', 'common'),
  ('partnerv2_hefte_korpeleriniz', 'en', 'week — your babies', 'common'),
  ('partnerv2_hefte_korpeleriniz', 'ru', 'неделя — ваши малыши', 'common'),
  ('partnerv2_hefte_korpeleriniz', 'tr', 'hafta — bebekleriniz', 'common'),
  ('partnerv2_hefte_korpeleriniz', 'kk', 'апта — сәбилеріңіз', 'common'),
  ('partnerv2_hefte_korpeleriniz', 'de', 'Woche — Ihre Babys', 'common'),
  ('partnerv2_hefte_korpeleriniz', 'ar', 'أسبوع — أطفالك', 'common'),
  ('partnerv2_her_korpe_texminen', 'az', 'Hər körpə təxminən', 'common'),
  ('partnerv2_her_korpe_texminen', 'en', 'Each baby is about', 'common'),
  ('partnerv2_her_korpe_texminen', 'ru', 'Каждый малыш примерно', 'common'),
  ('partnerv2_her_korpe_texminen', 'tr', 'Her bebek yaklaşık', 'common'),
  ('partnerv2_her_korpe_texminen', 'kk', 'Әр сәби шамамен', 'common'),
  ('partnerv2_her_korpe_texminen', 'de', 'Jedes Baby ist etwa', 'common'),
  ('partnerv2_her_korpe_texminen', 'ar', 'كل طفل بحجم', 'common'),
  ('aichat_welcome_bump_3_multiple', 'az', 'Hazırda hamiləliyin {0}-ci həftəsindəsiniz; körpələriniz təxminən {1} böyüklüyündədir. ', 'common'),
  ('aichat_welcome_bump_3_multiple', 'ru', 'Сейчас у вас {0}-я неделя беременности; ваши малыши сейчас примерно размером с {1}. ', 'common'),
  ('aichat_welcome_bump_3_multiple', 'tr', 'Şu anda hamileliğinizin {0}. haftasındasınız; bebekleriniz yaklaşık {1} büyüklüğünde. ', 'common'),
  ('aichat_welcome_bump_3_multiple', 'kk', 'Қазір сіз жүктіліктің {0}-аптасындасыз; сәбилеріңіз шамамен {1} мөлшерінде. ', 'common'),
  ('aichat_welcome_bump_3_multiple', 'de', 'Sie sind aktuell in der {0}. Schwangerschaftswoche; Ihre Babys sind etwa so groß wie {1}. ', 'common'),
  ('aichat_welcome_bump_3_multiple', 'ar', 'أنتِ حالياً في الأسبوع {0} من الحمل؛ أطفالك بحجم {1} تقريباً. ', 'common')
ON CONFLICT (key, lang) DO UPDATE SET value = EXCLUDED.value;
