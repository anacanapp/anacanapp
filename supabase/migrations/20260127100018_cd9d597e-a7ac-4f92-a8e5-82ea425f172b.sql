-- 1. Add more columns to affiliate_products for enhanced functionality
ALTER TABLE public.affiliate_products
ADD COLUMN IF NOT EXISTS images text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS video_url text,
ADD COLUMN IF NOT EXISTS store_name text,
ADD COLUMN IF NOT EXISTS store_logo_url text,
ADD COLUMN IF NOT EXISTS price_updated_at timestamp with time zone DEFAULT now(),
ADD COLUMN IF NOT EXISTS specifications jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS pros text[],
ADD COLUMN IF NOT EXISTS cons text[],
ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- 2. Create saved affiliate products table for user favorites
CREATE TABLE public.saved_affiliate_products (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.affiliate_products(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, product_id)
);

-- Enable RLS
ALTER TABLE public.saved_affiliate_products ENABLE ROW LEVEL SECURITY;

-- Users can manage their own saved products
CREATE POLICY "Users can view their saved products"
ON public.saved_affiliate_products FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can save products"
ON public.saved_affiliate_products FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unsave products"
ON public.saved_affiliate_products FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Update existing products with price_updated_at
UPDATE public.affiliate_products SET price_updated_at = now() WHERE price_updated_at IS NULL;