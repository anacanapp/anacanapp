-- ============================================================
-- Son15: premium_plans qiymÉ™t yenilÉ™nmÉ™si â€” pricing_2026
-- AylÄ±q $3.99 / Ä°llik $29.99 (USD). Bu cÉ™dvÉ™l istifadÉ™Ã§i paywall-Ä±nda
-- GÃ–RÃœNMÃœR (qiymÉ™tlÉ™r RevenueCat-dÉ™n gÉ™lir) â€” admin MRR/analitika
-- hesablamalarÄ± vÉ™ admin panel Ã¼Ã§Ã¼ndÃ¼r.
-- Qeyd: kodda plan mapping: aylÄ±q â†’ 'premium', illik/lifetime â†’ 'premium_plus'
-- ============================================================

UPDATE public.premium_plans
SET price_monthly = 3.99,
    price_yearly  = 29.99,
    currency      = 'USD'
WHERE name = 'premium';

-- premium_plus = illik abunÉ™Ã§ilÉ™r (29.99/il â‰ˆ 2.50/ay MRR Ã¼Ã§Ã¼n)
UPDATE public.premium_plans
SET price_monthly = 2.50,
    price_yearly  = 29.99,
    currency      = 'USD'
WHERE name = 'premium_plus';

