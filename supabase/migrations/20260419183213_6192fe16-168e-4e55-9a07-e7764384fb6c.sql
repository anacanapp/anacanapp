
-- Remove the over-permissive SELECT policy I just added
DROP POLICY IF EXISTS "Public can read non-sensitive payment method fields" ON public.payment_methods;

-- Recreate view as security_definer-equivalent via a safe SECURITY INVOKER function
DROP VIEW IF EXISTS public.payment_methods_public;

-- Use a STABLE SECURITY DEFINER function instead - safer than a view for this use case
CREATE OR REPLACE FUNCTION public.get_active_payment_methods()
RETURNS TABLE (
  id uuid,
  method_key text,
  label text,
  label_az text,
  description text,
  description_az text,
  icon text,
  is_active boolean,
  sort_order integer,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, method_key, label, label_az, description, description_az, icon, is_active, sort_order, created_at, updated_at
  FROM public.payment_methods
  WHERE is_active = true
  ORDER BY sort_order;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_payment_methods() TO anon, authenticated;
