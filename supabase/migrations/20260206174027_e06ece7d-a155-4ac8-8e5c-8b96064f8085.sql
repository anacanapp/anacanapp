-- Add priority and notes columns to hospital_bag_templates
ALTER TABLE public.hospital_bag_templates 
ADD COLUMN IF NOT EXISTS priority integer DEFAULT 2,
ADD COLUMN IF NOT EXISTS notes text;

-- Add priority and notes to user's hospital_bag_items 
ALTER TABLE public.hospital_bag_items
ADD COLUMN IF NOT EXISTS priority integer DEFAULT 2,
ADD COLUMN IF NOT EXISTS notes text;

COMMENT ON COLUMN public.hospital_bag_templates.priority IS '1=yüksək, 2=orta, 3=aşağı';
COMMENT ON COLUMN public.hospital_bag_templates.notes IS 'Qısa açıqlama/məlumat';
COMMENT ON COLUMN public.hospital_bag_items.priority IS '1=yüksək, 2=orta, 3=aşağı';
COMMENT ON COLUMN public.hospital_bag_items.notes IS 'Qısa açıqlama/məlumat';