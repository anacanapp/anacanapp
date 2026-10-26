
-- Maternity benefits configuration (admin managed)
CREATE TABLE public.maternity_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_key TEXT NOT NULL UNIQUE,
  value DECIMAL(10,2) NOT NULL,
  label TEXT NOT NULL,
  label_az TEXT,
  description TEXT,
  description_az TEXT,
  is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.maternity_config ENABLE ROW LEVEL SECURITY;

-- Everyone can read
CREATE POLICY "Anyone can read maternity config"
  ON public.maternity_config
  FOR SELECT
  USING (is_active = true);

-- Only admins can manage
CREATE POLICY "Admins can manage maternity config"
  ON public.maternity_config
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Maternity guidelines (admin managed content)
CREATE TABLE public.maternity_guidelines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  title_az TEXT,
  content TEXT NOT NULL,
  content_az TEXT,
  category TEXT DEFAULT 'general',
  icon TEXT DEFAULT '📋',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.maternity_guidelines ENABLE ROW LEVEL SECURITY;

-- Everyone can read
CREATE POLICY "Anyone can read maternity guidelines"
  ON public.maternity_guidelines
  FOR SELECT
  USING (is_active = true);

-- Only admins can manage
CREATE POLICY "Admins can manage maternity guidelines"
  ON public.maternity_guidelines
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Insert default configuration based on Azerbaijan legislation
INSERT INTO public.maternity_config (config_key, value, label, label_az, description, description_az) VALUES
  ('birth_benefit', 600, 'One-time Birth Benefit', 'Birdəfəlik Doğum Müavinəti', 'One-time payment at birth', 'Doğuş zamanı birdəfəlik ödəniş'),
  ('normal_leave_days_before', 70, 'Leave Days Before Birth (Normal)', 'Doğuşdan Əvvəl Məzuniyyət (Normal)', 'Days before birth for normal pregnancy', 'Normal hamiləlik üçün doğuşdan əvvəl günlər'),
  ('normal_leave_days_after', 56, 'Leave Days After Birth (Normal)', 'Doğuşdan Sonra Məzuniyyət (Normal)', 'Days after birth for normal delivery', 'Normal doğuş üçün doğuşdan sonra günlər'),
  ('complicated_leave_days_after', 70, 'Leave Days After Birth (Complicated)', 'Doğuşdan Sonra Məzuniyyət (Ağır)', 'Days after birth for complicated delivery', 'Ağır doğuş üçün doğuşdan sonra günlər'),
  ('multiple_leave_days_before', 84, 'Leave Days Before Birth (Multiple)', 'Doğuşdan Əvvəl Məzuniyyət (Çoxdöllü)', 'Days before birth for multiple pregnancy', 'Çoxdöllü hamiləlik üçün doğuşdan əvvəl günlər'),
  ('multiple_leave_days_after', 110, 'Leave Days After Birth (Multiple)', 'Doğuşdan Sonra Məzuniyyət (Çoxdöllü)', 'Days after birth for multiple birth', 'Çoxdöllü doğuş üçün doğuşdan sonra günlər'),
  ('min_salary', 345, 'Minimum Salary', 'Minimum Əmək Haqqı', 'Minimum monthly salary in AZN', 'AZN ilə minimum aylıq əmək haqqı'),
  ('max_calculation_coefficient', 1, 'Maximum Calculation Coefficient', 'Maksimum Hesablama Əmsalı', 'Coefficient for calculation', 'Hesablama üçün əmsal'),
  ('social_insurance_months', 12, 'Required Insurance Months', 'Tələb olunan Sığorta Ayları', 'Minimum months of social insurance', 'Minimum sosial sığorta müddəti');

-- Insert default guidelines
INSERT INTO public.maternity_guidelines (title, title_az, content, content_az, category, icon, sort_order) VALUES
  (
    'Who is Eligible?',
    'Kim müraciət edə bilər?',
    'Employed women with social insurance coverage are eligible.',
    E'Dekret müavinəti almaq üçün aşağıdakı şərtlər ödənilməlidir:\n\n• İşləyən qadın olmalısınız (əmək müqaviləsi əsasında)\n• Minimum 12 ay sosial sığorta ödənişiniz olmalıdır\n• Hamiləlik barədə tibbi arayış olmalıdır\n• İşəgötürəndə rəsmi qeydiyyatda olmalısınız',
    'eligibility',
    '✅',
    1
  ),
  (
    'Required Documents',
    'Tələb olunan sənədlər',
    'Documents needed for application.',
    E'Dekret müavinəti üçün lazım olan sənədlər:\n\n1. **Həkim arayışı** - Tibbi müəssisədən hamiləlik barədə arayış\n2. **Əmək qabiliyyətinin müvəqqəti itirilməsi vərəqəsi** - Xəstəlik vərəqi\n3. **Şəxsiyyət vəsiqəsinin surəti**\n4. **Əmək kitabçasının surəti**\n5. **Ərizə** - İşəgötürənə yazılı müraciət',
    'documents',
    '📄',
    2
  ),
  (
    'Application Process',
    'Müraciət prosesi',
    'Step by step application guide.',
    E'Dekret ödənişi almaq üçün addımlar:\n\n**1. Tibbi arayış alın**\nHamiləliyin 30-cu həftəsində (çoxdöllü olduqda 28-ci həftədə) həkimdən xəstəlik vərəqi alın.\n\n**2. İşəgötürənə müraciət edin**\nXəstəlik vərəqini və ərizəni işəgötürənə təqdim edin.\n\n**3. İşəgötürən DSMF-ə göndərir**\nİşəgötürən sənədləri Dövlət Sosial Müdafiə Fonduna təqdim edir.\n\n**4. Ödəniş alın**\nMüavinət 10 iş günü ərzində bank kartınıza köçürülür.',
    'process',
    '📝',
    3
  ),
  (
    'Calculation Method',
    'Hesablama qaydası',
    'How the benefit is calculated.',
    E'Dekret ödənişi belə hesablanır:\n\n**Formula:**\nÖdəniş = Orta günlük əmək haqqı × Məzuniyyət günləri\n\n**Orta günlük əmək haqqı:**\nSon 12 ayın ümumi əmək haqqı ÷ 365\n\n**Məzuniyyət müddəti:**\n• Normal hamiləlik: 126 gün (70+56)\n• Ağır doğuş: 140 gün (70+70)\n• Çoxdöllü: 194 gün (84+110)\n\n**Qeyd:** Ödəniş tam məbləğdə, vergi tutulmadan verilir.',
    'calculation',
    '🧮',
    4
  ),
  (
    'One-time Birth Benefit',
    'Birdəfəlik doğum müavinəti',
    'Information about the 600 AZN benefit.',
    E'**600 AZN birdəfəlik doğum müavinəti**\n\nBu müavinət doğuşdan sonra hər uşaq üçün verilir.\n\n**Kim ala bilər:**\n• Bütün Azərbaycan vətəndaşları\n• İşləyib-işləməməsindən asılı olmayaraq\n\n**Necə almaq olar:**\n1. ASAN xidmətinə müraciət edin\n2. Doğum haqqında şəhadətnaməni təqdim edin\n3. Şəxsiyyət vəsiqənizin surətini verin\n4. Bank hesab məlumatlarını göstərin\n\n**Müddət:** Doğuşdan sonra 12 ay ərzində müraciət edilməlidir.',
    'birth_benefit',
    '💰',
    5
  ),
  (
    'Important Notes',
    'Vacib qeydlər',
    'Additional important information.',
    E'**Bilməli olduğunuz məlumatlar:**\n\n⚠️ Özünüməşğulluq və ya qeyri-rəsmi işləyənlər dekret ödənişi ala bilməzlər, lakin 600 AZN birdəfəlik müavinət hüququ var.\n\n⚠️ Dekret müddətində iş yeri saxlanılır.\n\n⚠️ 3 yaşa qədər uşağa qulluq üçün ödənişsiz məzuniyyət hüququnuz var.\n\n⚠️ Dekret müddətində işdən çıxarıla bilməzsiniz.\n\n📞 Əlavə məlumat üçün: DSMF qaynar xətti - 142',
    'notes',
    '⚠️',
    6
  );
