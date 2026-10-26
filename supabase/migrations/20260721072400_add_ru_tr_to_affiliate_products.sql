-- Add missing translations for affiliate_products
ALTER TABLE public.affiliate_products ADD COLUMN IF NOT EXISTS name_en TEXT;
ALTER TABLE public.affiliate_products ADD COLUMN IF NOT EXISTS name_ru TEXT;
ALTER TABLE public.affiliate_products ADD COLUMN IF NOT EXISTS name_tr TEXT;

ALTER TABLE public.affiliate_products ADD COLUMN IF NOT EXISTS description_en TEXT;
ALTER TABLE public.affiliate_products ADD COLUMN IF NOT EXISTS description_ru TEXT;
ALTER TABLE public.affiliate_products ADD COLUMN IF NOT EXISTS description_tr TEXT;

ALTER TABLE public.affiliate_products ADD COLUMN IF NOT EXISTS review_summary_en TEXT;
ALTER TABLE public.affiliate_products ADD COLUMN IF NOT EXISTS review_summary_ru TEXT;
ALTER TABLE public.affiliate_products ADD COLUMN IF NOT EXISTS review_summary_tr TEXT;
