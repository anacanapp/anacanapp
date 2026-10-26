-- Create fruit_size_images table for storing custom images for each pregnancy week's fruit comparison
CREATE TABLE public.fruit_size_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  week_number INTEGER NOT NULL UNIQUE,
  fruit_name TEXT NOT NULL,
  fruit_name_az TEXT,
  emoji TEXT NOT NULL DEFAULT '🍎',
  image_url TEXT,
  length_cm NUMERIC(5,2) DEFAULT 0,
  weight_g NUMERIC(7,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.fruit_size_images ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read fruit images (public data)
CREATE POLICY "Anyone can view fruit size images" 
ON public.fruit_size_images 
FOR SELECT 
USING (true);

-- Only admins can modify fruit images
CREATE POLICY "Admins can manage fruit size images" 
ON public.fruit_size_images 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Create storage bucket for assets if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('assets', 'assets', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for assets bucket
CREATE POLICY "Anyone can view assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'assets');

CREATE POLICY "Admins can upload assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'assets' AND
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Admins can update assets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'assets' AND
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Admins can delete assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'assets' AND
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Add update trigger for updated_at
CREATE TRIGGER update_fruit_size_images_updated_at
BEFORE UPDATE ON public.fruit_size_images
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();