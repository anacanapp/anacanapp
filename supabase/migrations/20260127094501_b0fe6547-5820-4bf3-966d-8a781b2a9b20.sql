-- 1. Doctors and Hospitals table
CREATE TABLE public.healthcare_providers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  name_az text,
  provider_type text NOT NULL DEFAULT 'hospital', -- hospital, clinic, doctor
  specialty text, -- e.g., OB-GYN, Pediatrics
  specialty_az text,
  description text,
  description_az text,
  address text,
  address_az text,
  city text DEFAULT 'Bakı',
  phone text,
  email text,
  website text,
  working_hours jsonb, -- {"monday": "09:00-18:00", "tuesday": "09:00-18:00"}
  services jsonb, -- [{"name": "Ultrasound", "name_az": "Ultrases", "price": 50}]
  image_url text,
  rating numeric(2,1) DEFAULT 0,
  review_count integer DEFAULT 0,
  latitude numeric(10,7),
  longitude numeric(10,7),
  is_featured boolean DEFAULT false,
  is_active boolean DEFAULT true,
  accepts_reservations boolean DEFAULT false, -- For future use
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.healthcare_providers ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Healthcare providers are viewable by everyone"
ON public.healthcare_providers FOR SELECT
USING (is_active = true);

-- Admin management
CREATE POLICY "Admins can manage healthcare providers"
ON public.healthcare_providers FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 2. Blood Sugar Tracking table
CREATE TABLE public.blood_sugar_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  reading_value numeric(5,1) NOT NULL, -- mg/dL
  reading_type text NOT NULL DEFAULT 'random', -- fasting, before_meal, after_meal, bedtime, random
  meal_context text, -- breakfast, lunch, dinner, snack
  notes text,
  logged_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.blood_sugar_logs ENABLE ROW LEVEL SECURITY;

-- Users can manage their own logs
CREATE POLICY "Users can view their own blood sugar logs"
ON public.blood_sugar_logs FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own blood sugar logs"
ON public.blood_sugar_logs FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own blood sugar logs"
ON public.blood_sugar_logs FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own blood sugar logs"
ON public.blood_sugar_logs FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 3. Pregnancy Album table
CREATE TABLE public.pregnancy_album_photos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  week_number integer NOT NULL CHECK (week_number >= 1 AND week_number <= 42),
  month_number integer NOT NULL CHECK (month_number >= 1 AND month_number <= 10),
  photo_url text NOT NULL,
  caption text,
  photo_date date DEFAULT CURRENT_DATE,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pregnancy_album_photos ENABLE ROW LEVEL SECURITY;

-- Users can manage their own photos
CREATE POLICY "Users can view their own album photos"
ON public.pregnancy_album_photos FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own album photos"
ON public.pregnancy_album_photos FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own album photos"
ON public.pregnancy_album_photos FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own album photos"
ON public.pregnancy_album_photos FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 4. Affiliate Products table
CREATE TABLE public.affiliate_products (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  name_az text,
  description text,
  description_az text,
  category text DEFAULT 'general', -- baby_gear, maternity, health, etc.
  category_az text,
  price numeric(10,2),
  currency text DEFAULT 'AZN',
  original_price numeric(10,2), -- For showing discounts
  affiliate_url text NOT NULL,
  platform text DEFAULT 'other', -- trendyol, amazon, aliexpress, other
  image_url text,
  rating numeric(2,1) DEFAULT 0,
  review_count integer DEFAULT 0,
  review_summary text,
  review_summary_az text,
  life_stages text[] DEFAULT '{flow,bump,mommy}',
  is_featured boolean DEFAULT false,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.affiliate_products ENABLE ROW LEVEL SECURITY;

-- Public read access for active products
CREATE POLICY "Affiliate products are viewable by everyone"
ON public.affiliate_products FOR SELECT
USING (is_active = true);

-- Admin management
CREATE POLICY "Admins can manage affiliate products"
ON public.affiliate_products FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 5. App Settings for affiliate section toggle
INSERT INTO public.app_settings (key, value, description)
VALUES ('affiliate_section_enabled', 'true', 'Tövsiyyə olunan məhsullar bölməsinin aktiv/deaktiv olması')
ON CONFLICT (key) DO NOTHING;

-- 6. Add new tool configs
INSERT INTO public.tool_configs (tool_id, name, name_az, description, description_az, icon, color, bg_color, life_stages, sort_order, is_active)
VALUES 
  ('doctors', 'Doctors & Hospitals', 'Həkimlər və Xəstəxanalar', 'Find healthcare providers', 'Həkim və xəstəxana siyahısı', 'Stethoscope', 'text-blue-600', 'bg-blue-50', '{flow,bump,mommy}', 3, true),
  ('blood-sugar', 'Blood Sugar Tracker', 'Qan Şəkəri', 'Track blood sugar levels', 'Qan şəkəri səviyyəsini izləyin', 'Droplet', 'text-red-600', 'bg-red-50', '{bump,mommy}', 7, true),
  ('pregnancy-album', 'Pregnancy Album', 'Hamiləlik Albomu', 'Document your pregnancy journey', 'Hamiləlik səyahətinizi sənədləşdirin', 'ImagePlus', 'text-purple-600', 'bg-purple-50', '{bump}', 8, true)
ON CONFLICT (tool_id) DO UPDATE SET
  name_az = EXCLUDED.name_az,
  description_az = EXCLUDED.description_az,
  icon = EXCLUDED.icon,
  is_active = EXCLUDED.is_active;

-- Create storage bucket for pregnancy album photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('pregnancy-album', 'pregnancy-album', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for pregnancy album
CREATE POLICY "Users can view all pregnancy album photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'pregnancy-album');

CREATE POLICY "Users can upload their own pregnancy album photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'pregnancy-album' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own pregnancy album photos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'pregnancy-album' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own pregnancy album photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'pregnancy-album' AND auth.uid()::text = (storage.foldername(name))[1]);