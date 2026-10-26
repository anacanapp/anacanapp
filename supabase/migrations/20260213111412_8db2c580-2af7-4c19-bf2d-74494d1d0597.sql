
-- Add meal_types array column to common_foods
-- This allows filtering foods by meal type (breakfast, lunch, dinner, snack)
-- Default to all meals for existing foods
ALTER TABLE public.common_foods 
ADD COLUMN meal_types text[] DEFAULT ARRAY['breakfast', 'lunch', 'dinner', 'snack']::text[];
