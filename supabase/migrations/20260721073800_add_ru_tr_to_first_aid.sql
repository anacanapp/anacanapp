-- Add missing translations for first aid
ALTER TABLE public.first_aid_scenarios ADD COLUMN IF NOT EXISTS title_en TEXT;
ALTER TABLE public.first_aid_scenarios ADD COLUMN IF NOT EXISTS title_ru TEXT;
ALTER TABLE public.first_aid_scenarios ADD COLUMN IF NOT EXISTS title_tr TEXT;

ALTER TABLE public.first_aid_scenarios ADD COLUMN IF NOT EXISTS description_en TEXT;
ALTER TABLE public.first_aid_scenarios ADD COLUMN IF NOT EXISTS description_ru TEXT;
ALTER TABLE public.first_aid_scenarios ADD COLUMN IF NOT EXISTS description_tr TEXT;

ALTER TABLE public.first_aid_steps ADD COLUMN IF NOT EXISTS title_en TEXT;
ALTER TABLE public.first_aid_steps ADD COLUMN IF NOT EXISTS title_ru TEXT;
ALTER TABLE public.first_aid_steps ADD COLUMN IF NOT EXISTS title_tr TEXT;

ALTER TABLE public.first_aid_steps ADD COLUMN IF NOT EXISTS instruction_en TEXT;
ALTER TABLE public.first_aid_steps ADD COLUMN IF NOT EXISTS instruction_ru TEXT;
ALTER TABLE public.first_aid_steps ADD COLUMN IF NOT EXISTS instruction_tr TEXT;
