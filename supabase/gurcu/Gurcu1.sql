-- ============================================================
-- Gurcu1 — Gürcü dili (ka) inteqrasiyası: SXEM
-- 1) app_languages: ka sətri (translations FK bundan asılıdır)
-- 2) Bütün kontent cədvəllərinə <sahə>_ka sütunları (Qazax1 ilə eyni dəst)
-- 3) community_post_translations CHECK: ka əlavə olunur
-- İdempotentdir — təkrar icra təhlükəsizdir.
-- SIRALAMA: Gurcu1 (sxem) → Gurcu4 (UI açarları) → kontent (azure-translate.cjs ka)
-- ============================================================

-- 1) Dil qeydiyyatı
INSERT INTO public.app_languages (code, name, native_name, is_active, sort_order)
VALUES ('ka', 'Georgian', 'ქართული', true, 9)
ON CONFLICT (code) DO UPDATE SET is_active = true, native_name = EXCLUDED.native_name;

-- 2) Kontent sütunları (_ka)
-- admin_recipes
ALTER TABLE public.admin_recipes ADD COLUMN IF NOT EXISTS title_ka TEXT;
ALTER TABLE public.admin_recipes ADD COLUMN IF NOT EXISTS description_ka TEXT;
ALTER TABLE public.admin_recipes ADD COLUMN IF NOT EXISTS category_ka TEXT;
ALTER TABLE public.admin_recipes ADD COLUMN IF NOT EXISTS tags_ka TEXT[];
ALTER TABLE public.admin_recipes ADD COLUMN IF NOT EXISTS ingredients_ka JSONB;
ALTER TABLE public.admin_recipes ADD COLUMN IF NOT EXISTS instructions_ka JSONB;

-- ai_suggested_questions
ALTER TABLE public.ai_suggested_questions ADD COLUMN IF NOT EXISTS question_ka TEXT;

-- baby_crisis_periods
ALTER TABLE public.baby_crisis_periods ADD COLUMN IF NOT EXISTS title_ka TEXT;
ALTER TABLE public.baby_crisis_periods ADD COLUMN IF NOT EXISTS description_ka TEXT;
ALTER TABLE public.baby_crisis_periods ADD COLUMN IF NOT EXISTS symptoms_ka TEXT;
ALTER TABLE public.baby_crisis_periods ADD COLUMN IF NOT EXISTS tips_ka TEXT;

-- baby_daily_info
ALTER TABLE public.baby_daily_info ADD COLUMN IF NOT EXISTS info_ka TEXT;

-- baby_milestones_db
ALTER TABLE public.baby_milestones_db ADD COLUMN IF NOT EXISTS label_ka TEXT;
ALTER TABLE public.baby_milestones_db ADD COLUMN IF NOT EXISTS description_ka TEXT;

-- baby_month_illustrations
ALTER TABLE public.baby_month_illustrations ADD COLUMN IF NOT EXISTS title_ka TEXT;
ALTER TABLE public.baby_month_illustrations ADD COLUMN IF NOT EXISTS description_ka TEXT;

-- baby_names_db
ALTER TABLE public.baby_names_db ADD COLUMN IF NOT EXISTS origin_ka TEXT;
ALTER TABLE public.baby_names_db ADD COLUMN IF NOT EXISTS meaning_ka TEXT;

-- baby_teeth_db
ALTER TABLE public.baby_teeth_db ADD COLUMN IF NOT EXISTS name_ka TEXT;
ALTER TABLE public.baby_teeth_db ADD COLUMN IF NOT EXISTS description_ka TEXT;

-- blog_categories
ALTER TABLE public.blog_categories ADD COLUMN IF NOT EXISTS name_ka TEXT;
ALTER TABLE public.blog_categories ADD COLUMN IF NOT EXISTS description_ka TEXT;

-- blog_posts
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS title_ka TEXT;
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS excerpt_ka TEXT;
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS content_ka TEXT;

-- breathing_exercises
ALTER TABLE public.breathing_exercises ADD COLUMN IF NOT EXISTS name_ka TEXT;
ALTER TABLE public.breathing_exercises ADD COLUMN IF NOT EXISTS description_ka TEXT;

-- cakes
ALTER TABLE public.cakes ADD COLUMN IF NOT EXISTS name_ka TEXT;
ALTER TABLE public.cakes ADD COLUMN IF NOT EXISTS description_ka TEXT;
ALTER TABLE public.cakes ADD COLUMN IF NOT EXISTS milestone_label_ka TEXT;

-- common_foods
ALTER TABLE public.common_foods ADD COLUMN IF NOT EXISTS name_ka TEXT;

-- default_shopping_items
ALTER TABLE public.default_shopping_items ADD COLUMN IF NOT EXISTS name_ka TEXT;

-- development_tips
ALTER TABLE public.development_tips ADD COLUMN IF NOT EXISTS title_ka TEXT;
ALTER TABLE public.development_tips ADD COLUMN IF NOT EXISTS content_ka TEXT;

-- epds_questions
ALTER TABLE public.epds_questions ADD COLUMN IF NOT EXISTS question_text_ka TEXT;

-- exercises
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS description_ka TEXT;

-- fairy_tale_themes
ALTER TABLE public.fairy_tale_themes ADD COLUMN IF NOT EXISTS name_ka TEXT;
ALTER TABLE public.fairy_tale_themes ADD COLUMN IF NOT EXISTS description_ka TEXT;

-- faqs
ALTER TABLE public.faqs ADD COLUMN IF NOT EXISTS question_ka TEXT;
ALTER TABLE public.faqs ADD COLUMN IF NOT EXISTS answer_ka TEXT;

-- first_aid_scenarios
ALTER TABLE public.first_aid_scenarios ADD COLUMN IF NOT EXISTS title_ka TEXT;
ALTER TABLE public.first_aid_scenarios ADD COLUMN IF NOT EXISTS description_ka TEXT;

-- first_aid_steps
ALTER TABLE public.first_aid_steps ADD COLUMN IF NOT EXISTS title_ka TEXT;
ALTER TABLE public.first_aid_steps ADD COLUMN IF NOT EXISTS instruction_ka TEXT;

-- flow_insights
ALTER TABLE public.flow_insights ADD COLUMN IF NOT EXISTS title_ka TEXT;
ALTER TABLE public.flow_insights ADD COLUMN IF NOT EXISTS content_ka TEXT;

-- flow_phase_tips
ALTER TABLE public.flow_phase_tips ADD COLUMN IF NOT EXISTS tip_text_ka TEXT;

-- flow_symptoms_db
ALTER TABLE public.flow_symptoms_db ADD COLUMN IF NOT EXISTS label_ka TEXT;

-- healthcare_providers
ALTER TABLE public.healthcare_providers ADD COLUMN IF NOT EXISTS name_ka TEXT;
ALTER TABLE public.healthcare_providers ADD COLUMN IF NOT EXISTS specialty_ka TEXT;
ALTER TABLE public.healthcare_providers ADD COLUMN IF NOT EXISTS description_ka TEXT;
ALTER TABLE public.healthcare_providers ADD COLUMN IF NOT EXISTS address_ka TEXT;

-- hospital_bag_templates
ALTER TABLE public.hospital_bag_templates ADD COLUMN IF NOT EXISTS item_name_ka TEXT;
ALTER TABLE public.hospital_bag_templates ADD COLUMN IF NOT EXISTS notes_ka TEXT;

-- intro_slides
ALTER TABLE public.intro_slides ADD COLUMN IF NOT EXISTS title_ka TEXT;
ALTER TABLE public.intro_slides ADD COLUMN IF NOT EXISTS subtitle_ka TEXT;
ALTER TABLE public.intro_slides ADD COLUMN IF NOT EXISTS description_ka TEXT;

-- legal_documents
ALTER TABLE public.legal_documents ADD COLUMN IF NOT EXISTS title_ka TEXT;
ALTER TABLE public.legal_documents ADD COLUMN IF NOT EXISTS content_ka TEXT;

-- maternity_guidelines
ALTER TABLE public.maternity_guidelines ADD COLUMN IF NOT EXISTS title_ka TEXT;
ALTER TABLE public.maternity_guidelines ADD COLUMN IF NOT EXISTS content_ka TEXT;

-- meal_types
ALTER TABLE public.meal_types ADD COLUMN IF NOT EXISTS name_ka TEXT;

-- mental_health_resources
ALTER TABLE public.mental_health_resources ADD COLUMN IF NOT EXISTS name_ka TEXT;
ALTER TABLE public.mental_health_resources ADD COLUMN IF NOT EXISTS description_ka TEXT;

-- mom_friendly_places
ALTER TABLE public.mom_friendly_places ADD COLUMN IF NOT EXISTS name_ka TEXT;
ALTER TABLE public.mom_friendly_places ADD COLUMN IF NOT EXISTS description_ka TEXT;
ALTER TABLE public.mom_friendly_places ADD COLUMN IF NOT EXISTS address_ka TEXT;

-- mommy_daily_messages
ALTER TABLE public.mommy_daily_messages ADD COLUMN IF NOT EXISTS message_ka TEXT;

-- mommy_day_notifications
ALTER TABLE public.mommy_day_notifications ADD COLUMN IF NOT EXISTS title_ka TEXT;
ALTER TABLE public.mommy_day_notifications ADD COLUMN IF NOT EXISTS body_ka TEXT;

-- mood_levels
ALTER TABLE public.mood_levels ADD COLUMN IF NOT EXISTS label_ka TEXT;

-- mood_options
ALTER TABLE public.mood_options ADD COLUMN IF NOT EXISTS label_ka TEXT;

-- multiples_options
ALTER TABLE public.multiples_options ADD COLUMN IF NOT EXISTS label_ka TEXT;

-- noise_thresholds
ALTER TABLE public.noise_thresholds ADD COLUMN IF NOT EXISTS label_ka TEXT;
ALTER TABLE public.noise_thresholds ADD COLUMN IF NOT EXISTS description_ka TEXT;

-- nutrition_targets
ALTER TABLE public.nutrition_targets ADD COLUMN IF NOT EXISTS description_ka TEXT;

-- nutrition_tips
ALTER TABLE public.nutrition_tips ADD COLUMN IF NOT EXISTS title_ka TEXT;
ALTER TABLE public.nutrition_tips ADD COLUMN IF NOT EXISTS content_ka TEXT;

-- onboarding_stages
ALTER TABLE public.onboarding_stages ADD COLUMN IF NOT EXISTS title_ka TEXT;
ALTER TABLE public.onboarding_stages ADD COLUMN IF NOT EXISTS subtitle_ka TEXT;
ALTER TABLE public.onboarding_stages ADD COLUMN IF NOT EXISTS description_ka TEXT;

-- partner_daily_tips
ALTER TABLE public.partner_daily_tips ADD COLUMN IF NOT EXISTS tip_text_ka TEXT;

-- partner_venue_categories
ALTER TABLE public.partner_venue_categories ADD COLUMN IF NOT EXISTS label_ka TEXT;

-- photoshoot_backgrounds
ALTER TABLE public.photoshoot_backgrounds ADD COLUMN IF NOT EXISTS category_name_ka TEXT;
ALTER TABLE public.photoshoot_backgrounds ADD COLUMN IF NOT EXISTS theme_name_ka TEXT;

-- photoshoot_eye_colors
ALTER TABLE public.photoshoot_eye_colors ADD COLUMN IF NOT EXISTS color_name_ka TEXT;

-- photoshoot_hair_colors
ALTER TABLE public.photoshoot_hair_colors ADD COLUMN IF NOT EXISTS color_name_ka TEXT;

-- photoshoot_hair_styles
ALTER TABLE public.photoshoot_hair_styles ADD COLUMN IF NOT EXISTS style_name_ka TEXT;

-- photoshoot_image_styles
ALTER TABLE public.photoshoot_image_styles ADD COLUMN IF NOT EXISTS style_name_ka TEXT;

-- photoshoot_outfits
ALTER TABLE public.photoshoot_outfits ADD COLUMN IF NOT EXISTS outfit_name_ka TEXT;

-- place_amenities
ALTER TABLE public.place_amenities ADD COLUMN IF NOT EXISTS label_ka TEXT;

-- place_categories
ALTER TABLE public.place_categories ADD COLUMN IF NOT EXISTS label_ka TEXT;

-- play_activities
ALTER TABLE public.play_activities ADD COLUMN IF NOT EXISTS title_ka TEXT;
ALTER TABLE public.play_activities ADD COLUMN IF NOT EXISTS description_ka TEXT;
ALTER TABLE public.play_activities ADD COLUMN IF NOT EXISTS instructions_ka TEXT;

-- play_inventory_items
ALTER TABLE public.play_inventory_items ADD COLUMN IF NOT EXISTS name_ka TEXT;

-- pregnancy_daily_content
ALTER TABLE public.pregnancy_daily_content ADD COLUMN IF NOT EXISTS baby_development_ka TEXT;
ALTER TABLE public.pregnancy_daily_content ADD COLUMN IF NOT EXISTS baby_message_ka TEXT;
ALTER TABLE public.pregnancy_daily_content ADD COLUMN IF NOT EXISTS baby_size_fruit_ka TEXT;
ALTER TABLE public.pregnancy_daily_content ADD COLUMN IF NOT EXISTS body_changes_ka TEXT;
ALTER TABLE public.pregnancy_daily_content ADD COLUMN IF NOT EXISTS daily_tip_ka TEXT;
ALTER TABLE public.pregnancy_daily_content ADD COLUMN IF NOT EXISTS doctor_visit_tip_ka TEXT;
ALTER TABLE public.pregnancy_daily_content ADD COLUMN IF NOT EXISTS emotional_tip_ka TEXT;
ALTER TABLE public.pregnancy_daily_content ADD COLUMN IF NOT EXISTS exercise_tip_ka TEXT;
ALTER TABLE public.pregnancy_daily_content ADD COLUMN IF NOT EXISTS mother_tips_ka TEXT;
ALTER TABLE public.pregnancy_daily_content ADD COLUMN IF NOT EXISTS mother_warnings_ka TEXT;
ALTER TABLE public.pregnancy_daily_content ADD COLUMN IF NOT EXISTS nutrition_tip_ka TEXT;
ALTER TABLE public.pregnancy_daily_content ADD COLUMN IF NOT EXISTS partner_tip_ka TEXT;
ALTER TABLE public.pregnancy_daily_content ADD COLUMN IF NOT EXISTS foods_to_avoid_ka TEXT[];
ALTER TABLE public.pregnancy_daily_content ADD COLUMN IF NOT EXISTS mother_symptoms_ka TEXT[];
ALTER TABLE public.pregnancy_daily_content ADD COLUMN IF NOT EXISTS recommended_exercises_ka TEXT[];
ALTER TABLE public.pregnancy_daily_content ADD COLUMN IF NOT EXISTS recommended_foods_ka TEXT[];
ALTER TABLE public.pregnancy_daily_content ADD COLUMN IF NOT EXISTS tests_to_do_ka TEXT[];

-- pregnancy_day_notifications
ALTER TABLE public.pregnancy_day_notifications ADD COLUMN IF NOT EXISTS title_ka TEXT;
ALTER TABLE public.pregnancy_day_notifications ADD COLUMN IF NOT EXISTS body_ka TEXT;

-- premium_features
ALTER TABLE public.premium_features ADD COLUMN IF NOT EXISTS title_ka TEXT;
ALTER TABLE public.premium_features ADD COLUMN IF NOT EXISTS description_ka TEXT;

-- premium_plans
ALTER TABLE public.premium_plans ADD COLUMN IF NOT EXISTS description_ka TEXT;
ALTER TABLE public.premium_plans ADD COLUMN IF NOT EXISTS name_ka TEXT;
ALTER TABLE public.premium_plans ADD COLUMN IF NOT EXISTS badge_text_ka TEXT;

-- products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS name_ka TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS description_ka TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category_ka TEXT;

-- recipe_categories
ALTER TABLE public.recipe_categories ADD COLUMN IF NOT EXISTS name_ka TEXT;

-- safety_categories
ALTER TABLE public.safety_categories ADD COLUMN IF NOT EXISTS name_ka TEXT;

-- safety_items
ALTER TABLE public.safety_items ADD COLUMN IF NOT EXISTS name_ka TEXT;
ALTER TABLE public.safety_items ADD COLUMN IF NOT EXISTS description_ka TEXT;

-- scheduled_notifications
ALTER TABLE public.scheduled_notifications ADD COLUMN IF NOT EXISTS title_ka TEXT;
ALTER TABLE public.scheduled_notifications ADD COLUMN IF NOT EXISTS body_ka TEXT;

-- shop_categories
ALTER TABLE public.shop_categories ADD COLUMN IF NOT EXISTS name_ka TEXT;

-- support_categories
ALTER TABLE public.support_categories ADD COLUMN IF NOT EXISTS name_ka TEXT;

-- surprise_ideas
ALTER TABLE public.surprise_ideas ADD COLUMN IF NOT EXISTS title_ka TEXT;
ALTER TABLE public.surprise_ideas ADD COLUMN IF NOT EXISTS description_ka TEXT;

-- symptoms
ALTER TABLE public.symptoms ADD COLUMN IF NOT EXISTS label_ka TEXT;

-- teething_care_tips
ALTER TABLE public.teething_care_tips ADD COLUMN IF NOT EXISTS title_ka TEXT;
ALTER TABLE public.teething_care_tips ADD COLUMN IF NOT EXISTS content_ka TEXT;

-- teething_symptoms
ALTER TABLE public.teething_symptoms ADD COLUMN IF NOT EXISTS name_ka TEXT;
ALTER TABLE public.teething_symptoms ADD COLUMN IF NOT EXISTS description_ka TEXT;
ALTER TABLE public.teething_symptoms ADD COLUMN IF NOT EXISTS relief_tips_ka TEXT;

-- tool_configs
ALTER TABLE public.tool_configs ADD COLUMN IF NOT EXISTS name_ka TEXT;
ALTER TABLE public.tool_configs ADD COLUMN IF NOT EXISTS description_ka TEXT;
ALTER TABLE public.tool_configs ADD COLUMN IF NOT EXISTS partner_name_ka TEXT;
ALTER TABLE public.tool_configs ADD COLUMN IF NOT EXISTS partner_description_ka TEXT;

-- trimester_tips
ALTER TABLE public.trimester_tips ADD COLUMN IF NOT EXISTS tip_text_ka TEXT;

-- vaccine_countries
ALTER TABLE public.vaccine_countries ADD COLUMN IF NOT EXISTS name_ka TEXT;

-- vaccine_schedules
ALTER TABLE public.vaccine_schedules ADD COLUMN IF NOT EXISTS dose_label_ka TEXT;
ALTER TABLE public.vaccine_schedules ADD COLUMN IF NOT EXISTS age_label_ka TEXT;
ALTER TABLE public.vaccine_schedules ADD COLUMN IF NOT EXISTS notes_ka TEXT;

-- vaccines
ALTER TABLE public.vaccines ADD COLUMN IF NOT EXISTS name_ka TEXT;
ALTER TABLE public.vaccines ADD COLUMN IF NOT EXISTS short_description_ka TEXT;
ALTER TABLE public.vaccines ADD COLUMN IF NOT EXISTS full_description_ka TEXT;
ALTER TABLE public.vaccines ADD COLUMN IF NOT EXISTS disease_ka TEXT;
ALTER TABLE public.vaccines ADD COLUMN IF NOT EXISTS route_ka TEXT;
ALTER TABLE public.vaccines ADD COLUMN IF NOT EXISTS side_effects_ka TEXT;
ALTER TABLE public.vaccines ADD COLUMN IF NOT EXISTS contraindications_ka TEXT;

-- vitamins
ALTER TABLE public.vitamins ADD COLUMN IF NOT EXISTS dosage_ka TEXT;
ALTER TABLE public.vitamins ADD COLUMN IF NOT EXISTS name_ka TEXT;
ALTER TABLE public.vitamins ADD COLUMN IF NOT EXISTS description_ka TEXT;
ALTER TABLE public.vitamins ADD COLUMN IF NOT EXISTS benefits_ka TEXT[];
ALTER TABLE public.vitamins ADD COLUMN IF NOT EXISTS food_sources_ka TEXT[];

-- weekly_tips
ALTER TABLE public.weekly_tips ADD COLUMN IF NOT EXISTS title_ka TEXT;
ALTER TABLE public.weekly_tips ADD COLUMN IF NOT EXISTS content_ka TEXT;
ALTER TABLE public.weekly_tips ADD COLUMN IF NOT EXISTS tips_ka JSONB;

-- weight_recommendations
ALTER TABLE public.weight_recommendations ADD COLUMN IF NOT EXISTS description_ka TEXT;

-- white_noise_sounds
ALTER TABLE public.white_noise_sounds ADD COLUMN IF NOT EXISTS name_ka TEXT;
ALTER TABLE public.white_noise_sounds ADD COLUMN IF NOT EXISTS description_ka TEXT;

-- zodiac_signs
ALTER TABLE public.zodiac_signs ADD COLUMN IF NOT EXISTS name_ka TEXT;
ALTER TABLE public.zodiac_signs ADD COLUMN IF NOT EXISTS characteristics_ka TEXT;

-- 3) Cəmiyyət tərcümə keşi: ka icazəsi (Son27 hələ tətbiq olunmayıbsa ötürülür)
DO $$
BEGIN
  IF to_regclass('public.community_post_translations') IS NOT NULL THEN
    ALTER TABLE public.community_post_translations DROP CONSTRAINT IF EXISTS community_post_translations_lang_check;
    ALTER TABLE public.community_post_translations ADD CONSTRAINT community_post_translations_lang_check CHECK (lang IN ('az','en','ru','tr','kk','de','ar','uz','ka'));
  END IF;
END $$;

-- ── uz təcrübəsindən əlavə sütunlar (OzbekFix2/3/6 dərsi) ──
ALTER TABLE public.menstruation_phase_tips ADD COLUMN IF NOT EXISTS title_ka TEXT;
ALTER TABLE public.menstruation_phase_tips ADD COLUMN IF NOT EXISTS content_ka TEXT;
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS steps_ka TEXT[];
ALTER TABLE public.premium_features ADD COLUMN IF NOT EXISTS title_ka TEXT;
ALTER TABLE public.premium_features ADD COLUMN IF NOT EXISTS description_ka TEXT;

NOTIFY pgrst, 'reload schema';
