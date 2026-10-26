-- ============================================================
-- OzbekFix4 — Təcili yardım nömrələri ÖLKƏYƏ görə
-- PROBLEM: mental_health_resources qlobal idi — UZ istifadəçilərə
-- Azərbaycan nömrələri (860, 113, ASAN, 116-111) göstərilirdi.
-- Bu, təcili vəziyyətdə YANLIŞ NÖMRƏ deməkdir.
--
-- HƏLL:
--   1) country_code sütunu (mövcud sətirlər = 'AZ')
--   2) Özbəkistan üçün RƏSMİ TƏSDİQLƏNMİŞ nömrələr əlavə olunur.
--      Mənbələr (2026-09-05 yoxlanıb):
--        • 103  — Tez tibbiy yordam  (VM Qərarı №304, 29.05.2024 — lex.uz/-6945899)
--        • 112  — Yagona favqulodda dispetcherlik xizmati (həmin qərar)
--        • 1146 — Xotin-qizlar ishonch telefoni: zo'ravonlik + suitsid riski,
--                 psixoloji/hüquqi yardım (lex.uz/-6945899; ihma.uz/services)
--        • 1140 — "Inson" ijtimoiy xizmatlar markazlari (ihma.uz; advice.adliya.uz/3120)
--        • 1003 — Sog'liqni saqlash vazirligi ishonch telefoni, 24/7 (gov.uz/oz/ssv)
--      QEYD: 1051 "psixoloji xətt" HEÇ BİR rəsmi mənbədə təsdiqlənmədi — istifadə etmirik.
--      QEYD: Özbəkistanda ayrıca 24/7 uşaq ishonch telefoni YOXDUR (CHI siyahısında UZ yox);
--            uşaq/ailə məsələləri 1140-ın əhatəsindədir.
--   3) Client (useMentalHealthResources) artıq ölkəyə görə filtrləyir.
-- Təkrar icra təhlükəsizdir (IF NOT EXISTS / WHERE NOT EXISTS).
-- ============================================================

ALTER TABLE public.mental_health_resources
  ADD COLUMN IF NOT EXISTS country_code text NOT NULL DEFAULT 'AZ';

CREATE INDEX IF NOT EXISTS idx_mental_health_resources_country
  ON public.mental_health_resources (country_code);

-- Mövcud (AZ) sətirlər DEFAULT ilə 'AZ' alır; NULL qalıbsa düzəlt:
UPDATE public.mental_health_resources SET country_code = 'AZ' WHERE country_code IS NULL;

-- ── UZ sətirləri ──────────────────────────────────────────────
INSERT INTO public.mental_health_resources
  (name, name_az, name_en, name_ru, name_uz,
   description, description_az, description_en, description_ru, description_uz,
   resource_type, phone, is_emergency, sort_order, is_active, country_code)
SELECT
  'Shoshilinch tibbiy yordam', 'Təcili tibbi yardım', 'Emergency medical service', 'Скорая медицинская помощь', 'Shoshilinch tibbiy yordam',
  'Tez tibbiy yordam xizmati — 24/7', 'Təcili tibbi yardım xidməti — 24/7', 'Emergency medical care, 24/7', 'Скорая медицинская помощь, круглосуточно', 'Tez tibbiy yordam xizmati — kecha-kunduz',
  'hotline', '103', true, 1, true, 'UZ'
WHERE NOT EXISTS (SELECT 1 FROM public.mental_health_resources WHERE phone = '103' AND country_code = 'UZ');

INSERT INTO public.mental_health_resources
  (name, name_az, name_en, name_ru, name_uz,
   description, description_az, description_en, description_ru, description_uz,
   resource_type, phone, is_emergency, sort_order, is_active, country_code)
SELECT
  'Yagona favqulodda xizmat', 'Vahid fövqəladə xidmət', 'Unified emergency number', 'Единая служба экстренной помощи', 'Yagona favqulodda xizmat',
  'Politsiya, qutqaruv, tez yordam va gaz — yagona dispetcherlik xizmati', 'Polis, xilasetmə, təcili yardım — vahid dispetçer xidməti', 'Police, rescue, ambulance and gas — single dispatch service', 'Полиция, спасатели, скорая и газ — единая диспетчерская служба', 'Politsiya, qutqaruv, tez yordam va gaz — yagona dispetcherlik xizmati',
  'hotline', '112', true, 2, true, 'UZ'
WHERE NOT EXISTS (SELECT 1 FROM public.mental_health_resources WHERE phone = '112' AND country_code = 'UZ');

INSERT INTO public.mental_health_resources
  (name, name_az, name_en, name_ru, name_uz,
   description, description_az, description_en, description_ru, description_uz,
   resource_type, phone, is_emergency, sort_order, is_active, country_code)
SELECT
  'Xotin-qizlar ishonch telefoni', 'Qadınlar üçün etimad xətti', 'Women''s support hotline', 'Телефон доверия для женщин', 'Xotin-qizlar ishonch telefoni',
  'Tazyiq va zo''ravonlikdan jabr ko''rgan yoki og''ir ruhiy holatdagi ayollar uchun shoshilinch psixologik va huquqiy yordam — 24/7', 'Zorakılıqdan zərər görmüş və ya ağır psixoloji vəziyyətdə olan qadınlar üçün təcili psixoloji və hüquqi yardım — 24/7', 'Urgent psychological and legal help for women affected by violence or in psychological crisis — 24/7', 'Срочная психологическая и юридическая помощь женщинам, пострадавшим от насилия или в кризисном состоянии — 24/7', 'Tazyiq va zo''ravonlikdan jabr ko''rgan yoki og''ir ruhiy holatdagi ayollar uchun shoshilinch psixologik va huquqiy yordam — kecha-kunduz',
  'hotline', '1146', true, 3, true, 'UZ'
WHERE NOT EXISTS (SELECT 1 FROM public.mental_health_resources WHERE phone = '1146' AND country_code = 'UZ');

INSERT INTO public.mental_health_resources
  (name, name_az, name_en, name_ru, name_uz,
   description, description_az, description_en, description_ru, description_uz,
   resource_type, phone, is_emergency, sort_order, is_active, country_code)
SELECT
  '"Inson" ijtimoiy xizmatlari', '"Inson" sosial xidmətləri', '"Inson" social services', 'Социальные службы «Инсон»', '"Inson" ijtimoiy xizmatlari',
  'Oila va bolalar uchun ijtimoiy qo''llab-quvvatlash — Ijtimoiy himoya milliy agentligi', 'Ailə və uşaqlar üçün sosial dəstək xidməti', 'Social support for families and children — National Agency for Social Protection', 'Социальная поддержка семей и детей — Национальное агентство социальной защиты', 'Oila va bolalar uchun ijtimoiy qo''llab-quvvatlash — Ijtimoiy himoya milliy agentligi',
  'hotline', '1140', false, 4, true, 'UZ'
WHERE NOT EXISTS (SELECT 1 FROM public.mental_health_resources WHERE phone = '1140' AND country_code = 'UZ');

INSERT INTO public.mental_health_resources
  (name, name_az, name_en, name_ru, name_uz,
   description, description_az, description_en, description_ru, description_uz,
   resource_type, phone, is_emergency, sort_order, is_active, country_code)
SELECT
  'Sog''liqni saqlash vazirligi ishonch telefoni', 'Səhiyyə Nazirliyi etimad xətti', 'Health Ministry call centre', 'Горячая линия Минздрава', 'Sog''liqni saqlash vazirligi ishonch telefoni',
  'Tibbiy xizmatlar bo''yicha ma''lumot va murojaatlar — 24/7', 'Tibbi xidmətlərlə bağlı məlumat və müraciətlər — 24/7', 'Information and appeals on medical services — 24/7', 'Информация и обращения по медицинским услугам — круглосуточно', 'Tibbiy xizmatlar bo''yicha ma''lumot va murojaatlar — kecha-kunduz',
  'hotline', '1003', false, 5, true, 'UZ'
WHERE NOT EXISTS (SELECT 1 FROM public.mental_health_resources WHERE phone = '1003' AND country_code = 'UZ');
