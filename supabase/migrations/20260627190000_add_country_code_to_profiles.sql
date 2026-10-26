-- Add country_code column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS country_code TEXT;

-- Update handle_new_user to also insert country_code from raw_user_meta_data
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_profile_id uuid;
BEGIN
  INSERT INTO public.profiles (user_id, name, email, partner_code, country_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'İstifadəçi'),
    NEW.email,
    'ANACAN-' || UPPER(SUBSTRING(MD5(NEW.id::text) FROM 1 FOR 4)),
    NEW.raw_user_meta_data->>'country_code'
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
