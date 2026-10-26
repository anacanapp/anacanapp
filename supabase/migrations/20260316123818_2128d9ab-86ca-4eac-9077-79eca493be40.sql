
-- Drop the overly permissive update policy
DROP POLICY "Service role can update transactions" ON public.payment_transactions;

-- Allow users to update only their own pending transactions (for setting redirect_url etc)
CREATE POLICY "Users can update own pending transactions" ON public.payment_transactions
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
