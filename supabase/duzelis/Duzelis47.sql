-- Duzelis47.sql — Mental Sağlamlıq ekranında tərcümə problemləri
-- Kod tərəfi (2 hardcoded Azərbaycanca sətir) src/components/tools/MentalHealthTracker.tsx-də
-- düzəldildi (commit-də), bu fayl yalnız DATA tərəfini düzəldir:
--   mental_health_resources və breathing_exercises cədvəllərində name_en/description_en
--   sütunları HEÇ BİR sətirdə doldurulmayıb. Bəzi sətirlərdə bare `name`/`description`
--   sütunu təsadüfən ingiliscə yazılıb (görünürdü, çünki mapRowsTranslation fallback
--   zənciri "field_en ?? field ?? field_az" bare sahəyə düşür), bəzilərində isə bare
--   sütun da Azərbaycanca yazılıb (görünmürdü — ingilis interfeysində Azərbaycanca mətn
--   sızırdı). Bu, name_en/description_en-i bütün sətirlər üçün EXPLICIT dolduraraq düzəldilir
--   (təsadüfi fallback-a etibar etmək əvəzinə).

-- ─────────────────────────────────────────────────────────────
-- mental_health_resources
-- ─────────────────────────────────────────────────────────────
UPDATE public.mental_health_resources SET
  name_en = 'Psychological Support Line',
  description_en = '24-hour psychological support service'
WHERE id = 'cc65349d-e172-48dc-9b4d-9ead800be207';

UPDATE public.mental_health_resources SET
  name_en = 'Emergency Mental Health Hotline',
  description_en = 'National mental health crisis line'
WHERE id = 'b060bf8e-2f05-4173-af0a-7e5c9ebeb3c2';

UPDATE public.mental_health_resources SET
  name_en = 'ASAN Women Support Line',
  description_en = 'Support for women in difficult situations'
WHERE id = '38c6b6f3-bbaf-4903-aa2a-3f8b796679d9';

UPDATE public.mental_health_resources SET
  name_en = 'Emergency Medical Assistance',
  description_en = 'Emergency medical assistance service'
WHERE id = '4f4f4469-2043-4919-a6b3-1cb80317a55e';

UPDATE public.mental_health_resources SET
  name_en = 'Child Protection Hotline',
  description_en = 'For child protection and support'
WHERE id = '92af5772-67b9-4a45-be7c-45cc1690976e';

UPDATE public.mental_health_resources SET
  name_en = 'Family and Child Center',
  description_en = 'Family psychological counseling center'
WHERE id = 'd3081952-ac1a-414f-a6d1-55bbaff886f3';

UPDATE public.mental_health_resources SET
  name_en = 'Psychological Support Center',
  description_en = 'Professional psychological counseling'
WHERE id = 'e14d07a2-ca8f-49c0-8aa3-5d37ba64147a';

UPDATE public.mental_health_resources SET
  name_en = 'Mother Support Group',
  description_en = 'Sharing experiences with other mothers'
WHERE id = '191c5946-7cb5-4c7f-a933-68cca7350e58';

UPDATE public.mental_health_resources SET
  name_en = 'Family Support Center',
  description_en = 'Support for families and mothers'
WHERE id = 'b6894134-c879-4225-a308-9f6d198e9b5c';

UPDATE public.mental_health_resources SET
  name_en = 'Postpartum Support Group',
  description_en = 'Online support group for new mothers'
WHERE id = 'fd731ae9-7437-499d-9a66-3c99983eb91d';

-- ─────────────────────────────────────────────────────────────
-- breathing_exercises (bare name/description artıq ingiliscə idi, indi rəsmi olaraq
-- name_en/description_en-ə də köçürülür ki, mexanizm təsadüfə əsaslanmasın)
-- ─────────────────────────────────────────────────────────────
UPDATE public.breathing_exercises SET
  name_en = '4-7-8 Breathing',
  description_en = 'A relaxation technique that promotes calm and sleep'
WHERE id = '018f12ea-f90e-4beb-8933-b27da7a1551c';

UPDATE public.breathing_exercises SET
  name_en = 'Box Breathing',
  description_en = 'A technique used by Navy SEALs for stress control'
WHERE id = '5fe9d325-2ba8-40e3-b631-3eb13c6c766b';

UPDATE public.breathing_exercises SET
  name_en = 'Relaxing Breath',
  description_en = 'Simple deep breathing for quick relaxation'
WHERE id = 'fbf2988e-7f25-4752-954c-8707fbbbaa81';

UPDATE public.breathing_exercises SET
  name_en = 'Energizing Breath',
  description_en = 'Quick breathing to boost energy levels'
WHERE id = 'e90074fc-95b0-44d1-8a10-94f6564afb9d';
