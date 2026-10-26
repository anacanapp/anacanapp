-- =====================================================
-- ANACAN APP - COMPLETE SUPABASE SCHEMA
-- =====================================================
-- Bu fayl Supabase layihəsi üçün tam verilənlər bazası sxemini ehtiva edir.
-- Yeni Supabase layihəsində SQL Editor-da icra edin.
-- =====================================================

-- =====================================================
-- 1. ENUMS (Rol növləri)
-- =====================================================
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- 2. HELPER FUNCTIONS
-- =====================================================

-- Updated at trigger funksiyası
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- =====================================================
-- 3. TABLES (Cədvəllər)
-- =====================================================

-- Profillər cədvəli
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  name text NOT NULL DEFAULT 'İstifadəçi',
  email text,
  role public.app_role NOT NULL DEFAULT 'user'::app_role,
  avatar_url text,
  life_stage text, -- 'trying', 'pregnant', 'postpartum', 'partner'
  partner_code text,
  linked_partner_id uuid REFERENCES public.profiles(id),
  due_date date,
  baby_birth_date date,
  baby_name text,
  baby_gender text,
  last_period_date date,
  cycle_length integer DEFAULT 28,
  period_length integer DEFAULT 5,
  start_weight numeric,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- İstifadəçi rolları cədvəli (təhlükəsizlik üçün ayrı cədvəl)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Görüşlər/Təqvimlər cədvəli
CREATE TABLE IF NOT EXISTS public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  event_type text NOT NULL DEFAULT 'appointment',
  event_date date NOT NULL,
  event_time time without time zone,
  reminder_enabled boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Körpə qeydləri cədvəli (qidalanma, yuxu, bez)
CREATE TABLE IF NOT EXISTS public.baby_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  log_type text NOT NULL, -- 'feeding', 'sleep', 'diaper'
  start_time timestamp with time zone NOT NULL DEFAULT now(),
  end_time timestamp with time zone,
  feed_type text, -- 'breast_left', 'breast_right', 'bottle', 'solid'
  diaper_type text, -- 'wet', 'dirty', 'mixed'
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Körpə foto sessiyaları cədvəli
CREATE TABLE IF NOT EXISTS public.baby_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  storage_path text NOT NULL,
  prompt text NOT NULL,
  background_theme text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Sancı izləyicisi cədvəli
CREATE TABLE IF NOT EXISTS public.contractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  start_time timestamp with time zone NOT NULL DEFAULT now(),
  duration_seconds integer NOT NULL DEFAULT 0,
  interval_seconds integer,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Gündəlik qeydlər cədvəli
CREATE TABLE IF NOT EXISTS public.daily_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  log_date date NOT NULL DEFAULT CURRENT_DATE,
  mood integer, -- 1-5 scale
  symptoms text[],
  water_intake integer DEFAULT 0,
  temperature numeric,
  bleeding text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, log_date)
);

-- Təpik sayğacı cədvəli
CREATE TABLE IF NOT EXISTS public.kick_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kick_count integer NOT NULL DEFAULT 0,
  duration_seconds integer NOT NULL DEFAULT 0,
  session_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Bildirişlər cədvəli
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  notification_type text NOT NULL DEFAULT 'reminder',
  is_read boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Partner mesajları cədvəli
CREATE TABLE IF NOT EXISTS public.partner_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  message_type text NOT NULL, -- 'love', 'reminder', 'text'
  content text,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Məhsullar cədvəli (mağaza üçün)
CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price numeric NOT NULL DEFAULT 0,
  category text NOT NULL,
  image_url text,
  rating numeric DEFAULT 4.5,
  stock integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Alış-veriş siyahısı cədvəli
CREATE TABLE IF NOT EXISTS public.shopping_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  partner_id uuid,
  name text NOT NULL,
  quantity integer DEFAULT 1,
  priority text DEFAULT 'normal', -- 'low', 'medium', 'high'
  is_checked boolean DEFAULT false,
  added_by text, -- 'woman', 'partner'
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Çəki qeydləri cədvəli
CREATE TABLE IF NOT EXISTS public.weight_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  weight numeric NOT NULL,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Tətbiq parametrləri cədvəli
CREATE TABLE IF NOT EXISTS public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- =====================================================
-- 4. SECURITY DEFINER FUNCTIONS
-- =====================================================

-- Rol yoxlama funksiyası (RLS üçün)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$function$;

-- İstifadəçinin partner ID-sini əldə etmək
CREATE OR REPLACE FUNCTION public.get_user_linked_partner_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT linked_partner_id
  FROM public.profiles
  WHERE user_id = _user_id
  LIMIT 1;
$function$;

-- Profil default-ları təyin etmək
CREATE OR REPLACE FUNCTION public.set_profile_defaults()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF NEW.partner_code IS NULL OR NEW.partner_code = '' THEN
    NEW.partner_code := 'ANACAN-' || UPPER(SUBSTRING(MD5(NEW.user_id::text) FROM 1 FOR 4));
  END IF;

  IF NEW.name IS NULL OR NEW.name = '' THEN
    NEW.name := 'İstifadəçi';
  END IF;

  RETURN NEW;
END;
$function$;

-- Yeni istifadəçi yaratma funksiyası
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  new_profile_id uuid;
BEGIN
  -- Profil yarat
  INSERT INTO public.profiles (user_id, name, email, partner_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'İstifadəçi'),
    NEW.email,
    'ANACAN-' || UPPER(SUBSTRING(MD5(NEW.id::text) FROM 1 FOR 4))
  )
  RETURNING id INTO new_profile_id;
  
  -- Default istifadəçi rolu əlavə et
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  -- Admin email üçün admin rolu əlavə et
  IF NEW.email = 'admin@anacan.az' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$function$;

-- =====================================================
-- 5. TRIGGERS
-- =====================================================

-- Profil default-ları trigger-i
DROP TRIGGER IF EXISTS set_profile_defaults_trigger ON public.profiles;
CREATE TRIGGER set_profile_defaults_trigger
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_profile_defaults();

-- Updated_at trigger-ləri
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_products_updated_at ON public.products;
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_app_settings_updated_at ON public.app_settings;
CREATE TRIGGER update_app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Yeni istifadəçi trigger-i (auth.users üçün)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- 6. ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.baby_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.baby_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kick_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weight_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 7. RLS POLICIES - PROFILES
-- =====================================================

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Partners can view linked profile" ON public.profiles;
CREATE POLICY "Partners can view linked profile" ON public.profiles
  FOR SELECT USING (id = get_user_linked_partner_id(auth.uid()));

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles" ON public.profiles
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- 7. RLS POLICIES - USER_ROLES
-- =====================================================

DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
CREATE POLICY "Users can view own role" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
CREATE POLICY "Admins can manage all roles" ON public.user_roles
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- 7. RLS POLICIES - APPOINTMENTS
-- =====================================================

DROP POLICY IF EXISTS "Users can manage own appointments" ON public.appointments;
CREATE POLICY "Users can manage own appointments" ON public.appointments
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Partners can view linked appointments" ON public.appointments;
CREATE POLICY "Partners can view linked appointments" ON public.appointments
  FOR SELECT USING (
    user_id IN (
      SELECT p2.user_id
      FROM profiles p1
      JOIN profiles p2 ON p1.linked_partner_id = p2.id
      WHERE p1.user_id = auth.uid()
    )
  );

-- =====================================================
-- 7. RLS POLICIES - BABY_LOGS
-- =====================================================

DROP POLICY IF EXISTS "Users can manage own baby logs" ON public.baby_logs;
CREATE POLICY "Users can manage own baby logs" ON public.baby_logs
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can view baby_logs" ON public.baby_logs;
CREATE POLICY "Authenticated users can view baby_logs" ON public.baby_logs
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Partners can view linked baby logs" ON public.baby_logs;
CREATE POLICY "Partners can view linked baby logs" ON public.baby_logs
  FOR SELECT USING (
    user_id IN (
      SELECT p2.user_id
      FROM profiles p1
      JOIN profiles p2 ON p1.linked_partner_id = p2.id
      WHERE p1.user_id = auth.uid()
    )
  );

-- =====================================================
-- 7. RLS POLICIES - BABY_PHOTOS
-- =====================================================

DROP POLICY IF EXISTS "Users can view own baby photos" ON public.baby_photos;
CREATE POLICY "Users can view own baby photos" ON public.baby_photos
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own baby photos" ON public.baby_photos;
CREATE POLICY "Users can insert own baby photos" ON public.baby_photos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own baby photos" ON public.baby_photos;
CREATE POLICY "Users can delete own baby photos" ON public.baby_photos
  FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- 7. RLS POLICIES - CONTRACTIONS
-- =====================================================

DROP POLICY IF EXISTS "Users can manage own contractions" ON public.contractions;
CREATE POLICY "Users can manage own contractions" ON public.contractions
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Partners can view linked contractions" ON public.contractions;
CREATE POLICY "Partners can view linked contractions" ON public.contractions
  FOR SELECT USING (
    user_id IN (
      SELECT p2.user_id
      FROM profiles p1
      JOIN profiles p2 ON p1.linked_partner_id = p2.id
      WHERE p1.user_id = auth.uid()
    )
  );

-- =====================================================
-- 7. RLS POLICIES - DAILY_LOGS
-- =====================================================

DROP POLICY IF EXISTS "Users can manage own daily logs" ON public.daily_logs;
CREATE POLICY "Users can manage own daily logs" ON public.daily_logs
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can view daily_logs" ON public.daily_logs;
CREATE POLICY "Authenticated users can view daily_logs" ON public.daily_logs
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Partners can view linked user logs" ON public.daily_logs;
CREATE POLICY "Partners can view linked user logs" ON public.daily_logs
  FOR SELECT USING (
    user_id IN (
      SELECT p2.user_id
      FROM profiles p1
      JOIN profiles p2 ON p1.linked_partner_id = p2.id
      WHERE p1.user_id = auth.uid()
    )
  );

-- =====================================================
-- 7. RLS POLICIES - KICK_SESSIONS
-- =====================================================

DROP POLICY IF EXISTS "Users can manage own kick sessions" ON public.kick_sessions;
CREATE POLICY "Users can manage own kick sessions" ON public.kick_sessions
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Partners can view linked kick sessions" ON public.kick_sessions;
CREATE POLICY "Partners can view linked kick sessions" ON public.kick_sessions
  FOR SELECT USING (
    user_id IN (
      SELECT p2.user_id
      FROM profiles p1
      JOIN profiles p2 ON p1.linked_partner_id = p2.id
      WHERE p1.user_id = auth.uid()
    )
  );

-- =====================================================
-- 7. RLS POLICIES - NOTIFICATIONS
-- =====================================================

DROP POLICY IF EXISTS "Users can manage own notifications" ON public.notifications;
CREATE POLICY "Users can manage own notifications" ON public.notifications
  FOR ALL USING (auth.uid() = user_id);

-- =====================================================
-- 7. RLS POLICIES - PARTNER_MESSAGES
-- =====================================================

DROP POLICY IF EXISTS "Users can view own messages" ON public.partner_messages;
CREATE POLICY "Users can view own messages" ON public.partner_messages
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Users can send messages" ON public.partner_messages;
CREATE POLICY "Users can send messages" ON public.partner_messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Users can update own received messages" ON public.partner_messages;
CREATE POLICY "Users can update own received messages" ON public.partner_messages
  FOR UPDATE USING (auth.uid() = receiver_id);

-- =====================================================
-- 7. RLS POLICIES - PRODUCTS
-- =====================================================

DROP POLICY IF EXISTS "Anyone can view active products" ON public.products;
CREATE POLICY "Anyone can view active products" ON public.products
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage products" ON public.products;
CREATE POLICY "Admins can manage products" ON public.products
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- 7. RLS POLICIES - SHOPPING_ITEMS
-- =====================================================

DROP POLICY IF EXISTS "Users can manage own shopping items" ON public.shopping_items;
CREATE POLICY "Users can manage own shopping items" ON public.shopping_items
  FOR ALL USING (auth.uid() = user_id OR auth.uid() = partner_id);

-- =====================================================
-- 7. RLS POLICIES - WEIGHT_ENTRIES
-- =====================================================

DROP POLICY IF EXISTS "Users can manage own weight entries" ON public.weight_entries;
CREATE POLICY "Users can manage own weight entries" ON public.weight_entries
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Partners can view linked weight entries" ON public.weight_entries;
CREATE POLICY "Partners can view linked weight entries" ON public.weight_entries
  FOR SELECT USING (
    user_id IN (
      SELECT p2.user_id
      FROM profiles p1
      JOIN profiles p2 ON p1.linked_partner_id = p2.id
      WHERE p1.user_id = auth.uid()
    )
  );

-- =====================================================
-- 7. RLS POLICIES - APP_SETTINGS
-- =====================================================

DROP POLICY IF EXISTS "Anyone can view app settings" ON public.app_settings;
CREATE POLICY "Anyone can view app settings" ON public.app_settings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage app settings" ON public.app_settings;
CREATE POLICY "Admins can manage app settings" ON public.app_settings
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- 8. STORAGE BUCKETS
-- =====================================================

-- Baby photos bucket yaratmaq
INSERT INTO storage.buckets (id, name, public)
VALUES ('baby-photos', 'baby-photos', true)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 9. STORAGE RLS POLICIES
-- =====================================================

-- Storage policies üçün əvvəlcə mövcud olanları silmək
DROP POLICY IF EXISTS "Users can upload own baby photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own baby photos storage" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own baby photos storage" ON storage.objects;
DROP POLICY IF EXISTS "Public can view baby photos" ON storage.objects;

-- İstifadəçilər öz fotolarını yükləyə bilər
CREATE POLICY "Users can upload own baby photos" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'baby-photos' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- İstifadəçilər öz fotolarını görə bilər
CREATE POLICY "Users can view own baby photos storage" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'baby-photos' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- İstifadəçilər öz fotolarını silə bilər
CREATE POLICY "Users can delete own baby photos storage" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'baby-photos' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Public bucket olduğu üçün hamı görə bilər
CREATE POLICY "Public can view baby photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'baby-photos');

-- =====================================================
-- 10. REALTIME PUBLICATIONS
-- =====================================================

-- Realtime üçün cədvəlləri əlavə etmək
ALTER PUBLICATION supabase_realtime ADD TABLE public.kick_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.contractions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shopping_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.partner_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.baby_photos;

-- =====================================================
-- 11. INDEXES (Performans üçün)
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_partner_code ON public.profiles(partner_code);
CREATE INDEX IF NOT EXISTS idx_profiles_linked_partner_id ON public.profiles(linked_partner_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_appointments_user_id ON public.appointments(user_id);
CREATE INDEX IF NOT EXISTS idx_appointments_event_date ON public.appointments(event_date);
CREATE INDEX IF NOT EXISTS idx_baby_logs_user_id ON public.baby_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_baby_photos_user_id ON public.baby_photos(user_id);
CREATE INDEX IF NOT EXISTS idx_contractions_user_id ON public.contractions(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_logs_user_id ON public.daily_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_logs_log_date ON public.daily_logs(log_date);
CREATE INDEX IF NOT EXISTS idx_kick_sessions_user_id ON public.kick_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_partner_messages_sender_id ON public.partner_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_partner_messages_receiver_id ON public.partner_messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_shopping_items_user_id ON public.shopping_items(user_id);
CREATE INDEX IF NOT EXISTS idx_weight_entries_user_id ON public.weight_entries(user_id);

-- =====================================================
-- TAMAMLANDI!
-- =====================================================
-- Bu SQL faylını Supabase Dashboard -> SQL Editor-da icra edin.
-- Bütün cədvəllər, funksiyalar, RLS siyasətləri və storage 
-- konfiqurasiyaları yaradılacaq.
-- =====================================================
