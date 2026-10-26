-- ============================================================
-- OzbekFix3 — premium_features: title_uz/description_uz
-- Problem: UZ paywall-da RUSCA görünürdü ("Успокаивающие звуки",
-- "Создай сказку"...) — _uz sütunları var idi, data yox idi →
-- mapRowTranslation uz→ru körpüsü rus mətni göstərirdi.
-- Sətirlər Son25.sql-dəki kimi `title` (EN) ilə hədəflənir.
-- Təkrar icra təhlükəsizdir (adi UPDATE-lər).
-- ============================================================

UPDATE public.premium_features SET title_uz = 'AI doktor chati',            description_uz = 'Kuniga 10 ta xabar'                    WHERE title = 'AI Doctor Chat';
UPDATE public.premium_features SET title_uz = 'Tinchlantiruvchi tovushlar', description_uz = 'Bepul: kuniga 20 daqiqa / Cheksiz'      WHERE title = 'White Noise';
UPDATE public.premium_features SET title_uz = 'Chaqaloq fotosessiyasi',     description_uz = 'Bepul: 3 ta foto / Cheksiz'             WHERE title = 'Baby Photoshoot';
UPDATE public.premium_features SET title_uz = 'Ertak yarating',             description_uz = 'Bepul: kuniga 3 ta / Cheksiz'           WHERE title = 'Fairy Tales';
UPDATE public.premium_features SET title_uz = 'Yig''i tahlili',             description_uz = 'Bepul: kuniga 3 ta / Cheksiz'           WHERE title = 'Cry Translator';
UPDATE public.premium_features SET title_uz = 'Taglik skaneri',             description_uz = 'Bepul: kuniga 3 ta / Cheksiz'           WHERE title = 'Poop Scanner';
UPDATE public.premium_features SET title_uz = 'Ovqatlanish kuzatuvi',       description_uz = 'Faqat Premium'                          WHERE title = 'Nutrition Tracking';
UPDATE public.premium_features SET title_uz = 'Mashq dasturlari',           description_uz = 'Faqat Premium'                          WHERE title = 'Exercise Programs';
UPDATE public.premium_features SET title_uz = 'Onalar uchun xarita',        description_uz = 'Faqat Premium'                          WHERE title = 'Mom-Friendly Map';
UPDATE public.premium_features SET title_uz = 'Munajjimlar bashorati',      description_uz = 'Faqat Premium'                          WHERE title = 'Horoscope';
UPDATE public.premium_features SET title_uz = 'Xavfsizlik tekshiruvi',      description_uz = 'Faqat Premium'                          WHERE title = 'Safety Lookup';
UPDATE public.premium_features SET title_uz = 'Qondagi qand kuzatuvi',      description_uz = 'Faqat Premium'                          WHERE title = 'Blood Sugar Tracker';
UPDATE public.premium_features SET title_uz = 'Homiladorlik albomi',        description_uz = 'Faqat Premium'                          WHERE title = 'Pregnancy Album';
UPDATE public.premium_features SET title_uz = 'Retseptlar',                 description_uz = 'Kategoriyada 3 tasi bepul / Cheksiz'    WHERE title = 'Recipes';
UPDATE public.premium_features SET title_uz = 'Reklamasiz tajriba',         description_uz = 'Hech qanday reklama yo''q'              WHERE title = 'Ad-Free Experience';
UPDATE public.premium_features SET title_uz = 'Ustuvor qo''llab-quvvatlash',description_uz = 'Tezkor texnik yordam'                   WHERE title = 'Priority Support';

-- Paywall screenshot-unda görünən, Son25-də olmayan mümkün sətirlər (varsa):
UPDATE public.premium_features SET title_uz = 'O''sish kuzatuvi'            WHERE title IN ('Growth Tracking', 'Growth Tracker') AND title_uz IS NULL;
UPDATE public.premium_features SET title_uz = 'Anacan AI'                   WHERE title = 'Anacan AI' AND title_uz IS NULL;

-- Yekun yoxlama üçün: uz-suz qalan aktiv sətirləri göstər
-- SELECT id, title FROM public.premium_features WHERE title_uz IS NULL;
