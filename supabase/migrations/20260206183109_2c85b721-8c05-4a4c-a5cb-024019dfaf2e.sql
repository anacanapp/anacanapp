-- Create blog_post_categories junction table for many-to-many relationship
CREATE TABLE IF NOT EXISTS public.blog_post_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.blog_categories(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(post_id, category_id)
);

-- Enable RLS
ALTER TABLE public.blog_post_categories ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access (blog categories are public)
CREATE POLICY "Blog post categories are viewable by everyone"
ON public.blog_post_categories
FOR SELECT
USING (true);

-- Create policy for authenticated users to manage (admin logic handled in app)
CREATE POLICY "Authenticated users can manage blog post categories"
ON public.blog_post_categories
FOR ALL
USING (auth.uid() IS NOT NULL);

-- Create index for faster lookups
CREATE INDEX idx_blog_post_categories_post_id ON public.blog_post_categories(post_id);
CREATE INDEX idx_blog_post_categories_category_id ON public.blog_post_categories(category_id);

-- Migrate existing category data to the junction table
INSERT INTO public.blog_post_categories (post_id, category_id)
SELECT 
  bp.id as post_id,
  bc.id as category_id
FROM public.blog_posts bp
JOIN public.blog_categories bc ON bc.slug = bp.category
WHERE bp.category IS NOT NULL AND bp.category != ''
ON CONFLICT (post_id, category_id) DO NOTHING;