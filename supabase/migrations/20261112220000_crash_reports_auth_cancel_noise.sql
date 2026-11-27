-- Crash reports: sign-in cancellations are not errors (owner request 2026-11-12).
-- The filter from 20261107210000 missed Apple's AuthorizationError 1001 (user tapped Cancel; localized in every
-- language, so match the domain + code), "activity is cancelled by the user", Google's "No credentials available"
-- (no Google account on the device) and One Tap "User disabled the feature". Old builds keep sending them, so the
-- server drops them on insert; existing rows of these kinds are removed. Real failures (1000, network, tokens,
-- "doesn't support credential manager") still arrive. crash_reports is CDC enrolled and writer guarded.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

CREATE OR REPLACE FUNCTION public.crash_reports_drop_noise_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  IF NEW.error_message ~ '^\[push:[a-z_]+\] (no_device_tokens|preferences_disabled|duplicate|not_member)$'
     OR public.crash_auth_cancel_v1(NEW.error_message) THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.crash_auth_cancel_v1(p_message text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO 'pg_catalog'
AS $$
  SELECT coalesce(p_message ~ '^\[auth:[a-z]+\] ' AND (
    (p_message ~ 'AuthorizationError' AND p_message ~ '(^|\D)1001(\D|$)')
    OR p_message ~* '(user canceled|user cancelled|cancelled by (the )?user|canceled by (the )?user|popup_closed|12501|no credentials available|user disabled the feature)'), false)
$$;
ALTER FUNCTION public.crash_auth_cancel_v1(text) OWNER TO pgadmin;

DELETE FROM public.crash_reports WHERE error_message LIKE '[auth:%' AND public.crash_auth_cancel_v1(error_message);
COMMIT;
