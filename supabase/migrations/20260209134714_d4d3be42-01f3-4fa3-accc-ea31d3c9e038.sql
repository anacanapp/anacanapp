
-- Add custom fields configuration to cakes table
ALTER TABLE public.cakes ADD COLUMN IF NOT EXISTS has_custom_fields boolean DEFAULT false;
ALTER TABLE public.cakes ADD COLUMN IF NOT EXISTS custom_field_labels jsonb DEFAULT '[]'::jsonb;
