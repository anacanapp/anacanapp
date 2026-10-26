-- Duzelis15: Admin bannerləri üçün TAM hədəfləmə (targeting) sistemi.
-- Əvvəllər banners cədvəlində is_premium_only-dan başqa HEÇ bir hədəfləmə yox idi —
-- hər banner hər kəsə (bütün dillər/ölkələr/mərhələlər) eyni göstərilirdi, view_count
-- sütunu isə heç vaxt artırılmırdı (ölü sütun idi).
--
-- Bu duzeliş əlavə edir:
--   1) target_life_stages TEXT[] — Dövr(flow)/Hamiləlik(bump)/Analıq(mommy)/Partnyor(partner),
--      NULL/boş = hamısı. Tək, bir neçə və ya bütün mərhələlərə göstərmək mümkündür.
--   2) target_languages TEXT[] — NULL/boş = bütün dillər (az/en/ru/tr/kk/de/ar).
--   3) target_countries TEXT[] — NULL/boş = bütün ölkələr (ISO alpha-2, məs. AZ, TR).
--   4) max_impressions_per_user INTEGER — NULL = limitsiz. Təyin olunubsa, istifadəçi bu
--      sayda gördükdən sonra banner ona bir daha göstərilmir (tezlik məhdudlaşdırması).
--   5) banner_impressions cədvəli — hər istifadəçi/banner cütü üçün görüntülənmə sayğacı
--      (community_post_reads ilə eyni upsert-on-conflict nümunəsi).
--   6) increment_banner_impression()/increment_banner_click() RPC funksiyaları — atomik
--      artırma (əvvəlki click_count "oxu-sonra-yaz" yarışı olan qeyri-atomik koddan fərqli),
--      + view_count sütununu NƏHAYƏT işə salır.
-- Idempotent — safe to re-run.

ALTER TABLE public.banners
  ADD COLUMN IF NOT EXISTS target_life_stages TEXT[],
  ADD COLUMN IF NOT EXISTS target_languages TEXT[],
  ADD COLUMN IF NOT EXISTS target_countries TEXT[],
  ADD COLUMN IF NOT EXISTS max_impressions_per_user INTEGER;

COMMENT ON COLUMN public.banners.target_life_stages IS 'NULL/boş = bütün mərhələlər göstərilir. Dəyərlər: flow, bump, mommy, partner.';
COMMENT ON COLUMN public.banners.target_languages IS 'NULL/boş = bütün dillər göstərilir. Dəyərlər: az, en, ru, tr, kk, de, ar.';
COMMENT ON COLUMN public.banners.target_countries IS 'NULL/boş = bütün ölkələr göstərilir. ISO alpha-2 kodları (AZ, TR, RU və s.), böyük hərflə.';
COMMENT ON COLUMN public.banners.max_impressions_per_user IS 'NULL = limitsiz göstərmə. Təyin olunubsa, istifadəçi bu sayda gördükdən sonra banner ona bir daha göstərilmir.';

-- ============================================================
-- İmpression (görüntülənmə) izləmə cədvəli
-- ============================================================
CREATE TABLE IF NOT EXISTS public.banner_impressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  banner_id UUID NOT NULL REFERENCES public.banners(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  seen_count INTEGER NOT NULL DEFAULT 1,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(banner_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_banner_impressions_user ON public.banner_impressions(user_id);
CREATE INDEX IF NOT EXISTS idx_banner_impressions_banner ON public.banner_impressions(banner_id);

ALTER TABLE public.banner_impressions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own banner impressions" ON public.banner_impressions;
CREATE POLICY "Users can view own banner impressions" ON public.banner_impressions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all banner impressions" ON public.banner_impressions;
CREATE POLICY "Admins can view all banner impressions" ON public.banner_impressions
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- QEYD: birbaşa INSERT/UPDATE policy YOXDUR (bilərəkdən) — yazma YALNIZ aşağıdakı
-- SECURITY DEFINER funksiya vasitəsilə olur, ki istifadəçi başqasının adından və ya
-- saxta say ilə yazı apara bilməsin.

-- ============================================================
-- Atomik artırma funksiyaları (əvvəlki click_count "oxu-sonra-yaz" yarışını düzəldir
-- + view_count-u nəhayət işə salır)
-- ============================================================
CREATE OR REPLACE FUNCTION public.increment_banner_impression(p_banner_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.banner_impressions (banner_id, user_id, seen_count, first_seen_at, last_seen_at)
  VALUES (p_banner_id, auth.uid(), 1, now(), now())
  ON CONFLICT (banner_id, user_id)
  DO UPDATE SET seen_count = public.banner_impressions.seen_count + 1, last_seen_at = now();

  UPDATE public.banners SET view_count = COALESCE(view_count, 0) + 1 WHERE id = p_banner_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_banner_impression(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.increment_banner_click(p_banner_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.banners SET click_count = COALESCE(click_count, 0) + 1 WHERE id = p_banner_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_banner_click(UUID) TO authenticated;

-- ============================================================
-- Yeni admin UI translation keys — DB overlay bütün 7 dil üçün
-- (lokal seed faylları da birbaşa yeniləndi).
-- ============================================================
INSERT INTO public.translations (key, lang, value, namespace) VALUES
  ('adminbanners_hedef_merheleler', 'az', 'Hədəf mərhələlər', 'admin'),
  ('adminbanners_hedef_merheleler', 'en', 'Target life stages', 'admin'),
  ('adminbanners_hedef_merheleler', 'ru', 'Целевые этапы', 'admin'),
  ('adminbanners_hedef_merheleler', 'tr', 'Hedef aşamalar', 'admin'),
  ('adminbanners_hedef_merheleler', 'kk', 'Мақсатты кезеңдер', 'admin'),
  ('adminbanners_hedef_merheleler', 'de', 'Ziel-Lebensphasen', 'admin'),
  ('adminbanners_hedef_merheleler', 'ar', 'مراحل الحياة المستهدفة', 'admin'),

  ('adminbanners_hedef_merheleler_desc', 'az', 'Heç biri seçilməzsə, bütün mərhələlərə göstərilir', 'admin'),
  ('adminbanners_hedef_merheleler_desc', 'en', 'If none selected, shown to all life stages', 'admin'),
  ('adminbanners_hedef_merheleler_desc', 'ru', 'Если ничего не выбрано, показывается на всех этапах', 'admin'),
  ('adminbanners_hedef_merheleler_desc', 'tr', 'Hiçbiri seçilmezse tüm aşamalara gösterilir', 'admin'),
  ('adminbanners_hedef_merheleler_desc', 'kk', 'Ешқайсысы таңдалмаса, барлық кезеңдерде көрсетіледі', 'admin'),
  ('adminbanners_hedef_merheleler_desc', 'de', 'Wenn keine ausgewählt ist, wird es in allen Phasen angezeigt', 'admin'),
  ('adminbanners_hedef_merheleler_desc', 'ar', 'إذا لم يتم تحديد أي شيء، يظهر في جميع المراحل', 'admin'),

  ('adminbanners_hedef_diller', 'az', 'Hədəf dillər', 'admin'),
  ('adminbanners_hedef_diller', 'en', 'Target languages', 'admin'),
  ('adminbanners_hedef_diller', 'ru', 'Целевые языки', 'admin'),
  ('adminbanners_hedef_diller', 'tr', 'Hedef diller', 'admin'),
  ('adminbanners_hedef_diller', 'kk', 'Мақсатты тілдер', 'admin'),
  ('adminbanners_hedef_diller', 'de', 'Zielsprachen', 'admin'),
  ('adminbanners_hedef_diller', 'ar', 'اللغات المستهدفة', 'admin'),

  ('adminbanners_hedef_diller_desc', 'az', 'Heç biri seçilməzsə, bütün dillərə göstərilir', 'admin'),
  ('adminbanners_hedef_diller_desc', 'en', 'If none selected, shown in all languages', 'admin'),
  ('adminbanners_hedef_diller_desc', 'ru', 'Если ничего не выбрано, показывается на всех языках', 'admin'),
  ('adminbanners_hedef_diller_desc', 'tr', 'Hiçbiri seçilmezse tüm dillerde gösterilir', 'admin'),
  ('adminbanners_hedef_diller_desc', 'kk', 'Ешқайсысы таңдалмаса, барлық тілдерде көрсетіледі', 'admin'),
  ('adminbanners_hedef_diller_desc', 'de', 'Wenn keine ausgewählt ist, wird es in allen Sprachen angezeigt', 'admin'),
  ('adminbanners_hedef_diller_desc', 'ar', 'إذا لم يتم تحديد أي شيء، يظهر بجميع اللغات', 'admin'),

  ('adminbanners_hedef_olkeler', 'az', 'Hədəf ölkələr', 'admin'),
  ('adminbanners_hedef_olkeler', 'en', 'Target countries', 'admin'),
  ('adminbanners_hedef_olkeler', 'ru', 'Целевые страны', 'admin'),
  ('adminbanners_hedef_olkeler', 'tr', 'Hedef ülkeler', 'admin'),
  ('adminbanners_hedef_olkeler', 'kk', 'Мақсатты елдер', 'admin'),
  ('adminbanners_hedef_olkeler', 'de', 'Zielländer', 'admin'),
  ('adminbanners_hedef_olkeler', 'ar', 'الدول المستهدفة', 'admin'),

  ('adminbanners_hedef_olkeler_desc', 'az', 'Heç biri seçilməzsə, bütün ölkələrə göstərilir', 'admin'),
  ('adminbanners_hedef_olkeler_desc', 'en', 'If none selected, shown in all countries', 'admin'),
  ('adminbanners_hedef_olkeler_desc', 'ru', 'Если ничего не выбрано, показывается во всех странах', 'admin'),
  ('adminbanners_hedef_olkeler_desc', 'tr', 'Hiçbiri seçilmezse tüm ülkelerde gösterilir', 'admin'),
  ('adminbanners_hedef_olkeler_desc', 'kk', 'Ешқайсысы таңдалмаса, барлық елдерде көрсетіледі', 'admin'),
  ('adminbanners_hedef_olkeler_desc', 'de', 'Wenn keine ausgewählt ist, wird es in allen Ländern angezeigt', 'admin'),
  ('adminbanners_hedef_olkeler_desc', 'ar', 'إذا لم يتم تحديد أي شيء، يظهر في جميع الدول', 'admin'),

  ('adminbanners_olke_axtar', 'az', 'Ölkə axtar...', 'admin'),
  ('adminbanners_olke_axtar', 'en', 'Search country...', 'admin'),
  ('adminbanners_olke_axtar', 'ru', 'Поиск страны...', 'admin'),
  ('adminbanners_olke_axtar', 'tr', 'Ülke ara...', 'admin'),
  ('adminbanners_olke_axtar', 'kk', 'Елді іздеу...', 'admin'),
  ('adminbanners_olke_axtar', 'de', 'Land suchen...', 'admin'),
  ('adminbanners_olke_axtar', 'ar', 'ابحث عن دولة...', 'admin'),

  ('adminbanners_maks_gorunme', 'az', 'Maksimum göstərilmə sayı (istifadəçi başına)', 'admin'),
  ('adminbanners_maks_gorunme', 'en', 'Max impressions (per user)', 'admin'),
  ('adminbanners_maks_gorunme', 'ru', 'Макс. показов (на пользователя)', 'admin'),
  ('adminbanners_maks_gorunme', 'tr', 'Maks. gösterim (kullanıcı başına)', 'admin'),
  ('adminbanners_maks_gorunme', 'kk', 'Макс. көрсету саны (пайдаланушыға)', 'admin'),
  ('adminbanners_maks_gorunme', 'de', 'Max. Impressionen (pro Nutzer)', 'admin'),
  ('adminbanners_maks_gorunme', 'ar', 'الحد الأقصى للظهور (لكل مستخدم)', 'admin'),

  ('adminbanners_maks_gorunme_placeholder', 'az', 'Limitsiz', 'admin'),
  ('adminbanners_maks_gorunme_placeholder', 'en', 'Unlimited', 'admin'),
  ('adminbanners_maks_gorunme_placeholder', 'ru', 'Без ограничений', 'admin'),
  ('adminbanners_maks_gorunme_placeholder', 'tr', 'Sınırsız', 'admin'),
  ('adminbanners_maks_gorunme_placeholder', 'kk', 'Шектеусіз', 'admin'),
  ('adminbanners_maks_gorunme_placeholder', 'de', 'Unbegrenzt', 'admin'),
  ('adminbanners_maks_gorunme_placeholder', 'ar', 'غير محدود', 'admin'),

  ('adminbanners_baslama_tarixi', 'az', 'Başlama tarixi (istəyə bağlı)', 'admin'),
  ('adminbanners_baslama_tarixi', 'en', 'Start date (optional)', 'admin'),
  ('adminbanners_baslama_tarixi', 'ru', 'Дата начала (необязательно)', 'admin'),
  ('adminbanners_baslama_tarixi', 'tr', 'Başlangıç tarihi (isteğe bağlı)', 'admin'),
  ('adminbanners_baslama_tarixi', 'kk', 'Басталу күні (міндетті емес)', 'admin'),
  ('adminbanners_baslama_tarixi', 'de', 'Startdatum (optional)', 'admin'),
  ('adminbanners_baslama_tarixi', 'ar', 'تاريخ البدء (اختياري)', 'admin'),

  ('adminbanners_bitme_tarixi', 'az', 'Bitmə tarixi (istəyə bağlı)', 'admin'),
  ('adminbanners_bitme_tarixi', 'en', 'End date (optional)', 'admin'),
  ('adminbanners_bitme_tarixi', 'ru', 'Дата окончания (необязательно)', 'admin'),
  ('adminbanners_bitme_tarixi', 'tr', 'Bitiş tarihi (isteğe bağlı)', 'admin'),
  ('adminbanners_bitme_tarixi', 'kk', 'Аяқталу күні (міндетті емес)', 'admin'),
  ('adminbanners_bitme_tarixi', 'de', 'Enddatum (optional)', 'admin'),
  ('adminbanners_bitme_tarixi', 'ar', 'تاريخ الانتهاء (اختياري)', 'admin'),

  ('adminbanners_hedefleme_basligi', 'az', '🎯 Hədəfləmə (Targeting)', 'admin'),
  ('adminbanners_hedefleme_basligi', 'en', '🎯 Targeting', 'admin'),
  ('adminbanners_hedefleme_basligi', 'ru', '🎯 Таргетинг', 'admin'),
  ('adminbanners_hedefleme_basligi', 'tr', '🎯 Hedefleme', 'admin'),
  ('adminbanners_hedefleme_basligi', 'kk', '🎯 Мақсатты бағыттау', 'admin'),
  ('adminbanners_hedefleme_basligi', 'de', '🎯 Zielgruppen-Targeting', 'admin'),
  ('adminbanners_hedefleme_basligi', 'ar', '🎯 الاستهداف', 'admin'),

  ('adminbanners_butun_merheleler', 'az', 'Hamısı', 'admin'),
  ('adminbanners_butun_merheleler', 'en', 'All', 'admin'),
  ('adminbanners_butun_merheleler', 'ru', 'Все', 'admin'),
  ('adminbanners_butun_merheleler', 'tr', 'Hepsi', 'admin'),
  ('adminbanners_butun_merheleler', 'kk', 'Барлығы', 'admin'),
  ('adminbanners_butun_merheleler', 'de', 'Alle', 'admin'),
  ('adminbanners_butun_merheleler', 'ar', 'الكل', 'admin'),

  ('adminbanners_gorunme_qisa', 'az', 'göstərilmə', 'admin'),
  ('adminbanners_gorunme_qisa', 'en', 'views', 'admin'),
  ('adminbanners_gorunme_qisa', 'ru', 'показов', 'admin'),
  ('adminbanners_gorunme_qisa', 'tr', 'gösterim', 'admin'),
  ('adminbanners_gorunme_qisa', 'kk', 'көрсету', 'admin'),
  ('adminbanners_gorunme_qisa', 'de', 'Ansichten', 'admin'),
  ('adminbanners_gorunme_qisa', 'ar', 'مشاهدات', 'admin'),

  ('lifestage_flow_short', 'az', '🌸 Dövr', 'admin'),
  ('lifestage_flow_short', 'en', '🌸 Period', 'admin'),
  ('lifestage_flow_short', 'ru', '🌸 Цикл', 'admin'),
  ('lifestage_flow_short', 'tr', '🌸 Regl', 'admin'),
  ('lifestage_flow_short', 'kk', '🌸 Циклы', 'admin'),
  ('lifestage_flow_short', 'de', '🌸 Zyklus', 'admin'),
  ('lifestage_flow_short', 'ar', '🌸 الدورة', 'admin'),

  ('lifestage_bump_short', 'az', '🤰 Hamiləlik', 'admin'),
  ('lifestage_bump_short', 'en', '🤰 Pregnancy', 'admin'),
  ('lifestage_bump_short', 'ru', '🤰 Беременность', 'admin'),
  ('lifestage_bump_short', 'tr', '🤰 Hamilelik', 'admin'),
  ('lifestage_bump_short', 'kk', '🤰 Жүктілік', 'admin'),
  ('lifestage_bump_short', 'de', '🤰 Schwangerschaft', 'admin'),
  ('lifestage_bump_short', 'ar', '🤰 الحمل', 'admin'),

  ('lifestage_mommy_short', 'az', '👶 Analıq', 'admin'),
  ('lifestage_mommy_short', 'en', '👶 Motherhood', 'admin'),
  ('lifestage_mommy_short', 'ru', '👶 Материнство', 'admin'),
  ('lifestage_mommy_short', 'tr', '👶 Annelik', 'admin'),
  ('lifestage_mommy_short', 'kk', '👶 Аналық', 'admin'),
  ('lifestage_mommy_short', 'de', '👶 Mutterschaft', 'admin'),
  ('lifestage_mommy_short', 'ar', '👶 الأمومة', 'admin'),

  ('lifestage_partner_short', 'az', '💑 Partnyor', 'admin'),
  ('lifestage_partner_short', 'en', '💑 Partner', 'admin'),
  ('lifestage_partner_short', 'ru', '💑 Партнёр', 'admin'),
  ('lifestage_partner_short', 'tr', '💑 Partner', 'admin'),
  ('lifestage_partner_short', 'kk', '💑 Серіктес', 'admin'),
  ('lifestage_partner_short', 'de', '💑 Partner', 'admin'),
  ('lifestage_partner_short', 'ar', '💑 الشريك', 'admin')
ON CONFLICT (key, lang) DO UPDATE SET value = EXCLUDED.value;
