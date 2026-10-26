
DROP VIEW IF EXISTS public.partner_venues_public;

CREATE VIEW public.partner_venues_public
WITH (security_invoker = on) AS
SELECT id, name, slug, category_key, description, logo_url, cover_url, gallery_urls,
       address, city, district, latitude, longitude, phone, website, instagram,
       working_hours, discount_label, discount_value, discount_terms,
       redemption_cooldown_hours, redemption_lifetime_limit, qr_ttl_seconds,
       is_active, is_featured, sort_order, created_at, updated_at
FROM public.partner_venues
WHERE is_active = true;

GRANT SELECT ON public.partner_venues_public TO anon, authenticated;
