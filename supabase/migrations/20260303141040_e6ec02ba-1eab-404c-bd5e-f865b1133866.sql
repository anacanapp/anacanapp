
-- Add DELETE policy for admins on mom_friendly_places
CREATE POLICY "Admins can delete places"
ON public.mom_friendly_places
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Also add DELETE policy for place_reviews referencing deleted places
CREATE POLICY "Admins can delete reviews"
ON public.place_reviews
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Add DELETE policy for place_verifications
CREATE POLICY "Admins can delete verifications"
ON public.place_verifications
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'::app_role));
