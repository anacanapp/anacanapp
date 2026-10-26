-- ============================================================
-- OzbekFix6 — exercises.steps_uz (məşq addımları özbəkcə)
-- PROBLEM: exercises cədvəlində steps üçün HEÇ BİR dil sütunu yox idi —
-- addımlar bütün dillərdə Azərbaycanca görünürdü (screenshot: Kegel).
-- 1) steps_uz sütunu (jsonb) əlavə olunur
-- 2) 6 məşqin addımları özbəkcə doldurulur (id-lər content-i18n/chunks-dan)
-- mapRowTranslation('steps') artıq steps_uz-u avtomatik oxuyur.
-- Dollar-quoting istifadə olunur — apostroflu özbək mətni üçün təhlükəsizdir.
-- ============================================================

ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS steps_uz jsonb;

-- Walking / Yurish
UPDATE public.exercises SET steps_uz = $uz$[
"Qulay sport poyabzalini tanlang",
"Yurishni sekin sur'atda boshlang",
"Boshingizni tik tuting va oldinga qarang",
"Qo'llaringizni erkin harakatlantiring",
"Oxirida sur'atni sekinlashtiring"
]$uz$::jsonb WHERE id = '22ebc0af-bddb-4234-a525-709bf9af630b';

-- Squats / Prisedaniya
UPDATE public.exercises SET steps_uz = $uz$[
"1. Boshlang'ich holat",
"Oyoqlaringizni yelka kengligida (yoki biroz kengroq) oching.",
"Oyoq barmoqlaringiz biroz tashqariga qarashi mumkin (ayniqsa homiladorlar uchun bu qulayroq).",
"Belingizni tik tuting, yelkalaringizni orqaga tortib, oldinga qarang.",
"2. Harakatning bajarilishi",
"O'tiring: chanoqni orqaga itarib, sekin-asta pastga tushing. Tasavvur qiling, orqangizda ko'rinmas stul bor va unga o'tirmoqchisiz.",
"Tizzalarga e'tibor: tizzalaringiz oyoq barmoqlaringiz yo'nalishida bo'lsin. Ularning ichkariga bukilishiga (\"X\" shakl olishiga) yo'l qo'ymang.",
"Chuqurlik: sonlaringiz yerga parallel bo'lguncha tushishga harakat qiling. (Homilador bo'lsangiz yoki tizzangizda muammo bo'lsa, to'liq parallel bo'lmasa ham bo'ladi — o'zingizni qulay his qilgan darajagacha tushing.)",
"Ko'tariling: tovonlardan kuch olib (panjadan emas) boshlang'ich holatga qayting. Ko'tarilayotganda dumba mushaklarini qising.",
"3. Nafas texnikasi",
"Tushayotganda: burun bilan chuqur nafas oling.",
"Ko'tarilayotganda: og'iz bilan nafas chiqaring."
]$uz$::jsonb WHERE id = '4cc80a24-3b16-46a1-bc30-9e0d6283d28d';

-- Kegel Exercises / Kegel mashqlari
UPDATE public.exercises SET steps_uz = $uz$[
"Qulay holat tanlang: dastlab yotgan holda boshlash osonroq, keyinchalik buni o'tirgan yoki tik turgan holda ham bajarishingiz mumkin.",
"Harakatning bajarilishi",
"Qising: chanoq tubi mushaklarini sekin qising — go'yo yel chiqarmaslikka yoki siydikni ushlab qolishga harakat qilayotgandek.",
"Ushlab turing: mushaklarni qisilgan holatda 3-5 soniya ushlab turing.",
"Bo'shating: mushaklarni sekin bo'shating va 3-5 soniya dam oling."
]$uz$::jsonb WHERE id = 'd64a9d01-c6f1-4f18-a93c-c781920c14f9';

-- Pregnancy Yoga / Homiladorlik yogasi
UPDATE public.exercises SET steps_uz = $uz$[
"1. To'g'ri nafas olish texnikasi (Pranayama)",
"Tug'ruq paytida to'lg'oqlarni boshqarish uchun eng muhim qism.",
"Qanday bajariladi: qulay holatda o'tiring (chordana qurib yoki stulda). Bir qo'lingizni ko'krak qafasiga, ikkinchisini qorningizning pastiga qo'ying. Burun bilan chuqur nafas oling — bunda ko'krak emas, qorin oldinga shishishi kerak. Nafasni og'iz orqali sekin, sham puflayotgandek chiqaring.",
"Foydasi: chaqaloqqa maksimal kislorod boradi va ona tinchlanadi.",
"2. Mushuk-Sigir holati (Cat-Cow Stretch)",
"Bel va yelka og'riqlari uchun eng yaxshi harakat. Chaqaloqning to'g'ri holat olishiga yordam beradi.",
"Texnika: to'rt oyoqlab turing (qo'llar yelka kengligida, tizzalar son kengligida).",
"Nafas olayotganda: boshingizni sekin ko'taring, umurtqangizni biroz pastga tushiring (lekin belni ortiqcha egmang).",
"Nafas chiqarayotganda: iyakni ko'krakka torting va yelkangizni \"bo'rttiring\" (mushuk kabi).",
"Buni 5-10 marta ravon tarzda takrorlang.",
"3. Kapalak holati (Bound Angle Pose / Baddha Konasana)",
"Bu harakat chanoq tubi mushaklarini ochadi va tug'ruq yo'llarini elastik qiladi.",
"Texnika: yerga o'tiring, belingizni tik tuting.",
"Tovonlarni birlashtirib, o'zingizga torting.",
"Tizzalaringizni yon tomonga, yerga qarab erkin qo'yib yuboring (kuch bilan bosmang).",
"Qo'llaringiz bilan oyoqlaringizdan ushlab, shu holatda chuqur nafas olgan holda 1-2 daqiqa qoling.",
"Tizzalaringiz ostiga yostiq qo'yishingiz mumkin.",
"4. Keng bola holati (Wide-Knee Child's Pose)",
"Dam olish va chov sohasini bo'shashtirish uchun ishlatiladi.",
"Texnika: tizzalaringiz ustida o'tiring.",
"Tizzalarni qorningiz sig'adigan darajada keng oching.",
"Qo'llaringizni oldinga uzatib, peshonangizni yerga (yoki yostiqqa) qo'ying.",
"Tanangizni butunlay bo'shashtiring.",
"5. Jangchi II (Warrior II) — tayanch bilan",
"Oyoqlarni kuchaytirish va chidamlilikni oshirish uchun.",
"Texnika: tik turing va oyoqlarni keng oching.",
"O'ng oyoqni 90 daraja yon tomonga buring, chap oyoq to'g'ri qolsin.",
"O'ng tizzani buking (tizza to'piqdan o'tmasligi kerak).",
"Qo'llarni yon tomonlarga oching va 3-5 nafas shu holatda qoling.",
"Muvozanatni saqlash uchun devordan tayanch olishingiz mumkin."
]$uz$::jsonb WHERE id = 'da9c9ebf-19ec-409f-bf83-37679d679447';

-- Swimming / Suzish
UPDATE public.exercises SET steps_uz = $uz$[
"1. Foydalari",
"Bo'g'imlarni himoya qiladi: yugurish yoki sakrash kabi sportlardan farqli o'laroq, suvda tizza va belga zarba tushmaydi.",
"Shishishni (edema) kamaytiradi: suv bosimi limfa aylanishini yaxshilaydi — bu oyoq va qo'llardagi shishishni qaytarishga yordam beradi (ayniqsa homiladorlar uchun ajoyib).",
"Belni bo'shashtiradi: umurtqa pog'onasiga tushadigan yuk kamayadi — bu bel og'riqlarini darhol yengillashtiradi.",
"Salqinlashtiruvchi ta'sir: issiq havoda yoki tana harorati ko'tarilganda eng yaxshi salqinlash usuli.",
"2. Tavsiya etiladigan uslublar",
"Har bir uslub turli mushaklarni ishlatadi, lekin salomatlik uchun eng qulaylari quyidagilar:",
"Qurbaqa uslubi (Brass): eng ko'p tavsiya etiladigan uslub. Bo'yin va bosh suv ustida qolgani uchun nafas olish oson va atrofni bemalol ko'rasiz. Ko'krak mushaklarini ochadi.",
"Chalqancha suzish (Backstroke): suv ustida yotish umurtqani tekislaydi va dam olish uchun ideal. Lekin qayoqqa suzayotganingizni ko'rish qiyin bo'lgani uchun havzaning bo'sh vaqtlarida bajarish tavsiya etiladi.",
"3. E'tibor berish kerak bo'lgan jihatlar",
"Sirpanchiq pollar: havza atrofi juda sirpanchiq bo'ladi. Albatta rezina tagli sirpanmaydigan shippak kiying va sekin yuring.",
"Suv harorati: suv juda sovuq yoki juda issiq (jakuzi kabi) bo'lmasligi kerak. Ideal harorat — 27-30°C oralig'ida.",
"Nafasni ushlab turish: nafasingizni suv ostida uzoq ushlab turmang — bu bosh aylanishiga olib kelishi mumkin. Ritmni saqlang: suv ostida nafas chiqaring, boshni ko'targanda nafas oling.",
"Suyuqlik ichish: suvda terlaganingizni sezmasligingiz mumkin, lekin tana suyuqlik yo'qotadi. Mashqdan oldin va keyin albatta suv iching."
]$uz$::jsonb WHERE id = 'dda0e0da-1048-498d-a3a1-4358713e2e96';

-- Breathing Exercises / Nafas mashqlari
UPDATE public.exercises SET steps_uz = $uz$[
"Burningizdan sekin va chuqur nafas oling (4 soniya).",
"Nafas olayotganda ko'krak emas, qorin oldinga shishishi kerak (qo'lingizni qorningizga qo'yib tekshirishingiz mumkin).",
"Og'zingizdan, go'yo shamni o'chirmasdan titratayotgandek, sekin nafas chiqaring (6 soniya).",
"Butun tanangizni (yelkalar, yuz, iyak) bo'shashtiring."
]$uz$::jsonb WHERE id = 'e32f03c4-350a-455b-b70d-ff659812a45e';
