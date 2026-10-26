-- Create a safe, public-facing profile projection for Community
CREATE TABLE IF NOT EXISTS public.public_profile_cards (
  user_id uuid PRIMARY KEY,
  name text,
  avatar_url text,
  badge_type text,
  life_stage text,
  is_premium boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.public_profile_cards ENABLE ROW LEVEL SECURITY;

-- Only allow authenticated users to read public profile cards
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'public_profile_cards'
      AND policyname = 'Authenticated users can view public profile cards'
  ) THEN
    CREATE POLICY "Authenticated users can view public profile cards"
    ON public.public_profile_cards
    FOR SELECT
    USING (auth.role() = 'authenticated');
  END IF;
END$$;

-- Keep write access closed to clients by not creating INSERT/UPDATE/DELETE policies.

-- Sync function (runs as definer, so it can upsert regardless of RLS)
CREATE OR REPLACE FUNCTION public.sync_public_profile_card()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.public_profile_cards (
    user_id,
    name,
    avatar_url,
    badge_type,
    life_stage,
    is_premium,
    created_at,
    updated_at
  )
  VALUES (
    NEW.user_id,
    NEW.name,
    NEW.avatar_url,
    NEW.badge_type,
    NEW.life_stage,
    COALESCE(NEW.is_premium, false),
    NEW.created_at,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    name = EXCLUDED.name,
    avatar_url = EXCLUDED.avatar_url,
    badge_type = EXCLUDED.badge_type,
    life_stage = EXCLUDED.life_stage,
    is_premium = EXCLUDED.is_premium,
    updated_at = now();

  RETURN NEW;
END;
$$;

-- Trigger on profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'profiles_sync_public_profile_card'
  ) THEN
    CREATE TRIGGER profiles_sync_public_profile_card
    AFTER INSERT OR UPDATE
    ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_public_profile_card();
  END IF;
END$$;

-- Backfill existing data (idempotent)
INSERT INTO public.public_profile_cards (
  user_id,
  name,
  avatar_url,
  badge_type,
  life_stage,
  is_premium,
  created_at,
  updated_at
)
SELECT
  p.user_id,
  p.name,
  p.avatar_url,
  p.badge_type,
  p.life_stage,
  COALESCE(p.is_premium, false) as is_premium,
  p.created_at,
  now() as updated_at
FROM public.profiles p
ON CONFLICT (user_id) DO UPDATE
SET
  name = EXCLUDED.name,
  avatar_url = EXCLUDED.avatar_url,
  badge_type = EXCLUDED.badge_type,
  life_stage = EXCLUDED.life_stage,
  is_premium = EXCLUDED.is_premium,
  created_at = EXCLUDED.created_at,
  updated_at = now();
