-- Owner 2026-11-13: switch the Tortlar promo banners off for now (rows kept; re-enable from Admin → Bannerlər).
BEGIN;
SET LOCAL lock_timeout = '5s';
UPDATE public.banners SET is_active = false, updated_at = now() WHERE is_active AND link_url = '/cakes';
COMMIT;
