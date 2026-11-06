-- Admin console v2 (owner request 2026-11-06): read-only aggregate RPCs for the redesigned admin.
--
-- Every function is STABLE SECURITY DEFINER, checks has_role(auth.uid(), 'admin'), pins search_path,
-- is revoked from PUBLIC/anon and granted to authenticated/service_role only. Nothing is written:
-- no relation is created or altered, so no CDC enrollment or writer guard is needed; no cron.
-- Optional tables (book_orders, cashback_lots, crash_reports, post_reports, cake_orders) are read only
-- when present (to_regclass guard), so the functions also run on a partially migrated database.
-- The web admin falls back to the previous bounded PostgREST queries while these are not applied
-- (PGRST202 / 404), so applying is safe at any time and not required for the UI to work.
--
--   admin_overview_v1()                         dashboard KPIs, 14-day series and a recent-activity feed
--   admin_order_stats_v1()                      Anacan Aptek order counts per status, delivered revenue, QayğıCash used
--   admin_usage_stats_v1(text[], int)           server-side replacement for the 5 000-row client scan of analytics_events
--   admin_user_detail_v1(uuid)                  one user's profile, roles, subscriptions, children, wallet for the drawer
--
-- analytics_events (≈1.1M rows) is only read through idx_analytics_events_created / idx_analytics_events_name ranges.

BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.admin_overview_v1() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_today timestamptz := (date_trunc('day', now() AT TIME ZONE 'Asia/Baku')) AT TIME ZONE 'Asia/Baku';
  v_week timestamptz := v_today - interval '6 days';
  v_prev_week timestamptz := v_today - interval '13 days';
  r jsonb := '{}'::jsonb; v_num numeric; v_sum numeric; v_cnt bigint; v_json jsonb; v_feed jsonb := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501';
  END IF;

  -- Users
  r := r || jsonb_build_object(
    'users_total', (SELECT count(*) FROM public.profiles),
    'users_today', (SELECT count(*) FROM public.profiles WHERE created_at >= v_today),
    'users_7d', (SELECT count(*) FROM public.profiles WHERE created_at >= v_week),
    'users_prev_7d', (SELECT count(*) FROM public.profiles WHERE created_at >= v_prev_week AND created_at < v_week),
    'premium_active', (SELECT count(*) FROM public.profiles WHERE is_premium IS TRUE AND (premium_until IS NULL OR premium_until > now())),
    'signups_series', (SELECT coalesce(jsonb_agg(n ORDER BY d), '[]'::jsonb) FROM (
        SELECT g::date d, (SELECT count(*) FROM public.profiles p WHERE p.created_at >= g AT TIME ZONE 'Asia/Baku' AND p.created_at < (g + interval '1 day') AT TIME ZONE 'Asia/Baku') n
          FROM generate_series((v_today - interval '13 days') AT TIME ZONE 'Asia/Baku', v_today AT TIME ZONE 'Asia/Baku', interval '1 day') g) s));

  -- Activity (indexed created_at range scans only)
  r := r || jsonb_build_object(
    'active_today', (SELECT count(DISTINCT user_id) FROM public.analytics_events WHERE created_at >= v_today),
    'active_7d', (SELECT count(DISTINCT user_id) FROM public.analytics_events WHERE created_at >= v_week),
    'active_prev_7d', (SELECT count(DISTINCT user_id) FROM public.analytics_events WHERE created_at >= v_prev_week AND created_at < v_week),
    'active_series', (SELECT coalesce(jsonb_agg(n ORDER BY d), '[]'::jsonb) FROM (
        SELECT (created_at AT TIME ZONE 'Asia/Baku')::date d, count(DISTINCT user_id) n FROM public.analytics_events
         WHERE created_at >= v_week GROUP BY 1) s));

  -- Anacan Aptek orders
  r := r || jsonb_build_object(
    'orders_pending', (SELECT count(*) FROM public.orders WHERE status = 'pending'),
    'orders_processing', (SELECT count(*) FROM public.orders WHERE status IN ('confirmed', 'processing', 'shipped')),
    'orders_today', (SELECT count(*) FROM public.orders WHERE created_at >= v_today AND status <> 'cancelled'),
    'orders_today_revenue', (SELECT coalesce(sum(total_amount), 0) FROM public.orders WHERE created_at >= v_today AND status <> 'cancelled'),
    'orders_series', (SELECT coalesce(jsonb_agg(n ORDER BY d), '[]'::jsonb) FROM (
        SELECT g::date d, (SELECT count(*) FROM public.orders o WHERE o.created_at >= g AT TIME ZONE 'Asia/Baku' AND o.created_at < (g + interval '1 day') AT TIME ZONE 'Asia/Baku' AND o.status <> 'cancelled') n
          FROM generate_series((v_today - interval '13 days') AT TIME ZONE 'Asia/Baku', v_today AT TIME ZONE 'Asia/Baku', interval '1 day') g) s));

  IF to_regclass('public.cake_orders') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FILTER (WHERE status = ''pending''), count(*) FILTER (WHERE created_at >= $1 AND payment_status = ''paid''),
                    coalesce(sum(total_price) FILTER (WHERE created_at >= $1 AND payment_status = ''paid''), 0) FROM public.cake_orders'
      INTO v_cnt, v_num, v_sum USING v_today;
    r := r || jsonb_build_object('cakes_pending', v_cnt, 'cakes_paid_today', v_num, 'cakes_paid_today_revenue', v_sum);
  END IF;
  IF to_regclass('public.book_orders') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FILTER (WHERE status = ''pending'' AND created_at >= now() - interval ''2 days''), count(*) FILTER (WHERE status = ''paid'' AND provider = ''epoint'' AND paid_at >= $1),
                    coalesce(sum(amount) FILTER (WHERE status = ''paid'' AND provider = ''epoint'' AND paid_at >= $1), 0) FROM public.book_orders'
      INTO v_cnt, v_num, v_sum USING v_today;
    r := r || jsonb_build_object('books_pending', v_cnt, 'books_paid_today', v_num, 'books_paid_today_revenue', v_sum);
  END IF;

  -- QayğıCash liability (available + still on hold, not expired)
  IF to_regclass('public.cashback_lots') IS NOT NULL THEN
    EXECUTE 'SELECT coalesce(sum(remaining_minor) FILTER (WHERE available_at <= now()), 0), coalesce(sum(remaining_minor) FILTER (WHERE available_at > now()), 0)
               FROM public.cashback_lots WHERE state = ''ok'' AND expires_at > now()' INTO v_num, v_cnt;
    r := r || jsonb_build_object('qc_available_minor', v_num, 'qc_pending_minor', v_cnt);
  END IF;

  -- Operations queues
  r := r || jsonb_build_object(
    'support_open', (SELECT count(*) FROM public.support_tickets WHERE status IN ('open', 'in_progress')),
    'support_new', (SELECT count(*) FROM public.support_tickets WHERE status = 'open'));
  IF to_regclass('public.post_reports') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.post_reports WHERE status = ''pending''' INTO v_cnt;
    r := r || jsonb_build_object('moderation_pending', v_cnt);
  END IF;
  IF to_regclass('public.community_ad_reviews') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.community_ad_reviews WHERE state = ''review''' INTO v_cnt;
    r := r || jsonb_build_object('ad_review_pending', v_cnt);
  END IF;
  IF to_regclass('public.crash_reports') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.crash_reports WHERE created_at >= now() - interval ''24 hours''' INTO v_cnt;
    r := r || jsonb_build_object('crashes_24h', v_cnt);
  END IF;

  -- Recent activity (bounded: at most 5 rows per source, 12 overall)
  SELECT coalesce(jsonb_agg(x ORDER BY (x->>'at') DESC), '[]'::jsonb) INTO v_feed FROM (
    SELECT jsonb_build_object('kind', 'signup', 'id', user_id, 'title', coalesce(nullif(name, ''), 'Yeni istifadəçi'), 'detail', coalesce(life_stage, ''), 'at', created_at) x
      FROM (SELECT user_id, name, life_stage, created_at FROM public.profiles ORDER BY created_at DESC LIMIT 5) a
    UNION ALL
    SELECT jsonb_build_object('kind', 'order', 'id', id, 'title', order_number, 'detail', status, 'amount', total_amount, 'at', created_at)
      FROM (SELECT id, order_number, status, total_amount, created_at FROM public.orders ORDER BY created_at DESC LIMIT 5) b
    UNION ALL
    SELECT jsonb_build_object('kind', 'support', 'id', id, 'title', subject, 'detail', coalesce(status, ''), 'at', created_at)
      FROM (SELECT id, subject, status, created_at FROM public.support_tickets ORDER BY created_at DESC LIMIT 5) c
  ) feed;
  IF to_regclass('public.cake_orders') IS NOT NULL THEN
    EXECUTE 'SELECT coalesce(jsonb_agg(jsonb_build_object(''kind'', ''cake'', ''id'', id, ''title'', customer_name, ''detail'', status, ''amount'', total_price, ''at'', created_at)), ''[]''::jsonb)
               FROM (SELECT id, customer_name, status, total_price, created_at FROM public.cake_orders ORDER BY created_at DESC LIMIT 5) t' INTO v_json;
    v_feed := v_feed || v_json;
  END IF;
  SELECT coalesce(jsonb_agg(x ORDER BY (x->>'at') DESC), '[]'::jsonb) INTO v_feed
    FROM (SELECT x FROM jsonb_array_elements(v_feed) x ORDER BY (x->>'at') DESC LIMIT 12) y;

  RETURN r || jsonb_build_object('schema', 'anacan-admin-overview-v1', 'generated_at', now(), 'timezone', 'Asia/Baku', 'recent', v_feed);
END $$;

CREATE OR REPLACE FUNCTION public.admin_order_stats_v1() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501';
  END IF;
  RETURN (SELECT jsonb_build_object(
    'schema', 'anacan-admin-order-stats-v1',
    'total', count(*),
    'by_status', coalesce((SELECT jsonb_object_agg(status, n) FROM (SELECT status, count(*) n FROM public.orders GROUP BY 1) s), '{}'::jsonb),
    'delivered_revenue', coalesce(sum(total_amount) FILTER (WHERE status = 'delivered'), 0),
    'cashback_used', coalesce(sum(cashback_used) FILTER (WHERE status <> 'cancelled'), 0),
    'last_30d_orders', count(*) FILTER (WHERE created_at >= now() - interval '30 days' AND status <> 'cancelled'),
    'last_30d_revenue', coalesce(sum(total_amount) FILTER (WHERE created_at >= now() - interval '30 days' AND status = 'delivered'), 0))
    FROM public.orders);
END $$;

CREATE OR REPLACE FUNCTION public.admin_usage_stats_v1(p_events text[], p_days int DEFAULT 30) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_since timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 366)));
  v_trend_days int := least(greatest(1, coalesce(p_days, 30)), 14);
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501';
  END IF;
  IF p_events IS NULL OR cardinality(p_events) = 0 OR cardinality(p_events) > 50 THEN
    RAISE EXCEPTION 'admin_invalid_events' USING ERRCODE = '22023';
  END IF;
  RETURN (
    WITH e AS (SELECT user_id, is_premium, event_data, created_at FROM public.analytics_events
                WHERE event_name = ANY (p_events) AND created_at >= v_since),
    labelled AS (SELECT coalesce(nullif((SELECT string_agg(v, ' / ') FROM jsonb_each_text(e.event_data) j(k, v) WHERE coalesce(v, '') NOT IN ('', 'false')), ''), 'Bilinmir') label
                   FROM e WHERE jsonb_typeof(e.event_data) = 'object'),
    users AS (SELECT user_id, count(*) n, max(created_at) last_used FROM e GROUP BY 1 ORDER BY 2 DESC LIMIT 15)
    SELECT jsonb_build_object(
      'schema', 'anacan-admin-usage-v1',
      'total', (SELECT count(*) FROM e),
      'unique_users', (SELECT count(DISTINCT user_id) FROM e),
      'premium_users', (SELECT count(DISTINCT user_id) FROM e WHERE is_premium),
      'daily', (SELECT coalesce(jsonb_agg(jsonb_build_object('date', d::date, 'count', coalesce(c.n, 0)) ORDER BY d), '[]'::jsonb)
                  FROM generate_series((now() - make_interval(days => v_trend_days - 1))::date, now()::date, interval '1 day') d
                  LEFT JOIN (SELECT created_at::date AS dd, count(*) n FROM e GROUP BY 1) c ON c.dd = d::date),
      'breakdown', (SELECT coalesce(jsonb_agg(jsonb_build_object('label', label, 'count', n) ORDER BY n DESC), '[]'::jsonb) FROM (
                      SELECT label, count(*) n FROM labelled GROUP BY label ORDER BY 2 DESC LIMIT 20) b),
      'users', (SELECT coalesce(jsonb_agg(jsonb_build_object('user_id', u.user_id, 'count', u.n, 'last_used', u.last_used,
                    'name', p.name, 'email', p.email, 'is_premium', coalesce(p.is_premium, false)) ORDER BY u.n DESC), '[]'::jsonb)
                  FROM users u LEFT JOIN public.profiles p ON p.user_id = u.user_id)));
END $$;

CREATE OR REPLACE FUNCTION public.admin_user_detail_v1(p_user uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r jsonb; v_json jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501';
  END IF;
  SELECT jsonb_build_object(
    'schema', 'anacan-admin-user-v1',
    'profile', (SELECT to_jsonb(p) - 'onboarding_answers' FROM public.profiles p WHERE p.user_id = p_user),
    'roles', coalesce((SELECT jsonb_agg(role) FROM public.user_roles WHERE user_id = p_user), '[]'::jsonb),
    'subscriptions', coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.created_at DESC) FROM (SELECT * FROM public.subscriptions WHERE user_id = p_user ORDER BY created_at DESC LIMIT 10) s), '[]'::jsonb),
    'children', coalesce((SELECT jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'birth_date', c.birth_date, 'due_date', c.due_date, 'gender', c.gender, 'is_active', c.is_active) ORDER BY c.sort_order NULLS LAST, c.created_at)
                            FROM public.user_children c WHERE c.user_id = p_user), '[]'::jsonb),
    'orders', (SELECT count(*) FROM public.orders WHERE user_id = p_user),
    'support_tickets', (SELECT count(*) FROM public.support_tickets WHERE user_id = p_user),
    'last_seen', (SELECT max(created_at) FROM (SELECT created_at FROM public.analytics_events WHERE user_id = p_user ORDER BY created_at DESC LIMIT 1) a))
    INTO r;
  IF to_regclass('public.cashback_lots') IS NOT NULL THEN
    EXECUTE 'SELECT jsonb_build_object(''available_minor'', coalesce(sum(remaining_minor) FILTER (WHERE available_at <= now()), 0), ''pending_minor'', coalesce(sum(remaining_minor) FILTER (WHERE available_at > now()), 0))
               FROM public.cashback_lots WHERE user_id = $1 AND state = ''ok'' AND expires_at > now()' INTO v_json USING p_user;
    r := r || jsonb_build_object('qaygicash', v_json);
  END IF;
  RETURN r;
END $$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['admin_overview_v1()', 'admin_order_stats_v1()', 'admin_usage_stats_v1(text[], integer)', 'admin_user_detail_v1(uuid)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', f);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pgadmin') THEN
      EXECUTE format('ALTER FUNCTION public.%s OWNER TO pgadmin', f);
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
