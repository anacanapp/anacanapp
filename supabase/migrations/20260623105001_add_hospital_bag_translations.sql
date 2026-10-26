-- Migration: Add translation fields to hospital_bag_items and hospital_bag_templates
-- Description: Adds item_name_en, item_name_az, notes_en, notes_az to hospital_bag_items. Adds notes_en, notes_az to hospital_bag_templates.

-- 1. Add fields to hospital_bag_templates
ALTER TABLE public.hospital_bag_templates
ADD COLUMN IF NOT EXISTS notes_az TEXT,
ADD COLUMN IF NOT EXISTS notes_en TEXT;

-- 2. Add fields to hospital_bag_items
ALTER TABLE public.hospital_bag_items
ADD COLUMN IF NOT EXISTS item_name_az TEXT,
ADD COLUMN IF NOT EXISTS item_name_en TEXT,
ADD COLUMN IF NOT EXISTS notes_az TEXT,
ADD COLUMN IF NOT EXISTS notes_en TEXT;
