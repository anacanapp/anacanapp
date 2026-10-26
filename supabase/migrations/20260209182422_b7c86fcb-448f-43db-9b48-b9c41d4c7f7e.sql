
-- Add noise_type and description columns to white_noise_sounds
ALTER TABLE public.white_noise_sounds 
ADD COLUMN IF NOT EXISTS noise_type TEXT DEFAULT 'white',
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS description_az TEXT;
