
-- Create cakes table for cake products by month and milestone
CREATE TABLE public.cakes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  image_url TEXT,
  category TEXT NOT NULL DEFAULT 'month', -- 'month' or 'milestone'
  month_number INTEGER, -- 1-12 for monthly cakes, null for milestone
  milestone_type TEXT, -- e.g. 'first_tooth', 'first_step', 'first_word' etc.
  milestone_label TEXT, -- Display label like "İlk Diş", "İlk Addım"
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create cake_orders table for customer orders with custom fields
CREATE TABLE public.cake_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  cake_id UUID REFERENCES public.cakes(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  custom_text TEXT, -- text to write on the cake
  child_name TEXT, -- baby's name
  child_age_months INTEGER, -- baby age in months
  custom_fields JSONB DEFAULT '{}', -- flexible additional custom fields
  notes TEXT, -- extra notes from customer
  status TEXT NOT NULL DEFAULT 'pending', -- pending, confirmed, preparing, ready, delivered, cancelled
  total_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  contact_phone TEXT,
  delivery_date DATE,
  delivery_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cake_orders ENABLE ROW LEVEL SECURITY;

-- Cakes are publicly readable (everyone can browse cakes)
CREATE POLICY "Cakes are viewable by everyone"
ON public.cakes FOR SELECT
USING (true);

-- Only admins can manage cakes
CREATE POLICY "Admins can manage cakes"
ON public.cakes FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Users can view their own orders
CREATE POLICY "Users can view own cake orders"
ON public.cake_orders FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can create their own orders
CREATE POLICY "Users can create cake orders"
ON public.cake_orders FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own pending orders
CREATE POLICY "Users can update own pending orders"
ON public.cake_orders FOR UPDATE
TO authenticated
USING (auth.uid() = user_id AND status = 'pending');

-- Admins can view all orders
CREATE POLICY "Admins can view all cake orders"
ON public.cake_orders FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update all orders
CREATE POLICY "Admins can manage cake orders"
ON public.cake_orders FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Triggers for updated_at
CREATE TRIGGER update_cakes_updated_at
BEFORE UPDATE ON public.cakes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cake_orders_updated_at
BEFORE UPDATE ON public.cake_orders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
