-- Duzelis31: digər hamiləlik alətlərinin əkiz/çoxdöllü-fərqinə hörmət etməsi üçün
-- 3 yeni UI açarı (hər biri 7 dildə):
--  1) pdf_section_fetalgrowth — DoctorReportScreen PDF-inin yeni "Fetal Böyümə"
--     bölməsinin başlığı (hər körpənin son EFW-si, əkiz/çoxdöllüdə ayrı-ayrı sətir).
--     Mövcud fetalgrowth_baby_label_n/fetalgrowth_latest_efw açarları
--     (FetalGrowthTracker.tsx-dən) təkrar istifadə olunur, yeni açar tələb etmir.
--  2) nutrition_ekiz_ucun_elave_kalori — Nutrition alətində əkiz/çoxdöllü üçün
--     ACOG-a görə əlavə edilən +300kkal/hər əlavə körpə şəffaflıq qeydi.
--  3) hospitalbag_ekiz_banner — HospitalBag alətində əkiz/çoxdöllü üçün "N dəst
--     götür" şəffaflıq banneri (checklist sxeminə say sütunu əlavə etmədən).
-- Idempotent — safe to re-run.

INSERT INTO public.translations (key, lang, value, namespace) VALUES
  ('pdf_section_fetalgrowth', 'az', 'Fetal Böyümə', 'common'),
  ('pdf_section_fetalgrowth', 'en', 'Fetal Growth', 'common'),
  ('pdf_section_fetalgrowth', 'ru', 'Рост плода', 'common'),
  ('pdf_section_fetalgrowth', 'tr', 'Fetal Büyüme', 'common'),
  ('pdf_section_fetalgrowth', 'kk', 'Ұрықтың өсуі', 'common'),
  ('pdf_section_fetalgrowth', 'de', 'Fetales Wachstum', 'common'),
  ('pdf_section_fetalgrowth', 'ar', 'نمو الجنين', 'common'),
  ('nutrition_ekiz_ucun_elave_kalori', 'az', '+{n} kkal əkiz/çoxdöllü üçün daxildir', 'common'),
  ('nutrition_ekiz_ucun_elave_kalori', 'en', '+{n} kcal included for twins/multiples', 'common'),
  ('nutrition_ekiz_ucun_elave_kalori', 'ru', '+{n} ккал включено для двойни/многоплодной беременности', 'common'),
  ('nutrition_ekiz_ucun_elave_kalori', 'tr', '+{n} kkal ikiz/çoğul için dahildir', 'common'),
  ('nutrition_ekiz_ucun_elave_kalori', 'kk', '+{n} ккал егіз/көп жүктілік үшін қосылған', 'common'),
  ('nutrition_ekiz_ucun_elave_kalori', 'de', '+{n} kcal für Zwillinge/Mehrlinge enthalten', 'common'),
  ('nutrition_ekiz_ucun_elave_kalori', 'ar', '+{n} سعرة حرارية مدرجة للتوأم/الحمل المتعدد', 'common'),
  ('hospitalbag_ekiz_banner', 'az', 'Əkiz/çoxdöllü gözləyirsiniz — ''Körpə üçün'' bölməsindəki geyim, bez və s. əşyalarını {n} dəst götürməyi unutmayın.', 'common'),
  ('hospitalbag_ekiz_banner', 'en', 'You''re expecting twins/multiples — remember to pack {n} sets of the ''For Baby'' items (clothes, diapers, etc.).', 'common'),
  ('hospitalbag_ekiz_banner', 'ru', 'Вы ждёте двойню/тройню — не забудьте взять {n} комплекта вещей из раздела «Для малыша» (одежда, подгузники и т.д.).', 'common'),
  ('hospitalbag_ekiz_banner', 'tr', 'İkiz/çoğul bekliyorsunuz — ''Bebek için'' bölümündeki kıyafet, bez vb. eşyalardan {n} takım almayı unutmayın.', 'common'),
  ('hospitalbag_ekiz_banner', 'kk', 'Сіз егіз/көп нәресте күтіп жатырсыз — «Бөпе үшін» бөліміндегі киім, жаялық және т.б. заттардан {n} жинақ алуды ұмытпаңыз.', 'common'),
  ('hospitalbag_ekiz_banner', 'de', 'Sie erwarten Zwillinge/Mehrlinge — denken Sie daran, {n} Sätze der Artikel aus „Für das Baby" (Kleidung, Windeln usw.) einzupacken.', 'common'),
  ('hospitalbag_ekiz_banner', 'ar', 'أنتِ تنتظرين توأمًا/حملاً متعددًا — لا تنسي إحضار {n} مجموعات من العناصر في قسم ''للطفل'' (ملابس، حفاضات، إلخ).', 'common')
ON CONFLICT (key, lang) DO UPDATE SET value = EXCLUDED.value;
