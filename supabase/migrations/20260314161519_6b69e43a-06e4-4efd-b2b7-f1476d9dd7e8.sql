
-- Create function to update story view_count when a new view is inserted
CREATE OR REPLACE FUNCTION public.update_story_view_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.community_stories
  SET view_count = (
    SELECT COUNT(*) FROM public.story_views WHERE story_id = NEW.story_id
  )
  WHERE id = NEW.story_id;
  RETURN NEW;
END;
$$;

-- Create trigger on story_views
CREATE TRIGGER on_story_view_insert
  AFTER INSERT ON public.story_views
  FOR EACH ROW
  EXECUTE FUNCTION public.update_story_view_count();
