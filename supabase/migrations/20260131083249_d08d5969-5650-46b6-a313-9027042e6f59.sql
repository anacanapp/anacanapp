-- Allow admins to view all device tokens for push notification management
CREATE POLICY "Admins can view all device tokens"
ON public.device_tokens FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete any device token for cleanup purposes
CREATE POLICY "Admins can delete any device token"
ON public.device_tokens FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));