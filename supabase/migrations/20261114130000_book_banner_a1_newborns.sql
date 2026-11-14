-- Owner 2026-11-14: banner kitab-a1-korpe ("İlk kitabı birlikdə vərəqləyin") also reaches mothers of babies 0–6 months
-- (target_child_age_min_days 180 -> 0, max stays 540). Data only.
BEGIN;
SET LOCAL lock_timeout = '5s';
UPDATE public.banners SET target_child_age_min_days = 0, updated_at = now()
 WHERE link_url = '/books' AND image_url LIKE '%/kitab-a1-korpe-20261114.jpg';
COMMIT;
