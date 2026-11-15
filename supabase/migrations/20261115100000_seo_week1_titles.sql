-- SEO week 1 (owner 2026-11-15, Search Console analysis 17 Oct - 13 Nov): search titles and descriptions that answer the
-- searcher's question, for the 30 article pages with the largest click gap (position 5-10, CTR 0.2-0.7%) and the
-- "Modern Azerbaijani names" article (2026-2027) in 7 languages. Written by Claude (not Gemini). Only
-- editorial_metadata.locales.<lang>.seoTitle / seoDescription change; titles, bodies and slugs stay. Data only.
-- Posts without the editorial schema get a minimal locale entry that only the website reads (the app ignores it).
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $m$
DECLARE r record; n int := 0;
BEGIN
  FOR r IN SELECT * FROM (VALUES
  ('69f18f97-cbab-55bb-ac7c-4b86c2dc6d3e'::uuid, 'fr', 'Battement de cœur du bébé : à quelle semaine ?', 'L''activité cardiaque se voit parfois à l''échographie vers 6 semaines. Découvrez pourquoi la méthode, la taille de l''embryon et le contrôle comptent.'),
  ('753f2334-bb87-56f9-ac1f-3cd850827e98'::uuid, 'pt', 'Urina laranja ou escura no recém-nascido: é normal?', 'Manchas cor de laranja ou rosa na fralda nem sempre são motivo de alarme. Veja as causas, a quantidade normal de urina e os sinais para consultar o médico.'),
  ('55e1cf3a-e48f-451c-95b1-e81a61c7a575'::uuid, 'es', '¿Es malo cortarse el pelo en el embarazo?', 'No, cortarse el pelo no afecta al bebé: es un mito popular. Te explicamos qué dice la medicina sobre los tintes sin amoníaco y la queratina en el embarazo.'),
  ('2e394626-cc8b-5638-884d-085d8ddf1ce0'::uuid, 'hi', 'दवा के बाद उल्टी हो गई: क्या दोबारा खुराक लें?', 'तुरंत दूसरी खुराक न लें। यह दवा और समय पर निर्भर करता है, इसलिए डॉक्टर या फार्मासिस्ट से पूछें। जानें गर्भावस्था में क्या करें और कब तुरंत मदद लें।'),
  ('69f18f97-cbab-55bb-ac7c-4b86c2dc6d3e'::uuid, 'de', 'Herzschlag vom Baby: Ab wann sichtbar und hörbar?', 'Im frühen Ultraschall ist die Herzaktivität manchmal um die 6. Woche sichtbar. Wir erklären, warum Methode, Embryogröße und der Kontrolltermin zählen.'),
  ('55e1cf3a-e48f-451c-95b1-e81a61c7a575'::uuid, 'en', 'Can You Cut or Dye Your Hair While Pregnant?', 'Cutting your hair during pregnancy does not harm the baby; that is a myth. See what doctors say about hair dye, ammonia-free colour and keratin treatments.'),
  ('25fa5941-d6ac-5cd8-8b12-5185312a57f3'::uuid, 'ar', 'كيس الحمل ظاهر والجنين غير ظاهر: هل هذا طبيعي؟', 'قد يكون ذلك طبيعيًا في السونار المبكر إذا كان الحمل في بدايته. نشرح دور حجم الكيس وطريقة الفحص وموعد إعادة السونار، ومتى تراجعين الطبيب.'),
  ('55e1cf3a-e48f-451c-95b1-e81a61c7a575'::uuid, 'pt', 'Grávida pode cortar e pintar o cabelo?', 'Sim, cortar o cabelo na gravidez não prejudica o bebé: é um mito. Veja o que a medicina diz sobre tintas sem amoníaco, queratina e cuidados seguros.'),
  ('964dca93-2822-5ac2-8362-5ede3ac2402e'::uuid, 'ar', 'كيف أستخدم تحاميل البروجسترون؟ وما سبب الإفرازات؟', 'خروج بقايا بيضاء بعد التحاميل غالبًا ما يكون أمرًا طبيعيًا. نشرح طريقة الاستخدام الصحيحة أثناء الحمل والحالات التي تحتاج استشارة طبية عاجلة.'),
  ('753f2334-bb87-56f9-ac1f-3cd850827e98'::uuid, 'fr', 'Urine orange ou foncée du nouveau-né : normal ?', 'Des taches orange ou roses dans la couche ne sont pas toujours inquiétantes. Découvrez les causes, la quantité d''urine normale et quand consulter.'),
  ('13f29c48-81e2-41fb-8c78-7ae31a794679'::uuid, 'pt', 'Grávida pode comer romã e tâmaras? Veja a ciência', 'Sim, romã e tâmaras podem fazer parte de uma alimentação equilibrada na gravidez. Veja o que a ciência diz sobre anemia, placenta e tâmaras antes do parto.'),
  ('2e394626-cc8b-5638-884d-085d8ddf1ce0'::uuid, 'en', 'Vomited After Taking Medicine? Should You Re-Dose?', 'Don''t take a second dose right away. It depends on the medicine and timing, so ask a doctor or pharmacist. Learn what to do in pregnancy.'),
  ('8d83fe70-b8fd-4c76-9c33-0e1fab0d6794'::uuid, 'az', 'Dekret 2026: pulu necə hesablanır, kimlərə düşür?', 'Azərbaycanda analıq məzuniyyəti (dekret) adətən 126 gündür. 2026: dekret kimlərə düşür, ödəniş necə hesablanır və iş yeriniz necə qorunur.'),
  ('753f2334-bb87-56f9-ac1f-3cd850827e98'::uuid, 'ar', 'لون بول حديثي الولادة: متى يكون طبيعيًا؟', 'البقع البرتقالية أو الوردية في الحفاض ليست دائمًا مقلقة. تعرفي على الأسباب وكمية البول الطبيعية والعلامات التي تستدعي مراجعة الطبيب دون تأخير.'),
  ('2e394626-cc8b-5638-884d-085d8ddf1ce0'::uuid, 'pt', 'Vomitei após o medicamento: devo repetir a dose?', 'Não tome logo uma segunda dose. Depende do medicamento e do tempo decorrido, por isso fale com o médico ou farmacêutico. Saiba o que fazer na gravidez.'),
  ('25fa5941-d6ac-5cd8-8b12-5185312a57f3'::uuid, 'es', 'Saco gestacional sin embrión en la ecografía', 'En una ecografía temprana puede ser normal no ver aún el embrión. Explicamos por qué importan el tamaño del saco, el tipo de ecografía y el control.'),
  ('1641467b-58eb-5e48-9ff8-f94999c5f765'::uuid, 'de', 'Baby bewegt sich weniger: Was tun?', 'Rufen Sie sofort Hebamme, Ärztin oder Klinik an, auch nachts. Warten Sie nicht ab. Hier lesen Sie, warum veränderte Kindsbewegungen so wichtig sind.'),
  ('753f2334-bb87-56f9-ac1f-3cd850827e98'::uuid, 'es', 'Orina naranja u oscura en el recién nacido', 'Las manchas naranjas o rosadas en el pañal no siempre son preocupantes. Conozca las causas, la cantidad normal de orina y cuándo consultar al pediatra.'),
  ('2e394626-cc8b-5638-884d-085d8ddf1ce0'::uuid, 'fr', 'Vomi après un médicament : reprendre la dose ?', 'Ne reprenez pas tout de suite une deuxième dose. Tout dépend du médicament et du délai : demandez à un médecin ou pharmacien. Ce qu''il faut savoir enceinte'),
  ('55e1cf3a-e48f-451c-95b1-e81a61c7a575'::uuid, 'de', 'Haare schneiden in der Schwangerschaft: erlaubt?', 'Ja, Haareschneiden schadet dem Baby nicht, das ist ein alter Mythos. Was die Medizin zu Haarfarbe, ammoniakfreien Produkten und Keratin sagt.'),
  ('4bf9029a-a44a-5f88-ab6e-0fda2c11a3d9'::uuid, 'pt', 'Como segurar a cabeça do bebé recém-nascido?', 'Apoie sempre a cabeça e o pescoço do recém-nascido com a mão ao pegar e deitar. Veja técnicas seguras e dicas para fortalecer os músculos do pescoço.'),
  ('d4ab3b17-b307-43d7-a89e-46869dad48d4'::uuid, 'kk', 'Ана сүтін көбейтетін тағамдар және дұрыс емізу', 'Сүттің көбеюіне ең алдымен жиі және дұрыс емізу көмектеседі. Емізетін ананың тамақтануы, емізу қалыптары және «сүтім жетпейді» қорқынышы туралы.'),
  ('20146a03-c60f-4544-8ada-5b41516bd1a0'::uuid, 'fr', 'Date d''accouchement : comment la calculer ?', 'On compte en général 280 jours (40 semaines) depuis le 1er jour des dernières règles : c''est la règle de Naegele. Méthodes, limites et calculateur.'),
  ('55e1cf3a-e48f-451c-95b1-e81a61c7a575'::uuid, 'ar', 'هل قص الشعر وصبغه أثناء الحمل آمن؟', 'قص الشعر أثناء الحمل لا يضر الجنين، فهذه خرافة شائعة. تعرفي على رأي الطب في صبغات الشعر الخالية من الأمونيا والكيراتين وقواعد العناية الآمنة.'),
  ('13f29c48-81e2-41fb-8c78-7ae31a794679'::uuid, 'es', '¿Se pueden comer granada y dátiles en el embarazo?', 'Sí, la granada y los dátiles pueden formar parte de una dieta equilibrada. Qué dice la ciencia sobre la anemia, la placenta y los dátiles antes del parto.'),
  ('9f91a3d2-7ec8-524c-a1a9-f1f1cb05f02a'::uuid, 'en', 'No Nausea in Pregnancy: Is It Normal?', 'Often yes: nausea does not happen in every pregnancy. Learn what symptom-free days can mean, which check-ups matter and when to contact your doctor.'),
  ('2e394626-cc8b-5638-884d-085d8ddf1ce0'::uuid, 'ar', 'تقيأت بعد تناول الدواء: هل آخذ جرعة أخرى؟', 'لا تأخذي جرعة ثانية فورًا. يعتمد القرار على نوع الدواء والوقت المنقضي، لذا استشيري الطبيب أو الصيدلي. تعرفي على ما يجب فعله أثناء الحمل.'),
  ('81231ec4-0a2d-5597-a0f5-cc45db0cd401'::uuid, 'fr', 'Tenir bébé droit après la tétée : comment faire ?', 'Le garder droit après la tétée aide la digestion et peut réduire les gaz et l''inconfort. Les bonnes positions pas à pas et le couchage en sécurité.'),
  ('964dca93-2822-5ac2-8362-5ede3ac2402e'::uuid, 'fr', 'Ovule de progestérone : utilisation et pertes', 'Des pertes blanchâtres après un ovule de progestérone sont souvent des résidus normaux. Comment l''utiliser enceinte et quand consulter sans attendre.'),
  ('8006253e-52ab-4e84-9301-372db3dbde93'::uuid, 'es', 'Hipertonía uterina: ¿es peligrosa y cómo se trata?', 'No siempre es peligrosa, pero algunas señales requieren ir al médico. Causas de la tensión abdominal y los calambres, y qué saber sobre magnesio y reposo.'),
  ('65ea9140-5797-41f3-aafd-a8c2235664c9'::uuid, 'az', 'Müasir Azərbaycan adları 2026-2027: ən populyarları', '2026-2027-ci illərin ən populyar Azərbaycan qız və oğlan adları mənaları ilə: müasir, qısa və nadir adlar, ad seçmək üçün məsləhətlər.'),
  ('65ea9140-5797-41f3-aafd-a8c2235664c9'::uuid, 'ka', 'აზერბაიჯანული სახელები 2026-2027: პოპულარული', '2026-2027 წლის ყველაზე პოპულარული აზერბაიჯანული გოგოს და ბიჭის სახელები მნიშვნელობით: თანამედროვე, მოკლე და იშვიათი სახელები.'),
  ('65ea9140-5797-41f3-aafd-a8c2235664c9'::uuid, 'tr', 'Azerbaycan isimleri 2026-2027: kız ve erkek', '2026-2027''nin en popüler Azerbaycan kız ve erkek isimleri anlamlarıyla: modern, kısa ve nadir isimler, isim seçimi için öneriler.'),
  ('65ea9140-5797-41f3-aafd-a8c2235664c9'::uuid, 'kk', 'Әзербайжан есімдері 2026-2027: танымал есімдер', '2026-2027 жылдардың ең танымал әзербайжан қыз және ұл есімдері мағынасымен: заманауи, қысқа және сирек есімдер, таңдау кеңестері.'),
  ('65ea9140-5797-41f3-aafd-a8c2235664c9'::uuid, 'ru', 'Азербайджанские имена 2026-2027: популярные', 'Самые популярные азербайджанские имена для девочек и мальчиков 2026-2027 со значением: современные, короткие и редкие имена, советы по выбору.'),
  ('65ea9140-5797-41f3-aafd-a8c2235664c9'::uuid, 'uz', 'Ozarbayjon ismlari 2026-2027: eng mashhurlari', '2026-2027 yillarning eng mashhur ozarbayjon qiz va o‘g‘il ismlari ma’nosi bilan: zamonaviy, qisqa va noyob ismlar, tanlash bo‘yicha maslahatlar.'),
  ('65ea9140-5797-41f3-aafd-a8c2235664c9'::uuid, 'en', 'Azerbaijani baby names 2026-2027: most popular', 'The most popular Azerbaijani girl and boy names for 2026-2027 with meanings: modern, short and rare names, plus tips for choosing a name.')
  ) AS v(id, lang, seo_title, seo_description) LOOP
    -- A post on the full editorial schema lists its languages from locales; never add a partial locale there.
    IF EXISTS (SELECT 1 FROM public.blog_posts WHERE id = r.id AND editorial_metadata->>'schema' = 'anacan-blog-editorial-v1'
                AND editorial_metadata->'locales'->r.lang IS NULL) THEN
      RAISE EXCEPTION 'SEO_WEEK1_PARTIAL_LOCALE % %', r.id, r.lang;
    END IF;
    UPDATE public.blog_posts SET editorial_metadata =
        jsonb_set(coalesce(editorial_metadata, '{}'::jsonb) || jsonb_build_object('locales', coalesce(editorial_metadata->'locales', '{}'::jsonb)),
                  ARRAY['locales', r.lang],
                  coalesce(editorial_metadata->'locales'->r.lang, '{}'::jsonb) || jsonb_build_object('seoTitle', r.seo_title, 'seoDescription', r.seo_description)),
        updated_at = now()
     WHERE id = r.id AND is_published;
    IF NOT FOUND THEN RAISE EXCEPTION 'SEO_WEEK1_POST_MISSING %', r.id; END IF;
    n := n + 1;
  END LOOP;
  IF n <> 37 THEN RAISE EXCEPTION 'SEO_WEEK1_COUNT %', n; END IF;
END $m$;
COMMIT;
