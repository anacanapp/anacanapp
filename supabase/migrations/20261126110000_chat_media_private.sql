-- ============================================================
-- Audit-2 finding #1 (HIGH): make the chat-media storage bucket private
-- ------------------------------------------------------------
-- chat-media holds direct-message and AI-chat photos/voice notes. It was left
-- public=true, so getPublicUrl() objects are world-readable and brute-forceable
-- via low-entropy paths (user_id/<timestamp>.<ext>). baby-photos / baby-album /
-- pregnancy-album were already flipped to private in migration 20260514094740;
-- chat-media was missed. This migration flips the bucket to private and confirms
-- the owner-scoped storage.objects policies (SELECT/INSERT/UPDATE/DELETE) so each
-- user can only reach objects under their own user-id folder, mirroring the
-- baby-album policy set (migration 20260305184930). The app reaches these objects
-- through createSignedUrl at render time after this change.
--
-- Idempotent: safe to re-run (UPDATE is set-based; policies are dropped IF EXISTS
-- before CREATE). Deploy ORDER: ship the web signed-URL code first (or at the same
-- time) — once the bucket is private, existing public URLs 404.
--
-- CDC/writer guarding: NOT required. This migration creates no new app relation.
-- storage.buckets / storage.objects are Supabase-managed system relations and the
-- change here is a bucket flag plus RLS policies (no new table/view/materialized
-- relation), so no app CDC trigger set or <migration>.cdc.json is added.
-- ============================================================

-- 1. Flip the bucket to private (the actual fix).
UPDATE storage.buckets
SET public = false
WHERE id = 'chat-media';

-- 2. Confirm/add the owner-scoped policies (folder[1] = auth.uid()).
--    Drop the legacy fully-public SELECT policy if it is still around.
DROP POLICY IF EXISTS "Chat media is publicly accessible" ON storage.objects;

DROP POLICY IF EXISTS "Users can view their own chat media" ON storage.objects;
CREATE POLICY "Users can view their own chat media"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-media'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can upload chat media" ON storage.objects;
CREATE POLICY "Users can upload chat media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-media'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can update their own chat media" ON storage.objects;
CREATE POLICY "Users can update their own chat media"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'chat-media'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can delete their own chat media" ON storage.objects;
CREATE POLICY "Users can delete their own chat media"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'chat-media'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);
