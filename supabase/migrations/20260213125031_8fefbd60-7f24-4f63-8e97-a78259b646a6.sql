
-- Payment methods configuration table
CREATE TABLE public.payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  method_key text UNIQUE NOT NULL,
  label text NOT NULL,
  label_az text,
  description text,
  description_az text,
  icon text,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  config jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active payment methods"
ON public.payment_methods FOR SELECT
USING (true);

CREATE POLICY "Admins can manage payment methods"
ON public.payment_methods FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed default payment methods
INSERT INTO public.payment_methods (method_key, label, label_az, description, description_az, icon, is_active, sort_order) VALUES
('cash', 'Cash on Delivery', 'Qapıda Ödəniş', 'Pay with cash or card on delivery', 'Çatdırılma zamanı nağd və ya kartla ödəniş', 'Banknote', true, 1),
('card_simulated', 'Card Payment', 'Kart Ödənişi', 'Simulated card payment', 'Simulyasiya edilmiş kart ödənişi', 'CreditCard', true, 2),
('c2c_transfer', 'Card-to-Card Transfer', 'Kartdan Karta Köçürmə', 'Transfer to our card and upload proof', 'Kartımıza köçürmə edin və təsdiq yükləyin', 'ArrowLeftRight', true, 3);

-- Add payment columns to cake_orders
ALTER TABLE public.cake_orders 
ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'cash',
ADD COLUMN IF NOT EXISTS payment_proof_url text,
ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pending';

-- Create trigger for updated_at
CREATE TRIGGER update_payment_methods_updated_at
BEFORE UPDATE ON public.payment_methods
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
