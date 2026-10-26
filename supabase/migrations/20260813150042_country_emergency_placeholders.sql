-- ============================================================
-- Son24: 1) healthcare_providers ölkə sütunu (+AZ backfill)
--        2) yeni açarlar (təcili nömrə {n}, placeholder-lər)
--        3) mövcud açar düzəlişləri (Kadınlar için makaleler, Kafa cm, ad nümunələri)
-- ============================================================

ALTER TABLE public.healthcare_providers
  ADD COLUMN IF NOT EXISTS country_code text NOT NULL DEFAULT 'AZ';

UPDATE public.healthcare_providers SET country_code = 'AZ' WHERE country_code IS NULL;

-- Yeni açarlar (idempotent)
INSERT INTO public.translations (key, lang, value, namespace) VALUES
  ('aichat_input_ph', 'ru', 'Напишите свой вопрос Anacan.AI...', 'common'),
  ('aichat_input_ph', 'tr', 'Anacan.AI’ye sorunuzu yazın...', 'common'),
  ('aichat_input_ph', 'en', 'Type your question for Anacan.AI...', 'common'),
  ('nutrition_food_ph', 'ru', 'напр. Борщ', 'common'),
  ('nutrition_food_ph', 'tr', 'örn. Menemen', 'common'),
  ('nutrition_food_ph', 'en', 'e.g. Salad', 'common'),
  ('ft_child_name_ph', 'ru', 'Например: Алина, Артём...', 'common'),
  ('ft_child_name_ph', 'tr', 'Örneğin: Elif, Emir...', 'common'),
  ('ft_child_name_ph', 'en', 'For example: Emma, Liam...', 'common'),
  ('ft_child_names_ph', 'ru', 'Например: Алина, Артём, София...', 'common'),
  ('ft_child_names_ph', 'tr', 'Örneğin: Elif, Emir, Zeynep...', 'common'),
  ('ft_child_names_ph', 'en', 'For example: Emma, Liam, Olivia...', 'common'),
  ('mc_example_prefix', 'ru', 'Например', 'common'),
  ('mc_example_prefix', 'tr', 'Örnek', 'common'),
  ('mc_example_prefix', 'en', 'e.g.', 'common'),
  ('rf_urgent_guidance_n', 'ru', '⚠️ Не ждите: немедленно позвоните врачу или в скорую помощь ({n}).', 'common'),
  ('rf_urgent_guidance_n', 'tr', '⚠️ Beklemeyin: hemen doktorunuzu arayın veya acil yardımı ({n}) arayın.', 'common'),
  ('rf_urgent_guidance_n', 'en', '⚠️ Don''t wait: call your doctor immediately or contact emergency services ({n}).', 'common')
ON CONFLICT (key, lang) DO NOTHING;

-- Düzəlişlər (mövcud dəyərlərin ÜSTÜNƏ yazılır)
INSERT INTO public.translations (key, lang, value, namespace) VALUES
  ('blogscreen_ana_bloqu_28124b', 'tr', 'Kadınlar için makaleler', 'common'),
  ('babygrowthtracker_bas_sm_927b99', 'tr', 'Kafa (cm)', 'common'),
  ('ponb_mommy_name_ph', 'ru', 'напр. Алина', 'common'),
  ('ponb_mommy_name_ph', 'tr', 'örn. Elif', 'common'),
  ('ponb_mommy_name_ph', 'en', 'e.g. Emma', 'common')
ON CONFLICT (key, lang) DO UPDATE SET value = EXCLUDED.value;
