-- 1. Add 'added_by' column to hospital_bag_items for partner tracking
ALTER TABLE public.hospital_bag_items 
ADD COLUMN IF NOT EXISTS added_by text DEFAULT 'woman';

-- 2. Create name_votes table for baby name voting system
CREATE TABLE public.name_votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  partner_user_id UUID,
  name TEXT NOT NULL,
  gender TEXT NOT NULL DEFAULT 'unisex',
  meaning TEXT,
  origin TEXT,
  vote TEXT NOT NULL CHECK (vote IN ('like', 'dislike', 'superlike')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);

-- Enable RLS on name_votes
ALTER TABLE public.name_votes ENABLE ROW LEVEL SECURITY;

-- RLS policies for name_votes - users can manage their own votes
CREATE POLICY "Users can view own votes" 
ON public.name_votes FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can view partner votes" 
ON public.name_votes FOR SELECT 
USING (
  auth.uid() = partner_user_id OR
  user_id = (SELECT user_id FROM public.profiles WHERE linked_partner_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
);

CREATE POLICY "Users can insert own votes" 
ON public.name_votes FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own votes" 
ON public.name_votes FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own votes" 
ON public.name_votes FOR DELETE 
USING (auth.uid() = user_id);

-- 3. Create SOS alerts table
CREATE TABLE public.sos_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  alert_type TEXT NOT NULL DEFAULT 'emergency',
  message TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  location_name TEXT,
  is_acknowledged BOOLEAN DEFAULT false,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on sos_alerts
ALTER TABLE public.sos_alerts ENABLE ROW LEVEL SECURITY;

-- RLS policies for sos_alerts
CREATE POLICY "Users can view alerts they sent or received" 
ON public.sos_alerts FOR SELECT 
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can insert alerts" 
ON public.sos_alerts FOR INSERT 
WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Receivers can acknowledge alerts" 
ON public.sos_alerts FOR UPDATE 
USING (auth.uid() = receiver_id);

-- 4. Create daily_summaries table for partner daily summary
CREATE TABLE public.daily_summaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  partner_user_id UUID NOT NULL,
  summary_date DATE NOT NULL DEFAULT CURRENT_DATE,
  mood INTEGER,
  symptoms TEXT[],
  water_intake INTEGER DEFAULT 0,
  kick_count INTEGER DEFAULT 0,
  contraction_count INTEGER DEFAULT 0,
  notes TEXT,
  is_sent BOOLEAN DEFAULT false,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, summary_date)
);

-- Enable RLS on daily_summaries
ALTER TABLE public.daily_summaries ENABLE ROW LEVEL SECURITY;

-- RLS policies for daily_summaries
CREATE POLICY "Users can view own summaries" 
ON public.daily_summaries FOR SELECT 
USING (auth.uid() = user_id OR auth.uid() = partner_user_id);

CREATE POLICY "Users can insert own summaries" 
ON public.daily_summaries FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own summaries" 
ON public.daily_summaries FOR UPDATE 
USING (auth.uid() = user_id);

-- 5. Enable realtime for all new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.name_votes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sos_alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_summaries;

-- 6. Update hospital_bag_items RLS to allow partner access
CREATE POLICY "Partners can view hospital bag items" 
ON public.hospital_bag_items FOR SELECT 
USING (
  user_id = (SELECT user_id FROM public.profiles WHERE linked_partner_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
);

CREATE POLICY "Partners can insert hospital bag items" 
ON public.hospital_bag_items FOR INSERT 
WITH CHECK (
  user_id = (SELECT user_id FROM public.profiles WHERE linked_partner_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
);

CREATE POLICY "Partners can update hospital bag items" 
ON public.hospital_bag_items FOR UPDATE 
USING (
  user_id = (SELECT user_id FROM public.profiles WHERE linked_partner_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
);