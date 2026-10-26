-- Add birth-related fields to profiles table for transition from bump to mommy mode
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS birth_weight_kg numeric,
ADD COLUMN IF NOT EXISTS birth_height_cm numeric,
ADD COLUMN IF NOT EXISTS delivery_type text;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.birth_weight_kg IS 'Baby birth weight in kilograms';
COMMENT ON COLUMN public.profiles.birth_height_cm IS 'Baby birth height in centimeters';
COMMENT ON COLUMN public.profiles.delivery_type IS 'Type of delivery: natural, cesarean, assisted';