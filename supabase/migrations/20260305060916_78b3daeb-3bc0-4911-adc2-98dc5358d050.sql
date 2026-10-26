-- Album orders table (same structure as cake_orders)
CREATE TABLE public.album_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  order_number TEXT,
  album_type TEXT NOT NULL DEFAULT 'pregnancy',
  customer_name TEXT NOT NULL,
  contact_phone TEXT,
  delivery_address TEXT,
  notes TEXT,
  total_price NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT,
  payment_status TEXT DEFAULT 'pending',
  payment_proof_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.album_orders ENABLE ROW LEVEL SECURITY;

-- Users can read own orders
CREATE POLICY "Users can view own album orders"
ON public.album_orders FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Users can insert own orders
CREATE POLICY "Users can create own album orders"
ON public.album_orders FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Admins can do everything
CREATE POLICY "Admins can manage all album orders"
ON public.album_orders FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for order number
CREATE TRIGGER set_album_order_number
  BEFORE INSERT ON public.album_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_order_number();

-- Trigger for updated_at
CREATE TRIGGER set_album_orders_updated_at
  BEFORE UPDATE ON public.album_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Baby monthly album photos storage
INSERT INTO storage.buckets (id, name, public) 
VALUES ('baby-album', 'baby-album', true)
ON CONFLICT (id) DO NOTHING;