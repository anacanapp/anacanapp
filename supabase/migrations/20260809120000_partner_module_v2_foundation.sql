-- ============================================================
-- Partner Module 2.0 "Birlikdə" — data foundation
--   1) get_linked_partner_user_id() helper (SECURITY DEFINER)
--   2) partner_sharing_settings — mother controls what partner sees
--   3) partner_messages: real message_type catalog + tightened INSERT RLS
--   4) get_linked_partner_premium() — household premium
--   5) unlink_partners() — both sides unlink safely
-- ============================================================

-- ------------------------------------------------------------
-- 1) Helper: resolve the linked partner's auth user_id
--    (SECURITY DEFINER to avoid profiles RLS recursion in policies)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_linked_partner_user_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p2.user_id
  FROM public.profiles p1
  JOIN public.profiles p2 ON p2.id = p1.linked_partner_id
  WHERE p1.user_id = _user_id
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_linked_partner_user_id(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_linked_partner_user_id(uuid) TO authenticated;

-- ------------------------------------------------------------
-- 2) partner_sharing_settings
--    One row per (mother) user. Missing row == everything default.
--    Defaults: everything ON except weight (sensitive).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.partner_sharing_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  share_mood BOOLEAN NOT NULL DEFAULT true,
  share_symptoms BOOLEAN NOT NULL DEFAULT true,
  share_water BOOLEAN NOT NULL DEFAULT true,
  share_kicks BOOLEAN NOT NULL DEFAULT true,
  share_contractions BOOLEAN NOT NULL DEFAULT true,
  share_weight BOOLEAN NOT NULL DEFAULT false,
  share_appointments BOOLEAN NOT NULL DEFAULT true,
  share_baby_logs BOOLEAN NOT NULL DEFAULT true,
  share_cycle BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.partner_sharing_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own sharing settings" ON public.partner_sharing_settings;
CREATE POLICY "Users manage own sharing settings"
  ON public.partner_sharing_settings
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Partners can view linked sharing settings" ON public.partner_sharing_settings;
CREATE POLICY "Partners can view linked sharing settings"
  ON public.partner_sharing_settings
  FOR SELECT
  USING (user_id = public.get_linked_partner_user_id(auth.uid()));

-- Realtime: partner UI reacts immediately when mother changes a toggle
ALTER PUBLICATION supabase_realtime ADD TABLE public.partner_sharing_settings;

-- ------------------------------------------------------------
-- 3) partner_messages — align CHECK with the real type catalog
--    (original migration only allowed 'love','text' while the app
--    writes many event types) + add new v2 types.
-- ------------------------------------------------------------
ALTER TABLE public.partner_messages
  DROP CONSTRAINT IF EXISTS partner_messages_message_type_check;

ALTER TABLE public.partner_messages
  ADD CONSTRAINT partner_messages_message_type_check
  CHECK (message_type IN (
    -- chat
    'text', 'love', 'image', 'audio', 'reminder',
    -- mother -> partner event bus
    'mood_update', 'contraction_started', 'contraction_511',
    'kick_session', 'water_goal', 'daily_summary', 'sos_alert',
    -- partner -> mother
    'surprise_planned', 'surprise_completed',
    -- v2
    'birth_alert', 'thank_you'
  )) NOT VALID;

-- NOT VALID: don't fail on any legacy rows; validate going forward.

-- Tighten INSERT: sender must be the author AND receiver must be the linked partner
DROP POLICY IF EXISTS "Users can send messages" ON public.partner_messages;
CREATE POLICY "Users can send messages"
  ON public.partner_messages
  FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND receiver_id = public.get_linked_partner_user_id(auth.uid())
  );

-- ------------------------------------------------------------
-- 4) Household premium: linked partner's subscription unlocks both
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_linked_partner_premium()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE((
      SELECT (s.plan_type IN ('premium', 'premium_plus'))
         AND (s.status = 'active' OR (s.status = 'cancelled' AND s.expires_at > now()))
      FROM public.subscriptions s
      WHERE s.user_id = public.get_linked_partner_user_id(auth.uid())
      ORDER BY s.created_at DESC
      LIMIT 1
    ), false)
    OR
    COALESCE((
      SELECT pr.is_premium
      FROM public.profiles pr
      WHERE pr.user_id = public.get_linked_partner_user_id(auth.uid())
      LIMIT 1
    ), false);
$$;

REVOKE ALL ON FUNCTION public.get_linked_partner_premium() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_linked_partner_premium() TO authenticated;

-- ------------------------------------------------------------
-- 5) Unlink both sides (either side may trigger)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.unlink_partners()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  my_profile_id uuid;
  partner_profile_id uuid;
BEGIN
  SELECT id, linked_partner_id
  INTO my_profile_id, partner_profile_id
  FROM public.profiles
  WHERE user_id = auth.uid();

  IF my_profile_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.profiles SET linked_partner_id = NULL WHERE id = my_profile_id;

  IF partner_profile_id IS NOT NULL THEN
    UPDATE public.profiles
    SET linked_partner_id = NULL
    WHERE id = partner_profile_id AND linked_partner_id = my_profile_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.unlink_partners() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unlink_partners() TO authenticated;
