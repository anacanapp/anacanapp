-- Duzelis48.sql — Community Stories: Like funksionallığı
-- post_likes/update_post_likes_count() ilə EYNİ nümunə üzrə qurulub (story_id əvəzinə).

-- ─────────────────────────────────────────────────────────────
-- 1. community_stories.likes_count sütunu
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.community_stories
  ADD COLUMN IF NOT EXISTS likes_count integer NOT NULL DEFAULT 0;

-- ─────────────────────────────────────────────────────────────
-- 2. story_likes cədvəli (post_likes ilə eyni struktur)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.story_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id UUID NOT NULL REFERENCES public.community_stories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(story_id, user_id)
);

ALTER TABLE public.story_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view story likes" ON public.story_likes;
CREATE POLICY "Authenticated can view story likes"
ON public.story_likes FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Users can like stories" ON public.story_likes;
CREATE POLICY "Users can like stories"
ON public.story_likes FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can unlike stories" ON public.story_likes;
CREATE POLICY "Users can unlike stories"
ON public.story_likes FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_story_likes_story ON public.story_likes(story_id);
CREATE INDEX IF NOT EXISTS idx_story_likes_user ON public.story_likes(user_id);

-- ─────────────────────────────────────────────────────────────
-- 3. likes_count-u avtomatik sinxron saxlayan trigger (update_post_likes_count() ilə eyni nümunə)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_story_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.community_stories
    SET likes_count = likes_count + 1
    WHERE id = NEW.story_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.community_stories
    SET likes_count = likes_count - 1
    WHERE id = OLD.story_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_story_like_change ON public.story_likes;
CREATE TRIGGER on_story_like_change
AFTER INSERT OR DELETE ON public.story_likes
FOR EACH ROW EXECUTE FUNCTION public.update_story_likes_count();
