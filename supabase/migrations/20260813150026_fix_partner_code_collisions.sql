-- ============================================================
-- Son8: partner_code toqquÅŸmasÄ± dÃ¼zÉ™liÅŸi (onboarding xÉ™tasÄ±nÄ±n kÃ¶k sÉ™bÉ™bi)
-- Problem: kod 'ANACAN-' + md5(user_id)[1:4] = cÉ™mi 65,536 mÃ¼mkÃ¼n kod,
--   deterministik â†’ toqquÅŸan istifadÉ™Ã§idÉ™ handle_new_user susaraq Ã§Ã¶kÃ¼r
--   (EXCEPTION WHEN OTHERS â†’ RETURN NEW), profil/rol/preferences yaranmÄ±r,
--   sonra onboarding INSERT eyni kodu yenidÉ™n yaradÄ±b eyni xÉ™taya dÃ¼ÅŸÃ¼r:
--   "duplicate key value violates unique constraint profiles_partner_code_key"
-- HÉ™ll: tÉ™sadÃ¼fi 6 simvollu kod (32^6 â‰ˆ 1.07 mlrd) + unikallÄ±q yoxlama dÃ¶vrÉ™si,
--   handle_new_user idempotent, mÃ¶vcud zÉ™dÉ™lÉ™nmiÅŸ hesablar bÉ™rpa olunur.
-- ============================================================

-- 1) Unikal partner kodu generatoru
--    SECURITY DEFINER: mÃ¶vcudluq yoxlamasÄ± RLS-dÉ™n kÉ™nar bÃ¼tÃ¼n sÉ™tirlÉ™ri gÃ¶rmÉ™lidir
CREATE OR REPLACE FUNCTION public.generate_partner_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- QarÄ±ÅŸdÄ±rÄ±la bilÉ™n simvolsuz É™lifba (I, O, 0, 1 yoxdur)
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
      code_len := 8; -- praktikada mÃ¼mkÃ¼nsÃ¼z, amma zÉ™manÉ™tli Ã§Ä±xÄ±ÅŸ
    END IF;
  END LOOP;
  RETURN code;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.generate_partner_code() FROM PUBLIC, anon;
-- authenticated lazÄ±mdÄ±r: set_profile_defaults (invoker-rights trigger) onu
-- istifadÉ™Ã§inin Ã¶z INSERT fallback-i zamanÄ± Ã§aÄŸÄ±rÄ±r
GRANT EXECUTE ON FUNCTION public.generate_partner_code() TO authenticated, service_role;

-- 2) set_profile_defaults: md5 É™vÉ™zinÉ™ random unikal kod
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
    NEW.name := 'Ä°stifadÉ™Ã§i';
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
    COALESCE(NEW.raw_user_meta_data->>'name', 'Ä°stifadÉ™Ã§i'),
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

-- 4) BÆRPA: profili yaranmamÄ±ÅŸ mÃ¶vcud istifadÉ™Ã§ilÉ™r (toqquÅŸma qurbanlarÄ±)
--    Qeyd: AFTER INSERT trigger-i (ensure_default_user_role) rollarÄ± Ã¶zÃ¼ yaradacaq
INSERT INTO public.profiles (user_id, name, email, partner_code, country_code)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'name', 'Ä°stifadÉ™Ã§i'),
  u.email,
  public.generate_partner_code(),
  u.raw_user_meta_data->>'country_code'
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE p.id IS NULL;

-- Ã‡atÄ±ÅŸmayan user_preferences sÉ™tirlÉ™ri (handle_new_user Ã§Ã¶kÉ™ndÉ™ bunlar da itirdi)
INSERT INTO public.user_preferences (user_id)
SELECT u.id
FROM auth.users u
LEFT JOIN public.user_preferences up ON up.user_id = u.id
WHERE up.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- Ã‡atÄ±ÅŸmayan default rollar (ehtiyat Ã¼Ã§Ã¼n â€” trigger É™ksÉ™riyyÉ™tini yaradacaq)
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'user'
FROM auth.users u
LEFT JOIN public.user_roles r ON r.user_id = u.id AND r.role = 'user'
WHERE r.user_id IS NULL
ON CONFLICT (user_id, role) DO NOTHING;

