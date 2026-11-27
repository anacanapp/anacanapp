-- Campaign pushes may open an anacan.az website link (2026-11-11, 11.11 campaign). The dispatcher
-- (admin-notification-dispatch LINK) and the app (src/lib/pushNav.ts: website origins open in the browser)
-- already accept https://anacan.az / www / app links; the create/claim validator only allowed anacan://.
-- Function only; no relation changes.
BEGIN;
CREATE OR REPLACE FUNCTION public.admin_notification_deeplink_ok_v1(p text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$
  SELECT p IS NULL OR (length(p) <= 200 AND (
    p ~ '^(anacan|com\.atlasoon\.anacan)://[A-Za-z0-9/_?=&.-]{1,180}$'
    OR p ~ '^https://(www\.|app\.)?anacan\.az/[A-Za-z0-9/_?=&.%#-]{0,180}$'))
$function$;
COMMIT;
