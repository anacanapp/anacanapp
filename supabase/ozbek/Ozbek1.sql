-- ============================================================
-- Ozbek1 — Özbək dili (uz) inteqrasiyası: SXEM
-- 1) app_languages: uz sətri (translations FK bundan asılıdır)
-- 2) Bütün kontent cədvəllərinə <sahə>_uz sütunları (Qazax1 ilə eyni dəst)
-- 3) community_post_translations CHECK: uz əlavə olunur
-- İdempotentdir — təkrar icra təhlükəsizdir.
-- SIRALAMA: Ozbek1 (sxem) → seed-translations (UI açarları, uz.seed.json) → kontent (azure-translate.cjs uz)
-- ============================================================

-- 1) Dil qeydiyyatı
INSERT INTO public.app_languages (code, name, native_name, is_active, sort_order)
VALUES ('uz', 'Uzbek', 'O''zbekcha', true, 8)
ON CONFLICT (code) DO UPDATE SET is_active = true, native_name = EXCLUDED.native_name;

-- 2) Kontent sütunları (_uz)
-- admin_recipes
ALTER TABLE public.admin_recipes ADD COLUMN IF NOT EXISTS title_uz TEXT;
ALTER TABLE public.admin_recipes ADD COLUMN IF NOT EXISTS description_uz TEXT;
ALTER TABLE public.admin_recipes ADD COLUMN IF NOT EXISTS category_uz TEXT;
ALTER TABLE public.admin_recipes ADD COLUMN IF NOT EXISTS tags_uz TEXT[];
ALTER TABLE public.admin_recipes ADD COLUMN IF NOT EXISTS ingredients_uz JSONB;
ALTER TABLE public.admin_recipes ADD COLUMN IF NOT EXISTS instructions_uz JSONB;

-- ai_suggested_questions
ALTER TABLE public.ai_suggested_questions ADD COLUMN IF NOT EXISTS question_uz TEXT;

-- baby_crisis_periods
ALTER TABLE public.baby_crisis_periods ADD COLUMN IF NOT EXISTS title_uz TEXT;
ALTER TABLE public.baby_crisis_periods ADD COLUMN IF NOT EXISTS description_uz TEXT;
ALTER TABLE public.baby_crisis_periods ADD COLUMN IF NOT EXISTS symptoms_uz TEXT;
ALTER TABLE public.baby_crisis_periods ADD COLUMN IF NOT EXISTS tips_uz TEXT;

-- baby_daily_info
ALTER TABLE public.baby_daily_info ADD COLUMN IF NOT EXISTS info_uz TEXT;

-- baby_milestones_db
ALTER TABLE public.baby_milestones_db ADD COLUMN IF NOT EXISTS label_uz TEXT;
ALTER TABLE public.baby_milestones_db ADD COLUMN IF NOT EXISTS description_uz TEXT;

-- baby_month_illustrations
ALTER TABLE public.baby_month_illustrations ADD COLUMN IF NOT EXISTS title_uz TEXT;
ALTER TABLE public.baby_month_illustrations ADD COLUMN IF NOT EXISTS description_uz TEXT;

-- baby_names_db
ALTER TABLE public.baby_names_db ADD COLUMN IF NOT EXISTS origin_uz TEXT;
ALTER TABLE public.baby_names_db ADD COLUMN IF NOT EXISTS meaning_uz TEXT;

-- baby_teeth_db
ALTER TABLE public.baby_teeth_db ADD COLUMN IF NOT EXISTS name_uz TEXT;
ALTER TABLE public.baby_teeth_db ADD COLUMN IF NOT EXISTS description_uz TEXT;

-- blog_categories
ALTER TABLE public.blog_categories ADD COLUMN IF NOT EXISTS name_uz TEXT;
ALTER TABLE public.blog_categories ADD COLUMN IF NOT EXISTS description_uz TEXT;

-- blog_posts
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS title_uz TEXT;
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS excerpt_uz TEXT;
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS content_uz TEXT;

-- breathing_exercises
ALTER TABLE public.breathing_exercises ADD COLUMN IF NOT EXISTS name_uz TEXT;
ALTER TABLE public.breathing_exercises ADD COLUMN IF NOT EXISTS description_uz TEXT;

-- cakes
ALTER TABLE public.cakes ADD COLUMN IF NOT EXISTS name_uz TEXT;
ALTER TABLE public.cakes ADD COLUMN IF NOT EXISTS description_uz TEXT;
ALTER TABLE public.cakes ADD COLUMN IF NOT EXISTS milestone_label_uz TEXT;

-- common_foods
ALTER TABLE public.common_foods ADD COLUMN IF NOT EXISTS name_uz TEXT;

-- default_shopping_items
ALTER TABLE public.default_shopping_items ADD COLUMN IF NOT EXISTS name_uz TEXT;

-- development_tips
ALTER TABLE public.development_tips ADD COLUMN IF NOT EXISTS title_uz TEXT;
ALTER TABLE public.development_tips ADD COLUMN IF NOT EXISTS content_uz TEXT;

-- epds_questions
ALTER TABLE public.epds_questions ADD COLUMN IF NOT EXISTS question_text_uz TEXT;

-- exercises
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS description_uz TEXT;

-- fairy_tale_themes
ALTER TABLE public.fairy_tale_themes ADD COLUMN IF NOT EXISTS name_uz TEXT;
ALTER TABLE public.fairy_tale_themes ADD COLUMN IF NOT EXISTS description_uz TEXT;

-- faqs
ALTER TABLE public.faqs ADD COLUMN IF NOT EXISTS question_uz TEXT;
ALTER TABLE public.faqs ADD COLUMN IF NOT EXISTS answer_uz TEXT;

-- first_aid_scenarios
ALTER TABLE public.first_aid_scenarios ADD COLUMN IF NOT EXISTS title_uz TEXT;
ALTER TABLE public.first_aid_scenarios ADD COLUMN IF NOT EXISTS description_uz TEXT;

-- first_aid_steps
ALTER TABLE public.first_aid_steps ADD COLUMN IF NOT EXISTS title_uz TEXT;
ALTER TABLE public.first_aid_steps ADD COLUMN IF NOT EXISTS instruction_uz TEXT;

-- flow_insights
ALTER TABLE public.flow_insights ADD COLUMN IF NOT EXISTS title_uz TEXT;
ALTER TABLE public.flow_insights ADD COLUMN IF NOT EXISTS content_uz TEXT;

-- flow_phase_tips
ALTER TABLE public.flow_phase_tips ADD COLUMN IF NOT EXISTS tip_text_uz TEXT;

-- flow_symptoms_db
ALTER TABLE public.flow_symptoms_db ADD COLUMN IF NOT EXISTS label_uz TEXT;

-- healthcare_providers
ALTER TABLE public.healthcare_providers ADD COLUMN IF NOT EXISTS name_uz TEXT;
ALTER TABLE public.healthcare_providers ADD COLUMN IF NOT EXISTS specialty_uz TEXT;
ALTER TABLE public.healthcare_providers ADD COLUMN IF NOT EXISTS description_uz TEXT;
ALTER TABLE public.healthcare_providers ADD COLUMN IF NOT EXISTS address_uz TEXT;

-- hospital_bag_templates
ALTER TABLE public.hospital_bag_templates ADD COLUMN IF NOT EXISTS item_name_uz TEXT;
ALTER TABLE public.hospital_bag_templates ADD COLUMN IF NOT EXISTS notes_uz TEXT;

-- intro_slides
ALTER TABLE public.intro_slides ADD COLUMN IF NOT EXISTS title_uz TEXT;
ALTER TABLE public.intro_slides ADD COLUMN IF NOT EXISTS subtitle_uz TEXT;
ALTER TABLE public.intro_slides ADD COLUMN IF NOT EXISTS description_uz TEXT;

-- legal_documents
ALTER TABLE public.legal_documents ADD COLUMN IF NOT EXISTS title_uz TEXT;
ALTER TABLE public.legal_documents ADD COLUMN IF NOT EXISTS content_uz TEXT;

-- maternity_guidelines
ALTER TABLE public.maternity_guidelines ADD COLUMN IF NOT EXISTS title_uz TEXT;
ALTER TABLE public.maternity_guidelines ADD COLUMN IF NOT EXISTS content_uz TEXT;

-- meal_types
ALTER TABLE public.meal_types ADD COLUMN IF NOT EXISTS name_uz TEXT;

-- mental_health_resources
ALTER TABLE public.mental_health_resources ADD COLUMN IF NOT EXISTS name_uz TEXT;
ALTER TABLE public.mental_health_resources ADD COLUMN IF NOT EXISTS description_uz TEXT;

-- mom_friendly_places
ALTER TABLE public.mom_friendly_places ADD COLUMN IF NOT EXISTS name_uz TEXT;
ALTER TABLE public.mom_friendly_places ADD COLUMN IF NOT EXISTS description_uz TEXT;
ALTER TABLE public.mom_friendly_places ADD COLUMN IF NOT EXISTS address_uz TEXT;

-- mommy_daily_messages
ALTER TABLE public.mommy_daily_messages ADD COLUMN IF NOT EXISTS message_uz TEXT;

-- mommy_day_notifications
ALTER TABLE public.mommy_day_notifications ADD COLUMN IF NOT EXISTS title_uz TEXT;
ALTER TABLE public.mommy_day_notifications ADD COLUMN IF NOT EXISTS body_uz TEXT;

-- mood_levels
ALTER TABLE public.mood_levels ADD COLUMN IF NOT EXISTS label_uz TEXT;

-- mood_options
ALTER TABLE public.mood_options ADD COLUMN IF NOT EXISTS label_uz TEXT;

-- multiples_options
ALTER TABLE public.multiples_options ADD COLUMN IF NOT EXISTS label_uz TEXT;

-- noise_thresholds
ALTER TABLE public.noise_thresholds ADD COLUMN IF NOT EXISTS label_uz TEXT;
ALTER TABLE public.noise_thresholds ADD COLUMN IF NOT EXISTS description_uz TEXT;

-- nutrition_targets
ALTER TABLE public.nutrition_targets ADD COLUMN IF NOT EXISTS description_uz TEXT;

-- nutrition_tips
ALTER TABLE public.nutrition_tips ADD COLUMN IF NOT EXISTS title_uz TEXT;
ALTER TABLE public.nutrition_tips ADD COLUMN IF NOT EXISTS content_uz TEXT;

-- onboarding_stages
ALTER TABLE public.onboarding_stages ADD COLUMN IF NOT EXISTS title_uz TEXT;
ALTER TABLE public.onboarding_stages ADD COLUMN IF NOT EXISTS subtitle_uz TEXT;
ALTER TABLE public.onboarding_stages ADD COLUMN IF NOT EXISTS description_uz TEXT;

-- partner_daily_tips
ALTER TABLE public.partner_daily_tips ADD COLUMN IF NOT EXISTS tip_text_uz TEXT;

-- partner_venue_categories
ALTER TABLE public.partner_venue_categories ADD COLUMN IF NOT EXISTS label_uz TEXT;

-- photoshoot_backgrounds
ALTER TABLE public.photoshoot_backgrounds ADD COLUMN IF NOT EXISTS category_name_uz TEXT;
ALTER TABLE public.photoshoot_backgrounds ADD COLUMN IF NOT EXISTS theme_name_uz TEXT;

-- photoshoot_eye_colors
ALTER TABLE public.photoshoot_eye_colors ADD COLUMN IF NOT EXISTS color_name_uz TEXT;

-- photoshoot_hair_colors
ALTER TABLE public.photoshoot_hair_colors ADD COLUMN IF NOT EXISTS color_name_uz TEXT;

-- photoshoot_hair_styles
ALTER TABLE public.photoshoot_hair_styles ADD COLUMN IF NOT EXISTS style_name_uz TEXT;

-- photoshoot_image_styles
ALTER TABLE public.photoshoot_image_styles ADD COLUMN IF NOT EXISTS style_name_uz TEXT;

-- photoshoot_outfits
ALTER TABLE public.photoshoot_outfits ADD COLUMN IF NOT EXISTS outfit_name_uz TEXT;

-- place_amenities
ALTER TABLE public.place_amenities ADD COLUMN IF NOT EXISTS label_uz TEXT;

-- place_categories
ALTER TABLE public.place_categories ADD COLUMN IF NOT EXISTS label_uz TEXT;

-- play_activities
ALTER TABLE public.play_activities ADD COLUMN IF NOT EXISTS title_uz TEXT;
ALTER TABLE public.play_activities ADD COLUMN IF NOT EXISTS description_uz TEXT;
ALTER TABLE public.play_activities ADD COLUMN IF NOT EXISTS instructions_uz TEXT;

-- play_inventory_items
ALTER TABLE public.play_inventory_items ADD COLUMN IF NOT EXISTS name_uz TEXT;

-- pregnancy_daily_content
ALTER TABLE public.pregnancy_daily_content ADD COLUMN IF NOT EXISTS baby_development_uz TEXT;
ALTER TABLE public.pregnancy_daily_content ADD COLUMN IF NOT EXISTS baby_message_uz TEXT;
ALTER TABLE public.pregnancy_daily_content ADD COLUMN IF NOT EXISTS baby_size_fruit_uz TEXT;
ALTER TABLE public.pregnancy_daily_content ADD COLUMN IF NOT EXISTS body_changes_uz TEXT;
ALTER TABLE public.pregnancy_daily_content ADD COLUMN IF NOT EXISTS daily_tip_uz TEXT;
ALTER TABLE public.pregnancy_daily_content ADD COLUMN IF NOT EXISTS doctor_visit_tip_uz TEXT;
ALTER TABLE public.pregnancy_daily_content ADD COLUMN IF NOT EXISTS emotional_tip_uz TEXT;
ALTER TABLE public.pregnancy_daily_content ADD COLUMN IF NOT EXISTS exercise_tip_uz TEXT;
ALTER TABLE public.pregnancy_daily_content ADD COLUMN IF NOT EXISTS mother_tips_uz TEXT;
ALTER TABLE public.pregnancy_daily_content ADD COLUMN IF NOT EXISTS mother_warnings_uz TEXT;
ALTER TABLE public.pregnancy_daily_content ADD COLUMN IF NOT EXISTS nutrition_tip_uz TEXT;
ALTER TABLE public.pregnancy_daily_content ADD COLUMN IF NOT EXISTS partner_tip_uz TEXT;
ALTER TABLE public.pregnancy_daily_content ADD COLUMN IF NOT EXISTS foods_to_avoid_uz TEXT[];
ALTER TABLE public.pregnancy_daily_content ADD COLUMN IF NOT EXISTS mother_symptoms_uz TEXT[];
ALTER TABLE public.pregnancy_daily_content ADD COLUMN IF NOT EXISTS recommended_exercises_uz TEXT[];
ALTER TABLE public.pregnancy_daily_content ADD COLUMN IF NOT EXISTS recommended_foods_uz TEXT[];
ALTER TABLE public.pregnancy_daily_content ADD COLUMN IF NOT EXISTS tests_to_do_uz TEXT[];

-- pregnancy_day_notifications
ALTER TABLE public.pregnancy_day_notifications ADD COLUMN IF NOT EXISTS title_uz TEXT;
ALTER TABLE public.pregnancy_day_notifications ADD COLUMN IF NOT EXISTS body_uz TEXT;

-- premium_features
ALTER TABLE public.premium_features ADD COLUMN IF NOT EXISTS title_uz TEXT;
ALTER TABLE public.premium_features ADD COLUMN IF NOT EXISTS description_uz TEXT;

-- premium_plans
ALTER TABLE public.premium_plans ADD COLUMN IF NOT EXISTS description_uz TEXT;
ALTER TABLE public.premium_plans ADD COLUMN IF NOT EXISTS name_uz TEXT;
ALTER TABLE public.premium_plans ADD COLUMN IF NOT EXISTS badge_text_uz TEXT;

-- products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS name_uz TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS description_uz TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category_uz TEXT;

-- recipe_categories
ALTER TABLE public.recipe_categories ADD COLUMN IF NOT EXISTS name_uz TEXT;

-- safety_categories
ALTER TABLE public.safety_categories ADD COLUMN IF NOT EXISTS name_uz TEXT;

-- safety_items
ALTER TABLE public.safety_items ADD COLUMN IF NOT EXISTS name_uz TEXT;
ALTER TABLE public.safety_items ADD COLUMN IF NOT EXISTS description_uz TEXT;

-- scheduled_notifications
ALTER TABLE public.scheduled_notifications ADD COLUMN IF NOT EXISTS title_uz TEXT;
ALTER TABLE public.scheduled_notifications ADD COLUMN IF NOT EXISTS body_uz TEXT;

-- shop_categories
ALTER TABLE public.shop_categories ADD COLUMN IF NOT EXISTS name_uz TEXT;

-- support_categories
ALTER TABLE public.support_categories ADD COLUMN IF NOT EXISTS name_uz TEXT;

-- surprise_ideas
ALTER TABLE public.surprise_ideas ADD COLUMN IF NOT EXISTS title_uz TEXT;
ALTER TABLE public.surprise_ideas ADD COLUMN IF NOT EXISTS description_uz TEXT;

-- symptoms
ALTER TABLE public.symptoms ADD COLUMN IF NOT EXISTS label_uz TEXT;

-- teething_care_tips
ALTER TABLE public.teething_care_tips ADD COLUMN IF NOT EXISTS title_uz TEXT;
ALTER TABLE public.teething_care_tips ADD COLUMN IF NOT EXISTS content_uz TEXT;

-- teething_symptoms
ALTER TABLE public.teething_symptoms ADD COLUMN IF NOT EXISTS name_uz TEXT;
ALTER TABLE public.teething_symptoms ADD COLUMN IF NOT EXISTS description_uz TEXT;
ALTER TABLE public.teething_symptoms ADD COLUMN IF NOT EXISTS relief_tips_uz TEXT;

-- tool_configs
ALTER TABLE public.tool_configs ADD COLUMN IF NOT EXISTS name_uz TEXT;
ALTER TABLE public.tool_configs ADD COLUMN IF NOT EXISTS description_uz TEXT;
ALTER TABLE public.tool_configs ADD COLUMN IF NOT EXISTS partner_name_uz TEXT;
ALTER TABLE public.tool_configs ADD COLUMN IF NOT EXISTS partner_description_uz TEXT;

-- trimester_tips
ALTER TABLE public.trimester_tips ADD COLUMN IF NOT EXISTS tip_text_uz TEXT;

-- vaccine_countries
ALTER TABLE public.vaccine_countries ADD COLUMN IF NOT EXISTS name_uz TEXT;

-- vaccine_schedules
ALTER TABLE public.vaccine_schedules ADD COLUMN IF NOT EXISTS dose_label_uz TEXT;
ALTER TABLE public.vaccine_schedules ADD COLUMN IF NOT EXISTS age_label_uz TEXT;
ALTER TABLE public.vaccine_schedules ADD COLUMN IF NOT EXISTS notes_uz TEXT;

-- vaccines
ALTER TABLE public.vaccines ADD COLUMN IF NOT EXISTS name_uz TEXT;
ALTER TABLE public.vaccines ADD COLUMN IF NOT EXISTS short_description_uz TEXT;
ALTER TABLE public.vaccines ADD COLUMN IF NOT EXISTS full_description_uz TEXT;
ALTER TABLE public.vaccines ADD COLUMN IF NOT EXISTS disease_uz TEXT;
ALTER TABLE public.vaccines ADD COLUMN IF NOT EXISTS route_uz TEXT;
ALTER TABLE public.vaccines ADD COLUMN IF NOT EXISTS side_effects_uz TEXT;
ALTER TABLE public.vaccines ADD COLUMN IF NOT EXISTS contraindications_uz TEXT;

-- vitamins
ALTER TABLE public.vitamins ADD COLUMN IF NOT EXISTS dosage_uz TEXT;
ALTER TABLE public.vitamins ADD COLUMN IF NOT EXISTS name_uz TEXT;
ALTER TABLE public.vitamins ADD COLUMN IF NOT EXISTS description_uz TEXT;
ALTER TABLE public.vitamins ADD COLUMN IF NOT EXISTS benefits_uz TEXT[];
ALTER TABLE public.vitamins ADD COLUMN IF NOT EXISTS food_sources_uz TEXT[];

-- weekly_tips
ALTER TABLE public.weekly_tips ADD COLUMN IF NOT EXISTS title_uz TEXT;
ALTER TABLE public.weekly_tips ADD COLUMN IF NOT EXISTS content_uz TEXT;
ALTER TABLE public.weekly_tips ADD COLUMN IF NOT EXISTS tips_uz JSONB;

-- weight_recommendations
ALTER TABLE public.weight_recommendations ADD COLUMN IF NOT EXISTS description_uz TEXT;

-- white_noise_sounds
ALTER TABLE public.white_noise_sounds ADD COLUMN IF NOT EXISTS name_uz TEXT;
ALTER TABLE public.white_noise_sounds ADD COLUMN IF NOT EXISTS description_uz TEXT;

-- zodiac_signs
ALTER TABLE public.zodiac_signs ADD COLUMN IF NOT EXISTS name_uz TEXT;
ALTER TABLE public.zodiac_signs ADD COLUMN IF NOT EXISTS characteristics_uz TEXT;

-- 3) Cəmiyyət tərcümə keşi: uz icazəsi (Son27 hələ tətbiq olunmayıbsa ötürülür)
DO $$
BEGIN
  IF to_regclass('public.community_post_translations') IS NOT NULL THEN
    ALTER TABLE public.community_post_translations DROP CONSTRAINT IF EXISTS community_post_translations_lang_check;
    ALTER TABLE public.community_post_translations ADD CONSTRAINT community_post_translations_lang_check CHECK (lang IN ('az','en','ru','tr','kk','de','ar','uz'));
  END IF;
END $$;
