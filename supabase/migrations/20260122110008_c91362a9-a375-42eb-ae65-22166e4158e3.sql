-- Add storage policy for avatars folder in community-media bucket
CREATE POLICY "Users can upload avatars"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'community-media' 
  AND (storage.foldername(name))[1] = 'avatars'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can update own avatars"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'community-media'
  AND (storage.foldername(name))[1] = 'avatars'
  AND auth.uid() IS NOT NULL
);