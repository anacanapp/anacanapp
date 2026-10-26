
-- Add English (_en) columns for AZ-displayed admin content that's missing translations

-- pregnancy_daily_content
ALTER TABLE public.pregnancy_daily_content
  ADD COLUMN IF NOT EXISTS doctor_visit_tip_en text,
  ADD COLUMN IF NOT EXISTS emotional_tip_en text,
  ADD COLUMN IF NOT EXISTS partner_tip_en text,
  ADD COLUMN IF NOT EXISTS foods_to_avoid_en text[],
  ADD COLUMN IF NOT EXISTS mother_symptoms_en text[],
  ADD COLUMN IF NOT EXISTS recommended_exercises_en text[],
  ADD COLUMN IF NOT EXISTS recommended_foods_en text[],
  ADD COLUMN IF NOT EXISTS tests_to_do_en text[];

-- tool_configs
ALTER TABLE public.tool_configs
  ADD COLUMN IF NOT EXISTS hero_badge_en text,
  ADD COLUMN IF NOT EXISTS hero_subtitle_en text;

-- vitamins
ALTER TABLE public.vitamins
  ADD COLUMN IF NOT EXISTS dosage_en text,
  ADD COLUMN IF NOT EXISTS importance_en text,
  ADD COLUMN IF NOT EXISTS benefits_en text[],
  ADD COLUMN IF NOT EXISTS food_sources_en text[];

-- exercises
ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS description_en text;

-- affiliate_products
ALTER TABLE public.affiliate_products
  ADD COLUMN IF NOT EXISTS store_name_en text,
  ADD COLUMN IF NOT EXISTS pros_en text[],
  ADD COLUMN IF NOT EXISTS cons_en text[];

-- hospital_bag_templates
ALTER TABLE public.hospital_bag_templates
  ADD COLUMN IF NOT EXISTS notes_en text;

-- baby_names_db
ALTER TABLE public.baby_names_db
  ADD COLUMN IF NOT EXISTS origin_en text;

-- partner_venues
ALTER TABLE public.partner_venues
  ADD COLUMN IF NOT EXISTS name_en text,
  ADD COLUMN IF NOT EXISTS description_en text,
  ADD COLUMN IF NOT EXISTS address_en text,
  ADD COLUMN IF NOT EXISTS city_en text,
  ADD COLUMN IF NOT EXISTS district_en text,
  ADD COLUMN IF NOT EXISTS discount_label_en text,
  ADD COLUMN IF NOT EXISTS discount_terms_en text;

-- products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS name_en text,
  ADD COLUMN IF NOT EXISTS description_en text,
  ADD COLUMN IF NOT EXISTS category_en text;

-- coupons (admin description shown to user)
ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS description_en text;

-- community_groups (admin-created group names/descriptions shown to user)
ALTER TABLE public.community_groups
  ADD COLUMN IF NOT EXISTS name_en text,
  ADD COLUMN IF NOT EXISTS description_en text;

-- partner_surprises (admin-curated catalog of surprise titles)
ALTER TABLE public.partner_surprises
  ADD COLUMN IF NOT EXISTS surprise_title_en text;

-- weekly_tips already has _en cols, but verify trimester_tips/info — they were already in trans_tables.

-- safety_items.notes (admin notes shown in safety guides)
ALTER TABLE public.safety_items
  ADD COLUMN IF NOT EXISTS notes_en text;

-- teething_symptoms.severity is enum-ish but displayed; add _en label
ALTER TABLE public.teething_symptoms
  ADD COLUMN IF NOT EXISTS severity_en text;

-- surprise_ideas.difficulty (displayed label)
ALTER TABLE public.surprise_ideas
  ADD COLUMN IF NOT EXISTS difficulty_en text;
