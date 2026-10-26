-- Add missing translations for blog_posts
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS title_az TEXT;
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS title_ru TEXT;
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS title_tr TEXT;

ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS excerpt_az TEXT;
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS excerpt_ru TEXT;
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS excerpt_tr TEXT;

ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS content_az TEXT;
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS content_ru TEXT;
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS content_tr TEXT;
