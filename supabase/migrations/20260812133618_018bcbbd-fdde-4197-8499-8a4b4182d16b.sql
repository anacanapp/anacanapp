GRANT SELECT ON public.scheduled_notifications TO anon;
GRANT SELECT ON public.scheduled_notifications TO authenticated;
CREATE POLICY "Anyone can view scheduled notifications"
ON public.scheduled_notifications
FOR SELECT
USING (true);