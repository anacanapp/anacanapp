-- Mərcan Cümə (owner 2026-11-23: "bugündən 30 noyabra qədər"): Anacan Premium Black Friday on anacan.az.
--   * app_settings.web_premium_campaign: 'mercan-2026', now → 2026-11-30 23:59:59 Baku, Epoint AZN yearly 16.99 (was
--     50.98) and monthly 3.39 (was 6.78) = $9.99 / $1.99 at the page's display rate 1 USD = 1.70 AZN. Subscribers keep
--     the price on every renewal until they cancel (existing rule, owner confirmed for this campaign). The previous
--     value is kept in app_settings.web_premium_campaign_before_mercan.
--   * app_settings.dodo_campaign: {campaign 'mercan', codes yearly MERCAN / monthly MERCANAY, page, window} for the
--     Dodo (USD) checkout of foreign visitors (dodo-checkout reads it; the codes are created in Dodo before this runs).
--   * In-app banners: 3 designs × 21 page languages on 5 placements (home_top coral; tools_top + community_top peach;
--     profile_top + ai_chat_top light), external link to the Mərcan page in the banner's language. English also
--     serves ky, et, tk and uk. Free users only (server_tiers; audience_tiers NULL so every build renders them),
--     window now → 2026-11-30T19:59:59Z. Images ship with the website (anacan.az/website/premium/mercan/banners/). PDF book banners on the same placements pause until the campaign ends.
-- app_settings and banners are CDC enrolled and writer guarded; data only.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
BEGIN
  IF (SELECT count(*) FROM _anacan_gcp_migration.guarded_relations WHERE schema_name = 'public' AND table_name IN ('app_settings', 'banners')) <> 2 THEN
    RAISE EXCEPTION 'MERCAN_GUARD_MISSING';
  END IF;
END $$;

INSERT INTO public.app_settings (key, value, description)
SELECT 'web_premium_campaign_before_mercan', value, 'web_premium_campaign before Mərcan Cümə (2026-11-23), for rollback'
  FROM public.app_settings WHERE key = 'web_premium_campaign'
ON CONFLICT (key) DO NOTHING;

UPDATE public.app_settings
   SET value = jsonb_build_object('active', true, 'name', 'mercan-2026',
                 'starts_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'ends_at', '2026-11-30T23:59:59+04:00',
                 'plans', '{"monthly": {"price": 3.39, "was": 6.78}, "yearly": {"price": 16.99, "was": 50.98}}'::jsonb),
       updated_at = now()
 WHERE key = 'web_premium_campaign';

INSERT INTO public.app_settings (key, value, description)
VALUES ('dodo_campaign', '{}'::jsonb, 'Dodo web checkout campaign discount (dodo-checkout)')
ON CONFLICT (key) DO NOTHING;
UPDATE public.app_settings
   SET value = jsonb_build_object('campaign', 'mercan', 'codes', '{"yearly": "MERCAN", "monthly": "MERCANAY"}'::jsonb,
                 'page', 'https://anacan.az/website/premium/mercan/index.html',
                 'starts_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'ends_at', '2026-11-30T19:59:59Z'),
       updated_at = now()
 WHERE key = 'dodo_campaign';

-- Book banners rest until the campaign ends (they come back by themselves).
UPDATE public.banners
   SET start_date = '2026-11-30T20:00:00Z', updated_at = now()
 WHERE is_active AND link_url = '/books'
   AND placement IN ('home_top', 'tools_top', 'community_top', 'profile_top', 'ai_chat_top')
   AND (start_date IS NULL OR start_date < '2026-11-30T20:00:00Z');

INSERT INTO public.banners (title, title_az, image_url, link_type, link_url, placement, banner_type, is_active, sort_order,
                            target_languages, audience_tiers, creative_options, start_date, end_date)
SELECT 'Mərcan Cümə ' || l.lang || ' ' || p.placement, 'Mərcan Cümə',
       'https://anacan.az/website/premium/mercan/banners/' || p.design || '-' || l.lang || '.webp',
       'external',
       'https://anacan.az/website/premium/mercan/index.html?lang=' || l.lang
         || '&utm_source=app&utm_medium=banner&utm_campaign=mercan&utm_content=' || p.placement,
       p.placement, 'image', true, -10,
       CASE WHEN l.lang = 'en' THEN ARRAY['en', 'ky', 'et', 'tk', 'uk'] ELSE ARRAY[l.lang] END,
       NULL, '{"server_tiers": ["free"]}'::jsonb, now(), '2026-11-30T19:59:59Z'
  FROM (VALUES ('az'), ('en'), ('ru'), ('tr'), ('kk'), ('de'), ('ar'), ('uz'), ('ka'), ('zh'), ('id'), ('fr'), ('es'),
               ('pt'), ('vi'), ('hi'), ('ja'), ('ko'), ('pl'), ('nl'), ('sv')) AS l(lang)
 CROSS JOIN (VALUES ('home_top', 'coral'), ('tools_top', 'peach'), ('community_top', 'peach'),
                    ('profile_top', 'light'), ('ai_chat_top', 'light')) AS p(placement, design)
 WHERE NOT EXISTS (SELECT 1 FROM public.banners b
                    WHERE b.image_url LIKE '%/mercan/banners/' || p.design || '-' || l.lang || '.webp' AND b.placement = p.placement);

DO $$
BEGIN
  IF (public.web_premium_campaign_v1() #>> '{plans,yearly,price}')::numeric <> 16.99
     OR (public.web_premium_campaign_v1() #>> '{plans,monthly,price}')::numeric <> 3.39
     OR coalesce((public.web_premium_campaign_v1()->>'active')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'MERCAN_CAMPAIGN_NOT_ACTIVE';
  END IF;
  IF (SELECT count(*) FROM public.banners WHERE image_url LIKE '%/premium/mercan/banners/%') <> 105 THEN
    RAISE EXCEPTION 'MERCAN_BANNERS_COUNT';
  END IF;
END $$;

COMMIT;
