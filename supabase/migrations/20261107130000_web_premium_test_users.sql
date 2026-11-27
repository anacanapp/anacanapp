-- Web Premium test offer: besides admins, accounts listed in app_settings.web_premium_test.user_ids (uuid strings)
-- also see/buy the tiny-price test plan. No new relations.

CREATE OR REPLACE FUNCTION public.web_premium_test_offer_v1(p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v jsonb;
  v_price numeric;
BEGIN
  IF p_user IS NULL THEN RETURN NULL; END IF;
  SELECT value INTO v FROM public.app_settings WHERE key = 'web_premium_test';
  IF jsonb_typeof(v) = 'string' THEN v := (v #>> '{}')::jsonb; END IF;
  IF v IS NULL OR jsonb_typeof(v) <> 'object' OR coalesce((v->>'enabled')::boolean, false) IS NOT TRUE THEN RETURN NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user AND role = 'admin')
     AND NOT (jsonb_typeof(v->'user_ids') = 'array' AND (v->'user_ids') ? p_user::text) THEN
    RETURN NULL;
  END IF;
  BEGIN v_price := (v->>'price')::numeric; EXCEPTION WHEN OTHERS THEN RETURN NULL; END;
  IF v_price IS NULL OR v_price NOT BETWEEN 0.01 AND 1 OR coalesce(v->>'plan', '') NOT IN ('monthly', 'yearly') THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('plan', v->>'plan', 'price', round(v_price, 2));
END
$function$;

REVOKE ALL ON FUNCTION public.web_premium_test_offer_v1(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.web_premium_test_offer_v1(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
