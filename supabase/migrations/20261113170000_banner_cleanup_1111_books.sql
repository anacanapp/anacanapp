-- Banner cleanup (owner "hamısını et", 2026-11-13). Data only, reversible from the admin Banners page.
--  * Campaign banners whose end_date has passed (11.11 Premium, weekend Premium) are switched off; they already stopped
--    serving at end_date, this only clears them from the active list.
--  * PDF book banners on Alətlər and Profil had 0 clicks in 9-13 Nov (65 and 38 measured impressions); they are
--    switched off. Home and Community book banners stay on (20 and 3 clicks).
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

UPDATE public.banners SET is_active = false, updated_at = now()
 WHERE is_active AND end_date IS NOT NULL AND end_date < now();

UPDATE public.banners SET is_active = false, updated_at = now()
 WHERE is_active AND link_url = '/books' AND placement IN ('tools_top', 'profile_top');

COMMIT;
