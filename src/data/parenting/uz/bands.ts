import type { BandOverview } from '../types';
import { S } from './sources';

export const BANDS: BandOverview[] = [
  {
    id: '0-1',
    emoji: '👶',
    title: 'Birinchi yil: ishonch poydevori',
    lead: 'Bu yili chaqaloq dunyo xavfsizmi yoki yoʻqmi, shuni oʻrganadi. Javobni u sening ovozingdan, quchogʻingdan va unga qanday javob berishingdan oladi.',
    brain: [
      'Hayotning ilk yillarida miyada har soniyada bir milliondan ortiq yangi nerv aloqasi hosil boʻladi. Qaysi yoʻllar mustahkamlanishini takrorlanadigan kundalik tajriba hal qiladi: chaqaloq tovush chiqaradi, sen javob berasan; yigʻlaydi, sen yoniga borasan.',
      'Chaqaloq miyasining oʻzini tinchlantiradigan qismi hali juda yosh. Shuning uchun chaqaloq hali oʻzi tinchlana olmaydi, sening xotirjam tanangdan tinchlikni “qarzga oladi”. Bu birgalikdagi boshqaruv (ko-regulyatsiya) deyiladi va kelajakda oʻzini boshqarishning ilk darsidir.',
      'Taxminan 6–9 oylikda xotira va bogʻlanish kuchayadi: chaqaloq notanish odamlardan qoʻrqa boshlashi, sen xonadan chiqqaningda bezovtalanishi mumkin. Bu orqaga ketish emas, aksincha, senga bogʻlanganining belgisi.',
    ],
    needs: [
      'Yigʻisiga javob. Bu yoshda chaqaloqni “qoʻlga oʻrgatib qoʻyish” yoki erkalatib buzish mumkin emas. Tez va mehribon javob unga dunyoga ishonishni oʻrgatadi.',
      'Yuzma-yuz muloqot: tabassum, qoʻshiq, uning tovushlarini takrorlash. Bu “ber va qaytar” oʻyinlari til va hissiyot miyasining asosini quradi.',
      'Oldindan bilsa boʻladigan kun: ovqat, uyqu, choʻmilish taxminan bir xil tartibda. Aniq soat emas, tanish ritm muhim.',
      'Xavfsiz uyqu va xavfsiz muhit, yana dam olgan, qoʻllab-quvvatlanadigan ota-ona.',
    ],
    normal: [
      'Kunning maʼlum soatlarida, ayniqsa kechqurunga yaqin, sababsizdek koʻrinadigan uzoq yigʻilar (ilk 3–4 oyda).',
      'Tunda tez-tez uygʻonish. Birinchi yilda tun boʻyi uxlash har bir chaqaloq uchun meʼyor emas.',
      'Hamma narsani ogʻziga solish: bu uning dunyoni tanish usuli.',
      'Begona odamdan qoʻrqish va sen yoʻqligingda yigʻlash (taxminan 8 oylikdan keyin).',
    ],
    tryThis: [
      'Kuniga bir necha marta 5 daqiqalik “yuzma-yuz vaqt”: telefon chetda, chaqaloqning tovushlarini takrorla, nima qilayotganini soʻz bilan ayt.',
      'Kundalik ishlarni gapirib bajar: “Hozir tagligingni almashtiramiz. Oyogʻingni koʻtaramiz. Tayyor!”',
      'Bekinmachoq oʻyna: bola bu oʻyin orqali “ketgan odam qaytib keladi” degan fikrni oʻrganadi, ajralish qoʻrquvi yumshaydi.',
      'Yigʻi choʻzilib, sabring tugaganda chaqaloqni xavfsiz joyga — beshikka — yotqiz, bir necha daqiqa nafas ol, keyin qayt.',
    ],
    specialist: [
      'Chaqaloq tovushlarga javob bermasa, koʻzingga qaramasa, 4 oylikda jilmaymasa yoki 9 oylikda ismiga javob bermasa.',
      'Avval uddalagan koʻnikmasini (jilmayish, tovush chiqarish, oʻtirish) yoʻqotsa.',
      'Yigʻisi odatdagidan farq qilsa, isitma, qusish, holsizlik yoki ovqatdan bosh tortish bilan birga kelsa: shifokorga murojaat qil. Jiddiy holatda {emergency}.',
      'Agar sen oʻzing haftalab gʻamgin, umidsiz boʻlsang yoki chaqaloqqa zarar yetkazishdan qoʻrqsang: bu tugʻruqdan keyingi depressiya boʻlishi mumkin va u davolanadi. Shifokorga ayt.',
    ],
    sources: [S.harvardServe, S.nurturingCare2018, S.ainsworth1978, S.healthyChildrenCrying, S.zubler2022],
  },
  {
    id: '1-3',
    emoji: '🧸',
    title: '1–3 yosh: “Oʻzim!” davri',
    lead: 'Bola endi yuradi, gapira boshlaydi va mustaqil boʻlishni xohlaydi, ammo hislarini boshqaradigan miya hali juda yosh. Tantrumlar (jazava xurujlari) sababi shu.',
    brain: [
      'Miyaning hissiyot markazi (amigdala) kuchli va tez, uni “tormozlaydigan” peshona poʻstlogʻi esa hali uzoq yillar rivojlanadi. Shuning uchun ikki yoshli bola “toʻxta” desang ham toʻxtay olmaydi. Bu qaysarlik emas, pishib yetilmagan tormoz.',
      'Til tez rivojlanadi, lekin bola tushunadigan narsalar u ayta oladiganidan ancha oldinda. Xohlaganini ayta olmaslik katta alam tugʻdiradi va bu koʻpincha baqirish yoki urish bilan chiqadi.',
      'Bu yoshda bola sabab va oqibatni sinab oʻrganadi: qoshiqni yerga tashlaydi, sening munosabatingga qaraydi, yana tashlaydi. Bu “jahlingni chiqarish uchun” emas, kichkina olimning tajribasi.',
    ],
    needs: [
      'Xotirjam, aniq va takrorlanadigan chegaralar: “Urish mumkin emas. Qoʻllaringni ushlab turaman.” Uzun tushuntirish emas, qisqa gap va harakat.',
      'Tanlash imkoni: “Qizil koʻylakmi yoki koʻkmi?” Tanlov mustaqillik ehtiyojini qondiradi va “yoʻq” deyish zaruratini kamaytiradi.',
      'Hislariga nom berish: “Jahling chiqdi, chunki oʻyin tugadi.” Nomi aytilgan his tezroq tinchlanadi.',
      'Kuniga bir necha daqiqa u boshqaradigan oʻyin, koʻp harakat va ochiq havo.',
    ],
    normal: [
      'Kuniga bir necha marta tantrum, ayniqsa charchaganda, och qolganda yoki bir ishdan boshqasiga oʻtish paytida.',
      '“Yoʻq!” soʻzini koʻp ishlatish, bir narsani qayta-qayta soʻrash.',
      'Boʻlisha olmaslik. Haqiqiy boʻlishish taxminan 3–4 yoshdan keyin shakllanadi.',
      'Ahyon-ahyonda tishlash yoki urish: bu yoshda jismoniy tajovuz eng yuqori choʻqqisiga chiqadi, keyin asta-sekin kamayadi.',
    ],
    tryThis: [
      'Bir ishdan boshqasiga oʻtishdan 5 daqiqa oldin ogohlantir: “Yana ikki marta tepachadan sirgʻanamiz, keyin uyga ketamiz.”',
      '“Yoʻq” oʻrniga “nima qilsa boʻladi”ni ayt: “Devorga emas, mana bu qogʻozga chiz.”',
      'Kuniga 10 daqiqa “uning oʻyini”: u nima qilsa, sen ham shuni qilasan, tanqid va savollar yomgʻirisiz.',
      'Kun davomida yaxshi xatti-harakatni koʻrib, aniq nomini ayt: “Oʻyinchoqni ukangga berding, u qanday xursand boʻldi!”',
    ],
    specialist: [
      '18 oylikda koʻrsatish (barmoq bilan ishora qilish) boʻlmasa, 2 yoshda ikki soʻzli gaplar boʻlmasa, ismiga javob bermasa yoki koʻz bilan aloqa juda kam boʻlsa.',
      'Avval aytgan soʻzlari yoki koʻnikmalarini yoʻqotsa (har qanday yoshda).',
      'Tantrumlar 25 daqiqadan uzoq davom etsa, kuniga 5 tadan koʻp boʻlsa, oʻziga yoki boshqalarga jiddiy shikast yetkazsa yoki 4 yoshdan keyin ham kamaymasa.',
      'Uyqu, ovqatlanish yoki xulq bilan bogʻliq qiyinchiliklar oilaning kundalik hayotini oylab izdan chiqarsa.',
    ],
    sources: [S.harvardEF2011, S.healthyChildrenTantrums, S.cdcPositive, S.tremblay2004, S.zubler2022],
  },
  {
    id: '3-6',
    emoji: '🎨',
    title: '3–6 yosh: xayol, savol va qoida',
    lead: 'Bola “nega?” deb soʻraydi, rolli oʻyinlar quradi, doʻstlikni oʻrganadi. Oʻzini boshqarish koʻnikmasi tez oʻsadi, lekin hali sening yordamingga muhtoj.',
    brain: [
      'Ijro funksiyalari — diqqatni ushlab turish, navbat kutish, qoidani eslab qolish, fikrni oʻzgartirish — 3–5 yosh orasida tez rivojlanadi. Rolli oʻyinlar va qoidali oʻyinlar bu koʻnikmalar uchun eng yaxshi mashq.',
      'Bola endi boshqa odam boshqacha oʻylashi mumkinligini tushuna boshlaydi. Shuning uchun bu yoshda ilk yolgʻonlar paydo boʻladi. Qizigʻi, bu aqliy rivojlanish belgisi.',
      'Tasavvur kuchayadi, haqiqat va toʻqima orasidagi chegara hali xira. Qorongʻidan, maxluqlardan, tushlardan qoʻrqish bu yoshning odatiy qoʻrquvlari.',
    ],
    needs: [
      'Aniq, oz sonli oila qoidalari va ularni izchil qoʻllash. Qoidalar qanchalik oldindan maʼlum boʻlsa, tortishuv shunchalik kam boʻladi.',
      'Jazo emas, mantiqiy oqibatlar: “Agar toʻpni uyda otsang, toʻp shkafga ketadi.”',
      'Hislar haqida suhbat: kitoblar, oʻyinchoqlar bilan oʻyinlar, “sen oʻzingni qanday his qilarding?” degan savollar.',
      'Haqiqiy kichik masʼuliyatlar: dasturxon tuzash, oʻyinchoqlarni yigʻishtirish, gulni sugʻorish.',
    ],
    normal: [
      'Baʼzan yolgʻon gapirish, xayolni haqiqat bilan aralashtirish.',
      'Qoidalarni sinab koʻrish va “adolatsizlik”ka qarshi kuchli munosabat.',
      'Qorongʻidan yoki yangi vaziyatlardan qoʻrqish.',
      'Hali ham vaqti-vaqti bilan tantrumlar, lekin avvalgidan qisqaroq va kamroq.',
    ],
    tryThis: [
      'Kuniga bir marta “kuningning eng yaxshi va eng qiyin lahzasi” haqida soʻra va diqqat bilan tingla.',
      'Qoidalarni birga rasmlar bilan chizib, devorga osib qoʻy.',
      '“Qizil chiroq, yashil chiroq” yoki “Simon aytadi” kabi oʻyinlar bilan oʻzini tutishni mashq qil.',
      'Xato qilganda yechimni birga top: “Suv toʻkildi. Nima qilamiz?”',
    ],
    specialist: [
      '4 yoshda gap tuza olmasa, uning nutqini begonalar qiyinchilik bilan tushunsa, oʻyin sheriklariga umuman qiziqmasa.',
      'Qoʻrquvlar yoki xavotir kundalik hayotni (bogʻcha, uyqu, ovqat) haftalab izdan chiqarsa.',
      'Tajovuz boshqalarga jiddiy zarar yetkazsa yoki kuchayib borsa; hayvonlarga shafqatsizlik boʻlsa.',
      'Uzoq vaqt quruq yurgandan keyin yana kunduzi ishtonini hoʻl qilsa yoki avvalgi koʻnikmalarini yoʻqotsa.',
    ],
    sources: [S.diamond2013, S.harvardEF2011, S.talwarLee2008, S.cdcPositive, S.zubler2022],
  },
  {
    id: '6-12',
    emoji: '🎒',
    title: '6–12 yosh: koʻnikma, doʻstlik, oʻziga ishonch',
    lead: 'Maktab yillari bolaning “men uddalayman” hissini quradigan davr. Doʻstlar muhim boʻlib qoladi, lekin sen hali ham uning asosiy tayanchisan.',
    brain: [
      'Rejalashtirish, diqqat va oʻzini boshqarish koʻnikmalari ancha yaxshi rivojlanadi, ammo charchoq, ochlik va stress ularni osongina “oʻchirib qoʻyadi”. Maktabdan keyin asabiy boʻlgan bola koʻpincha shunchaki holdan toygan bola.',
      'Bola oʻzini boshqalar bilan solishtira boshlaydi. Bu davrda oʻzini qadrlash hissi asosan harakatdan, koʻnikma egallashdan va qabul qilinishdan oziqlanadi.',
      'Oʻsmirlikka yaqin (taxminan 9–12 yosh) gormonal oʻzgarishlar boshlanishi mumkin: kayfiyat oʻzgaruvchanligi, shaxsiy makonga koʻproq ehtiyoj normal holat.',
    ],
    needs: [
      'Harakat va strategiyani koʻradigan ragʻbat: “Bu masala ustida koʻp ishlading, boshqa yoʻlni sinab koʻrding.”',
      'Asta-sekin oshib boradigan masʼuliyat va tanlov huquqi, aniq oila qoidalari bilan birga.',
      'Hukm qilmasdan tinglaydigan ota-ona. Kichik narsalarni tinglasang, katta narsalarni ham senga aytadi.',
      'Ekran va uy vazifasidan tashqari boʻsh vaqt: oʻyin, sport, doʻstlar, uyqu.',
    ],
    normal: [
      'Adolat mavzusida uzoq bahslar, qoidalarni muhokama qilish istagi.',
      'Doʻstlikda arazlashib-yarashishlar, “meni oʻyinga qoʻshishmadi” degan xafagarchilik.',
      'Uy vazifasidan qochish, unutuvchanlik.',
      'Baʼzan ota-onasidan uyalish yoki koʻproq yolgʻiz qolishni xohlash (ayniqsa 10 yoshdan keyin).',
    ],
    tryThis: [
      'Mashinada, ovqat paytida yoki uxlashdan oldin “soʻroqsiz suhbat” vaqti: sen ham oʻz kuning haqida gapir.',
      'Uy vazifasi uchun doimiy vaqt va joy, lekin vazifani uning oʻrniga bajarma.',
      'Oilaviy ekran rejasini birga yozing: qayerda, qachon va qancha.',
      'Haftada bir marta ikkovlon vaqt: faqat sen va u, u tanlagan mashgʻulot.',
    ],
    specialist: [
      'Ikki haftadan ortiq davom etadigan gʻamginlik, qiziqishni yoʻqotish, uyqu yoki ishtahadagi katta oʻzgarish.',
      'Maktabga borishdan qatʼiy bosh tortish, tez-tez qorin va bosh ogʻrigʻidan shikoyat (shifokor sabab topmasa).',
      'Bullingga uchrash yoki boshqalarni bulling qilish belgilari; doʻstlardan butunlay ajralib qolish.',
      'Oʻziga zarar yetkazish, oʻlim yoki oʻz joniga qasd qilish haqida gapirish: buni hech qachon “eʼtibor tortish” deb hisoblama. Darhol mutaxassisga murojaat qil, xavf boʻlsa {emergency}.',
    ],
    sources: [S.cdcPositive, S.aapMediaSchool2016, S.pomerantz2007, S.muellerDweck1998, S.unesco2019],
  },
];
