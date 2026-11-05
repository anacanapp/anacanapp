-- Country of the caller's IP for the first-launch language preselect (native 48).
--
-- The Google load balancer adds `X-Anacan-Geo-Country: {client_region}` to every request
-- (backend service anacan-runtime-backend, see Duzelis79.sql); PostgREST exposes request headers
-- to SQL as `request.headers`. This read-only RPC returns that ISO 3166-1 alpha-2 code, or NULL
-- when it is missing/unknown. It stores nothing, touches no relation and reveals only what the
-- caller's own IP already says, so anon may call it before sign-in.

CREATE OR REPLACE FUNCTION public.request_geo_country()
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  h json;
  cc text;
BEGIN
  BEGIN
    h := current_setting('request.headers', true)::json;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
  IF h IS NULL THEN
    RETURN NULL;
  END IF;
  cc := upper(trim(coalesce(h ->> 'x-anacan-geo-country', h ->> 'cf-ipcountry')));
  IF cc IS NULL OR cc !~ '^[A-Z]{2}$' OR cc IN ('XX', 'T1', 'ZZ') THEN
    RETURN NULL;
  END IF;
  RETURN cc;
END;
$$;

REVOKE ALL ON FUNCTION public.request_geo_country() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_geo_country() TO anon, authenticated;
