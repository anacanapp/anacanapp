-- Mərcan Cümə banners now open the in-app Premium paywall instead of the anacan.az campaign page.
-- Owner 2026-11-26: the Mərcan discount is live in-app via store prices (App Store all territories;
-- Play in the territories whose prices were lowered), so a banner tap should open the app paywall
-- (discounted store price for the viewer's region) rather than leaving to the browser.
-- BannerSlot handles link_type='internal' link_url='/premium' → parseDeeplink → screen 'billing'
-- → paywall for free users. Only the still-active Mərcan image banners are changed; nothing else.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
BEGIN
  IF (SELECT count(*) FROM _anacan_gcp_migration.guarded_relations WHERE schema_name = 'public' AND table_name = 'banners') <> 1 THEN
    RAISE EXCEPTION 'MERCAN_BANNER_GUARD_MISSING';
  END IF;
END $$;

UPDATE public.banners
   SET link_type = 'internal',
       link_url  = '/premium'
 WHERE title LIKE 'Mərcan Cümə %'
   AND image_url LIKE '%/mercan/banners/%'
   AND link_type = 'external';

SELECT count(*) AS mercan_banners_now_inapp
  FROM public.banners
 WHERE title LIKE 'Mərcan Cümə %' AND link_type = 'internal' AND link_url = '/premium';

COMMIT;
