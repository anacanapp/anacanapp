-- ============================================================
-- GurcuFix4 — Təcili yardım nömrələri: Gürcüstan (GE)
-- PROBLEM: mental_health_resources-da GE üçün sətir yox idi —
-- KA istifadəçilərə Azərbaycan nömrələri göstərilirdi.
-- Bu, təcili vəziyyətdə YANLIŞ NÖMRƏ deməkdir.
--
-- HƏLL: Gürcüstan üçün YALNIZ geniş sənədləşdirilmiş milli xətlər:
--   • 112     — Vahid fövqəladə nömrə: təcili tibbi yardım, polis,
--               xilasetmə — hamısı 112 üzərindən (112.gov.ge)
--   • 116 006 — Zorakılıq qurbanları üçün dövlət qaynar xətti
--               (pulsuz, 24/7) — tel dəyəri rəqəmlə: 116006
--   • 116 111 — Uşaq yardım xətti (Səhiyyə Nazirliyinin dəstəyi ilə)
--               — tel dəyəri rəqəmlə: 116111
--   • 1505    — Səhiyyə Nazirliyinin qaynar xətti
-- QEYD: nömrələr yayımdan əvvəl yerli mənbə ilə yoxlanılmalıdır.
-- Sütunlar OzbekFix4 ilə eynidir (name_uz → name_ka).
-- country_code sütunu OzbekFix4/Son24-də əlavə olunub — aşağıdakı
-- ALTER/INDEX yalnız qoruyucu təkrardır.
-- Client (useMentalHealthResources) ölkəyə görə filtrləyir.
-- Təkrar icra təhlükəsizdir (IF NOT EXISTS / WHERE NOT EXISTS).
-- ============================================================

ALTER TABLE public.mental_health_resources
  ADD COLUMN IF NOT EXISTS country_code text NOT NULL DEFAULT 'AZ';

CREATE INDEX IF NOT EXISTS idx_mental_health_resources_country
  ON public.mental_health_resources (country_code);

-- ── GE sətirləri ──────────────────────────────────────────────
INSERT INTO public.mental_health_resources
  (name, name_az, name_en, name_ru, name_ka,
   description, description_az, description_en, description_ru, description_ka,
   resource_type, phone, is_emergency, sort_order, is_active, country_code)
SELECT
  'გადაუდებელი დახმარების ერთიანი ნომერი 112', 'Vahid fövqəladə xidmət — 112', 'Unified emergency number 112', 'Единый номер экстренной помощи 112', 'გადაუდებელი დახმარების ერთიანი ნომერი 112',
  'სასწრაფო სამედიცინო დახმარება, პოლიცია და მაშველები — ერთიანი გადაუდებელი ნომერი, 24/7', 'Təcili tibbi yardım, polis və xilasetmə — vahid fövqəladə nömrə, 24/7', 'Ambulance, police and rescue — single emergency number, 24/7', 'Скорая помощь, полиция и спасатели — единый номер экстренной помощи, круглосуточно', 'სასწრაფო სამედიცინო დახმარება, პოლიცია და მაშველები — ერთიანი გადაუდებელი ნომერი, 24/7',
  'hotline', '112', true, 1, true, 'GE'
WHERE NOT EXISTS (SELECT 1 FROM public.mental_health_resources WHERE phone = '112' AND country_code = 'GE');

INSERT INTO public.mental_health_resources
  (name, name_az, name_en, name_ru, name_ka,
   description, description_az, description_en, description_ru, description_ka,
   resource_type, phone, is_emergency, sort_order, is_active, country_code)
SELECT
  'ძალადობის მსხვერპლთა დახმარების ცხელი ხაზი', 'Zorakılıq qurbanları üçün qaynar xətt', 'Violence victims support hotline', 'Горячая линия для пострадавших от насилия', 'ძალადობის მსხვერპლთა დახმარების ცხელი ხაზი',
  'ოჯახში ძალადობის მსხვერპლთა ფსიქოლოგიური და სამართლებრივი კონსულტაცია — უფასო, 24/7', 'Məişət zorakılığından zərər görənlər üçün psixoloji və hüquqi konsultasiya — pulsuz, 24/7', 'Psychological and legal consultation for victims of domestic violence — free, 24/7', 'Психологическая и юридическая помощь пострадавшим от домашнего насилия — бесплатно, круглосуточно', 'ოჯახში ძალადობის მსხვერპლთა ფსიქოლოგიური და სამართლებრივი კონსულტაცია — უფასო, 24/7',
  'hotline', '116006', true, 2, true, 'GE'
WHERE NOT EXISTS (SELECT 1 FROM public.mental_health_resources WHERE phone = '116006' AND country_code = 'GE');

INSERT INTO public.mental_health_resources
  (name, name_az, name_en, name_ru, name_ka,
   description, description_az, description_en, description_ru, description_ka,
   resource_type, phone, is_emergency, sort_order, is_active, country_code)
SELECT
  'ბავშვთა დახმარების ხაზი', 'Uşaq yardım xətti', 'Child helpline', 'Детская линия помощи', 'ბავშვთა დახმარების ხაზი',
  'ბავშვებისა და მშობლების ფსიქოლოგიური მხარდაჭერა და კონსულტაცია', 'Uşaqlar və valideynlər üçün psixoloji dəstək və konsultasiya', 'Psychological support and counselling for children and parents', 'Психологическая поддержка и консультации для детей и родителей', 'ბავშვებისა და მშობლების ფსიქოლოგიური მხარდაჭერა და კონსულტაცია',
  'hotline', '116111', false, 3, true, 'GE'
WHERE NOT EXISTS (SELECT 1 FROM public.mental_health_resources WHERE phone = '116111' AND country_code = 'GE');

INSERT INTO public.mental_health_resources
  (name, name_az, name_en, name_ru, name_ka,
   description, description_az, description_en, description_ru, description_ka,
   resource_type, phone, is_emergency, sort_order, is_active, country_code)
SELECT
  'ჯანდაცვის სამინისტროს ცხელი ხაზი', 'Səhiyyə Nazirliyi qaynar xətti', 'Health Ministry hotline', 'Горячая линия Минздрава', 'ჯანდაცვის სამინისტროს ცხელი ხაზი',
  'სამედიცინო მომსახურებასთან დაკავშირებული ინფორმაცია და მიმართვები — 24/7', 'Tibbi xidmətlərlə bağlı məlumat və müraciətlər — 24/7', 'Information and appeals on medical services — 24/7', 'Информация и обращения по медицинским услугам — круглосуточно', 'სამედიცინო მომსახურებასთან დაკავშირებული ინფორმაცია და მიმართვები — 24/7',
  'hotline', '1505', false, 4, true, 'GE'
WHERE NOT EXISTS (SELECT 1 FROM public.mental_health_resources WHERE phone = '1505' AND country_code = 'GE');
