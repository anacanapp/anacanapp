-- Run in Lovable/SOURCE Supabase SQL Editor; export the result as CSV.
-- Next page: replace NULL with 'last id' and now() with 'source_cutoff'::timestamptz.
WITH settings AS (SELECT NULL::uuid AS after_id, now() AS created_before), users AS (
  SELECT u.*,count(*) OVER () AS expected_users,s.created_before,s.after_id
  FROM auth.users u CROSS JOIN settings s
  WHERE nullif(to_jsonb(u)->>'deleted_at','') IS NULL AND (u.created_at IS NULL OR u.created_at<=s.created_before)
)
SELECT u.id,coalesce(nullif(u.email,''),nullif(p.email,'')) AS email,
  coalesce(nullif(p.name,''),nullif(u.raw_user_meta_data->>'full_name',''),nullif(u.raw_user_meta_data->>'name','')) AS name,
  nullif(to_jsonb(u)->>'phone','') AS phone,
  coalesce(nullif(to_jsonb(p)->>'birth_date',''),nullif(to_jsonb(p)->>'date_of_birth',''),
    nullif(u.raw_user_meta_data->>'birth_date',''),nullif(u.raw_user_meta_data->>'date_of_birth',''),
    nullif(u.raw_user_meta_data->>'birthday','')) AS date_of_birth,
  p.life_stage,p.country_code,pref.language,
  floor(extract(epoch FROM u.created_at))::bigint AS created_at,
  floor(extract(epoch FROM u.last_sign_in_at))::bigint AS last_sign_in_at,
  p.is_premium AS source_is_premium,p.premium_until AS source_premium_until,
  to_jsonb(pref)->'privacy_share_analytics' AS privacy_share_analytics,
  to_jsonb(pref)->'notifications_enabled' AS source_notifications_enabled,
  to_jsonb(pref)->'push_enabled' AS source_push_enabled,
  u.expected_users,u.created_before AS source_cutoff
FROM users u
LEFT JOIN LATERAL (SELECT * FROM public.profiles p WHERE p.user_id=u.id ORDER BY p.updated_at DESC NULLS LAST,p.id LIMIT 1) p ON true
LEFT JOIN LATERAL (SELECT * FROM public.user_preferences p WHERE p.user_id=u.id ORDER BY p.updated_at DESC NULLS LAST,p.id LIMIT 1) pref ON true
WHERE u.after_id IS NULL OR u.id>u.after_id
ORDER BY u.id LIMIT 100;
