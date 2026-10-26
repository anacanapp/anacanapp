-- ============================================
-- App Rating System
-- ============================================

-- Table to track app rating prompts and responses
CREATE TABLE public.app_rating_prompts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  first_shown_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_shown_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_action VARCHAR(50) NOT NULL DEFAULT 'shown', -- 'shown', 'later', 'rated', 'never'
  show_count INT NOT NULL DEFAULT 1,
  rated_at TIMESTAMPTZ,
  platform VARCHAR(20), -- 'ios', 'android', 'web'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_rating UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.app_rating_prompts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own rating prompts"
  ON public.app_rating_prompts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own rating prompts"
  ON public.app_rating_prompts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own rating prompts"
  ON public.app_rating_prompts FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================
-- Baby Month Illustrations (like fetus images)
-- ============================================

CREATE TABLE public.baby_month_illustrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  month_number INT NOT NULL CHECK (month_number >= 1 AND month_number <= 36),
  image_url TEXT NOT NULL,
  title VARCHAR(100),
  title_az VARCHAR(100),
  description TEXT,
  description_az TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_month_illustration UNIQUE(month_number)
);

-- Enable RLS (public read, admin write)
ALTER TABLE public.baby_month_illustrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view baby illustrations"
  ON public.baby_month_illustrations FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage baby illustrations"
  ON public.baby_month_illustrations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- Baby Crisis/Leap Calendar
-- ============================================

CREATE TABLE public.baby_crisis_periods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  week_start INT NOT NULL,
  week_end INT NOT NULL,
  leap_number INT, -- Wonder Weeks leap number (1-10)
  title VARCHAR(200) NOT NULL,
  title_az VARCHAR(200),
  description TEXT,
  description_az TEXT,
  symptoms TEXT[], -- Common symptoms during this crisis
  symptoms_az TEXT[],
  tips TEXT[], -- Tips for parents
  tips_az TEXT[],
  duration_days INT, -- Average duration
  severity VARCHAR(20) DEFAULT 'medium', -- 'mild', 'medium', 'intense'
  emoji VARCHAR(10) DEFAULT '😢',
  color VARCHAR(20) DEFAULT '#F48155',
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS (public read, admin write)
ALTER TABLE public.baby_crisis_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view crisis periods"
  ON public.baby_crisis_periods FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage crisis periods"
  ON public.baby_crisis_periods FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Insert default Wonder Weeks data (known developmental leaps)
INSERT INTO public.baby_crisis_periods (week_start, week_end, leap_number, title, title_az, description, description_az, symptoms, symptoms_az, tips, tips_az, duration_days, severity, emoji) VALUES
(5, 5, 1, 'The World of Changing Sensations', 'Dəyişən Hisslər Dünyası', 
  'Baby starts to experience the world differently, senses become sharper',
  'Körpə dünyanı fərqli hiss etməyə başlayır, hissləri kəskinləşir',
  ARRAY['More crying', 'Clinginess', 'Poor sleep', 'Loss of appetite'],
  ARRAY['Daha çox ağlama', 'Yapışqanlıq', 'Pis yuxu', 'İştahsızlıq'],
  ARRAY['Extra cuddles', 'Skin-to-skin contact', 'Patience'],
  ARRAY['Əlavə qucaqlaşma', 'Dəri ilə təmas', 'Səbir'],
  7, 'mild', '🌟'),

(8, 9, 2, 'The World of Patterns', 'Naxışlar Dünyası',
  'Baby discovers patterns and starts recognizing faces and objects',
  'Körpə naxışları kəşf edir, üzləri və əşyaları tanımağa başlayır',
  ARRAY['Fussiness', 'More wakeful', 'Needs more attention', 'Hungry more often'],
  ARRAY['Narazılıq', 'Daha oyaq', 'Daha çox diqqət tələb edir', 'Tez-tez aclıq'],
  ARRAY['Black and white toys', 'Face-to-face time', 'Calm environment'],
  ARRAY['Qara-ağ oyuncaqlar', 'Üz-üzə vaxt', 'Sakit mühit'],
  14, 'medium', '👀'),

(12, 12, 3, 'The World of Smooth Transitions', 'Hamar Keçidlər Dünyası',
  'Baby learns smooth movements and transitions between actions',
  'Körpə hamar hərəkətlər və keçidlər öyrənir',
  ARRAY['Crying more', 'Sleep problems', 'Wants to be held constantly'],
  ARRAY['Daha çox ağlama', 'Yuxu problemləri', 'Daim qucaqda olmaq istəyir'],
  ARRAY['Movement activities', 'Gentle rocking', 'Massage'],
  ARRAY['Hərəkət fəaliyyətləri', 'Yumşaq yellənmə', 'Masaj'],
  7, 'medium', '🔄'),

(19, 19, 4, 'The World of Events', 'Hadisələr Dünyası',
  'Baby understands cause and effect, sequences of events',
  'Körpə səbəb-nəticə əlaqəsini, hadisələr ardıcıllığını anlayır',
  ARRAY['Extreme clinginess', 'Mood swings', 'Poor appetite', 'Night waking'],
  ARRAY['Həddindən artıq yapışqanlıq', 'Əhval dəyişiklikləri', 'Zəif iştah', 'Gecə oyanma'],
  ARRAY['Peek-a-boo games', 'Consistent routine', 'Extra patience'],
  ARRAY['Peek-a-boo oyunları', 'Ardıcıl rejim', 'Əlavə səbir'],
  21, 'intense', '⚡'),

(26, 26, 5, 'The World of Relationships', 'Münasibətlər Dünyası',
  'Baby understands distance and relationships between objects',
  'Körpə məsafə və əşyalar arasındakı əlaqələri anlayır',
  ARRAY['Separation anxiety', 'Nightmares', 'Shyness with strangers'],
  ARRAY['Ayrılıq narahatlığı', 'Kabuslar', 'Yad adamlarla utancaqlıq'],
  ARRAY['Stay close', 'Comfort objects', 'Gradual separations'],
  ARRAY['Yaxınlıqda olun', 'Rahatlıq əşyaları', 'Tədricən ayrılıqlar'],
  21, 'intense', '💕'),

(37, 37, 6, 'The World of Categories', 'Kateqoriyalar Dünyası',
  'Baby starts categorizing objects, people, and emotions',
  'Körpə əşyaları, insanları və duyğuları təsnif etməyə başlayır',
  ARRAY['Tantrums', 'Possessiveness', 'Testing limits'],
  ARRAY['Histərikalar', 'Sahibkarlıq hissi', 'Sərhədləri sınamaq'],
  ARRAY['Naming things', 'Sorting games', 'Clear boundaries'],
  ARRAY['Əşyaları adlandırma', 'Çeşidləmə oyunları', 'Aydın sərhədlər'],
  28, 'medium', '📦'),

(46, 46, 7, 'The World of Sequences', 'Ardıcıllıqlar Dünyası',
  'Baby understands sequences and can follow multi-step actions',
  'Körpə ardıcıllıqları anlayır və çox addımlı hərəkətlər edə bilir',
  ARRAY['Frustration', 'Demanding', 'Impatience', 'Clinginess'],
  ARRAY['Məyusluq', 'Tələbkarlıq', 'Səbirsizlik', 'Yapışqanlıq'],
  ARRAY['Sequential play', 'Stacking toys', 'Story routines'],
  ARRAY['Ardıcıl oyun', 'Yığma oyuncaqlar', 'Hekayə rejimləri'],
  28, 'medium', '🔢'),

(55, 55, 8, 'The World of Programs', 'Proqramlar Dünyası',
  'Toddler starts planning and executing complex actions',
  'Kiçik uşaq mürəkkəb hərəkətləri planlaşdırmağa və icra etməyə başlayır',
  ARRAY['Willfulness', 'Power struggles', 'Independence seeking'],
  ARRAY['İradəlilik', 'Güc mübarizəsi', 'Müstəqillik axtarışı'],
  ARRAY['Choices within limits', 'Independence in safe ways', 'Praise efforts'],
  ARRAY['Sərhədlər daxilində seçimlər', 'Təhlükəsiz müstəqillik', 'Səyləri tərifləyin'],
  35, 'intense', '🎯'),

(64, 64, 9, 'The World of Principles', 'Prinsiplər Dünyası',
  'Child develops moral understanding and principles',
  'Uşaq əxlaqi anlayış və prinsiplər formalaşdırır',
  ARRAY['Defiance', 'Testing boundaries', 'Emotional outbursts'],
  ARRAY['Asi davranış', 'Sərhədləri sınamaq', 'Emosional partlayışlar'],
  ARRAY['Consistent rules', 'Explain why', 'Model behavior'],
  ARRAY['Ardıcıl qaydalar', 'Səbəbi izah edin', 'Nümunə davranış'],
  35, 'intense', '⚖️'),

(75, 75, 10, 'The World of Systems', 'Sistemlər Dünyası',
  'Child understands systems and how things work together',
  'Uşaq sistemləri və əşyaların birlikdə necə işlədiyini anlayır',
  ARRAY['Questioning everything', 'Frustration with complexity'],
  ARRAY['Hər şeyi sorğulamaq', 'Mürəkkəblikdən məyusluq'],
  ARRAY['Answer questions patiently', 'Explore together', 'Build things'],
  ARRAY['Səbirlə cavab verin', 'Birlikdə kəşf edin', 'Birlikdə qurun'],
  35, 'medium', '🧩');

-- Function to get current crisis for baby age in weeks
CREATE OR REPLACE FUNCTION public.get_baby_crisis(baby_age_weeks INT)
RETURNS SETOF public.baby_crisis_periods
LANGUAGE sql STABLE
AS $$
  SELECT * FROM public.baby_crisis_periods
  WHERE is_active = true
    AND baby_age_weeks BETWEEN week_start AND week_end
  ORDER BY week_start;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_baby_crisis(INT) TO anon, authenticated;