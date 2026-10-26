-- Duzelis46.sql — Doğuşdan Sonra Sağalma, Faza A
-- 1) "Mental Sağlamlıq" (EPDS/əhval) aləti tam qurulub, amma tool_configs-da HEÇ BİR sətri
--    yox idi → tətbiqin heç bir yerindən açıla bilmirdi. Eyni problem "Məşqlər" (exercise)
--    alətində də tapıldı (hamiləlik məşqləri hazır idi, amma tool_configs sətri yox idi).
-- 2) exercises cədvəlinə doğuşdan sonrakı məşqləri filtrləmək üçün yeni sütunlar əlavə olunur.
-- 3) Mövcud 4 məşq (Kegel/Gəzinti/Üzgüçülük/Nəfəs) doğuşdan sonra da uyğun elan edilir,
--    3 yeni doğuşdan-sonra-spesifik məşq əlavə olunur.

-- ─────────────────────────────────────────────────────────────
-- 1. tool_configs: 'mental-health' və 'exercise' sətirləri
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.tool_configs (
  tool_id, name, name_az, name_ru, name_tr,
  description, description_az, description_ru, description_tr, description_kk, description_de, description_ar,
  icon, color, bg_color, life_stages, sort_order,
  is_active, bump_active, mommy_active, flow_active,
  is_premium, premium_type, premium_limit
) VALUES
(
  'mental-health', 'Mental Health', 'Mental Sağlamlıq', 'Психическое здоровье', 'Ruh Sağlığı',
  'Mood tracking, EPDS screening and breathing exercises',
  'Əhval izləmə, EPDS skrininqi və nəfəs məşqləri',
  'Отслеживание настроения, скрининг EPDS и дыхательные упражнения',
  'Ruh hali takibi, EPDS taraması ve nefes egzersizleri',
  'Көңіл-күйді бақылау, EPDS скринингі және тыныс алу жаттығулары',
  'Stimmungsverfolgung, EPDS-Screening und Atemübungen',
  'تتبع المزاج وفحص EPDS وتمارين التنفس',
  'Brain', 'text-green-600', 'bg-green-50', '{bump,mommy}', 21,
  true, true, true, false,
  false, 'none', 0
),
(
  'exercise', 'Exercises', 'Məşqlər', 'Упражнения', 'Egzersizler',
  'Pregnancy and postpartum exercises',
  'Hamiləlik və doğuşdan sonrakı məşqlər',
  'Упражнения для беременных и после родов',
  'Hamilelik ve doğum sonrası egzersizler',
  'Жүктілік және босанғаннан кейінгі жаттығулар',
  'Übungen für Schwangerschaft und Wochenbett',
  'تمارين الحمل وما بعد الولادة',
  'Dumbbell', 'text-orange-600', 'bg-orange-50', '{bump,mommy}', 22,
  true, true, true, false,
  false, 'none', 0
)
ON CONFLICT (tool_id) DO UPDATE SET
  is_active = true,
  bump_active = true,
  mommy_active = true,
  life_stages = EXCLUDED.life_stages;

-- ─────────────────────────────────────────────────────────────
-- 2. exercises: doğuşdan-sonra sütunları
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS is_postpartum boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS postpartum_week_start integer,
  ADD COLUMN IF NOT EXISTS postpartum_week_end integer,
  ADD COLUMN IF NOT EXISTS postpartum_delivery_types text[];

COMMENT ON COLUMN public.exercises.is_postpartum IS 'Doğuşdan Sonra Sağalma bölməsində (mommy) göstərilsin?';
COMMENT ON COLUMN public.exercises.postpartum_week_start IS 'Doğuşdan neçənci həftədən etibarən uyğundur (NULL = məhdudiyyət yoxdur)';
COMMENT ON COLUMN public.exercises.postpartum_week_end IS 'Doğuşdan neçənci həftəyə qədər uyğundur (NULL = məhdudiyyət yoxdur, davamlı)';
COMMENT ON COLUMN public.exercises.postpartum_delivery_types IS 'Hansı doğuş növlərinə uyğundur: natural/cesarean/assisted (NULL/boş = hamısına uyğundur)';

-- ─────────────────────────────────────────────────────────────
-- 3. Mövcud məşqlərdən 4-ü doğuşdan sonra da uyğun elan edilir
--    (Kegel təsvirində artıq "doğuş sonrası bərpa" birbaşa qeyd olunub, amma
--    trimester-only filter səbəbindən mommy istifadəçilərinə heç görünmürdü)
-- ─────────────────────────────────────────────────────────────

-- Kegel Exercises — bütün doğuş növlərinə uyğun, ilk gündən
UPDATE public.exercises SET
  is_postpartum = true,
  postpartum_week_start = 0,
  description_en = 'Kegel exercises are the most effective way to strengthen the pelvic floor muscles. They are very helpful during pregnancy, for postpartum recovery, urinary incontinence issues, and sexual health.'
WHERE id = 'd64a9d01-c6f1-4f18-a93c-c781920c14f9';

-- Walking — ilk gündən (yüngül gəzinti)
UPDATE public.exercises SET
  is_postpartum = true,
  postpartum_week_start = 0,
  description_en = 'For cardiovascular health'
WHERE id = '22ebc0af-bddb-4234-a525-709bf9af630b';

-- Swimming — adətən 6-cı həftə yoxlamasından sonra tövsiyə olunur (qanaxma/kəsik sağalması)
UPDATE public.exercises SET
  is_postpartum = true,
  postpartum_week_start = 6,
  description_en = 'Full body workout'
WHERE id = 'dda0e0da-1048-498d-a3a1-4358713e2e96';

-- Breathing Exercises — məzmun həm hamiləliyə, həm doğuşdan sonraya uyğun olsun deyə
-- "Doğuşa hazırlıq" çərçivəsindən "Rahatlama və stress azaltma"ya keçirilir (hər iki mərhələdə keçərlidir)
UPDATE public.exercises SET
  is_postpartum = true,
  postpartum_week_start = 0,
  description = 'Rahatlama və stress azaltma',
  description_en = 'Relaxation and stress relief',
  description_ru = 'Расслабление и снятие стресса',
  description_tr = 'Rahatlama ve stres azaltma',
  description_kk = 'Демалу және стрессті азайту',
  description_de = 'Entspannung und Stressabbau',
  description_ar = 'الاسترخاء وتقليل التوتر'
WHERE id = 'e32f03c4-350a-455b-b70d-ff659812a45e';

-- ─────────────────────────────────────────────────────────────
-- 4. Yeni doğuşdan-sonra-spesifik məşqlər (idempotent: "name" ilə mövcudluq yoxlanılır,
--    cədvəldə unique constraint olmadığı üçün WHERE NOT EXISTS istifadə olunur)
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.exercises (
  name, name_az, name_ru, name_tr,
  duration_minutes, calories, level, trimester, icon,
  description, description_en, description_ru, description_tr, description_kk, description_de, description_ar,
  steps, is_active, sort_order,
  is_postpartum, postpartum_week_start, postpartum_week_end, postpartum_delivery_types
)
SELECT
  'Pelvic Tilt', 'Çanaq Əyilməsi', 'Наклон таза', 'Pelvis Eğimi',
  5, 10, 'easy', '{}', '🔄',
  'Bel ağrılarını azaldır və qarın əzələlərini yumşaq şəkildə bərpa edir',
  'Reduces lower back pain and gently helps re-engage the core muscles',
  'Уменьшает боль в пояснице и мягко восстанавливает мышцы кора',
  'Bel ağrısını azaltır ve karın kaslarını yumuşakça yeniden çalıştırır',
  'Бел ауруын азайтады және іш бұлшықеттерін жайлап қалпына келтіреді',
  'Reduziert Rückenschmerzen und aktiviert sanft die Bauchmuskulatur',
  'يقلل من آلام أسفل الظهر ويساعد بلطف على إعادة تنشيط عضلات البطن',
  '["Kürək üstə uzanın, dizlərinizi bükün, ayaqlarınız yerdə düz qalsın.", "Nəfəs verərkən qarın əzələlərinizi yığın və belinizi yerə tərəf yüngülcə basın (çanağınızı yuxarı əyin).", "3-5 saniyə saxlayın, sonra nəfəs alaraq yavaşca ilkin vəziyyətə qayıdın.", "8-12 dəfə təkrarlayın. Ağrı hiss etsəniz dayanın.", "Qeyd: Sezaryen keçirmisinizsə, kəsik nahiyəsi tam sağalana qədər çox yüngül edin və həkiminizlə məsləhətləşin."]'::jsonb,
  true, 7,
  true, 0, NULL, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Pelvic Tilt');

INSERT INTO public.exercises (
  name, name_az, name_ru, name_tr,
  duration_minutes, calories, level, trimester, icon,
  description, description_en, description_ru, description_tr, description_kk, description_de, description_ar,
  steps, is_active, sort_order,
  is_postpartum, postpartum_week_start, postpartum_week_end, postpartum_delivery_types
)
SELECT
  'Gentle Core Activation', 'Yumşaq Qarın Əzələsi Bərpası', 'Мягкая активация кора', 'Yumuşak Karın Aktivasyonu',
  5, 10, 'easy', '{}', '🌬️',
  'Doğuşdan sonra dərin qarın əzələlərini (transvers abdominis) təhlükəsiz şəkildə oyatmaq üçün',
  'Safely re-activates the deep core (transverse abdominis) muscles after birth',
  'Безопасно восстанавливает глубокие мышцы кора (поперечную мышцу живота) после родов',
  'Doğumdan sonra derin karın kaslarını (transvers abdominis) güvenle yeniden aktive eder',
  'Босанғаннан кейін тереңдегі іш бұлшықеттерін (көлденең қарын бұлшықетін) қауіпсіз жандандырады',
  'Reaktiviert nach der Geburt sicher die tiefe Bauchmuskulatur (Transversus abdominis)',
  'يعيد تنشيط عضلات البطن العميقة (المستعرضة) بأمان بعد الولادة',
  '["Kürək üstə və ya oturaraq rahat mövqeyə keçin, çiyinləriniz rahat olsun.", "Əllərinizi göbəyinizin altına qoyun.", "Dərin nəfəs alın, qarnınız şişsin.", "Nəfəs verərkən, sanki gödəkçənizin zipini yuxarı çəkirmiş kimi, aşağı qarın əzələlərini yavaşca içəri-yuxarı çəkin (güclü sıxma yox, yüngül gərginlik olmalıdır).", "5-10 saniyə saxlayın, sonra buraxın. 10 dəfə təkrarlayın.", "DİQQƏT: Qarnınızda ortadan yuxarı doğru qabarma/kümbəz hiss etsəniz, dayanın və həkiminizə və ya pelvik dib fizioterapevtinə bildirin — bu, diastasis recti (qarın əzələlərinin ayrılması) əlaməti ola bilər."]'::jsonb,
  true, 8,
  true, 1, NULL, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Gentle Core Activation');

INSERT INTO public.exercises (
  name, name_az, name_ru, name_tr,
  duration_minutes, calories, level, trimester, icon,
  description, description_en, description_ru, description_tr, description_kk, description_de, description_ar,
  steps, is_active, sort_order,
  is_postpartum, postpartum_week_start, postpartum_week_end, postpartum_delivery_types
)
SELECT
  'Neck & Shoulder Stretch', 'Boyun və Çiyin Gərginliyi Azaltma', 'Растяжка шеи и плеч', 'Boyun ve Omuz Germe',
  5, 10, 'easy', '{}', '💆‍♀️',
  'Körpəni qucaqlamaq və əmizdirməkdən yaranan boyun-çiyin gərginliyini azaldır',
  'Relieves neck and shoulder tension from holding and nursing your baby',
  'Снимает напряжение в шее и плечах от ношения и кормления малыша',
  'Bebeği tutmak ve emzirmekten kaynaklanan boyun-omuz gerginliğini azaltır',
  'Баланы көтеру мен емізуден туындаған мойын-иық кернеуін азайтады',
  'Lindert Nacken- und Schulterverspannungen vom Tragen und Stillen des Babys',
  'يخفف من توتر الرقبة والكتفين الناتج عن حمل ورضاعة طفلك',
  '["Rahat oturun, çiyinləriniz aşağı və rahat olsun.", "Başınızı yavaşca sağ çiyininizə tərəf əyin, sol boyun əzələsində yüngül dartılma hiss edənə qədər. 15-20 saniyə saxlayın.", "Eyni hərəkəti sol tərəfə təkrarlayın.", "Çiyinlərinizi qulaqlarınıza tərəf qaldırın, 5 saniyə saxlayın, sonra buraxın. 5 dəfə təkrarlayın.", "Əllərinizi arxada birləşdirib sinənizi yüngülcə irəli açın (əmizdirmə duruşunun əksi)."]'::jsonb,
  true, 9,
  true, 0, NULL, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Neck & Shoulder Stretch');

-- ─────────────────────────────────────────────────────────────
-- 5. symptoms: doğuşdan-sonra-spesifik simptomlar (Əhval Günd. simptom seçicisi,
--    mommy mərhələsində artıq göstərilir — yalnız {mommy} əlavə edilir, mövcud
--    16 simptom (bax scripts/content-i18n/chunks/symptoms.json) toxunulmur)
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.symptoms (symptom_key, label, label_az, label_ru, label_tr, label_kk, label_de, label_ar, icon, life_stages, is_active, sort_order)
VALUES
  ('incision_pain', 'Incision pain', 'Kəsik ağrısı', 'Боль в области шва', 'Dikiş ağrısı', 'Тігіс ауруы', 'Schmerzen an der Narbe', 'ألم في مكان الجرح', '🩹', '{mommy}', true, 17),
  ('night_sweats', 'Night sweats', 'Gecə tərləməsi', 'Ночная потливость', 'Gece terlemesi', 'Түнгі терлеу', 'Nachtschweiß', 'التعرق الليلي', '💦', '{mommy}', true, 18),
  ('engorgement', 'Breast engorgement', 'Döşlərin dolması', 'Нагрубание груди', 'Göğüslerde dolgunluk', 'Емшектің ісінуі', 'Milchstau', 'احتقان الثدي', '🤱', '{mommy}', true, 19),
  ('hemorrhoids', 'Hemorrhoids', 'Basur', 'Геморрой', 'Basur', 'Геморрой', 'Hämorrhoiden', 'البواسير', '😣', '{mommy}', true, 20),
  ('perineal_pain', 'Perineal soreness', 'Qasıq nahiyəsində ağrı', 'Боль в промежности', 'Perine ağrısı', 'Шат аймағының ауруы', 'Dammschmerzen', 'ألم العجان', '😖', '{mommy}', true, 21),
  ('postpartum_constipation', 'Constipation', 'Qəbizlik', 'Запор', 'Kabızlık', 'Іш қатуы', 'Verstopfung', 'الإمساك', '😓', '{mommy}', true, 22)
ON CONFLICT (symptom_key) DO NOTHING;
