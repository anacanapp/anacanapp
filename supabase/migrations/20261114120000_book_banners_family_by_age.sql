-- Owner 2026-11-14: new PDF book banners with Azerbaijani family scenes (scripts/banners/specs/books-family-20261114.json,
-- scenes from Nano Banana Pro). Only these four creatives stay live, each shown to Azerbaijani mothers whose child is the
-- matching age (target_child_age_*_days, v3 inventory; requires_v3 is generated). Home and Community. All older /books rows
-- are switched off. Measured clicks via the "Anacan" brand (admin_brand_action_v1 'assign_banner' in the apply script).
-- Data only. Idempotent by image URL + placement.
--   kitab-a1-korpe   6–18 months   (180–540 days)
--   kitab-a6-printer 18 months–6 y (540–2190)
--   kitab-a2-boya    3–6 y         (1095–2190)
--   kitab-a5-herf    4–6 y         (1460–2190)
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

UPDATE public.banners SET is_active = false, updated_at = now()
 WHERE link_url = '/books' AND image_url NOT LIKE '%/kitab-a_-%-20261114.jpg' AND is_active;

INSERT INTO public.banners (title, title_az, image_url, link_type, link_url, placement, banner_type, is_active, sort_order,
                            target_languages, target_countries, target_life_stages, audience_tiers,
                            target_child_age_min_days, target_child_age_max_days, creative_options, start_date)
SELECT v.title, v.title_az,
       'https://api.anacan.az/storage/v1/object/public/assets/banners/promo/' || v.img || '-20261114.jpg',
       'internal', '/books', p.placement, 'image', true, 0,
       ARRAY['az'], ARRAY['AZ'], ARRAY['mommy'], ARRAY['free', 'premium'],
       v.min_days, v.max_days, '{"min_app_version": "49"}'::jsonb, now()
  FROM (VALUES
    ('PDF books: turn the first pages together', 'PDF kitablar: İlk kitabı birlikdə vərəqləyin', 'kitab-a1-korpe', 180, 540),
    ('PDF books: print at home, start now', 'PDF kitablar: Evdə çap et, dərhal başla', 'kitab-a6-printer', 540, 2190),
    ('PDF books: print, read and play', 'PDF kitablar: Çap et, oxuyun və oynayın', 'kitab-a2-boya', 1095, 2190),
    ('PDF books: letters and lines through play', 'PDF kitablar: Hərflər və xətlər oyunla', 'kitab-a5-herf', 1460, 2190)
  ) AS v(title, title_az, img, min_days, max_days)
 CROSS JOIN (VALUES ('home_top'), ('community_top')) AS p(placement)
 WHERE NOT EXISTS (SELECT 1 FROM public.banners b
                    WHERE b.image_url LIKE '%' || v.img || '-20261114.jpg' AND b.placement = p.placement);

COMMIT;
