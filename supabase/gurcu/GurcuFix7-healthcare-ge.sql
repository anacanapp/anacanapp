-- ============================================================
-- GurcuFix7 — healthcare_providers: Gürcüstan (GE) başlanğıc dəsti
-- PROBLEM: GE üçün heç bir provider yox idi → "Həkimlər və
-- xəstəxanalar" bölməsi tam boş görünürdü.
--
-- Bura YALNIZ hamıya məlum, real doğum evləri / qadın klinikaları və
-- çoxprofilli xəstəxanalar daxil edilib (Tbilisi + Batumi + Kutaisi).
-- Telefon/ünvan QƏSDƏN boş saxlanılıb — yoxlanmamış nömrə dərc etmirik.
-- QEYD: adlar və müəssisə statusu yayımdan əvvəl yerli mənbə ilə
-- yoxlanılmalıdır (yoxlanılmalıdır!).
-- Sütunlar OzbekFix7 ilə eynidir (name_uz → name_ka); şəhər adları
-- OzbekFix7-dəki kimi yerli qrafika ilə (Mxedruli) yazılıb.
-- İdempotent: name+country üzrə WHERE NOT EXISTS.
-- ============================================================

INSERT INTO public.healthcare_providers (name, name_en, name_ru, name_ka, provider_type, specialty, specialty_en, city, country_code, description, description_en, description_ka, is_active, is_featured)
SELECT
  'ჩაჩავას კლინიკა',
  'Chachava Clinic',
  'Клиника Чачава',
  'ჩაჩავას კლინიკა',
  'hospital', 'მეანობა და გინეკოლოგია', 'Obstetrics & Gynecology', 'თბილისი', 'GE',
  'მეანობის, გინეკოლოგიისა და რეპროდუქტოლოგიის ისტორიული კლინიკა',
  'Historic clinic of obstetrics, gynecology and reproductology',
  'მეანობის, გინეკოლოგიისა და რეპროდუქტოლოგიის ისტორიული კლინიკა',
  true, true
WHERE NOT EXISTS (SELECT 1 FROM public.healthcare_providers WHERE country_code = 'GE' AND name = 'ჩაჩავას კლინიკა');

INSERT INTO public.healthcare_providers (name, name_en, name_ru, name_ka, provider_type, specialty, specialty_en, city, country_code, description, description_en, description_ka, is_active, is_featured)
SELECT
  'გუდუშაურის სახელობის ეროვნული სამედიცინო ცენტრი',
  'Gudushauri National Medical Center',
  'Национальный медицинский центр им. Гудушаури',
  'გუდუშაურის სახელობის ეროვნული სამედიცინო ცენტრი',
  'hospital', 'მეანობა და გინეკოლოგია', 'Obstetrics & Gynecology', 'თბილისი', 'GE',
  'მრავალპროფილიანი ეროვნული ცენტრი სამშობიარო განყოფილებით',
  'Multi-profile national center with maternity department',
  'მრავალპროფილიანი ეროვნული ცენტრი სამშობიარო განყოფილებით',
  true, true
WHERE NOT EXISTS (SELECT 1 FROM public.healthcare_providers WHERE country_code = 'GE' AND name = 'გუდუშაურის სახელობის ეროვნული სამედიცინო ცენტრი');

INSERT INTO public.healthcare_providers (name, name_en, name_ru, name_ka, provider_type, specialty, specialty_en, city, country_code, description, description_en, description_ka, is_active, is_featured)
SELECT
  'თოდუას კლინიკა',
  'Todua Clinic',
  'Клиника Тодуа',
  'თოდუას კლინიკა',
  'clinic', 'ქალთა ჯანმრთელობა', 'Women''s Health', 'თბილისი', 'GE',
  'დიაგნოსტიკისა და ქალთა ჯანმრთელობის მრავალპროფილიანი კლინიკა',
  'Multi-profile clinic for diagnostics and women''s health',
  'დიაგნოსტიკისა და ქალთა ჯანმრთელობის მრავალპროფილიანი კლინიკა',
  true, false
WHERE NOT EXISTS (SELECT 1 FROM public.healthcare_providers WHERE country_code = 'GE' AND name = 'თოდუას კლინიკა');

INSERT INTO public.healthcare_providers (name, name_en, name_ru, name_ka, provider_type, specialty, specialty_en, city, country_code, description, description_en, description_ka, is_active, is_featured)
SELECT
  'ნიუ ჰოსპიტალსი',
  'New Hospitals',
  'Нью Хоспиталс',
  'ნიუ ჰოსპიტალსი',
  'hospital', 'მეანობა და გინეკოლოგია', 'Obstetrics & Gynecology', 'თბილისი', 'GE',
  'მრავალპროფილიანი ჰოსპიტალი სამშობიარო სახლით',
  'Multi-profile hospital with maternity house',
  'მრავალპროფილიანი ჰოსპიტალი სამშობიარო სახლით',
  true, false
WHERE NOT EXISTS (SELECT 1 FROM public.healthcare_providers WHERE country_code = 'GE' AND name = 'ნიუ ჰოსპიტალსი');

INSERT INTO public.healthcare_providers (name, name_en, name_ru, name_ka, provider_type, specialty, specialty_en, city, country_code, description, description_en, description_ka, is_active, is_featured)
SELECT
  'ავერსის კლინიკა',
  'Aversi Clinic',
  'Клиника Аверси',
  'ავერსის კლინიკა',
  'clinic', 'მეანობა და გინეკოლოგია', 'Obstetrics & Gynecology', 'თბილისი', 'GE',
  'მრავალპროფილიანი კლინიკა მეან-გინეკოლოგიური მიმართულებით',
  'Multi-profile clinic with obstetric-gynecological services',
  'მრავალპროფილიანი კლინიკა მეან-გინეკოლოგიური მიმართულებით',
  true, false
WHERE NOT EXISTS (SELECT 1 FROM public.healthcare_providers WHERE country_code = 'GE' AND name = 'ავერსის კლინიკა');

INSERT INTO public.healthcare_providers (name, name_en, name_ru, name_ka, provider_type, specialty, specialty_en, city, country_code, description, description_en, description_ka, is_active, is_featured)
SELECT
  'ინგოროყვას სახელობის მაღალი სამედიცინო ტექნოლოგიების საუნივერსიტეტო კლინიკა',
  'Ingorokva High Medical Technology University Clinic',
  'Университетская клиника высоких медицинских технологий им. Ингороква',
  'ინგოროყვას სახელობის მაღალი სამედიცინო ტექნოლოგიების საუნივერსიტეტო კლინიკა',
  'hospital', 'მეანობა და გინეკოლოგია', 'Obstetrics & Gynecology', 'თბილისი', 'GE',
  'საუნივერსიტეტო კლინიკა თანამედროვე სამედიცინო ტექნოლოგიებით',
  'University clinic with modern medical technologies',
  'საუნივერსიტეტო კლინიკა თანამედროვე სამედიცინო ტექნოლოგიებით',
  true, false
WHERE NOT EXISTS (SELECT 1 FROM public.healthcare_providers WHERE country_code = 'GE' AND name = 'ინგოროყვას სახელობის მაღალი სამედიცინო ტექნოლოგიების საუნივერსიტეტო კლინიკა');

INSERT INTO public.healthcare_providers (name, name_en, name_ru, name_ka, provider_type, specialty, specialty_en, city, country_code, description, description_en, description_ka, is_active, is_featured)
SELECT
  'კავკასიის სამედიცინო ცენტრი',
  'Caucasus Medical Centre',
  'Кавказский медицинский центр',
  'კავკასიის სამედიცინო ცენტრი',
  'hospital', 'მეანობა და გინეკოლოგია', 'Obstetrics & Gynecology', 'თბილისი', 'GE',
  'მრავალპროფილიანი სამედიცინო ცენტრი',
  'Multi-profile medical center',
  'მრავალპროფილიანი სამედიცინო ცენტრი',
  true, false
WHERE NOT EXISTS (SELECT 1 FROM public.healthcare_providers WHERE country_code = 'GE' AND name = 'კავკასიის სამედიცინო ცენტრი');

INSERT INTO public.healthcare_providers (name, name_en, name_ru, name_ka, provider_type, specialty, specialty_en, city, country_code, description, description_en, description_ka, is_active, is_featured)
SELECT
  'ამერიკული ჰოსპიტალი თბილისი',
  'American Hospital Tbilisi',
  'Американский госпиталь Тбилиси',
  'ამერიკული ჰოსპიტალი თბილისი',
  'hospital', 'მეანობა და გინეკოლოგია', 'Obstetrics & Gynecology', 'თბილისი', 'GE',
  'საერთაშორისო სტანდარტების ჰოსპიტალი მეან-გინეკოლოგიური სამსახურით',
  'International-standard hospital with OB-GYN service',
  'საერთაშორისო სტანდარტების ჰოსპიტალი მეან-გინეკოლოგიური სამსახურით',
  true, false
WHERE NOT EXISTS (SELECT 1 FROM public.healthcare_providers WHERE country_code = 'GE' AND name = 'ამერიკული ჰოსპიტალი თბილისი');

INSERT INTO public.healthcare_providers (name, name_en, name_ru, name_ka, provider_type, specialty, specialty_en, city, country_code, description, description_en, description_ka, is_active, is_featured)
SELECT
  'ქირურგიის ეროვნული ცენტრი',
  'National Center of Surgery',
  'Национальный центр хирургии',
  'ქირურგიის ეროვნული ცენტრი',
  'hospital', 'გინეკოლოგია', 'Gynecology', 'თბილისი', 'GE',
  'მრავალპროფილიანი ცენტრი გინეკოლოგიური განყოფილებით',
  'Multi-profile center with gynecology department',
  'მრავალპროფილიანი ცენტრი გინეკოლოგიური განყოფილებით',
  true, false
WHERE NOT EXISTS (SELECT 1 FROM public.healthcare_providers WHERE country_code = 'GE' AND name = 'ქირურგიის ეროვნული ცენტრი');

INSERT INTO public.healthcare_providers (name, name_en, name_ru, name_ka, provider_type, specialty, specialty_en, city, country_code, description, description_en, description_ka, is_active, is_featured)
SELECT
  'ჟორდანიას და ხომასურიძის რეპროდუქტოლოგიის ინსტიტუტი',
  'Zhordania and Khomasuridze Institute of Reproductology',
  'Институт репродуктологии им. Жордания и Хомасуридзе',
  'ჟორდანიას და ხომასურიძის რეპროდუქტოლოგიის ინსტიტუტი',
  'clinic', 'რეპროდუქტოლოგია', 'Reproductology', 'თბილისი', 'GE',
  'რეპროდუქციული ჯანმრთელობის ისტორიული ინსტიტუტი',
  'Historic institute of reproductive health',
  'რეპროდუქციული ჯანმრთელობის ისტორიული ინსტიტუტი',
  true, false
WHERE NOT EXISTS (SELECT 1 FROM public.healthcare_providers WHERE country_code = 'GE' AND name = 'ჟორდანიას და ხომასურიძის რეპროდუქტოლოგიის ინსტიტუტი');

INSERT INTO public.healthcare_providers (name, name_en, name_ru, name_ka, provider_type, specialty, specialty_en, city, country_code, description, description_en, description_ka, is_active, is_featured)
SELECT
  'ბათუმის რეფერალური ჰოსპიტალი',
  'Batumi Referral Hospital',
  'Батумский реферальный госпиталь',
  'ბათუმის რეფერალური ჰოსპიტალი',
  'hospital', 'მეანობა და გინეკოლოგია', 'Obstetrics & Gynecology', 'ბათუმი', 'GE',
  'აჭარის რეგიონის მთავარი მრავალპროფილიანი ჰოსპიტალი სამშობიარო განყოფილებით',
  'Main multi-profile hospital of Adjara region with maternity department',
  'აჭარის რეგიონის მთავარი მრავალპროფილიანი ჰოსპიტალი სამშობიარო განყოფილებით',
  true, false
WHERE NOT EXISTS (SELECT 1 FROM public.healthcare_providers WHERE country_code = 'GE' AND name = 'ბათუმის რეფერალური ჰოსპიტალი');

INSERT INTO public.healthcare_providers (name, name_en, name_ru, name_ka, provider_type, specialty, specialty_en, city, country_code, description, description_en, description_ka, is_active, is_featured)
SELECT
  'კლინიკა მედინა',
  'Medina Clinic',
  'Клиника Медина',
  'კლინიკა მედინა',
  'clinic', 'მეანობა და გინეკოლოგია', 'Obstetrics & Gynecology', 'ბათუმი', 'GE',
  'კერძო კლინიკა მეან-გინეკოლოგიური მიმართულებით',
  'Private clinic with obstetrics and gynecology services',
  'კერძო კლინიკა მეან-გინეკოლოგიური მიმართულებით',
  true, false
WHERE NOT EXISTS (SELECT 1 FROM public.healthcare_providers WHERE country_code = 'GE' AND name = 'კლინიკა მედინა');

INSERT INTO public.healthcare_providers (name, name_en, name_ru, name_ka, provider_type, specialty, specialty_en, city, country_code, description, description_en, description_ka, is_active, is_featured)
SELECT
  'ქუთაისის რეფერალური ჰოსპიტალი',
  'Kutaisi Referral Hospital',
  'Кутаисский реферальный госпиталь',
  'ქუთაისის რეფერალური ჰოსპიტალი',
  'hospital', 'მეანობა და გინეკოლოგია', 'Obstetrics & Gynecology', 'ქუთაისი', 'GE',
  'დასავლეთ საქართველოს რეფერალური ჰოსპიტალი სამშობიარო განყოფილებით',
  'Referral hospital of Western Georgia with maternity department',
  'დასავლეთ საქართველოს რეფერალური ჰოსპიტალი სამშობიარო განყოფილებით',
  true, false
WHERE NOT EXISTS (SELECT 1 FROM public.healthcare_providers WHERE country_code = 'GE' AND name = 'ქუთაისის რეფერალური ჰოსპიტალი');
