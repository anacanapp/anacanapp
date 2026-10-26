-- ============================================================
-- Son9: user_children dublikat qoruması
-- Problem: onboarding + useChildren seed yarışı eyni uşağı bir neçə dəfə yaradırdı
-- Həll: mövcud dublikatları deaktiv et + aktiv sətirlər üçün unikal indeks
-- ============================================================

-- 1) Mövcud dublikatları təmizlə: hər (user, ad, doğum tarixi) üçün ən köhnəsi qalır
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY user_id, name, birth_date
           ORDER BY created_at ASC, id ASC
         ) AS rn
  FROM public.user_children
  WHERE is_active = true
)
UPDATE public.user_children c
SET is_active = false
FROM ranked r
WHERE c.id = r.id AND r.rn > 1;

-- 2) Unikal qoruma (yalnız aktiv sətirlər — silinmiş uşaq yenidən əlavə oluna bilər)
CREATE UNIQUE INDEX IF NOT EXISTS user_children_unique_active
ON public.user_children (user_id, name, birth_date)
WHERE is_active = true;

-- 3) Yoxlama: aktiv dublikat qalmamalıdır (0 gözlənilir)
SELECT count(*) AS aktiv_dublikat
FROM (
  SELECT user_id, name, birth_date
  FROM public.user_children
  WHERE is_active = true
  GROUP BY user_id, name, birth_date
  HAVING count(*) > 1
) d;
