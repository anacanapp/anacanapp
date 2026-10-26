ALTER TABLE public.baby_photos 
ADD COLUMN IF NOT EXISTS source_image_path text,
ADD COLUMN IF NOT EXISTS customization jsonb DEFAULT '{}';
