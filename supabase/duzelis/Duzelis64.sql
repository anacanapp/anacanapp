-- Duzelis64.sql — Ölkə Statistikası dəqiqlik düzəlişləri
--
-- 1) admin_country_timeseries: gün sərhədləri UTC əvəzinə Asia/Baku ilə
--    hesablanır. Əvvəl axşam 20:00-dan sonrakı hadisələr (UTC-də artıq növbəti
--    gün) qrafikdə SƏHV günə düşürdü — "bu gün"ün rəqəmləri az görünürdü.
-- 2) NOTIFY pgrst: yeni/yenilənmiş funksiyalar PostgREST schema keşinə dərhal
--    düşsün — əvvəl Duzelis62-dən dərhal sonra səhifə "funksiya tapılmadı"
--    (PGRST202) göstərə bilirdi (keş 1-2 dəq gec yenilənirdi).
--
-- İCRA: Bu faylı OLDUĞU KİMİ Supabase SQL Editor-də işə salın.

CREATE OR REPLACE FUNCTION public.admin_country_timeseries(_country text, _from timestamptz, _to timestamptz)
RETURNS TABLE (
  day date,
  new_users bigint,
  active_users bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH days AS (
    SELECT generate_series(
      date_trunc('day', _from AT TIME ZONE 'Asia/Baku'),
      date_trunc('day', _to   AT TIME ZONE 'Asia/Baku'),
      interval '1 day'
    )::date AS d
    WHERE public.has_role(auth.uid(), 'admin')
  ),
  prof AS (
    SELECT user_id, COALESCE(NULLIF(trim(country_code), ''), 'XX') AS cc, created_at
    FROM public.profiles
  ),
  reg AS (
    SELECT (created_at AT TIME ZONE 'Asia/Baku')::date AS d, count(*)::bigint AS c
    FROM prof
    WHERE created_at >= _from AND created_at < _to
      AND (_country IS NULL OR cc = _country)
    GROUP BY 1
  ),
  act AS (
    SELECT (a.created_at AT TIME ZONE 'Asia/Baku')::date AS d, count(DISTINCT a.user_id)::bigint AS c
    FROM public.analytics_events a
    JOIN prof pr ON pr.user_id = a.user_id
    WHERE a.created_at >= _from AND a.created_at < _to
      AND (_country IS NULL OR pr.cc = _country)
    GROUP BY 1
  )
  SELECT days.d, COALESCE(reg.c, 0), COALESCE(act.c, 0)
  FROM days
  LEFT JOIN reg ON reg.d = days.d
  LEFT JOIN act ON act.d = days.d
  ORDER BY days.d;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_country_timeseries(text, timestamptz, timestamptz) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_country_timeseries(text, timestamptz, timestamptz) TO authenticated;

-- PostgREST schema keşini dərhal yenilə (yeni RPC-lər ani görünsün)
NOTIFY pgrst, 'reload schema';

-- ─────────────────────────────────────────────────────────────
-- YOXLAMA (admin kimi):
--   SELECT * FROM admin_country_timeseries(NULL, now() - interval '7 days', now());
--   → günlər Bakı vaxtı ilə düzülməli, axşam hadisələri düz günə düşməlidir.
