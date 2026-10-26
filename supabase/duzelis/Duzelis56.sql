-- Duzelis56.sql — Premature (vaxtından əvvəl doğulmuş) körpə dəstəyi: sxem
--
-- MƏQSƏD: hər körpə üçün orijinal gözlənilən doğum tarixini (EDD) saxlamaq.
-- Bundan hər şey çıxarılır:
--   • gestasiya yaşı doğumda = 280 − (due_date − birth_date) gün
--   • premature = gestasiya < 259 gün (37 həftə, WHO tərifi)
--   • korreksiya olunmuş yaş = bu günə qədər due_date-dən keçən müddət
--     (yalnız premature körpələrdə, 24 ay korreksiya yaşına qədər tətbiq olunur)
--
-- NİYƏ user_children-də (profiles-də yox):
--   1) ProfileEditScreen mommy rejimində profiles.due_date-i NULL-layır —
--      profildə saxlanılan dəyər ilk redaktədə itirdi.
--   2) Əkiz/üçüzlər çox vaxt premature olur — data hər körpəyə aid olmalıdır.
--
-- Semantika:
--   due_date IS NULL          → məlum deyil (korreksiya tətbiq olunmur)
--   due_date = birth_date     → istifadəçi "vaxtında doğulub" təsdiqləyib
--   due_date > birth_date     → erkən doğum; fərq = korreksiya günləri
--
-- Bu ALTER idempotentdir və mövcud sətirlərə toxunmur (hamısı NULL qalır).

ALTER TABLE public.user_children
  ADD COLUMN IF NOT EXISTS due_date DATE NULL;

COMMENT ON COLUMN public.user_children.due_date IS
  'Orijinal gözlənilən doğum tarixi (EDD). NULL = məlum deyil. birth_date-dən 18+ gün böyükdürsə (gestasiya <259 gün) körpə premature sayılır və 24 aya qədər korreksiya olunmuş yaş tətbiq olunur.';

-- YOXLAMA (SELECT-only):
--   SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_name = 'user_children' AND column_name = 'due_date';
