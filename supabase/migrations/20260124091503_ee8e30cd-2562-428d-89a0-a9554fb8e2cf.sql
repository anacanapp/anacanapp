-- Create vitamins table for admin-managed vitamin recommendations
CREATE TABLE public.vitamins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  name_az VARCHAR(100),
  description TEXT,
  description_az TEXT,
  benefits TEXT[],
  food_sources TEXT[],
  dosage VARCHAR(100),
  week_start INT,
  week_end INT,
  trimester INT,
  life_stage VARCHAR(20) DEFAULT 'bump',
  importance VARCHAR(20) DEFAULT 'recommended',
  icon_emoji VARCHAR(10) DEFAULT '💊',
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vitamins ENABLE ROW LEVEL SECURITY;

-- Create policies - public read for active vitamins
CREATE POLICY "Anyone can read active vitamins"
ON public.vitamins
FOR SELECT
USING (is_active = true);

-- Admin full access (using role from profiles)
CREATE POLICY "Admins can manage vitamins"
ON public.vitamins
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Create index for efficient queries
CREATE INDEX idx_vitamins_week ON public.vitamins(week_start, week_end);
CREATE INDEX idx_vitamins_life_stage ON public.vitamins(life_stage);
CREATE INDEX idx_vitamins_trimester ON public.vitamins(trimester);

-- Insert default vitamin data for pregnancy weeks
INSERT INTO public.vitamins (name, name_az, description_az, benefits, food_sources, dosage, week_start, week_end, trimester, life_stage, importance, icon_emoji, sort_order) VALUES
-- First Trimester (1-12 weeks)
('Folic Acid', 'Fol turşusu', 'Körpənin sinir sisteminin inkişafı üçün kritik vitamin', ARRAY['Nöral boru qüsurlarının qarşısını alır', 'DNT sintezinə kömək edir', 'Hüceyrə bölünməsini dəstəkləyir'], ARRAY['Tünd yaşıl yarpaqlı tərəvəzlər', 'Sitrus meyvələri', 'Noxud', 'Mercimək'], '400-800 mkq/gün', 1, 12, 1, 'bump', 'essential', '🥬', 1),
('Iron', 'Dəmir', 'Qan həcminin artması və körpənin inkişafı üçün vacib', ARRAY['Anemiyanın qarşısını alır', 'Oksigen daşınmasını təmin edir', 'Enerji səviyyəsini artırır'], ARRAY['Qırmızı ət', 'Ispanaq', 'Lobya', 'Quru meyvələr'], '27 mq/gün', 1, 40, 1, 'bump', 'essential', '🥩', 2),
('Vitamin D', 'D vitamini', 'Sümük sağlamlığı və immun sistem üçün vacib', ARRAY['Kalsium udulmasına kömək edir', 'Sümük inkişafını dəstəkləyir', 'İmmun sistemini gücləndirir'], ARRAY['Günəş işığı', 'Yağlı balıq', 'Yumurta sarısı', 'Zənginləşdirilmiş süd'], '600-800 IU/gün', 1, 40, 1, 'bump', 'essential', '☀️', 3),
('Vitamin B12', 'B12 vitamini', 'Sinir sistemi və qan hüceyrələri üçün vacib', ARRAY['Sinir sistemini qoruyur', 'Qırmızı qan hüceyrələri istehsal edir', 'DNT sintezinə kömək edir'], ARRAY['Ət', 'Balıq', 'Yumurta', 'Süd məhsulları'], '2.6 mkq/gün', 1, 40, 1, 'bump', 'recommended', '🥚', 4),

-- Second Trimester emphasis (13-27 weeks)
('Calcium', 'Kalsium', 'Körpənin sümük və dişlərinin inkişafı üçün', ARRAY['Sümük və diş inkişafı', 'Əzələ funksiyası', 'Sinir ötürücülüyü'], ARRAY['Süd məhsulları', 'Brokoli', 'Badam', 'Sardina'], '1000 mq/gün', 13, 40, 2, 'bump', 'essential', '🥛', 5),
('Omega-3', 'Omeqa-3', 'Beyin və göz inkişafı üçün kritik yağ turşusu', ARRAY['Beyin inkişafı', 'Göz inkişafı', 'İltihab əleyhinə'], ARRAY['Somon', 'Sardalya', 'Ceviz', 'Kətan toxumu'], '200-300 mq DHA/gün', 13, 40, 2, 'bump', 'essential', '🐟', 6),
('Magnesium', 'Maqnezium', 'Əzələ kramları və yuxu keyfiyyəti üçün', ARRAY['Əzələ rahatlaması', 'Yuxu keyfiyyəti', 'Qan şəkəri tənzimi'], ARRAY['Badam', 'Ispanaq', 'Qara şokolad', 'Avokado'], '350-400 mq/gün', 13, 40, 2, 'bump', 'recommended', '🥜', 7),

-- Third Trimester emphasis (28-40 weeks)
('Vitamin K', 'K vitamini', 'Qan laxtalanması və sümük sağlamlığı üçün', ARRAY['Qan laxtalanması', 'Sümük sağlamlığı', 'Doğuşa hazırlıq'], ARRAY['Yaşıl yarpaqlı tərəvəzlər', 'Brokoli', 'Kələm', 'Brüssel kələmi'], '90 mkq/gün', 28, 40, 3, 'bump', 'recommended', '🥦', 8),
('Zinc', 'Sink', 'İmmun sistem və hüceyrə bölünməsi üçün', ARRAY['İmmun dəstəyi', 'Yara sağalması', 'Protein sintezi'], ARRAY['Ət', 'Balqabaq toxumu', 'Noxud', 'Fındıq'], '11 mq/gün', 1, 40, 3, 'bump', 'recommended', '🎃', 9),

-- Mommy stage vitamins
('Vitamin B Complex', 'B kompleks vitamini', 'Əmizdirmə dövründə enerji və süd istehsalı üçün', ARRAY['Enerji istehsalı', 'Süd keyfiyyəti', 'Sinir sistemi dəstəyi'], ARRAY['Tam taxıl', 'Ət', 'Yumurta', 'Yaşıl tərəvəzlər'], 'B1: 1.4mq, B2: 1.6mq, B6: 2mq/gün', NULL, NULL, NULL, 'mommy', 'essential', '💊', 10),
('Iodine', 'Yod', 'Körpənin beyin inkişafı və ana tireoid funksiyası üçün', ARRAY['Tireoid funksiyası', 'Beyin inkişafı', 'Metabolizm tənzimi'], ARRAY['Dəniz məhsulları', 'Yodlaşdırılmış duz', 'Süd', 'Yumurta'], '290 mkq/gün', NULL, NULL, NULL, 'mommy', 'essential', '🧂', 11);

-- Trigger for updated_at
CREATE TRIGGER update_vitamins_updated_at
BEFORE UPDATE ON public.vitamins
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();