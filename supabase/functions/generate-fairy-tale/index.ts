import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireUser } from "../_shared/auth.ts";
import { callGeminiSmart } from "../_shared/vertex-ai.ts";
import { isExpandedLanguage, outputLanguageRule } from '../_shared/languages.ts';
import { checkAndConsumeServerSide, limitExceededResponse } from "../_shared/usage-limit.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const AGE_GUIDELINES: Record<string, { az: string; en: string; ru: string; tr: string; kk: string; uz: string; ka: string; de: string; ar: string }> = {
  '0-2': {
    az: 'Çox sadə cümlələr (3-5 söz). Təkrarlanan ifadələr. Heyvan səsləri. Rənglər və formalar. Nağıl 1-2 dəqiqəlik olsun.',
    en: 'Very simple sentences (3-5 words). Repetitive phrases. Animal sounds. Colors and shapes. Story should be 1-2 minutes.',
    ru: 'Очень простые предложения (3-5 слов). Повторяющиеся фразы. Звуки животных. Цвета и формы. Сказка на 1-2 минуты.',
    tr: 'Çok basit cümleler (3-5 kelime). Tekrarlanan ifadeler. Hayvan sesleri. Renkler ve şekiller. Masal 1-2 dakika olsun.',
    kk: 'Өте қарапайым сөйлемдер (3-5 сөз). Қайталанатын тіркестер. Жануарлардың дыбыстары. Түстер мен пішіндер. Ертегі 1-2 минутқа созылсын.',
    uz: 'Juda sodda gaplar (3-5 soʻz). Takrorlanuvchi iboralar. Hayvon tovushlari. Ranglar va shakllar. Ertak 1-2 daqiqalik boʻlsin.',
    ka: 'ძალიან მარტივი წინადადებები (3-5 სიტყვა). განმეორებადი ფრაზები. ცხოველების ხმები. ფერები და ფორმები. ზღაპარი 1-2 წუთიანი იყოს.',
    de: 'Sehr einfache Sätze (3–5 Wörter). Wiederkehrende Formulierungen. Tierlaute. Farben und Formen. Das Märchen sollte 1–2 Minuten lang sein.',
    ar: 'جمل بسيطة جدًا (٣-٥ كلمات). عبارات متكررة. أصوات الحيوانات. الألوان والأشكال. مدة الحكاية من دقيقة إلى دقيقتين.',
  },
  '3-5': {
    az: 'Sadə amma məzmunlu cümlələr. Dialoqlar olsun. Əyləncəli hadisələr. Tərbiyəvi mesaj aydın olsun. 3-4 dəqiqəlik nağıl.',
    en: 'Simple but meaningful sentences. Include dialogues. Fun events. Clear moral message. 3-4 minute story.',
    ru: 'Простые, но содержательные предложения. Диалоги. Весёлые события. Ясный воспитательный посыл. Сказка на 3-4 минуты.',
    tr: 'Basit ama anlamlı cümleler. Diyaloglar olsun. Eğlenceli olaylar. Net eğitici mesaj. 3-4 dakikalık masal.',
    kk: 'Қарапайым, бірақ мағыналы сөйлемдер. Диалогтар болсын. Қызықты оқиғалар. Тәрбиелік ойы анық болсын. Ертегі 3-4 минутқа созылсын.',
    uz: 'Sodda, ammo mazmunli gaplar. Dialoglar boʻlsin. Qiziqarli voqealar. Tarbiyaviy gʻoya aniq boʻlsin. Ertak 3-4 daqiqalik boʻlsin.',
    ka: 'მარტივი, მაგრამ შინაარსიანი წინადადებები. იყოს დიალოგები. სახალისო მოვლენები. აღმზრდელობითი გზავნილი ნათელი იყოს. 3-4 წუთიანი ზღაპარი.',
    de: 'Einfache, aber aussagekräftige Sätze. Mit Dialogen. Unterhaltsame Ereignisse. Die pädagogische Botschaft sollte klar sein. Ein 3–4-minütiges Märchen.',
    ar: 'جمل بسيطة وذات معنى. تضمين حوارات وأحداث ممتعة. يجب أن تكون الرسالة التربوية واضحة. مدة الحكاية من ٣ إلى ٤ دقائق.',
  },
  '6-9': {
    az: 'Daha mürəkkəb süjet xətti. Problemin həlli prosesi göstərilsin. Uşağın düşünməsinə kömək edən suallar. 4-6 dəqiqəlik nağıl.',
    en: 'More complex plot. Show problem-solving process. Questions that help the child think. 4-6 minute story.',
    ru: 'Более сложный сюжет. Показать процесс решения проблем. Вопросы для размышления. Сказка на 4-6 минут.',
    tr: 'Daha karmaşık olay örgüsü. Problem çözme süreci gösterilsin. Çocuğun düşünmesine yardımcı sorular. 4-6 dakikalık masal.',
    kk: 'Күрделірек оқиға желісі. Мәселені шешу үдерісі көрсетілсін. Баланың ойлануына көмектесетін сұрақтар. Ертегі 4-6 минутқа созылсын.',
    uz: 'Murakkabroq syujet chizigʻi. Muammoni hal qilish jarayoni koʻrsatilsin. Bolani oʻylashga undaydigan savollar. Ertak 4-6 daqiqalik boʻlsin.',
    ka: 'უფრო რთული სიუჟეტური ხაზი. ნაჩვენები იყოს პრობლემის გადაჭრის პროცესი. კითხვები, რომლებიც ბავშვს დაფიქრებაში ეხმარება. 4-6 წუთიანი ზღაპარი.',
    de: 'Eine komplexere Handlung. Zeige den Prozess der Problemlösung. Fragen, die das Kind zum Nachdenken anregen. Ein 4–6-minütiges Märchen.',
    ar: 'حبكة أكثر تعقيدًا. توضيح عملية حل المشكلة. أسئلة تساعد الطفل على التفكير. مدة الحكاية من ٤ إلى ٦ دقائق.',
  },
  '10-12': {
    az: 'Zəngin süjet. Əxlaqi dilemma və seçimlər. Emosional dərinlik. Daha uzun dialoqlar. 5-7 dəqiqəlik nağıl.',
    en: 'Rich plot. Moral dilemmas and choices. Emotional depth. Longer dialogues. 5-7 minute story.',
    ru: 'Богатый сюжет. Моральные дилеммы и выбор. Эмоциональная глубина. Длинные диалоги. Сказка на 5-7 минут.',
    tr: 'Zengin olay örgüsü. Ahlaki ikilemler ve seçimler. Duygusal derinlik. Daha uzun diyaloglar. 5-7 dakikalık masal.',
    kk: 'Мазмұнды оқиға желісі. Моральдық дилеммалар мен таңдау. Эмоциялық тереңдік. Ұзағырақ диалогтар. Ертегі 5-7 минутқа созылсын.',
    uz: 'Boy syujet. Axloqiy dilemmalar va tanlovlar. Hissiy teranlik. Uzunroq dialoglar. Ertak 5-7 daqiqalik boʻlsin.',
    ka: 'მდიდარი სიუჟეტი. მორალური დილემები და არჩევანი. ემოციური სიღრმე. უფრო გრძელი დიალოგები. 5-7 წუთიანი ზღაპარი.',
    de: 'Eine vielschichtige Handlung. Moralische Dilemmas und Entscheidungen. Emotionale Tiefe. Längere Dialoge. Ein 5–7-minütiges Märchen.',
    ar: 'حبكة غنية. معضلة أخلاقية وخيارات. عمق عاطفي. حوارات أطول. مدة الحكاية من ٥ إلى ٧ دقائق.',
  },
};

const getSystemPrompt = (language: string, childName: string, ageRange?: string) => {
  if (isExpandedLanguage(language)) return `${getSystemPrompt('en', childName, ageRange)}\n\n${outputLanguageRule(language)}`;
  const ageGuide = ageRange && AGE_GUIDELINES[ageRange] 
    ? AGE_GUIDELINES[ageRange][language as keyof typeof AGE_GUIDELINES['0-2']] || AGE_GUIDELINES[ageRange]['az']
    : '';
  const ageInstruction = ageGuide ? `\n\nYAŞ QRUPUNA UYĞUN YAZMA QAYDALARI:\n${ageGuide}` : '';

  switch (language) {
    case 'en':
      return `You are an award-winning children's book author. Write a professionally crafted, engaging story for children that follows classic fairy tale structure with logical plot development.

CRITICAL QUALITY RULES:
1. The child's name is "${childName}". ALWAYS use this exact name as the main character.
2. The story MUST have a clear beginning, middle, and end with LOGICAL cause-and-effect progression.
3. Every event must have a REASON — no random magical solutions or deus ex machina.
4. Characters must have consistent personalities and motivations.
5. The moral lesson should emerge NATURALLY from the story events, not be stated artificially.
6. Use vivid sensory descriptions (sights, sounds, smells) to make scenes come alive.
7. Include meaningful dialogue that reveals character personality.
8. The conflict/problem must be resolved through the character's own effort, cleverness, or growth.
9. NO clichés like "and they lived happily ever after" — write a specific, satisfying conclusion.
10. NO exaggerated or unrealistic descriptions. Keep the tone warm but grounded.

FORBIDDEN:
- Generic phrases like "little friend", "magical being" without a proper name
- Random magical solutions without setup
- Preachy moral lectures
- Overly sweet, saccharine language
- Plot holes or illogical sequences

Story structure:
1. Title: "${childName}'s [Specific Adventure]"
2. Setting establishment (WHERE and WHEN, with sensory details)
3. Character introduction with personality
4. Problem/challenge introduction (logical, relatable)
5. Rising action with 2-3 attempts/obstacles
6. Climax where the character grows or learns
7. Resolution that follows logically from events
8. Satisfying ending with natural moral takeaway${ageInstruction}

Format: Return title on first line, then story content. Use paragraphs, not bullet points.`;

    case 'ru':
      return `Ты — известный детский писатель-сказочник. Напиши профессиональную, увлекательную сказку с логичным развитием сюжета.

КРИТИЧЕСКИЕ ПРАВИЛА КАЧЕСТВА:
1. Имя ребёнка — "${childName}". ВСЕГДА используй именно это имя для главного героя.
2. Сказка ДОЛЖНА иметь чёткое начало, середину и конец с ЛОГИЧНОЙ причинно-следственной связью.
3. Каждое событие должно иметь ПРИЧИНУ — никаких случайных магических решений.
4. Персонажи должны иметь последовательные характеры и мотивации.
5. Мораль должна вытекать ЕСТЕСТВЕННО из событий, а не навязываться.
6. Используй яркие сенсорные описания (зрение, звуки, запахи).
7. Включай осмысленные диалоги, раскрывающие характер персонажа.
8. Конфликт должен решаться через усилия, находчивость или рост героя.
9. НЕТ клише типа "и жили они долго и счастливо" — напиши конкретный, удовлетворяющий финал.
10. НЕТ преувеличенных описаний. Тон тёплый, но реалистичный.

ЗАПРЕЩЕНО:
- Безымянные "маленькие друзья"
- Случайные магические решения
- Морализаторские лекции
- Слащавый язык
- Дыры в сюжете

Структура:
1. Заголовок: "Приключение ${childName}" или "${childName} и [что-то]"
2. Описание обстановки (ГДЕ и КОГДА)
3. Знакомство с персонажем
4. Проблема/вызов
5. 2-3 попытки/препятствия
6. Кульминация с ростом героя
7. Логичная развязка
8. Удовлетворительный финал${ageInstruction}

Формат: Заголовок первой строкой, затем текст сказки.`;

    case 'tr':
      return `Sen ödüllü bir çocuk kitabı yazarısın. Mantıklı olay örgüsü ve profesyonel anlatımla çocuklar için etkileyici bir masal yaz.

KRİTİK KALİTE KURALLARI:
1. Çocuğun adı "${childName}". Ana karakter olarak HER ZAMAN bu adı kullan.
2. Masalın net bir başlangıcı, ortası ve sonu OLMALI ve MANTIKLI neden-sonuç ilişkisi içermeli.
3. Her olayın bir SEBEBİ olmalı — rastgele sihirli çözümler YOK.
4. Karakterlerin tutarlı kişilikleri ve motivasyonları olmalı.
5. Ahlaki ders olaylardan DOĞAL olarak çıkmalı, yapay olmamalı.
6. Canlı duyusal betimlemeler kullan (görüntüler, sesler, kokular).
7. Karakter kişiliğini ortaya koyan anlamlı diyaloglar ekle.
8. Çatışma, karakterin kendi çabası veya gelişimiyle çözülmeli.
9. "Sonsuza dek mutlu yaşadılar" gibi klişeler YOK — özgün bir sonuç yaz.
10. Abartılı betimlemeler YOK. Sıcak ama gerçekçi ton.

YASAK:
- İsimsiz "küçük dost" gibi ifadeler
- Rastgele sihirli çözümler
- Vaaz tarzı ahlak dersleri
- Aşırı tatlı dil
- Olay örgüsü boşlukları

Yapı:
1. Başlık: "${childName}'in [Macera Adı]"
2. Mekan tanıtımı (NEREDE ve NE ZAMAN)
3. Karakter tanıtımı
4. Problem/meydan okuma
5. 2-3 deneme/engel
6. Doruk noktası
7. Mantıklı çözüm
8. Tatmin edici son${ageInstruction}

Format: İlk satırda başlık, sonra masal metni.`;

    case 'ar':
      return `أنت مؤلف حائز على جوائز في أدب الأطفال. اكتب حكاية ممتعة وعالية الجودة للأطفال، تتميز بتطور منطقي للحبكة وأسلوب سرد احترافي.

قواعد الجودة الأساسية:
1. اسم الطفل هو "${childName}". استخدم هذا الاسم دائمًا للشخصية الرئيسية.
2. يجب أن يكون للحكاية بداية ووسط ونهاية واضحة، وأن تتضمن علاقات منطقية بين الأسباب والنتائج.
3. يجب أن يكون لكل حدث سبب — ويُمنع استخدام حلول سحرية عشوائية.
4. يجب أن تتمتع الشخصيات بصفات ودوافع متسقة.
5. يجب أن تنبثق الرسالة التربوية من الأحداث بصورة طبيعية — من دون وعظ مصطنع.
6. استخدم لغة حيوية ووصفية تتناول الألوان والأصوات والروائح.
7. أدرج حوارات هادفة تكشف عن طباع الشخصيات.
8. يجب أن تُحل المشكلة بجهد البطل أو ذكائه أو تطوره الشخصي.
9. تُمنع النهايات المبتذلة مثل "وعاشوا بسعادة" — اكتب نهاية محددة ومُرضية.
10. تُمنع الأوصاف المبالغ فيها. حافظ على نبرة دافئة وواقعية.

يُمنع ما يلي:
- عبارات مثل "الصديق الصغير" أو "الكائن السحري" من دون أسماء
- الحلول السحرية العشوائية
- الدروس الأخلاقية الوعظية
- اللغة المصطنعة والمفرطة في التحبب
- فجوات الحبكة أو تسلسل الأحداث غير المنطقي

بنية الحكاية:
1. العنوان بصيغة "${childName} و[شيء ما]"
2. وصف المكان (أين ومتى، مع تفاصيل حسية)
3. تقديم الشخصيات (مع صفاتها الشخصية)
4. المشكلة/التحدي (منطقي ويمكن للطفل فهمه)
5. محاولتان أو ٣ محاولات/عقبات (تزداد صعوبة)
6. الذروة — تطور البطل أو تعلّمه
7. حل ينبثق منطقيًا من الأحداث
8. نهاية مُرضية ونتيجة تربوية طبيعية${ageInstruction}

التنسيق: اكتب العنوان في السطر الأول، ثم نص الحكاية. استخدم فقرات لا قوائم. يجب أن تكون الحكاية باللغة العربية الفصحى.`;

    case 'de':
      return `Du bist ein preisgekrönter Kinderbuchautor. Schreibe ein spannendes, hochwertiges Märchen für Kinder mit logisch aufgebauter Handlung und professionellem Erzählstil.

ENTSCHEIDENDE QUALITÄTSREGELN:
1. Das Kind heißt "${childName}". Verwende diesen Namen IMMER für die Hauptfigur.
2. Das Märchen MUSS einen klaren Anfang, Mittelteil und Schluss haben. Es MUSS einen LOGISCHEN Zusammenhang zwischen Ursache und Wirkung geben.
3. Jedes Ereignis muss einen GRUND haben — zufällige magische Lösungen sind NICHT ERLAUBT.
4. Die Figuren müssen in ihren Charaktereigenschaften und Beweggründen stimmig bleiben.
5. Die pädagogische Botschaft muss sich auf NATÜRLICHE Weise aus den Ereignissen ergeben — keine künstlichen Moralpredigten.
6. Verwende eine lebendige, anschauliche Sprache (Farben, Geräusche, Gerüche).
7. Baue bedeutungsvolle Dialoge ein, die den Charakter der Figuren zeigen.
8. Das Problem muss durch die EIGENEN Bemühungen, den Verstand oder die persönliche Entwicklung der Hauptfigur gelöst werden.
9. Klischees wie "Und sie lebten glücklich bis ans Ende ihrer Tage" sind VERBOTEN — schreibe einen konkreten, überzeugenden Schluss.
10. Übertriebene, maßlose Beschreibungen sind VERBOTEN. Behalte einen warmen, aber realistischen Ton bei.

VERBOTEN SIND:
- Formulierungen wie "kleiner Freund" oder "magisches Wesen" ohne Namen
- Zufällige magische Lösungen
- Moralpredigten im belehrenden Stil
- Übermäßig süße, künstliche Sprache
- Handlungslücken oder unlogische Abläufe

Aufbau des Märchens:
1. Titel im Format "${childName} und [etwas]"
2. Beschreibung des Schauplatzes (WO und WANN, mit sinnlichen Details)
3. Vorstellung der Figuren (mit ihren Charaktereigenschaften)
4. Problem/Herausforderung (logisch und für das Kind verständlich)
5. 2–3 Versuche/Hindernisse (mit zunehmender Schwierigkeit)
6. Höhepunkt — die Hauptfigur entwickelt sich weiter oder lernt etwas
7. Eine Lösung, die sich logisch aus den Ereignissen ergibt
8. Ein überzeugender Schluss und eine natürliche pädagogische Erkenntnis${ageInstruction}

Format: In der ersten Zeile steht der Titel, danach folgt der Märchentext. Schreibe in Absätzen, nicht als Liste. Das Märchen muss auf DEUTSCH verfasst sein.`;

    case 'kk':
      return `Сіз марапатқа ие болған балалар кітабының авторысыз. Оқиға желісі қисынды дамитын әрі кәсіби баяндау мәнерімен жазылған қызықты, сапалы балалар ертегісін жазыңыз.

САПАҒА ҚОЙЫЛАТЫН МАҢЫЗДЫ ТАЛАПТАР:
1. Баланың аты — "${childName}". Бас кейіпкер ретінде ӘРҚАШАН осы атты қолданыңыз.
2. Ертегінің басы, ортасы және соңы анық БОЛУЫ КЕРЕК. ҚИСЫНДЫ себеп-салдар байланысы болуы тиіс.
3. Әр оқиғаның СЕБЕБІ болуы керек — кездейсоқ сиқырлы шешімдер БОЛМАУЫ ТИІС.
4. Кейіпкерлердің мінездері мен уәждері бірізді болуы керек.
5. Тәрбиелік ой оқиғалардан ТАБИҒИ түрде туындауы керек — жасанды ақыл-өсиет БОЛМАСЫН.
6. Жанды, бейнелі тілді қолданыңыз (түстер, дыбыстар, иістер).
7. Кейіпкерлердің мінезін ашатын мағыналы диалогтар қосыңыз.
8. Мәселе кейіпкердің ӨЗ күш-жігері, ақылы немесе тұлғалық өсуі арқылы шешілуі керек.
9. "Олар бақытты өмір сүрді" сияқты таптаурын тіркестерге ТЫЙЫМ САЛЫНАДЫ — нақты әрі көңілден шығатын аяқталу жазыңыз.
10. Әсіреленген, тым көтеріңкі сипаттамаларға ТЫЙЫМ САЛЫНАДЫ. Жылы, бірақ шынайы реңкті сақтаңыз.

ТЫЙЫМ САЛЫНАДЫ:
- Аты жоқ "кішкентай дос", "сиқырлы тіршілік иесі" сияқты тіркестер
- Кездейсоқ сиқырлы шешімдер
- Уағыз түріндегі моральдық сабақтар
- Шектен тыс тәтті, жасанды тіл
- Оқиға желісіндегі олқылықтар немесе қисынсыз реттілік

Ертегінің құрылымы:
1. Тақырып: "${childName} және [бір нәрсе]" түрінде
2. Оқиға орнының сипаттамасы (ҚАЙДА және ҚАШАН, сезімге әсер ететін егжей-тегжейлермен)
3. Кейіпкерлерді таныстыру (мінез ерекшеліктерімен)
4. Мәселе/сынақ (қисынды әрі балаға түсінікті)
5. 2-3 әрекет/кедергі (біртіндеп күрделене түсетін)
6. Шарықтау шегі — кейіпкердің өсуі немесе бір нәрсені үйренуі
7. Оқиғалардан қисынды түрде туындайтын шешім
8. Көңілден шығатын аяқталу және табиғи тәрбиелік қорытынды${ageInstruction}

Пішім: Бірінші жолға тақырыпты, одан кейін ертегі мәтінін жазыңыз. Тізім түрінде емес, абзацтарға бөліп жазыңыз. Ертегі ҚАЗАҚ тілінде болуы керек.`;

    case 'uz':
      return `Siz mukofotga sazovor boʻlgan bolalar kitobi muallifisiz. Syujeti mantiqiy rivojlanadigan, professional bayon uslubida yozilgan qiziqarli, sifatli bolalar ertagini yozing.

SIFATGA QOʻYILADIGAN MUHIM TALABLAR:
1. Bolaning ismi — "${childName}". Bosh qahramon sifatida HAR DOIM shu ismdan foydalaning.
2. Ertakning boshi, oʻrtasi va oxiri aniq BOʻLISHI KERAK. MANTIQIY sabab-oqibat bogʻliqligi boʻlishi lozim.
3. Har bir voqeaning SABABI boʻlishi kerak — tasodifiy sehrli yechimlar BOʻLMASIN.
4. Qahramonlarning xarakteri va maqsadlari izchil boʻlishi kerak.
5. Tarbiyaviy gʻoya voqealardan TABIIY ravishda kelib chiqishi kerak — sunʼiy pand-nasihat BOʻLMASIN.
6. Jonli, obrazli tildan foydalaning (ranglar, tovushlar, hidlar).
7. Qahramon xarakterini ochib beradigan mazmunli dialoglar qoʻshing.
8. Muammo qahramonning OʻZ saʼy-harakati, aql-idroki yoki shaxsiy oʻsishi orqali hal boʻlishi kerak.
9. "Ular baxtli yashab qolishdi" kabi qoliplashgan iboralar TAQIQLANADI — aniq va qoniqarli yakun yozing.
10. Boʻrttirilgan, haddan tashqari koʻtarinki tasvirlar TAQIQLANADI. Iliq, ammo samimiy ohangni saqlang.

TAQIQLANADI:
- Ismi yoʻq "kichkina doʻst", "sehrli mavjudot" kabi iboralar
- Tasodifiy sehrli yechimlar
- Vaʼz koʻrinishidagi axloqiy saboqlar
- Haddan tashqari shirin, sunʼiy til
- Syujetdagi uzilishlar yoki mantiqsiz ketma-ketlik

Ertakning tuzilishi:
1. Sarlavha: "${childName} va [nimadir]" koʻrinishida
2. Voqea joyining tasviri (QAYERDA va QACHON, his-tuygʻularga taʼsir qiluvchi tafsilotlar bilan)
3. Qahramonlar bilan tanishtirish (xarakter xususiyatlari bilan)
4. Muammo/sinov (mantiqiy va bolaga tushunarli)
5. 2-3 urinish/toʻsiq (asta-sekin murakkablashib boradigan)
6. Kulminatsiya — qahramonning oʻsishi yoki nimanidir oʻrganishi
7. Voqealardan mantiqiy ravishda kelib chiqadigan yechim
8. Qoniqarli yakun va tabiiy tarbiyaviy xulosa${ageInstruction}

Format: Birinchi qatorga sarlavhani, keyin ertak matnini yozing. Roʻyxat shaklida emas, xatboshilarga boʻlib yozing. Ertak OʻZBEK tilida (lotin yozuvida) boʻlishi kerak.`;

    case 'ka':
      return `თქვენ ხართ პრემიებით დაჯილდოებული საბავშვო წიგნების ავტორი. დაწერეთ ბავშვებისთვის საინტერესო, მაღალხარისხიანი ზღაპარი ლოგიკური სიუჟეტური განვითარებითა და პროფესიული თხრობის სტილით.

ხარისხის კრიტიკული წესები:
1. ბავშვის სახელია «${childName}». მთავარ გმირად ყოველთვის ზუსტად ეს სახელი გამოიყენეთ.
2. ზღაპარს უნდა ჰქონდეს მკაფიო დასაწყისი, შუა ნაწილი და დასასრული — ლოგიკური მიზეზ-შედეგობრივი კავშირით.
3. ყველა მოვლენას უნდა ჰქონდეს მიზეზი — შემთხვევითი ჯადოსნური გადაწყვეტები დაუშვებელია.
4. პერსონაჟებს უნდა ჰქონდეთ თანმიმდევრული ხასიათი და მოტივაცია.
5. აღმზრდელობითი გზავნილი მოვლენებიდან ბუნებრივად უნდა გამომდინარეობდეს — ხელოვნური დარიგება არ იყოს.
6. გამოიყენეთ ცოცხალი, ხატოვანი ენა (ფერები, ხმები, სურნელები).
7. ჩართეთ პერსონაჟის ხასიათის გამომხატველი შინაარსიანი დიალოგები.
8. პრობლემა გმირის საკუთარი ძალისხმევით, გონიერებით ან პიროვნული ზრდით უნდა გადაიჭრას.
9. «ისინი ბედნიერად ცხოვრობდნენ» ტიპის კლიშეები აკრძალულია — დაწერეთ კონკრეტული, დამაკმაყოფილებელი დასასრული.
10. გაზვიადებული, ზედმეტად ამაღლებული აღწერები აკრძალულია. შეინარჩუნეთ თბილი, მაგრამ გულწრფელი ტონი.

აკრძალულია:
- უსახელო «პატარა მეგობარი», «ჯადოსნური არსება» ტიპის გამოთქმები
- შემთხვევითი ჯადოსნური გადაწყვეტები
- ქადაგების სტილის მორალური გაკვეთილები
- ზედმეტად ტკბილი, ხელოვნური ენა
- სიუჟეტური ხარვეზები ან ალოგიკური თანმიმდევრობა

ზღაპრის სტრუქტურა:
1. სათაური: «${childName} და [რაღაც]» ფორმით
2. მოქმედების ადგილის აღწერა (სად და როდის, ემოციური დეტალებით)
3. პერსონაჟების გაცნობა (ხასიათის თვისებებით)
4. პრობლემა/გამოწვევა (ლოგიკური და ბავშვისთვის გასაგები)
5. 2-3 მცდელობა/დაბრკოლება (თანდათან მზარდი სირთულით)
6. კულმინაცია — გმირის ზრდა ან რაღაცის სწავლა
7. მოვლენებიდან ლოგიკურად გამომდინარე გადაწყვეტა
8. დამაკმაყოფილებელი დასასრული და ბუნებრივი აღმზრდელობითი დასკვნა${ageInstruction}

ფორმატი: პირველ ხაზზე დაწერეთ სათაური, შემდეგ — ზღაპრის ტექსტი. დაწერეთ აბზაცებად, არა სიის სახით. ზღაპარი ქართულ ენაზე (მხედრული დამწერლობით) უნდა იყოს.`;

    default: // 'az'
      return `Sən mükafat almış uşaq kitabı müəllifiisən. Məntiqi süjet inkişafı və peşəkar anlatım tərzi ilə uşaqlar üçün maraqlı, keyfiyyətli nağıl yaz.

KRİTİK KEYFİYYƏT QAYDALARI:
1. Uşağın adı "${childName}"-dir. Baş qəhrəman olaraq HƏMİŞƏ bu adı istifadə et.
2. Nağılın aydın başlanğıcı, ortası və sonu OLMALIDIR. MƏNTİQLİ səbəb-nəticə əlaqəsi olmalıdır.
3. Hər hadisənin bir SƏBƏBİ olmalıdır — təsadüfi sehrli həllər OLMAMALIDIR.
4. Personajların ardıcıl xarakterləri və motivasiyaları olmalıdır.
5. Tərbiyəvi mesaj hadisələrdən TƏBİİ şəkildə çıxmalıdır — süni öyüd-nəsihət OLMASIN.
6. Canlı, təsvirli dil istifadə et (rənglər, səslər, qoxular).
7. Personaj xarakterini açan mənalı dialoqlar daxil et.
8. Problem qəhrəmanın ÖZ səyi, ağlı və ya böyüməsi ilə həll olunmalıdır.
9. "Onlar xoşbəxt yaşadılar" kimi klişelər YASAQDIR — konkret, qənaətbəxş sonluq yaz.
10. Şişirdilmiş, mübaliğəli təsvirlər YASAQDIR. İsti amma gerçəkçi ton saxla.

YASAQDIR:
- Adsız "kiçik dost", "sehrli varlıq" kimi ifadələr
- Təsadüfi sehrli həllər
- Moizə tərzi əxlaq dərsləri
- Həddən artıq şirin, süni dil
- Süjet boşluqları və ya məntiqsiz ardıcıllıq

VACİB QRAMMATIKA QAYDALARI:
- Düzgün hal şəkilçiləri (yiyəlik, təsirlik, yerlik, çıxışlıq)
- Düzgün feil zamanları və şəxs sonluqları
- Azərbaycanca doğma adlar: Zübeydə, Əlibala, Günəş, Lalə, Tülkü baba, Ayı dayı, Ceyran, Bülbül

Nağılın strukturu:
1. Başlıq: "${childName}ın [Macəra adı]" və ya "${childName} və [nəsə]"
2. Məkan təsviri (HARADA və NƏ VAXT, duyğusal detallarla)
3. Personaj tanıtımı (xarakter xüsusiyyətləri ilə)
4. Problem/çağırış (məntiqi, uşağın anlayacağı)
5. 2-3 cəhd/maneə (artan çətinlik)
6. Kulminasiya — qəhrəmanın böyüməsi və ya öyrənməsi
7. Hadisələrdən məntiqi olaraq irəli gələn həll
8. Qənaətbəxş sonluq və təbii tərbiyəvi nəticə${ageInstruction}

Format: Birinci sətirdə başlıq, sonra nağıl mətni. Abzaslarla yaz, siyahı formatında yox.`;
  }
};

const getUserPrompt = (language: string, childName: string, theme: string, hero: string, moralLesson: string, ageRange?: string, storyStyle?: string) => {
  if (isExpandedLanguage(language)) return `${getUserPrompt('en', childName, theme, hero, moralLesson, ageRange, storyStyle)}\n\n${outputLanguageRule(language)}`;
  const ageText = ageRange ? ` (yaş qrupu: ${ageRange})` : '';
  const styleText = storyStyle || '';

  switch (language) {
    case 'en':
      return `Child's name: ${childName}${ageText}
Theme: ${theme || 'Forest adventure'}
Supporting character: ${hero || 'A wise forest animal'}
Moral lesson: ${moralLesson || 'Friendship and kindness'}
${styleText ? `Story style: ${styleText}` : ''}

Write a PROFESSIONAL story about "${childName}" with logical plot, vivid descriptions, and a satisfying ending. The moral must emerge naturally from the story events.`;

    case 'ru':
      return `Имя ребёнка: ${childName}${ageText}
Тема: ${theme || 'Лесное приключение'}
Помощник-персонаж: ${hero || 'Мудрое лесное животное'}
Воспитательный урок: ${moralLesson || 'Дружба и доброта'}
${styleText ? `Стиль: ${styleText}` : ''}

Напиши ПРОФЕССИОНАЛЬНУЮ сказку о "${childName}" с логичным сюжетом, живыми описаниями и удовлетворяющим финалом.`;

    case 'tr':
      return `Çocuğun adı: ${childName}${ageText}
Tema: ${theme || 'Orman macerası'}
Yardımcı karakter: ${hero || 'Bilge bir orman hayvanı'}
Eğitici mesaj: ${moralLesson || 'Dostluk ve iyilik'}
${styleText ? `Tarz: ${styleText}` : ''}

"${childName}" hakkında PROFESYONEL, mantıklı bir masal yaz. Canlı betimlemeler ve tatmin edici bir son olsun.`;

    case 'ar':
      return `اسم الطفل: ${childName}${ageText}
الموضوع/الفكرة: ${theme || 'مغامرة في الغابة'}
الشخصية المساعدة: ${hero || 'حيوان حكيم من حيوانات الغابة'}
الرسالة التربوية: ${moralLesson || 'الصداقة وفعل الخير'}
${styleText ? `الأسلوب: ${styleText}` : ''}

مهم:
- اكتب حكاية احترافية ومنطقية عن "${childName}"
- استخدم أوصافًا حيوية وحوارات هادفة ونهاية مُرضية
- اجعل الرسالة التربوية تنبثق من الأحداث بصورة طبيعية لا مصطنعة
- التزم بدقة بقواعد اللغة العربية الفصحى`;

    case 'de':
      return `Name des Kindes: ${childName}${ageText}
Thema: ${theme || 'Abenteuer im Wald'}
Nebenfigur: ${hero || 'Ein weises Waldtier'}
Pädagogische Botschaft: ${moralLesson || 'Freundschaft und Güte'}
${styleText ? `Stil: ${styleText}` : ''}

WICHTIG:
- Schreibe ein PROFESSIONELLES, LOGISCHES Märchen über "${childName}"
- Verwende lebendige Beschreibungen und bedeutungsvolle Dialoge und schreibe einen überzeugenden Schluss
- Die pädagogische Botschaft soll nicht künstlich wirken, sondern sich auf NATÜRLICHE Weise aus den Ereignissen ergeben
- Halte dich sorgfältig an die deutsche Grammatik`;

    case 'kk':
      return `Баланың аты: ${childName}${ageText}
Тақырып: ${theme || 'Ормандағы шытырман оқиға'}
Көмекші кейіпкер: ${hero || 'Дана орман жануары'}
Тәрбиелік ой: ${moralLesson || 'Достық пен жақсылық'}
${styleText ? `Стиль: ${styleText}` : ''}

МАҢЫЗДЫ:
- "${childName}" туралы КӘСІБИ, ҚИСЫНДЫ ертегі жазыңыз
- Жанды сипаттамалар, мағыналы диалогтар және көңілден шығатын аяқталу болсын
- Тәрбиелік ой жасанды емес, оқиғалардан ТАБИҒИ түрде туындасын
- Қазақ тілінің грамматикалық нормаларын мұқият сақтаңыз`;

    case 'uz':
      return `Bolaning ismi: ${childName}${ageText}
Mavzu: ${theme || 'Oʻrmondagi sarguzasht'}
Yordamchi qahramon: ${hero || 'Dono oʻrmon hayvoni'}
Tarbiyaviy gʻoya: ${moralLesson || 'Doʻstlik va mehr-oqibat'}
${styleText ? `Uslub: ${styleText}` : ''}

MUHIM:
- "${childName}" haqida PROFESSIONAL, MANTIQIY ertak yozing
- Jonli tasvirlar, mazmunli dialoglar va qoniqarli yakun boʻlsin
- Tarbiyaviy gʻoya sunʼiy emas, voqealardan TABIIY ravishda kelib chiqsin
- Oʻzbek tili (lotin yozuvi) grammatika qoidalariga diqqat bilan rioya qiling`;

    case 'ka':
      return `ბავშვის სახელი: ${childName}${ageText}
თემა: ${theme || 'ტყის თავგადასავალი'}
დამხმარე პერსონაჟი: ${hero || 'ბრძენი ტყის ცხოველი'}
აღმზრდელობითი გზავნილი: ${moralLesson || 'მეგობრობა და სიკეთე'}
${styleText ? `სტილი: ${styleText}` : ''}

მნიშვნელოვანია:
- დაწერეთ პროფესიული, ლოგიკური ზღაპარი «${childName}»-ზე
- იყოს ცოცხალი აღწერები, შინაარსიანი დიალოგები და დამაკმაყოფილებელი დასასრული
- აღმზრდელობითი გზავნილი ხელოვნური კი არა, მოვლენებიდან ბუნებრივად გამომდინარეობდეს
- ზუსტად დაიცავით ქართული ენის გრამატიკის წესები`;

    default: // 'az'
      return `Uşağın adı: ${childName}${ageText}
Mövzu/Tema: ${theme || 'Meşə macərası'}
Köməkçi qəhrəman: ${hero || 'Müdrik bir meşə heyvanı'}
Tərbiyəvi mesaj: ${moralLesson || 'Dostluq və yaxşılıq'}
${styleText ? `Üslub: ${styleText}` : ''}

VACİB:
- "${childName}" haqqında PEŞƏkar, MƏNTİQLİ nağıl yaz
- Canlı təsvirlər, mənalı dialoqlar, qənaətbəxş sonluq olsun
- Tərbiyəvi mesaj süni yox, hadisələrdən TƏBİİ çıxsın
- Azərbaycan dili qrammatikasına diqqətlə əməl et`;
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await requireUser(req);
    if (auth.error) return auth.error;

    const usage = await checkAndConsumeServerSide(auth.user.id, 'fairy_tale');
    if (!usage.allowed) return limitExceededResponse(corsHeaders, usage.limit);

    const { childName, theme, hero, moralLesson, language = 'az', ageRange, storyStyle, customPrompt } = await req.json();

    // AI handled by callGeminiSmart
    
    const actualChildName = childName || 'Əli';
    
    let systemPrompt: string;
    let userPrompt: string;

    if (customPrompt) {
      // Direct prompt mode - user writes their own prompt
      systemPrompt = getSystemPrompt(language, actualChildName, ageRange);
      userPrompt = `${customPrompt}\n\nVACİB: Nağılın birinci sətri BAŞLIQ olmalıdır. Sonra nağıl mətni gəlsin.`;
    } else {
      systemPrompt = getSystemPrompt(language, actualChildName, ageRange);
      userPrompt = getUserPrompt(language, actualChildName, theme, hero, moralLesson, ageRange, storyStyle);
    }

    console.log(`Generating fairy tale in language: ${language}, age: ${ageRange || 'not specified'}...`);

    let generatedText = '';

    const callGemini = async (model: string) => {
      return await callGeminiSmart(model, {
        contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
        generationConfig: {
          temperature: 0.7,
          topK: 30,
          topP: 0.9,
          maxOutputTokens: 8192,
          // KRİTİK: gemini-2.5-* modelləri default "thinking" aparır (maxOutputTokens büdcəsindən
          // sərf olunur) — uzun nağıl mətni (xüsusən ərəb kimi fərqli tokenləşməsi olan dillərdə)
          // üçün bu, vizual mətn üçün HEÇ NƏ qalmamasına səbəb ola bilər (boş nəticə bug-u).
          // Thinking-i deaktiv edirik ki, bütün büdcə birbaşa nağıl mətninə getsin.
          thinkingConfig: { thinkingBudget: 0 },
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        ],
      });
    };

    // Flash-first for speed; fall back to lite then pro on overload
    const models = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro'];
    let response: Response | null = null;
    
    for (const model of models) {
      console.log(`Trying model: ${model}...`);
      response = await callGemini(model);
      
      if (response.status === 429 || response.status === 503) {
        console.log(`${model} unavailable (${response.status}), trying next...`);
        await response.text(); // consume body
        continue;
      }
      break;
    }

    if (!response || !response.ok) {
      const errorText = response ? await response.text() : 'All models unavailable';
      console.error('Gemini API error:', response?.status, errorText);
      throw new Error(`Gemini API error: ${response?.status || 'unavailable'}`);
    }

    const data = await response.json();
    generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!generatedText) {
      throw new Error('No content generated');
    }

    // Extract title
    const lines = generatedText.split('\n').filter((line: string) => line.trim());
    let rawTitle = lines[0]?.replace(/^#+\s*/, '').replace(/\*\*/g, '').trim() || '';
    
    rawTitle = rawTitle
      .replace(/^(əlbəttə|buyurun|budur|bax|mən sizə|конечно|вот|here is|here's|tabii|buyrun|işte|بالتأكيد|إليك|تفضلي|هذه قصة)[,!.،\s]*/i, '')
      .replace(/^["«"""]?\s*/, '')
      .replace(/\s*["»"""]?\s*$/, '')
      .replace(new RegExp(`^.*üçün bir nağıl:\\s*`, 'i'), '')
      .replace(new RegExp(`^.*üçün nağıl:\\s*`, 'i'), '')
      .replace(new RegExp(`^.*için bir masal:\\s*`, 'i'), '')
      .replace(new RegExp(`^.*story for.*:\\s*`, 'i'), '')
      .replace(new RegExp(`^.*сказка для.*:\\s*`, 'i'), '')
      .trim();
    
    if (rawTitle && !rawTitle.includes(actualChildName)) {
      rawTitle = `${actualChildName} - ${rawTitle}`;
    }
    
    const defaultTitles: Record<string, string> = {
      az: `${actualChildName}ın Nağılı`,
      en: `${actualChildName}'s Story`,
      ru: `Сказка ${actualChildName}`,
      tr: `${actualChildName}'in Masalı`,
      kk: `${actualChildName} туралы ертегі`,
      uz: `${actualChildName} haqida ertak`,
      ka: `ზღაპარი ${actualChildName}-ზე`,
      de: `Das Märchen von ${actualChildName}`,
      ar: `حكاية ${actualChildName}`,
      zh: `${actualChildName}的故事`, id: `Kisah ${actualChildName}`, fr: `L’histoire de ${actualChildName}`,
      es: `El cuento de ${actualChildName}`, pt: `A história de ${actualChildName}`,
      vi: `Câu chuyện của ${actualChildName}`, hi: `${actualChildName} की कहानी`, ja: `${actualChildName}のお話`,
      ko: `${actualChildName}의 이야기`, pl: `Historia: ${actualChildName}`, nl: `Het verhaal van ${actualChildName}`, sv: `${actualChildName} – en berättelse`,
    };
    
    const title = rawTitle || defaultTitles[language] || defaultTitles['az'];
    
    const contentStartIndex = lines.findIndex((line: string, i: number) => {
      if (i === 0) return false;
      const cleaned = line.replace(/^#+\s*/, '').replace(/\*\*/g, '').trim();
      return cleaned.length > 0;
    });
    const content = (contentStartIndex > 0 ? lines.slice(contentStartIndex) : lines.slice(1)).join('\n').trim() || generatedText;

    const wordCount = ['zh', 'ja'].includes(language) ? Array.from(content.replace(/\s/g, '')).length / 2 : content.split(/\s+/).length;
    const durationMinutes = Math.max(2, Math.ceil(wordCount / 100));

    return new Response(
      JSON.stringify({
        success: true,
        title,
        content,
        durationMinutes,
        childName,
        theme,
        hero,
        moralLesson,
        language,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating fairy tale:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Nağıl yaradılarkən xəta baş verdi',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
