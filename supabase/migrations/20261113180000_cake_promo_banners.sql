-- Tort promo banners (owner "hamısını et", 2026-11-13; creatives from scripts/banners/specs/cakes-books-20261105.json,
-- prices checked against public.cakes: from 18 AZN, 1-year package 149 AZN). Same set-up as the PDF book banners:
-- image banner, in-app /cakes, Azerbaijani + Azerbaijan, pregnancy and mother stages, v3 inventory (requires_v3 is generated) (measured clicks via
-- the "Anacan" brand, assigned by admin_brand_action_v1 in the apply script). Idempotent by image URL + placement.
--   community_top: tort-1-foto (rotates with the book banner), tools_top: tort-2-uclu, profile_top: tort-3-bir-yas.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

INSERT INTO public.banners (title, title_az, image_url, link_type, link_url, placement, banner_type, is_active, sort_order,
                            target_languages, target_countries, target_life_stages, audience_tiers,
                            creative_options, start_date)
SELECT v.title, v.title_az,
       'https://api.anacan.az/storage/v1/object/public/assets/banners/promo/' || v.img || '-20261113.jpg',
       'internal', '/cakes', v.placement, 'image', true, 1,
       ARRAY['az'], ARRAY['AZ'], ARRAY['bump', 'mommy'], ARRAY['free', 'premium'],
       '{"min_app_version": "49"}'::jsonb, now()
  FROM (VALUES
    ('Cakes: one cake for every month', 'Tortlar: Hər ay üçün bir tort', 'tort-1-foto', 'community_top'),
    ('Cakes: monthly bento cakes', 'Tortlar: Aylıq bento tortlar', 'tort-2-uclu', 'tools_top'),
    ('Cakes: first birthday package', 'Tortlar: İlk ad günü paketi', 'tort-3-bir-yas', 'profile_top')
  ) AS v(title, title_az, img, placement)
 WHERE NOT EXISTS (SELECT 1 FROM public.banners b
                    WHERE b.image_url LIKE '%' || v.img || '-20261113.jpg' AND b.placement = v.placement);

COMMIT;
