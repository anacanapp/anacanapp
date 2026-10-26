
-- Kick Counter table
CREATE TABLE IF NOT EXISTS public.kick_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kick_count integer NOT NULL DEFAULT 0,
  duration_seconds integer NOT NULL DEFAULT 0,
  session_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.kick_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own kick sessions"
  ON public.kick_sessions FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Partners can view linked kick sessions"
  ON public.kick_sessions FOR SELECT
  USING (user_id IN (
    SELECT p2.user_id FROM profiles p1
    JOIN profiles p2 ON p1.linked_partner_id = p2.id
    WHERE p1.user_id = auth.uid()
  ));

-- Weight Tracker table
CREATE TABLE IF NOT EXISTS public.weight_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  weight numeric(5,2) NOT NULL,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.weight_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own weight entries"
  ON public.weight_entries FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Partners can view linked weight entries"
  ON public.weight_entries FOR SELECT
  USING (user_id IN (
    SELECT p2.user_id FROM profiles p1
    JOIN profiles p2 ON p1.linked_partner_id = p2.id
    WHERE p1.user_id = auth.uid()
  ));

-- Contraction Timer table
CREATE TABLE IF NOT EXISTS public.contractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  start_time timestamp with time zone NOT NULL DEFAULT now(),
  duration_seconds integer NOT NULL DEFAULT 0,
  interval_seconds integer,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.contractions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own contractions"
  ON public.contractions FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Partners can view linked contractions"
  ON public.contractions FOR SELECT
  USING (user_id IN (
    SELECT p2.user_id FROM profiles p1
    JOIN profiles p2 ON p1.linked_partner_id = p2.id
    WHERE p1.user_id = auth.uid()
  ));

-- Calendar Events / Appointments table
CREATE TABLE IF NOT EXISTS public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  event_date date NOT NULL,
  event_time time,
  event_type text NOT NULL DEFAULT 'appointment',
  reminder_enabled boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own appointments"
  ON public.appointments FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Partners can view linked appointments"
  ON public.appointments FOR SELECT
  USING (user_id IN (
    SELECT p2.user_id FROM profiles p1
    JOIN profiles p2 ON p1.linked_partner_id = p2.id
    WHERE p1.user_id = auth.uid()
  ));

-- Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  notification_type text NOT NULL DEFAULT 'reminder',
  is_read boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own notifications"
  ON public.notifications FOR ALL
  USING (auth.uid() = user_id);

-- Add start_weight to profiles for weight tracking
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS start_weight numeric(5,2);
