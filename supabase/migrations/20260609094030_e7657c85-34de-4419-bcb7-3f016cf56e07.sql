
ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS last_delay_notification_at timestamptz;

INSERT INTO public.tool_configs (
  tool_id, name, name_az, description, description_az,
  icon, color, bg_color, life_stages,
  flow_active, bump_active, mommy_active,
  flow_order, sort_order, is_premium, premium_type
) VALUES
  (
    'symptom_pattern_report',
    'Symptom Patterns',
    'Simptom Pattern Analizi',
    'AI-powered analysis of symptom patterns across cycles',
    'Tsikllər boyu simptomlarınızın AI ilə analizi',
    'TrendingUp', 'text-fuchsia-600', 'bg-fuchsia-50',
    ARRAY['flow']::text[],
    true, false, false,
    50, 50, true, 'premium_only'
  ),
  (
    'daily_story_cards',
    'Daily Insights',
    'Gündəlik İçgörülər',
    'Personalized daily story cards based on your cycle phase',
    'Tsikl fazanıza uyğun gündəlik kartlar',
    'BookOpen', 'text-rose-600', 'bg-rose-50',
    ARRAY['flow']::text[],
    true, false, false,
    10, 10, false, 'none'
  ),
  (
    'pill_reminder',
    'Pill Reminder',
    'Həb Xatırlatması',
    'Daily contraception or medication reminder',
    'Gündəlik kontrasepsiya və ya dərman xatırlatması',
    'Pill', 'text-amber-600', 'bg-amber-50',
    ARRAY['flow']::text[],
    true, false, false,
    40, 40, false, 'none'
  )
ON CONFLICT (tool_id) DO NOTHING;
