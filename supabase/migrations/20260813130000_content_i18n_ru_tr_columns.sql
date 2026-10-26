-- ============================================================
-- Content i18n: ru/tr sütunları (yalnız _en olan "boşluq" cədvəlləri)
-- Mövcud konvensiya: base(AZ) + _en → indi + _ru + _tr.
-- Klient tərəfi mapRowTranslation() (src/lib/tr.ts) bu sütunları avtomatik oxuyur.
-- Dəyərlər translate-content edge function ilə doldurulur (AZ → hədəf dil).
-- ============================================================

-- pregnancy_daily_content (280 günlük kontent, 12 text + 5 text[] sahə)
ALTER TABLE public.pregnancy_daily_content
  ADD COLUMN IF NOT EXISTS baby_development_ru text,
  ADD COLUMN IF NOT EXISTS baby_development_tr text,
  ADD COLUMN IF NOT EXISTS baby_message_ru text,
  ADD COLUMN IF NOT EXISTS baby_message_tr text,
  ADD COLUMN IF NOT EXISTS baby_size_fruit_ru text,
  ADD COLUMN IF NOT EXISTS baby_size_fruit_tr text,
  ADD COLUMN IF NOT EXISTS body_changes_ru text,
  ADD COLUMN IF NOT EXISTS body_changes_tr text,
  ADD COLUMN IF NOT EXISTS daily_tip_ru text,
  ADD COLUMN IF NOT EXISTS daily_tip_tr text,
  ADD COLUMN IF NOT EXISTS doctor_visit_tip_ru text,
  ADD COLUMN IF NOT EXISTS doctor_visit_tip_tr text,
  ADD COLUMN IF NOT EXISTS emotional_tip_ru text,
  ADD COLUMN IF NOT EXISTS emotional_tip_tr text,
  ADD COLUMN IF NOT EXISTS exercise_tip_ru text,
  ADD COLUMN IF NOT EXISTS exercise_tip_tr text,
  ADD COLUMN IF NOT EXISTS mother_tips_ru text,
  ADD COLUMN IF NOT EXISTS mother_tips_tr text,
  ADD COLUMN IF NOT EXISTS mother_warnings_ru text,
  ADD COLUMN IF NOT EXISTS mother_warnings_tr text,
  ADD COLUMN IF NOT EXISTS nutrition_tip_ru text,
  ADD COLUMN IF NOT EXISTS nutrition_tip_tr text,
  ADD COLUMN IF NOT EXISTS partner_tip_ru text,
  ADD COLUMN IF NOT EXISTS partner_tip_tr text,
  ADD COLUMN IF NOT EXISTS foods_to_avoid_ru text[],
  ADD COLUMN IF NOT EXISTS foods_to_avoid_tr text[],
  ADD COLUMN IF NOT EXISTS mother_symptoms_ru text[],
  ADD COLUMN IF NOT EXISTS mother_symptoms_tr text[],
  ADD COLUMN IF NOT EXISTS recommended_exercises_ru text[],
  ADD COLUMN IF NOT EXISTS recommended_exercises_tr text[],
  ADD COLUMN IF NOT EXISTS recommended_foods_ru text[],
  ADD COLUMN IF NOT EXISTS recommended_foods_tr text[],
  ADD COLUMN IF NOT EXISTS tests_to_do_ru text[],
  ADD COLUMN IF NOT EXISTS tests_to_do_tr text[];

-- weekly_tips (bump/mommy həftəlik tövsiyələr)
ALTER TABLE public.weekly_tips
  ADD COLUMN IF NOT EXISTS title_ru text,
  ADD COLUMN IF NOT EXISTS title_tr text,
  ADD COLUMN IF NOT EXISTS content_ru text,
  ADD COLUMN IF NOT EXISTS content_tr text,
  ADD COLUMN IF NOT EXISTS tips_ru jsonb,
  ADD COLUMN IF NOT EXISTS tips_tr jsonb;

-- baby_daily_info (1460 günlük körpə məlumatı)
ALTER TABLE public.baby_daily_info
  ADD COLUMN IF NOT EXISTS info_ru text,
  ADD COLUMN IF NOT EXISTS info_tr text;

-- mommy_daily_messages (analara günlük mesajlar)
ALTER TABLE public.mommy_daily_messages
  ADD COLUMN IF NOT EXISTS message_ru text,
  ADD COLUMN IF NOT EXISTS message_tr text;

-- admin_recipes (reseptlər)
ALTER TABLE public.admin_recipes
  ADD COLUMN IF NOT EXISTS title_ru text,
  ADD COLUMN IF NOT EXISTS title_tr text,
  ADD COLUMN IF NOT EXISTS description_ru text,
  ADD COLUMN IF NOT EXISTS description_tr text,
  ADD COLUMN IF NOT EXISTS category_ru text,
  ADD COLUMN IF NOT EXISTS category_tr text,
  ADD COLUMN IF NOT EXISTS tags_ru text[],
  ADD COLUMN IF NOT EXISTS tags_tr text[],
  ADD COLUMN IF NOT EXISTS ingredients_ru jsonb,
  ADD COLUMN IF NOT EXISTS ingredients_tr jsonb,
  ADD COLUMN IF NOT EXISTS instructions_ru jsonb,
  ADD COLUMN IF NOT EXISTS instructions_tr jsonb;

-- nutrition_tips
ALTER TABLE public.nutrition_tips
  ADD COLUMN IF NOT EXISTS title_ru text,
  ADD COLUMN IF NOT EXISTS title_tr text,
  ADD COLUMN IF NOT EXISTS content_ru text,
  ADD COLUMN IF NOT EXISTS content_tr text;

-- trimester_tips
ALTER TABLE public.trimester_tips
  ADD COLUMN IF NOT EXISTS tip_text_ru text,
  ADD COLUMN IF NOT EXISTS tip_text_tr text;

-- blog_categories
ALTER TABLE public.blog_categories
  ADD COLUMN IF NOT EXISTS name_ru text,
  ADD COLUMN IF NOT EXISTS name_tr text,
  ADD COLUMN IF NOT EXISTS description_ru text,
  ADD COLUMN IF NOT EXISTS description_tr text;

-- intro_slides (app intro slaydları)
ALTER TABLE public.intro_slides
  ADD COLUMN IF NOT EXISTS title_ru text,
  ADD COLUMN IF NOT EXISTS title_tr text,
  ADD COLUMN IF NOT EXISTS subtitle_ru text,
  ADD COLUMN IF NOT EXISTS subtitle_tr text,
  ADD COLUMN IF NOT EXISTS description_ru text,
  ADD COLUMN IF NOT EXISTS description_tr text;

-- products (mağaza)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS name_ru text,
  ADD COLUMN IF NOT EXISTS name_tr text,
  ADD COLUMN IF NOT EXISTS description_ru text,
  ADD COLUMN IF NOT EXISTS description_tr text,
  ADD COLUMN IF NOT EXISTS category_ru text,
  ADD COLUMN IF NOT EXISTS category_tr text;

-- cakes (tortlar — hazırda yalnız AZ-da aktivdir, gələcək üçün)
ALTER TABLE public.cakes
  ADD COLUMN IF NOT EXISTS name_ru text,
  ADD COLUMN IF NOT EXISTS name_tr text,
  ADD COLUMN IF NOT EXISTS description_ru text,
  ADD COLUMN IF NOT EXISTS description_tr text,
  ADD COLUMN IF NOT EXISTS milestone_label_ru text,
  ADD COLUMN IF NOT EXISTS milestone_label_tr text;

-- vitamins (name/description artıq 4 dildədir — qalan sahələr)
ALTER TABLE public.vitamins
  ADD COLUMN IF NOT EXISTS dosage_ru text,
  ADD COLUMN IF NOT EXISTS dosage_tr text,
  ADD COLUMN IF NOT EXISTS importance_ru text,
  ADD COLUMN IF NOT EXISTS importance_tr text,
  ADD COLUMN IF NOT EXISTS benefits_ru text[],
  ADD COLUMN IF NOT EXISTS benefits_tr text[],
  ADD COLUMN IF NOT EXISTS food_sources_ru text[],
  ADD COLUMN IF NOT EXISTS food_sources_tr text[];

-- exercises (name artıq 4 dildədir)
ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS description_ru text,
  ADD COLUMN IF NOT EXISTS description_tr text;

-- baby_names_db (meaning artıq 4 dildədir)
ALTER TABLE public.baby_names_db
  ADD COLUMN IF NOT EXISTS origin_ru text,
  ADD COLUMN IF NOT EXISTS origin_tr text;
