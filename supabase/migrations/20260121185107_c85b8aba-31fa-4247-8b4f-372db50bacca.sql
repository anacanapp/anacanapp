-- Create storage bucket for baby photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('baby-photos', 'baby-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their own photos
CREATE POLICY "Users can upload their own baby photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'baby-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to view their own photos
CREATE POLICY "Users can view their own baby photos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'baby-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own photos
CREATE POLICY "Users can delete their own baby photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'baby-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Create table to track generated photos
CREATE TABLE public.baby_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  storage_path TEXT NOT NULL,
  prompt TEXT NOT NULL,
  background_theme TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.baby_photos ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own baby photos"
ON public.baby_photos FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own baby photos"
ON public.baby_photos FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own baby photos"
ON public.baby_photos FOR DELETE
USING (auth.uid() = user_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.baby_photos;