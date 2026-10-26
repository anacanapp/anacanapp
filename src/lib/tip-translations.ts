import { getCachedTranslation } from './i18n';

export const TIP_TRANSLATIONS: Record<string, Record<string, string>> = {
  "Enerji Artımı": {
    "en": "Energy Boost",
    "ru": "Повышение энергии",
    "tr": "Enerji Artışı",
    "kk": "Қуаттың артуы",
    "de": "Mehr Energie",
    "ar": "زيادة الطاقة",
    "uz": "Energiya oshishi",
    "ka": "ენერგიის მატება"
  },
  "Follikulyar fazada estrogen artır və artan enerji və optimizm gətirir.": {
    "en": "Estrogen increases in the follicular phase, bringing increased energy and optimism.",
    "ru": "В фолликулярной фазе повышается уровень эстрогена, что приносит больше энергии и оптимизма.",
    "tr": "Foliküler evrede östrojen artar, bu da enerji ve iyimserlik getirir.",
    "kk": "Фолликулярлық фазада эстроген деңгейі жоғарылап, қуат пен оптимизмді арттырады.",
    "de": "In der Follikelphase steigt der Östrogenspiegel und sorgt für mehr Energie und Optimismus.",
    "ar": "يرتفع مستوى الإستروجين خلال الطور الجُريبي، مما يزيد الطاقة والتفاؤل.",
    "uz": "Follikulyar fazada estrogen ko'tariladi — bu esa kuch-g'ayrat va optimizmni oshiradi.",
    "ka": "ფოლიკულურ ფაზაში ესტროგენის დონე იმატებს, რაც მეტ ენერგიასა და ოპტიმიზმს მოაქვს."
  },
  "Hidrasiya Vacibdir": {
    "en": "Hydration is Important",
    "ru": "Важность гидратации",
    "tr": "Hidrasyon Önemlidir",
    "kk": "Су ішу маңызды",
    "de": "Ausreichend trinken",
    "ar": "الترطيب مهم",
    "uz": "Suv ichish muhim",
    "ka": "წყლის მიღება მნიშვნელოვანია"
  },
  "Bol su içmək şişkinliyi aradan qaldırır və menstruasiya simptomlarını yüngülləşdirir. Orqanizmin maye balansını qoruyaraq bu dövrü daha rahat keçirə bilərsiniz.": {
    "en": "Drinking plenty of water relieves bloating and alleviates menstrual symptoms. You can go through this period more comfortably by maintaining the fluid balance of the organism.",
    "ru": "Употребление большого количества воды снимает вздутие и облегчает симптомы менструации. Поддержание водного баланса поможет вам пройти этот период более комфортно.",
    "tr": "Bol su içmek şişkinliği giderir ve adet semptomlarını hafifletir. Vücudun sıvı dengesini koruyarak bu dönemi daha rahat geçirebilirsiniz.",
    "kk": "Суды мол ішу ісінуді азайтып, етеккір белгілерін жеңілдетеді. Ағзадағы сұйықтық тепе-теңдігін сақтай отырып, бұл кезеңді жайлырақ өткізе аласыз.",
    "de": "Viel Wasser zu trinken kann Wassereinlagerungen reduzieren und Menstruationsbeschwerden lindern. Wenn du deinen Flüssigkeitshaushalt im Gleichgewicht hältst, kannst du diese Phase angenehmer erleben.",
    "ar": "يساعد شرب الكثير من الماء على تخفيف الانتفاخ وأعراض الدورة الشهرية. ويمكنكِ اجتياز هذه الفترة براحة أكبر من خلال الحفاظ على توازن السوائل في جسمكِ.",
    "uz": "Ko'p suv ichish shishishni kamaytiradi va hayz belgilarini yengillashtiradi. Organizmning suyuqlik balansini saqlab, bu davrni ancha yengil o'tkazasiz.",
    "ka": "დიდი რაოდენობით წყლის დალევა შებერილობას ამცირებს და მენსტრუაციის სიმპტომებს ამსუბუქებს. ორგანიზმის სითხის ბალანსის შენარჩუნებით ამ პერიოდს უფრო კომფორტულად გაივლით."
  },
  "Yuxu Keyfiyyəti": {
    "en": "Sleep Quality",
    "ru": "Качество сна",
    "tr": "Uyku Kalitesi",
    "kk": "Ұйқы сапасы",
    "de": "Schlafqualität",
    "ar": "جودة النوم",
    "uz": "Uyqu sifati",
    "ka": "ძილის ხარისხი"
  },
  "Tsikl boyu baş verən hormonal dəyişikliklər yuxunuza təsir edə bilər. Keyfiyyətli istirahət üçün sabit yuxu rejiminə riayət edin.": {
    "en": "Hormonal changes throughout the cycle can affect your sleep. Maintain a stable sleep schedule for quality rest.",
    "ru": "Гормональные изменения на протяжении цикла могут влиять на ваш сон. Соблюдайте стабильный режим сна для качественного отдыха.",
    "tr": "Döngü boyunca meydana gelen hormonal değişiklikler uykunuzu etkileyebilir. Kaliteli dinlenme için sabit bir uyku düzenine uyun.",
    "kk": "Цикл бойындағы гормондық өзгерістер ұйқыңызға әсер етуі мүмкін. Сапалы демалу үшін тұрақты ұйқы режимін сақтаңыз.",
    "de": "Die hormonellen Veränderungen während des Zyklus können deinen Schlaf beeinflussen. Halte dich für eine erholsame Nachtruhe an einen regelmäßigen Schlafrhythmus.",
    "ar": "قد تؤثر التغيرات الهرمونية التي تحدث على مدار الدورة في نومكِ. التزمي بجدول نوم منتظم للحصول على راحة جيدة.",
    "uz": "Sikl davomida yuz beradigan gormonal o'zgarishlar uyqungizga ta'sir qilishi mumkin. Sifatli dam olish uchun barqaror uyqu tartibiga rioya qiling.",
    "ka": "ციკლის განმავლობაში მიმდინარე ჰორმონალურმა ცვლილებებმა შესაძლოა თქვენს ძილზე იმოქმედოს. ხარისხიანი დასვენებისთვის დაიცავით სტაბილური ძილის რეჟიმი."
  },
  "Tsiklini Anlamaq": {
    "en": "Understanding Your Cycle",
    "ru": "Понимание вашего цикла",
    "tr": "Döngünüzü Anlamak",
    "kk": "Цикліңізді түсіну",
    "de": "Deinen Zyklus verstehen",
    "ar": "فهم دورتكِ",
    "uz": "Siklingizni tushunish",
    "ka": "თქვენი ციკლის გაგება"
  },
  "Menstrual dövrünüz dörd fazaya bölünür: Menstruasiya, Follikulyar, Ovulyasiya və Luteal. Hər faza fərqli hormonal dəyişikliklərlə müşayiət olunur. Menstruasiya (Qış): Hormonların ən aşağı səviyyədə olduğu, bədənin yeniləndiyi və istirahət tələb edən \"təmizlənmə\" dövrüdür. Follikulyar faza (Bahar): Estrogenin artması ilə enerjinin, yaradıcılığın və sosial aktivliyin yüksəldiyi mərhələdir. Ovulyasiya (Yay): Mayalanma ehtimalının və özünəinamın zirvədə olduğu, bədənin ən enerjili 24-48 saatıdır. Luteal faza (Payız): Progesteronun təsiri ilə bədənin yavaşladığı, daha çox emosional həssaslıq və daxili sakitlik tələb olunan dövrdür.": {
    "en": "Your menstrual cycle is divided into four phases: Menstruation, Follicular, Ovulation, and Luteal. Each phase is accompanied by different hormonal changes. Menstruation (Winter): The \"cleansing\" period when hormones are at their lowest level, the body is renewing, and rest is required. Follicular phase (Spring): The stage when energy, creativity, and social activity increase with the rise of estrogen. Ovulation (Summer): The most energetic 24-48 hours of the body when the probability of conception and self-confidence are at their peak. Luteal phase (Autumn): The period when the body slows down due to the effect of progesterone, requiring more emotional sensitivity and inner peace.",
    "ru": "Ваш менструальный цикл разделен на четыре фазы: Менструальная, Фолликулярная, Овуляторная и Лютеиновая. Каждая фаза сопровождается различными гормональными изменениями. Менструация (Зима): Период «очищения», когда гормоны находятся на самом низком уровне, организм обновляется и требуется отдых. Фолликулярная фаза (Весна): Этап, когда энергия, креативность и социальная активность возрастают с повышением уровня эстрогена. Овуляция (Лето): Самые энергичные 24-48 часов организма, когда вероятность зачатия и уверенность в себе находятся на пике. Лютеиновая фаза (Осень): Период, когда организм замедляется под воздействием прогестерона, что требует большей эмоциональной чувствительности и внутреннего покоя.",
    "tr": "Menstrual döngünüz dört evreye ayrılır: Adet, Foliküler, Yumurtlama ve Luteal. Her evreye farklı hormonal değişiklikler eşlik eder. Adet (Kış): Hormonların en düşük seviyede olduğu, vücudun yenilendiği ve dinlenme gerektiren \"arınma\" dönemidir. Foliküler evre (İlkbahar): Östrojenin artmasıyla enerji, yaratıcılık ve sosyal aktivitenin yükseldiği aşamadır. Yumurtlama (Yaz): Hamile kalma olasılığının ve özgüvenin zirvede olduğu, vücudun en enerjik 24-48 saatidir. Luteal evre (Sonbahar): Progesteronun etkisiyle vücudun yavaşladığı, daha fazla duygusal hassasiyet ve iç huzur gerektiren dönemdir.",
    "kk": "Етеккір циклі төрт фазаға бөлінеді: етеккір, фолликулярлық фаза, овуляция және лютеиндік фаза. Әр фаза әртүрлі гормондық өзгерістермен қатар жүреді. Етеккір (Қыс): гормондар деңгейі ең төмен болатын, ағза жаңарып, демалысты қажет ететін кезең. Фолликулярлық фаза (Көктем): эстроген деңгейінің жоғарылауымен бірге қуат, шығармашылық және әлеуметтік белсенділік артатын кезең. Овуляция (Жаз): ұрықтану ықтималдығы мен өзіне деген сенімділік ең жоғары болатын, ағзаның ең қуатты 24-48 сағаты. Лютеиндік фаза (Күз): прогестеронның әсерінен ағза баяулап, эмоциялық сезімталдық артып, ішкі тыныштықты көбірек қажет ететін кезең.",
    "de": "Dein Menstruationszyklus ist in vier Phasen unterteilt: Menstruation, Follikelphase, Eisprung und Lutealphase. Jede Phase geht mit unterschiedlichen hormonellen Veränderungen einher. Menstruation (Winter): In dieser Phase sind die Hormonspiegel am niedrigsten. Der Körper regeneriert sich und benötigt Ruhe. Follikelphase (Frühling): Durch den steigenden Östrogenspiegel nehmen Energie, Kreativität und soziale Aktivität zu. Eisprung (Sommer): In diesen 24–48 Stunden ist die Wahrscheinlichkeit einer Befruchtung am höchsten, und du kannst dich besonders energiegeladen und selbstbewusst fühlen. Lutealphase (Herbst): Unter dem Einfluss von Progesteron fährt der Körper langsamer. In dieser Phase kannst du emotional empfindlicher sein und mehr Ruhe und Rückzug brauchen.",
    "ar": "تنقسم دورتكِ الشهرية إلى أربع مراحل: الحيض، والطور الجُريبي، والإباضة، والطور الأصفري. تصاحب كل مرحلة تغيرات هرمونية مختلفة. الحيض (الشتاء): فترة تكون فيها الهرمونات عند أدنى مستوياتها، ويتجدد فيها الجسم ويحتاج إلى الراحة. الطور الجُريبي (الربيع): مرحلة ترتفع فيها الطاقة والإبداع والرغبة في التواصل الاجتماعي مع زيادة الإستروجين. الإباضة (الصيف): أكثر ٢٤-٤٨ ساعة نشاطًا في الجسم، وتبلغ فيها احتمالية الإخصاب والثقة بالنفس ذروتهما. الطور الأصفري (الخريف): فترة يتباطأ فيها الجسم بتأثير البروجستيرون، وتزداد فيها الحساسية العاطفية والحاجة إلى الهدوء الداخلي.",
    "uz": "Hayz siklingiz to'rt bosqichga bo'linadi: Hayz, Follikulyar, Ovulyatsiya va Lyuteal. Har bir bosqich turli gormonal o'zgarishlar bilan kechadi. Hayz (Qish): gormonlar eng past darajada bo'lgan, tana yangilanadigan va dam olish talab qilinadigan \"tozalanish\" davri. Follikulyar faza (Bahor): estrogen oshishi bilan energiya, ijodkorlik va ijtimoiy faollik yuksaladigan bosqich. Ovulyatsiya (Yoz): homilador bo'lish ehtimoli va o'ziga ishonch cho'qqiga chiqadigan, tananing eng g'ayratli 24-48 soati. Lyuteal faza (Kuz): progesteron ta'sirida tana sekinlashadigan, ko'proq hissiy sezuvchanlik va ichki xotirjamlik talab qilinadigan davr.",
    "ka": "თქვენი მენსტრუალური ციკლი ოთხ ფაზად იყოფა: მენსტრუაცია, ფოლიკულური, ოვულაცია და ლუტეინური. თითოეულ ფაზას სხვადასხვა ჰორმონალური ცვლილება ახლავს. მენსტრუაცია (ზამთარი): «განწმენდის» პერიოდი, როდესაც ჰორმონები ყველაზე დაბალ დონეზეა, ორგანიზმი ახლდება და დასვენებას საჭიროებს. ფოლიკულური ფაზა (გაზაფხული): ეტაპი, როდესაც ესტროგენის მატებასთან ერთად ენერგია, კრეატიულობა და სოციალური აქტიურობა იზრდება. ოვულაცია (ზაფხული): ორგანიზმის ყველაზე ენერგიული 24-48 საათი, როდესაც ჩასახვის ალბათობა და თავდაჯერებულობა პიკზეა. ლუტეინური ფაზა (შემოდგომა): პერიოდი, როდესაც პროგესტერონის გავლენით ორგანიზმი ნელდება და მეტ ემოციურ მგრძნობელობასა და შინაგან სიმშვიდეს საჭიროებს."
  },
  "Məşq Faydaları": {
    "en": "Exercise Benefits",
    "ru": "Польза физических упражнений",
    "tr": "Egzersiz Faydaları",
    "kk": "Жаттығудың пайдасы",
    "de": "Vorteile von Bewegung",
    "ar": "فوائد التمارين الرياضية",
    "uz": "Mashqning foydalari",
    "ka": "ვარჯიშის სარგებელი"
  },
  "Müntəzəm məşq etmək menstrual sancıları yüngülləşdirir və tsikl boyu əhval-ruhiyyəni yüksəldir.": {
    "en": "Regular exercise relieves menstrual cramps and elevates mood throughout the cycle.",
    "ru": "Регулярные физические упражнения облегчают менструальные спазмы и повышают настроение на протяжении всего цикла.",
    "tr": "Düzenli egzersiz yapmak adet kramplarını hafifletir ve döngü boyunca ruh halini iyileştirir.",
    "kk": "Жүйелі жаттығу етеккір кезіндегі түйілуді жеңілдетіп, цикл бойы көңіл күйді жақсартады.",
    "de": "Regelmäßige Bewegung kann Menstruationskrämpfe lindern und deine Stimmung während des gesamten Zyklus verbessern.",
    "ar": "تساعد ممارسة التمارين الرياضية بانتظام على تخفيف تقلصات الدورة الشهرية وتحسين المزاج على مدار الدورة.",
    "uz": "Muntazam mashq qilish hayz og'riqlarini yengillashtiradi va sikl davomida kayfiyatni ko'taradi.",
    "ka": "რეგულარული ვარჯიში მენსტრუალურ სპაზმებს ამსუბუქებს და ციკლის განმავლობაში განწყობას აუმჯობესებს."
  },
  "Enerji Yüksəlir": {
    "en": "Energy Rises", "ru": "Энергия повышается", "tr": "Enerji Yükseliyor",
    "kk": "Қуат артып келеді",
    "de": "Die Energie steigt",
    "ar": "ارتفاع الطاقة",
    "uz": "Energiya ko'tarilmoqda",
    "ka": "ენერგია იმატებს"
  },
  "Estrogen səviyyəsi yüksəlir! Yeni layihələrə başlamaq və çətin işlərin öhdəsindən gəlmək üçün əla zamandır.": {
    "en": "Estrogen levels are rising! It's a great time to start new projects and tackle difficult tasks.", "ru": "Уровень эстрогена повышается! Отличное время для начала новых проектов и решения сложных задач.", "tr": "Östrojen seviyeleri yükseliyor! Yeni projelere başlamak ve zorlu görevlerin üstesinden gelmek için harika bir zaman.",
    "kk": "Эстроген деңгейі жоғарылап келеді! Жаңа жобаларды бастап, күрделі міндеттерді орындауға тамаша уақыт.",
    "de": "Dein Östrogenspiegel steigt! Jetzt ist ein guter Zeitpunkt, um neue Projekte zu beginnen und anspruchsvolle Aufgaben anzugehen.",
    "ar": "يرتفع مستوى الإستروجين! إنه وقت رائع لبدء مشاريع جديدة وإنجاز المهام الصعبة.",
    "uz": "Estrogen darajasi ko'tarilmoqda! Yangi loyihalarni boshlash va murakkab ishlarni uddalash uchun ajoyib vaqt.",
    "ka": "ესტროგენის დონე იმატებს! შესანიშნავი დროა ახალი პროექტების დასაწყებად და რთული ამოცანების შესასრულებლად."
  },
  "Yeni Məşqlər Sınayın": {
    "en": "Try New Workouts", "ru": "Попробуйте новые тренировки", "tr": "Yeni Egzersizler Deneyin",
    "kk": "Жаңа жаттығуларды байқап көріңіз",
    "de": "Neue Work-outs ausprobieren",
    "ar": "جرّبي تمارين جديدة",
    "uz": "Yangi mashqlarni sinab ko'ring",
    "ka": "სცადეთ ახალი ვარჯიშები"
  },
  "Bədəniniz indi daha intensiv məşqlərə hazırdır. HIIT, qaçış və ya ağırlıq məşqlərini sınayın.": {
    "en": "Your body is now ready for more intensive workouts. Try HIIT, running, or weight training.", "ru": "Ваше тело теперь готово к более интенсивным тренировкам. Попробуйте HIIT, бег или силовые тренировки.", "tr": "Vücudunuz artık daha yoğun antrenmanlara hazır. HIIT, koşu veya ağırlık antrenmanlarını deneyin.",
    "kk": "Ағзаңыз қазір қарқындырақ жаттығуларға дайын. HIIT, жүгіру немесе салмақпен жаттығуды байқап көріңіз.",
    "de": "Dein Körper ist jetzt bereit für intensiveres Training. Probiere HIIT, Laufen oder Krafttraining aus.",
    "ar": "جسمكِ مستعد الآن لتمارين أكثر شدة. جرّبي التمارين المتواترة عالية الكثافة (HIIT) أو الجري أو تمارين الأوزان.",
    "uz": "Tanangiz endi yanada intensiv mashqlarga tayyor. HIIT, yugurish yoki og'irlik mashqlarini sinab ko'ring.",
    "ka": "თქვენი სხეული ახლა უფრო ინტენსიური ვარჯიშისთვის მზადაა. სცადეთ HIIT, სირბილი ან ძალისმიერი ვარჯიშები."
  },
  "Protein Gücü": {
    "en": "Protein Power", "ru": "Сила белка", "tr": "Protein Gücü",
    "kk": "Ақуыздың күші",
    "de": "Die Kraft von Protein",
    "ar": "قوة البروتين",
    "uz": "Protein kuchi",
    "ka": "ცილის ძალა"
  },
  "Əzələ inkişafını toyuq, balıq, yumurta və paxlalılar kimi yağsız proteinlərlə dəstəkləyin.": {
    "en": "Support muscle development with lean proteins like chicken, fish, eggs, and legumes.", "ru": "Поддерживайте развитие мышц с помощью нежирных белков, таких как курица, рыба, яйца и бобовые.", "tr": "Kas gelişimini tavuk, balık, yumurta ve baklagiller gibi yağsız proteinlerle destekleyin.",
    "kk": "Бұлшықеттердің дамуын тауық еті, балық, жұмыртқа және бұршақ тұқымдастар сияқты майы аз ақуыз көздерімен қолдаңыз.",
    "de": "Unterstütze deinen Muskelaufbau mit mageren Proteinquellen wie Hähnchen, Fisch, Eiern und Hülsenfrüchten.",
    "ar": "ادعمي نمو العضلات بالبروتينات قليلة الدهون، مثل الدجاج والسمك والبيض والبقوليات.",
    "uz": "Mushaklar rivojini tovuq, baliq, tuxum va dukkaklilar kabi kam yog'li oqsillar bilan qo'llab-quvvatlang.",
    "ka": "კუნთების განვითარებას შეუწყვეთ ხელი უცხიმო ცილებით, როგორიცაა ქათამი, თევზი, კვერცხი და პარკოსნები."
  },
  "Sosial Enerji": {
    "en": "Social Energy", "ru": "Социальная энергия", "tr": "Sosyal Enerji",
    "kk": "Әлеуметтік қуат",
    "de": "Soziale Energie",
    "ar": "الطاقة الاجتماعية",
    "uz": "Ijtimoiy energiya",
    "ka": "სოციალური ენერგია"
  },
  "Özünüzü daha sosial və ünsiyyətcil hiss edə bilərsiniz. Sosiallaşmaq və yeni əlaqələr qurmaq üçün əla zamandır.": {
    "en": "You may feel more social and communicative. It's a great time to socialize and build new connections.", "ru": "Вы можете чувствовать себя более социальными и общительными. Отличное время для общения и установления новых связей.", "tr": "Kendinizi daha sosyal ve iletişimsel hissedebilirsiniz. Sosyalleşmek ve yeni bağlantılar kurmak için harika bir zaman.",
    "kk": "Өзіңізді ашық әрі көпшіл сезінуіңіз мүмкін. Адамдармен араласып, жаңа байланыстар орнатуға тамаша уақыт.",
    "de": "Du fühlst dich vielleicht kontaktfreudiger und geselliger. Jetzt ist ein guter Zeitpunkt, um dich mit anderen zu treffen und neue Kontakte zu knüpfen.",
    "ar": "قد تشعرين برغبة أكبر في التواصل والتفاعل مع الآخرين. إنه وقت رائع للتواصل الاجتماعي وبناء علاقات جديدة.",
    "uz": "O'zingizni ancha ochiq va kirishimli his qilishingiz mumkin. Ijtimoiylashish va yangi aloqalar o'rnatish uchun ajoyib vaqt.",
    "ka": "შესაძლოა თავს უფრო კომუნიკაბელურად და გახსნილად გრძნობდეთ. შესანიშნავი დროა ურთიერთობებისა და ახალი კავშირების დასამყარებლად."
  },
  "Yaradıcılıq Zirvəsi": {
    "en": "Creativity Peak", "ru": "Пик креативности", "tr": "Yaratıcılık Zirvesi",
    "kk": "Шығармашылық шыңы",
    "de": "Kreativität auf dem Höhepunkt",
    "ar": "ذروة الإبداع",
    "uz": "Ijodkorlik cho'qqisi",
    "ka": "კრეატიულობის პიკი"
  },
  "Zehni fəaliyyətiniz güclənib. Bu vaxtı beyin fırtınası, öyrənmək və yaradıcı işlər üçün dəyərləndirin.": {
    "en": "Your mental activity has strengthened. Use this time for brainstorming, learning, and creative work.", "ru": "Ваша умственная активность усилилась. Используйте это время для мозгового штурма, обучения и творческой работы.", "tr": "Zihinsel aktiviteniz güçlendi. Bu zamanı beyin fırtınası, öğrenme ve yaratıcı işler için değerlendirin.",
    "kk": "Ақыл-ой белсенділігіңіз артты. Бұл уақытты ой талқысына, білім алуға және шығармашылық жұмыстарға пайдаланыңыз.",
    "de": "Deine geistige Leistungsfähigkeit ist gesteigert. Nutze diese Zeit für Brainstorming, zum Lernen und für kreative Aufgaben.",
    "ar": "نشاطكِ الذهني في ازدياد. استفيدي من هذا الوقت للعصف الذهني والتعلّم والأعمال الإبداعية.",
    "uz": "Aqliy faoliyatingiz kuchaygan. Bu vaqtni aqliy hujum, o'rganish va ijodiy ishlar uchun sarflang.",
    "ka": "თქვენი გონებრივი აქტივობა გაძლიერებულია. გამოიყენეთ ეს დრო გონებრივი იერიშისთვის, სწავლისა და შემოქმედებითი საქმეებისთვის."
  }
};

export const getTranslatedTip = (text: string, lang: string): string => {
  if (!text) return '';
  if (lang === 'az') return text;
  const bundled = getCachedTranslation(`tip.${text}`, lang);
  if (bundled) return bundled;
  
  // Try exact match (uz/ka üçün ru körpüsü: uz/ka tərcüməsi yoxdursa rus mətn az-dan faydalıdır)
  if (TIP_TRANSLATIONS[text] && (TIP_TRANSLATIONS[text][lang] || ((lang === 'uz' || lang === 'ka') && TIP_TRANSLATIONS[text]['ru']))) {
    return TIP_TRANSLATIONS[text][lang] || TIP_TRANSLATIONS[text]['ru'];
  }
  
  // Try case-insensitive and trimmed match
  const trimmedText = text.trim().toLowerCase();
  for (const [key, translations] of Object.entries(TIP_TRANSLATIONS)) {
    if (key.trim().toLowerCase() === trimmedText) {
      const cached = getCachedTranslation(`tip.${key}`, lang);
      if (cached) return cached;
      if (translations[lang]) return translations[lang];
      if ((lang === 'uz' || lang === 'ka') && translations['ru']) return translations['ru'];
    }
  }
  
  return text;
};
