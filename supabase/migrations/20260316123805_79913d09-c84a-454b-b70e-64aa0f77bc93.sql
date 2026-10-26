
-- Payment transactions table
CREATE TABLE public.payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  order_type text NOT NULL DEFAULT 'general', -- 'cake', 'shop', 'album', 'premium', etc.
  order_reference_id text, -- links to cake_orders.id, album_orders.id etc.
  order_id text NOT NULL UNIQUE, -- unique order ID sent to Epoint
  amount numeric(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'AZN',
  description text,
  status text NOT NULL DEFAULT 'pending', -- pending, processing, success, failed, returned, error
  epoint_transaction text, -- Epoint transaction ID
  bank_transaction text,
  bank_response text,
  card_mask text,
  card_name text,
  rrn text,
  operation_code text,
  error_code text,
  error_message text,
  redirect_url text,
  callback_received_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

-- Users can view their own transactions
CREATE POLICY "Users can view own transactions" ON public.payment_transactions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Users can insert their own transactions
CREATE POLICY "Users can create own transactions" ON public.payment_transactions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Service role can update (for callback)
CREATE POLICY "Service role can update transactions" ON public.payment_transactions
  FOR UPDATE TO authenticated
  USING (true);

-- Admins can view all
CREATE POLICY "Admins can view all transactions" ON public.payment_transactions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Index
CREATE INDEX idx_payment_transactions_user_id ON public.payment_transactions(user_id);
CREATE INDEX idx_payment_transactions_order_id ON public.payment_transactions(order_id);
CREATE INDEX idx_payment_transactions_status ON public.payment_transactions(status);

-- Updated at trigger
CREATE TRIGGER update_payment_transactions_updated_at
  BEFORE UPDATE ON public.payment_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
