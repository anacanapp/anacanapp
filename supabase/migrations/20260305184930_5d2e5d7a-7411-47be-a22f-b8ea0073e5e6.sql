CREATE POLICY "Users can upload to baby-album"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'baby-album'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view own baby-album photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'baby-album'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own baby-album photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'baby-album'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update own baby-album photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'baby-album'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);