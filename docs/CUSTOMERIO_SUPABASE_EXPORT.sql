-- Run this SELECT in the SOURCE Supabase SQL Editor, then export ALL result rows
-- as CSV or JSON. This query does not change users, data, or migration checkpoints.
-- expected_users detects truncated Studio exports. user_data is structured JSON.
-- Passwords, sessions, tokens, pairing codes and payment identifiers are excluded.
WITH source_users AS (
  SELECT u.*,count(*) OVER () AS expected_users
  FROM auth.users u
  WHERE nullif(to_jsonb(u)->>'deleted_at','') IS NULL
)
SELECT
  'anacan-customerio-profiles-v1' AS export_schema,
  u.expected_users,
  statement_timestamp() AS source_exported_at,
  u.id AS user_id,
  jsonb_build_object(
    'auth',jsonb_strip_nulls(jsonb_build_object(
      'id',u.id,'email',u.email,'phone',to_jsonb(u)->'phone',
      'created_at',u.created_at,'updated_at',to_jsonb(u)->'updated_at',
      'last_sign_in_at',to_jsonb(u)->'last_sign_in_at',
      'email_confirmed_at',to_jsonb(u)->'email_confirmed_at',
      'phone_confirmed_at',to_jsonb(u)->'phone_confirmed_at',
      'is_anonymous',to_jsonb(u)->'is_anonymous',
      'banned_until',to_jsonb(u)->'banned_until',
      'metadata',(SELECT coalesce(jsonb_object_agg(key,value),'{}'::jsonb)
        FROM jsonb_each(coalesce(u.raw_user_meta_data,'{}'::jsonb))
        WHERE key=ANY(ARRAY['name','full_name','first_name','last_name','given_name','family_name',
          'birth_date','date_of_birth','birthday','gender','locale','language','avatar_url','picture']))
    )),
    'profile',(SELECT coalesce(jsonb_object_agg(key,value),'{}'::jsonb)
      FROM jsonb_each(coalesce(to_jsonb(p),'{}'::jsonb))
      WHERE key=ANY(ARRAY['name','email','phone','birth_date','date_of_birth','birthday','avatar_url','bio',
        'life_stage','country_code','created_at','updated_at','is_premium','premium_until','is_verified','verified_until','badge_type','role',
        'baby_name','baby_birth_date','baby_gender','baby_count','birth_height_cm','birth_weight_kg',
        'last_period_date','cycle_length','period_length','due_date','pregnancy_day','delivery_type',
        'multiples_type','chorionicity','start_weight','onboarding_answers','onboarding_completed'])),
    'has_linked_partner',nullif(to_jsonb(p)->>'linked_partner_id','') IS NOT NULL,
    'preferences',(SELECT coalesce(jsonb_object_agg(key,value),'{}'::jsonb)
      FROM jsonb_each(coalesce(to_jsonb(pref),'{}'::jsonb))
      WHERE key=ANY(ARRAY['language','feed_languages','created_at','updated_at','notifications_enabled','push_enabled',
        'daily_push_enabled','push_comments','push_community','push_likes','push_messages',
        'silent_hours_enabled','silent_hours_start','silent_hours_end','sound_enabled','vibration_enabled',
        'privacy_allow_messages','privacy_location_sharing','privacy_notification_sounds','privacy_profile_visible',
        'privacy_share_analytics','privacy_show_in_community','exercise_days','exercise_reminder','vitamin_reminder',
        'vitamin_time','water_reminder','white_noise_timer','white_noise_volume','last_white_noise_sound',
        'community_last_seen_at','last_push_sent_at'])),
    'children',coalesce((SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'name',c.name,'birth_date',c.birth_date,'due_date',to_jsonb(c)->'due_date','gender',c.gender,
        'country_code',to_jsonb(c)->'country_code','vaccine_country_code',to_jsonb(c)->'vaccine_country_code',
        'is_active',c.is_active,'sort_order',c.sort_order,'created_at',c.created_at
      )) ORDER BY c.sort_order,c.id) FROM public.user_children c WHERE c.user_id=u.id),'[]'::jsonb),
    'subscriptions',coalesce((SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'plan_type',s.plan_type,'status',s.status,'expires_at',s.expires_at,
        'started_at',to_jsonb(s)->'started_at','created_at',to_jsonb(s)->'created_at',
        'updated_at',to_jsonb(s)->'updated_at','cancelled_at',to_jsonb(s)->'cancelled_at',
        'refunded_at',to_jsonb(s)->'refunded_at','is_trial',to_jsonb(s)->'is_trial'
      )) ORDER BY s.created_at DESC) FROM public.subscriptions s WHERE s.user_id=u.id),'[]'::jsonb),
    'roles',coalesce((SELECT jsonb_agg(r.role ORDER BY r.role::text) FROM public.user_roles r WHERE r.user_id=u.id),'[]'::jsonb)
  ) AS user_data
FROM source_users u
LEFT JOIN LATERAL (SELECT * FROM public.profiles p WHERE p.user_id=u.id ORDER BY p.updated_at DESC LIMIT 1) p ON true
LEFT JOIN LATERAL (SELECT * FROM public.user_preferences p WHERE p.user_id=u.id ORDER BY p.updated_at DESC LIMIT 1) pref ON true
ORDER BY u.id;
