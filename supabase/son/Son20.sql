-- ============================================================
-- Son20: hospital_bag_items partner RLS təmiri
-- Problem: köhnə siyasətlərdə `user_id = (SELECT ...)` skalyar subquery
-- bir neçə sətir qaytaranda (data anomaliyası: eyni profilə 2+ link)
-- "more than one row returned by a subquery" xətası ilə həmin istifadəçinin
-- BÜTÜN insert/select-lərini çökdürürdü → çanta boş görünürdü.
-- Həll: IN-əsaslı təhlükəsiz versiyalar (çox sətirdə xəta vermir).
-- ============================================================

DROP POLICY IF EXISTS "Partners can view hospital bag items" ON public.hospital_bag_items;
DROP POLICY IF EXISTS "Partners can insert hospital bag items" ON public.hospital_bag_items;
DROP POLICY IF EXISTS "Partners can update hospital bag items" ON public.hospital_bag_items;

CREATE POLICY "Partners can view hospital bag items"
ON public.hospital_bag_items FOR SELECT
USING (
  user_id IN (
    SELECT p.user_id FROM public.profiles p
    JOIN public.profiles me ON me.user_id = auth.uid()
    WHERE p.linked_partner_id = me.id
  )
);

CREATE POLICY "Partners can insert hospital bag items"
ON public.hospital_bag_items FOR INSERT
WITH CHECK (
  user_id IN (
    SELECT p.user_id FROM public.profiles p
    JOIN public.profiles me ON me.user_id = auth.uid()
    WHERE p.linked_partner_id = me.id
  )
);

CREATE POLICY "Partners can update hospital bag items"
ON public.hospital_bag_items FOR UPDATE
USING (
  user_id IN (
    SELECT p.user_id FROM public.profiles p
    JOIN public.profiles me ON me.user_id = auth.uid()
    WHERE p.linked_partner_id = me.id
  )
);

-- Yoxlama: siyasətlər yenilənib
SELECT policyname FROM pg_policies
WHERE tablename = 'hospital_bag_items' ORDER BY policyname;
