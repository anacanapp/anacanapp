-- ============================================================
-- Qazax1 — Qazax dili (kk) inteqrasiyası: SXEM
-- 1) app_languages: kk sətri (translations FK bundan asılıdır)
-- 2) Bütün kontent cədvəllərinə <sahə>_kk sütunları
-- 3) community_post_translations CHECK: kk əlavə olunur
-- İdempotentdir — təkrar icra təhlükəsizdir.
-- SIRALAMA: Qazax1 → Qazax2 (UI açarları) → Qazax3+ (kontent)
-- ============================================================

-- 1) Dil qeydiyyatı
INSERT INTO public.app_languages (code, name, native_name, is_active, sort_order)
VALUES ('kk', 'Kazakh', 'Қазақша', true, 5)
ON CONFLICT (code) DO UPDATE SET is_active = true, native_name = EXCLUDED.native_name;

-- 2) Kontent sütunları (_kk)
-- admin_recipes
ALTER TABLE public.admin_recipes ADD COLUMN IF NOT EXISTS title_kk TEXT;
ALTER TABLE public.admin_recipes ADD COLUMN IF NOT EXISTS description_kk TEXT;
ALTER TABLE public.admin_recipes ADD COLUMN IF NOT EXISTS category_kk TEXT;
ALTER TABLE public.admin_recipes ADD COLUMN IF NOT EXISTS tags_kk TEXT[];
ALTER TABLE public.admin_recipes ADD COLUMN IF NOT EXISTS ingredients_kk JSONB;
ALTER TABLE public.admin_recipes ADD COLUMN IF NOT EXISTS instructions_kk JSONB;

-- ai_suggested_questions
ALTER TABLE public.ai_suggested_questions ADD COLUMN IF NOT EXISTS question_kk TEXT;

-- baby_crisis_periods
ALTER TABLE public.baby_crisis_periods ADD COLUMN IF NOT EXISTS title_kk TEXT;
ALTER TABLE public.baby_crisis_periods ADD COLUMN IF NOT EXISTS description_kk TEXT;
ALTER TABLE public.baby_crisis_periods ADD COLUMN IF NOT EXISTS symptoms_kk TEXT;
ALTER TABLE public.baby_crisis_periods ADD COLUMN IF NOT EXISTS tips_kk TEXT;

-- baby_daily_info
ALTER TABLE public.baby_daily_info ADD COLUMN IF NOT EXISTS info_kk TEXT;

-- baby_milestones_db
ALTER TABLE public.baby_milestones_db ADD COLUMN IF NOT EXISTS label_kk TEXT;
ALTER TABLE public.baby_milestones_db ADD COLUMN IF NOT EXISTS description_kk TEXT;

-- baby_month_illustrations
ALTER TABLE public.baby_month_illustrations ADD COLUMN IF NOT EXISTS title_kk TEXT;
ALTER TABLE public.baby_month_illustrations ADD COLUMN IF NOT EXISTS description_kk TEXT;

-- baby_names_db
ALTER TABLE public.baby_names_db ADD COLUMN IF NOT EXISTS origin_kk TEXT;
ALTER TABLE public.baby_names_db ADD COLUMN IF NOT EXISTS meaning_kk TEXT;

-- baby_teeth_db
ALTER TABLE public.baby_teeth_db ADD COLUMN IF NOT EXISTS name_kk TEXT;
ALTER TABLE public.baby_teeth_db ADD COLUMN IF NOT EXISTS description_kk TEXT;

-- blog_categories
ALTER TABLE public.blog_categories ADD COLUMN IF NOT EXISTS name_kk TEXT;
ALTER TABLE public.blog_categories ADD COLUMN IF NOT EXISTS description_kk TEXT;

-- blog_posts
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS title_kk TEXT;
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS excerpt_kk TEXT;
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS content_kk TEXT;

-- breathing_exercises
ALTER TABLE public.breathing_exercises ADD COLUMN IF NOT EXISTS name_kk TEXT;
ALTER TABLE public.breathing_exercises ADD COLUMN IF NOT EXISTS description_kk TEXT;

-- cakes
ALTER TABLE public.cakes ADD COLUMN IF NOT EXISTS name_kk TEXT;
ALTER TABLE public.cakes ADD COLUMN IF NOT EXISTS description_kk TEXT;
ALTER TABLE public.cakes ADD COLUMN IF NOT EXISTS milestone_label_kk TEXT;

-- common_foods
ALTER TABLE public.common_foods ADD COLUMN IF NOT EXISTS name_kk TEXT;

-- default_shopping_items
ALTER TABLE public.default_shopping_items ADD COLUMN IF NOT EXISTS name_kk TEXT;

-- development_tips
ALTER TABLE public.development_tips ADD COLUMN IF NOT EXISTS title_kk TEXT;
ALTER TABLE public.development_tips ADD COLUMN IF NOT EXISTS content_kk TEXT;

-- epds_questions
ALTER TABLE public.epds_questions ADD COLUMN IF NOT EXISTS question_text_kk TEXT;

-- exercises
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS description_kk TEXT;

-- fairy_tale_themes
ALTER TABLE public.fairy_tale_themes ADD COLUMN IF NOT EXISTS name_kk TEXT;
ALTER TABLE public.fairy_tale_themes ADD COLUMN IF NOT EXISTS description_kk TEXT;

-- faqs
ALTER TABLE public.faqs ADD COLUMN IF NOT EXISTS question_kk TEXT;
ALTER TABLE public.faqs ADD COLUMN IF NOT EXISTS answer_kk TEXT;

-- first_aid_scenarios
ALTER TABLE public.first_aid_scenarios ADD COLUMN IF NOT EXISTS title_kk TEXT;
ALTER TABLE public.first_aid_scenarios ADD COLUMN IF NOT EXISTS description_kk TEXT;

-- first_aid_steps
ALTER TABLE public.first_aid_steps ADD COLUMN IF NOT EXISTS title_kk TEXT;
ALTER TABLE public.first_aid_steps ADD COLUMN IF NOT EXISTS instruction_kk TEXT;

-- flow_insights
ALTER TABLE public.flow_insights ADD COLUMN IF NOT EXISTS title_kk TEXT;
ALTER TABLE public.flow_insights ADD COLUMN IF NOT EXISTS content_kk TEXT;

-- flow_phase_tips
ALTER TABLE public.flow_phase_tips ADD COLUMN IF NOT EXISTS tip_text_kk TEXT;

-- flow_symptoms_db
ALTER TABLE public.flow_symptoms_db ADD COLUMN IF NOT EXISTS label_kk TEXT;

-- healthcare_providers
ALTER TABLE public.healthcare_providers ADD COLUMN IF NOT EXISTS name_kk TEXT;
ALTER TABLE public.healthcare_providers ADD COLUMN IF NOT EXISTS specialty_kk TEXT;
ALTER TABLE public.healthcare_providers ADD COLUMN IF NOT EXISTS description_kk TEXT;
ALTER TABLE public.healthcare_providers ADD COLUMN IF NOT EXISTS address_kk TEXT;

-- hospital_bag_templates
ALTER TABLE public.hospital_bag_templates ADD COLUMN IF NOT EXISTS item_name_kk TEXT;
ALTER TABLE public.hospital_bag_templates ADD COLUMN IF NOT EXISTS notes_kk TEXT;

-- intro_slides
ALTER TABLE public.intro_slides ADD COLUMN IF NOT EXISTS title_kk TEXT;
ALTER TABLE public.intro_slides ADD COLUMN IF NOT EXISTS subtitle_kk TEXT;
ALTER TABLE public.intro_slides ADD COLUMN IF NOT EXISTS description_kk TEXT;

-- legal_documents
ALTER TABLE public.legal_documents ADD COLUMN IF NOT EXISTS title_kk TEXT;
ALTER TABLE public.legal_documents ADD COLUMN IF NOT EXISTS content_kk TEXT;

-- maternity_guidelines
ALTER TABLE public.maternity_guidelines ADD COLUMN IF NOT EXISTS title_kk TEXT;
ALTER TABLE public.maternity_guidelines ADD COLUMN IF NOT EXISTS content_kk TEXT;

-- meal_types
ALTER TABLE public.meal_types ADD COLUMN IF NOT EXISTS name_kk TEXT;

-- mental_health_resources
ALTER TABLE public.mental_health_resources ADD COLUMN IF NOT EXISTS name_kk TEXT;
ALTER TABLE public.mental_health_resources ADD COLUMN IF NOT EXISTS description_kk TEXT;

-- mom_friendly_places
ALTER TABLE public.mom_friendly_places ADD COLUMN IF NOT EXISTS name_kk TEXT;
ALTER TABLE public.mom_friendly_places ADD COLUMN IF NOT EXISTS description_kk TEXT;
ALTER TABLE public.mom_friendly_places ADD COLUMN IF NOT EXISTS address_kk TEXT;

-- mommy_daily_messages
ALTER TABLE public.mommy_daily_messages ADD COLUMN IF NOT EXISTS message_kk TEXT;

-- mommy_day_notifications
ALTER TABLE public.mommy_day_notifications ADD COLUMN IF NOT EXISTS title_kk TEXT;
ALTER TABLE public.mommy_day_notifications ADD COLUMN IF NOT EXISTS body_kk TEXT;

-- mood_levels
ALTER TABLE public.mood_levels ADD COLUMN IF NOT EXISTS label_kk TEXT;

-- mood_options
ALTER TABLE public.mood_options ADD COLUMN IF NOT EXISTS label_kk TEXT;

-- multiples_options
ALTER TABLE public.multiples_options ADD COLUMN IF NOT EXISTS label_kk TEXT;

-- noise_thresholds
ALTER TABLE public.noise_thresholds ADD COLUMN IF NOT EXISTS label_kk TEXT;
ALTER TABLE public.noise_thresholds ADD COLUMN IF NOT EXISTS description_kk TEXT;

-- nutrition_targets
ALTER TABLE public.nutrition_targets ADD COLUMN IF NOT EXISTS description_kk TEXT;

-- nutrition_tips
ALTER TABLE public.nutrition_tips ADD COLUMN IF NOT EXISTS title_kk TEXT;
ALTER TABLE public.nutrition_tips ADD COLUMN IF NOT EXISTS content_kk TEXT;

-- onboarding_stages
ALTER TABLE public.onboarding_stages ADD COLUMN IF NOT EXISTS title_kk TEXT;
ALTER TABLE public.onboarding_stages ADD COLUMN IF NOT EXISTS subtitle_kk TEXT;
ALTER TABLE public.onboarding_stages ADD COLUMN IF NOT EXISTS description_kk TEXT;

-- partner_daily_tips
ALTER TABLE public.partner_daily_tips ADD COLUMN IF NOT EXISTS tip_text_kk TEXT;

-- partner_venue_categories
ALTER TABLE public.partner_venue_categories ADD COLUMN IF NOT EXISTS label_kk TEXT;

-- photoshoot_backgrounds
ALTER TABLE public.photoshoot_backgrounds ADD COLUMN IF NOT EXISTS category_name_kk TEXT;
ALTER TABLE public.photoshoot_backgrounds ADD COLUMN IF NOT EXISTS theme_name_kk TEXT;

-- photoshoot_eye_colors
ALTER TABLE public.photoshoot_eye_colors ADD COLUMN IF NOT EXISTS color_name_kk TEXT;

-- photoshoot_hair_colors
ALTER TABLE public.photoshoot_hair_colors ADD COLUMN IF NOT EXISTS color_name_kk TEXT;

-- photoshoot_hair_styles
ALTER TABLE public.photoshoot_hair_styles ADD COLUMN IF NOT EXISTS style_name_kk TEXT;

-- photoshoot_image_styles
ALTER TABLE public.photoshoot_image_styles ADD COLUMN IF NOT EXISTS style_name_kk TEXT;

-- photoshoot_outfits
ALTER TABLE public.photoshoot_outfits ADD COLUMN IF NOT EXISTS outfit_name_kk TEXT;

-- place_amenities
ALTER TABLE public.place_amenities ADD COLUMN IF NOT EXISTS label_kk TEXT;

-- place_categories
ALTER TABLE public.place_categories ADD COLUMN IF NOT EXISTS label_kk TEXT;

-- play_activities
ALTER TABLE public.play_activities ADD COLUMN IF NOT EXISTS title_kk TEXT;
ALTER TABLE public.play_activities ADD COLUMN IF NOT EXISTS description_kk TEXT;
ALTER TABLE public.play_activities ADD COLUMN IF NOT EXISTS instructions_kk TEXT;

-- play_inventory_items
ALTER TABLE public.play_inventory_items ADD COLUMN IF NOT EXISTS name_kk TEXT;

-- pregnancy_daily_content
ALTER TABLE public.pregnancy_daily_content ADD COLUMN IF NOT EXISTS baby_development_kk TEXT;
ALTER TABLE public.pregnancy_daily_content ADD COLUMN IF NOT EXISTS baby_message_kk TEXT;
ALTER TABLE public.pregnancy_daily_content ADD COLUMN IF NOT EXISTS baby_size_fruit_kk TEXT;
ALTER TABLE public.pregnancy_daily_content ADD COLUMN IF NOT EXISTS body_changes_kk TEXT;
ALTER TABLE public.pregnancy_daily_content ADD COLUMN IF NOT EXISTS daily_tip_kk TEXT;
ALTER TABLE public.pregnancy_daily_content ADD COLUMN IF NOT EXISTS doctor_visit_tip_kk TEXT;
ALTER TABLE public.pregnancy_daily_content ADD COLUMN IF NOT EXISTS emotional_tip_kk TEXT;
ALTER TABLE public.pregnancy_daily_content ADD COLUMN IF NOT EXISTS exercise_tip_kk TEXT;
ALTER TABLE public.pregnancy_daily_content ADD COLUMN IF NOT EXISTS mother_tips_kk TEXT;
ALTER TABLE public.pregnancy_daily_content ADD COLUMN IF NOT EXISTS mother_warnings_kk TEXT;
ALTER TABLE public.pregnancy_daily_content ADD COLUMN IF NOT EXISTS nutrition_tip_kk TEXT;
ALTER TABLE public.pregnancy_daily_content ADD COLUMN IF NOT EXISTS partner_tip_kk TEXT;
ALTER TABLE public.pregnancy_daily_content ADD COLUMN IF NOT EXISTS foods_to_avoid_kk TEXT[];
ALTER TABLE public.pregnancy_daily_content ADD COLUMN IF NOT EXISTS mother_symptoms_kk TEXT[];
ALTER TABLE public.pregnancy_daily_content ADD COLUMN IF NOT EXISTS recommended_exercises_kk TEXT[];
ALTER TABLE public.pregnancy_daily_content ADD COLUMN IF NOT EXISTS recommended_foods_kk TEXT[];
ALTER TABLE public.pregnancy_daily_content ADD COLUMN IF NOT EXISTS tests_to_do_kk TEXT[];

-- pregnancy_day_notifications
ALTER TABLE public.pregnancy_day_notifications ADD COLUMN IF NOT EXISTS title_kk TEXT;
ALTER TABLE public.pregnancy_day_notifications ADD COLUMN IF NOT EXISTS body_kk TEXT;

-- premium_features
ALTER TABLE public.premium_features ADD COLUMN IF NOT EXISTS title_kk TEXT;
ALTER TABLE public.premium_features ADD COLUMN IF NOT EXISTS description_kk TEXT;

-- premium_plans
ALTER TABLE public.premium_plans ADD COLUMN IF NOT EXISTS description_kk TEXT;
ALTER TABLE public.premium_plans ADD COLUMN IF NOT EXISTS name_kk TEXT;
ALTER TABLE public.premium_plans ADD COLUMN IF NOT EXISTS badge_text_kk TEXT;

-- products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS name_kk TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS description_kk TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category_kk TEXT;

-- recipe_categories
ALTER TABLE public.recipe_categories ADD COLUMN IF NOT EXISTS name_kk TEXT;

-- safety_categories
ALTER TABLE public.safety_categories ADD COLUMN IF NOT EXISTS name_kk TEXT;

-- safety_items
ALTER TABLE public.safety_items ADD COLUMN IF NOT EXISTS name_kk TEXT;
ALTER TABLE public.safety_items ADD COLUMN IF NOT EXISTS description_kk TEXT;

-- scheduled_notifications
ALTER TABLE public.scheduled_notifications ADD COLUMN IF NOT EXISTS title_kk TEXT;
ALTER TABLE public.scheduled_notifications ADD COLUMN IF NOT EXISTS body_kk TEXT;

-- shop_categories
ALTER TABLE public.shop_categories ADD COLUMN IF NOT EXISTS name_kk TEXT;

-- support_categories
ALTER TABLE public.support_categories ADD COLUMN IF NOT EXISTS name_kk TEXT;

-- surprise_ideas
ALTER TABLE public.surprise_ideas ADD COLUMN IF NOT EXISTS title_kk TEXT;
ALTER TABLE public.surprise_ideas ADD COLUMN IF NOT EXISTS description_kk TEXT;

-- symptoms
ALTER TABLE public.symptoms ADD COLUMN IF NOT EXISTS label_kk TEXT;

-- teething_care_tips
ALTER TABLE public.teething_care_tips ADD COLUMN IF NOT EXISTS title_kk TEXT;
ALTER TABLE public.teething_care_tips ADD COLUMN IF NOT EXISTS content_kk TEXT;

-- teething_symptoms
ALTER TABLE public.teething_symptoms ADD COLUMN IF NOT EXISTS name_kk TEXT;
ALTER TABLE public.teething_symptoms ADD COLUMN IF NOT EXISTS description_kk TEXT;
ALTER TABLE public.teething_symptoms ADD COLUMN IF NOT EXISTS relief_tips_kk TEXT;

-- tool_configs
ALTER TABLE public.tool_configs ADD COLUMN IF NOT EXISTS name_kk TEXT;
ALTER TABLE public.tool_configs ADD COLUMN IF NOT EXISTS description_kk TEXT;
ALTER TABLE public.tool_configs ADD COLUMN IF NOT EXISTS partner_name_kk TEXT;
ALTER TABLE public.tool_configs ADD COLUMN IF NOT EXISTS partner_description_kk TEXT;

-- trimester_tips
ALTER TABLE public.trimester_tips ADD COLUMN IF NOT EXISTS tip_text_kk TEXT;

-- vaccine_countries
ALTER TABLE public.vaccine_countries ADD COLUMN IF NOT EXISTS name_kk TEXT;

-- vaccine_schedules
ALTER TABLE public.vaccine_schedules ADD COLUMN IF NOT EXISTS dose_label_kk TEXT;
ALTER TABLE public.vaccine_schedules ADD COLUMN IF NOT EXISTS age_label_kk TEXT;
ALTER TABLE public.vaccine_schedules ADD COLUMN IF NOT EXISTS notes_kk TEXT;

-- vaccines
ALTER TABLE public.vaccines ADD COLUMN IF NOT EXISTS name_kk TEXT;
ALTER TABLE public.vaccines ADD COLUMN IF NOT EXISTS short_description_kk TEXT;
ALTER TABLE public.vaccines ADD COLUMN IF NOT EXISTS full_description_kk TEXT;
ALTER TABLE public.vaccines ADD COLUMN IF NOT EXISTS disease_kk TEXT;
ALTER TABLE public.vaccines ADD COLUMN IF NOT EXISTS route_kk TEXT;
ALTER TABLE public.vaccines ADD COLUMN IF NOT EXISTS side_effects_kk TEXT;
ALTER TABLE public.vaccines ADD COLUMN IF NOT EXISTS contraindications_kk TEXT;

-- vitamins
ALTER TABLE public.vitamins ADD COLUMN IF NOT EXISTS dosage_kk TEXT;
ALTER TABLE public.vitamins ADD COLUMN IF NOT EXISTS name_kk TEXT;
ALTER TABLE public.vitamins ADD COLUMN IF NOT EXISTS description_kk TEXT;
ALTER TABLE public.vitamins ADD COLUMN IF NOT EXISTS benefits_kk TEXT[];
ALTER TABLE public.vitamins ADD COLUMN IF NOT EXISTS food_sources_kk TEXT[];

-- weekly_tips
ALTER TABLE public.weekly_tips ADD COLUMN IF NOT EXISTS title_kk TEXT;
ALTER TABLE public.weekly_tips ADD COLUMN IF NOT EXISTS content_kk TEXT;
ALTER TABLE public.weekly_tips ADD COLUMN IF NOT EXISTS tips_kk JSONB;

-- weight_recommendations
ALTER TABLE public.weight_recommendations ADD COLUMN IF NOT EXISTS description_kk TEXT;

-- white_noise_sounds
ALTER TABLE public.white_noise_sounds ADD COLUMN IF NOT EXISTS name_kk TEXT;
ALTER TABLE public.white_noise_sounds ADD COLUMN IF NOT EXISTS description_kk TEXT;

-- zodiac_signs
ALTER TABLE public.zodiac_signs ADD COLUMN IF NOT EXISTS name_kk TEXT;
ALTER TABLE public.zodiac_signs ADD COLUMN IF NOT EXISTS characteristics_kk TEXT;

-- 3) Cəmiyyət tərcümə keşi: kk icazəsi (Son27 hələ tətbiq olunmayıbsa ötürülür)
DO $$
BEGIN
  IF to_regclass('public.community_post_translations') IS NOT NULL THEN
    ALTER TABLE public.community_post_translations DROP CONSTRAINT IF EXISTS community_post_translations_lang_check;
    ALTER TABLE public.community_post_translations ADD CONSTRAINT community_post_translations_lang_check CHECK (lang IN ('az','en','ru','tr','kk'));
  END IF;
END $$;
