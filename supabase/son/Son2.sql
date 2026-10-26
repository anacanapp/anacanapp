-- ============================================================
-- Baby Names i18n: ad bazasının dilə/ölkəyə görə seqmentasiyası
-- lang: 'az' (default) | 'en' | 'tr' | 'ru' — hər dil öz ad dəstini görür.
-- Mövcud "en dəsti" origin_en markeri ilə saxlanılırdı → lang='en'-ə köçürülür.
-- İdempotentdir.
-- ============================================================

ALTER TABLE public.baby_names_db
  ADD COLUMN IF NOT EXISTS lang text NOT NULL DEFAULT 'az';

CREATE INDEX IF NOT EXISTS idx_baby_names_db_lang ON public.baby_names_db (lang, is_active, popularity DESC);

-- Köhnə mexanizm: origin_en dolu olan sətirlər ingilis dəsti idi
UPDATE public.baby_names_db SET lang = 'en' WHERE origin_en IS NOT NULL AND lang = 'az';
