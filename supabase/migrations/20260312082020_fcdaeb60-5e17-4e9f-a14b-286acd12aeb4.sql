
-- Analytics events table for internal tracking
CREATE TABLE public.analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_name text NOT NULL,
  event_category text NOT NULL DEFAULT 'general',
  event_data jsonb DEFAULT '{}',
  platform text DEFAULT 'web',
  life_stage text,
  is_premium boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Index for fast queries
CREATE INDEX idx_analytics_events_created ON public.analytics_events (created_at DESC);
CREATE INDEX idx_analytics_events_name ON public.analytics_events (event_name, created_at DESC);
CREATE INDEX idx_analytics_events_user ON public.analytics_events (user_id, created_at DESC);
CREATE INDEX idx_analytics_events_category ON public.analytics_events (event_category, created_at DESC);

-- Enable RLS
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Users can insert their own events
CREATE POLICY "Users can insert own events"
ON public.analytics_events FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Admins can read all events
CREATE POLICY "Admins can read all events"
ON public.analytics_events FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Daily aggregated stats view for fast dashboard queries
CREATE TABLE public.analytics_daily_summary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  summary_date date NOT NULL,
  event_name text NOT NULL,
  event_category text NOT NULL DEFAULT 'general',
  life_stage text,
  total_count int DEFAULT 0,
  unique_users int DEFAULT 0,
  premium_users int DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(summary_date, event_name, life_stage)
);

ALTER TABLE public.analytics_daily_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read summaries"
ON public.analytics_daily_summary FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage summaries"
ON public.analytics_daily_summary FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
