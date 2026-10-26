-- =============================================
-- FEATURE 1: Ana Dostu Məkanlar (Mom-Friendly Places Map)
-- =============================================

-- Place categories enum
CREATE TYPE public.place_category AS ENUM ('cafe', 'restaurant', 'park', 'mall', 'hospital', 'metro', 'pharmacy', 'playground');

-- Main places table
CREATE TABLE public.mom_friendly_places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_az TEXT,
  description TEXT,
  description_az TEXT,
  category place_category NOT NULL DEFAULT 'cafe',
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  address TEXT,
  address_az TEXT,
  phone TEXT,
  website TEXT,
  image_url TEXT,
  
  -- Amenities
  has_breastfeeding_room BOOLEAN DEFAULT false,
  has_changing_table BOOLEAN DEFAULT false,
  has_elevator BOOLEAN DEFAULT false,
  has_ramp BOOLEAN DEFAULT false,
  has_stroller_access BOOLEAN DEFAULT false,
  has_kids_menu BOOLEAN DEFAULT false,
  has_play_area BOOLEAN DEFAULT false,
  has_high_chair BOOLEAN DEFAULT false,
  has_parking BOOLEAN DEFAULT false,
  
  -- Ratings
  avg_rating NUMERIC(2,1) DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  verified_count INTEGER DEFAULT 0,
  
  -- Meta
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_verified BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Place reviews table
CREATE TABLE public.place_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id UUID REFERENCES public.mom_friendly_places(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
  comment TEXT,
  
  -- Specific ratings
  cleanliness_rating INTEGER CHECK (cleanliness_rating >= 1 AND cleanliness_rating <= 5),
  accessibility_rating INTEGER CHECK (accessibility_rating >= 1 AND accessibility_rating <= 5),
  staff_rating INTEGER CHECK (staff_rating >= 1 AND staff_rating <= 5),
  
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(place_id, user_id)
);

-- Place verifications (crowd-sourced confirmations)
CREATE TABLE public.place_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id UUID REFERENCES public.mom_friendly_places(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amenity_verified TEXT NOT NULL, -- which amenity they're verifying
  is_confirmed BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(place_id, user_id, amenity_verified)
);

-- User badges for gamification
CREATE TABLE public.user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  badge_type TEXT NOT NULL,
  earned_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id, badge_type)
);

-- =============================================
-- FEATURE 2: Ağıllı Oyun Qutusu (Smart Play Box)
-- =============================================

-- Play activities database
CREATE TABLE public.play_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  title_az TEXT NOT NULL,
  description TEXT,
  description_az TEXT,
  instructions TEXT,
  instructions_az TEXT,
  
  -- Age range in days
  min_age_days INTEGER NOT NULL DEFAULT 0,
  max_age_days INTEGER NOT NULL DEFAULT 365,
  
  -- Duration in minutes
  duration_minutes INTEGER DEFAULT 10,
  
  -- Required items
  required_items TEXT[] DEFAULT '{}',
  
  -- Skills developed
  skill_tags TEXT[] DEFAULT '{}', -- motor, sensory, language, cognitive, social
  
  -- Media
  image_url TEXT,
  video_url TEXT,
  
  -- Meta
  difficulty_level TEXT DEFAULT 'easy', -- easy, medium, hard
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- User's available household items
CREATE TABLE public.user_play_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  item_name TEXT NOT NULL,
  item_name_az TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id, item_name)
);

-- Common household items for play
CREATE TABLE public.play_inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_az TEXT NOT NULL,
  emoji TEXT,
  category TEXT DEFAULT 'general',
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0
);

-- Completed activities log
CREATE TABLE public.play_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  activity_id UUID REFERENCES public.play_activities(id) ON DELETE CASCADE NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT now(),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  notes TEXT
);

-- =============================================
-- FEATURE 3: Sən Necəsən, Ana? (Mental Health Tracker)
-- =============================================

-- Daily mood check-ins
CREATE TABLE public.mood_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  mood_level INTEGER CHECK (mood_level >= 1 AND mood_level <= 5) NOT NULL, -- 1=terrible, 5=great
  mood_type TEXT, -- happy, tired, sad, overwhelmed, anxious, calm
  notes TEXT,
  checked_at DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id, checked_at)
);

-- EPDS Assessment results
CREATE TABLE public.epds_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  total_score INTEGER NOT NULL,
  answers JSONB NOT NULL, -- Store all 10 question answers
  risk_level TEXT NOT NULL, -- low, moderate, high
  recommendation TEXT,
  completed_at TIMESTAMPTZ DEFAULT now()
);

-- Mental health resources
CREATE TABLE public.mental_health_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_az TEXT NOT NULL,
  description TEXT,
  description_az TEXT,
  resource_type TEXT NOT NULL, -- hotline, psychologist, clinic, article
  phone TEXT,
  website TEXT,
  address TEXT,
  address_az TEXT,
  is_emergency BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0
);

-- =============================================
-- FEATURE 4: Həyat Qurtaran SOS (First Aid Guide)
-- =============================================

-- First aid scenarios
CREATE TABLE public.first_aid_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  title_az TEXT NOT NULL,
  description TEXT,
  description_az TEXT,
  icon TEXT,
  color TEXT DEFAULT '#EF4444',
  emergency_level TEXT DEFAULT 'high', -- low, medium, high, critical
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0
);

-- First aid steps
CREATE TABLE public.first_aid_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID REFERENCES public.first_aid_scenarios(id) ON DELETE CASCADE NOT NULL,
  step_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  title_az TEXT NOT NULL,
  instruction TEXT NOT NULL,
  instruction_az TEXT NOT NULL,
  audio_url TEXT, -- Pre-recorded audio instruction
  animation_url TEXT, -- GIF or video
  image_url TEXT,
  duration_seconds INTEGER DEFAULT 5,
  is_critical BOOLEAN DEFAULT false
);

-- =============================================
-- FEATURE 5: Sehrli Nağılçı (AI Fairy Tale Generator)
-- =============================================

-- Generated fairy tales library
CREATE TABLE public.fairy_tales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  
  -- Generation parameters
  child_name TEXT,
  theme TEXT, -- space, forest, city, sea, magic
  hero TEXT, -- toy name, animal
  moral_lesson TEXT, -- sharing, brushing_teeth, kindness, bravery
  
  -- Media
  audio_url TEXT,
  cover_image_url TEXT,
  
  -- Meta
  duration_minutes INTEGER DEFAULT 5,
  is_favorite BOOLEAN DEFAULT false,
  play_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Fairy tale themes/templates
CREATE TABLE public.fairy_tale_themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_az TEXT NOT NULL,
  description TEXT,
  description_az TEXT,
  emoji TEXT,
  cover_image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0
);

-- =============================================
-- FEATURE 6: Ulduz Falı (Horoscope)
-- =============================================

-- Zodiac signs
CREATE TABLE public.zodiac_signs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_az TEXT NOT NULL,
  symbol TEXT NOT NULL, -- emoji
  start_date TEXT NOT NULL, -- MM-DD format
  end_date TEXT NOT NULL,
  element TEXT, -- fire, earth, air, water
  ruling_planet TEXT,
  characteristics TEXT[],
  characteristics_az TEXT[],
  color TEXT,
  sort_order INTEGER DEFAULT 0
);

-- Compatibility matrix
CREATE TABLE public.zodiac_compatibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sign1 TEXT NOT NULL,
  sign2 TEXT NOT NULL,
  compatibility_score INTEGER CHECK (compatibility_score >= 1 AND compatibility_score <= 100),
  relationship_type TEXT, -- parent_child, romantic, general
  description TEXT,
  description_az TEXT,
  
  UNIQUE(sign1, sign2, relationship_type)
);

-- User horoscope history
CREATE TABLE public.horoscope_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  baby_sign TEXT,
  mom_sign TEXT,
  dad_sign TEXT,
  compatibility_result JSONB,
  shared_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- Enable RLS on all tables
-- =============================================

ALTER TABLE public.mom_friendly_places ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.place_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.place_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.play_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_play_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.play_inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.play_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mood_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epds_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mental_health_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.first_aid_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.first_aid_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fairy_tales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fairy_tale_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zodiac_signs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zodiac_compatibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horoscope_readings ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS Policies
-- =============================================

-- Mom-Friendly Places: Public read, authenticated write
CREATE POLICY "Anyone can view active places" ON public.mom_friendly_places FOR SELECT USING (is_active = true);
CREATE POLICY "Authenticated users can add places" ON public.mom_friendly_places FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Admins can update places" ON public.mom_friendly_places FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- Place Reviews
CREATE POLICY "Anyone can view reviews" ON public.place_reviews FOR SELECT USING (true);
CREATE POLICY "Users can add reviews" ON public.place_reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reviews" ON public.place_reviews FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own reviews" ON public.place_reviews FOR DELETE USING (auth.uid() = user_id);

-- Place Verifications
CREATE POLICY "Anyone can view verifications" ON public.place_verifications FOR SELECT USING (true);
CREATE POLICY "Users can add verifications" ON public.place_verifications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- User Badges
CREATE POLICY "Users can view all badges" ON public.user_badges FOR SELECT USING (true);
CREATE POLICY "System can award badges" ON public.user_badges FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Play Activities: Public read
CREATE POLICY "Anyone can view active activities" ON public.play_activities FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage activities" ON public.play_activities FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- User Play Inventory
CREATE POLICY "Users can view own inventory" ON public.user_play_inventory FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own inventory" ON public.user_play_inventory FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own inventory" ON public.user_play_inventory FOR DELETE USING (auth.uid() = user_id);

-- Play Inventory Items: Public read
CREATE POLICY "Anyone can view inventory items" ON public.play_inventory_items FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage inventory items" ON public.play_inventory_items FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Play Activity Logs
CREATE POLICY "Users can view own logs" ON public.play_activity_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can add logs" ON public.play_activity_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Mood Check-ins
CREATE POLICY "Users can view own checkins" ON public.mood_checkins FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can add checkins" ON public.mood_checkins FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own checkins" ON public.mood_checkins FOR UPDATE USING (auth.uid() = user_id);

-- EPDS Assessments
CREATE POLICY "Users can view own assessments" ON public.epds_assessments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can add assessments" ON public.epds_assessments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Mental Health Resources: Public read
CREATE POLICY "Anyone can view resources" ON public.mental_health_resources FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage resources" ON public.mental_health_resources FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- First Aid: Public read
CREATE POLICY "Anyone can view scenarios" ON public.first_aid_scenarios FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage scenarios" ON public.first_aid_scenarios FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Anyone can view steps" ON public.first_aid_steps FOR SELECT USING (true);
CREATE POLICY "Admins can manage steps" ON public.first_aid_steps FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Fairy Tales
CREATE POLICY "Users can view own tales" ON public.fairy_tales FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can add tales" ON public.fairy_tales FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tales" ON public.fairy_tales FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tales" ON public.fairy_tales FOR DELETE USING (auth.uid() = user_id);

-- Fairy Tale Themes: Public read
CREATE POLICY "Anyone can view themes" ON public.fairy_tale_themes FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage themes" ON public.fairy_tale_themes FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Zodiac: Public read
CREATE POLICY "Anyone can view zodiac signs" ON public.zodiac_signs FOR SELECT USING (true);
CREATE POLICY "Anyone can view compatibility" ON public.zodiac_compatibility FOR SELECT USING (true);
CREATE POLICY "Admins can manage zodiac" ON public.zodiac_signs FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage compatibility" ON public.zodiac_compatibility FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Horoscope Readings
CREATE POLICY "Users can view own readings" ON public.horoscope_readings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can add readings" ON public.horoscope_readings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own readings" ON public.horoscope_readings FOR UPDATE USING (auth.uid() = user_id);

-- =============================================
-- Trigger functions
-- =============================================

-- Update place ratings when review is added
CREATE OR REPLACE FUNCTION public.update_place_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.mom_friendly_places
  SET 
    avg_rating = (SELECT AVG(rating)::NUMERIC(2,1) FROM public.place_reviews WHERE place_id = NEW.place_id),
    review_count = (SELECT COUNT(*) FROM public.place_reviews WHERE place_id = NEW.place_id)
  WHERE id = NEW.place_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_place_review_change
AFTER INSERT OR UPDATE OR DELETE ON public.place_reviews
FOR EACH ROW EXECUTE FUNCTION public.update_place_rating();

-- Update verification count
CREATE OR REPLACE FUNCTION public.update_verification_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.mom_friendly_places
  SET verified_count = (SELECT COUNT(*) FROM public.place_verifications WHERE place_id = NEW.place_id AND is_confirmed = true)
  WHERE id = NEW.place_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_place_verification_change
AFTER INSERT OR UPDATE ON public.place_verifications
FOR EACH ROW EXECUTE FUNCTION public.update_verification_count();