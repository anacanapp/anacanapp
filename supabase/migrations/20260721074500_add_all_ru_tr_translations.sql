-- Auto-generated migration to add ru and tr equivalents for all az columns

-- blog_posts
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS title_en TEXT;
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS title_ru TEXT;
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS title_tr TEXT;
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS excerpt_en TEXT;
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS excerpt_ru TEXT;
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS excerpt_tr TEXT;
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS content_en TEXT;
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS content_ru TEXT;
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS content_tr TEXT;

-- hospital_bag_templates
ALTER TABLE public.hospital_bag_templates ADD COLUMN IF NOT EXISTS notes_en TEXT;
ALTER TABLE public.hospital_bag_templates ADD COLUMN IF NOT EXISTS notes_ru TEXT;
ALTER TABLE public.hospital_bag_templates ADD COLUMN IF NOT EXISTS notes_tr TEXT;
ALTER TABLE public.hospital_bag_templates ADD COLUMN IF NOT EXISTS item_name_en text;
ALTER TABLE public.hospital_bag_templates ADD COLUMN IF NOT EXISTS item_name_ru text;
ALTER TABLE public.hospital_bag_templates ADD COLUMN IF NOT EXISTS item_name_tr text;

-- hospital_bag_items
ALTER TABLE public.hospital_bag_items ADD COLUMN IF NOT EXISTS item_name_en TEXT;
ALTER TABLE public.hospital_bag_items ADD COLUMN IF NOT EXISTS item_name_ru TEXT;
ALTER TABLE public.hospital_bag_items ADD COLUMN IF NOT EXISTS item_name_tr TEXT;
ALTER TABLE public.hospital_bag_items ADD COLUMN IF NOT EXISTS notes_en TEXT;
ALTER TABLE public.hospital_bag_items ADD COLUMN IF NOT EXISTS notes_ru TEXT;
ALTER TABLE public.hospital_bag_items ADD COLUMN IF NOT EXISTS notes_tr TEXT;

-- vaccine_countries
ALTER TABLE public.vaccine_countries ADD COLUMN IF NOT EXISTS name_en text;
ALTER TABLE public.vaccine_countries ADD COLUMN IF NOT EXISTS name_ru text;
ALTER TABLE public.vaccine_countries ADD COLUMN IF NOT EXISTS name_tr text;

-- vaccines
ALTER TABLE public.vaccines ADD COLUMN IF NOT EXISTS name_en text;
ALTER TABLE public.vaccines ADD COLUMN IF NOT EXISTS name_ru text;
ALTER TABLE public.vaccines ADD COLUMN IF NOT EXISTS name_tr text;
ALTER TABLE public.vaccines ADD COLUMN IF NOT EXISTS short_description_en text;
ALTER TABLE public.vaccines ADD COLUMN IF NOT EXISTS short_description_ru text;
ALTER TABLE public.vaccines ADD COLUMN IF NOT EXISTS short_description_tr text;
ALTER TABLE public.vaccines ADD COLUMN IF NOT EXISTS full_description_en text;
ALTER TABLE public.vaccines ADD COLUMN IF NOT EXISTS full_description_ru text;
ALTER TABLE public.vaccines ADD COLUMN IF NOT EXISTS full_description_tr text;
ALTER TABLE public.vaccines ADD COLUMN IF NOT EXISTS disease_en text;
ALTER TABLE public.vaccines ADD COLUMN IF NOT EXISTS disease_ru text;
ALTER TABLE public.vaccines ADD COLUMN IF NOT EXISTS disease_tr text;
ALTER TABLE public.vaccines ADD COLUMN IF NOT EXISTS route_en text;
ALTER TABLE public.vaccines ADD COLUMN IF NOT EXISTS route_ru text;
ALTER TABLE public.vaccines ADD COLUMN IF NOT EXISTS route_tr text;
ALTER TABLE public.vaccines ADD COLUMN IF NOT EXISTS side_effects_en text;
ALTER TABLE public.vaccines ADD COLUMN IF NOT EXISTS side_effects_ru text;
ALTER TABLE public.vaccines ADD COLUMN IF NOT EXISTS side_effects_tr text;
ALTER TABLE public.vaccines ADD COLUMN IF NOT EXISTS contraindications_en text;
ALTER TABLE public.vaccines ADD COLUMN IF NOT EXISTS contraindications_ru text;
ALTER TABLE public.vaccines ADD COLUMN IF NOT EXISTS contraindications_tr text;

-- vaccine_schedules
ALTER TABLE public.vaccine_schedules ADD COLUMN IF NOT EXISTS dose_label_en text;
ALTER TABLE public.vaccine_schedules ADD COLUMN IF NOT EXISTS dose_label_ru text;
ALTER TABLE public.vaccine_schedules ADD COLUMN IF NOT EXISTS dose_label_tr text;
ALTER TABLE public.vaccine_schedules ADD COLUMN IF NOT EXISTS age_label_en text;
ALTER TABLE public.vaccine_schedules ADD COLUMN IF NOT EXISTS age_label_ru text;
ALTER TABLE public.vaccine_schedules ADD COLUMN IF NOT EXISTS age_label_tr text;
ALTER TABLE public.vaccine_schedules ADD COLUMN IF NOT EXISTS notes_en text;
ALTER TABLE public.vaccine_schedules ADD COLUMN IF NOT EXISTS notes_ru text;
ALTER TABLE public.vaccine_schedules ADD COLUMN IF NOT EXISTS notes_tr text;

-- child_vaccinations
ALTER TABLE public.child_vaccinations ADD COLUMN IF NOT EXISTS location_en text;
ALTER TABLE public.child_vaccinations ADD COLUMN IF NOT EXISTS location_ru text;
ALTER TABLE public.child_vaccinations ADD COLUMN IF NOT EXISTS location_tr text;

-- partner_venue_categories
ALTER TABLE public.partner_venue_categories ADD COLUMN IF NOT EXISTS label_en text;
ALTER TABLE public.partner_venue_categories ADD COLUMN IF NOT EXISTS label_ru text;
ALTER TABLE public.partner_venue_categories ADD COLUMN IF NOT EXISTS label_tr text;

-- payment_methods
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS label_en text;
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS label_ru text;
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS label_tr text;
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS description_en text;
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS description_ru text;
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS description_tr text;

-- recipe_tags
ALTER TABLE public.recipe_tags ADD COLUMN IF NOT EXISTS name_en text;
ALTER TABLE public.recipe_tags ADD COLUMN IF NOT EXISTS name_ru text;
ALTER TABLE public.recipe_tags ADD COLUMN IF NOT EXISTS name_tr text;

-- white_noise_sounds
ALTER TABLE public.white_noise_sounds ADD COLUMN IF NOT EXISTS description_en TEXT;
ALTER TABLE public.white_noise_sounds ADD COLUMN IF NOT EXISTS description_ru TEXT;
ALTER TABLE public.white_noise_sounds ADD COLUMN IF NOT EXISTS description_tr TEXT;
ALTER TABLE public.white_noise_sounds ADD COLUMN IF NOT EXISTS name_en TEXT;
ALTER TABLE public.white_noise_sounds ADD COLUMN IF NOT EXISTS name_ru TEXT;
ALTER TABLE public.white_noise_sounds ADD COLUMN IF NOT EXISTS name_tr TEXT;

-- baby_teeth_db
ALTER TABLE public.baby_teeth_db ADD COLUMN IF NOT EXISTS name_en TEXT;
ALTER TABLE public.baby_teeth_db ADD COLUMN IF NOT EXISTS name_ru TEXT;
ALTER TABLE public.baby_teeth_db ADD COLUMN IF NOT EXISTS name_tr TEXT;
ALTER TABLE public.baby_teeth_db ADD COLUMN IF NOT EXISTS description_en TEXT;
ALTER TABLE public.baby_teeth_db ADD COLUMN IF NOT EXISTS description_ru TEXT;
ALTER TABLE public.baby_teeth_db ADD COLUMN IF NOT EXISTS description_tr TEXT;

-- teething_care_tips
ALTER TABLE public.teething_care_tips ADD COLUMN IF NOT EXISTS title_en TEXT;
ALTER TABLE public.teething_care_tips ADD COLUMN IF NOT EXISTS title_ru TEXT;
ALTER TABLE public.teething_care_tips ADD COLUMN IF NOT EXISTS title_tr TEXT;
ALTER TABLE public.teething_care_tips ADD COLUMN IF NOT EXISTS content_en TEXT;
ALTER TABLE public.teething_care_tips ADD COLUMN IF NOT EXISTS content_ru TEXT;
ALTER TABLE public.teething_care_tips ADD COLUMN IF NOT EXISTS content_tr TEXT;

-- teething_symptoms
ALTER TABLE public.teething_symptoms ADD COLUMN IF NOT EXISTS name_en TEXT;
ALTER TABLE public.teething_symptoms ADD COLUMN IF NOT EXISTS name_ru TEXT;
ALTER TABLE public.teething_symptoms ADD COLUMN IF NOT EXISTS name_tr TEXT;
ALTER TABLE public.teething_symptoms ADD COLUMN IF NOT EXISTS description_en TEXT;
ALTER TABLE public.teething_symptoms ADD COLUMN IF NOT EXISTS description_ru TEXT;
ALTER TABLE public.teething_symptoms ADD COLUMN IF NOT EXISTS description_tr TEXT;
ALTER TABLE public.teething_symptoms ADD COLUMN IF NOT EXISTS relief_tips_en TEXT;
ALTER TABLE public.teething_symptoms ADD COLUMN IF NOT EXISTS relief_tips_ru TEXT;
ALTER TABLE public.teething_symptoms ADD COLUMN IF NOT EXISTS relief_tips_tr TEXT;

-- flow_symptoms_db
ALTER TABLE public.flow_symptoms_db ADD COLUMN IF NOT EXISTS label_en TEXT;
ALTER TABLE public.flow_symptoms_db ADD COLUMN IF NOT EXISTS label_ru TEXT;
ALTER TABLE public.flow_symptoms_db ADD COLUMN IF NOT EXISTS label_tr TEXT;

-- menstruation_phase_tips
ALTER TABLE public.menstruation_phase_tips ADD COLUMN IF NOT EXISTS title_en TEXT;
ALTER TABLE public.menstruation_phase_tips ADD COLUMN IF NOT EXISTS title_ru TEXT;
ALTER TABLE public.menstruation_phase_tips ADD COLUMN IF NOT EXISTS title_tr TEXT;
ALTER TABLE public.menstruation_phase_tips ADD COLUMN IF NOT EXISTS content_en TEXT;
ALTER TABLE public.menstruation_phase_tips ADD COLUMN IF NOT EXISTS content_ru TEXT;
ALTER TABLE public.menstruation_phase_tips ADD COLUMN IF NOT EXISTS content_tr TEXT;

-- baby_month_illustrations
ALTER TABLE public.baby_month_illustrations ADD COLUMN IF NOT EXISTS title_en TEXT;
ALTER TABLE public.baby_month_illustrations ADD COLUMN IF NOT EXISTS title_ru TEXT;
ALTER TABLE public.baby_month_illustrations ADD COLUMN IF NOT EXISTS title_tr TEXT;
ALTER TABLE public.baby_month_illustrations ADD COLUMN IF NOT EXISTS description_en TEXT;
ALTER TABLE public.baby_month_illustrations ADD COLUMN IF NOT EXISTS description_ru TEXT;
ALTER TABLE public.baby_month_illustrations ADD COLUMN IF NOT EXISTS description_tr TEXT;

-- baby_crisis_periods
ALTER TABLE public.baby_crisis_periods ADD COLUMN IF NOT EXISTS title_en TEXT;
ALTER TABLE public.baby_crisis_periods ADD COLUMN IF NOT EXISTS title_ru TEXT;
ALTER TABLE public.baby_crisis_periods ADD COLUMN IF NOT EXISTS title_tr TEXT;
ALTER TABLE public.baby_crisis_periods ADD COLUMN IF NOT EXISTS description_en TEXT;
ALTER TABLE public.baby_crisis_periods ADD COLUMN IF NOT EXISTS description_ru TEXT;
ALTER TABLE public.baby_crisis_periods ADD COLUMN IF NOT EXISTS description_tr TEXT;
ALTER TABLE public.baby_crisis_periods ADD COLUMN IF NOT EXISTS symptoms_en TEXT;
ALTER TABLE public.baby_crisis_periods ADD COLUMN IF NOT EXISTS symptoms_ru TEXT;
ALTER TABLE public.baby_crisis_periods ADD COLUMN IF NOT EXISTS symptoms_tr TEXT;
ALTER TABLE public.baby_crisis_periods ADD COLUMN IF NOT EXISTS tips_en TEXT;
ALTER TABLE public.baby_crisis_periods ADD COLUMN IF NOT EXISTS tips_ru TEXT;
ALTER TABLE public.baby_crisis_periods ADD COLUMN IF NOT EXISTS tips_tr TEXT;

-- maternity_config
ALTER TABLE public.maternity_config ADD COLUMN IF NOT EXISTS label_en TEXT;
ALTER TABLE public.maternity_config ADD COLUMN IF NOT EXISTS label_ru TEXT;
ALTER TABLE public.maternity_config ADD COLUMN IF NOT EXISTS label_tr TEXT;
ALTER TABLE public.maternity_config ADD COLUMN IF NOT EXISTS description_en TEXT;
ALTER TABLE public.maternity_config ADD COLUMN IF NOT EXISTS description_ru TEXT;
ALTER TABLE public.maternity_config ADD COLUMN IF NOT EXISTS description_tr TEXT;

-- maternity_guidelines
ALTER TABLE public.maternity_guidelines ADD COLUMN IF NOT EXISTS title_en TEXT;
ALTER TABLE public.maternity_guidelines ADD COLUMN IF NOT EXISTS title_ru TEXT;
ALTER TABLE public.maternity_guidelines ADD COLUMN IF NOT EXISTS title_tr TEXT;
ALTER TABLE public.maternity_guidelines ADD COLUMN IF NOT EXISTS content_en TEXT;
ALTER TABLE public.maternity_guidelines ADD COLUMN IF NOT EXISTS content_ru TEXT;
ALTER TABLE public.maternity_guidelines ADD COLUMN IF NOT EXISTS content_tr TEXT;

-- default_shopping_items
ALTER TABLE public.default_shopping_items ADD COLUMN IF NOT EXISTS name_en TEXT;
ALTER TABLE public.default_shopping_items ADD COLUMN IF NOT EXISTS name_ru TEXT;
ALTER TABLE public.default_shopping_items ADD COLUMN IF NOT EXISTS name_tr TEXT;

-- premium_features
ALTER TABLE public.premium_features ADD COLUMN IF NOT EXISTS title_en TEXT;
ALTER TABLE public.premium_features ADD COLUMN IF NOT EXISTS title_ru TEXT;
ALTER TABLE public.premium_features ADD COLUMN IF NOT EXISTS title_tr TEXT;
ALTER TABLE public.premium_features ADD COLUMN IF NOT EXISTS description_en TEXT;
ALTER TABLE public.premium_features ADD COLUMN IF NOT EXISTS description_ru TEXT;
ALTER TABLE public.premium_features ADD COLUMN IF NOT EXISTS description_tr TEXT;

-- premium_plans
ALTER TABLE public.premium_plans ADD COLUMN IF NOT EXISTS name_en TEXT;
ALTER TABLE public.premium_plans ADD COLUMN IF NOT EXISTS name_ru TEXT;
ALTER TABLE public.premium_plans ADD COLUMN IF NOT EXISTS name_tr TEXT;
ALTER TABLE public.premium_plans ADD COLUMN IF NOT EXISTS description_en TEXT;
ALTER TABLE public.premium_plans ADD COLUMN IF NOT EXISTS description_ru TEXT;
ALTER TABLE public.premium_plans ADD COLUMN IF NOT EXISTS description_tr TEXT;
ALTER TABLE public.premium_plans ADD COLUMN IF NOT EXISTS badge_text_en TEXT;
ALTER TABLE public.premium_plans ADD COLUMN IF NOT EXISTS badge_text_ru TEXT;
ALTER TABLE public.premium_plans ADD COLUMN IF NOT EXISTS badge_text_tr TEXT;

-- place_categories
ALTER TABLE public.place_categories ADD COLUMN IF NOT EXISTS label_en TEXT;
ALTER TABLE public.place_categories ADD COLUMN IF NOT EXISTS label_ru TEXT;
ALTER TABLE public.place_categories ADD COLUMN IF NOT EXISTS label_tr TEXT;

-- place_amenities
ALTER TABLE public.place_amenities ADD COLUMN IF NOT EXISTS label_en TEXT;
ALTER TABLE public.place_amenities ADD COLUMN IF NOT EXISTS label_ru TEXT;
ALTER TABLE public.place_amenities ADD COLUMN IF NOT EXISTS label_tr TEXT;

-- partner_achievements
ALTER TABLE public.partner_achievements ADD COLUMN IF NOT EXISTS name_en TEXT;
ALTER TABLE public.partner_achievements ADD COLUMN IF NOT EXISTS name_ru TEXT;
ALTER TABLE public.partner_achievements ADD COLUMN IF NOT EXISTS name_tr TEXT;
ALTER TABLE public.partner_achievements ADD COLUMN IF NOT EXISTS description_en TEXT;
ALTER TABLE public.partner_achievements ADD COLUMN IF NOT EXISTS description_ru TEXT;
ALTER TABLE public.partner_achievements ADD COLUMN IF NOT EXISTS description_tr TEXT;

-- partner_menu_items
ALTER TABLE public.partner_menu_items ADD COLUMN IF NOT EXISTS label_en TEXT;
ALTER TABLE public.partner_menu_items ADD COLUMN IF NOT EXISTS label_ru TEXT;
ALTER TABLE public.partner_menu_items ADD COLUMN IF NOT EXISTS label_tr TEXT;

-- trimester_info
ALTER TABLE public.trimester_info ADD COLUMN IF NOT EXISTS label_en TEXT;
ALTER TABLE public.trimester_info ADD COLUMN IF NOT EXISTS label_ru TEXT;
ALTER TABLE public.trimester_info ADD COLUMN IF NOT EXISTS label_tr TEXT;

-- skill_categories
ALTER TABLE public.skill_categories ADD COLUMN IF NOT EXISTS label_en TEXT;
ALTER TABLE public.skill_categories ADD COLUMN IF NOT EXISTS label_ru TEXT;
ALTER TABLE public.skill_categories ADD COLUMN IF NOT EXISTS label_tr TEXT;

-- surprise_categories
ALTER TABLE public.surprise_categories ADD COLUMN IF NOT EXISTS label_en TEXT;
ALTER TABLE public.surprise_categories ADD COLUMN IF NOT EXISTS label_ru TEXT;
ALTER TABLE public.surprise_categories ADD COLUMN IF NOT EXISTS label_tr TEXT;

-- horoscope_elements
ALTER TABLE public.horoscope_elements ADD COLUMN IF NOT EXISTS name_en TEXT;
ALTER TABLE public.horoscope_elements ADD COLUMN IF NOT EXISTS name_ru TEXT;
ALTER TABLE public.horoscope_elements ADD COLUMN IF NOT EXISTS name_tr TEXT;

-- horoscope_loading_steps
ALTER TABLE public.horoscope_loading_steps ADD COLUMN IF NOT EXISTS label_en TEXT;
ALTER TABLE public.horoscope_loading_steps ADD COLUMN IF NOT EXISTS label_ru TEXT;
ALTER TABLE public.horoscope_loading_steps ADD COLUMN IF NOT EXISTS label_tr TEXT;

-- time_options
ALTER TABLE public.time_options ADD COLUMN IF NOT EXISTS label_en TEXT;
ALTER TABLE public.time_options ADD COLUMN IF NOT EXISTS label_ru TEXT;
ALTER TABLE public.time_options ADD COLUMN IF NOT EXISTS label_tr TEXT;

-- cry_type_labels
ALTER TABLE public.cry_type_labels ADD COLUMN IF NOT EXISTS label_en TEXT;
ALTER TABLE public.cry_type_labels ADD COLUMN IF NOT EXISTS label_ru TEXT;
ALTER TABLE public.cry_type_labels ADD COLUMN IF NOT EXISTS label_tr TEXT;
ALTER TABLE public.cry_type_labels ADD COLUMN IF NOT EXISTS description_en TEXT;
ALTER TABLE public.cry_type_labels ADD COLUMN IF NOT EXISTS description_ru TEXT;
ALTER TABLE public.cry_type_labels ADD COLUMN IF NOT EXISTS description_tr TEXT;

-- poop_color_labels
ALTER TABLE public.poop_color_labels ADD COLUMN IF NOT EXISTS label_en TEXT;
ALTER TABLE public.poop_color_labels ADD COLUMN IF NOT EXISTS label_ru TEXT;
ALTER TABLE public.poop_color_labels ADD COLUMN IF NOT EXISTS label_tr TEXT;
ALTER TABLE public.poop_color_labels ADD COLUMN IF NOT EXISTS description_en TEXT;
ALTER TABLE public.poop_color_labels ADD COLUMN IF NOT EXISTS description_ru TEXT;
ALTER TABLE public.poop_color_labels ADD COLUMN IF NOT EXISTS description_tr TEXT;

-- temperature_emojis
ALTER TABLE public.temperature_emojis ADD COLUMN IF NOT EXISTS label_en TEXT;
ALTER TABLE public.temperature_emojis ADD COLUMN IF NOT EXISTS label_ru TEXT;
ALTER TABLE public.temperature_emojis ADD COLUMN IF NOT EXISTS label_tr TEXT;
ALTER TABLE public.temperature_emojis ADD COLUMN IF NOT EXISTS clothing_tip_en TEXT;
ALTER TABLE public.temperature_emojis ADD COLUMN IF NOT EXISTS clothing_tip_ru TEXT;
ALTER TABLE public.temperature_emojis ADD COLUMN IF NOT EXISTS clothing_tip_tr TEXT;

-- marketplace_categories
ALTER TABLE public.marketplace_categories ADD COLUMN IF NOT EXISTS label_en TEXT;
ALTER TABLE public.marketplace_categories ADD COLUMN IF NOT EXISTS label_ru TEXT;
ALTER TABLE public.marketplace_categories ADD COLUMN IF NOT EXISTS label_tr TEXT;

-- product_conditions
ALTER TABLE public.product_conditions ADD COLUMN IF NOT EXISTS label_en TEXT;
ALTER TABLE public.product_conditions ADD COLUMN IF NOT EXISTS label_ru TEXT;
ALTER TABLE public.product_conditions ADD COLUMN IF NOT EXISTS label_tr TEXT;

-- age_ranges
ALTER TABLE public.age_ranges ADD COLUMN IF NOT EXISTS label_en TEXT;
ALTER TABLE public.age_ranges ADD COLUMN IF NOT EXISTS label_ru TEXT;
ALTER TABLE public.age_ranges ADD COLUMN IF NOT EXISTS label_tr TEXT;

-- provider_types
ALTER TABLE public.provider_types ADD COLUMN IF NOT EXISTS label_en TEXT;
ALTER TABLE public.provider_types ADD COLUMN IF NOT EXISTS label_ru TEXT;
ALTER TABLE public.provider_types ADD COLUMN IF NOT EXISTS label_tr TEXT;

-- day_labels
ALTER TABLE public.day_labels ADD COLUMN IF NOT EXISTS label_en TEXT;
ALTER TABLE public.day_labels ADD COLUMN IF NOT EXISTS label_ru TEXT;
ALTER TABLE public.day_labels ADD COLUMN IF NOT EXISTS label_tr TEXT;
ALTER TABLE public.day_labels ADD COLUMN IF NOT EXISTS short_label_en TEXT;
ALTER TABLE public.day_labels ADD COLUMN IF NOT EXISTS short_label_ru TEXT;
ALTER TABLE public.day_labels ADD COLUMN IF NOT EXISTS short_label_tr TEXT;

-- exercise_daily_tips
ALTER TABLE public.exercise_daily_tips ADD COLUMN IF NOT EXISTS tip_en TEXT;
ALTER TABLE public.exercise_daily_tips ADD COLUMN IF NOT EXISTS tip_ru TEXT;
ALTER TABLE public.exercise_daily_tips ADD COLUMN IF NOT EXISTS tip_tr TEXT;

-- epds_questions
ALTER TABLE public.epds_questions ADD COLUMN IF NOT EXISTS question_text_en TEXT;
ALTER TABLE public.epds_questions ADD COLUMN IF NOT EXISTS question_text_ru TEXT;
ALTER TABLE public.epds_questions ADD COLUMN IF NOT EXISTS question_text_tr TEXT;

-- mood_levels
ALTER TABLE public.mood_levels ADD COLUMN IF NOT EXISTS label_en TEXT;
ALTER TABLE public.mood_levels ADD COLUMN IF NOT EXISTS label_ru TEXT;
ALTER TABLE public.mood_levels ADD COLUMN IF NOT EXISTS label_tr TEXT;

-- breathing_exercises
ALTER TABLE public.breathing_exercises ADD COLUMN IF NOT EXISTS name_en TEXT;
ALTER TABLE public.breathing_exercises ADD COLUMN IF NOT EXISTS name_ru TEXT;
ALTER TABLE public.breathing_exercises ADD COLUMN IF NOT EXISTS name_tr TEXT;
ALTER TABLE public.breathing_exercises ADD COLUMN IF NOT EXISTS description_en TEXT;
ALTER TABLE public.breathing_exercises ADD COLUMN IF NOT EXISTS description_ru TEXT;
ALTER TABLE public.breathing_exercises ADD COLUMN IF NOT EXISTS description_tr TEXT;
ALTER TABLE public.breathing_exercises ADD COLUMN IF NOT EXISTS benefits_en TEXT;
ALTER TABLE public.breathing_exercises ADD COLUMN IF NOT EXISTS benefits_ru TEXT;
ALTER TABLE public.breathing_exercises ADD COLUMN IF NOT EXISTS benefits_tr TEXT;

-- noise_thresholds
ALTER TABLE public.noise_thresholds ADD COLUMN IF NOT EXISTS label_en TEXT;
ALTER TABLE public.noise_thresholds ADD COLUMN IF NOT EXISTS label_ru TEXT;
ALTER TABLE public.noise_thresholds ADD COLUMN IF NOT EXISTS label_tr TEXT;
ALTER TABLE public.noise_thresholds ADD COLUMN IF NOT EXISTS description_en TEXT;
ALTER TABLE public.noise_thresholds ADD COLUMN IF NOT EXISTS description_ru TEXT;
ALTER TABLE public.noise_thresholds ADD COLUMN IF NOT EXISTS description_tr TEXT;

-- surprise_ideas
ALTER TABLE public.surprise_ideas ADD COLUMN IF NOT EXISTS title_en TEXT;
ALTER TABLE public.surprise_ideas ADD COLUMN IF NOT EXISTS title_ru TEXT;
ALTER TABLE public.surprise_ideas ADD COLUMN IF NOT EXISTS title_tr TEXT;
ALTER TABLE public.surprise_ideas ADD COLUMN IF NOT EXISTS description_en TEXT;
ALTER TABLE public.surprise_ideas ADD COLUMN IF NOT EXISTS description_ru TEXT;
ALTER TABLE public.surprise_ideas ADD COLUMN IF NOT EXISTS description_tr TEXT;

-- banners
ALTER TABLE public.banners ADD COLUMN IF NOT EXISTS title_en TEXT;
ALTER TABLE public.banners ADD COLUMN IF NOT EXISTS title_ru TEXT;
ALTER TABLE public.banners ADD COLUMN IF NOT EXISTS title_tr TEXT;
ALTER TABLE public.banners ADD COLUMN IF NOT EXISTS description_en TEXT;
ALTER TABLE public.banners ADD COLUMN IF NOT EXISTS description_ru TEXT;
ALTER TABLE public.banners ADD COLUMN IF NOT EXISTS description_tr TEXT;
ALTER TABLE public.banners ADD COLUMN IF NOT EXISTS button_text_en TEXT;
ALTER TABLE public.banners ADD COLUMN IF NOT EXISTS button_text_ru TEXT;
ALTER TABLE public.banners ADD COLUMN IF NOT EXISTS button_text_tr TEXT;

-- tool_configs
ALTER TABLE public.tool_configs ADD COLUMN IF NOT EXISTS display_name_en text;
ALTER TABLE public.tool_configs ADD COLUMN IF NOT EXISTS display_name_ru text;
ALTER TABLE public.tool_configs ADD COLUMN IF NOT EXISTS display_name_tr text;
ALTER TABLE public.tool_configs ADD COLUMN IF NOT EXISTS description_en text;
ALTER TABLE public.tool_configs ADD COLUMN IF NOT EXISTS description_ru text;
ALTER TABLE public.tool_configs ADD COLUMN IF NOT EXISTS description_tr text;
ALTER TABLE public.tool_configs ADD COLUMN IF NOT EXISTS name_en text;
ALTER TABLE public.tool_configs ADD COLUMN IF NOT EXISTS name_ru text;
ALTER TABLE public.tool_configs ADD COLUMN IF NOT EXISTS name_tr text;
ALTER TABLE public.tool_configs ADD COLUMN IF NOT EXISTS description_en text;
ALTER TABLE public.tool_configs ADD COLUMN IF NOT EXISTS description_ru text;
ALTER TABLE public.tool_configs ADD COLUMN IF NOT EXISTS description_tr text;
ALTER TABLE public.tool_configs ADD COLUMN IF NOT EXISTS partner_name_en text;
ALTER TABLE public.tool_configs ADD COLUMN IF NOT EXISTS partner_name_ru text;
ALTER TABLE public.tool_configs ADD COLUMN IF NOT EXISTS partner_name_tr text;
ALTER TABLE public.tool_configs ADD COLUMN IF NOT EXISTS partner_description_en text;
ALTER TABLE public.tool_configs ADD COLUMN IF NOT EXISTS partner_description_ru text;
ALTER TABLE public.tool_configs ADD COLUMN IF NOT EXISTS partner_description_tr text;

-- quick_actions
ALTER TABLE public.quick_actions ADD COLUMN IF NOT EXISTS label_en TEXT;
ALTER TABLE public.quick_actions ADD COLUMN IF NOT EXISTS label_ru TEXT;
ALTER TABLE public.quick_actions ADD COLUMN IF NOT EXISTS label_tr TEXT;

-- development_tips
ALTER TABLE public.development_tips ADD COLUMN IF NOT EXISTS title_en TEXT;
ALTER TABLE public.development_tips ADD COLUMN IF NOT EXISTS title_ru TEXT;
ALTER TABLE public.development_tips ADD COLUMN IF NOT EXISTS title_tr TEXT;
ALTER TABLE public.development_tips ADD COLUMN IF NOT EXISTS content_en TEXT;
ALTER TABLE public.development_tips ADD COLUMN IF NOT EXISTS content_ru TEXT;
ALTER TABLE public.development_tips ADD COLUMN IF NOT EXISTS content_tr TEXT;

-- mom_friendly_places
ALTER TABLE public.mom_friendly_places ADD COLUMN IF NOT EXISTS name_en TEXT;
ALTER TABLE public.mom_friendly_places ADD COLUMN IF NOT EXISTS name_ru TEXT;
ALTER TABLE public.mom_friendly_places ADD COLUMN IF NOT EXISTS name_tr TEXT;
ALTER TABLE public.mom_friendly_places ADD COLUMN IF NOT EXISTS description_en TEXT;
ALTER TABLE public.mom_friendly_places ADD COLUMN IF NOT EXISTS description_ru TEXT;
ALTER TABLE public.mom_friendly_places ADD COLUMN IF NOT EXISTS description_tr TEXT;
ALTER TABLE public.mom_friendly_places ADD COLUMN IF NOT EXISTS address_en TEXT;
ALTER TABLE public.mom_friendly_places ADD COLUMN IF NOT EXISTS address_ru TEXT;
ALTER TABLE public.mom_friendly_places ADD COLUMN IF NOT EXISTS address_tr TEXT;

-- play_activities
ALTER TABLE public.play_activities ADD COLUMN IF NOT EXISTS title_en TEXT;
ALTER TABLE public.play_activities ADD COLUMN IF NOT EXISTS title_ru TEXT;
ALTER TABLE public.play_activities ADD COLUMN IF NOT EXISTS title_tr TEXT;
ALTER TABLE public.play_activities ADD COLUMN IF NOT EXISTS description_en TEXT;
ALTER TABLE public.play_activities ADD COLUMN IF NOT EXISTS description_ru TEXT;
ALTER TABLE public.play_activities ADD COLUMN IF NOT EXISTS description_tr TEXT;
ALTER TABLE public.play_activities ADD COLUMN IF NOT EXISTS instructions_en TEXT;
ALTER TABLE public.play_activities ADD COLUMN IF NOT EXISTS instructions_ru TEXT;
ALTER TABLE public.play_activities ADD COLUMN IF NOT EXISTS instructions_tr TEXT;

-- user_play_inventory
ALTER TABLE public.user_play_inventory ADD COLUMN IF NOT EXISTS item_name_en TEXT;
ALTER TABLE public.user_play_inventory ADD COLUMN IF NOT EXISTS item_name_ru TEXT;
ALTER TABLE public.user_play_inventory ADD COLUMN IF NOT EXISTS item_name_tr TEXT;

-- play_inventory_items
ALTER TABLE public.play_inventory_items ADD COLUMN IF NOT EXISTS name_en TEXT;
ALTER TABLE public.play_inventory_items ADD COLUMN IF NOT EXISTS name_ru TEXT;
ALTER TABLE public.play_inventory_items ADD COLUMN IF NOT EXISTS name_tr TEXT;

-- mental_health_resources
ALTER TABLE public.mental_health_resources ADD COLUMN IF NOT EXISTS name_en TEXT;
ALTER TABLE public.mental_health_resources ADD COLUMN IF NOT EXISTS name_ru TEXT;
ALTER TABLE public.mental_health_resources ADD COLUMN IF NOT EXISTS name_tr TEXT;
ALTER TABLE public.mental_health_resources ADD COLUMN IF NOT EXISTS description_en TEXT;
ALTER TABLE public.mental_health_resources ADD COLUMN IF NOT EXISTS description_ru TEXT;
ALTER TABLE public.mental_health_resources ADD COLUMN IF NOT EXISTS description_tr TEXT;
ALTER TABLE public.mental_health_resources ADD COLUMN IF NOT EXISTS address_en TEXT;
ALTER TABLE public.mental_health_resources ADD COLUMN IF NOT EXISTS address_ru TEXT;
ALTER TABLE public.mental_health_resources ADD COLUMN IF NOT EXISTS address_tr TEXT;

-- first_aid_scenarios
ALTER TABLE public.first_aid_scenarios ADD COLUMN IF NOT EXISTS title_en TEXT;
ALTER TABLE public.first_aid_scenarios ADD COLUMN IF NOT EXISTS title_ru TEXT;
ALTER TABLE public.first_aid_scenarios ADD COLUMN IF NOT EXISTS title_tr TEXT;
ALTER TABLE public.first_aid_scenarios ADD COLUMN IF NOT EXISTS description_en TEXT;
ALTER TABLE public.first_aid_scenarios ADD COLUMN IF NOT EXISTS description_ru TEXT;
ALTER TABLE public.first_aid_scenarios ADD COLUMN IF NOT EXISTS description_tr TEXT;

-- first_aid_steps
ALTER TABLE public.first_aid_steps ADD COLUMN IF NOT EXISTS title_en TEXT;
ALTER TABLE public.first_aid_steps ADD COLUMN IF NOT EXISTS title_ru TEXT;
ALTER TABLE public.first_aid_steps ADD COLUMN IF NOT EXISTS title_tr TEXT;
ALTER TABLE public.first_aid_steps ADD COLUMN IF NOT EXISTS instruction_en TEXT;
ALTER TABLE public.first_aid_steps ADD COLUMN IF NOT EXISTS instruction_ru TEXT;
ALTER TABLE public.first_aid_steps ADD COLUMN IF NOT EXISTS instruction_tr TEXT;

-- fairy_tale_themes
ALTER TABLE public.fairy_tale_themes ADD COLUMN IF NOT EXISTS name_en TEXT;
ALTER TABLE public.fairy_tale_themes ADD COLUMN IF NOT EXISTS name_ru TEXT;
ALTER TABLE public.fairy_tale_themes ADD COLUMN IF NOT EXISTS name_tr TEXT;
ALTER TABLE public.fairy_tale_themes ADD COLUMN IF NOT EXISTS description_en TEXT;
ALTER TABLE public.fairy_tale_themes ADD COLUMN IF NOT EXISTS description_ru TEXT;
ALTER TABLE public.fairy_tale_themes ADD COLUMN IF NOT EXISTS description_tr TEXT;

-- zodiac_signs
ALTER TABLE public.zodiac_signs ADD COLUMN IF NOT EXISTS name_en TEXT;
ALTER TABLE public.zodiac_signs ADD COLUMN IF NOT EXISTS name_ru TEXT;
ALTER TABLE public.zodiac_signs ADD COLUMN IF NOT EXISTS name_tr TEXT;
ALTER TABLE public.zodiac_signs ADD COLUMN IF NOT EXISTS characteristics_en TEXT;
ALTER TABLE public.zodiac_signs ADD COLUMN IF NOT EXISTS characteristics_ru TEXT;
ALTER TABLE public.zodiac_signs ADD COLUMN IF NOT EXISTS characteristics_tr TEXT;

-- zodiac_compatibility
ALTER TABLE public.zodiac_compatibility ADD COLUMN IF NOT EXISTS description_en TEXT;
ALTER TABLE public.zodiac_compatibility ADD COLUMN IF NOT EXISTS description_ru TEXT;
ALTER TABLE public.zodiac_compatibility ADD COLUMN IF NOT EXISTS description_tr TEXT;

-- healthcare_providers
ALTER TABLE public.healthcare_providers ADD COLUMN IF NOT EXISTS name_en text;
ALTER TABLE public.healthcare_providers ADD COLUMN IF NOT EXISTS name_ru text;
ALTER TABLE public.healthcare_providers ADD COLUMN IF NOT EXISTS name_tr text;
ALTER TABLE public.healthcare_providers ADD COLUMN IF NOT EXISTS specialty_en text;
ALTER TABLE public.healthcare_providers ADD COLUMN IF NOT EXISTS specialty_ru text;
ALTER TABLE public.healthcare_providers ADD COLUMN IF NOT EXISTS specialty_tr text;
ALTER TABLE public.healthcare_providers ADD COLUMN IF NOT EXISTS description_en text;
ALTER TABLE public.healthcare_providers ADD COLUMN IF NOT EXISTS description_ru text;
ALTER TABLE public.healthcare_providers ADD COLUMN IF NOT EXISTS description_tr text;
ALTER TABLE public.healthcare_providers ADD COLUMN IF NOT EXISTS address_en text;
ALTER TABLE public.healthcare_providers ADD COLUMN IF NOT EXISTS address_ru text;
ALTER TABLE public.healthcare_providers ADD COLUMN IF NOT EXISTS address_tr text;

-- affiliate_products
ALTER TABLE public.affiliate_products ADD COLUMN IF NOT EXISTS name_en text;
ALTER TABLE public.affiliate_products ADD COLUMN IF NOT EXISTS name_ru text;
ALTER TABLE public.affiliate_products ADD COLUMN IF NOT EXISTS name_tr text;
ALTER TABLE public.affiliate_products ADD COLUMN IF NOT EXISTS description_en text;
ALTER TABLE public.affiliate_products ADD COLUMN IF NOT EXISTS description_ru text;
ALTER TABLE public.affiliate_products ADD COLUMN IF NOT EXISTS description_tr text;
ALTER TABLE public.affiliate_products ADD COLUMN IF NOT EXISTS category_en text;
ALTER TABLE public.affiliate_products ADD COLUMN IF NOT EXISTS category_ru text;
ALTER TABLE public.affiliate_products ADD COLUMN IF NOT EXISTS category_tr text;
ALTER TABLE public.affiliate_products ADD COLUMN IF NOT EXISTS review_summary_en text;
ALTER TABLE public.affiliate_products ADD COLUMN IF NOT EXISTS review_summary_ru text;
ALTER TABLE public.affiliate_products ADD COLUMN IF NOT EXISTS review_summary_tr text;

-- legal_documents
ALTER TABLE public.legal_documents ADD COLUMN IF NOT EXISTS title_en TEXT;
ALTER TABLE public.legal_documents ADD COLUMN IF NOT EXISTS title_ru TEXT;
ALTER TABLE public.legal_documents ADD COLUMN IF NOT EXISTS title_tr TEXT;
ALTER TABLE public.legal_documents ADD COLUMN IF NOT EXISTS content_en TEXT;
ALTER TABLE public.legal_documents ADD COLUMN IF NOT EXISTS content_ru TEXT;
ALTER TABLE public.legal_documents ADD COLUMN IF NOT EXISTS content_tr TEXT;

-- flow_phase_tips
ALTER TABLE public.flow_phase_tips ADD COLUMN IF NOT EXISTS tip_text_en TEXT;
ALTER TABLE public.flow_phase_tips ADD COLUMN IF NOT EXISTS tip_text_ru TEXT;
ALTER TABLE public.flow_phase_tips ADD COLUMN IF NOT EXISTS tip_text_tr TEXT;

-- flow_symptoms
ALTER TABLE public.flow_symptoms ADD COLUMN IF NOT EXISTS label_en TEXT;
ALTER TABLE public.flow_symptoms ADD COLUMN IF NOT EXISTS label_ru TEXT;
ALTER TABLE public.flow_symptoms ADD COLUMN IF NOT EXISTS label_tr TEXT;

-- flow_insights
ALTER TABLE public.flow_insights ADD COLUMN IF NOT EXISTS title_en TEXT;
ALTER TABLE public.flow_insights ADD COLUMN IF NOT EXISTS title_ru TEXT;
ALTER TABLE public.flow_insights ADD COLUMN IF NOT EXISTS title_tr TEXT;
ALTER TABLE public.flow_insights ADD COLUMN IF NOT EXISTS content_en TEXT;
ALTER TABLE public.flow_insights ADD COLUMN IF NOT EXISTS content_ru TEXT;
ALTER TABLE public.flow_insights ADD COLUMN IF NOT EXISTS content_tr TEXT;

-- photoshoot_image_styles
ALTER TABLE public.photoshoot_image_styles ADD COLUMN IF NOT EXISTS style_name_en TEXT;
ALTER TABLE public.photoshoot_image_styles ADD COLUMN IF NOT EXISTS style_name_ru TEXT;
ALTER TABLE public.photoshoot_image_styles ADD COLUMN IF NOT EXISTS style_name_tr TEXT;

-- partner_daily_tips
ALTER TABLE public.partner_daily_tips ADD COLUMN IF NOT EXISTS tip_text_en TEXT;
ALTER TABLE public.partner_daily_tips ADD COLUMN IF NOT EXISTS tip_text_ru TEXT;
ALTER TABLE public.partner_daily_tips ADD COLUMN IF NOT EXISTS tip_text_tr TEXT;

-- onboarding_stages
ALTER TABLE public.onboarding_stages ADD COLUMN IF NOT EXISTS title_en TEXT;
ALTER TABLE public.onboarding_stages ADD COLUMN IF NOT EXISTS title_ru TEXT;
ALTER TABLE public.onboarding_stages ADD COLUMN IF NOT EXISTS title_tr TEXT;
ALTER TABLE public.onboarding_stages ADD COLUMN IF NOT EXISTS subtitle_en TEXT;
ALTER TABLE public.onboarding_stages ADD COLUMN IF NOT EXISTS subtitle_ru TEXT;
ALTER TABLE public.onboarding_stages ADD COLUMN IF NOT EXISTS subtitle_tr TEXT;
ALTER TABLE public.onboarding_stages ADD COLUMN IF NOT EXISTS description_en TEXT;
ALTER TABLE public.onboarding_stages ADD COLUMN IF NOT EXISTS description_ru TEXT;
ALTER TABLE public.onboarding_stages ADD COLUMN IF NOT EXISTS description_tr TEXT;

-- multiples_options
ALTER TABLE public.multiples_options ADD COLUMN IF NOT EXISTS label_en TEXT;
ALTER TABLE public.multiples_options ADD COLUMN IF NOT EXISTS label_ru TEXT;
ALTER TABLE public.multiples_options ADD COLUMN IF NOT EXISTS label_tr TEXT;

-- ai_suggested_questions
ALTER TABLE public.ai_suggested_questions ADD COLUMN IF NOT EXISTS question_en text;
ALTER TABLE public.ai_suggested_questions ADD COLUMN IF NOT EXISTS question_ru text;
ALTER TABLE public.ai_suggested_questions ADD COLUMN IF NOT EXISTS question_tr text;

-- faqs
ALTER TABLE public.faqs ADD COLUMN IF NOT EXISTS question_en text;
ALTER TABLE public.faqs ADD COLUMN IF NOT EXISTS question_ru text;
ALTER TABLE public.faqs ADD COLUMN IF NOT EXISTS question_tr text;
ALTER TABLE public.faqs ADD COLUMN IF NOT EXISTS answer_en text;
ALTER TABLE public.faqs ADD COLUMN IF NOT EXISTS answer_ru text;
ALTER TABLE public.faqs ADD COLUMN IF NOT EXISTS answer_tr text;

-- support_categories
ALTER TABLE public.support_categories ADD COLUMN IF NOT EXISTS name_en text;
ALTER TABLE public.support_categories ADD COLUMN IF NOT EXISTS name_ru text;
ALTER TABLE public.support_categories ADD COLUMN IF NOT EXISTS name_tr text;

-- weight_recommendations
ALTER TABLE public.weight_recommendations ADD COLUMN IF NOT EXISTS description_en text;
ALTER TABLE public.weight_recommendations ADD COLUMN IF NOT EXISTS description_ru text;
ALTER TABLE public.weight_recommendations ADD COLUMN IF NOT EXISTS description_tr text;

-- photoshoot_backgrounds
ALTER TABLE public.photoshoot_backgrounds ADD COLUMN IF NOT EXISTS category_name_en text;
ALTER TABLE public.photoshoot_backgrounds ADD COLUMN IF NOT EXISTS category_name_ru text;
ALTER TABLE public.photoshoot_backgrounds ADD COLUMN IF NOT EXISTS category_name_tr text;
ALTER TABLE public.photoshoot_backgrounds ADD COLUMN IF NOT EXISTS theme_name_en text;
ALTER TABLE public.photoshoot_backgrounds ADD COLUMN IF NOT EXISTS theme_name_ru text;
ALTER TABLE public.photoshoot_backgrounds ADD COLUMN IF NOT EXISTS theme_name_tr text;

-- photoshoot_eye_colors
ALTER TABLE public.photoshoot_eye_colors ADD COLUMN IF NOT EXISTS color_name_en text;
ALTER TABLE public.photoshoot_eye_colors ADD COLUMN IF NOT EXISTS color_name_ru text;
ALTER TABLE public.photoshoot_eye_colors ADD COLUMN IF NOT EXISTS color_name_tr text;

-- photoshoot_hair_colors
ALTER TABLE public.photoshoot_hair_colors ADD COLUMN IF NOT EXISTS color_name_en text;
ALTER TABLE public.photoshoot_hair_colors ADD COLUMN IF NOT EXISTS color_name_ru text;
ALTER TABLE public.photoshoot_hair_colors ADD COLUMN IF NOT EXISTS color_name_tr text;

-- photoshoot_hair_styles
ALTER TABLE public.photoshoot_hair_styles ADD COLUMN IF NOT EXISTS style_name_en text;
ALTER TABLE public.photoshoot_hair_styles ADD COLUMN IF NOT EXISTS style_name_ru text;
ALTER TABLE public.photoshoot_hair_styles ADD COLUMN IF NOT EXISTS style_name_tr text;

-- photoshoot_outfits
ALTER TABLE public.photoshoot_outfits ADD COLUMN IF NOT EXISTS outfit_name_en text;
ALTER TABLE public.photoshoot_outfits ADD COLUMN IF NOT EXISTS outfit_name_ru text;
ALTER TABLE public.photoshoot_outfits ADD COLUMN IF NOT EXISTS outfit_name_tr text;

-- safety_categories
ALTER TABLE public.safety_categories ADD COLUMN IF NOT EXISTS name_en text;
ALTER TABLE public.safety_categories ADD COLUMN IF NOT EXISTS name_ru text;
ALTER TABLE public.safety_categories ADD COLUMN IF NOT EXISTS name_tr text;

-- safety_items
ALTER TABLE public.safety_items ADD COLUMN IF NOT EXISTS item_name_en text;
ALTER TABLE public.safety_items ADD COLUMN IF NOT EXISTS item_name_ru text;
ALTER TABLE public.safety_items ADD COLUMN IF NOT EXISTS item_name_tr text;
ALTER TABLE public.safety_items ADD COLUMN IF NOT EXISTS description_en text;
ALTER TABLE public.safety_items ADD COLUMN IF NOT EXISTS description_ru text;
ALTER TABLE public.safety_items ADD COLUMN IF NOT EXISTS description_tr text;
ALTER TABLE public.safety_items ADD COLUMN IF NOT EXISTS name_en text;
ALTER TABLE public.safety_items ADD COLUMN IF NOT EXISTS name_ru text;
ALTER TABLE public.safety_items ADD COLUMN IF NOT EXISTS name_tr text;
ALTER TABLE public.safety_items ADD COLUMN IF NOT EXISTS description_en text;
ALTER TABLE public.safety_items ADD COLUMN IF NOT EXISTS description_ru text;
ALTER TABLE public.safety_items ADD COLUMN IF NOT EXISTS description_tr text;

-- shop_categories
ALTER TABLE public.shop_categories ADD COLUMN IF NOT EXISTS name_en text;
ALTER TABLE public.shop_categories ADD COLUMN IF NOT EXISTS name_ru text;
ALTER TABLE public.shop_categories ADD COLUMN IF NOT EXISTS name_tr text;
ALTER TABLE public.shop_categories ADD COLUMN IF NOT EXISTS name_en TEXT;
ALTER TABLE public.shop_categories ADD COLUMN IF NOT EXISTS name_ru TEXT;
ALTER TABLE public.shop_categories ADD COLUMN IF NOT EXISTS name_tr TEXT;

-- nutrition_targets
ALTER TABLE public.nutrition_targets ADD COLUMN IF NOT EXISTS description_en text;
ALTER TABLE public.nutrition_targets ADD COLUMN IF NOT EXISTS description_ru text;
ALTER TABLE public.nutrition_targets ADD COLUMN IF NOT EXISTS description_tr text;

-- meal_types
ALTER TABLE public.meal_types ADD COLUMN IF NOT EXISTS name_en text;
ALTER TABLE public.meal_types ADD COLUMN IF NOT EXISTS name_ru text;
ALTER TABLE public.meal_types ADD COLUMN IF NOT EXISTS name_tr text;

-- recipe_categories
ALTER TABLE public.recipe_categories ADD COLUMN IF NOT EXISTS name_en text;
ALTER TABLE public.recipe_categories ADD COLUMN IF NOT EXISTS name_ru text;
ALTER TABLE public.recipe_categories ADD COLUMN IF NOT EXISTS name_tr text;

-- exercises
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS name_en TEXT;
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS name_ru TEXT;
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS name_tr TEXT;

-- photoshoot_themes
ALTER TABLE public.photoshoot_themes ADD COLUMN IF NOT EXISTS name_en TEXT;
ALTER TABLE public.photoshoot_themes ADD COLUMN IF NOT EXISTS name_ru TEXT;
ALTER TABLE public.photoshoot_themes ADD COLUMN IF NOT EXISTS name_tr TEXT;

-- baby_milestones_db
ALTER TABLE public.baby_milestones_db ADD COLUMN IF NOT EXISTS label_en TEXT;
ALTER TABLE public.baby_milestones_db ADD COLUMN IF NOT EXISTS label_ru TEXT;
ALTER TABLE public.baby_milestones_db ADD COLUMN IF NOT EXISTS label_tr TEXT;
ALTER TABLE public.baby_milestones_db ADD COLUMN IF NOT EXISTS description_en TEXT;
ALTER TABLE public.baby_milestones_db ADD COLUMN IF NOT EXISTS description_ru TEXT;
ALTER TABLE public.baby_milestones_db ADD COLUMN IF NOT EXISTS description_tr TEXT;

-- symptoms
ALTER TABLE public.symptoms ADD COLUMN IF NOT EXISTS label_en TEXT;
ALTER TABLE public.symptoms ADD COLUMN IF NOT EXISTS label_ru TEXT;
ALTER TABLE public.symptoms ADD COLUMN IF NOT EXISTS label_tr TEXT;

-- mood_options
ALTER TABLE public.mood_options ADD COLUMN IF NOT EXISTS label_en TEXT;
ALTER TABLE public.mood_options ADD COLUMN IF NOT EXISTS label_ru TEXT;
ALTER TABLE public.mood_options ADD COLUMN IF NOT EXISTS label_tr TEXT;

-- common_foods
ALTER TABLE public.common_foods ADD COLUMN IF NOT EXISTS name_en TEXT;
ALTER TABLE public.common_foods ADD COLUMN IF NOT EXISTS name_ru TEXT;
ALTER TABLE public.common_foods ADD COLUMN IF NOT EXISTS name_tr TEXT;

-- vitamins
ALTER TABLE public.vitamins ADD COLUMN IF NOT EXISTS name_en TEXT;
ALTER TABLE public.vitamins ADD COLUMN IF NOT EXISTS name_ru TEXT;
ALTER TABLE public.vitamins ADD COLUMN IF NOT EXISTS name_tr TEXT;
ALTER TABLE public.vitamins ADD COLUMN IF NOT EXISTS description_en TEXT;
ALTER TABLE public.vitamins ADD COLUMN IF NOT EXISTS description_ru TEXT;
ALTER TABLE public.vitamins ADD COLUMN IF NOT EXISTS description_tr TEXT;

-- fruit_size_images
ALTER TABLE public.fruit_size_images ADD COLUMN IF NOT EXISTS fruit_name_en TEXT;
ALTER TABLE public.fruit_size_images ADD COLUMN IF NOT EXISTS fruit_name_ru TEXT;
ALTER TABLE public.fruit_size_images ADD COLUMN IF NOT EXISTS fruit_name_tr TEXT;

-- baby_names_db
ALTER TABLE public.baby_names_db ADD COLUMN IF NOT EXISTS meaning_en text;
ALTER TABLE public.baby_names_db ADD COLUMN IF NOT EXISTS meaning_ru text;
ALTER TABLE public.baby_names_db ADD COLUMN IF NOT EXISTS meaning_tr text;