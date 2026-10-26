-- Add missing translations for flow_symptoms_db
ALTER TABLE public.flow_symptoms_db ADD COLUMN IF NOT EXISTS label_en TEXT;
ALTER TABLE public.flow_symptoms_db ADD COLUMN IF NOT EXISTS label_ru TEXT;
ALTER TABLE public.flow_symptoms_db ADD COLUMN IF NOT EXISTS label_tr TEXT;

-- Add missing translations for menstruation_phase_tips
ALTER TABLE public.menstruation_phase_tips ADD COLUMN IF NOT EXISTS title_ru TEXT;
ALTER TABLE public.menstruation_phase_tips ADD COLUMN IF NOT EXISTS title_tr TEXT;
ALTER TABLE public.menstruation_phase_tips ADD COLUMN IF NOT EXISTS content_ru TEXT;
ALTER TABLE public.menstruation_phase_tips ADD COLUMN IF NOT EXISTS content_tr TEXT;

-- Add missing translations for flow_insights
ALTER TABLE public.flow_insights ADD COLUMN IF NOT EXISTS title_ru TEXT;
ALTER TABLE public.flow_insights ADD COLUMN IF NOT EXISTS title_tr TEXT;
ALTER TABLE public.flow_insights ADD COLUMN IF NOT EXISTS content_ru TEXT;
ALTER TABLE public.flow_insights ADD COLUMN IF NOT EXISTS content_tr TEXT;
