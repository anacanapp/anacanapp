-- Allow partners to view each other's favorite baby names so name voting can be shared
CREATE POLICY "Partners can view linked partner favorite names"
ON public.favorite_names
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles me
    JOIN public.profiles partner ON partner.id = me.linked_partner_id
    WHERE me.user_id = auth.uid()
      AND partner.user_id = favorite_names.user_id
  )
);