-- Create marketplace_listings table for second-hand exchange
CREATE TABLE public.marketplace_listings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'clothing',
  condition TEXT NOT NULL DEFAULT 'good',
  price DECIMAL(10,2) DEFAULT 0,
  is_free BOOLEAN DEFAULT false,
  age_range TEXT,
  images TEXT[] DEFAULT '{}',
  location_city TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create marketplace_messages table
CREATE TABLE public.marketplace_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID NOT NULL REFERENCES public.marketplace_listings(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create cry_analyses table to store cry analysis history
CREATE TABLE public.cry_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  audio_duration_seconds INTEGER,
  analysis_result JSONB NOT NULL,
  cry_type TEXT,
  confidence_score DECIMAL(5,2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create poop_analyses table to store poop analysis history
CREATE TABLE public.poop_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  image_url TEXT,
  analysis_result JSONB NOT NULL,
  color_detected TEXT,
  is_normal BOOLEAN,
  concern_level TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create weather_clothing_logs table
CREATE TABLE public.weather_clothing_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  location_lat DECIMAL(10,8),
  location_lng DECIMAL(11,8),
  city_name TEXT,
  weather_data JSONB,
  clothing_advice TEXT,
  pollen_advice TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create noise_measurements table
CREATE TABLE public.noise_measurements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  decibel_level DECIMAL(5,2) NOT NULL,
  is_too_loud BOOLEAN DEFAULT false,
  room_name TEXT DEFAULT 'default',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.marketplace_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cry_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poop_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weather_clothing_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.noise_measurements ENABLE ROW LEVEL SECURITY;

-- RLS Policies for marketplace_listings
CREATE POLICY "Users can view active listings" ON public.marketplace_listings
  FOR SELECT USING (status = 'active' OR user_id = auth.uid());

CREATE POLICY "Users can create own listings" ON public.marketplace_listings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own listings" ON public.marketplace_listings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own listings" ON public.marketplace_listings
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for marketplace_messages
CREATE POLICY "Users can view their messages" ON public.marketplace_messages
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can send messages" ON public.marketplace_messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can mark messages as read" ON public.marketplace_messages
  FOR UPDATE USING (auth.uid() = receiver_id);

-- RLS Policies for cry_analyses
CREATE POLICY "Users can view own cry analyses" ON public.cry_analyses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create cry analyses" ON public.cry_analyses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for poop_analyses
CREATE POLICY "Users can view own poop analyses" ON public.poop_analyses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create poop analyses" ON public.poop_analyses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for weather_clothing_logs
CREATE POLICY "Users can view own weather logs" ON public.weather_clothing_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create weather logs" ON public.weather_clothing_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for noise_measurements
CREATE POLICY "Users can view own noise measurements" ON public.noise_measurements
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create noise measurements" ON public.noise_measurements
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create triggers for updated_at
CREATE TRIGGER update_marketplace_listings_updated_at
  BEFORE UPDATE ON public.marketplace_listings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();