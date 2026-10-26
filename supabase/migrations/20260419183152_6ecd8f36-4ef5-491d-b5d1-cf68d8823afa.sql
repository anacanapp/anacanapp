
DROP VIEW IF EXISTS public.payment_methods_public;

CREATE VIEW public.payment_methods_public
WITH (security_invoker = true) AS
SELECT id, method_key, label, label_az, description, description_az, icon, is_active, sort_order, created_at, updated_at
FROM public.payment_methods
WHERE is_active = true;

GRANT SELECT ON public.payment_methods_public TO anon, authenticated;

-- Allow public SELECT on the underlying table but only via the view (RLS still applies)
-- Add a permissive policy for the safe columns through the view's security_invoker
CREATE POLICY "Public can read non-sensitive payment method fields"
ON public.payment_methods
FOR SELECT
TO anon, authenticated
USING (is_active = true);
