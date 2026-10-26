-- Create pregnancy daily content table for comprehensive tracking
CREATE TABLE public.pregnancy_daily_content (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  week_number INTEGER NOT NULL CHECK (week_number >= 1 AND week_number <= 42),
  day_number INTEGER CHECK (day_number >= 1 AND day_number <= 7),
  
  -- Baby development info
  baby_size_fruit TEXT, -- meyvə müqayisəsi
  baby_size_cm DECIMAL(5,2), -- santimetr
  baby_weight_gram DECIMAL(7,2), -- qram
  baby_development TEXT, -- körpə inkişafı
  baby_message TEXT, -- körpədən mesaj
  
  -- Mother info
  mother_symptoms TEXT[], -- ana simptomları
  mother_tips TEXT, -- ana üçün məsləhətlər
  mother_warnings TEXT, -- diqqət ediləcəklər
  
  -- Nutrition
  nutrition_tip TEXT, -- qidalanma tövsiyəsi
  recommended_foods TEXT[], -- tövsiyə edilən qidalar
  foods_to_avoid TEXT[], -- çəkinilməli qidalar
  
  -- Exercise
  exercise_tip TEXT, -- məşq tövsiyəsi
  recommended_exercises TEXT[], -- tövsiyə edilən məşqlər
  
  -- Appointments
  doctor_visit_tip TEXT, -- həkim viziti məsləhəti
  tests_to_do TEXT[], -- ediləcək testlər
  
  -- Emotional
  emotional_tip TEXT, -- emosional məsləhət
  partner_tip TEXT, -- partner üçün məsləhət
  
  -- Media
  image_url TEXT,
  video_url TEXT,
  
  -- Metadata
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create unique constraint for week + day combination
CREATE UNIQUE INDEX idx_pregnancy_content_week_day ON public.pregnancy_daily_content(week_number, day_number) WHERE day_number IS NOT NULL;
CREATE UNIQUE INDEX idx_pregnancy_content_week_only ON public.pregnancy_daily_content(week_number) WHERE day_number IS NULL;

-- Enable RLS
ALTER TABLE public.pregnancy_daily_content ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view active pregnancy content"
  ON public.pregnancy_daily_content
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage pregnancy content"
  ON public.pregnancy_daily_content
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_pregnancy_daily_content_updated_at
  BEFORE UPDATE ON public.pregnancy_daily_content
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.pregnancy_daily_content;

-- Insert sample data for weeks 1-40
INSERT INTO public.pregnancy_daily_content (week_number, baby_size_fruit, baby_size_cm, baby_weight_gram, baby_development, baby_message, mother_symptoms, mother_tips, nutrition_tip, recommended_foods, emotional_tip, partner_tip, is_active) VALUES
(1, 'Xaşxaş toxumu', 0.1, 0.01, 'Mayalanma baş verir', 'Salam ana! Mən indicə yarandım! 🌟', ARRAY['Heç bir simptom olmaya bilər'], 'Folik turşusu qəbul etməyə başlayın', 'Folik turşusu zəngin qidalar yeyin', ARRAY['Ispanaq', 'Brokkoli', 'Portağal'], 'Hamiləlik testi müsbət çıxsa sevinc yaşamaq normaldır', 'Partnyorunuza dəstək olun', true),
(2, 'Xaşxaş toxumu', 0.2, 0.02, 'Rüşeym inkişaf edir', 'Ana, mən böyüyürəm! 💕', ARRAY['Yüngül yorğunluq'], 'Bol su için', 'Hidrat olun, gündə 8-10 stəkan su', ARRAY['Su', 'Yaşıl çay', 'Meyvə suları'], 'Emosional dalğalanmalar normaldır', 'Ev işlərində kömək edin', true),
(3, 'Xaşxaş toxumu', 0.3, 0.03, 'Sinir sistemi formalaşmağa başlayır', 'Sinirlərim inkişaf edir! 🧠', ARRAY['Döş hassaslığı', 'Yorğunluq'], 'Gecə tez yatın', 'Protein zəngin qidalar yeyin', ARRAY['Yumurta', 'Toyuq əti', 'Balıq'], 'Bədəninizi dinləyin', 'Səbrli olun', true),
(4, 'Alma toxumu', 0.4, 0.04, 'Ürək döyüntüsü başlayır', 'Ürəyim döyünür, ana! 💓', ARRAY['Ürəkbulanma', 'Qoxulara həssaslıq'], 'Zəncəfilli çay için', 'Kiçik porsiyalarla tez-tez yeyin', ARRAY['Zəncəfil', 'Limon', 'Quru çörək'], 'Ürəkbulanma müvəqqətidir', 'Qoxulu şeylər istifadə etməyin', true),
(5, 'Noxud', 0.5, 0.1, 'Əsas orqanlar formalaşır', 'Orqanlarım yaranır! 🌱', ARRAY['Tez-tez sidiyə getmə', 'Yorğunluq'], 'İstirahət vaxtı ayırın', 'Dəmir zəngin qidalar yeyin', ARRAY['Qırmızı ət', 'Mərci', 'Ispanaq'], 'Yorğunluq hiss etsəniz istirahət edin', 'Emosional dəstək verin', true),
(6, 'Lübye', 0.6, 0.2, 'Burun və ağız formalaşır', 'Burnumu hiss edirəm! 👃', ARRAY['Ürəkbulanma', 'Əhval dəyişikliyi'], 'B6 vitamini qəbul edin', 'Balanslaşdırılmış pəhriz saxlayın', ARRAY['Banan', 'Avokado', 'Fındıq'], 'Əhval dəyişiklikləri normaldır', 'Anlayışlı olun', true),
(7, 'Çiyələk', 1.0, 1, 'Qollar və ayaqlar inkişaf edir', 'Əllərim və ayaqlarım var! 🙌', ARRAY['Qəbizlik', 'Şişkinlik'], 'Lifli qidalar yeyin', 'Probiotik qidalar qəbul edin', ARRAY['Yoğurt', 'Kefir', 'Qatıq'], 'Özünüzə vaxt ayırın', 'Birlikdə gəzintiyə çıxın', true),
(8, 'Moruq', 1.6, 2, 'Barmaqlar formalaşır', 'Barmaqlarımı tərpədirəm! ✋', ARRAY['Yorğunluq', 'Tez-tez sidiyə getmə'], 'Rahat ayaqqabı geyin', 'Kalsium zəngin qidalar yeyin', ARRAY['Süd', 'Pendir', 'Yoğurt'], 'İlk USG üçün hazırlaşın', 'USG-yə birlikdə gedin', true),
(9, 'Zeytun', 2.3, 3, 'Bədən hərəkət etməyə başlayır', 'Hərəkət edirəm amma hələ hiss etmirsən! 🤸', ARRAY['Ürəkbulanma azalır', 'Enerji artır'], 'Yüngül məşqlərə başlayın', 'Omega-3 zəngin qidalar yeyin', ARRAY['Qoz', 'Badam', 'Çiya toxumu'], 'Enerji artımı hiss edə bilərsiniz', 'Birlikdə məşq edin', true),
(10, 'Gavalı', 3.1, 4, 'Bütün orqanlar formalaşıb', 'Bütün orqanlarım hazırdır! 🎉', ARRAY['Enerji artımı', 'Döş hassaslığı'], 'Prenatal vitamin qəbuluna davam edin', 'Müxtəlif rəngli tərəvəzlər yeyin', ARRAY['Havuc', 'Qırmızı bibər', 'Pomidor'], 'İkinci trimesterə yaxınlaşırsınız', 'Həyəcanı paylaşın', true),
(11, 'Əncir', 4.1, 7, 'Sümüklər bərkiməyə başlayır', 'Sümüklərim güclənir! 💪', ARRAY['Saç və dırnaq yaxşılaşır'], 'Kalsium qəbuluna diqqət edin', 'D vitamini alın', ARRAY['Balıq', 'Yumurta sarısı', 'Günəş işığı'], 'Özünüzü gözəl hiss edə bilərsiniz', 'İltifatlar edin', true),
(12, 'Limon', 5.4, 14, 'Reflekslər inkişaf edir', 'Reflekslərim var indi! 🎊', ARRAY['Ürəkbulanma azalır', 'Enerji artır'], 'İlk trimester bitir - təbrik!', 'Düzgün qidalanmaya davam edin', ARRAY['Meyvələr', 'Tərəvəzlər', 'Tam taxıllar'], 'Əhvalınız yaxşılaşa bilər', 'Xoş xəbəri paylaşmaq üçün plan qurun', true),
(13, 'Nektarin', 7.4, 23, 'Barmaq izləri formalaşır', 'Barmaq izlərim unikaldır! ☝️', ARRAY['Enerji artımı', 'İştaha artımı'], 'Sağlam qəlyanaltılar yeyin', 'Zülal qəbulunu artırın', ARRAY['Hindi əti', 'Balıq', 'Paxlalılar'], '2-ci trimester başlayır!', 'Birlikdə körpə adları düşünün', true),
(14, 'Alma', 8.7, 43, 'Üz ifadələri edir', 'Gülümsəyə bilirəm! 😊', ARRAY['Enerji yüksəkdir'], 'Hamiləlik məşqlərinə başlayın', 'Dəmir zəngin qidalar', ARRAY['Ispanaq', 'Mərci', 'Nar'], 'Ən rahat dövrdəsiniz', 'Birlikdə körpə otağı planlaşdırın', true),
(15, 'Portağal', 10.1, 70, 'Eşitmə inkişaf edir', 'Səsini eşidirəm, ana! 👂', ARRAY['Qarın görünməyə başlayır'], 'Körpə ilə danışın', 'Xoş yeməklər yeyin', ARRAY['Meyvələr', 'Şirniyyatdan uzaq durun'], 'Körpə ilə bağ qurun', 'Körpə ilə danışın, o eşidir', true),
(16, 'Avokado', 11.6, 100, 'Görmə inkişaf edir', 'Gözlərimi açıb-yumuram! 👀', ARRAY['Enerji yüksək', 'Dəri parıldayır'], 'Göz sağlamlığı üçün A vitamini', 'Havuc və göy tərəvəzlər', ARRAY['Havuc', 'Brokkoli', 'Kələm'], 'Özünüzü gözəl hissedirsiniz!', 'Gözəlliyini vurğulayın', true),
(17, 'Armud', 13, 140, 'Yağ qatı formalaşır', 'İstiləşirəm artıq! 🔥', ARRAY['Artan iştaha'], 'Sağlam yağlar yeyin', 'Omega yağları', ARRAY['Zeytun yağı', 'Qoz', 'Avokado'], 'Yemək istəkləri normaldır', 'İstəklərinə cavab verin', true),
(18, 'Şirin kartof', 14.2, 190, 'Hərəkətlər güclənir', 'Tezliklə məni hiss edəcəksən! 🦋', ARRAY['İlk hərəkətlər hiss oluna bilər'], 'Hərəkətlərə diqqət edin', 'Enerji verən qidalar', ARRAY['Tam taxıl çörəyi', 'Şirin kartof', 'Qatıq'], 'İlk təpiklər həyəcanvericidir!', 'Qarnına toxunun', true),
(19, 'Manqo', 15.3, 240, 'Duyğu orqanları inkişaf edir', 'Duyğularım güclənir! 🎭', ARRAY['Bel ağrısı başlaya bilər'], 'Hamiləlik yastığı istifadə edin', 'Maqnezium zəngin qidalar', ARRAY['Banan', 'Badəm', 'Qarağat'], 'Bədəninizi dinləyin', 'Masaj edin', true),
(20, 'Banan', 16.4, 300, 'Yarısındayıq!', 'Yarı yola gəldik, ana! 🎉', ARRAY['Qarın aydın görünür', 'Enerji yaxşıdır'], 'Anatomik USG vaxtıdır', 'Balanslaşdırılmış qidalanma', ARRAY['Bütün qida qrupları'], '20 həftə tamam - təbriklər!', 'Böyük USG-yə birlikdə gedin', true),
(21, 'Havuc', 26.7, 360, 'Dırnaqlar formalaşır', 'Dırnaqlarım böyüyür! 💅', ARRAY['Ayaq şişkinliyi'], 'Ayaqlarınızı yuxarı qaldırın', 'Su qəbuluna diqqət', ARRAY['Su', 'Qarpız', 'Xiyar'], 'Şişkinlik normaldır', 'Ayaq masajı edin', true),
(22, 'Papaya', 27.8, 430, 'Qaşlar və kirpiklər görünür', 'Qaşlarım və kirpiklərim var! 👁️', ARRAY['Həzm problemləri'], 'Kiçik porsiyalarla yeyin', 'Lifli qidalar', ARRAY['Meyvələr', 'Tərəvəzlər', 'Tam taxıllar'], 'Həzm problemləri müvəqqətidir', 'Yüngül yeməklər hazırlayın', true),
(23, 'Qreypfrut', 28.9, 500, 'Eşitmə güclənir', 'Musiqini sevir əm! 🎵', ARRAY['Yuxusuzluq'], 'Gecə rahat olmağa çalışın', 'Triptofan zəngin qidalar', ARRAY['Süd', 'Hindi əti', 'Banan'], 'Musiq dinlətməyə başlayın', 'Körpə üçün musiqi seçin', true),
(24, 'Qulançar', 30, 600, 'Ağciyərlər inkişaf edir', 'Nəfəs almağı öyrənirəm! 🌬️', ARRAY['Nəfəs darlığı'], 'Dik oturun', 'Dəmir zəngin qidalar', ARRAY['Qırmızı ət', 'Ispanaq', 'Mərci'], 'Nəfəs darlığı normaldır', 'Ev işlərini öz üzərinə götürün', true),
(25, 'Çuğundur', 34.6, 660, 'Saç tükləri görünür', 'Saçlarım çıxır! 💇', ARRAY['Hıçqırıq hiss edə bilərsiniz'], 'Hıçqırıqları izləyin', 'Biotin zəngin qidalar', ARRAY['Yumurta', 'Qoz-fındıq', 'Tam taxıllar'], 'Körpənin hıçqırıqları şirindir', 'Qarna toxunub hiss edin', true),
(26, 'Kələm', 35.6, 760, 'Gözlər açılır', 'Gözlərimi açıram! 👁️👁️', ARRAY['Bel ağrısı', 'Qarın gərilməsi'], 'Hamiləlik kəməri istifadə edin', 'Kalsium davam edin', ARRAY['Süd məhsulları'], '3-cü trimester yaxınlaşır', 'Gəzintilərə çıxın', true),
(27, 'Kərəviz', 36.6, 875, '3-cü trimester başlayır', 'Son trimesterdəyik! 🏁', ARRAY['Yorğunluq qayıdır'], 'Daha çox istirahət edin', 'Enerji verən qidalar', ARRAY['Kompleks karbohidratlar'], '3-cü trimester - son mərhələ!', 'Ev işlərində daha çox kömək edin', true),
(28, 'Badımcan', 37.6, 1000, '1 kiloqram oldum!', 'Artıq 1 kq-am! 🎈', ARRAY['Yuxusuzluq', 'Tez-tez sidiyə getmə'], 'Gecə az su için', 'Zülal qəbuluna diqqət', ARRAY['Balıq', 'Toyuq', 'Paxlalılar'], 'Yuxusuzluq normaldır', 'Gecə oyananda dəstək olun', true),
(29, 'Balqabaq', 38.6, 1150, 'Beyin sürətlə inkişaf edir', 'Beynim super güclüdür! 🧠', ARRAY['Ayaq şişkinliyi artır'], 'Duz qəbulunu azaldın', 'Omega-3 davam edin', ARRAY['Qoz', 'Balıq', 'Çiya'], 'Beyin inkişafı üçün yağlı balıq yeyin', 'Ayaq masajı edin', true),
(30, 'Lahana', 39.9, 1300, 'Sümüklər tamamilə formalaşır', 'Sümüklərim möhkəmdir! 🦴', ARRAY['Braxton Hicks büzülmələri'], 'Büzülmələri izləyin', 'Kalsium davam', ARRAY['Süd', 'Pendir', 'Yoğurt'], 'Yalançı büzülmələr normaldır', 'Büzülmələri birlikdə sayın', true),
(31, 'Hindistan qozu', 41.1, 1500, 'Bədən temperaturu tənzimlənir', 'İstilikimi tənzimləyirəm! 🌡️', ARRAY['Yuxu pozulması'], 'Hamiləlik yastığı istifadə edin', 'Yüngül şam yeməyi', ARRAY['Sup', 'Salat', 'Yüngül yeməklər'], 'Rahat yuxu mövqeləri tapın', 'Yuxu mühiti yaradın', true),
(32, 'Nanə qarpızı', 42.4, 1700, 'Dırnaqlar ayaq barmaqlarına çatır', 'Dırnaqlarım hazırdır! 💅', ARRAY['Nəfəs darlığı'], 'Dik oturmağa çalışın', 'Dəmir davam edin', ARRAY['Qırmızı ət', 'Ispanaq'], 'Doğuş təlimlərinə gedin', 'Doğuş dərslərinə birlikdə gedin', true),
(33, 'Ananas', 43.7, 1900, 'İmmun sistemi güclənir', 'İmmunitetim güclüdür! 🛡️', ARRAY['Yorğunluq', 'Şişkinlik'], 'Daha çox istirahət', 'C vitamini', ARRAY['Portağal', 'Limon', 'Kivi'], 'Xəstəhanə çantası hazırlayın', 'Xəstəhanə çantasında kömək edin', true),
(34, 'Yerkökü', 45, 2100, 'Sinir sistemi olgunlaşır', 'Sinirlərim hazırdır! ⚡', ARRAY['Pelvik təzyiq'], 'Doğum planı hazırlayın', 'Balanslaşdırılmış qidalanma', ARRAY['Bütün qida qrupları'], 'Doğum planınızı yazın', 'Doğum planını müzakirə edin', true),
(35, 'Şirin qovun', 46.2, 2400, 'Böyrəklər tam işləyir', 'Böyrəklərim işləyir! 💧', ARRAY['Tez-tez sidiyə getmə artır'], 'Tualetə yaxın olun', 'Su qəbuluna davam', ARRAY['Su', 'Bitki çayları'], 'Son həftələrə yaxınlaşırsınız', 'Səbrli və dəstəkləyici olun', true),
(36, 'Kərə yağı qabı boyda', 47.4, 2600, 'Baş aşağı dönür', 'Doğuma hazırlaşıram! 🙃', ARRAY['Pelvik təzyiq artır'], 'Doğum əlamətlərini öyrənin', 'Enerji verən qidalar', ARRAY['Xurmalar (doğuma yaxın)'], 'Körpə aşağı enə bilər', 'Xəstəhanəyə yolu bilin', true),
(37, 'Qış balqabağı', 48.6, 2900, 'Tam müddət hesab olunuram!', 'Artıq gəlməyə hazıram! 🎊', ARRAY['Braxton Hicks tez-tez'], 'Büzülmələri sayın', 'Yüngül qidalar', ARRAY['Sup', 'Meyvələr'], 'İstənilən vaxt gələ bilər!', 'Telefonu yaxın saxlayın', true),
(38, 'Qarpız', 49.8, 3100, 'Bütün orqanlar hazırdır', 'Tam hazıram, ana! ✅', ARRAY['Yuxusuzluq', 'Narahatlıq'], 'İstirahət edin', 'Yüngül yeməklər', ARRAY['Xiyar', 'Qarpız', 'Meyvələr'], 'Gözləmə dövrü', 'Səbirli və sakit olun', true),
(39, 'Balqabaq', 50.7, 3300, 'Yağ qatı tamamlanır', 'Dolğunam və şirinam! 🥰', ARRAY['Doğum əlamətləri axtarın'], 'Su gəlməsinə diqqət edin', 'Enerji saxlayın', ARRAY['Karbohidratlar', 'Protein'], 'Hər an başlaya bilər', 'Xəstəhanə çantası hazır olsun', true),
(40, 'Balaca qarpız', 51.2, 3500, 'Dünyaya gəlməyə hazıram!', 'Tezliklə qucağında olacam! 💕👶', ARRAY['Doğum başlaya bilər'], 'Sakit qalın, hazırsınız!', 'Enerji verən qidalar', ARRAY['Xurma', 'Bal', 'Mürəbbə'], 'Bu gözəl səyahəti bitirirsiniz!', 'Güclü olun, dəstək verin', true);

-- Create indexes for performance
CREATE INDEX idx_pregnancy_content_week ON public.pregnancy_daily_content(week_number);
CREATE INDEX idx_pregnancy_content_active ON public.pregnancy_daily_content(is_active);