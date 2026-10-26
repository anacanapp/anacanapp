-- ============================================================
-- Son9: user_children dublikat qorumasÄ±
-- Problem: onboarding + useChildren seed yarÄ±ÅŸÄ± eyni uÅŸaÄŸÄ± bir neÃ§É™ dÉ™fÉ™ yaradÄ±rdÄ±
-- HÉ™ll: mÃ¶vcud dublikatlarÄ± deaktiv et + aktiv sÉ™tirlÉ™r Ã¼Ã§Ã¼n unikal indeks
-- ============================================================

-- 1) MÃ¶vcud dublikatlarÄ± tÉ™mizlÉ™: hÉ™r (user, ad, doÄŸum tarixi) Ã¼Ã§Ã¼n É™n kÃ¶hnÉ™si qalÄ±r
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

-- 2) Unikal qoruma (yalnÄ±z aktiv sÉ™tirlÉ™r â€” silinmiÅŸ uÅŸaq yenidÉ™n É™lavÉ™ oluna bilÉ™r)
CREATE UNIQUE INDEX IF NOT EXISTS user_children_unique_active
ON public.user_children (user_id, name, birth_date)
WHERE is_active = true;

