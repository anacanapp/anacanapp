
-- Fix 1: Restrict payment_methods public read - remove sensitive config column from public access
DROP POLICY IF EXISTS "Anyone can read active payment methods" ON public.payment_methods;

-- Create a safe view exposing only non-sensitive columns for public reads
CREATE OR REPLACE VIEW public.payment_methods_public AS
SELECT id, method_key, label, label_az, description, description_az, icon, is_active, sort_order, created_at, updated_at
FROM public.payment_methods
WHERE is_active = true;

GRANT SELECT ON public.payment_methods_public TO anon, authenticated;

-- Fix 2: Restrict blog_post_categories management to admins only
DROP POLICY IF EXISTS "Authenticated users can manage blog post categories" ON public.blog_post_categories;

CREATE POLICY "Admins can manage blog post categories"
ON public.blog_post_categories
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
