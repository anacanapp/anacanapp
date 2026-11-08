/**
 * Code-level safety floor for the poop scanner. The model is asked to rate pale, black and red stool as urgent, but the
 * result must not depend on the prompt alone: after parsing, these colours always become concernLevel 'urgent' and
 * doctorUrgency 'immediate', and the first recommendation tells the parent to contact a doctor now.
 *
 * Pure module (no Deno APIs, no imports) so src/ vitest can import it directly.
 */

export type RedFlagColour = 'pale' | 'black' | 'red';

export interface PoopAnalysisLike {
  colorDetected?: unknown;
  colorNameAz?: unknown;
  isNormal?: unknown;
  concernLevel?: unknown;
  explanation?: unknown;
  recommendations?: unknown;
  shouldSeeDoctor?: unknown;
  doctorUrgency?: unknown;
  [key: string]: unknown;
}

export interface PoopAgeContext {
  babyAgeDays?: number | null;
  babyAgeMonths?: number | null;
}

/** Meconium (black-green, tarry) is normal in the first 1 to 3 days of life. */
export const MECONIUM_MAX_AGE_DAYS = 4;

const PALE = ['white', 'grey', 'gray', 'clay', 'pale', 'chalk', 'putty'];
const BLACK = ['black', 'tarry', 'tar'];
const RED = ['red', 'blood', 'bloody', 'maroon'];

/** Classifies the model's colour code. Only the enum field is trusted, never free text in the reply language. */
export function redFlagColour(colorDetected: unknown): RedFlagColour | null {
  if (typeof colorDetected !== 'string') return null;
  const words = colorDetected.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  if (words.some((w) => PALE.includes(w))) return 'pale';
  // "reddish-brown" / "dark brown" style codes are not red flags; only a plain red or black code is.
  if (words.some((w) => w === 'brown' || w === 'green' || w === 'yellow')) return null;
  if (words.some((w) => RED.includes(w))) return 'red';
  if (words.some((w) => BLACK.includes(w))) return 'black';
  return null;
}

/** Age in whole days, or null when the app did not send a usable age. */
export function knownAgeDays(age?: PoopAgeContext | null): number | null {
  const days = age?.babyAgeDays;
  if (typeof days === 'number' && Number.isFinite(days) && days >= 0) return days;
  const months = age?.babyAgeMonths;
  // A baby of one month or more is clearly past the meconium days even without an exact day count.
  if (typeof months === 'number' && Number.isFinite(months) && months >= 1) return Math.floor(months * 30);
  return null;
}

type Advice = Record<RedFlagColour, string>;

/** Server-side advice line (all 23 app languages). Calm, short, never stronger than NHS/AAP guidance. */
export const RED_FLAG_ADVICE: Record<string, Advice> = {
  az: {
    pale: 'Ağ, boz və ya gil rəngli nəcis qaraciyər problemi (məsələn, öd yollarının atreziyası) əlaməti ola bilər. İndi həkimə müraciət edin.',
    black: 'İlk günlərdən sonra qara nəcis bağırsaqda qanaxma əlaməti ola bilər. İndi həkimə müraciət edin.',
    red: 'Qırmızı nəcis və ya nəcisdə qan həkim müayinəsi tələb edir. İndi həkimə müraciət edin.',
  },
  en: {
    pale: 'White, grey or clay-coloured stool can be a sign of a liver problem, such as biliary atresia. Contact a doctor now.',
    black: 'Black stool after the first days of life can be a sign of bleeding in the gut. Contact a doctor now.',
    red: 'Red stool or blood in the stool needs a doctor to check it. Contact a doctor now.',
  },
  tr: {
    pale: 'Beyaz, gri veya kil renkli dışkı, safra yolu atrezisi gibi bir karaciğer sorununun belirtisi olabilir. Hemen bir doktora başvurun.',
    black: 'İlk günlerden sonra siyah dışkı bağırsakta kanamanın belirtisi olabilir. Hemen bir doktora başvurun.',
    red: 'Kırmızı dışkı veya dışkıda kan, doktor kontrolü gerektirir. Hemen bir doktora başvurun.',
  },
  ru: {
    pale: 'Белый, серый или глинистый стул может быть признаком проблемы с печенью, например атрезии желчных путей. Обратитесь к врачу сейчас.',
    black: 'Чёрный стул после первых дней жизни может быть признаком кровотечения в кишечнике. Обратитесь к врачу сейчас.',
    red: 'Красный стул или кровь в стуле требуют осмотра врача. Обратитесь к врачу сейчас.',
  },
  kk: {
    pale: 'Ақ, сұр немесе саз түстес нәжіс бауыр ауруының, мысалы өт жолдарының атрезиясының белгісі болуы мүмкін. Қазір дәрігерге хабарласыңыз.',
    black: 'Алғашқы күндерден кейінгі қара нәжіс ішектегі қан кетудің белгісі болуы мүмкін. Қазір дәрігерге хабарласыңыз.',
    red: 'Қызыл нәжіс немесе нәжістегі қан дәрігердің тексеруін қажет етеді. Қазір дәрігерге хабарласыңыз.',
  },
  uz: {
    pale: 'Oq, kulrang yoki loy rangli najas jigar muammosi, masalan, oʻt yoʻllari atreziyasi belgisi boʻlishi mumkin. Hozir shifokorga murojaat qiling.',
    black: 'Dastlabki kunlardan keyin qora najas ichakdagi qon ketish belgisi boʻlishi mumkin. Hozir shifokorga murojaat qiling.',
    red: 'Qizil najas yoki najasdagi qon shifokor koʻrigini talab qiladi. Hozir shifokorga murojaat qiling.',
  },
  ka: {
    pale: 'თეთრი, ნაცრისფერი ან თიხისფერი განავალი შეიძლება ღვიძლის პრობლემის, მაგალითად ნაღვლის სადინრების ატრეზიის ნიშანი იყოს. ახლავე მიმართეთ ექიმს.',
    black: 'პირველი დღეების შემდეგ შავი განავალი შეიძლება ნაწლავში სისხლდენის ნიშანი იყოს. ახლავე მიმართეთ ექიმს.',
    red: 'წითელი განავალი ან სისხლი განავალში ექიმის შემოწმებას საჭიროებს. ახლავე მიმართეთ ექიმს.',
  },
  de: {
    pale: 'Weißer, grauer oder lehmfarbener Stuhl kann ein Zeichen für ein Leberproblem sein, zum Beispiel eine Gallengangsatresie. Wende dich jetzt an eine Ärztin oder einen Arzt.',
    black: 'Schwarzer Stuhl nach den ersten Lebenstagen kann ein Zeichen für eine Blutung im Darm sein. Wende dich jetzt an eine Ärztin oder einen Arzt.',
    red: 'Roter Stuhl oder Blut im Stuhl sollte ärztlich untersucht werden. Wende dich jetzt an eine Ärztin oder einen Arzt.',
  },
  ar: {
    pale: 'قد يكون البراز الأبيض أو الرمادي أو بلون الطين علامة على مشكلة في الكبد، مثل رتق القنوات الصفراوية. تواصلي مع الطبيب الآن.',
    black: 'قد يكون البراز الأسود بعد الأيام الأولى من العمر علامة على نزيف في الأمعاء. تواصلي مع الطبيب الآن.',
    red: 'البراز الأحمر أو وجود دم في البراز يحتاج إلى فحص الطبيب. تواصلي مع الطبيب الآن.',
  },
  zh: {
    pale: '白色、灰色或陶土色的大便可能是肝脏问题的迹象，例如胆道闭锁。请立即联系医生。',
    black: '出生最初几天之后出现黑色大便，可能是肠道出血的迹象。请立即联系医生。',
    red: '红色大便或大便带血需要医生检查。请立即联系医生。',
  },
  id: {
    pale: 'Feses berwarna putih, abu-abu, atau seperti tanah liat bisa menjadi tanda masalah hati, misalnya atresia bilier. Segera hubungi dokter sekarang.',
    black: 'Feses hitam setelah hari-hari pertama kehidupan bisa menjadi tanda perdarahan di usus. Segera hubungi dokter sekarang.',
    red: 'Feses merah atau ada darah di feses perlu diperiksa dokter. Segera hubungi dokter sekarang.',
  },
  fr: {
    pale: 'Des selles blanches, grises ou couleur mastic peuvent être le signe d’un problème de foie, comme une atrésie des voies biliaires. Contactez un médecin maintenant.',
    black: 'Des selles noires après les premiers jours de vie peuvent être le signe d’un saignement digestif. Contactez un médecin maintenant.',
    red: 'Des selles rouges ou du sang dans les selles doivent être examinés par un médecin. Contactez un médecin maintenant.',
  },
  es: {
    pale: 'Las heces blancas, grises o de color arcilla pueden ser señal de un problema de hígado, como la atresia biliar. Contacta con un médico ahora.',
    black: 'Las heces negras después de los primeros días de vida pueden ser señal de sangrado intestinal. Contacta con un médico ahora.',
    red: 'Las heces rojas o con sangre necesitan una revisión médica. Contacta con un médico ahora.',
  },
  pt: {
    pale: 'Fezes brancas, cinzentas ou cor de barro podem ser sinal de um problema no fígado, como a atresia biliar. Contacte um médico agora.',
    black: 'Fezes pretas depois dos primeiros dias de vida podem ser sinal de hemorragia no intestino. Contacte um médico agora.',
    red: 'Fezes vermelhas ou com sangue precisam de ser vistas por um médico. Contacte um médico agora.',
  },
  vi: {
    pale: 'Phân màu trắng, xám hoặc màu đất sét có thể là dấu hiệu của bệnh gan, chẳng hạn như teo đường mật. Hãy liên hệ bác sĩ ngay.',
    black: 'Phân đen sau những ngày đầu đời có thể là dấu hiệu chảy máu trong ruột. Hãy liên hệ bác sĩ ngay.',
    red: 'Phân đỏ hoặc có máu trong phân cần được bác sĩ kiểm tra. Hãy liên hệ bác sĩ ngay.',
  },
  hi: {
    pale: 'सफ़ेद, धूसर या मिट्टी जैसे रंग का मल लिवर की समस्या, जैसे बिलियरी एट्रेसिया, का संकेत हो सकता है। अभी डॉक्टर से संपर्क करें।',
    black: 'जीवन के शुरुआती दिनों के बाद काला मल आंत में रक्तस्राव का संकेत हो सकता है। अभी डॉक्टर से संपर्क करें।',
    red: 'लाल मल या मल में खून की जाँच डॉक्टर से करानी ज़रूरी है। अभी डॉक्टर से संपर्क करें।',
  },
  ja: {
    pale: '白色、灰色、粘土色の便は、胆道閉鎖症などの肝臓の病気のサインのことがあります。今すぐ医師に連絡してください。',
    black: '生後数日を過ぎてからの黒い便は、腸からの出血のサインのことがあります。今すぐ医師に連絡してください。',
    red: '赤い便や便に血が混じる場合は、医師の診察が必要です。今すぐ医師に連絡してください。',
  },
  ko: {
    pale: '흰색, 회색 또는 점토색 변은 담도폐쇄증 같은 간 질환의 신호일 수 있습니다. 지금 바로 의사에게 연락하세요.',
    black: '생후 처음 며칠이 지난 뒤의 검은 변은 장 출혈의 신호일 수 있습니다. 지금 바로 의사에게 연락하세요.',
    red: '빨간 변이나 변에 피가 섞여 있으면 의사의 진찰이 필요합니다. 지금 바로 의사에게 연락하세요.',
  },
  pl: {
    pale: 'Biały, szary lub gliniasty stolec może być objawem choroby wątroby, na przykład atrezji dróg żółciowych. Skontaktuj się teraz z lekarzem.',
    black: 'Czarny stolec po pierwszych dniach życia może być objawem krwawienia z jelit. Skontaktuj się teraz z lekarzem.',
    red: 'Czerwony stolec lub krew w stolcu wymagają oceny lekarza. Skontaktuj się teraz z lekarzem.',
  },
  nl: {
    pale: 'Witte, grijze of kleikleurige ontlasting kan wijzen op een leverprobleem, zoals galgangatresie. Neem nu contact op met een arts.',
    black: 'Zwarte ontlasting na de eerste levensdagen kan wijzen op een bloeding in de darm. Neem nu contact op met een arts.',
    red: 'Rode ontlasting of bloed in de ontlasting moet door een arts worden bekeken. Neem nu contact op met een arts.',
  },
  sv: {
    pale: 'Vit, grå eller lerfärgad avföring kan vara ett tecken på ett leverproblem, till exempel gallgångsatresi. Kontakta en läkare nu.',
    black: 'Svart avföring efter de första levnadsdagarna kan vara ett tecken på blödning i tarmen. Kontakta en läkare nu.',
    red: 'Röd avföring eller blod i avföringen behöver undersökas av en läkare. Kontakta en läkare nu.',
  },
  ky: {
    pale: 'Ак, боз же чопо түстүү заң боор оорусунун, мисалы өт жолдорунун атрезиясынын белгиси болушу мүмкүн. Азыр дарыгерге кайрылыңыз.',
    black: 'Алгачкы күндөрдөн кийинки кара заң ичегидеги кан агуунун белгиси болушу мүмкүн. Азыр дарыгерге кайрылыңыз.',
    red: 'Кызыл заң же заңдагы кан дарыгердин текшерүүсүн талап кылат. Азыр дарыгерге кайрылыңыз.',
  },
  et: {
    pale: 'Valge, hall või savikarva väljaheide võib olla maksaprobleemi, näiteks sapiteede atreesia märk. Võtke kohe ühendust arstiga.',
    black: 'Must väljaheide pärast esimesi elupäevi võib olla soolestiku verejooksu märk. Võtke kohe ühendust arstiga.',
    red: 'Punane väljaheide või veri väljaheites vajab arsti hinnangut. Võtke kohe ühendust arstiga.',
  },
};

export function redFlagAdvice(colour: RedFlagColour, language: string): string {
  return (RED_FLAG_ADVICE[language] ?? RED_FLAG_ADVICE.az)[colour];
}

/**
 * Applies the safety floor to a parsed model answer. Keeps the model's own text, forces the urgent fields for
 * pale/black/red stool and puts the doctor-now advice first. Black stool is left to the model when the baby is known to
 * be younger than MECONIUM_MAX_AGE_DAYS days (meconium). Returns a new object; the input is not mutated.
 */
export function enforcePoopSafety<T extends PoopAnalysisLike>(analysis: T, age?: PoopAgeContext | null, language = 'az'): T {
  if (!analysis || typeof analysis !== 'object') return analysis;
  const colour = redFlagColour(analysis.colorDetected);
  if (!colour) return analysis;
  if (colour === 'black') {
    const days = knownAgeDays(age);
    if (days !== null && days < MECONIUM_MAX_AGE_DAYS) return analysis;
  }
  const advice = redFlagAdvice(colour, language);
  const existing = Array.isArray(analysis.recommendations)
    ? analysis.recommendations.filter((r): r is string => typeof r === 'string' && r.trim().length > 0 && r !== advice)
    : [];
  return {
    ...analysis,
    isNormal: false,
    concernLevel: 'urgent',
    shouldSeeDoctor: true,
    doctorUrgency: 'immediate',
    recommendations: [advice, ...existing],
    safetyOverride: colour,
  };
}
