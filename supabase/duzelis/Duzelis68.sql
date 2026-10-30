-- Duzelis68.sql — Partnyor paylaşım ayarları serverdə tətbiq olunur
--
-- Əvvəl partner_sharing_settings yalnız ekranda gizlədirdi: partnyor RLS ilə ananın
-- bütün daily_logs sətirlərini (qeydlər, temperatur, qanaxma daxil), görüşlərini,
-- körpə qeydlərini, sancılarını, təpiklərini, çəkisini və gündəlik xülasəsini oxuya bilirdi.
-- 1) partner_can_see_v1(owner, what): çağıran owner-in bağlı partnyorudur VƏ ana bunu
--    paylaşır (sətir yoxdursa standart: çəki xaric hamısı açıq — cədvəlin DEFAULT-ları).
-- 2) appointments / baby_logs / contractions / kick_sessions / weight_entries partnyor
--    siyasətləri bu yoxlamanı əlavə edir.
-- 3) daily_logs və daily_summaries-də partnyorun birbaşa oxuması bağlanır; partnyor yalnız
--    sahə səviyyəsində maskalanmış RPC-lərlə oxuyur (partner_daily_logs_v1,
--    partner_daily_summaries_v1). Ananın öz giriş hüquqları dəyişmir.
-- Cədvəllərin strukturu, writer guard/CDC trigerləri dəyişmir; yalnız siyasətlər və funksiyalar.
--
-- İCRA (Google): VM-də anacan-postgres konteynerində bir transaksiyada.

BEGIN;

CREATE OR REPLACE FUNCTION public.partner_can_see_v1(_owner uuid, _what text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $$
  SELECT _owner IS NOT NULL
    AND _owner = public.get_linked_partner_user_id(auth.uid())
    AND coalesce((
      SELECT CASE _what
        WHEN 'mood' THEN s.share_mood WHEN 'symptoms' THEN s.share_symptoms WHEN 'water' THEN s.share_water
        WHEN 'kicks' THEN s.share_kicks WHEN 'contractions' THEN s.share_contractions WHEN 'weight' THEN s.share_weight
        WHEN 'appointments' THEN s.share_appointments WHEN 'baby_logs' THEN s.share_baby_logs WHEN 'cycle' THEN s.share_cycle
        ELSE false END
      FROM public.partner_sharing_settings s WHERE s.user_id = _owner),
      _what IN ('mood','symptoms','water','kicks','contractions','appointments','baby_logs','cycle'));
$$;
REVOKE ALL ON FUNCTION public.partner_can_see_v1(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.partner_can_see_v1(uuid, text) TO authenticated, service_role;

ALTER POLICY "Partners can view linked appointments" ON public.appointments USING (public.partner_can_see_v1(user_id, 'appointments'));
ALTER POLICY "Partners can view linked baby logs" ON public.baby_logs USING (public.partner_can_see_v1(user_id, 'baby_logs'));
ALTER POLICY "Partners can view linked contractions" ON public.contractions USING (public.partner_can_see_v1(user_id, 'contractions'));
ALTER POLICY "Partners can view linked kick sessions" ON public.kick_sessions USING (public.partner_can_see_v1(user_id, 'kicks'));
ALTER POLICY "Partners can view linked weight entries" ON public.weight_entries USING (public.partner_can_see_v1(user_id, 'weight'));

-- daily_logs: no row-level partner access (notes, temperature, bleeding, sleep were exposed).
DROP POLICY "Partners can view linked user logs" ON public.daily_logs;

CREATE OR REPLACE FUNCTION public.partner_daily_logs_v1(p_from date, p_to date)
RETURNS TABLE (log_date date, mood integer, symptoms text[], water_intake integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $$
DECLARE owner uuid := public.get_linked_partner_user_id(auth.uid());
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = '42501'; END IF;
  IF owner IS NULL OR p_from IS NULL OR p_to IS NULL OR p_to < p_from OR p_to - p_from > 62 THEN RETURN; END IF;
  RETURN QUERY
    SELECT d.log_date,
      CASE WHEN public.partner_can_see_v1(owner, 'mood') THEN d.mood END,
      CASE WHEN public.partner_can_see_v1(owner, 'symptoms') THEN d.symptoms END,
      CASE WHEN public.partner_can_see_v1(owner, 'water') THEN d.water_intake END
    FROM public.daily_logs d
    WHERE d.user_id = owner AND d.log_date BETWEEN p_from AND p_to
    ORDER BY d.log_date;
END $$;
REVOKE ALL ON FUNCTION public.partner_daily_logs_v1(date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.partner_daily_logs_v1(date, date) TO authenticated, service_role;

-- daily_summaries: the woman keeps full access; the partner reads masked rows through the RPC.
ALTER POLICY "Users can view own summaries" ON public.daily_summaries USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.partner_daily_summaries_v1(p_limit integer DEFAULT 14)
RETURNS TABLE (id uuid, summary_date date, mood integer, symptoms text[], water_intake integer,
  kick_count integer, contraction_count integer, notes text, is_sent boolean, sent_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $$
DECLARE owner uuid := public.get_linked_partner_user_id(auth.uid());
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = '42501'; END IF;
  IF owner IS NULL THEN RETURN; END IF;
  RETURN QUERY
    SELECT s.id, s.summary_date,
      CASE WHEN public.partner_can_see_v1(owner, 'mood') THEN s.mood END,
      CASE WHEN public.partner_can_see_v1(owner, 'symptoms') THEN s.symptoms END,
      CASE WHEN public.partner_can_see_v1(owner, 'water') THEN s.water_intake END,
      CASE WHEN public.partner_can_see_v1(owner, 'kicks') THEN s.kick_count END,
      CASE WHEN public.partner_can_see_v1(owner, 'contractions') THEN s.contraction_count END,
      s.notes, s.is_sent, s.sent_at
    FROM public.daily_summaries s
    WHERE s.user_id = owner AND s.partner_user_id = auth.uid()
    ORDER BY s.summary_date DESC
    LIMIT least(greatest(coalesce(p_limit, 14), 1), 60);
END $$;
REVOKE ALL ON FUNCTION public.partner_daily_summaries_v1(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.partner_daily_summaries_v1(integer) TO authenticated, service_role;

-- Same owner as the other partner functions (link_partner_by_code, get_linked_partner_user_id).
ALTER FUNCTION public.partner_can_see_v1(uuid, text) OWNER TO pgadmin;
ALTER FUNCTION public.partner_daily_logs_v1(date, date) OWNER TO pgadmin;
ALTER FUNCTION public.partner_daily_summaries_v1(integer) OWNER TO pgadmin;

NOTIFY pgrst, 'reload schema';
COMMIT;
