-- ============================================================
-- Son15: premium_plans qiymət yenilənməsi — pricing_2026
-- Aylıq $3.99 / İllik $29.99 (USD). Bu cədvəl istifadəçi paywall-ında
-- GÖRÜNMÜR (qiymətlər RevenueCat-dən gəlir) — admin MRR/analitika
-- hesablamaları və admin panel üçündür.
-- Qeyd: kodda plan mapping: aylıq → 'premium', illik/lifetime → 'premium_plus'
-- ============================================================

UPDATE public.premium_plans
SET price_monthly = 3.99,
    price_yearly  = 29.99,
    currency      = 'USD'
WHERE name = 'premium';

-- premium_plus = illik abunəçilər (29.99/il ≈ 2.50/ay MRR üçün)
UPDATE public.premium_plans
SET price_monthly = 2.50,
    price_yearly  = 29.99,
    currency      = 'USD'
WHERE name = 'premium_plus';

-- Yoxlama
SELECT name, price_monthly, price_yearly, currency
FROM public.premium_plans
ORDER BY sort_order;
