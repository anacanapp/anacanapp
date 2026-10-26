
-- Fix the permissive INSERT policy on notification_send_log
DROP POLICY IF EXISTS "Service can insert notification logs" ON public.notification_send_log;

-- Create a proper policy that allows the service role or authenticated users to insert their own logs
CREATE POLICY "Users can insert own notification logs"
  ON public.notification_send_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);
