-- Create hospital_bag_items table for checklist persistence
CREATE TABLE IF NOT EXISTS public.hospital_bag_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  item_id TEXT NOT NULL,
  item_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('mom', 'baby', 'documents')),
  is_checked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, item_id)
);

-- Create favorite_names table for baby name favorites
CREATE TABLE IF NOT EXISTS public.favorite_names (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('boy', 'girl', 'unisex')),
  meaning TEXT,
  origin TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);

-- Create exercise_logs table for daily exercise tracking
CREATE TABLE IF NOT EXISTS public.exercise_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  exercise_id TEXT NOT NULL,
  exercise_name TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  calories_burned INTEGER NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_preferences table for app preferences
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  white_noise_volume INTEGER DEFAULT 70,
  white_noise_timer INTEGER,
  last_white_noise_sound TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.hospital_bag_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorite_names ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercise_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- RLS policies for hospital_bag_items
CREATE POLICY "Users can view own hospital bag items" ON public.hospital_bag_items
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own hospital bag items" ON public.hospital_bag_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own hospital bag items" ON public.hospital_bag_items
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own hospital bag items" ON public.hospital_bag_items
  FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for favorite_names
CREATE POLICY "Users can view own favorite names" ON public.favorite_names
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own favorite names" ON public.favorite_names
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own favorite names" ON public.favorite_names
  FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for exercise_logs
CREATE POLICY "Users can view own exercise logs" ON public.exercise_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own exercise logs" ON public.exercise_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own exercise logs" ON public.exercise_logs
  FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for user_preferences
CREATE POLICY "Users can view own preferences" ON public.user_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences" ON public.user_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences" ON public.user_preferences
  FOR UPDATE USING (auth.uid() = user_id);

-- Create triggers for updated_at
CREATE TRIGGER update_hospital_bag_items_updated_at
  BEFORE UPDATE ON public.hospital_bag_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_hospital_bag_items_user_id ON public.hospital_bag_items(user_id);
CREATE INDEX IF NOT EXISTS idx_favorite_names_user_id ON public.favorite_names(user_id);
CREATE INDEX IF NOT EXISTS idx_exercise_logs_user_id ON public.exercise_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_exercise_logs_completed_at ON public.exercise_logs(completed_at);