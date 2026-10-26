-- Duzelis65.sql — scheduled_notifications (statik push) tərcümələri: 7 dil
-- SƏBƏB: bu cədvəl run-kk-all ORDER-də yox idi → statik pushlar bütün dillərdə AZ gedirdi.
-- COALESCE ilə idempotent — mövcud dəyərlər əzilmir.

-- ── ru (10 sətir) ──
UPDATE public.scheduled_notifications SET title_ru = COALESCE(title_ru, 'Хорошего дня ☀️'), body_ru = COALESCE(body_ru, 'Пусть ваш день будет прекрасным! Сегодня уделите время себе.') WHERE id = 'b23e355a-80c4-49c5-acab-e255287eb9d0';
UPDATE public.scheduled_notifications SET title_ru = COALESCE(title_ru, 'Поддержка партнёра 💑'), body_ru = COALESCE(body_ru, 'Не забудьте сегодня поддержать своего партнёра!') WHERE id = 'e2a2b1d9-59e6-42ab-a7e9-71b13a431c12';
UPDATE public.scheduled_notifications SET title_ru = COALESCE(title_ru, 'Быть мамой — прекрасно 🤱'), body_ru = COALESCE(body_ru, 'Каждое мгновение с вашим малышом бесценно. Цените эти моменты!') WHERE id = 'f099172d-897e-44f4-ad64-884bd19163f0';
UPDATE public.scheduled_notifications SET title_ru = COALESCE(title_ru, 'Забота о себе ❤️'), body_ru = COALESCE(body_ru, 'Во время беременности отдых очень важен. Немного отдохните.') WHERE id = 'fc9a8c00-299a-44bb-96ef-47bee0a5ce3a';
UPDATE public.scheduled_notifications SET title_ru = COALESCE(title_ru, 'Шевеления малыша 👶'), body_ru = COALESCE(body_ru, 'Не забудьте сегодня отметить шевеления вашего малыша!') WHERE id = '09267660-c676-46bf-8c7f-e363fe1a148e';
UPDATE public.scheduled_notifications SET title_ru = COALESCE(title_ru, 'Дневник здоровья 📝'), body_ru = COALESCE(body_ru, 'Запишите, как вы себя сегодня чувствуете и какие у вас симптомы.') WHERE id = '143a6067-ccae-4656-ba58-73fbcda5af25';
UPDATE public.scheduled_notifications SET title_ru = COALESCE(title_ru, 'Время принимать витамины 💊'), body_ru = COALESCE(body_ru, 'Не забудьте принять ежедневные витамины!') WHERE id = '68dfba36-752a-4c6d-b126-b62068dcf29a';
UPDATE public.scheduled_notifications SET title_ru = COALESCE(title_ru, 'Напоминание дня 💧'), body_ru = COALESCE(body_ru, 'Не забывайте пить воду! Для поддержания здоровья выпивайте 8 стаканов воды в день.') WHERE id = '86369e0e-4f13-4d59-b837-3f52513dd6ce';
UPDATE public.scheduled_notifications SET title_ru = COALESCE(title_ru, 'Время двигаться 🚶‍♀️'), body_ru = COALESCE(body_ru, 'Небольшая прогулка полезна для вашего здоровья.') WHERE id = 'a808f6e4-abd8-43fb-9582-9221f7780b20';
UPDATE public.scheduled_notifications SET title_ru = COALESCE(title_ru, 'Напоминание о менструации 🌸'), body_ru = COALESCE(body_ru, 'Приближается дата следующей менструации. Будьте готовы!') WHERE id = 'ab7587a3-43b8-4685-a87c-500223c50943';

-- ── tr (10 sətir) ──
UPDATE public.scheduled_notifications SET title_tr = COALESCE(title_tr, 'Gününüz Güzel Geçsin ☀️'), body_tr = COALESCE(body_tr, 'Gününüz güzel geçsin! Bugün kendinize zaman ayırın.') WHERE id = 'b23e355a-80c4-49c5-acab-e255287eb9d0';
UPDATE public.scheduled_notifications SET title_tr = COALESCE(title_tr, 'Partner Desteği 💑'), body_tr = COALESCE(body_tr, 'Bugün eşinize destek olmayı unutmayın!') WHERE id = 'e2a2b1d9-59e6-42ab-a7e9-71b13a431c12';
UPDATE public.scheduled_notifications SET title_tr = COALESCE(title_tr, 'Anne Olmak Güzeldir 🤱'), body_tr = COALESCE(body_tr, 'Bebeğinizle geçirdiğiniz her an değerlidir. Bu anların kıymetini bilin!') WHERE id = 'f099172d-897e-44f4-ad64-884bd19163f0';
UPDATE public.scheduled_notifications SET title_tr = COALESCE(title_tr, 'Kişisel Bakım ❤️'), body_tr = COALESCE(body_tr, 'Hamilelik döneminde dinlenmek çok önemlidir. Biraz dinlenin.') WHERE id = 'fc9a8c00-299a-44bb-96ef-47bee0a5ce3a';
UPDATE public.scheduled_notifications SET title_tr = COALESCE(title_tr, 'Bebeğin Tekmeleri 👶'), body_tr = COALESCE(body_tr, 'Bugün bebeğinizin hareketlerini kaydetmeyi unutmayın!') WHERE id = '09267660-c676-46bf-8c7f-e363fe1a148e';
UPDATE public.scheduled_notifications SET title_tr = COALESCE(title_tr, 'Sağlık Günlüğü 📝'), body_tr = COALESCE(body_tr, 'Bugünkü ruh halinizi ve belirtilerinizi kaydedin.') WHERE id = '143a6067-ccae-4656-ba58-73fbcda5af25';
UPDATE public.scheduled_notifications SET title_tr = COALESCE(title_tr, 'Vitamin Vakti 💊'), body_tr = COALESCE(body_tr, 'Günlük vitaminlerinizi almayı unutmayın!') WHERE id = '68dfba36-752a-4c6d-b126-b62068dcf29a';
UPDATE public.scheduled_notifications SET title_tr = COALESCE(title_tr, 'Günün Hatırlatması 💧'), body_tr = COALESCE(body_tr, 'Su içmeyi unutmayın! Sağlığınız için günde 8 bardak su için.') WHERE id = '86369e0e-4f13-4d59-b837-3f52513dd6ce';
UPDATE public.scheduled_notifications SET title_tr = COALESCE(title_tr, 'Hareket Vakti 🚶‍♀️'), body_tr = COALESCE(body_tr, 'Kısa bir yürüyüşe çıkmak sağlığınız için faydalıdır.') WHERE id = 'a808f6e4-abd8-43fb-9582-9221f7780b20';
UPDATE public.scheduled_notifications SET title_tr = COALESCE(title_tr, 'Regl Hatırlatması 🌸'), body_tr = COALESCE(body_tr, 'Bir sonraki regl tarihiniz yaklaşıyor. Hazırlıklı olun!') WHERE id = 'ab7587a3-43b8-4685-a87c-500223c50943';

-- ── en (10 sətir) ──
UPDATE public.scheduled_notifications SET title_en = COALESCE(title_en, 'Have a Wonderful Day ☀️'), body_en = COALESCE(body_en, 'Have a lovely day! Take some time for yourself today.') WHERE id = 'b23e355a-80c4-49c5-acab-e255287eb9d0';
UPDATE public.scheduled_notifications SET title_en = COALESCE(title_en, 'Partner Support 💑'), body_en = COALESCE(body_en, 'Remember to support your partner today!') WHERE id = 'e2a2b1d9-59e6-42ab-a7e9-71b13a431c12';
UPDATE public.scheduled_notifications SET title_en = COALESCE(title_en, 'Motherhood Is Beautiful 🤱'), body_en = COALESCE(body_en, 'Every moment with your baby is precious. Cherish these moments!') WHERE id = 'f099172d-897e-44f4-ad64-884bd19163f0';
UPDATE public.scheduled_notifications SET title_en = COALESCE(title_en, 'Self-Care ❤️'), body_en = COALESCE(body_en, 'Rest is very important during pregnancy. Take some time to relax.') WHERE id = 'fc9a8c00-299a-44bb-96ef-47bee0a5ce3a';
UPDATE public.scheduled_notifications SET title_en = COALESCE(title_en, 'Baby Kicks 👶'), body_en = COALESCE(body_en, 'Don''t forget to log your baby''s movements today!') WHERE id = '09267660-c676-46bf-8c7f-e363fe1a148e';
UPDATE public.scheduled_notifications SET title_en = COALESCE(title_en, 'Health Journal 📝'), body_en = COALESCE(body_en, 'Record your mood and symptoms today.') WHERE id = '143a6067-ccae-4656-ba58-73fbcda5af25';
UPDATE public.scheduled_notifications SET title_en = COALESCE(title_en, 'Vitamin Time 💊'), body_en = COALESCE(body_en, 'Don''t forget to take your daily vitamins!') WHERE id = '68dfba36-752a-4c6d-b126-b62068dcf29a';
UPDATE public.scheduled_notifications SET title_en = COALESCE(title_en, 'Daily Reminder 💧'), body_en = COALESCE(body_en, 'Don''t forget to drink water! Drink 8 glasses of water a day to support your health.') WHERE id = '86369e0e-4f13-4d59-b837-3f52513dd6ce';
UPDATE public.scheduled_notifications SET title_en = COALESCE(title_en, 'Time to Get Moving 🚶‍♀️'), body_en = COALESCE(body_en, 'Going for a short walk is good for your health.') WHERE id = 'a808f6e4-abd8-43fb-9582-9221f7780b20';
UPDATE public.scheduled_notifications SET title_en = COALESCE(title_en, 'Period Reminder 🌸'), body_en = COALESCE(body_en, 'Your next period is approaching. Be prepared!') WHERE id = 'ab7587a3-43b8-4685-a87c-500223c50943';

-- ── kk (10 sətir) ──
UPDATE public.scheduled_notifications SET title_kk = COALESCE(title_kk, 'Күніңіз сәтті өтсін ☀️'), body_kk = COALESCE(body_kk, 'Күніңіз сәтті болсын! Бүгін өзіңізге уақыт бөліңіз.') WHERE id = 'b23e355a-80c4-49c5-acab-e255287eb9d0';
UPDATE public.scheduled_notifications SET title_kk = COALESCE(title_kk, 'Жұбайыңыздың қолдауы 💑'), body_kk = COALESCE(body_kk, 'Бүгін де жұбайыңызға қолдау көрсетуді ұмытпаңыз!') WHERE id = 'e2a2b1d9-59e6-42ab-a7e9-71b13a431c12';
UPDATE public.scheduled_notifications SET title_kk = COALESCE(title_kk, 'Ана болу — бақыт 🤱'), body_kk = COALESCE(body_kk, 'Бөпеңізбен өткізген әр сәт қымбат. Осы сәттерді бағалаңыз!') WHERE id = 'f099172d-897e-44f4-ad64-884bd19163f0';
UPDATE public.scheduled_notifications SET title_kk = COALESCE(title_kk, 'Өзіңізге күтім жасау ❤️'), body_kk = COALESCE(body_kk, 'Жүктілік кезінде демалу өте маңызды. Біраз тынығып алыңыз.') WHERE id = 'fc9a8c00-299a-44bb-96ef-47bee0a5ce3a';
UPDATE public.scheduled_notifications SET title_kk = COALESCE(title_kk, 'Бөпенің тебуі 👶'), body_kk = COALESCE(body_kk, 'Бүгін бөпеңіздің қимылдарын белгілеуді ұмытпаңыз!') WHERE id = '09267660-c676-46bf-8c7f-e363fe1a148e';
UPDATE public.scheduled_notifications SET title_kk = COALESCE(title_kk, 'Денсаулық күнделігі 📝'), body_kk = COALESCE(body_kk, 'Бүгінгі көңіл күйіңіз бен белгілеріңізді жазып қойыңыз.') WHERE id = '143a6067-ccae-4656-ba58-73fbcda5af25';
UPDATE public.scheduled_notifications SET title_kk = COALESCE(title_kk, 'Дәрумен қабылдайтын уақыт 💊'), body_kk = COALESCE(body_kk, 'Күнделікті дәрумендеріңізді қабылдауды ұмытпаңыз!') WHERE id = '68dfba36-752a-4c6d-b126-b62068dcf29a';
UPDATE public.scheduled_notifications SET title_kk = COALESCE(title_kk, 'Күнделікті еске салу 💧'), body_kk = COALESCE(body_kk, 'Су ішуді ұмытпаңыз! Денсаулығыңыз үшін күніне 8 стақан су ішіңіз.') WHERE id = '86369e0e-4f13-4d59-b837-3f52513dd6ce';
UPDATE public.scheduled_notifications SET title_kk = COALESCE(title_kk, 'Қимылдайтын уақыт 🚶‍♀️'), body_kk = COALESCE(body_kk, 'Аздап серуендеу денсаулығыңызға пайдалы.') WHERE id = 'a808f6e4-abd8-43fb-9582-9221f7780b20';
UPDATE public.scheduled_notifications SET title_kk = COALESCE(title_kk, 'Етеккір туралы еске салу 🌸'), body_kk = COALESCE(body_kk, 'Келесі етеккіріңіздің күні жақындап қалды. Дайын болыңыз!') WHERE id = 'ab7587a3-43b8-4685-a87c-500223c50943';

-- ── de (10 sətir) ──
UPDATE public.scheduled_notifications SET title_de = COALESCE(title_de, 'Hab einen schönen Tag ☀️'), body_de = COALESCE(body_de, 'Wir wünschen dir einen schönen Tag! Nimm dir heute etwas Zeit für dich.') WHERE id = 'b23e355a-80c4-49c5-acab-e255287eb9d0';
UPDATE public.scheduled_notifications SET title_de = COALESCE(title_de, 'Unterstützung durch den Partner 💑'), body_de = COALESCE(body_de, 'Vergiss nicht, deinen Partner heute zu unterstützen!') WHERE id = 'e2a2b1d9-59e6-42ab-a7e9-71b13a431c12';
UPDATE public.scheduled_notifications SET title_de = COALESCE(title_de, 'Mama zu sein ist wunderschön 🤱'), body_de = COALESCE(body_de, 'Jeder Moment mit deinem Baby ist kostbar. Genieße diese Augenblicke!') WHERE id = 'f099172d-897e-44f4-ad64-884bd19163f0';
UPDATE public.scheduled_notifications SET title_de = COALESCE(title_de, 'Selbstfürsorge ❤️'), body_de = COALESCE(body_de, 'In der Schwangerschaft ist Erholung besonders wichtig. Ruh dich ein wenig aus.') WHERE id = 'fc9a8c00-299a-44bb-96ef-47bee0a5ce3a';
UPDATE public.scheduled_notifications SET title_de = COALESCE(title_de, 'Babytritte 👶'), body_de = COALESCE(body_de, 'Vergiss nicht, heute die Bewegungen deines Babys zu notieren!') WHERE id = '09267660-c676-46bf-8c7f-e363fe1a148e';
UPDATE public.scheduled_notifications SET title_de = COALESCE(title_de, 'Gesundheitstagebuch 📝'), body_de = COALESCE(body_de, 'Notiere deine heutige Stimmung und deine Symptome.') WHERE id = '143a6067-ccae-4656-ba58-73fbcda5af25';
UPDATE public.scheduled_notifications SET title_de = COALESCE(title_de, 'Zeit für deine Vitamine 💊'), body_de = COALESCE(body_de, 'Vergiss nicht, deine täglichen Vitamine einzunehmen!') WHERE id = '68dfba36-752a-4c6d-b126-b62068dcf29a';
UPDATE public.scheduled_notifications SET title_de = COALESCE(title_de, 'Erinnerung des Tages 💧'), body_de = COALESCE(body_de, 'Vergiss nicht, Wasser zu trinken! Trinke für deine Gesundheit täglich 8 Gläser Wasser.') WHERE id = '86369e0e-4f13-4d59-b837-3f52513dd6ce';
UPDATE public.scheduled_notifications SET title_de = COALESCE(title_de, 'Zeit für Bewegung 🚶‍♀️'), body_de = COALESCE(body_de, 'Ein kleiner Spaziergang tut deiner Gesundheit gut.') WHERE id = 'a808f6e4-abd8-43fb-9582-9221f7780b20';
UPDATE public.scheduled_notifications SET title_de = COALESCE(title_de, 'Periodenerinnerung 🌸'), body_de = COALESCE(body_de, 'Deine nächste Periode steht bald bevor. Sei vorbereitet!') WHERE id = 'ab7587a3-43b8-4685-a87c-500223c50943';

-- ── ar (10 sətir) ──
UPDATE public.scheduled_notifications SET title_ar = COALESCE(title_ar, 'نتمنى لكِ يومًا سعيدًا ☀️'), body_ar = COALESCE(body_ar, 'نتمنى لكِ يومًا مباركًا! خصّصي بعض الوقت لنفسكِ اليوم.') WHERE id = 'b23e355a-80c4-49c5-acab-e255287eb9d0';
UPDATE public.scheduled_notifications SET title_ar = COALESCE(title_ar, 'دعم الشريك 💑'), body_ar = COALESCE(body_ar, 'لا تنسي دعم زوجكِ اليوم!') WHERE id = 'e2a2b1d9-59e6-42ab-a7e9-71b13a431c12';
UPDATE public.scheduled_notifications SET title_ar = COALESCE(title_ar, 'الأمومة جميلة 🤱'), body_ar = COALESCE(body_ar, 'كل لحظة مع طفلكِ ثمينة. استمتعي بهذه اللحظات!') WHERE id = 'f099172d-897e-44f4-ad64-884bd19163f0';
UPDATE public.scheduled_notifications SET title_ar = COALESCE(title_ar, 'العناية بنفسكِ ❤️'), body_ar = COALESCE(body_ar, 'الراحة مهمة جدًا خلال فترة الحمل. خذي قسطًا من الراحة.') WHERE id = 'fc9a8c00-299a-44bb-96ef-47bee0a5ce3a';
UPDATE public.scheduled_notifications SET title_ar = COALESCE(title_ar, 'ركلات طفلكِ 👶'), body_ar = COALESCE(body_ar, 'لا تنسي تسجيل حركات طفلكِ اليوم!') WHERE id = '09267660-c676-46bf-8c7f-e363fe1a148e';
UPDATE public.scheduled_notifications SET title_ar = COALESCE(title_ar, 'مفكرة الصحة 📝'), body_ar = COALESCE(body_ar, 'سجّلي حالتكِ المزاجية وأعراضكِ اليوم.') WHERE id = '143a6067-ccae-4656-ba58-73fbcda5af25';
UPDATE public.scheduled_notifications SET title_ar = COALESCE(title_ar, 'موعد الفيتامينات 💊'), body_ar = COALESCE(body_ar, 'لا تنسي تناول فيتاميناتكِ اليومية!') WHERE id = '68dfba36-752a-4c6d-b126-b62068dcf29a';
UPDATE public.scheduled_notifications SET title_ar = COALESCE(title_ar, 'تذكير اليوم 💧'), body_ar = COALESCE(body_ar, 'لا تنسي شرب الماء! اشربي 8 أكواب من الماء يوميًا للحفاظ على صحتكِ.') WHERE id = '86369e0e-4f13-4d59-b837-3f52513dd6ce';
UPDATE public.scheduled_notifications SET title_ar = COALESCE(title_ar, 'وقت الحركة 🚶‍♀️'), body_ar = COALESCE(body_ar, 'الخروج في نزهة قصيرة مفيد لصحتكِ.') WHERE id = 'a808f6e4-abd8-43fb-9582-9221f7780b20';
UPDATE public.scheduled_notifications SET title_ar = COALESCE(title_ar, 'تذكير بالدورة الشهرية 🌸'), body_ar = COALESCE(body_ar, 'اقترب موعد دورتكِ الشهرية القادمة. كوني مستعدة!') WHERE id = 'ab7587a3-43b8-4685-a87c-500223c50943';

-- ── uz (10 sətir) ──
UPDATE public.scheduled_notifications SET title_uz = COALESCE(title_uz, 'Chaqaloqning tepishlari 👶'), body_uz = COALESCE(body_uz, 'Bugun chaqalog‘ingizning harakatlarini qayd etishni unutmang!') WHERE id = '09267660-c676-46bf-8c7f-e363fe1a148e';
UPDATE public.scheduled_notifications SET title_uz = COALESCE(title_uz, 'Salomatlik kundaligi 📝'), body_uz = COALESCE(body_uz, 'Bugungi kayfiyatingiz va alomatlaringizni qayd eting.') WHERE id = '143a6067-ccae-4656-ba58-73fbcda5af25';
UPDATE public.scheduled_notifications SET title_uz = COALESCE(title_uz, 'Vitaminlar vaqti 💊'), body_uz = COALESCE(body_uz, 'Kundalik vitaminlaringizni qabul qilishni unutmang!') WHERE id = '68dfba36-752a-4c6d-b126-b62068dcf29a';
UPDATE public.scheduled_notifications SET title_uz = COALESCE(title_uz, 'Kun eslatmasi 💧'), body_uz = COALESCE(body_uz, 'Suv ichishni unutmang! Salomatligingiz uchun kuniga 8 stakan suv iching.') WHERE id = '86369e0e-4f13-4d59-b837-3f52513dd6ce';
UPDATE public.scheduled_notifications SET title_uz = COALESCE(title_uz, 'Harakatlanish vaqti 🚶‍♀️'), body_uz = COALESCE(body_uz, 'Biroz sayr qilish salomatligingiz uchun foydali.') WHERE id = 'a808f6e4-abd8-43fb-9582-9221f7780b20';
UPDATE public.scheduled_notifications SET title_uz = COALESCE(title_uz, 'Hayz eslatmasi 🌸'), body_uz = COALESCE(body_uz, 'Keyingi hayz sanangiz yaqinlashmoqda. Tayyor turing!') WHERE id = 'ab7587a3-43b8-4685-a87c-500223c50943';
UPDATE public.scheduled_notifications SET title_uz = COALESCE(title_uz, 'Kuningiz Xayrli O‘tsin ☀️'), body_uz = COALESCE(body_uz, 'Kuningiz xayrli bo‘lsin! Bugun o‘zingizga vaqt ajrating.') WHERE id = 'b23e355a-80c4-49c5-acab-e255287eb9d0';
UPDATE public.scheduled_notifications SET title_uz = COALESCE(title_uz, 'Juftingizning Ko‘magi 💑'), body_uz = COALESCE(body_uz, 'Bugun ham turmush o‘rtog‘ingizni qo‘llab-quvvatlashni unutmang!') WHERE id = 'e2a2b1d9-59e6-42ab-a7e9-71b13a431c12';
UPDATE public.scheduled_notifications SET title_uz = COALESCE(title_uz, 'Ona Bo‘lish Go‘zal 🤱'), body_uz = COALESCE(body_uz, 'Chaqalog‘ingiz bilan o‘tgan har bir lahza qadrli. Bu lahzalarni qadrlang!') WHERE id = 'f099172d-897e-44f4-ad64-884bd19163f0';
UPDATE public.scheduled_notifications SET title_uz = COALESCE(title_uz, 'O‘zingizga G‘amxo‘rlik ❤️'), body_uz = COALESCE(body_uz, 'Homiladorlik davrida dam olish juda muhim. Biroz dam oling.') WHERE id = 'fc9a8c00-299a-44bb-96ef-47bee0a5ce3a';

