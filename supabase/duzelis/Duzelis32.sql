-- ============================================================
-- Duzelis32: Duzelis29-da əlavə olunan "multiples_tip_az" sütununu tətbiqdəki
-- DİGƏR bütün tərcümə olunan sahələrin (baby_message, body_changes və s.)
-- konvensiyasına uyğunlaşdırır: bazasız sütun (AZ) + _en/_ru/_tr/_kk/_de/_ar.
--
-- Niyə? usePregnancyContent.ts-dəki applyLanguage() və admin panelindəki
-- "AI Tərcümə" aləti (translate-content edge function, bax
-- supabase/functions/translate-content/index.ts REGISTRY) məhz bu adlandırma
-- ilə işləyir: `${field}_${lang}`. multiples_tip_az adı ilə saxlasaydıq, bu
-- avtomatik mexanizmlərin heç biri onu tanımayacaqdı.
--
-- Addımlar:
--  1) multiples_tip_az → multiples_tip (mövcuddursa yenidən adlandır, YOXSA
--     sıfırdan yarat — hər iki halda idempotent və sıra-tolerant).
--  2) 6 yeni sütun: multiples_tip_en/ru/tr/kk/de/ar.
--  3) Duzelis29-dakı eyni 12 "mərhələ" üçün 6 dilin hamısında dəqiq tibbi
--     tərcümə (ACOG mənbəyinə əsaslanan, Duzelis29-un AZ mətninin sadiq
--     tərcüməsi — məzmun UYĞUNSUZLUĞU yoxdur, sadəcə dil dəyişir).
--  4) translate-content REGISTRY-yə 'multiples_tip' əlavə olunur (bax aşağıda,
--     kodda edilən dəyişiklik) ki, gələcəkdə admin yeni gün-aralığı üçün AZ
--     mətn yazsa, "AI Tərcümə" düyməsi ilə qalan 6 dilə avtomatik ötürülsün.
--
-- Idempotent — safe to re-run.
-- ============================================================

-- ── 1) Sütun adının konvensiyaya uyğunlaşdırılması ──
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pregnancy_daily_content' AND column_name = 'multiples_tip_az'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pregnancy_daily_content' AND column_name = 'multiples_tip'
  ) THEN
    ALTER TABLE public.pregnancy_daily_content RENAME COLUMN multiples_tip_az TO multiples_tip;
  END IF;
END $$;

-- Duzelis29 hansısa səbəbdən işlədilməyibsə belə (təzə DB), sütun yenə yaransın:
ALTER TABLE public.pregnancy_daily_content ADD COLUMN IF NOT EXISTS multiples_tip TEXT;

-- ── 2) Digər 6 dil sütunu ──
ALTER TABLE public.pregnancy_daily_content ADD COLUMN IF NOT EXISTS multiples_tip_en TEXT;
ALTER TABLE public.pregnancy_daily_content ADD COLUMN IF NOT EXISTS multiples_tip_ru TEXT;
ALTER TABLE public.pregnancy_daily_content ADD COLUMN IF NOT EXISTS multiples_tip_tr TEXT;
ALTER TABLE public.pregnancy_daily_content ADD COLUMN IF NOT EXISTS multiples_tip_kk TEXT;
ALTER TABLE public.pregnancy_daily_content ADD COLUMN IF NOT EXISTS multiples_tip_de TEXT;
ALTER TABLE public.pregnancy_daily_content ADD COLUMN IF NOT EXISTS multiples_tip_ar TEXT;

-- ── 3) Həftə 6-7 (gün 36-49): Xorionluğun təyini ──
UPDATE public.pregnancy_daily_content SET multiples_tip_en = 'The first important step in a twin/multiple pregnancy is determining chorionicity (placenta type): do your babies have separate placentas (dichorionic), or do they share one placenta (monochorionic)? This determines your entire monitoring plan going forward — your doctor should confirm this on an early ultrasound. You can update your chorionicity info in your profile after the scan.'
WHERE pregnancy_day BETWEEN 36 AND 49;
UPDATE public.pregnancy_daily_content SET multiples_tip_ru = 'Первый важный шаг при многоплодной беременности — определение хориальности (типа плаценты): у ваших малышей отдельные плаценты (дихориальная) или общая (монохориальная)? Это определяет весь дальнейший план наблюдения — врач должен уточнить это на раннем УЗИ. Вы можете обновить информацию о хориальности в профиле после УЗИ.'
WHERE pregnancy_day BETWEEN 36 AND 49;
UPDATE public.pregnancy_daily_content SET multiples_tip_tr = 'İkiz/çoğul hamilelikte ilk önemli adım koryonisitenin (plasenta türünün) belirlenmesidir: bebekleriniz ayrı plasentalara mı sahip (dikoryonik), yoksa ortak bir plasentayı mı paylaşıyorlar (monokoryonik)? Bu, bundan sonraki tüm izleme planınızı belirler — doktorunuz bunu erken ultrasonda netleştirmelidir. Koryonisite bilgisini USG''den sonra profil bölümünden güncelleyebilirsiniz.'
WHERE pregnancy_day BETWEEN 36 AND 49;
UPDATE public.pregnancy_daily_content SET multiples_tip_kk = 'Егіз/көп жүктілікте бірінші маңызды қадам — хориондылықты (плацента түрін) анықтау: сәбилеріңіздің әрқайсысының жеке плацентасы бар ма (дихориальді), әлде олар ортақ плацентаны бөлісе ме (монохориальді)? Бұл кейінгі бүкіл бақылау жоспарын анықтайды — дәрігеріңіз мұны ерте УДЗ-де нақтылауы керек. Хориондылық ақпаратын УДЗ-ден кейін профиль бөлімінде жаңарта аласыз.'
WHERE pregnancy_day BETWEEN 36 AND 49;
UPDATE public.pregnancy_daily_content SET multiples_tip_de = 'Der erste wichtige Schritt bei einer Zwillings-/Mehrlingsschwangerschaft ist die Bestimmung der Chorionizität (Plazentaart): Haben Ihre Babys getrennte Plazenten (dichorial) oder teilen sie sich eine gemeinsame Plazenta (monochorial)? Dies bestimmt Ihren gesamten weiteren Überwachungsplan — Ihr Arzt sollte dies bei einer frühen Ultraschalluntersuchung klären. Sie können die Chorionizitäts-Angabe nach dem Ultraschall in Ihrem Profil aktualisieren.'
WHERE pregnancy_day BETWEEN 36 AND 49;
UPDATE public.pregnancy_daily_content SET multiples_tip_ar = 'الخطوة المهمة الأولى في حمل التوأم/المتعدد هي تحديد الكوريونية (نوع المشيمة): هل لدى طفليك مشيمتان منفصلتان (ثنائية الكوريون)، أم يتشاركان مشيمة واحدة (أحادية الكوريون)؟ يحدد هذا خطة المتابعة بأكملها لاحقًا — يجب على طبيبك تأكيد ذلك في فحص الموجات فوق الصوتية المبكر. يمكنك تحديث معلومات الكوريونية في ملفك الشخصي بعد الفحص.'
WHERE pregnancy_day BETWEEN 36 AND 49;

-- ── Həftə 8-9 (gün 50-63): Simptomların daha güclü keçməsi normaldır ──
UPDATE public.pregnancy_daily_content SET multiples_tip_en = 'Morning sickness and breast tenderness tend to be more intense in a multiple pregnancy than a singleton one — this is normal and linked to higher hormone levels. Get enough rest and eat small, frequent meals throughout the day.'
WHERE pregnancy_day BETWEEN 50 AND 63;
UPDATE public.pregnancy_daily_content SET multiples_tip_ru = 'Утренняя тошнота и чувствительность груди при многоплодной беременности обычно выражены сильнее, чем при одноплодной, — это нормально и связано с более высоким уровнем гормонов. Достаточно отдыхайте и ешьте небольшими порциями, но чаще в течение дня.'
WHERE pregnancy_day BETWEEN 50 AND 63;
UPDATE public.pregnancy_daily_content SET multiples_tip_tr = 'Çoğul hamilelikte sabah bulantısı ve göğüs hassasiyeti genellikle tekil hamilelikten daha şiddetli seyreder — bu normaldir ve daha yüksek hormon seviyeleriyle ilişkilidir. Yeterince dinlenin ve gün boyunca az az, sık sık beslenin.'
WHERE pregnancy_day BETWEEN 50 AND 63;
UPDATE public.pregnancy_daily_content SET multiples_tip_kk = 'Көп жүктілікте таңертеңгі жүрек айну мен емшек сезімталдығы әдетте бір нәрестелі жүктілікке қарағанда күштірек өтеді — бұл қалыпты жағдай және гормон деңгейінің жоғарылығымен байланысты. Жеткілікті демалыңыз және күн бойы аз-аздан, жиі тамақтаныңыз.'
WHERE pregnancy_day BETWEEN 50 AND 63;
UPDATE public.pregnancy_daily_content SET multiples_tip_de = 'Morgenübelkeit und Brustempfindlichkeit fallen bei einer Mehrlingsschwangerschaft in der Regel stärker aus als bei einer Einlingsschwangerschaft — das ist normal und hängt mit dem höheren Hormonspiegel zusammen. Ruhen Sie sich ausreichend aus und essen Sie über den Tag verteilt kleine, häufige Mahlzeiten.'
WHERE pregnancy_day BETWEEN 50 AND 63;
UPDATE public.pregnancy_daily_content SET multiples_tip_ar = 'غثيان الصباح وحساسية الثدي عادة ما يكونان أقوى في الحمل المتعدد مقارنة بالحمل بجنين واحد — وهذا أمر طبيعي ومرتبط بارتفاع مستويات الهرمونات. احرصي على الراحة الكافية وتناولي وجبات صغيرة ومتكررة على مدار اليوم.'
WHERE pregnancy_day BETWEEN 50 AND 63;

-- ── Həftə 11-13 (gün 71-91): Skrininq testlərinin dəqiqliyi ──
UPDATE public.pregnancy_daily_content SET multiples_tip_en = 'The blood-based screening tests done around this time (NT/combined test) may not be as accurate in a multiple pregnancy as in a singleton one — even if the result comes back "high risk," it doesn''t necessarily mean either baby has a problem. Additional ultrasound or invasive testing (CVS/amniocentesis) can be discussed with your doctor for a more definitive diagnosis.'
WHERE pregnancy_day BETWEEN 71 AND 91;
UPDATE public.pregnancy_daily_content SET multiples_tip_ru = 'Скрининговые тесты на основе анализа крови, проводимые в этот период (NT/комбинированный тест), могут быть менее точными при многоплодной беременности, чем при одноплодной, — даже если результат показывает «высокий риск», это не обязательно означает проблему у кого-то из малышей. Для более точного диагноза с врачом можно обсудить дополнительное УЗИ или инвазивные тесты (CVS/амниоцентез).'
WHERE pregnancy_day BETWEEN 71 AND 91;
UPDATE public.pregnancy_daily_content SET multiples_tip_tr = 'Bu haftalarda yapılan kan tabanlı taramalar (NT/kombine test) çoğul hamilelikte tekil hamilelikteki kadar kesin olmayabilir — sonuç "yüksek risk" çıksa bile bu, bebeklerden birinde mutlaka sorun olduğu anlamına gelmez. Daha kesin bir tanı için ek ultrason veya invaziv testler (CVS/amniyosentez) doktorunuzla değerlendirilebilir.'
WHERE pregnancy_day BETWEEN 71 AND 91;
UPDATE public.pregnancy_daily_content SET multiples_tip_kk = 'Осы аптада жасалатын қан негізіндегі скринингтер (NT/аралас тест) көп жүктілікте бір нәрестелі жүктілікке қарағанда дәл болмауы мүмкін — нәтиже «жоғары тәуекел» болып шықса да, бұл екі нәрестенің де мәселесі бар дегенді білдірмейді. Дәлірек диагноз үшін қосымша УДЗ немесе инвазивті тесттерді (CVS/амниоцентез) дәрігеріңізбен талқылауға болады.'
WHERE pregnancy_day BETWEEN 71 AND 91;
UPDATE public.pregnancy_daily_content SET multiples_tip_de = 'Die in diesem Zeitraum durchgeführten blutbasierten Screening-Tests (NT/Kombinationstest) sind bei einer Mehrlingsschwangerschaft möglicherweise nicht so genau wie bei einer Einlingsschwangerschaft — selbst wenn das Ergebnis „hohes Risiko" anzeigt, bedeutet das nicht zwangsläufig, dass eines der Babys ein Problem hat. Für eine genauere Diagnose können zusätzlicher Ultraschall oder invasive Tests (CVS/Amniozentese) mit Ihrem Arzt besprochen werden.'
WHERE pregnancy_day BETWEEN 71 AND 91;
UPDATE public.pregnancy_daily_content SET multiples_tip_ar = 'قد لا تكون فحوصات الدم التي تُجرى في هذه الفترة (فحص الشفافية القفوية/الفحص المشترك) دقيقة في الحمل المتعدد بقدر دقتها في الحمل بجنين واحد — حتى لو أظهرت النتيجة «خطورة عالية»، فهذا لا يعني بالضرورة وجود مشكلة لدى أي من الطفلين. يمكن مناقشة إجراء موجات فوق صوتية إضافية أو فحوصات جراحية (CVS/بزل السلى) مع طبيبك للحصول على تشخيص أكثر دقة.'
WHERE pregnancy_day BETWEEN 71 AND 91;

-- ── Həftə 16 (gün 106-112): TTTS monitorinqi ──
UPDATE public.pregnancy_daily_content SET multiples_tip_en = 'If your babies share one placenta (monochorionic), ultrasounds are usually scheduled every 2 weeks from this point on because of the risk of TTTS (twin-to-twin transfusion syndrome). For twins with separate placentas (dichorionic), the frequency may differ — your doctor will set the schedule that''s right for you.'
WHERE pregnancy_day BETWEEN 106 AND 112;
UPDATE public.pregnancy_daily_content SET multiples_tip_ru = 'Если ваши малыши имеют общую плаценту (монохориальные), начиная с этой недели УЗИ обычно назначают каждые 2 недели из-за риска СФФТ (синдрома фето-фетальной трансфузии). У двойни с раздельными плацентами (дихориальные) частота может отличаться — врач составит подходящий именно вам график.'
WHERE pregnancy_day BETWEEN 106 AND 112;
UPDATE public.pregnancy_daily_content SET multiples_tip_tr = 'Bebekleriniz ortak bir plasentayı paylaşıyorsa (monokoryonik), bu haftadan itibaren TTTS (ikizden ikize transfüzyon sendromu) riski nedeniyle ultrasonlar genellikle her 2 haftada bir planlanır. Ayrı plasentalı (dikoryonik) ikizlerde sıklık farklı olabilir — doktorunuz size uygun programı belirleyecektir.'
WHERE pregnancy_day BETWEEN 106 AND 112;
UPDATE public.pregnancy_daily_content SET multiples_tip_kk = 'Егер сәбилеріңіз ортақ плацентаны бөлісетін болса (монохориальді), осы аптадан бастап ТТТС (егіз-егізге трансфузия синдромы) қаупіне байланысты УДЗ әдетте әр 2 аптада бір рет тағайындалады. Жеке плацентасы бар (дихориальді) егіздерде жиілік басқаша болуы мүмкін — дәрігеріңіз сізге қолайлы кестені белгілейді.'
WHERE pregnancy_day BETWEEN 106 AND 112;
UPDATE public.pregnancy_daily_content SET multiples_tip_de = 'Wenn sich Ihre Babys eine Plazenta teilen (monochorial), werden ab dieser Woche in der Regel alle 2 Wochen Ultraschalluntersuchungen angesetzt — wegen des Risikos eines fetofetalen Transfusionssyndroms (TTTS). Bei Zwillingen mit getrennten Plazenten (dichorial) kann die Häufigkeit abweichen — Ihr Arzt legt den für Sie passenden Zeitplan fest.'
WHERE pregnancy_day BETWEEN 106 AND 112;
UPDATE public.pregnancy_daily_content SET multiples_tip_ar = 'إذا كان طفلاك يتشاركان مشيمة واحدة (أحادية الكوريون)، فعادةً ما تُجدول الموجات فوق الصوتية كل أسبوعين ابتداءً من هذا الأسبوع بسبب خطر متلازمة نقل الدم بين التوأمين (TTTS). أما بالنسبة للتوائم ذات المشيمتين المنفصلتين (ثنائية الكوريون)، فقد يختلف التكرار — سيحدد طبيبك الجدول المناسب لحالتك.'
WHERE pregnancy_day BETWEEN 106 AND 112;

-- ── Həftə 18-20 (gün 120-140): Anatomiya USM-si, hər körpənin ayrı izlənməsi ──
UPDATE public.pregnancy_daily_content SET multiples_tip_en = 'At this stage, a detailed anatomy ultrasound is done for each baby, and each baby''s size now starts being tracked SEPARATELY. Small size differences at this stage are completely normal — don''t worry, your doctor will watch the trend over time.'
WHERE pregnancy_day BETWEEN 120 AND 140;
UPDATE public.pregnancy_daily_content SET multiples_tip_ru = 'На этом этапе проводится подробное анатомическое УЗИ каждого малыша, и с этого момента размер каждого ребёнка начинают отслеживать ОТДЕЛЬНО. Небольшие различия в размерах на этом этапе — совершенно нормальное явление, не волнуйтесь: врач будет наблюдать динамику со временем.'
WHERE pregnancy_day BETWEEN 120 AND 140;
UPDATE public.pregnancy_daily_content SET multiples_tip_tr = 'Bu aşamada her bebek için ayrıntılı bir anatomi ultrasonu yapılır ve artık her bebeğin boyu AYRI AYRI takip edilmeye başlanır. Bu aşamada küçük boy farklılıkları tamamen normaldir — endişelenmeyin, doktorunuz zaman içindeki eğilimi izleyecektir.'
WHERE pregnancy_day BETWEEN 120 AND 140;
UPDATE public.pregnancy_daily_content SET multiples_tip_kk = 'Бұл кезеңде әр нәрестеге егжей-тегжейлі анатомиялық УДЗ жасалады және енді әр нәрестенің өлшемі БӨЛЕК бақылана бастайды. Бұл кезеңде шағын өлшем айырмашылықтары мүлдем қалыпты жағдай — уайымдамаңыз, дәрігеріңіз уақыт өте келе үрдісті бақылайтын болады.'
WHERE pregnancy_day BETWEEN 120 AND 140;
UPDATE public.pregnancy_daily_content SET multiples_tip_de = 'In dieser Phase wird für jedes Baby ein detaillierter Anatomie-Ultraschall durchgeführt, und die Größe jedes Babys wird ab jetzt EINZELN verfolgt. Kleine Größenunterschiede sind in dieser Phase völlig normal — keine Sorge, Ihr Arzt beobachtet den Verlauf über die Zeit.'
WHERE pregnancy_day BETWEEN 120 AND 140;
UPDATE public.pregnancy_daily_content SET multiples_tip_ar = 'في هذه المرحلة، يُجرى فحص تشريحي تفصيلي بالموجات فوق الصوتية لكل طفل، ويبدأ الآن تتبع حجم كل طفل بشكل منفصل. تُعد الفروقات الصغيرة في الحجم في هذه المرحلة طبيعية تمامًا — لا داعي للقلق، سيراقب طبيبك الاتجاه العام مع مرور الوقت.'
WHERE pregnancy_day BETWEEN 120 AND 140;

-- ── Həftə 24 (gün 162-168): Yaşayabilirlik həddi + diskordantlıq izləməsi ──
UPDATE public.pregnancy_daily_content SET multiples_tip_en = 'This is an important milestone where your babies reach the threshold of viability. In a multiple pregnancy, the size difference between babies (discordance) is monitored more closely from this point on — it''s usually normal, but a difference of more than 20% may call for additional checks (you can use the Fetal Growth Tracker tool).'
WHERE pregnancy_day BETWEEN 162 AND 168;
UPDATE public.pregnancy_daily_content SET multiples_tip_ru = 'Это важный этап, когда малыши достигают порога жизнеспособности. При многоплодной беременности разница в размерах между детьми (дискордантность) начиная с этого срока отслеживается более тщательно — обычно это нормально, но разница более 20% может потребовать дополнительного обследования (можно воспользоваться инструментом «Трекер роста плода»).'
WHERE pregnancy_day BETWEEN 162 AND 168;
UPDATE public.pregnancy_daily_content SET multiples_tip_tr = 'Bu, bebeklerin canlı kalabilirlik eşiğine ulaştığı önemli bir aşamadır. Çoğul hamilelikte bebekler arasındaki boy farkı (diskordans) bu aşamadan itibaren daha yakından izlenir — genellikle normaldir, ancak %20''den fazla fark ek kontrol gerektirebilir (Fetal Büyüme Takip aracını kullanabilirsiniz).'
WHERE pregnancy_day BETWEEN 162 AND 168;
UPDATE public.pregnancy_daily_content SET multiples_tip_kk = 'Бұл нәрестелердің тіршілік ету қабілеті шегіне жеткен маңызды кезең. Көп жүктілікте нәрестелер арасындағы өлшем айырмашылығы (дискордантылық) осы кезеңнен бастап мұқият бақыланады — әдетте бұл қалыпты жағдай, бірақ 20%-дан асатын айырмашылық қосымша тексеруді талап етуі мүмкін (Ұрықтың Өсу Трекері құралын пайдалана аласыз).'
WHERE pregnancy_day BETWEEN 162 AND 168;
UPDATE public.pregnancy_daily_content SET multiples_tip_de = 'Dies ist ein wichtiger Meilenstein, an dem Ihre Babys die Schwelle der Lebensfähigkeit erreichen. Bei einer Mehrlingsschwangerschaft wird der Größenunterschied zwischen den Babys (Diskordanz) ab jetzt genauer beobachtet — meist ist das normal, aber ein Unterschied von mehr als 20 % kann zusätzliche Untersuchungen erforderlich machen (Sie können das Fetales-Wachstum-Tracker-Tool nutzen).'
WHERE pregnancy_day BETWEEN 162 AND 168;
UPDATE public.pregnancy_daily_content SET multiples_tip_ar = 'هذه مرحلة مهمة يصل فيها الأطفال إلى عتبة القدرة على الحياة خارج الرحم. في الحمل المتعدد، يُراقب الفرق في الحجم بين الأطفال (التفاوت) عن كثب بدءًا من هذه المرحلة — وعادة ما يكون طبيعيًا، لكن الفرق الذي يتجاوز 20٪ قد يستدعي فحوصات إضافية (يمكنك استخدام أداة متتبع نمو الجنين).'
WHERE pregnancy_day BETWEEN 162 AND 168;

-- ── Həftə 28 (gün 190-196): 3-cü trimester, GDM/preeklampsiya riski ──
UPDATE public.pregnancy_daily_content SET multiples_tip_en = 'Your third trimester begins. In a multiple pregnancy, the risk of gestational diabetes and preeclampsia (high blood pressure) is higher than in a singleton pregnancy and can typically start earlier — your doctor visits will now become more frequent, which is completely expected and not a cause for worry.'
WHERE pregnancy_day BETWEEN 190 AND 196;
UPDATE public.pregnancy_daily_content SET multiples_tip_ru = 'Начинается третий триместр. При многоплодной беременности риск гестационного диабета и преэклампсии (высокого артериального давления) выше, чем при одноплодной, и обычно может проявиться раньше — визиты к врачу теперь будут чаще, это совершенно ожидаемо и не повод для беспокойства.'
WHERE pregnancy_day BETWEEN 190 AND 196;
UPDATE public.pregnancy_daily_content SET multiples_tip_tr = 'Üçüncü trimesteriniz başlıyor. Çoğul hamilelikte gestasyonel diyabet ve preeklampsi (yüksek tansiyon) riski tekil hamilelikten daha yüksektir ve genellikle daha erken başlayabilir — doktor kontrolleriniz artık daha sık olacak, bu tamamen beklenen bir durumdur, endişelenmenize gerek yok.'
WHERE pregnancy_day BETWEEN 190 AND 196;
UPDATE public.pregnancy_daily_content SET multiples_tip_kk = 'Үшінші триместріңіз басталады. Көп жүктілікте гестациялық диабет пен преэклампсия (жоғары қан қысымы) қаупі бір нәрестелі жүктілікке қарағанда жоғары және әдетте ертерек басталуы мүмкін — дәрігерге баруларыңыз енді жиірек болады, бұл толығымен күтілетін жағдай, алаңдаушылыққа себеп емес.'
WHERE pregnancy_day BETWEEN 190 AND 196;
UPDATE public.pregnancy_daily_content SET multiples_tip_de = 'Ihr drittes Trimester beginnt. Bei einer Mehrlingsschwangerschaft ist das Risiko für Schwangerschaftsdiabetes und Präeklampsie (Bluthochdruck) höher als bei einer Einlingsschwangerschaft und kann in der Regel früher einsetzen — Ihre Arztbesuche werden jetzt häufiger, was völlig normal ist und kein Grund zur Sorge.'
WHERE pregnancy_day BETWEEN 190 AND 196;
UPDATE public.pregnancy_daily_content SET multiples_tip_ar = 'تبدأ ثلثك الثالث. في الحمل المتعدد، يكون خطر سكري الحمل وتسمم الحمل (ارتفاع ضغط الدم) أعلى منه في الحمل بجنين واحد وقد يبدأ عادةً بشكل أبكر — ستصبح زيارات طبيبك الآن أكثر تكرارًا، وهذا أمر متوقع تمامًا وليس سببًا للقلق.'
WHERE pregnancy_day BETWEEN 190 AND 196;

-- ── Həftə 30-32 (gün 204-224): Qidalanma, idman, böyümə USM-ləri ──
UPDATE public.pregnancy_daily_content SET multiples_tip_en = 'You need roughly an extra 300 kcal per day for each baby (about ~600 extra kcal total for twins) — make sure these calories come from nutritious food. Avoid intense exercise; gentle activities like walking, swimming, or prenatal yoga are more suitable. Growth ultrasounds may now become more frequent.'
WHERE pregnancy_day BETWEEN 204 AND 224;
UPDATE public.pregnancy_daily_content SET multiples_tip_ru = 'Вам необходимо примерно на 300 ккал в день больше на каждого малыша (в сумме около ~600 ккал дополнительно при двойне) — пусть эти калории поступают из качественной пищи. Избегайте интенсивных физических нагрузок; более подходящими будут щадящие виды активности — прогулки, плавание, пренатальная йога. УЗИ для контроля роста теперь могут проводиться чаще.'
WHERE pregnancy_day BETWEEN 204 AND 224;
UPDATE public.pregnancy_daily_content SET multiples_tip_tr = 'Her bebek için günde yaklaşık ek 300 kkal''ye ihtiyacınız var (ikizde toplamda ~600 kkal ek) — bu kalorilerin kaliteli besinlerden gelmesine dikkat edin. Yoğun egzersizden kaçının; yürüyüş, yüzme veya doğum öncesi yoga gibi hafif aktiviteler daha uygundur. Büyüme ultrasonları artık daha sık yapılabilir.'
WHERE pregnancy_day BETWEEN 204 AND 224;
UPDATE public.pregnancy_daily_content SET multiples_tip_kk = 'Әр нәресте үшін күніне шамамен қосымша 300 ккал қажет (егізде жалпы ~600 ккал қосымша) — бұл калориялар сапалы тағамдардан келсін. Қарқынды жаттығулардан аулақ болыңыз; серуендеу, жүзу немесе перинаталды йога сияқты жеңіл әрекеттер қолайлырақ. Өсу УДЗ-лері енді жиірек болуы мүмкін.'
WHERE pregnancy_day BETWEEN 204 AND 224;
UPDATE public.pregnancy_daily_content SET multiples_tip_de = 'Sie benötigen pro Baby täglich etwa 300 kcal zusätzlich (bei Zwillingen insgesamt ca. 600 kcal mehr) — achten Sie darauf, dass diese Kalorien aus nährstoffreichen Lebensmitteln stammen. Vermeiden Sie intensiven Sport; sanftere Aktivitäten wie Spazierengehen, Schwimmen oder Schwangerschaftsyoga sind besser geeignet. Wachstums-Ultraschalluntersuchungen können jetzt häufiger stattfinden.'
WHERE pregnancy_day BETWEEN 204 AND 224;
UPDATE public.pregnancy_daily_content SET multiples_tip_ar = 'تحتاجين تقريبًا إلى 300 سعرة حرارية إضافية يوميًا لكل طفل (حوالي 600 سعرة حرارية إضافية إجمالاً للتوأم) — احرصي على أن تأتي هذه السعرات من أطعمة مغذية. تجنبي التمارين المكثفة؛ الأنشطة الخفيفة مثل المشي والسباحة ويوغا الحمل أكثر ملاءمة. قد تصبح فحوصات النمو بالموجات فوق الصوتية أكثر تكرارًا الآن.'
WHERE pregnancy_day BETWEEN 204 AND 224;

-- ── Həftə 34 (gün 232-238): Doğuş planlaşdırılması, artan monitorinq ──
UPDATE public.pregnancy_daily_content SET multiples_tip_en = 'Delivery planning conversations may begin at this stage — the likelihood of a C-section is higher for multiple births than for a singleton, but a vaginal delivery is also possible depending on the babies'' number, position, and health. Monitoring frequency continues to increase.'
WHERE pregnancy_day BETWEEN 232 AND 238;
UPDATE public.pregnancy_daily_content SET multiples_tip_ru = 'На этом этапе могут начаться разговоры о планировании родов — вероятность кесарева сечения при многоплодных родах выше, чем при одноплодных, но естественные роды тоже возможны в зависимости от количества, положения и состояния здоровья малышей. Частота наблюдения продолжает увеличиваться.'
WHERE pregnancy_day BETWEEN 232 AND 238;
UPDATE public.pregnancy_daily_content SET multiples_tip_tr = 'Doğum planlama konuşmaları bu aşamada başlayabilir — çoğul doğumlarda sezaryen olasılığı tekil hamilelikten yüksektir, ancak bebeklerin sayısına, pozisyonuna ve sağlığına bağlı olarak normal doğum da mümkündür. İzleme sıklığı artmaya devam ediyor.'
WHERE pregnancy_day BETWEEN 232 AND 238;
UPDATE public.pregnancy_daily_content SET multiples_tip_kk = 'Босану жоспарлау әңгімелері осы кезеңде басталуы мүмкін — көп нәрестелі босануларда кесарев тілігінің ықтималдығы бір нәрестелі жүктілікке қарағанда жоғары, бірақ нәрестелердің саны, орналасуы және денсаулығына байланысты табиғи босану да мүмкін. Бақылау жиілігі артуын жалғастырады.'
WHERE pregnancy_day BETWEEN 232 AND 238;
UPDATE public.pregnancy_daily_content SET multiples_tip_de = 'Gespräche zur Geburtsplanung können in dieser Phase beginnen — bei Mehrlingsgeburten ist die Wahrscheinlichkeit eines Kaiserschnitts höher als bei einer Einlingsgeburt, aber je nach Anzahl, Lage und Gesundheitszustand der Babys ist auch eine vaginale Geburt möglich. Die Überwachungsfrequenz nimmt weiter zu.'
WHERE pregnancy_day BETWEEN 232 AND 238;
UPDATE public.pregnancy_daily_content SET multiples_tip_ar = 'قد تبدأ محادثات التخطيط للولادة في هذه المرحلة — احتمال الولادة القيصرية في الولادات المتعددة أعلى منه في الحمل بجنين واحد، لكن الولادة الطبيعية ممكنة أيضًا حسب عدد الأطفال ووضعيتهم وصحتهم. يستمر تكرار المراقبة في الازدياد.'
WHERE pregnancy_day BETWEEN 232 AND 238;

-- ── Həftə 36 (gün 246-252): Çoxu əkiz doğuşu bu ətrafda baş verir ──
UPDATE public.pregnancy_daily_content SET multiples_tip_en = 'Note: most uncomplicated twin pregnancies deliver between weeks 36-37 — this is earlier than the 40 weeks of a singleton pregnancy and is considered COMPLETELY NORMAL, not a problem. You can pack your hospital bag now.'
WHERE pregnancy_day BETWEEN 246 AND 252;
UPDATE public.pregnancy_daily_content SET multiples_tip_ru = 'Обратите внимание: большинство неосложнённых беременностей двойней завершаются родами на 36-37 неделе — это раньше, чем 40 недель при одноплодной беременности, и считается АБСОЛЮТНО НОРМАЛЬНЫМ, а не проблемой. Уже сейчас можно собрать сумку в роддом.'
WHERE pregnancy_day BETWEEN 246 AND 252;
UPDATE public.pregnancy_daily_content SET multiples_tip_tr = 'Dikkat: komplikasyonsuz ikiz hamileliklerin çoğu 36-37. haftalar arasında doğumla sonuçlanır — bu, tekil hamilelikteki 40 haftadan daha erkendir ve TAMAMEN NORMAL kabul edilir, bir sorun değildir. Hastane çantanızı şimdiden hazırlayabilirsiniz.'
WHERE pregnancy_day BETWEEN 246 AND 252;
UPDATE public.pregnancy_daily_content SET multiples_tip_kk = 'Назар аударыңыз: асқынусыз егіз жүктіліктердің көпшілігі 36-37-ші аптада босанумен аяқталады — бұл бір нәрестелі жүктіліктегі 40 аптадан ертерек және мүлдем ҚАЛЫПТЫ жағдай саналады, мәселе емес. Аурухана сөмкеңізді қазірден дайындай аласыз.'
WHERE pregnancy_day BETWEEN 246 AND 252;
UPDATE public.pregnancy_daily_content SET multiples_tip_de = 'Hinweis: Die meisten unkomplizierten Zwillingsschwangerschaften enden zwischen der 36. und 37. Woche mit der Geburt — das ist früher als die 40 Wochen bei einer Einlingsschwangerschaft und gilt als VÖLLIG NORMAL, kein Problem. Sie können Ihre Kliniktasche jetzt packen.'
WHERE pregnancy_day BETWEEN 246 AND 252;
UPDATE public.pregnancy_daily_content SET multiples_tip_ar = 'ملاحظة: تنتهي معظم حالات حمل التوأم غير المعقدة بالولادة بين الأسبوعين 36-37 — وهذا أبكر من الأسابيع الأربعين في الحمل بجنين واحد، ويُعتبر أمرًا طبيعيًا تمامًا وليس مشكلة. يمكنك الآن تحضير حقيبة المستشفى.'
WHERE pregnancy_day BETWEEN 246 AND 252;

-- ── Həftə 37-38 (gün 253-266): Əkizlər üçün "tam vaxtında" mərhələ ──
UPDATE public.pregnancy_daily_content SET multiples_tip_en = 'For a twin pregnancy, this stage is now considered "full-term" — the 40-week concept from a singleton pregnancy doesn''t directly apply to twins. Labor can begin at any time; confirm your final plan with your doctor.'
WHERE pregnancy_day BETWEEN 253 AND 266;
UPDATE public.pregnancy_daily_content SET multiples_tip_ru = 'Для беременности двойней этот срок уже считается «доношенным» — понятие 40 недель из одноплодной беременности напрямую не применимо к двойне. Роды могут начаться в любой момент — уточните окончательный план с врачом.'
WHERE pregnancy_day BETWEEN 253 AND 266;
UPDATE public.pregnancy_daily_content SET multiples_tip_tr = 'İkiz hamilelik için bu aşama artık "miadında" (full-term) sayılır — tekil hamilelikteki 40 hafta kavramı ikizlere doğrudan uygulanmaz. Doğum her an başlayabilir; son planınızı doktorunuzla netleştirin.'
WHERE pregnancy_day BETWEEN 253 AND 266;
UPDATE public.pregnancy_daily_content SET multiples_tip_kk = 'Егіз жүктілік үшін бұл кезең енді «мерзімінде» (толық мерзімді) деп саналады — бір нәрестелі жүктіліктегі 40 апта ұғымы егіздерге тікелей қолданылмайды. Босану кез келген уақытта басталуы мүмкін; соңғы жоспарды дәрігеріңізбен нақтылаңыз.'
WHERE pregnancy_day BETWEEN 253 AND 266;
UPDATE public.pregnancy_daily_content SET multiples_tip_de = 'Bei einer Zwillingsschwangerschaft gilt dieses Stadium bereits als „termingerecht" (full-term) — das 40-Wochen-Konzept einer Einlingsschwangerschaft lässt sich nicht direkt auf Zwillinge übertragen. Die Geburt kann jederzeit beginnen; besprechen Sie den endgültigen Plan mit Ihrem Arzt.'
WHERE pregnancy_day BETWEEN 253 AND 266;
UPDATE public.pregnancy_daily_content SET multiples_tip_ar = 'بالنسبة لحمل التوأم، تُعتبر هذه المرحلة الآن "مكتملة المدة" — لا ينطبق مفهوم الأربعين أسبوعًا الخاص بالحمل بجنين واحد مباشرة على التوائم. يمكن أن تبدأ الولادة في أي وقت؛ أكدي خطتك النهائية مع طبيبك.'
WHERE pregnancy_day BETWEEN 253 AND 266;

-- ── Həftə 39+ (gün 267-294): Əmizdirmə hazırlığı + doğuşdansonrakı depressiya ──
UPDATE public.pregnancy_daily_content SET multiples_tip_en = 'Breastfeeding twins is entirely possible, it just takes a bit of practice — your milk supply will adjust to meet both babies'' needs. The risk of postpartum depression is somewhat higher after a multiple birth — if you feel persistently tired, anxious, or sad, don''t hesitate to share this with your partner or your doctor.'
WHERE pregnancy_day BETWEEN 267 AND 294;
UPDATE public.pregnancy_daily_content SET multiples_tip_ru = 'Кормить грудью двойню вполне возможно, это просто требует немного практики — количество молока подстроится под потребности обоих малышей. Риск послеродовой депрессии после многоплодных родов несколько выше — если вы постоянно чувствуете усталость, тревогу или грусть, не стесняйтесь поделиться этим с партнёром или врачом.'
WHERE pregnancy_day BETWEEN 267 AND 294;
UPDATE public.pregnancy_daily_content SET multiples_tip_tr = 'İkizleri emzirmek tamamen mümkündür, sadece biraz pratik gerektirir — süt üretiminiz her iki bebeğin ihtiyacına göre ayarlanacaktır. Çoğul doğum sonrası doğum sonrası depresyon riski biraz daha yüksektir — kendinizi sürekli yorgun, kaygılı veya üzgün hissediyorsanız, bunu partnerinizle veya doktorunuzla paylaşmaktan çekinmeyin.'
WHERE pregnancy_day BETWEEN 267 AND 294;
UPDATE public.pregnancy_daily_content SET multiples_tip_kk = 'Егіздерді емізу толығымен мүмкін, тек аздап тәжірибе қажет — сүт қорыңыз екі нәрестенің де қажеттілігіне сай бейімделеді. Көп нәрестелі босанудан кейін босанудан кейінгі депрессия қаупі біршама жоғары — өзіңізді үнемі шаршаған, мазасыз немесе қайғылы сезінсеңіз, мұны серіктесіңізбен немесе дәрігеріңізбен бөлісуден тартынбаңыз.'
WHERE pregnancy_day BETWEEN 267 AND 294;
UPDATE public.pregnancy_daily_content SET multiples_tip_de = 'Zwillinge zu stillen ist durchaus möglich, es erfordert nur etwas Übung — Ihre Milchproduktion passt sich an den Bedarf beider Babys an. Das Risiko einer postpartalen Depression ist nach einer Mehrlingsgeburt etwas erhöht — wenn Sie sich anhaltend müde, ängstlich oder traurig fühlen, zögern Sie nicht, dies mit Ihrem Partner oder Ihrem Arzt zu besprechen.'
WHERE pregnancy_day BETWEEN 267 AND 294;
UPDATE public.pregnancy_daily_content SET multiples_tip_ar = 'إرضاع التوأم رضاعة طبيعية أمر ممكن تمامًا، ويتطلب فقط القليل من الممارسة — سيتكيف إدرار الحليب لديك لتلبية احتياجات كلا الطفلين. يكون خطر اكتئاب ما بعد الولادة أعلى قليلاً بعد الولادة المتعددة — إذا شعرتِ بالتعب أو القلق أو الحزن بشكل مستمر، فلا تترددي في مشاركة ذلك مع شريكك أو طبيبك.'
WHERE pregnancy_day BETWEEN 267 AND 294;
