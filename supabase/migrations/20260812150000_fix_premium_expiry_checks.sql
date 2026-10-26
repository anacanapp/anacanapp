-- ============================================================
-- FIX: Premium bitmə tarixinin yoxlanılması (server tərəfi)
--
-- Problem: get_linked_partner_premium() 'active' statusu və is_premium
-- flag-ını TARİXSİZ yoxlayırdı. Heç bir cron premium-u söndürmədiyi üçün
-- household premium müddət bitdikdən sonra da açıq qalırdı.
-- (Klient tərəfdəki ownPremium eyni buga malik idi — ayrıca düzəldildi.)
-- ============================================================

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
         AND (s.status IN ('active', 'cancelled'))
         AND (s.expires_at IS NULL OR s.expires_at > now())
      FROM public.subscriptions s
      WHERE s.user_id = public.get_linked_partner_user_id(auth.uid())
      ORDER BY s.created_at DESC
      LIMIT 1
    ), false)
    OR
    COALESCE((
      SELECT pr.is_premium
         AND (pr.premium_until IS NULL OR pr.premium_until > now())
      FROM public.profiles pr
      WHERE pr.user_id = public.get_linked_partner_user_id(auth.uid())
      LIMIT 1
    ), false);
$$;
