import type { MilestoneQuiz, StyleQuiz } from '../types';
import { S } from './sources';

export const STYLE_QUIZ: StyleQuiz = {
  id: 'style',
  emoji: '🪞',
  title: 'Mening tarbiya uslubim',
  intro: '12 ta qisqa jumla. Oxirgi ikki haftani oʻylab koʻr va samimiy javob ber — bu yerda toʻgʻri yoki notoʻgʻri javob yoʻq. Natija faqat sening telefoningda qoladi.',
  scale: ['Deyarli hech qachon', 'Baʼzan', 'Tez-tez', 'Deyarli har doim'],
  items: [
    { text: 'Bolam xafa yoki jahli chiqqan paytda hissiga nom berib, yonida boʻlaman.', dim: 'warmth' },
    { text: 'Kun davomida uni quchoqlash, birga kulish, “seni yaxshi koʻraman” deyish uchun vaqt topaman.', dim: 'warmth' },
    { text: 'Bolam gapirganda telefonni chetga qoʻyib tinglayman.', dim: 'warmth' },
    { text: 'Uning yaxshi xatti-harakatlarini koʻrib, nomini aytaman.', dim: 'warmth' },
    { text: 'Uyda bolam biladigan bir nechta aniq qoida bor.', dim: 'structure' },
    { text: 'Qoidani qoʻygandan keyin unga xotirjam amal qilaman.', dim: 'structure' },
    { text: 'Kundalik tartibimiz (ovqat, uyqu) taxminan barqaror.', dim: 'structure' },
    { text: 'Bolam yigʻlaganda yoki qattiq turib olganda, aytgan “yoʻq”imdan qaytaman.', dim: 'giveIn' },
    { text: 'Charchaganimda qoidalarni butunlay tashlab yuboraman, “nima xohlasa, qilsin”.', dim: 'giveIn' },
    { text: 'Asabiylashganda ovozimni koʻtaraman yoki baqiraman.', dim: 'harsh' },
    { text: 'Bolamni qoʻrqitaman (“seni shu yerda qoldirib ketaman”, “militsiyaga beraman”).', dim: 'harsh' },
    { text: 'Jahl paytida uni urgim yoki qoʻpol soʻzlar aytgim keladi va baʼzan shunday qilaman.', dim: 'harsh' },
  ],
  results: {
    balanced: {
      title: 'Iliq va aniq',
      short: 'Sen ham mehr koʻrsatasan, ham aniq chegara qoʻyasan — tadqiqotlar eng foydali deb hisoblagan uygʻunlik.',
      detail: [
        'Psixologlar bu uslubni “avtoritativ” deb atashadi: yuqori mehr va yuqori tuzilma. Bu uslubda ulgʻaygan bolalar oʻrtacha hisobda mustaqilroq, oʻziga ishongan boʻladi va hislarini yaxshiroq boshqaradi.',
        'Bu mukammal boʻlish degani emas. Sen ham charchaysan, baʼzan sabring tugaydi. Farqni yaratadigan narsa — qiyin lahzalardan keyin munosabatga qaytishing.',
      ],
      next: ['Bola ulgʻaygan sari qoidalarni u bilan birga tuzishni boshla.', 'Oʻzingga gʻamxoʻrlikni unutma: xotirjam ota-ona boʻlish uchun dam olish kerak.', '“Maxsus vaqt” odatini saqla — bu eng kuchli “sugʻurta”.'],
    },
    gentle: {
      title: 'Juda iliq, chegaralar yumshoq',
      short: 'Bolang bilan juda yaqinsan va uning hislariga sezgirsan. Baʼzan chegaralarni saqlash qiyin tuyuladi.',
      detail: [
        'Mehr — sening eng kuchli tomoning va bu bolaning xavfsiz bogʻlanishi uchun bebaho. Ammo bolalar chegaralarni ular joyidami-yoʻqmi, bilish uchun sinaydi. Chegara yumshaganda bola koʻproq sinaydi, ota-ona esa holdan toyadi.',
        'Mehr va chegara bir-biriga zid emas. “Seni yaxshi koʻraman va javob baribir yoʻq” deyish bolaga xavfsizlik beradi.',
      ],
      next: ['3–5 ta aniq oila qoidasini tanla va ularni xotirjam qoʻlla.', 'Tantrum paytida hamdardlik koʻrsat, lekin qarorni oʻzgartirma.', '“21 kun baqirmasdan” dasturidagi “bir gap, bir marta” qadamini sinab koʻr.'],
    },
    storm: {
      title: 'Mehrga toʻla, lekin charchagan paytda portlaydigan',
      short: 'Bolangga juda bogʻlangansan, lekin stressli paytlarda ovoz koʻtariladi. Bu koʻp ota-onalarga tanish holat.',
      detail: [
        'Sening mehring — kuchli poydevor. Baqirish va qoʻpol soʻzlar esa koʻpincha mehrsizlikning emas, charchoq, shoshilish va yolgʻiz qolishning natijasi.',
        'Tadqiqotlar koʻrsatadiki, munosabat iliq boʻlsa ham, muntazam baqirish bolaning xulqiga salbiy taʼsir qiladi. Yaxshi xabar: oʻzini boshqarish oʻrganiladigan koʻnikma va tiklanish suhbatlari munosabatni asraydi.',
      ],
      next: ['Qoʻzgʻatuvchilaringni top: qaysi soatlar, qaysi vaziyatlar?', '“Pauza tugmasi” va uzun nafas chiqarishdan boshla.', '“21 kun baqirmasdan” dasturi aynan sen uchun.'],
    },
    strict: {
      title: 'Chegaralar kuchli, mehr yashirin',
      short: 'Sen tartib va qoidaga katta ahamiyat berasan. Baʼzan bu mehr va tinglash hisobiga boʻladi.',
      detail: [
        'Qoidalar va izchillik bola uchun muhim — bu sening kuchli tomoning. Lekin tadqiqotlarga koʻra, qattiq nazorat va jazo bilan qoʻyilgan chegaralar uzoq muddatli xulq muammolarini kamaytirmaydi, aksincha, koʻpaytirishi mumkin.',
        'Qoidalarni saqlagan holda mehrni oshirish mumkin: tushuntirish, hissiga nom berish, yaxshi xatti-harakatni koʻrish.',
      ],
      next: ['Har kuni 10 daqiqa bola boshqaradigan oʻyin vaqti.', 'Jazo oʻrniga mantiqiy oqibatlardan foydalan.', 'Bitta qoidani tushuntir: “Bu qoida bor, chunki…”'],
    },
    stretched: {
      title: 'Charchagan va holdan toygan',
      short: 'Koʻrinishidan, soʻnggi paytlarda juda charchagansan. Bu yomon ota-ona ekaningni emas, yordamga ehtiyoj borligini bildiradi.',
      detail: [
        'Ota-ona holdan toyganda na mehr, na tuzilma uchun kuch qoladi. Bu juda keng tarqalgan va tushunarli holat, ayniqsa chaqaloq, uyqusizlik, ish va yolgʻizlik boʻlganda.',
        'Bu natija seni ayblash emas, oʻzingga ham gʻamxoʻrlik kerakligini koʻrsatadi. Kichik qadamlar va yordam soʻrash hamma narsani oʻzgartirishi mumkin.',
      ],
      next: ['Yukni boʻlish: turmush oʻrtogʻing, oilang, doʻstlaring bilan aniq yordam haqida kelishib ol.', 'Kuniga bitta 5 daqiqalik yaqinlik lahzasi: faqat quchoq va koʻzga qarash.', 'Ikki haftadan ortiq gʻamginlik yoki umidsizlik his qilsang, shifokor yoki psixolog bilan gaplash.'],
    },
  },
  note: 'Bu test tashxis emas, oʻzingni kuzatish uchun oddiy vosita. Baumrindning mehr va tuzilma oʻlchovlariga asoslangan.',
  sources: [S.baumrind1966, S.baumrind1967, S.pinquart2017, S.wangKenny2014],
};

export const MILESTONE_QUIZ: MilestoneQuiz = {
  id: 'milestones',
  emoji: '🧩',
  title: 'Bolam bu yoshda nimalarni uddalashi kerak?',
  intro: 'CDC va Amerika Pediatriya Akademiyasining rivojlanish bosqichlariga asoslangan qisqa tekshiruv. Koʻpchilik bolalar (taxminan 4 tadan 3 tasi) bu yoshda shu koʻnikmalarni koʻrsatadi. Har bir bola oʻz surʼatida rivojlanadi.',
  answers: { yes: 'Ha', no: 'Hali yoʻq', unsure: 'Ishonchim komil emas' },
  regression: 'Avval uddalagan biror koʻnikmasini (soʻz, oʻyin, harakat) yoʻqotdimi?',
  checkpoints: [
    {
      id: 'm4',
      fromMonths: 4,
      title: '4 oy',
      items: [
        { text: 'Seni koʻrganda oʻzi jilmayadi, eʼtiboringni tortishga harakat qiladi.', flag: true, support: 'Yuzma-yuz koʻp vaqt oʻtkaz: jilmay, kut, uning tabassumiga javob ber.' },
        { text: '“A-a”, “u-u” kabi tovushlar chiqaradi, sen gapirganingda tovush bilan javob beradi.', support: 'Uning tovushlariga taqlid qil, keyin “javob” berishi uchun pauza qil.' },
        { text: 'Ovozingni eshitganda boshini tovush tomonga buradi.', flag: true, support: 'Turli tomonlardan ismini yumshoq ovozda chaqir.' },
        { text: 'Quchoqda boʻlganda boshini tayanchsiz tik tutadi.', support: 'Uygʻoq paytida kuniga bir necha marta qisqa “qorin ustida vaqt”.' },
        { text: 'Qoʻliga berilgan oʻyinchoqni ushlab turadi.', support: 'Yengil, ushlash oson boʻlgan shaqildoq oʻyinchoqlar ber.' },
        { text: 'Qorni bilan yotganda tirsaklariga tayanib boshini koʻtaradi.', support: 'Oldiga koʻzgu yoki rangli oʻyinchoq qoʻy.' },
      ],
    },
    {
      id: 'm9',
      fromMonths: 9,
      title: '9 oy',
      items: [
        { text: 'Ismini chaqirganda qaraydi.', flag: true, support: 'Oʻyinlarda ismini tez-tez ishlat, qaraganda jilmay va maqta.' },
        { text: '“Ma-ma-ma”, “ba-ba-ba” kabi turli boʻgʻinlarni aytadi.', flag: true, support: 'Boʻgʻinlarni birga takrorlanglar, qoʻshiqlar ayt.' },
        { text: 'Quchoqqa olinish uchun qoʻllarini koʻtaradi.', support: 'Koʻtarishdan oldin soʻra: “Quchoqqami?” va qoʻllarini ochishini kut.' },
        { text: 'Yerga tushgan narsaning ortidan qaraydi, uni qidiradi.', support: 'Bekinmachoq va “oʻyinchoq qani?” oʻyinlarini oʻyna.' },
        { text: 'Tayanchsiz oʻtiradi.', support: 'Polda xavfsiz oʻyin vaqtini ber, oʻtirishini yostiqlar bilan himoya qil.' },
        { text: 'Notanish odamlardan hadiksiraydi yoki senga yopishadi.', support: 'Bu bogʻlanish belgisi. Yangi odamlar bilan tanishishni shoshiltirma.' },
      ],
    },
    {
      id: 'm18',
      fromMonths: 18,
      title: '18 oy',
      items: [
        { text: 'Qiziq narsani senga koʻrsatish uchun barmogʻi bilan ishora qiladi.', flag: true, support: 'Oʻzing ham koʻrsat va nomla: “Qara, qush!” Koʻrsatganda jon deb javob ber.' },
        { text: '“Ona, ota”dan tashqari kamida 3 ta soʻz aytadi.', flag: true, support: 'Kundalik ishlarni gapirib bajar, uning soʻzlarini kengaytir.' },
        { text: 'Imo-ishorasiz oddiy topshiriqni bajaradi (“toʻpni ber”).', support: 'Topshiriqni qisqa ayt, bajarganda quvonch bilan rahmat ayt.' },
        { text: 'Tayanchsiz yuradi.', flag: true, support: 'Yalangoyoq, xavfsiz joyda koʻp harakat qilish imkonini ber.' },
        { text: 'Uy ishlarida senga taqlid qiladi (supurish, telefonda gaplashish).', support: 'Kichkina supurgi, oʻyinchoq idish-tovoq ber, birga “ish qilinglar”.' },
        { text: 'Barmoqlari bilan oʻzi yeydi, qoshiqdan foydalanishga urinadi.', support: 'Bulgʻanishiga ruxsat ber, qoʻl bilan yeyiladigan ovqatlar taklif qil.' },
      ],
    },
    {
      id: 'm30',
      fromMonths: 30,
      title: '2,5 yosh',
      items: [
        { text: 'Taxminan 50 ta soʻz aytadi.', support: 'Birga kitob oʻqinglar, rasmlarni nomlanglar, ochiq savollar ber.' },
        { text: 'Feʼlli ikki soʻzni birlashtiradi (“mushuk yuguryapti”).', flag: true, support: 'Uning bitta soʻzini ikki soʻzga kengaytir: “Mashina.” — “Katta mashina ketyapti!”' },
        { text: '“Men”, “meniki”, “biz” soʻzlarini ishlatadi.', support: 'Navbatli oʻyinlarda “mening navbatim, sening navbating” de.' },
        { text: 'Rolli oʻyin oʻynaydi (qoʻgʻirchoqni ovqatlantirish, gʻishtchani mashina qilib haydash).', flag: true, support: 'Rolli oʻyinga qoʻshil, oddiy ssenariylar taklif qil.' },
        { text: 'Ikki qadamli topshiriqni bajaradi (“oʻyinchoqni ol va qutiga qoʻy”).', support: 'Topshiriqlarni oʻyin orqali ber, avval bir qadamni, keyin ikki qadamni mashq qil.' },
        { text: 'Ikki oyoqlab yerdan sakraydi.', support: 'Ochiq havoda sakrash oʻyinlari, “quyoncha” oʻyini.' },
      ],
    },
    {
      id: 'm48',
      fromMonths: 48,
      title: '4 yosh',
      items: [
        { text: '4 va undan koʻp soʻzli gaplar tuzadi.', flag: true, support: 'Kun haqida gaplashinglar, uning hikoyasini savollar bilan kengaytiringlar.' },
        { text: 'Kun davomida boʻlgan biror voqeani aytib beradi.', support: 'Kechqurun “kunning eng yaxshi lahzasi” haqida suhbatlashinglar.' },
        { text: 'Oʻyinda boshqa birovga aylanadi (oʻqituvchi, superqahramon).', support: 'Kostyumlar, rolli oʻyinlar uchun vaqt va materiallar ber.' },
        { text: 'Boshqa bolalar bilan oʻynashdan zavq oladi, ularga tasalli beradi.', flag: true, support: 'Doʻstlar bilan qisqa uchrashuvlar tashkil qil, hislarni nomlashga yordam ber.' },
        { text: 'Bir nechta rangning nomini aytadi.', support: 'Kundalik hayotda ranglarni nomlanglar, oʻyinga aylantiringlar.' },
        { text: 'Katta toʻpni koʻpincha ilib oladi, qalamni barmoqlari bilan ushlaydi.', support: 'Toʻp oʻyinlari, rasm chizish, plastilin.' },
      ],
    },
    {
      id: 'y6',
      fromMonths: 72,
      title: 'Maktab yoshi (6–12)',
      items: [
        { text: 'Kundalik oʻziga qarashni (kiyinish, tish yuvish) asosan oʻzi bajaradi.', support: 'Yoshiga mos mustaqillik ber, rasmli tartiblar bilan qoʻllab-quvvatla.' },
        { text: 'Kamida bitta doʻsti bor va u bilan oʻynashdan zavq oladi.', flag: true, support: 'Doʻstliklarga imkon yarat, ijtimoiy koʻnikmalarni uyda mashq qilinglar.' },
        { text: 'Oʻyin qoidalariga amal qiladi, navbatini kuta oladi.', support: 'Oila bilan qoidali stol oʻyinlarini oʻynanglar.' },
        { text: 'Hislarini soʻz bilan tushuntira oladi.', support: 'Hislar haqida gaplashishni kundalik odatga aylantir.' },
        { text: 'Oʻqish va sanash koʻnikmalari sinfiga mos ravishda rivojlanyapti.', flag: true, support: 'Oʻqituvchi bilan aloqada boʻl, birga oʻqinglar, harakatini qadrla.' },
        { text: 'Asabiylashgandan keyin oqilona vaqt ichida tinchlanadi.', support: 'Tinchlanish usullarini birga tanlanglar va mashq qilinglar.' },
      ],
    },
  ],
  results: {
    ontrack: {
      title: 'Hammasi joyida',
      short: 'Bolang bu yosh uchun kutiladigan koʻnikmalarning koʻpini koʻrsatyapti.',
      detail: [
        '“Hali yoʻq” javoblari boʻlsa, xavotir olma: bolalar baʼzi koʻnikmalarni biroz kechroq, baʼzilarini esa ertaroq egallaydi.',
        'Har bir koʻrikda shifokordan rivojlanish haqida savollaringni soʻra — bu kuzatib borishning eng yaxshi yoʻli.',
      ],
    },
    watch: {
      title: 'Bir nechta koʻnikma hali shakllanmoqda',
      short: 'Bir nechta “hali yoʻq” yoki “ishonchim komil emas” javobi bor. Bu koʻnikmalarni kundalik oʻyin orqali qoʻllab-quvvatlashing mumkin.',
      detail: [
        'Quyidagi maslahatlar bilan 4–6 hafta qoʻllab-quvvatla va qayta tekshir.',
        'Xavotiring davom etsa, keyingi koʻrikni kutmasdan pediatr bilan gaplash. Erta yordam har doim kutishdan yaxshiroq.',
      ],
    },
    talk: {
      title: 'Pediatr bilan gaplashishni tavsiya qilamiz',
      short: 'Baʼzi javoblar shifokor koʻrib chiqishi kerak boʻlgan signallar. Bu tashxis emas, lekin kutish shart emas.',
      detail: [
        'Koʻnikmani yoʻqotish (regress) yoki muhim bosqichlarning kechikishi erta baholashni talab qiladi. Erta boshlangan yordam eng yaxshi natijani beradi.',
        'Shifokorga borganda bu roʻyxatni koʻrsatishing mumkin.',
      ],
    },
  },
  note: 'Bu tekshiruv skrining vositasi va tashxis emas. Xavotiring boʻlsa, natijadan qatʼi nazar shifokorga murojaat qil.',
  sources: [S.zubler2022, S.cdcActEarly],
};
