-- ============================================================
-- Son20: hospital_bag_items partner RLS tÉ™miri
-- Problem: kÃ¶hnÉ™ siyasÉ™tlÉ™rdÉ™ `user_id = (SELECT ...)` skalyar subquery
-- bir neÃ§É™ sÉ™tir qaytaranda (data anomaliyasÄ±: eyni profilÉ™ 2+ link)
-- "more than one row returned by a subquery" xÉ™tasÄ± ilÉ™ hÉ™min istifadÉ™Ã§inin
-- BÃœTÃœN insert/select-lÉ™rini Ã§Ã¶kdÃ¼rÃ¼rdÃ¼ â†’ Ã§anta boÅŸ gÃ¶rÃ¼nÃ¼rdÃ¼.
-- HÉ™ll: IN-É™saslÄ± tÉ™hlÃ¼kÉ™siz versiyalar (Ã§ox sÉ™tirdÉ™ xÉ™ta vermir).
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
