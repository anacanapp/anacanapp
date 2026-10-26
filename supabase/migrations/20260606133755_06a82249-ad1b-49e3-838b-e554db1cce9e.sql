CREATE TABLE public.community_post_reads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, post_id)
);
GRANT SELECT, INSERT, DELETE ON public.community_post_reads TO authenticated;
GRANT ALL ON public.community_post_reads TO service_role;
ALTER TABLE public.community_post_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own community post reads"
ON public.community_post_reads
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
CREATE POLICY "Users can create own community post reads"
ON public.community_post_reads
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own community post reads"
ON public.community_post_reads
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
CREATE INDEX idx_community_post_reads_user_id ON public.community_post_reads(user_id);
CREATE INDEX idx_community_post_reads_post_id ON public.community_post_reads(post_id);
CREATE INDEX idx_community_post_reads_seen_at ON public.community_post_reads(seen_at DESC);