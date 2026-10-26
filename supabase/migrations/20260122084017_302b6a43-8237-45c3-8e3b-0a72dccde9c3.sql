-- Add notification preferences columns to user_preferences
ALTER TABLE public.user_preferences 
ADD COLUMN IF NOT EXISTS push_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS push_messages boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS push_likes boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS push_comments boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS push_community boolean DEFAULT true;

-- Create community_stories table for 24-hour stories
CREATE TABLE IF NOT EXISTS public.community_stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  group_id uuid REFERENCES public.community_groups(id) ON DELETE CASCADE,
  media_url text NOT NULL,
  media_type text NOT NULL DEFAULT 'image',
  text_overlay text,
  background_color text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '24 hours'),
  view_count integer DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.community_stories ENABLE ROW LEVEL SECURITY;

-- Story views tracking
CREATE TABLE IF NOT EXISTS public.story_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES public.community_stories(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  viewed_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(story_id, user_id)
);

ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;

-- RLS policies for stories
CREATE POLICY "Users can create own stories" ON public.community_stories
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view active stories" ON public.community_stories
FOR SELECT USING (expires_at > now());

CREATE POLICY "Users can delete own stories" ON public.community_stories
FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for story views
CREATE POLICY "Users can mark stories as viewed" ON public.story_views
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Story owners can see views" ON public.story_views
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.community_stories s 
    WHERE s.id = story_id AND s.user_id = auth.uid()
  )
);

CREATE POLICY "Users can see own views" ON public.story_views
FOR SELECT USING (auth.uid() = user_id);

-- Enable realtime for stories
ALTER PUBLICATION supabase_realtime ADD TABLE public.community_stories;