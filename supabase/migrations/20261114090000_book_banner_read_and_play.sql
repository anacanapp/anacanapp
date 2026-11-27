-- Owner 2026-11-14: the PDF book banner says "read and play", not only "play". New creative
-- kitab-oxu-oyna-20261114.jpg (scripts/banners: row layout, eyebrow "Nağıl · boyama · hərflər",
-- title "Çap et, oxuyun və oynayın", story-book covers). All /books banner rows get it; active state is unchanged
-- (Home and Community on, Tools and Profile off). Data only.
BEGIN;
SET LOCAL lock_timeout = '5s';
UPDATE public.banners
   SET image_url = 'https://api.anacan.az/storage/v1/object/public/assets/banners/promo/kitab-oxu-oyna-20261114.jpg',
       title = 'PDF books: print, read and play', title_az = 'PDF kitablar: Çap et, oxuyun və oynayın', updated_at = now()
 WHERE link_url = '/books' AND image_url LIKE '%kitab-2-sira-20261109%';
COMMIT;
