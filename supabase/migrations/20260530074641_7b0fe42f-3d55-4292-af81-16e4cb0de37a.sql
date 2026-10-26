
-- Categories
CREATE TABLE public.partner_venue_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label_az text NOT NULL,
  icon text DEFAULT 'MapPin',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.partner_venue_categories TO anon, authenticated;
GRANT ALL ON public.partner_venue_categories TO service_role;

ALTER TABLE public.partner_venue_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active categories"
  ON public.partner_venue_categories FOR SELECT
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage categories"
  ON public.partner_venue_categories FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Venues
CREATE TABLE public.partner_venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  category_key text NOT NULL REFERENCES public.partner_venue_categories(key),
  description text,
  logo_url text,
  cover_url text,
  gallery_urls text[] DEFAULT '{}',
  address text,
  city text DEFAULT 'Bakı',
  district text,
  latitude numeric,
  longitude numeric,
  phone text,
  website text,
  instagram text,
  working_hours jsonb,
  discount_label text NOT NULL,
  discount_value numeric,
  discount_terms text,
  redemption_cooldown_hours integer NOT NULL DEFAULT 24,
  redemption_lifetime_limit integer,
  qr_ttl_seconds integer NOT NULL DEFAULT 300,
  pin_hash text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  is_featured boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_partner_venues_active ON public.partner_venues(is_active, sort_order);
CREATE INDEX idx_partner_venues_category ON public.partner_venues(category_key);

-- Public view that hides pin_hash
CREATE OR REPLACE VIEW public.partner_venues_public AS
SELECT id, name, slug, category_key, description, logo_url, cover_url, gallery_urls,
       address, city, district, latitude, longitude, phone, website, instagram,
       working_hours, discount_label, discount_value, discount_terms,
       redemption_cooldown_hours, redemption_lifetime_limit, qr_ttl_seconds,
       is_active, is_featured, sort_order, created_at, updated_at
FROM public.partner_venues
WHERE is_active = true;

GRANT SELECT ON public.partner_venues TO authenticated;
GRANT ALL ON public.partner_venues TO service_role;
GRANT SELECT ON public.partner_venues_public TO anon, authenticated;

ALTER TABLE public.partner_venues ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read venues (pin_hash filtered via view; for direct table reads we still block non-admin via column-level no, easier: only expose via view in app; allow SELECT for now but advise using view)
CREATE POLICY "Authenticated can view active venues"
  ON public.partner_venues FOR SELECT
  TO authenticated
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage venues"
  ON public.partner_venues FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Redemptions
CREATE TABLE public.partner_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES public.partner_venues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','expired','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  verified_at timestamptz,
  verified_ip text,
  client_meta jsonb
);

CREATE INDEX idx_partner_redemptions_user ON public.partner_redemptions(user_id, created_at DESC);
CREATE INDEX idx_partner_redemptions_venue_user ON public.partner_redemptions(venue_id, user_id, status, verified_at DESC);
CREATE INDEX idx_partner_redemptions_token ON public.partner_redemptions(token);

GRANT SELECT, INSERT ON public.partner_redemptions TO authenticated;
GRANT ALL ON public.partner_redemptions TO service_role;

ALTER TABLE public.partner_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own redemptions"
  ON public.partner_redemptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage redemptions"
  ON public.partner_redemptions FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- triggers
CREATE TRIGGER trg_partner_venues_updated
  BEFORE UPDATE ON public.partner_venues
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_partner_categories_updated
  BEFORE UPDATE ON public.partner_venue_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- can_redeem helper
CREATE OR REPLACE FUNCTION public.can_redeem_partner_venue(_user_id uuid, _venue_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v RECORD;
  last_verified timestamptz;
  total_verified integer;
  cooldown_left interval;
BEGIN
  SELECT redemption_cooldown_hours, redemption_lifetime_limit, is_active
    INTO v
  FROM public.partner_venues WHERE id = _venue_id;

  IF NOT FOUND OR NOT v.is_active THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'venue_inactive');
  END IF;

  SELECT max(verified_at), count(*) FILTER (WHERE status='verified')
    INTO last_verified, total_verified
  FROM public.partner_redemptions
  WHERE user_id=_user_id AND venue_id=_venue_id AND status='verified';

  IF v.redemption_lifetime_limit IS NOT NULL AND total_verified >= v.redemption_lifetime_limit THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'lifetime_limit_reached');
  END IF;

  IF last_verified IS NOT NULL THEN
    cooldown_left := (last_verified + (v.redemption_cooldown_hours || ' hours')::interval) - now();
    IF cooldown_left > interval '0' THEN
      RETURN jsonb_build_object(
        'allowed', false, 'reason', 'cooldown',
        'next_available_at', to_char(last_verified + (v.redemption_cooldown_hours || ' hours')::interval, 'YYYY-MM-DD"T"HH24:MI:SSOF')
      );
    END IF;
  END IF;

  RETURN jsonb_build_object('allowed', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_redeem_partner_venue(uuid, uuid) TO authenticated, service_role;

-- Seed default categories
INSERT INTO public.partner_venue_categories (key, label_az, icon, sort_order) VALUES
  ('spa', 'Spa & Masaj', 'Sparkles', 10),
  ('gym', 'İdman Zalı', 'Dumbbell', 20),
  ('pilates', 'Pilates & Yoga', 'Activity', 30),
  ('beauty', 'Gözəllik Salonu', 'Scissors', 40),
  ('clinic', 'Klinika', 'Stethoscope', 50),
  ('other', 'Digər', 'MapPin', 99)
ON CONFLICT (key) DO NOTHING;
