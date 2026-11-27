-- Website yearly Premium price 26.99 -> 24.99 AZN (owner request 2026-11-13). app_settings.web_premium_epoint feeds both
-- website sales paths: the renewing subscription outside campaigns (web_premium_offer_v1, /website/premium/abune) and
-- the e-mail checkout pass (web-shop). Monthly stays 3.99. Existing subscriptions keep the price locked at signup.
-- Applies only while the stored yearly price is still 26.99. app_settings is CDC enrolled and writer guarded.
BEGIN;
SET LOCAL lock_timeout = '5s';
UPDATE public.app_settings
   SET value = jsonb_set(CASE WHEN jsonb_typeof(value) = 'string' THEN (value #>> '{}')::jsonb ELSE value END,
                         '{prices,yearly}', '24.99'::jsonb),
       updated_at = now()
 WHERE key = 'web_premium_epoint'
   AND (CASE WHEN jsonb_typeof(value) = 'string' THEN (value #>> '{}')::jsonb ELSE value END) #>> '{prices,yearly}' = '26.99';
DO $$ BEGIN
  IF (public.web_premium_offer_v1() #>> '{plans,yearly,price}')::numeric <> 24.99
     AND coalesce((public.web_premium_campaign_v1()->>'active')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'WEB_PREMIUM_YEARLY_PRICE_NOT_SET'; END IF;
END $$;
COMMIT;
