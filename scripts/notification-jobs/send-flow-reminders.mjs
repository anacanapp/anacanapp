// Node.js port of supabase/functions/send-flow-reminders/index.ts
import { getFirebaseAccessToken, sendFCMv1 } from './shared/fcm.mjs';
import { startRunLog, finishRunLog, logFailedSend, bumpReason } from './shared/notif-logging.mjs';
import { query, closePool } from './shared/db.mjs';

const TEST_USER_ID = process.env.TEST_USER_ID || null;
const manual = !!TEST_USER_ID;

// Statik flow bildirişlərinin default mətnləri — tətbiqin 21 dilinin hamısında.
// ƏSL Deno faylı ilə SÖZ-BƏ-SÖZ eynidir.
const DEFAULTS = {
  az: {
    period_start: { title: () => 'Period yaxınlaşır 🔴', body: (d) => `Perioda ${d} gün qaldı!` },
    period_end: { title: () => 'Period bitdi ✅', body: () => 'Periodunuz sona çatdı!' },
    ovulation: { title: () => 'Ovulyasiya günü 🌸', body: (d) => `Ovulyasiyaya ${d} gün qaldı!` },
    fertile_start: { title: () => 'Məhsuldar günlər 💕', body: () => 'Məhsuldar günlər başlayır!' },
    fertile_end: { title: () => 'Məhsuldar günlər bitir 📅', body: () => 'Məhsuldar günlər sona çatır.' },
    pms: { title: () => 'PMS dövrü ⚡', body: () => 'PMS dövrü yaxınlaşır, özünüzə baxın!' },
    pill: { title: () => 'Həb vaxtı 💊', body: () => 'Gündəlik həbinizi qəbul etməyi unutmayın!' },
  },
  en: {
    period_start: { title: () => 'Period is coming 🔴', body: (d) => `${d} day(s) until your period!` },
    period_end: { title: () => 'Period ended ✅', body: () => 'Your period is over!' },
    ovulation: { title: () => 'Ovulation day 🌸', body: (d) => `${d} day(s) until ovulation!` },
    fertile_start: { title: () => 'Fertile window 💕', body: () => 'Your fertile window starts!' },
    fertile_end: { title: () => 'Fertile window ending 📅', body: () => 'Your fertile window is ending.' },
    pms: { title: () => 'PMS period ⚡', body: () => 'PMS is coming, take care of yourself!' },
    pill: { title: () => 'Pill time 💊', body: () => "Don't forget to take your daily pill!" },
  },
  ru: {
    period_start: { title: () => 'Менструация приближается 🔴', body: (d) => `До менструации ${d} дн.!` },
    period_end: { title: () => 'Менструация закончилась ✅', body: () => 'Ваша менструация завершилась!' },
    ovulation: { title: () => 'День овуляции 🌸', body: (d) => `До овуляции ${d} дн.!` },
    fertile_start: { title: () => 'Фертильные дни 💕', body: () => 'Начинаются фертильные дни!' },
    fertile_end: { title: () => 'Фертильные дни заканчиваются 📅', body: () => 'Фертильные дни подходят к концу.' },
    pms: { title: () => 'Период ПМС ⚡', body: () => 'Приближается ПМС — позаботьтесь о себе!' },
    pill: { title: () => 'Время таблетки 💊', body: () => 'Не забудьте принять ежедневную таблетку!' },
  },
  tr: {
    period_start: { title: () => 'Regl yaklaşıyor 🔴', body: (d) => `Regl dönemine ${d} gün kaldı!` },
    period_end: { title: () => 'Regl bitti ✅', body: () => 'Regl döneminiz sona erdi!' },
    ovulation: { title: () => 'Ovülasyon günü 🌸', body: (d) => `Ovülasyona ${d} gün kaldı!` },
    fertile_start: { title: () => 'Doğurgan günler 💕', body: () => 'Doğurgan günler başlıyor!' },
    fertile_end: { title: () => 'Doğurgan günler bitiyor 📅', body: () => 'Doğurgan günler sona eriyor.' },
    pms: { title: () => 'PMS dönemi ⚡', body: () => 'PMS dönemi yaklaşıyor, kendinize iyi bakın!' },
    pill: { title: () => 'Hap zamanı 💊', body: () => 'Günlük hapınızı almayı unutmayın!' },
  },
  kk: {
    period_start: { title: () => 'Етеккір жақындап қалды 🔴', body: (d) => `Етеккірге дейін ${d} күн қалды!` },
    period_end: { title: () => 'Етеккір аяқталды ✅', body: () => 'Етеккіріңіз аяқталды!' },
    ovulation: { title: () => 'Овуляция күні 🌸', body: (d) => `Овуляцияға дейін ${d} күн қалды!` },
    fertile_start: { title: () => 'Фертильді күндер 💕', body: () => 'Фертильді күндер басталады!' },
    fertile_end: { title: () => 'Фертильді күндер аяқталады 📅', body: () => 'Фертильді күндер аяқталып келеді.' },
    pms: { title: () => 'ПМС кезеңі ⚡', body: () => 'ПМС кезеңі жақындап қалды, өзіңізге күтім жасаңыз!' },
    pill: { title: () => 'Дәрі қабылдау уақыты 💊', body: () => 'Күнделікті дәріңізді қабылдауды ұмытпаңыз!' },
  },
  uz: {
    period_start: { title: () => 'Hayz yaqinlashmoqda 🔴', body: (d) => `Hayzgacha ${d} kun qoldi!` },
    period_end: { title: () => 'Hayz tugadi ✅', body: () => 'Hayz davringiz yakunlandi!' },
    ovulation: { title: () => 'Ovulyatsiya kuni 🌸', body: (d) => `Ovulyatsiyagacha ${d} kun qoldi!` },
    fertile_start: { title: () => 'Fertil kunlar 💕', body: () => 'Fertil kunlar boshlanmoqda!' },
    fertile_end: { title: () => 'Fertil kunlar tugayapti 📅', body: () => 'Fertil kunlar yakunlanmoqda.' },
    pms: { title: () => 'PMS davri ⚡', body: () => 'PMS davri yaqinlashmoqda, oʻzingizga gʻamxoʻrlik qiling!' },
    pill: { title: () => 'Tabletka vaqti 💊', body: () => 'Kundalik tabletkangizni qabul qilishni unutmang!' },
  },
  ka: {
    period_start: { title: () => 'მენსტრუაცია ახლოვდება 🔴', body: (d) => `მენსტრუაციამდე ${d} დღე დარჩა!` },
    period_end: { title: () => 'მენსტრუაცია დასრულდა ✅', body: () => 'თქვენი მენსტრუაცია დასრულდა!' },
    ovulation: { title: () => 'ოვულაციის დღე 🌸', body: (d) => `ოვულაციამდე ${d} დღე დარჩა!` },
    fertile_start: { title: () => 'ფერტილური დღეები 💕', body: () => 'ფერტილური დღეები იწყება!' },
    fertile_end: { title: () => 'ფერტილური დღეები სრულდება 📅', body: () => 'ფერტილური დღეები სასრულს უახლოვდება.' },
    pms: { title: () => 'PMS პერიოდი ⚡', body: () => 'PMS პერიოდი ახლოვდება — მოუარეთ საკუთარ თავს!' },
    pill: { title: () => 'აბის დროა 💊', body: () => 'არ დაგავიწყდეთ ყოველდღიური აბის მიღება!' },
  },
  de: {
    period_start: { title: () => 'Die Periode rückt näher 🔴', body: (d) => `Noch ${d} Tag(e) bis zu deiner Periode!` },
    period_end: { title: () => 'Die Periode ist vorbei ✅', body: () => 'Deine Periode ist zu Ende!' },
    ovulation: { title: () => 'Tag des Eisprungs 🌸', body: (d) => `Noch ${d} Tag(e) bis zum Eisprung!` },
    fertile_start: { title: () => 'Fruchtbare Tage 💕', body: () => 'Deine fruchtbaren Tage beginnen!' },
    fertile_end: { title: () => 'Die fruchtbaren Tage enden 📅', body: () => 'Deine fruchtbaren Tage gehen zu Ende.' },
    pms: { title: () => 'PMS-Phase ⚡', body: () => 'Die PMS-Phase rückt näher – achte gut auf dich!' },
    pill: { title: () => 'Zeit für die Pille 💊', body: () => 'Vergiss nicht, deine tägliche Pille einzunehmen!' },
  },
  ar: {
    period_start: { title: () => 'الدورة الشهرية تقترب 🔴', body: (d) => `بقي ${d} أيام على الدورة الشهرية!` },
    period_end: { title: () => 'انتهت الدورة الشهرية ✅', body: () => 'انتهت دورتكِ الشهرية!' },
    ovulation: { title: () => 'يوم الإباضة 🌸', body: (d) => `بقي ${d} أيام على الإباضة!` },
    fertile_start: { title: () => 'أيام الخصوبة 💕', body: () => 'تبدأ أيام الخصوبة!' },
    fertile_end: { title: () => 'نهاية أيام الخصوبة 📅', body: () => 'توشك أيام الخصوبة على الانتهاء.' },
    pms: { title: () => 'فترة متلازمة ما قبل الدورة ⚡', body: () => 'تقترب فترة متلازمة ما قبل الدورة، فاعتني بنفسكِ!' },
    pill: { title: () => 'موعد الحبة 💊', body: () => 'لا تنسي تناول حبتكِ اليومية!' },
  },  zh: {
    period_start: { title: () => '月经即将来临 🔴', body: (d) => `距离月经还有 ${d} 天！` },
    period_end: { title: () => '月经已结束 ✅', body: () => '您的月经已结束！' },
    ovulation: { title: () => '排卵日 🌸', body: (d) => `距离排卵还有 ${d} 天！` },
    fertile_start: { title: () => '易孕期 💕', body: () => '易孕期开始了！' },
    fertile_end: { title: () => '易孕期即将结束 📅', body: () => '易孕期即将结束。' },
    pms: { title: () => '经前期 ⚡', body: () => '经前期即将到来，请好好照顾自己！' },
    pill: { title: () => '服药时间 💊', body: () => '别忘了服用今天的药片！' },
  },
  id: {
    period_start: { title: () => 'Menstruasi akan datang 🔴', body: (d) => `${d} hari lagi menuju menstruasi!` },
    period_end: { title: () => 'Menstruasi selesai ✅', body: () => 'Menstruasi Anda telah selesai!' },
    ovulation: { title: () => 'Hari ovulasi 🌸', body: (d) => `${d} hari lagi menuju ovulasi!` },
    fertile_start: { title: () => 'Masa subur 💕', body: () => 'Masa subur Anda dimulai!' },
    fertile_end: { title: () => 'Masa subur berakhir 📅', body: () => 'Masa subur Anda akan segera berakhir.' },
    pms: { title: () => 'Masa PMS ⚡', body: () => 'PMS akan datang, jaga diri Anda baik-baik!' },
    pill: { title: () => 'Waktunya minum pil 💊', body: () => 'Jangan lupa minum pil harian Anda!' },
  },
  fr: {
    period_start: { title: () => 'Vos règles approchent 🔴', body: (d) => `Plus que ${d} jour(s) avant vos règles !` },
    period_end: { title: () => 'Règles terminées ✅', body: () => 'Vos règles sont terminées !' },
    ovulation: { title: () => 'Jour d’ovulation 🌸', body: (d) => `Plus que ${d} jour(s) avant l’ovulation !` },
    fertile_start: { title: () => 'Période fertile 💕', body: () => 'Votre période fertile commence !' },
    fertile_end: { title: () => 'Fin de la période fertile 📅', body: () => 'Votre période fertile se termine.' },
    pms: { title: () => 'Phase de SPM ⚡', body: () => 'Le SPM approche, prenez soin de vous !' },
    pill: { title: () => 'L’heure de la pilule 💊', body: () => 'N’oubliez pas de prendre votre pilule du jour !' },
  },
  es: {
    period_start: { title: () => 'Tu regla se acerca 🔴', body: (d) => `¡Faltan ${d} día(s) para tu regla!` },
    period_end: { title: () => 'Tu regla terminó ✅', body: () => '¡Tu regla ha terminado!' },
    ovulation: { title: () => 'Día de ovulación 🌸', body: (d) => `¡Faltan ${d} día(s) para la ovulación!` },
    fertile_start: { title: () => 'Días fértiles 💕', body: () => '¡Empiezan tus días fértiles!' },
    fertile_end: { title: () => 'Fin de los días fértiles 📅', body: () => 'Tus días fértiles están terminando.' },
    pms: { title: () => 'Fase premenstrual ⚡', body: () => 'Se acerca el SPM, ¡cuídate mucho!' },
    pill: { title: () => 'Hora de la píldora 💊', body: () => '¡No olvides tomar tu píldora diaria!' },
  },
  pt: {
    period_start: { title: () => 'Sua menstruação está chegando 🔴', body: (d) => `Faltam ${d} dia(s) para a sua menstruação!` },
    period_end: { title: () => 'A menstruação terminou ✅', body: () => 'Sua menstruação terminou!' },
    ovulation: { title: () => 'Dia da ovulação 🌸', body: (d) => `Faltam ${d} dia(s) para a ovulação!` },
    fertile_start: { title: () => 'Período fértil 💕', body: () => 'Seu período fértil está começando!' },
    fertile_end: { title: () => 'Fim do período fértil 📅', body: () => 'Seu período fértil está terminando.' },
    pms: { title: () => 'Fase de TPM ⚡', body: () => 'A TPM está chegando, cuide-se!' },
    pill: { title: () => 'Hora da pílula 💊', body: () => 'Não se esqueça de tomar sua pílula diária!' },
  },
  vi: {
    period_start: { title: () => 'Sắp đến kỳ kinh 🔴', body: (d) => `Còn ${d} ngày nữa là đến kỳ kinh!` },
    period_end: { title: () => 'Kỳ kinh đã kết thúc ✅', body: () => 'Kỳ kinh của bạn đã kết thúc!' },
    ovulation: { title: () => 'Ngày rụng trứng 🌸', body: (d) => `Còn ${d} ngày nữa là đến ngày rụng trứng!` },
    fertile_start: { title: () => 'Những ngày dễ thụ thai 💕', body: () => 'Những ngày dễ thụ thai bắt đầu!' },
    fertile_end: { title: () => 'Sắp hết những ngày dễ thụ thai 📅', body: () => 'Những ngày dễ thụ thai sắp kết thúc.' },
    pms: { title: () => 'Giai đoạn tiền kinh nguyệt ⚡', body: () => 'Sắp đến kỳ tiền kinh nguyệt, hãy chăm sóc bản thân nhé!' },
    pill: { title: () => 'Đến giờ uống thuốc 💊', body: () => 'Đừng quên uống viên thuốc hằng ngày của bạn!' },
  },
  hi: {
    period_start: { title: () => 'पीरियड्स आने वाले हैं 🔴', body: (d) => `पीरियड्स में ${d} दिन बाकी हैं!` },
    period_end: { title: () => 'पीरियड्स खत्म हो गए ✅', body: () => 'आपके पीरियड्स खत्म हो गए हैं!' },
    ovulation: { title: () => 'ओव्यूलेशन का दिन 🌸', body: (d) => `ओव्यूलेशन में ${d} दिन बाकी हैं!` },
    fertile_start: { title: () => 'फर्टाइल दिन 💕', body: () => 'आपके फर्टाइल दिन शुरू हो रहे हैं!' },
    fertile_end: { title: () => 'फर्टाइल दिन खत्म हो रहे हैं 📅', body: () => 'आपके फर्टाइल दिन खत्म होने वाले हैं।' },
    pms: { title: () => 'PMS का समय ⚡', body: () => 'PMS आने वाला है, अपना ख्याल रखें!' },
    pill: { title: () => 'गोली लेने का समय 💊', body: () => 'अपनी रोज़ की गोली लेना न भूलें!' },
  },
  ja: {
    period_start: { title: () => '生理が近づいています 🔴', body: (d) => `生理まであと${d}日です！` },
    period_end: { title: () => '生理が終わりました ✅', body: () => '生理期間が終わりました！' },
    ovulation: { title: () => '排卵日 🌸', body: (d) => `排卵日まであと${d}日です！` },
    fertile_start: { title: () => '妊娠しやすい期間 💕', body: () => '妊娠しやすい期間が始まります！' },
    fertile_end: { title: () => '妊娠しやすい期間の終わり 📅', body: () => '妊娠しやすい期間がもうすぐ終わります。' },
    pms: { title: () => 'PMSの時期 ⚡', body: () => 'PMSの時期が近づいています。無理せず過ごしてください！' },
    pill: { title: () => 'お薬の時間 💊', body: () => '毎日のお薬を飲み忘れないでください！' },
  },
  ko: {
    period_start: { title: () => '생리 예정일이 다가와요 🔴', body: (d) => `생리까지 ${d}일 남았어요!` },
    period_end: { title: () => '생리가 끝났어요 ✅', body: () => '이번 생리가 끝났어요!' },
    ovulation: { title: () => '배란일 🌸', body: (d) => `배란일까지 ${d}일 남았어요!` },
    fertile_start: { title: () => '가임기 💕', body: () => '가임기가 시작돼요!' },
    fertile_end: { title: () => '가임기가 끝나가요 📅', body: () => '가임기가 곧 끝나요.' },
    pms: { title: () => 'PMS 기간 ⚡', body: () => 'PMS 기간이 다가와요. 몸을 잘 돌보세요!' },
    pill: { title: () => '약 복용 시간 💊', body: () => '매일 복용하는 약을 잊지 마세요!' },
  },
  pl: {
    period_start: { title: () => 'Zbliża się okres 🔴', body: (d) => `Dni do okresu: ${d}!` },
    period_end: { title: () => 'Okres się skończył ✅', body: () => 'Twój okres dobiegł końca!' },
    ovulation: { title: () => 'Dzień owulacji 🌸', body: (d) => `Dni do owulacji: ${d}!` },
    fertile_start: { title: () => 'Dni płodne 💕', body: () => 'Zaczynają się Twoje dni płodne!' },
    fertile_end: { title: () => 'Koniec dni płodnych 📅', body: () => 'Twoje dni płodne dobiegają końca.' },
    pms: { title: () => 'Faza PMS ⚡', body: () => 'Zbliża się PMS, zadbaj o siebie!' },
    pill: { title: () => 'Czas na tabletkę 💊', body: () => 'Nie zapomnij przyjąć codziennej tabletki!' },
  },
  nl: {
    period_start: { title: () => 'Je menstruatie komt eraan 🔴', body: (d) => `Nog ${d} dag(en) tot je menstruatie!` },
    period_end: { title: () => 'Menstruatie voorbij ✅', body: () => 'Je menstruatie is voorbij!' },
    ovulation: { title: () => 'Ovulatiedag 🌸', body: (d) => `Nog ${d} dag(en) tot je ovulatie!` },
    fertile_start: { title: () => 'Vruchtbare dagen 💕', body: () => 'Je vruchtbare dagen beginnen!' },
    fertile_end: { title: () => 'Einde vruchtbare dagen 📅', body: () => 'Je vruchtbare dagen lopen ten einde.' },
    pms: { title: () => 'PMS-fase ⚡', body: () => 'PMS komt eraan, zorg goed voor jezelf!' },
    pill: { title: () => 'Tijd voor je pil 💊', body: () => 'Vergeet je dagelijkse pil niet!' },
  },
  sv: {
    period_start: { title: () => 'Mensen närmar sig 🔴', body: (d) => `${d} dag(ar) kvar till mensen!` },
    period_end: { title: () => 'Mensen är slut ✅', body: () => 'Din mens är över!' },
    ovulation: { title: () => 'Ägglossningsdag 🌸', body: (d) => `${d} dag(ar) kvar till ägglossningen!` },
    fertile_start: { title: () => 'Fertila dagar 💕', body: () => 'Dina fertila dagar börjar!' },
    fertile_end: { title: () => 'Fertila dagar tar slut 📅', body: () => 'Dina fertila dagar närmar sig sitt slut.' },
    pms: { title: () => 'PMS-period ⚡', body: () => 'PMS närmar sig – ta hand om dig!' },
    pill: { title: () => 'Dags för tabletten 💊', body: () => 'Glöm inte att ta din dagliga tablett!' },
  },
  ky: {
    period_start: { title: () => 'Этек кир жакындап калды 🔴', body: (d) => `Этек кириңизге ${d} күн калды!` },
    period_end: { title: () => 'Этек кир бүттү ✅', body: () => 'Этек кириңиз аяктады!' },
    ovulation: { title: () => 'Овуляция күнү 🌸', body: (d) => `Овуляцияга ${d} күн калды!` },
    fertile_start: { title: () => 'Боюна бүтүүгө ыңгайлуу күндөр 💕', body: () => 'Боюна бүтүүгө ыңгайлуу күндөрүңүз башталды!' },
    fertile_end: { title: () => 'Ыңгайлуу күндөр аяктап жатат 📅', body: () => 'Боюна бүтүүгө ыңгайлуу күндөрүңүз аяктап баратат.' },
    pms: { title: () => 'ПМС мезгили ⚡', body: () => 'ПМС жакындап калды, өзүңүзгө кам көрүңүз!' },
    pill: { title: () => 'Таблетка ичүү убактысы 💊', body: () => 'Күнүмдүк таблеткаңызды ичүүнү унутпаңыз!' },
  },
  et: {
    period_start: { title: () => 'Menstruatsioon läheneb 🔴', body: (d) => `Menstruatsioonini on jäänud ${d} päev(a)!` },
    period_end: { title: () => 'Menstruatsioon on läbi ✅', body: () => 'Sinu menstruatsioon on lõppenud!' },
    ovulation: { title: () => 'Ovulatsioonipäev 🌸', body: (d) => `Ovulatsioonini on jäänud ${d} päev(a)!` },
    fertile_start: { title: () => 'Viljakad päevad 💕', body: () => 'Sinu viljakad päevad algavad!' },
    fertile_end: { title: () => 'Viljakad päevad lõpevad 📅', body: () => 'Sinu viljakad päevad on lõppemas.' },
    pms: { title: () => 'PMS-i periood ⚡', body: () => 'PMS läheneb – hoia ennast!' },
    pill: { title: () => 'Tableti aeg 💊', body: () => 'Ära unusta oma igapäevast tabletti!' },
  },
};

function pickLang(value, valueEn, lang) {
  if (lang === 'en') return (valueEn && valueEn.trim()) ? valueEn : '';
  // Custom reminder texts exist only in az/en; every other language uses its DEFAULTS copy.
  if (lang !== 'az') return '';
  return value || '';
}

function parseBakuTimeToMinutes(value) {
  if (!value) return null;
  const [rawHour = '0', rawMinute = '0'] = value.split(':');
  const hour = Number(rawHour);
  const minute = Number(rawMinute);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  return hour * 60 + minute;
}

function getCycleInfo(lastPeriodDate, cycleLength, periodLength) {
  const today = new Date();
  const lmp = new Date(lastPeriodDate);
  today.setHours(0, 0, 0, 0);
  lmp.setHours(0, 0, 0, 0);

  const daysSincePeriod = Math.floor((today.getTime() - lmp.getTime()) / (1000 * 60 * 60 * 24));
  const currentCycleDay = (daysSincePeriod % cycleLength) + 1;
  const cyclesPassed = Math.floor(daysSincePeriod / cycleLength);
  const nextPeriodDate = new Date(lmp);
  nextPeriodDate.setDate(nextPeriodDate.getDate() + (cyclesPassed + 1) * cycleLength);
  const daysUntilPeriod = Math.floor((nextPeriodDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const ovulationDate = new Date(nextPeriodDate);
  ovulationDate.setDate(ovulationDate.getDate() - 14);
  const daysUntilOvulation = Math.floor((ovulationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const fertileStart = new Date(ovulationDate);
  fertileStart.setDate(fertileStart.getDate() - 5);
  const daysUntilFertile = Math.floor((fertileStart.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const isPeriodDay = currentCycleDay <= periodLength;
  const daysUntilPMS = daysUntilPeriod - 7;

  return { currentCycleDay, daysUntilPeriod, daysUntilOvulation, daysUntilFertile, daysUntilPMS, isPeriodDay, cycleLength };
}

async function main() {
  let runId = null;
  const reasons = {};
  let failedCount = 0;
  let skippedCount = 0;

  try {
    const triggeredBy = manual ? 'admin-test' : 'cron';

    const now = new Date();
    const bakuOffsetMs = 4 * 60 * 60 * 1000;
    const bakuNow = new Date(now.getTime() + bakuOffsetMs);
    const adjustedHour = bakuNow.getUTCHours();
    const bakuMinute = bakuNow.getUTCMinutes();
    const bakuTimeStr = `${String(adjustedHour).padStart(2, '0')}:${String(bakuMinute).padStart(2, '0')}`;
    const bakuMinutes = adjustedHour * 60 + bakuMinute;

    runId = await startRunLog('send-flow-reminders', triggeredBy, bakuTimeStr, manual ? 'manual' : null);

    if (!manual && (adjustedHour < 9 || adjustedHour >= 22)) {
      await finishRunLog(runId, { status: 'success', skipped_count: 1, reasons: { outside_hours: 1 } });
      console.log('Outside notification hours');
      return;
    }

    const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!saJson) {
      await finishRunLog(runId, { status: 'error', error_message: 'Firebase SA not configured' });
      return;
    }

    const { accessToken, projectId } = await getFirebaseAccessToken(saJson);

    const reminders = manual
      ? await query(`SELECT * FROM flow_reminders WHERE is_enabled = true AND user_id = $1`, [TEST_USER_ID])
      : await query(`SELECT * FROM flow_reminders WHERE is_enabled = true`);

    if (!reminders.length) {
      await finishRunLog(runId, { status: 'success', skipped_count: 1, reasons: { no_active_reminders: 1 } });
      console.log('No active flow reminders');
      return;
    }

    const profiles = manual
      ? await query(`SELECT user_id, life_stage, last_period_date, cycle_length, period_length FROM profiles WHERE life_stage = 'flow' AND user_id = $1`, [TEST_USER_ID])
      : await query(`SELECT user_id, life_stage, last_period_date, cycle_length, period_length FROM profiles WHERE life_stage = 'flow'`);

    const tokens = manual
      ? await query(`SELECT token, user_id, platform FROM device_tokens WHERE user_id = $1`, [TEST_USER_ID])
      : await query(`SELECT token, user_id, platform FROM device_tokens`);

    if (!tokens.length) {
      await finishRunLog(runId, { status: 'success', skipped_count: 1, reasons: { no_device_tokens: 1 } });
      console.log('No device tokens');
      return;
    }

    const prefs = manual
      ? await query(`SELECT user_id, language FROM user_preferences WHERE user_id = $1`, [TEST_USER_ID])
      : await query(`SELECT user_id, language FROM user_preferences`);

    console.log(`[send-flow-reminders] reminders=${reminders.length} profiles=${profiles.length} tokens=${tokens.length}`);

    const langByUser = new Map();
    prefs.forEach((p) => langByUser.set(p.user_id, String(p.language || 'az').split(/[-_]/)[0].toLowerCase()));

    const profileMap = new Map();
    profiles.forEach((p) => { if (p.last_period_date) profileMap.set(p.user_id, p); });

    const tokensByUser = new Map();
    tokens.forEach((t) => {
      if (!tokensByUser.has(t.user_id)) tokensByUser.set(t.user_id, []);
      tokensByUser.get(t.user_id).push(t);
    });

    let sentCount = 0;

    for (const reminder of reminders) {
      const profile = profileMap.get(reminder.user_id);
      if (!profile?.last_period_date) { skippedCount++; bumpReason(reasons, 'flow_no_lmp'); continue; }

      const cycleLength = profile.cycle_length || 28;
      const periodLength = profile.period_length || 5;
      const cycleInfo = getCycleInfo(profile.last_period_date, cycleLength, periodLength);

      const userLang = langByUser.get(reminder.user_id) || 'az';
      let shouldSend = false;
      let notificationTitle = pickLang(reminder.title, reminder.title_en, userLang);
      let notificationBody = pickLang(reminder.message, reminder.message_en, userLang);

      const langDefs = DEFAULTS[userLang] || DEFAULTS.az;
      const def = langDefs[reminder.reminder_type];
      if (!def) { skippedCount++; bumpReason(reasons, 'unknown_reminder_type'); continue; }

      switch (reminder.reminder_type) {
        case 'period_start':
          if (cycleInfo.daysUntilPeriod === reminder.days_before) {
            shouldSend = true;
            notificationTitle = notificationTitle || def.title(reminder.days_before);
            notificationBody = notificationBody || def.body(reminder.days_before);
          }
          break;
        case 'period_end':
          if (cycleInfo.isPeriodDay && cycleInfo.currentCycleDay === periodLength) {
            shouldSend = true;
            notificationTitle = notificationTitle || def.title(0);
            notificationBody = notificationBody || def.body(0);
          }
          break;
        case 'ovulation':
          if (cycleInfo.daysUntilOvulation === reminder.days_before) {
            shouldSend = true;
            notificationTitle = notificationTitle || def.title(reminder.days_before);
            notificationBody = notificationBody || def.body(reminder.days_before);
          }
          break;
        case 'fertile_start':
          if (cycleInfo.daysUntilFertile === reminder.days_before) {
            shouldSend = true;
            notificationTitle = notificationTitle || def.title(0);
            notificationBody = notificationBody || def.body(0);
          }
          break;
        case 'fertile_end':
          if (cycleInfo.daysUntilFertile === -(6 - reminder.days_before)) {
            shouldSend = true;
            notificationTitle = notificationTitle || def.title(0);
            notificationBody = notificationBody || def.body(0);
          }
          break;
        case 'pms':
          if (cycleInfo.daysUntilPMS === reminder.days_before) {
            shouldSend = true;
            notificationTitle = notificationTitle || def.title(0);
            notificationBody = notificationBody || def.body(0);
          }
          break;
        case 'pill':
          shouldSend = true;
          notificationTitle = notificationTitle || def.title(0);
          notificationBody = notificationBody || def.body(0);
          break;
      }

      if (!shouldSend && !manual) { skippedCount++; bumpReason(reasons, `flow_off_schedule:${reminder.reminder_type}`); continue; }

      const reminderMinutes = parseBakuTimeToMinutes(reminder.time_of_day);
      if (!manual && (reminderMinutes === null || Math.abs(bakuMinutes - reminderMinutes) > 15)) {
        skippedCount++;
        bumpReason(reasons, 'flow_wrong_time_window');
        continue;
      }

      if (manual) {
        notificationTitle = notificationTitle || `[TEST] Flow • ${reminder.reminder_type}`;
        notificationBody = notificationBody || 'Test bildirişi (admin paneli)';
      }

      const userTokens = tokensByUser.get(reminder.user_id);
      if (!userTokens?.length) { skippedCount++; bumpReason(reasons, 'no_device_token'); continue; }

      let delivered = false;
      let lastErr = {};
      for (const deviceToken of userTokens) {
        const result = await sendFCMv1(accessToken, projectId, deviceToken.token, notificationTitle, notificationBody, {
          type: 'flow_reminder', reminder_type: reminder.reminder_type,
        });

        if (result.success) {
          sentCount++;
          delivered = true;
          await query(
            `INSERT INTO notification_send_log (user_id, title, body, status, notification_type, source_type, source_notification_id)
             VALUES ($1, $2, $3, 'sent', 'flow_reminder', 'flow_reminder', $4)`,
            [reminder.user_id, notificationTitle, notificationBody, reminder.id]
          );
          break;
        } else {
          lastErr = { code: result.errorCode, msg: result.error };
          if (result.unregistered) {
            await query(`DELETE FROM device_tokens WHERE token = $1`, [deviceToken.token]);
          }
        }
      }
      if (!delivered) {
        failedCount++;
        bumpReason(reasons, `fcm:${lastErr.code || 'unknown'}`);
        await logFailedSend({
          user_id: reminder.user_id,
          notification_type: 'flow_reminder',
          source_type: 'flow_reminder',
          source_notification_id: reminder.id,
          title: notificationTitle,
          body: notificationBody,
          reason: lastErr.msg || 'FCM send failed',
          error_code: lastErr.code,
        });
      }
    }

    console.log(`Flow reminders sent: ${sentCount}`);

    await finishRunLog(runId, {
      status: 'success',
      sent_count: sentCount,
      failed_count: failedCount,
      skipped_count: skippedCount,
      eligible_count: reminders.length,
      reasons,
    });
  } catch (err) {
    console.error('Error in send-flow-reminders:', err);
    if (runId) {
      await finishRunLog(runId, { status: 'error', error_message: err instanceof Error ? err.message : String(err) });
    }
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

main();
