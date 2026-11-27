-- Duzelis79.sql — Google: fill an empty profile country from the request's country again (no app update)
--
-- Why: Duzelis63 filled profiles.country_code from Cloudflare's `cf-ipcountry` request header. After the
-- move to Google (Oct 2026) that header no longer arrives (the gateway also strips CF-IPCountry), and the
-- capture function/triggers are not present on the Google database. Apple/Google sign-in never send a
-- country, so those accounts stayed empty until the user reopened the app and passed CountryGate.
--
-- Google side (applied 2026-11-02 with gcloud, not SQL):
--   backend service `anacan-runtime-backend` custom request header
--   `X-Anacan-Geo-Country: {client_region}`  (ISO 3166-1 alpha-2 of the client's IP; "ZZ" if unknown).
-- PostgREST exposes request headers to SQL as `request.headers` (lower-cased keys).
--
-- Behaviour: on every analytics_events / device_tokens insert made through PostgREST, an EMPTY
-- profiles.country_code is filled once. A country the user chose is never overwritten. The trigger never
-- fails the original insert. Existing relations only (already CDC/writer guarded); profiles writes go
-- through profiles' own CDC triggers. Applied once on Google (psql as supabase_admin).

CREATE OR REPLACE FUNCTION public.capture_country_from_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  h json;
  cc text;
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;
  BEGIN
    h := current_setting('request.headers', true)::json;
  EXCEPTION WHEN OTHERS THEN
    RETURN NEW;
  END;
  IF h IS NULL THEN
    RETURN NEW;
  END IF;
  cc := upper(trim(coalesce(h ->> 'x-anacan-geo-country', h ->> 'cf-ipcountry')));
  IF cc IS NULL OR cc !~ '^[A-Z]{2}$' OR cc IN ('XX', 'T1', 'ZZ') THEN
    RETURN NEW;
  END IF;
  UPDATE public.profiles
     SET country_code = cc
   WHERE user_id = NEW.user_id
     AND (country_code IS NULL OR trim(country_code) = '');
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.capture_country_from_request() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_capture_country ON public.analytics_events;
CREATE TRIGGER trg_capture_country
  BEFORE INSERT ON public.analytics_events
  FOR EACH ROW EXECUTE FUNCTION public.capture_country_from_request();

DROP TRIGGER IF EXISTS trg_capture_country ON public.device_tokens;
CREATE TRIGGER trg_capture_country
  BEFORE INSERT ON public.device_tokens
  FOR EACH ROW EXECUTE FUNCTION public.capture_country_from_request();
