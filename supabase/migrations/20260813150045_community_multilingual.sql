-- ============================================================
-- Son27 — Cəmiyyət: çoxdilli feed + post tərcümə keşi
-- 1) community_post_translations — post-başına, dil-başına AI tərcümə keşi
--    (yazı YALNIZ edge fn (service_role) ilə — client siyasəti yoxdur)
-- 2) user_preferences.feed_languages — istifadəçinin feed dil linzası
-- 3) community_posts üçün feed filtri indeksi
-- 4) Post redaktəsində köhnəlmiş tərcümələri silən trigger
-- 5) Yeni cəmiyyət UI açarları (ru/tr/en)
-- İdempotentdir — təkrar icra təhlükəsizdir.
-- ============================================================

-- 1) Tərcümə keşi cədvəli
CREATE TABLE IF NOT EXISTS public.community_post_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  lang TEXT NOT NULL CHECK (lang IN ('az','en','ru','tr','kk')),
  content TEXT NOT NULL,
  model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, lang)
);

ALTER TABLE public.community_post_translations ENABLE ROW LEVEL SECURITY;

-- Oxu: bütün autentifikasiyalı istifadəçilər (postların özü kimi).
-- Yazı siyasəti QƏSDƏN yoxdur — insert/update yalnız service_role (edge fn).
DROP POLICY IF EXISTS "Authenticated can read post translations" ON public.community_post_translations;
CREATE POLICY "Authenticated can read post translations"
  ON public.community_post_translations FOR SELECT
  TO authenticated
  USING (true);

-- 2) Feed dil linzası (NULL = client ölkə defaultunu hesablayıb yazacaq)
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS feed_languages TEXT[];

-- 3) Feed filtri üçün indeks (language IN (...) + is_active + group_id sorğusu)
CREATE INDEX IF NOT EXISTS idx_community_posts_lang_feed
  ON public.community_posts (language, is_active, group_id, created_at DESC);

-- 4) Post məzmunu dəyişəndə köhnə tərcümələri sil (stale cache qadağası)
CREATE OR REPLACE FUNCTION public.purge_post_translations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.content IS DISTINCT FROM OLD.content THEN
    DELETE FROM public.community_post_translations WHERE post_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_purge_post_translations ON public.community_posts;
CREATE TRIGGER trg_purge_post_translations
  AFTER UPDATE OF content ON public.community_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.purge_post_translations();

-- 5) UI açarları (ru/tr/en; az mətnləri kodda default kimi mövcuddur)
INSERT INTO public.translations (key, lang, value, namespace) VALUES
  ('postcard_tercumeni_gor', 'en', 'See translation', 'common'),
  ('postcard_tercumeni_gor', 'ru', 'Показать перевод', 'common'),
  ('postcard_tercumeni_gor', 'tr', 'Çeviriyi gör', 'common'),
  ('postcard_orijinali_goster', 'en', 'Show original', 'common'),
  ('postcard_orijinali_goster', 'ru', 'Показать оригинал', 'common'),
  ('postcard_orijinali_goster', 'tr', 'Orijinali göster', 'common'),
  ('postcard_tercume_olunur', 'en', 'Translating…', 'common'),
  ('postcard_tercume_olunur', 'ru', 'Переводится…', 'common'),
  ('postcard_tercume_olunur', 'tr', 'Çevriliyor…', 'common'),
  ('postcard_tercume_xetasi', 'en', 'Translation failed — try again', 'common'),
  ('postcard_tercume_xetasi', 'ru', 'Перевод не удался — попробуйте ещё раз', 'common'),
  ('postcard_tercume_xetasi', 'tr', 'Çeviri başarısız — tekrar deneyin', 'common'),
  ('createpost_post_dili', 'en', 'Post language', 'common'),
  ('createpost_post_dili', 'ru', 'Язык поста', 'common'),
  ('createpost_post_dili', 'tr', 'Gönderi dili', 'common'),
  ('community_feed_dilleri', 'en', 'Feed languages', 'common'),
  ('community_feed_dilleri', 'ru', 'Языки ленты', 'common'),
  ('community_feed_dilleri', 'tr', 'Akış dilleri', 'common'),
  ('community_diger_dillerde', 'en', 'In other languages', 'common'),
  ('community_diger_dillerde', 'ru', 'На других языках', 'common'),
  ('community_diger_dillerde', 'tr', 'Diğer dillerde', 'common'),
  ('community_min_bir_dil', 'en', 'At least one language must stay selected', 'common'),
  ('community_min_bir_dil', 'ru', 'Должен остаться хотя бы один язык', 'common'),
  ('community_min_bir_dil', 'tr', 'En az bir dil seçili kalmalıdır', 'common')
ON CONFLICT (key, lang) DO NOTHING;
