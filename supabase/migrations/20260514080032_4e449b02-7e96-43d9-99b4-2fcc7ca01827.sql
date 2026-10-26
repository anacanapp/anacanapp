UPDATE public.tool_configs SET is_premium = true;

ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS community_last_seen_at timestamptz;