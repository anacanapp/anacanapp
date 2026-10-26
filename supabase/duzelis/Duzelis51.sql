-- Duzelis51: Premium ləğvetmə səbəbi toplama + admin Premium analitika səhifəsi üçün sxem
--
-- 1) subscriptions cədvəlinə is_trial + cancelled_at əlavə edilir (RevenueCat
--    sync məntiqi artıq bunları doldurur — bax supabase/functions/_shared/revenuecat-sync.ts)
-- 2) subscription_cancellations — istifadəçinin özünün seçdiyi ləğv səbəbi
--    (tətbiq-daxili popup, BillingScreen.tsx) VƏ RevenueCat-ın mağaza-tərəfi
--    bildirdiyi səbəb (webhook, cancel_flow='store_reported') hər ikisi
--    üçün TƏK cədvəl.

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS is_trial boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

CREATE TABLE IF NOT EXISTS public.subscription_cancellations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason_code text NOT NULL,
  reason_text text,
  plan_type text,
  was_trial boolean NOT NULL DEFAULT false,
  cancel_flow text NOT NULL DEFAULT 'in_app' CHECK (cancel_flow IN ('in_app', 'store_reported')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscription_cancellations_user_id ON public.subscription_cancellations(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_cancellations_created_at ON public.subscription_cancellations(created_at DESC);

ALTER TABLE public.subscription_cancellations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own cancellation reasons" ON public.subscription_cancellations;
CREATE POLICY "Users can insert own cancellation reasons"
ON public.subscription_cancellations FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own cancellation reasons" ON public.subscription_cancellations;
CREATE POLICY "Users can view own cancellation reasons"
ON public.subscription_cancellations FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all cancellation reasons" ON public.subscription_cancellations;
CREATE POLICY "Admins can view all cancellation reasons"
ON public.subscription_cancellations FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- service_role (edge function-lar, webhook daxil) həmişə RLS-i keçir, əlavə policy lazım deyil.

-- YOXLAMA:
--   SELECT column_name FROM information_schema.columns WHERE table_name='subscriptions' AND column_name IN ('is_trial','cancelled_at');
--   SELECT * FROM public.subscription_cancellations LIMIT 5;
