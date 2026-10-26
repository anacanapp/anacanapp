-- Duzelis62.sql — Admin "Ölkə Statistikası" səhifəsi üçün aqreqat RPC-lər
--
-- Səhifə: Admin panel → Əsas Panel & Analitika → "Ölkə Statistikası"
-- (src/components/admin/AdminCountryStats.tsx)
--
-- Bütün funksiyalar:
--   • SECURITY DEFINER + daxildə has_role(auth.uid(),'admin') qoruması —
--     admin olmayana BOŞ nəticə qayıdır (xəta yox, data da yox).
--   • Aqreqatlar DB-də hesablanır — minlərlə analytics_events sətrini
--     client-ə daşımaq əvəzinə yalnız hazır rəqəmlər gedir.
--   • country_code boş/NULL olanlar 'XX' ("Naməlum") altında birləşir.
--
-- İCRA: Bu faylı OLDUĞU KİMİ Supabase SQL Editor-də işə salın.

-- ═══════════════════════════════════════════════════════════════
-- 0) Performans indeksləri (yoxdursa)
-- ═══════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at
  ON public.analytics_events (created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_created
  ON public.analytics_events (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_profiles_country_code
  ON public.profiles (country_code);

-- ═══════════════════════════════════════════════════════════════
-- 1) Ölkə üzrə İCMAL — cəmi/yeni/aktiv/premium/həyat mərhələsi
--    _from.._to: aktivlik və qeydiyyat pəncərəsi (cəmi istifadəçi bütün zamanlardır)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.admin_country_stats(_from timestamptz, _to timestamptz)
RETURNS TABLE (
  country_code text,
  total_users bigint,
  new_users bigint,
  active_users bigint,
  premium_users bigint,
  bump_users bigint,
  mommy_users bigint,
  flow_users bigint,
  partner_users bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH prof AS (
    SELECT
      user_id,
      COALESCE(NULLIF(trim(p.country_code), ''), 'XX') AS cc,
      p.created_at,
      COALESCE(p.is_premium, false) AS is_premium,
      p.life_stage
    FROM public.profiles p
    WHERE public.has_role(auth.uid(), 'admin')
  ),
  base AS (
    SELECT
      cc,
      count(*)::bigint AS total_users,
      count(*) FILTER (WHERE created_at >= _from AND created_at < _to)::bigint AS new_users,
      count(*) FILTER (WHERE is_premium)::bigint AS premium_users,
      count(*) FILTER (WHERE life_stage = 'bump')::bigint AS bump_users,
      count(*) FILTER (WHERE life_stage = 'mommy')::bigint AS mommy_users,
      count(*) FILTER (WHERE life_stage = 'flow')::bigint AS flow_users,
      -- QEYD: profiles.role app_role ENUM-dur ('admin','moderator','user') —
      -- 'partner' dəyəri enum-da YOXDUR (müqayisə 22P02 xətası verirdi).
      -- Partnyorlar bu app-da yalnız life_stage='partner' ilə müəyyən olunur.
      count(*) FILTER (WHERE life_stage = 'partner')::bigint AS partner_users
    FROM prof
    GROUP BY cc
  ),
  act AS (
    SELECT pr.cc, count(DISTINCT a.user_id)::bigint AS active_users
    FROM public.analytics_events a
    JOIN prof pr ON pr.user_id = a.user_id
    WHERE a.created_at >= _from AND a.created_at < _to
    GROUP BY pr.cc
  )
  SELECT
    b.cc,
    b.total_users,
    b.new_users,
    COALESCE(act.active_users, 0),
    b.premium_users,
    b.bump_users,
    b.mommy_users,
    b.flow_users,
    b.partner_users
  FROM base b
  LEFT JOIN act ON act.cc = b.cc
  ORDER BY b.total_users DESC;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 2) GÜNLÜK TIMESERIES — qeydiyyat + aktiv (qrafik üçün)
--    _country NULL → bütün ölkələrin cəmi
-- ═══════════════════════════════════════════════════════════════
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
    SELECT generate_series(date_trunc('day', _from), date_trunc('day', _to), interval '1 day')::date AS d
    WHERE public.has_role(auth.uid(), 'admin')
  ),
  prof AS (
    SELECT user_id, COALESCE(NULLIF(trim(country_code), ''), 'XX') AS cc, created_at
    FROM public.profiles
  ),
  reg AS (
    SELECT date_trunc('day', created_at)::date AS d, count(*)::bigint AS c
    FROM prof
    WHERE created_at >= _from AND created_at < _to
      AND (_country IS NULL OR cc = _country)
    GROUP BY 1
  ),
  act AS (
    SELECT date_trunc('day', a.created_at)::date AS d, count(DISTINCT a.user_id)::bigint AS c
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

-- ═══════════════════════════════════════════════════════════════
-- 3) FEATURE İSTİFADƏSİ — "nəyi, necə istifadə edir"
--    Ölkə üzrə ən çox istifadə olunan hadisələr/ekranlar
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.admin_country_features(_country text, _from timestamptz, _to timestamptz, _limit integer DEFAULT 25)
RETURNS TABLE (
  event_name text,
  event_category text,
  event_count bigint,
  unique_users bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.event_name,
    COALESCE(a.event_category, '-') AS event_category,
    count(*)::bigint AS event_count,
    count(DISTINCT a.user_id)::bigint AS unique_users
  FROM public.analytics_events a
  JOIN public.profiles p ON p.user_id = a.user_id
  WHERE public.has_role(auth.uid(), 'admin')
    AND a.created_at >= _from AND a.created_at < _to
    AND (_country IS NULL OR COALESCE(NULLIF(trim(p.country_code), ''), 'XX') = _country)
  GROUP BY a.event_name, COALESCE(a.event_category, '-')
  ORDER BY event_count DESC
  LIMIT LEAST(GREATEST(_limit, 1), 100);
$$;

-- ═══════════════════════════════════════════════════════════════
-- 4) PLATFORMA BÖLGÜSÜ — iOS / Android / Web (ölkə üzrə)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.admin_country_platforms(_country text, _from timestamptz, _to timestamptz)
RETURNS TABLE (
  platform text,
  event_count bigint,
  unique_users bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(NULLIF(trim(a.platform), ''), 'web') AS platform,
    count(*)::bigint AS event_count,
    count(DISTINCT a.user_id)::bigint AS unique_users
  FROM public.analytics_events a
  JOIN public.profiles p ON p.user_id = a.user_id
  WHERE public.has_role(auth.uid(), 'admin')
    AND a.created_at >= _from AND a.created_at < _to
    AND (_country IS NULL OR COALESCE(NULLIF(trim(p.country_code), ''), 'XX') = _country)
  GROUP BY 1
  ORDER BY event_count DESC;
$$;

-- ═══════════════════════════════════════════════════════════════
-- Qrantlar: anon-a QADAĞAN, authenticated-ə icazə (daxili admin qoruması var)
-- ═══════════════════════════════════════════════════════════════
REVOKE EXECUTE ON FUNCTION public.admin_country_stats(timestamptz, timestamptz) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_country_timeseries(text, timestamptz, timestamptz) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_country_features(text, timestamptz, timestamptz, integer) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_country_platforms(text, timestamptz, timestamptz) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_country_stats(timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_country_timeseries(text, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_country_features(text, timestamptz, timestamptz, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_country_platforms(text, timestamptz, timestamptz) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- YOXLAMA (admin kimi):
--   SELECT * FROM admin_country_stats(now() - interval '7 days', now()) LIMIT 5;
--   SELECT * FROM admin_country_timeseries(NULL, now() - interval '7 days', now());
--   SELECT * FROM admin_country_features('AZ', now() - interval '7 days', now(), 10);
--   SELECT * FROM admin_country_platforms(NULL, now() - interval '1 day', now());
