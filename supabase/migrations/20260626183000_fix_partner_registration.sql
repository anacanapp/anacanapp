-- Re-create the function to also return whether the partner is premium
-- and grant execute to anon so unauthenticated users can register as partners.

DROP FUNCTION IF EXISTS public.find_partner_by_code(text);

CREATE OR REPLACE FUNCTION public.find_partner_by_code(p_partner_code text)
RETURNS TABLE (id uuid, user_id uuid, name text, is_premium boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id, 
    p.user_id, 
    p.name,
    COALESCE(
      (
        SELECT (s.plan_type = 'premium' OR s.plan_type = 'premium_plus') AND 
               (s.status = 'active' OR (s.status = 'cancelled' AND s.expires_at > now()))
        FROM public.subscriptions s
        WHERE s.user_id = p.user_id
        ORDER BY s.created_at DESC
        LIMIT 1
      ), 
      false
    ) as is_premium
  FROM public.profiles p
  WHERE p.partner_code = p_partner_code
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.find_partner_by_code(text) TO anon, authenticated;
