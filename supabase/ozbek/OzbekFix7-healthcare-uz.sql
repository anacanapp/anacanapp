-- ============================================================
-- OzbekFix7 — healthcare_providers: Özbəkistan (UZ) başlanğıc dəsti
-- PROBLEM: UZ üçün heç bir provider yox idi → "Shifokorlar va
-- shifoxonalar" bölməsi tam boş görünürdü.
--
-- Bura YALNIZ rəsmi, hamıya məlum DÖVLƏT müəssisələri daxil edilib
-- (respublika ixtisaslaşmış mərkəzlər + viloyat perinatal mərkəzləri).
-- Telefon/ünvan QƏSDƏN boş saxlanılıb — yoxlanmamış nömrə dərc etmirik.
-- Komanda scripts/content-i18n/generate-healthcare-providers.cjs UZ
-- "Uzbekistan" ilə siyahını genişləndirib telefon/ünvanları təsdiqləyə bilər.
-- İdempotent: name+country üzrə WHERE NOT EXISTS.
-- ============================================================

INSERT INTO public.healthcare_providers (name, name_en, name_ru, name_uz, provider_type, specialty, specialty_en, city, country_code, description, description_en, description_uz, is_active, is_featured)
SELECT
  'Respublika ixtisoslashtirilgan akusherlik va ginekologiya ilmiy-amaliy tibbiyot markazi',
  'Republican Specialized Scientific-Practical Medical Center of Obstetrics and Gynecology',
  'Республиканский специализированный научно-практический медицинский центр акушерства и гинекологии',
  'Respublika ixtisoslashtirilgan akusherlik va ginekologiya ilmiy-amaliy tibbiyot markazi',
  'hospital', 'Akusherlik va ginekologiya', 'Obstetrics & Gynecology', 'Toshkent', 'UZ',
  'Akusherlik va ginekologiya bo''yicha respublika bosh ilmiy-amaliy markazi',
  'National leading scientific-practical center for obstetrics and gynecology',
  'Akusherlik va ginekologiya bo''yicha respublika bosh ilmiy-amaliy markazi',
  true, true
WHERE NOT EXISTS (SELECT 1 FROM public.healthcare_providers WHERE country_code = 'UZ' AND name = 'Respublika ixtisoslashtirilgan akusherlik va ginekologiya ilmiy-amaliy tibbiyot markazi');

INSERT INTO public.healthcare_providers (name, name_en, name_ru, name_uz, provider_type, specialty, specialty_en, city, country_code, description, description_en, description_uz, is_active, is_featured)
SELECT
  'Respublika perinatal markazi',
  'Republican Perinatal Center',
  'Республиканский перинатальный центр',
  'Respublika perinatal markazi',
  'hospital', 'Perinatologiya', 'Perinatology', 'Toshkent', 'UZ',
  'Yuqori xavfli homiladorlik va tug''ruqlarga ixtisoslashgan respublika markazi',
  'National center specialized in high-risk pregnancies and deliveries',
  'Yuqori xavfli homiladorlik va tug''ruqlarga ixtisoslashgan respublika markazi',
  true, true
WHERE NOT EXISTS (SELECT 1 FROM public.healthcare_providers WHERE country_code = 'UZ' AND name = 'Respublika perinatal markazi');

INSERT INTO public.healthcare_providers (name, name_en, name_ru, name_uz, provider_type, specialty, specialty_en, city, country_code, description, description_en, description_uz, is_active, is_featured)
SELECT
  'Samarqand viloyat perinatal markazi',
  'Samarkand Regional Perinatal Center',
  'Самаркандский областной перинатальный центр',
  'Samarqand viloyat perinatal markazi',
  'hospital', 'Perinatologiya', 'Perinatology', 'Samarqand', 'UZ',
  'Samarqand viloyati bo''yicha perinatal yordam markazi',
  'Regional perinatal care center for Samarkand region',
  'Samarqand viloyati bo''yicha perinatal yordam markazi',
  true, false
WHERE NOT EXISTS (SELECT 1 FROM public.healthcare_providers WHERE country_code = 'UZ' AND name = 'Samarqand viloyat perinatal markazi');

INSERT INTO public.healthcare_providers (name, name_en, name_ru, name_uz, provider_type, specialty, specialty_en, city, country_code, description, description_en, description_uz, is_active, is_featured)
SELECT
  'Buxoro viloyat perinatal markazi',
  'Bukhara Regional Perinatal Center',
  'Бухарский областной перинатальный центр',
  'Buxoro viloyat perinatal markazi',
  'hospital', 'Perinatologiya', 'Perinatology', 'Buxoro', 'UZ',
  'Buxoro viloyati bo''yicha perinatal yordam markazi',
  'Regional perinatal care center for Bukhara region',
  'Buxoro viloyati bo''yicha perinatal yordam markazi',
  true, false
WHERE NOT EXISTS (SELECT 1 FROM public.healthcare_providers WHERE country_code = 'UZ' AND name = 'Buxoro viloyat perinatal markazi');

INSERT INTO public.healthcare_providers (name, name_en, name_ru, name_uz, provider_type, specialty, specialty_en, city, country_code, description, description_en, description_uz, is_active, is_featured)
SELECT
  'Andijon viloyat perinatal markazi',
  'Andijan Regional Perinatal Center',
  'Андижанский областной перинатальный центр',
  'Andijon viloyat perinatal markazi',
  'hospital', 'Perinatologiya', 'Perinatology', 'Andijon', 'UZ',
  'Andijon viloyati bo''yicha perinatal yordam markazi',
  'Regional perinatal care center for Andijan region',
  'Andijon viloyati bo''yicha perinatal yordam markazi',
  true, false
WHERE NOT EXISTS (SELECT 1 FROM public.healthcare_providers WHERE country_code = 'UZ' AND name = 'Andijon viloyat perinatal markazi');

INSERT INTO public.healthcare_providers (name, name_en, name_ru, name_uz, provider_type, specialty, specialty_en, city, country_code, description, description_en, description_uz, is_active, is_featured)
SELECT
  'Farg''ona viloyat perinatal markazi',
  'Fergana Regional Perinatal Center',
  'Ферганский областной перинатальный центр',
  'Farg''ona viloyat perinatal markazi',
  'hospital', 'Perinatologiya', 'Perinatology', 'Farg''ona', 'UZ',
  'Farg''ona viloyati bo''yicha perinatal yordam markazi',
  'Regional perinatal care center for Fergana region',
  'Farg''ona viloyati bo''yicha perinatal yordam markazi',
  true, false
WHERE NOT EXISTS (SELECT 1 FROM public.healthcare_providers WHERE country_code = 'UZ' AND name = 'Farg''ona viloyat perinatal markazi');
