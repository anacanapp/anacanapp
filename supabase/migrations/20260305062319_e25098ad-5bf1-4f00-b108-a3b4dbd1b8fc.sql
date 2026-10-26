
-- Add original_price to products for sale pricing
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS original_price numeric DEFAULT NULL;

-- Create coupons table
CREATE TABLE public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text,
  discount_type text NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value numeric NOT NULL DEFAULT 0,
  min_order_amount numeric DEFAULT 0,
  max_uses integer DEFAULT NULL,
  used_count integer DEFAULT 0,
  applicable_to text[] NOT NULL DEFAULT ARRAY['shop'],
  is_active boolean DEFAULT true,
  starts_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Track coupon usage per user
CREATE TABLE public.coupon_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid REFERENCES public.coupons(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  order_type text NOT NULL DEFAULT 'shop',
  order_id text,
  discount_amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_usage ENABLE ROW LEVEL SECURITY;

-- Everyone can read active coupons (to validate codes)
CREATE POLICY "Anyone can read active coupons" ON public.coupons FOR SELECT TO authenticated USING (is_active = true);
-- Admins full access
CREATE POLICY "Admins manage coupons" ON public.coupons FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Users can see their own usage
CREATE POLICY "Users see own usage" ON public.coupon_usage FOR SELECT TO authenticated USING (user_id = auth.uid());
-- Users can insert own usage
CREATE POLICY "Users insert own usage" ON public.coupon_usage FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
-- Admins manage all usage
CREATE POLICY "Admins manage usage" ON public.coupon_usage FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
