-- ============================================================
-- Son8: partner_code toqquşması düzəlişi (onboarding xətasının kök səbəbi)
-- Problem: kod 'ANACAN-' + md5(user_id)[1:4] = cəmi 65,536 mümkün kod,
--   deterministik → toqquşan istifadəçidə handle_new_user susaraq çökür
--   (EXCEPTION WHEN OTHERS → RETURN NEW), profil/rol/preferences yaranmır,
--   sonra onboarding INSERT eyni kodu yenidən yaradıb eyni xətaya düşür:
--   "duplicate key value violates unique constraint profiles_partner_code_key"
-- Həll: təsadüfi 6 simvollu kod (32^6 ≈ 1.07 mlrd) + unikallıq yoxlama dövrəsi,
--   handle_new_user idempotent, mövcud zədələnmiş hesablar bərpa olunur.
-- ============================================================

-- 1) Unikal partner kodu generatoru
--    SECURITY DEFINER: mövcudluq yoxlaması RLS-dən kənar bütün sətirləri görməlidir
CREATE OR REPLACE FUNCTION public.generate_partner_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- Qarışdırıla bilən simvolsuz əlifba (I, O, 0, 1 yoxdur)
  chars CONSTANT text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  code_len int := 6;
  attempts int := 0;
  i int;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..code_len LOOP
      code := code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    END LOOP;
    code := 'ANACAN-' || code;

    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE partner_code = code);

    attempts := attempts + 1;
    IF attempts >= 20 THEN
      code_len := 8; -- praktikada mümkünsüz, amma zəmanətli çıxış
    END IF;
  END LOOP;
  RETURN code;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.generate_partner_code() FROM PUBLIC, anon;
-- authenticated lazımdır: set_profile_defaults (invoker-rights trigger) onu
-- istifadəçinin öz INSERT fallback-i zamanı çağırır
GRANT EXECUTE ON FUNCTION public.generate_partner_code() TO authenticated, service_role;

-- 2) set_profile_defaults: md5 əvəzinə random unikal kod
CREATE OR REPLACE FUNCTION public.set_profile_defaults()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.partner_code IS NULL OR NEW.partner_code = '' THEN
    NEW.partner_code := public.generate_partner_code();
  END IF;

  IF NEW.name IS NULL OR NEW.name = '' THEN
    NEW.name := 'İstifadəçi';
  END IF;

  RETURN NEW;
END;
$$;

-- 3) handle_new_user: random unikal kod + idempotent profil INSERT
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, name, email, partner_code, country_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'İstifadəçi'),
    NEW.email,
    public.generate_partner_code(),
    NEW.raw_user_meta_data->>'country_code'
  )
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  IF NEW.email = 'admin@anacan.az' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

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

-- 4) BƏRPA: profili yaranmamış mövcud istifadəçilər (toqquşma qurbanları)
--    Qeyd: AFTER INSERT trigger-i (ensure_default_user_role) rolları özü yaradacaq
INSERT INTO public.profiles (user_id, name, email, partner_code, country_code)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'name', 'İstifadəçi'),
  u.email,
  public.generate_partner_code(),
  u.raw_user_meta_data->>'country_code'
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE p.id IS NULL;

-- Çatışmayan user_preferences sətirləri (handle_new_user çökəndə bunlar da itirdi)
INSERT INTO public.user_preferences (user_id)
SELECT u.id
FROM auth.users u
LEFT JOIN public.user_preferences up ON up.user_id = u.id
WHERE up.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- Çatışmayan default rollar (ehtiyat üçün — trigger əksəriyyətini yaradacaq)
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'user'
FROM auth.users u
LEFT JOIN public.user_roles r ON r.user_id = u.id AND r.role = 'user'
WHERE r.user_id IS NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- 5) Yoxlama: profilsiz istifadəçi qalmamalıdır (0 gözlənilir)
SELECT count(*) AS profilsiz_istifadeci
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE p.id IS NULL;
