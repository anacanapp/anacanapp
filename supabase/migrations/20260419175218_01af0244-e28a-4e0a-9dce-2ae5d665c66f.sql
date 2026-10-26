-- ============================================================
-- 1. Backfill missing user_preferences for existing users
-- ============================================================
INSERT INTO public.user_preferences (user_id)
SELECT p.user_id
FROM public.profiles p
LEFT JOIN public.user_preferences up ON up.user_id = p.user_id
WHERE up.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================
-- 2. Update handle_new_user to also create user_preferences
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_profile_id uuid;
BEGIN
  INSERT INTO public.profiles (user_id, name, email, partner_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'İstifadəçi'),
    NEW.email,
    'ANACAN-' || UPPER(SUBSTRING(MD5(NEW.id::text) FROM 1 FOR 4))
  )
  RETURNING id INTO new_profile_id;
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  IF NEW.email = 'admin@anacan.az' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  
  -- NEW: also seed user_preferences row so notification settings work immediately
  INSERT INTO public.user_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$function$;

-- ============================================================
-- 3. Tighten overly-permissive INSERT policies
-- ============================================================
-- crash_reports: allow anonymous insert ONLY when user_id matches auth.uid() or is null
DROP POLICY IF EXISTS "Anyone can insert crash reports" ON public.crash_reports;
CREATE POLICY "Authenticated or anonymous can insert their own crash reports"
ON public.crash_reports
FOR INSERT
TO public
WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- notifications: ensure user_id is set to current auth.uid()
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.notifications;
CREATE POLICY "Users can insert their own notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 4. Restrict listing on private storage buckets
-- ============================================================
-- baby-photos: owner-scoped (folder = user id)
DROP POLICY IF EXISTS "Users can view their own baby photos" ON storage.objects;
CREATE POLICY "Users can view their own baby photos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'baby-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- chat-media: owner-scoped (was "publicly accessible")
DROP POLICY IF EXISTS "Chat media is publicly accessible" ON storage.objects;
CREATE POLICY "Users can view their own chat media"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'chat-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- baby-album: already owner-scoped (keep)

-- pregnancy-album: was visible to all logged-in users; restrict to owner
DROP POLICY IF EXISTS "Users can view all pregnancy album photos" ON storage.objects;
CREATE POLICY "Users can view their own pregnancy album photos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'pregnancy-album'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- community-media: stays public for community feed (intentional)

-- ============================================================
-- 5. Slow down vitamin reminder cron from 1min to 5min
-- ============================================================
-- AZURE: pg_net/cron.schedule-based HTTP triggering is not available/applicable on
-- Azure (pg_net not allow-listed; edge function URL below is the old Supabase project).
-- This scheduling is reimplemented via an Azure Container Apps Job (cron trigger)
-- calling the Azure-hosted send-vitamin-reminders function directly. See azure-migration/README.md.
-- DO $$
-- BEGIN
--   IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-vitamin-reminders-every-minute') THEN
--     PERFORM cron.unschedule('send-vitamin-reminders-every-minute');
--   END IF;
-- END $$;
--
-- SELECT cron.schedule(
--   'send-vitamin-reminders-every-5min',
--   '*/5 * * * *',
--   $$
--   SELECT net.http_post(
--     url:='https://tntbjulojatnrqmylorp.supabase.co/functions/v1/send-vitamin-reminders',
--     headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRudGJqdWxvamF0bnJxbXlsb3JwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4MzYyOTksImV4cCI6MjA4NDQxMjI5OX0.uwaOZsWTw8GBUg6s9GqmbA3EluGf44PmGdUI80RhGNU"}'::jsonb,
--     body:=concat('{"time": "', now(), '"}')::jsonb
--   ) as request_id;
--   $$
-- );