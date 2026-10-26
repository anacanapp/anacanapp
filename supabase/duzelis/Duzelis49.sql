-- Duzelis49.sql — Community Stories: Cavab (reply) funksionallığı
-- post_comments/update_post_comments_count() ilə EYNİ nümunə üzrə (story_id əvəzinə,
-- v1 üçün sadələşdirilib: parent_comment_id/şəkil/anonim yoxdur — sadə düz siyahı).

-- ─────────────────────────────────────────────────────────────
-- 1. community_stories.replies_count sütunu
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.community_stories
  ADD COLUMN IF NOT EXISTS replies_count integer NOT NULL DEFAULT 0;

-- ─────────────────────────────────────────────────────────────
-- 2. story_replies cədvəli
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.story_replies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id UUID NOT NULL REFERENCES public.community_stories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.story_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view story replies" ON public.story_replies;
CREATE POLICY "Authenticated can view story replies"
ON public.story_replies FOR SELECT
TO authenticated
USING (is_active = true);

DROP POLICY IF EXISTS "Users can create story replies" ON public.story_replies;
CREATE POLICY "Users can create story replies"
ON public.story_replies FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own story replies" ON public.story_replies;
CREATE POLICY "Users can delete own story replies"
ON public.story_replies FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage all story replies" ON public.story_replies;
CREATE POLICY "Admins can manage all story replies"
ON public.story_replies FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_story_replies_story ON public.story_replies(story_id);
CREATE INDEX IF NOT EXISTS idx_story_replies_user ON public.story_replies(user_id);

-- ─────────────────────────────────────────────────────────────
-- 3. replies_count-u avtomatik sinxron saxlayan trigger (update_post_comments_count() ilə eyni nümunə)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_story_replies_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.community_stories
    SET replies_count = replies_count + 1
    WHERE id = NEW.story_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.community_stories
    SET replies_count = replies_count - 1
    WHERE id = OLD.story_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_story_reply_change ON public.story_replies;
CREATE TRIGGER on_story_reply_change
AFTER INSERT OR DELETE ON public.story_replies
FOR EACH ROW EXECUTE FUNCTION public.update_story_replies_count();

-- ─────────────────────────────────────────────────────────────
-- 4. Realtime (post_comments ilə eyni — story açıq olarkən başqasının cavabı canlı görünsün)
-- ─────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'story_replies'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.story_replies;
  END IF;
END $$;
