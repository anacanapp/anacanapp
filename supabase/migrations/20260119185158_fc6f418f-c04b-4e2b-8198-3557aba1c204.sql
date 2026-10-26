-- Drop existing triggers that are causing issues
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_profile_created_assign_admin ON public.profiles;
DROP TRIGGER IF EXISTS assign_admin_trigger ON public.profiles;

-- Drop and recreate the handle_new_user function with fixed logic
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_profile_id uuid;
BEGIN
  -- First, insert the profile
  INSERT INTO public.profiles (user_id, name, email, partner_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'İstifadəçi'),
    NEW.email,
    'ANACAN-' || UPPER(SUBSTRING(MD5(NEW.id::text) FROM 1 FOR 4))
  )
  RETURNING id INTO new_profile_id;
  
  -- Insert user role - this should work now since user exists in auth.users
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  -- If this is the admin email, also add admin role
  IF NEW.email = 'admin@anacan.az' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the signup
    RAISE WARNING 'Error in handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Recreate the trigger on auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Drop the auto_assign_admin_role function and trigger as we now handle it in handle_new_user
DROP FUNCTION IF EXISTS public.auto_assign_admin_role() CASCADE;