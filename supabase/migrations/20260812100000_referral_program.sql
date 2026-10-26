-- ============================================================
-- Referral Proqramı (konversiya-əsaslı mükafat)
--
--   Axın:
--   1) Dəvət olunan kodu daxil edir → status = 'registered'
--      (HEÇ KİMƏ bonus verilmir — dəvət olunan standart qalır)
--   2) Dəvət olunan free trial başladır → status = 'trial'
--   3) Dəvət olunan REAL premium olur (birbaşa alış və ya trial-dan
--      sonra ödənişə keçid) → status = 'converted' və YALNIZ BU ANDA
--      dəvət edənə +7 gün premium verilir (1 dəfə).
--
--   Status sinxronu klientdən gəlir (RevenueCat entitlement periodType:
--   TRIAL → 'trial', NORMAL → 'converted') — update_my_referral_status RPC.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.referral_codes (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  -- registered → trial → converted
  status TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'trial', 'converted')),
  reward_days INTEGER NOT NULL DEFAULT 7,
  trial_started_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  -- dəvət edənə +7 gün nə vaxt verildi (NULL = hələ verilməyib)
  referrer_rewarded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT no_self_referral CHECK (referrer_user_id <> referred_user_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals (referrer_user_id);

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own referral code" ON public.referral_codes;
CREATE POLICY "Users read own referral code"
  ON public.referral_codes FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users read own referrals" ON public.referrals;
CREATE POLICY "Users read own referrals"
  ON public.referrals FOR SELECT
  USING (auth.uid() = referrer_user_id OR auth.uid() = referred_user_id);

-- INSERT/UPDATE yalnız RPC-lər vasitəsilə (SECURITY DEFINER)

-- ------------------------------------------------------------
-- Premium müddəti artırma köməkçisi (+N gün, mövcudun üstünə)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._grant_premium_days(p_user UUID, p_days INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_until TIMESTAMPTZ;
BEGIN
  SELECT GREATEST(COALESCE(premium_until, now()), now()) + (p_days || ' days')::interval
  INTO v_new_until FROM profiles WHERE user_id = p_user;

  IF v_new_until IS NULL THEN
    v_new_until := now() + (p_days || ' days')::interval;
  END IF;

  UPDATE profiles SET is_premium = true, premium_until = v_new_until WHERE user_id = p_user;

  INSERT INTO subscriptions (user_id, plan_type, status, started_at, expires_at)
  VALUES (p_user, 'premium', 'active', now(), v_new_until)
  ON CONFLICT (user_id) DO UPDATE SET
    plan_type = CASE WHEN subscriptions.plan_type = 'premium_plus' THEN 'premium_plus' ELSE 'premium' END,
    status = 'active',
    expires_at = GREATEST(COALESCE(subscriptions.expires_at, v_new_until), v_new_until);
END;
$$;

-- ------------------------------------------------------------
-- Kodu al / yarat (6 simvolluq, oxunaqlı əlifba)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_or_create_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT;
  v_chars TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- oxşar simvollar yoxdur (I,L,O,0,1)
  v_try INTEGER := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT code INTO v_code FROM referral_codes WHERE user_id = auth.uid();
  IF v_code IS NOT NULL THEN
    RETURN v_code;
  END IF;

  LOOP
    v_try := v_try + 1;
    v_code := '';
    FOR i IN 1..6 LOOP
      v_code := v_code || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
    END LOOP;

    BEGIN
      INSERT INTO referral_codes (user_id, code) VALUES (auth.uid(), v_code);
      RETURN v_code;
    EXCEPTION WHEN unique_violation THEN
      IF v_try > 10 THEN RAISE EXCEPTION 'code_generation_failed'; END IF;
      -- təkrar cəhd
    END;
  END LOOP;
END;
$$;

-- ------------------------------------------------------------
-- Kodu istifadə et:
--   Dəvət olunana BONUS YOXDUR — standart qalır (istəsə özü
--   premium/trial alır). Dəvət edənin mükafatı konversiyada.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.redeem_referral_code(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer UUID;
  v_days INTEGER := 7;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT user_id INTO v_referrer
  FROM referral_codes
  WHERE code = upper(trim(p_code));

  IF v_referrer IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_code');
  END IF;

  IF v_referrer = auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'own_code');
  END IF;

  IF EXISTS (SELECT 1 FROM referrals WHERE referred_user_id = auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_redeemed');
  END IF;

  INSERT INTO referrals (referrer_user_id, referred_user_id, code, reward_days, status)
  VALUES (v_referrer, auth.uid(), upper(trim(p_code)), v_days, 'registered');

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ------------------------------------------------------------
-- Status sinxronu (dəvət OLUNAN istifadəçinin klienti çağırır):
--   'trial'     → free trial başladı
--   'converted' → real premium (birbaşa alış / trial-dan keçid)
--                 → dəvət edənə +7 gün (yalnız 1 dəfə)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_my_referral_status(p_state TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_state NOT IN ('trial', 'converted') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_state');
  END IF;

  SELECT * INTO v_ref FROM referrals WHERE referred_user_id = auth.uid();
  IF v_ref IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_referral');
  END IF;

  IF p_state = 'trial' THEN
    -- Yalnız irəli keçid (converted-i geri salmırıq)
    IF v_ref.status = 'registered' THEN
      UPDATE referrals
      SET status = 'trial', trial_started_at = COALESCE(trial_started_at, now())
      WHERE id = v_ref.id;
    END IF;
    RETURN jsonb_build_object('success', true, 'status', 'trial');
  END IF;

  -- p_state = 'converted'
  IF v_ref.referrer_rewarded_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'status', 'converted', 'already_rewarded', true);
  END IF;

  UPDATE referrals
  SET status = 'converted',
      converted_at = COALESCE(converted_at, now()),
      referrer_rewarded_at = now()
  WHERE id = v_ref.id;

  -- Dəvət edənin mükafatı — YALNIZ indi
  PERFORM _grant_premium_days(v_ref.referrer_user_id, v_ref.reward_days);

  RETURN jsonb_build_object('success', true, 'status', 'converted', 'referrer_rewarded', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_referral_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_referral_code(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_my_referral_status(TEXT) TO authenticated;
