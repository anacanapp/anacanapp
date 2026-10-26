-- ============================================================
-- Duzelis42: Admin Panel auditi - pul/tehlukesizlik ve moderasiya duzelisleri
--
-- Bu sessiyada 79 admin-panel faylinin tam auditi aparildi (~45 KRITIK
-- tapinti). Bu fayl audit tapintilarindan ELAVE MIQRASIYA teleb edenleri
-- ehtiva edir (kod-teref duzelisleri ayrica commit olunub):
--
-- 1) orders: "Users can update own orders" hec bir status-scoping olmadan
--    (auth.uid()=user_id) idi - musteri OZ sifarisinin status/total_amount
--    sahelerini HEC BIR VAXT (hetta admin "delivered" etdikden sonra da)
--    deyise bilirdi. cake_orders-de artiq movcud olan
--    "AND status = 'pending'" pattern-i tetbiq edilir.
--
-- 2) coupons.used_count: recordUsage() adi istifadeci kimi cagirilirdi, ama
--    coupons UPDATE yalniz admin-e RLS-le icaze verilir - yeni HEC BIR
--    kupon istifadesi used_count-u artirmirdi, yeni max_uses limiti heç vaxt
--    tetbiq olunmurdu (1 defelik kupon sonsuz defe istifade oluna bilerdi).
--    Novbe SECURITY DEFINER RPC ile atomic increment + server-side
--    limit yoxlamasi elave edilir (row lock ile race-safe).
--
-- 3) place_reviews: admin "Tesdiqle" duymesi is_verified=true yazmaga
--    calisirdi, ama UPDATE RLS yalniz reyin oz muellifine icaze verirdi -
--    admin ucun 0 setir tesir olunurdu (sessiz, "Rey tesdiqlendi" toast-i
--    yalan idi). Admin FOR ALL bypass policy elave edilir.
--
-- 4) healthcare_provider_reviews: eyni problem - UPDATE/DELETE yalniz
--    muellife icaze verilirdi, admin-in 4 moderasiya emeliyyati
--    (tesdiqle/gizlet/redakte/sil) hamisi sessiz secure oldu. Admin FOR ALL
--    bypass policy elave edilir.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1) ORDERS: istifadeci yalniz "pending" statuslu oz sifarisini deyise biler
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can update own orders" ON public.orders;
CREATE POLICY "Users can update own pending orders" ON public.orders
FOR UPDATE
USING (auth.uid() = user_id AND status = 'pending')
WITH CHECK (auth.uid() = user_id AND status = 'pending');

-- ────────────────────────────────────────────────────────────
-- 2) COUPONS: server-side atomic used_count artirma + limit yoxlamasi
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_coupon_usage(p_coupon_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_uses integer;
  v_used_count integer;
  v_is_active boolean;
BEGIN
  -- Row-level lock: eyni kuponun paralel istifadesi zamani race-condition-u
  -- qarsisini alir (iki sifaris eyni anda son slotu "qazana" bilmez).
  SELECT max_uses, used_count, is_active
  INTO v_max_uses, v_used_count, v_is_active
  FROM public.coupons
  WHERE id = p_coupon_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Kupon tapilmadi';
  END IF;

  IF NOT v_is_active THEN
    RAISE EXCEPTION 'Kupon aktiv deyil';
  END IF;

  IF v_max_uses IS NOT NULL AND v_used_count >= v_max_uses THEN
    RAISE EXCEPTION 'Kupon istifade limiti dolub';
  END IF;

  UPDATE public.coupons
  SET used_count = used_count + 1, updated_at = now()
  WHERE id = p_coupon_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_coupon_usage(uuid) TO authenticated;

-- ────────────────────────────────────────────────────────────
-- 3) PLACE_REVIEWS: admin bypass (moderasiya duymeleri isleyir)
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can manage place reviews" ON public.place_reviews;
CREATE POLICY "Admins can manage place reviews" ON public.place_reviews
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ────────────────────────────────────────────────────────────
-- 4) HEALTHCARE_PROVIDER_REVIEWS: admin bypass (moderasiya duymeleri isleyir)
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can manage healthcare provider reviews" ON public.healthcare_provider_reviews;
CREATE POLICY "Admins can manage healthcare provider reviews" ON public.healthcare_provider_reviews
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
