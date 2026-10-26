-- Baby teeth master database (20 primary teeth)
CREATE TABLE public.baby_teeth_db (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tooth_code TEXT NOT NULL UNIQUE, -- e.g., 'upper_central_incisor_right'
  name TEXT NOT NULL, -- English name
  name_az TEXT, -- Azerbaijani name
  position TEXT NOT NULL, -- 'upper' or 'lower'
  side TEXT NOT NULL, -- 'left', 'right', or 'center'
  tooth_type TEXT NOT NULL, -- 'incisor', 'canine', 'molar'
  typical_emergence_months_min INTEGER, -- typical age range start
  typical_emergence_months_max INTEGER, -- typical age range end
  svg_path_id TEXT, -- ID for SVG element targeting
  sort_order INTEGER DEFAULT 0,
  description TEXT,
  description_az TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- User's teething log (which teeth have emerged)
CREATE TABLE public.user_teething_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tooth_id UUID NOT NULL REFERENCES public.baby_teeth_db(id) ON DELETE CASCADE,
  emerged_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, tooth_id)
);

-- Teething care tips (admin-managed)
CREATE TABLE public.teething_care_tips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  title_az TEXT,
  content TEXT NOT NULL,
  content_az TEXT,
  category TEXT DEFAULT 'general', -- 'before', 'during', 'after', 'general', 'pain_relief'
  emoji TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Teething symptoms (admin-managed)
CREATE TABLE public.teething_symptoms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  name_az TEXT,
  description TEXT,
  description_az TEXT,
  emoji TEXT,
  severity TEXT DEFAULT 'mild', -- 'mild', 'moderate', 'severe'
  relief_tips TEXT[],
  relief_tips_az TEXT[],
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.baby_teeth_db ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_teething_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teething_care_tips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teething_symptoms ENABLE ROW LEVEL SECURITY;

-- RLS policies for baby_teeth_db (public read)
CREATE POLICY "Anyone can view baby teeth data" ON public.baby_teeth_db FOR SELECT USING (true);
CREATE POLICY "Admins can manage baby teeth data" ON public.baby_teeth_db FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS policies for user_teething_logs
CREATE POLICY "Users can view own teething logs" ON public.user_teething_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own teething logs" ON public.user_teething_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own teething logs" ON public.user_teething_logs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own teething logs" ON public.user_teething_logs FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for teething_care_tips (public read)
CREATE POLICY "Anyone can view teething care tips" ON public.teething_care_tips FOR SELECT USING (true);
CREATE POLICY "Admins can manage teething care tips" ON public.teething_care_tips FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS policies for teething_symptoms (public read)
CREATE POLICY "Anyone can view teething symptoms" ON public.teething_symptoms FOR SELECT USING (true);
CREATE POLICY "Admins can manage teething symptoms" ON public.teething_symptoms FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Insert default baby teeth data (20 primary teeth)
INSERT INTO public.baby_teeth_db (tooth_code, name, name_az, position, side, tooth_type, typical_emergence_months_min, typical_emergence_months_max, svg_path_id, sort_order) VALUES
-- Upper teeth (right to left from front view)
('upper_central_incisor_right', 'Upper Right Central Incisor', 'Yuxarı Sağ Mərkəzi Kəsici', 'upper', 'right', 'incisor', 8, 12, 'tooth-ur-ci', 1),
('upper_central_incisor_left', 'Upper Left Central Incisor', 'Yuxarı Sol Mərkəzi Kəsici', 'upper', 'left', 'incisor', 8, 12, 'tooth-ul-ci', 2),
('upper_lateral_incisor_right', 'Upper Right Lateral Incisor', 'Yuxarı Sağ Yan Kəsici', 'upper', 'right', 'incisor', 9, 13, 'tooth-ur-li', 3),
('upper_lateral_incisor_left', 'Upper Left Lateral Incisor', 'Yuxarı Sol Yan Kəsici', 'upper', 'left', 'incisor', 9, 13, 'tooth-ul-li', 4),
('upper_canine_right', 'Upper Right Canine', 'Yuxarı Sağ Köpək Dişi', 'upper', 'right', 'canine', 16, 22, 'tooth-ur-c', 5),
('upper_canine_left', 'Upper Left Canine', 'Yuxarı Sol Köpək Dişi', 'upper', 'left', 'canine', 16, 22, 'tooth-ul-c', 6),
('upper_first_molar_right', 'Upper Right First Molar', 'Yuxarı Sağ Birinci Azı', 'upper', 'right', 'molar', 13, 19, 'tooth-ur-m1', 7),
('upper_first_molar_left', 'Upper Left First Molar', 'Yuxarı Sol Birinci Azı', 'upper', 'left', 'molar', 13, 19, 'tooth-ul-m1', 8),
('upper_second_molar_right', 'Upper Right Second Molar', 'Yuxarı Sağ İkinci Azı', 'upper', 'right', 'molar', 25, 33, 'tooth-ur-m2', 9),
('upper_second_molar_left', 'Upper Left Second Molar', 'Yuxarı Sol İkinci Azı', 'upper', 'left', 'molar', 25, 33, 'tooth-ul-m2', 10),
-- Lower teeth (right to left from front view)
('lower_central_incisor_right', 'Lower Right Central Incisor', 'Aşağı Sağ Mərkəzi Kəsici', 'lower', 'right', 'incisor', 6, 10, 'tooth-lr-ci', 11),
('lower_central_incisor_left', 'Lower Left Central Incisor', 'Aşağı Sol Mərkəzi Kəsici', 'lower', 'left', 'incisor', 6, 10, 'tooth-ll-ci', 12),
('lower_lateral_incisor_right', 'Lower Right Lateral Incisor', 'Aşağı Sağ Yan Kəsici', 'lower', 'right', 'incisor', 10, 16, 'tooth-lr-li', 13),
('lower_lateral_incisor_left', 'Lower Left Lateral Incisor', 'Aşağı Sol Yan Kəsici', 'lower', 'left', 'incisor', 10, 16, 'tooth-ll-li', 14),
('lower_canine_right', 'Lower Right Canine', 'Aşağı Sağ Köpək Dişi', 'lower', 'right', 'canine', 17, 23, 'tooth-lr-c', 15),
('lower_canine_left', 'Lower Left Canine', 'Aşağı Sol Köpək Dişi', 'lower', 'left', 'canine', 17, 23, 'tooth-ll-c', 16),
('lower_first_molar_right', 'Lower Right First Molar', 'Aşağı Sağ Birinci Azı', 'lower', 'right', 'molar', 14, 18, 'tooth-lr-m1', 17),
('lower_first_molar_left', 'Lower Left First Molar', 'Aşağı Sol Birinci Azı', 'lower', 'left', 'molar', 14, 18, 'tooth-ll-m1', 18),
('lower_second_molar_right', 'Lower Right Second Molar', 'Aşağı Sağ İkinci Azı', 'lower', 'right', 'molar', 23, 31, 'tooth-lr-m2', 19),
('lower_second_molar_left', 'Lower Left Second Molar', 'Aşağı Sol İkinci Azı', 'lower', 'left', 'molar', 23, 31, 'tooth-ll-m2', 20);

-- Insert default care tips
INSERT INTO public.teething_care_tips (title, title_az, content, content_az, category, emoji, sort_order) VALUES
('Cold Teething Rings', 'Soyuq Diş Halqaları', 'Refrigerate teething rings for soothing relief. Never freeze them as it can be too cold for baby''s gums.', 'Diş halqalarını soyuducuda saxlayın. Heç vaxt dondurmayın, çünki körpənin diş ətləri üçün çox soyuq ola bilər.', 'pain_relief', '🧊', 1),
('Gentle Gum Massage', 'Yumşaq Diş Əti Masajı', 'Use a clean finger to gently massage your baby''s gums in circular motions.', 'Təmiz barmağınızla körpənizin diş ətlərini dairəvi hərəkətlərlə yumşaq şəkildə masaj edin.', 'pain_relief', '👆', 2),
('Clean Wet Washcloth', 'Təmiz Islaq Parça', 'Chill a clean, wet washcloth in the refrigerator and let baby chew on it.', 'Təmiz, islaq parçanı soyuducuda soyudun və körpənin çeynəməsinə icazə verin.', 'pain_relief', '🧴', 3),
('First Tooth Care', 'İlk Diş Qulluğu', 'Start brushing as soon as the first tooth appears using a soft baby toothbrush with water only.', 'İlk diş görünən kimi yalnız su ilə yumşaq körpə diş fırçası istifadə edərək fırçalamağa başlayın.', 'during', '🪥', 4),
('Avoid Sugar', 'Şəkərdən Qaçının', 'Avoid giving sugary foods and drinks, especially before bedtime, to prevent early tooth decay.', 'Erkən diş çürümələrinin qarşısını almaq üçün, xüsusilə yatmazdan əvvəl şəkərli qida və içkilərdən qaçın.', 'general', '🍭', 5),
('Regular Dental Visits', 'Mütəmadi Diş Həkimi Ziyarətləri', 'Schedule baby''s first dental visit by their first birthday or when the first tooth appears.', 'Körpənin ilk diş həkimi ziyarətini ilk ad günündən əvvəl və ya ilk diş görünəndə planlaşdırın.', 'after', '🏥', 6),
('Drool Rash Prevention', 'Sulanma Səpgisinin Qarşısını Alma', 'Keep baby''s chin and neck dry. Apply a gentle barrier cream to prevent drool rash.', 'Körpənin çənəsini və boynunu quru saxlayın. Sulanma səpgisinin qarşısını almaq üçün yumşaq bariyer kremi sürtün.', 'during', '💧', 7),
('Safe Teething Toys', 'Təhlükəsiz Diş Oyuncaqları', 'Choose BPA-free, non-toxic teething toys. Avoid toys with small parts that could be choking hazards.', 'BPA-sız, toksik olmayan diş oyuncaqları seçin. Boğulma təhlükəsi yarada biləcək kiçik hissələri olan oyuncaqlardan qaçın.', 'general', '🧸', 8);

-- Insert default symptoms
INSERT INTO public.teething_symptoms (name, name_az, description, description_az, emoji, severity, relief_tips, relief_tips_az, sort_order) VALUES
('Drooling', 'Sulanma', 'Excessive drooling is very common during teething', 'Diş çıxarma zamanı həddindən artıq sulanma çox yaygındır', '💧', 'mild', ARRAY['Keep bibs on baby', 'Wipe drool frequently', 'Apply barrier cream'], ARRAY['Körpəyə önlük taxın', 'Sulanmanı tez-tez silin', 'Bariyer kremi sürtün'], 1),
('Gum Swelling', 'Diş Əti Şişməsi', 'Red, swollen gums where teeth are emerging', 'Dişlərin çıxdığı yerdə qırmızı, şişmiş diş ətləri', '🔴', 'moderate', ARRAY['Cold teething ring', 'Gentle massage', 'Chilled washcloth'], ARRAY['Soyuq diş halqası', 'Yumşaq masaj', 'Soyudulmuş parça'], 2),
('Irritability', 'Əsəbilik', 'Baby may be fussier than usual due to discomfort', 'Narahatlıq səbəbindən körpə həmişəkindən daha əsəbi ola bilər', '😤', 'moderate', ARRAY['Extra cuddles', 'Distraction with toys', 'Soothing sounds'], ARRAY['Əlavə qucaqlaşma', 'Oyuncaqlarla diqqəti yayındırmaq', 'Sakitləşdirici səslər'], 3),
('Sleep Problems', 'Yuxu Problemləri', 'Teething pain may disrupt sleep patterns', 'Diş ağrısı yuxu rejimini poza bilər', '😴', 'moderate', ARRAY['Maintain routine', 'Pain relief before bed', 'Comfort nursing'], ARRAY['Rejimi qoruyun', 'Yatmazdan əvvəl ağrı kəsici', 'Rahatlaşdırıcı əmizdirmə'], 4),
('Loss of Appetite', 'İştahasızlıq', 'Baby may refuse to eat due to sore gums', 'Körpə ağrılı diş ətləri səbəbindən yeməkdən imtina edə bilər', '🍼', 'mild', ARRAY['Offer cold foods', 'Try different textures', 'Stay patient'], ARRAY['Soyuq qidalar təklif edin', 'Fərqli teksturalar sınayın', 'Səbirli olun'], 5),
('Chewing on Objects', 'Əşyaları Çeynəmək', 'Baby puts everything in mouth for counter-pressure relief', 'Körpə rahatlamaq üçün hər şeyi ağzına qoyur', '👄', 'mild', ARRAY['Provide safe teethers', 'Supervise play', 'Clean toys regularly'], ARRAY['Təhlükəsiz dişliklər verin', 'Oyuna nəzarət edin', 'Oyuncaqları mütəmadi təmizləyin'], 6),
('Ear Pulling', 'Qulaq Çəkmə', 'Baby may pull ears due to referred pain from gums', 'Körpə diş ətlərindən yayılan ağrı səbəbindən qulaqlarını çəkə bilər', '👂', 'mild', ARRAY['Check for ear infection', 'Gum massage', 'Distraction'], ARRAY['Qulaq infeksiyasını yoxlayın', 'Diş əti masajı', 'Diqqəti yayındırma'], 7),
('Low-Grade Fever', 'Aşağı Qızdırma', 'Slight temperature increase (under 38°C) may occur', 'Yüngül temperatur artımı (38°C-dən aşağı) baş verə bilər', '🌡️', 'moderate', ARRAY['Monitor temperature', 'Keep baby hydrated', 'Consult doctor if high'], ARRAY['Temperaturu izləyin', 'Körpəni nəmli saxlayın', 'Yüksəkdirsə həkimə müraciət edin'], 8);