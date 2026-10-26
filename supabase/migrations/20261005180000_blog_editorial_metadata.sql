-- Reviewed public editorial fields; Source/Google deployment enrolls the changed
-- blog_posts relation in its existing CDC and writer-guard catalog atomically.
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS editorial_metadata jsonb;

COMMENT ON COLUMN public.blog_posts.editorial_metadata IS
  'anacan-blog-editorial-v1: localized SEO, accessible cover alt, FAQ, module links and source provenance';
