-- Create table for menstruation phase tips
CREATE TABLE public.menstruation_phase_tips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase TEXT NOT NULL CHECK (phase IN ('menstrual', 'follicular', 'ovulation', 'luteal')),
  title TEXT NOT NULL,
  title_az TEXT,
  content TEXT NOT NULL,
  content_az TEXT,
  emoji TEXT DEFAULT '💡',
  category TEXT DEFAULT 'general' CHECK (category IN ('general', 'nutrition', 'exercise', 'selfcare', 'mood', 'intimacy')),
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.menstruation_phase_tips ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Anyone can read active phase tips"
ON public.menstruation_phase_tips
FOR SELECT
USING (is_active = true);

-- Allow admins to manage
CREATE POLICY "Admins can manage phase tips"
ON public.menstruation_phase_tips
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Insert comprehensive dummy data for all phases

-- MENSTRUAL PHASE (Day 1-5)
INSERT INTO public.menstruation_phase_tips (phase, title, title_az, content, content_az, emoji, category, sort_order) VALUES
('menstrual', 'Rest is Essential', 'İstirahət Vacibdir', 'Your body is working hard. Listen to it and allow yourself extra rest during the first few days.', 'Bədəniniz intensiv işləyir. İlk günlərdə özünüzə əlavə istirahət imkanı verin və bədəninizi dinləyin.', '😴', 'selfcare', 1),
('menstrual', 'Iron-Rich Foods', 'Dəmirlə Zəngin Qidalar', 'Combat fatigue by eating iron-rich foods like spinach, lentils, red meat, and dark chocolate.', 'Yorğunluqla mübarizə üçün ispanaq, mərcimək, qırmızı ət və tünd şokolad kimi dəmirlə zəngin qidalar yeyin.', '🥬', 'nutrition', 2),
('menstrual', 'Stay Hydrated', 'Su Balansını Qoruyun', 'Drinking plenty of water helps reduce bloating and cramps. Aim for 8-10 glasses daily.', 'Bol su içmək şişkinliyi və sancıları azaldır. Gündə 8-10 stəkan su içməyə çalışın.', '💧', 'nutrition', 3),
('menstrual', 'Gentle Movement', 'Yüngül Hərəkət', 'Light yoga, walking, or stretching can actually help relieve cramps and improve mood.', 'Yüngül yoga, gəzinti və ya gərilmə əslində sancıları yüngülləşdirir və əhvalı yaxşılaşdırır.', '🧘', 'exercise', 4),
('menstrual', 'Warm Compress', 'İsti Kompres', 'Apply a heating pad or warm water bottle to your lower abdomen to ease menstrual cramps.', 'Menstrual sancıları yüngülləşdirmək üçün qarnınızın alt hissəsinə istilik yastığı və ya isti su şüşəsi qoyun.', '🔥', 'selfcare', 5),
('menstrual', 'Avoid Caffeine', 'Kofeindən Qaçın', 'Caffeine can worsen cramps and anxiety. Try herbal teas like chamomile or ginger instead.', 'Kofein sancıları və narahatlığı artıra bilər. Əvəzinə çobanyastığı və ya zəncəfil çayı için.', '🍵', 'nutrition', 6),
('menstrual', 'Mood Support', 'Əhval Dəstəyi', 'Feeling emotional is normal. Practice self-compassion and don''t be hard on yourself during this time.', 'Emosional hiss etmək normaldır. Bu dövrdə özünüzə qarşı sərt olmayın və özünüzə şəfqət göstərin.', '💝', 'mood', 7),
('menstrual', 'Magnesium Boost', 'Maqnezium Artırın', 'Magnesium helps with cramps. Eat bananas, almonds, avocados, or take a supplement.', 'Maqnezium sancılara kömək edir. Banan, badam, avokado yeyin və ya əlavə qəbul edin.', '🍌', 'nutrition', 8);

-- FOLLICULAR PHASE (Day 6-13)
INSERT INTO public.menstruation_phase_tips (phase, title, title_az, content, content_az, emoji, category, sort_order) VALUES
('follicular', 'Energy Rising', 'Enerji Yüksəlir', 'Estrogen is rising! This is a great time to start new projects and tackle challenging tasks.', 'Estrogen yüksəlir! Bu yeni layihələrə başlamaq və çətin tapşırıqları həll etmək üçün əla vaxtdır.', '⚡', 'general', 1),
('follicular', 'Try New Workouts', 'Yeni Məşqlər Sınayın', 'Your body can handle more intense exercise now. Try HIIT, running, or weight training.', 'Bədəniniz indi daha intensiv məşqlərə dözə bilər. HIIT, qaçış və ya ağırlıq məşqi sınayın.', '🏋️', 'exercise', 2),
('follicular', 'Protein Power', 'Protein Gücü', 'Support muscle building with lean proteins like chicken, fish, eggs, and legumes.', 'Əzələ quruculuğunu toyuq, balıq, yumurta və paxlalılar kimi yağsız proteinlərlə dəstəkləyin.', '🍗', 'nutrition', 3),
('follicular', 'Social Energy', 'Sosial Enerji', 'You may feel more outgoing and communicative. Great time for social activities and networking.', 'Daha ünsiyyətcil və açıq hiss edə bilərsiniz. Sosial fəaliyyətlər və şəbəkələşmə üçün əla vaxt.', '🎉', 'mood', 4),
('follicular', 'Creativity Peak', 'Yaradıcılıq Zirvəsi', 'Brain function is enhanced. Use this time for brainstorming, learning, and creative work.', 'Beyin funksiyası yüksəlib. Bu vaxtı beyin fırtınası, öyrənmə və yaradıcı işlər üçün istifadə edin.', '🎨', 'general', 5),
('follicular', 'Fresh Foods', 'Təzə Qidalar', 'Light, fresh foods like salads, fermented vegetables, and citrus fruits support this phase.', 'Salatlar, fermentləşdirilmiş tərəvəzlər və sitrus meyvələri kimi yüngül, təzə qidalar bu fazanı dəstəkləyir.', '🥗', 'nutrition', 6),
('follicular', 'Skin Care', 'Dəri Baxımı', 'Estrogen makes skin glow! Good time to try new skincare products or get facial treatments.', 'Estrogen dərini parıldadır! Yeni dəri baxımı məhsullarını sınamaq və ya üz prosedurları üçün yaxşı vaxt.', '✨', 'selfcare', 7),
('follicular', 'Hydration Focus', 'Nəmləndirmə Fokus', 'Continue drinking water and add electrolytes if you''re exercising intensely.', 'Su içməyə davam edin, intensiv məşq edirsinizsə elektrolitlər əlavə edin.', '💦', 'nutrition', 8);

-- OVULATION PHASE (Day 14-16)
INSERT INTO public.menstruation_phase_tips (phase, title, title_az, content, content_az, emoji, category, sort_order) VALUES
('ovulation', 'Peak Fertility', 'Ən Yüksək Fertillik', 'This is your most fertile time. If trying to conceive, this is the optimal window.', 'Bu ən məhsuldar dövrünüzdür. Hamilə olmağa çalışırsınızsa, bu optimal pəncərədir.', '🌸', 'intimacy', 1),
('ovulation', 'Maximum Energy', 'Maksimum Enerji', 'Energy and confidence are at their peak. Take on challenging tasks and important meetings.', 'Enerji və özünə inam zirvədədir. Çətin tapşırıqlar və vacib görüşlər üzərinə götürün.', '🚀', 'general', 2),
('ovulation', 'High-Intensity OK', 'Yüksək İntensivlik OK', 'Your body can handle the most demanding workouts. Great time for competitions or personal records.', 'Bədəniniz ən ağır məşqləri qaldıra bilər. Yarışlar və ya şəxsi rekordlar üçün əla vaxt.', '🏆', 'exercise', 3),
('ovulation', 'Communication Skills', 'Ünsiyyət Bacarıqları', 'Verbal skills are enhanced. Perfect for presentations, negotiations, and difficult conversations.', 'Şifahi bacarıqlar artıb. Prezentasiyalar, danışıqlar və çətin söhbətlər üçün mükəmməl.', '🗣️', 'general', 4),
('ovulation', 'Antioxidant Foods', 'Antioksidant Qidalar', 'Support egg health with antioxidant-rich foods: berries, leafy greens, and colorful vegetables.', 'Yumurtalıq sağlamlığını antioksidantlarla zəngin qidalarla dəstəkləyin: giləmeyvələr, yaşıl yarpaqlılar.', '🫐', 'nutrition', 5),
('ovulation', 'Libido Increase', 'Libido Artımı', 'Natural increase in desire is normal. Honor your body''s signals and communicate with your partner.', 'İstəkdə təbii artım normaldır. Bədəninizin siqnallarını qəbul edin və partnyorunuzla ünsiyyət qurun.', '💕', 'intimacy', 6),
('ovulation', 'Light Cramping Normal', 'Yüngül Sancı Normaldır', 'Mild ovulation pain (mittelschmerz) is normal. If severe, consult your doctor.', 'Yüngül ovulyasiya ağrısı normaldır. Şiddətli olarsa, həkiminizlə məsləhətləşin.', '🩺', 'selfcare', 7),
('ovulation', 'Omega-3 Fatty Acids', 'Omega-3 Yağ Turşuları', 'Support hormone production with salmon, walnuts, chia seeds, and flaxseed.', 'Hormon istehsalını qızılbalıq, qoz, chia toxumu və kətan toxumu ilə dəstəkləyin.', '🐟', 'nutrition', 8);

-- LUTEAL PHASE (Day 17-28)
INSERT INTO public.menstruation_phase_tips (phase, title, title_az, content, content_az, emoji, category, sort_order) VALUES
('luteal', 'PMS Awareness', 'PMS Farkındalığı', 'Progesterone rises, which may cause mood changes. Be aware and practice extra self-care.', 'Progesteron yüksəlir, bu əhval dəyişikliklərinə səbəb ola bilər. Fərqində olun və əlavə özünə qulluq edin.', '🌙', 'mood', 1),
('luteal', 'Complex Carbs', 'Mürəkkəb Karbohidratlar', 'Cravings are normal! Choose complex carbs like whole grains, sweet potatoes, and oats.', 'İştah artımı normaldır! Tam taxıl, şirin kartof və yulaf kimi mürəkkəb karbohidratlar seçin.', '🍠', 'nutrition', 2),
('luteal', 'Moderate Exercise', 'Orta Səviyyəli Məşq', 'Switch to moderate activities like swimming, cycling, or pilates as energy decreases.', 'Enerji azaldıqca üzmə, velosiped və ya pilates kimi orta səviyyəli fəaliyyətlərə keçin.', '🚴', 'exercise', 3),
('luteal', 'Reduce Salt', 'Duzu Azaldın', 'Limit sodium intake to reduce bloating and water retention common in this phase.', 'Şişkinlik və su tutulmasını azaltmaq üçün natrium qəbulunu məhdudlaşdırın.', '🧂', 'nutrition', 4),
('luteal', 'B6 Vitamin', 'B6 Vitamini', 'Vitamin B6 helps with PMS symptoms. Find it in bananas, chickpeas, potatoes, and poultry.', 'B6 vitamini PMS əlamətlərinə kömək edir. Banan, noxud, kartof və quş ətində tapın.', '💊', 'nutrition', 5),
('luteal', 'Sleep Priority', 'Yuxu Prioriteti', 'You may need more sleep. Honor this need and aim for 8-9 hours per night.', 'Daha çox yuxuya ehtiyacınız ola bilər. Bu ehtiyaca hörmət edin və gecədə 8-9 saat hədəfləyin.', '🛏️', 'selfcare', 6),
('luteal', 'Journaling Help', 'Gündəlik Köməyi', 'Writing down thoughts and feelings can help process emotions during this sensitive time.', 'Düşüncə və hissləri yazmaq bu həssas dövrdə emosiyaları emal etməyə kömək edə bilər.', '📝', 'mood', 7),
('luteal', 'Calcium Intake', 'Kalsium Qəbulu', 'Studies show calcium can reduce PMS symptoms. Eat dairy, leafy greens, or supplements.', 'Araşdırmalar kalsiumun PMS əlamətlərini azaltdığını göstərir. Süd məhsulları, yaşıl yarpaqlar yeyin.', '🥛', 'nutrition', 8),
('luteal', 'Limit Alcohol', 'Alkoqolu Məhdudlaşdırın', 'Alcohol can worsen PMS symptoms and disrupt sleep. Consider reducing or avoiding it.', 'Alkoqol PMS əlamətlərini pisləşdirə və yuxunu poza bilər. Azaltmağı və ya qaçınmağı düşünün.', '🚫', 'selfcare', 9),
('luteal', 'Dark Chocolate', 'Tünd Şokolad', 'A small amount of dark chocolate can boost mood and provide magnesium. Enjoy in moderation!', 'Az miqdarda tünd şokolad əhvalı yaxşılaşdıra və maqnezium verə bilər. Mülayimliklə dadın!', '🍫', 'nutrition', 10);

-- Create index for faster queries
CREATE INDEX idx_phase_tips_phase ON public.menstruation_phase_tips(phase);
CREATE INDEX idx_phase_tips_category ON public.menstruation_phase_tips(category);
CREATE INDEX idx_phase_tips_active ON public.menstruation_phase_tips(is_active);