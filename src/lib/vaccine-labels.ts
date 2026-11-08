/**
 * Vaccine names, ages, doses and routes in the app language (all 23), derived from stable schedule data:
 *  - the vaccine `code` (BCG, HepB, MMR...) picks a translated description; the abbreviation stays as is;
 *  - the age is parsed from the Azerbaijani source label (`age_label_az`: "2 aylıq", "4-6 yaş", "Doğulanda")
 *    and formatted with Intl units, so ranges survive; the dose from `dose_label_az` / `dose_number`;
 *  - a reviewed programme's own `display_name` and unknown codes/labels keep the database text.
 * Azerbaijani is the source language and always shows the database text. Never group or match on output
 * of these helpers: group by `recommended_age_days` (see vaccineAgeGroups).
 */
import { appLanguageLocale, normalizeAppLanguage } from './app-languages';
import { vaccineTiming } from './vaccine-schedule';
import { formatTr, tr } from './tr';

type Term = 'tb' | 'hepB' | 'hepA' | 'diph' | 'tet' | 'pert' | 'hib' | 'polio' | 'pneumo' | 'rota' | 'measles' | 'mumps'
  | 'rubella' | 'varicella' | 'mening' | 'je' | 'yf' | 'hpv' | 'flu';
type Phrase = 'birth' | 'dose' | 'booster' | 'booster2' | 'revacc' | 'im' | 'oral' | 'sc' | 'id';
interface LangPack { terms: Record<Term, string>; phrases: Record<Phrase, string> }

const P = (terms: string, phrases: string): LangPack => {
  const t = terms.split('|'), p = phrases.split('|');
  const tk: Term[] = ['tb', 'hepB', 'hepA', 'diph', 'tet', 'pert', 'hib', 'polio', 'pneumo', 'rota', 'measles', 'mumps',
    'rubella', 'varicella', 'mening', 'je', 'yf', 'hpv', 'flu'];
  const pk: Phrase[] = ['birth', 'dose', 'booster', 'booster2', 'revacc', 'im', 'oral', 'sc', 'id'];
  if (t.length !== tk.length || p.length !== pk.length) throw new Error('VACCINE_LABEL_PACK_INVALID');
  return { terms: Object.fromEntries(tk.map((k, i) => [k, t[i]])) as Record<Term, string>,
    phrases: Object.fromEntries(pk.map((k, i) => [k, p[i]])) as Record<Phrase, string> };
};

// Order: tb|hepB|hepA|diphtheria|tetanus|pertussis|Hib|polio|pneumococcal|rotavirus|measles|mumps|rubella|
//        chickenpox|meningococcal|Japanese encephalitis|yellow fever|HPV|flu
// then:  at birth|dose {n}|booster|second booster|booster (revaccination)|intramuscular|oral|subcutaneous|intradermal
export const VACCINE_LABEL_PACKS: Record<string, LangPack> = {
  az: P('vərəm|hepatit B|hepatit A|difteriya|tetanus|göyöskürək|hemofil infeksiyası (Hib)|poliomielit|pnevmokokk infeksiyası|rotavirus|qızılca|parotit|məxmərək|su çiçəyi|meningokokk infeksiyası|Yapon ensefaliti|sarı qızdırma|insan papillomavirusu|qrip',
    'Doğulanda|{n}-ci doza|Bustər|İkinci bustər|Bustər (revaksinasiya)|Əzələdaxili|Ağızdan|Dərialtı|Dəridaxili'),
  en: P('tuberculosis|hepatitis B|hepatitis A|diphtheria|tetanus|whooping cough|Haemophilus influenzae type b|polio|pneumococcal disease|rotavirus|measles|mumps|rubella|chickenpox|meningococcal disease|Japanese encephalitis|yellow fever|human papillomavirus|flu',
    'At birth|Dose {n}|Booster|Second booster|Booster (revaccination)|Intramuscular|Oral|Subcutaneous|Intradermal'),
  tr: P('tüberküloz|hepatit B|hepatit A|difteri|tetanoz|boğmaca|Haemophilus influenzae tip b|çocuk felci|pnömokok|rotavirüs|kızamık|kabakulak|kızamıkçık|su çiçeği|meningokok|Japon ensefaliti|sarı humma|insan papilloma virüsü|grip',
    'Doğumda|{n}. doz|Rapel|İkinci rapel|Rapel (revaksinasyon)|Kas içi|Ağızdan|Deri altı|Deri içi'),
  ru: P('туберкулёз|гепатит B|гепатит A|дифтерия|столбняк|коклюш|гемофильная инфекция типа b|полиомиелит|пневмококковая инфекция|ротавирус|корь|паротит|краснуха|ветряная оспа|менингококковая инфекция|японский энцефалит|жёлтая лихорадка|вирус папилломы человека|грипп',
    'При рождении|{n}-я доза|Ревакцинация|Вторая ревакцинация|Ревакцинация|Внутримышечно|Перорально|Подкожно|Внутрикожно'),
  kk: P('туберкулез|B гепатиті|A гепатиті|дифтерия|сіреспе|көкжөтел|гемофильді инфекция (b типі)|полиомиелит|пневмококк инфекциясы|ротавирус|қызылша|паротит|қызамық|желшешек|менингококк инфекциясы|жапон энцефалиті|сары безгек|адам папилломавирусы|тұмау',
    'Туғанда|{n}-доза|Ревакцинация|Екінші ревакцинация|Ревакцинация|Бұлшықет ішіне|Ауыз арқылы|Тері астына|Тері ішіне'),
  uz: P("sil|gepatit B|gepatit A|difteriya|qoqshol|ko'kyo'tal|gemofil infeksiya (b turi)|poliomiyelit|pnevmokokk infeksiyasi|rotavirus|qizamiq|parotit|qizilcha|suvchechak|meningokokk infeksiyasi|yapon ensefaliti|sariq isitma|odam papillomavirusi|gripp",
    "Tug'ilganda|{n}-doza|Revaksinatsiya|Ikkinchi revaksinatsiya|Revaksinatsiya|Mushak ichiga|Og'iz orqali|Teri ostiga|Teri ichiga"),
  ka: P('ტუბერკულოზი|B ჰეპატიტი|A ჰეპატიტი|დიფთერია|ტეტანუსი|ყივანახველა|ჰემოფილური ინფექცია (b ტიპი)|პოლიომიელიტი|პნევმოკოკური ინფექცია|როტავირუსი|წითელა|ყბაყურა|წითურა|ჩუტყვავილა|მენინგოკოკური ინფექცია|იაპონური ენცეფალიტი|ყვითელი ცხელება|ადამიანის პაპილომავირუსი|გრიპი',
    'დაბადებისას|დოზა {n}|რევაქცინაცია|მეორე რევაქცინაცია|რევაქცინაცია|კუნთში|პერორალურად|კანქვეშ|კანში'),
  de: P('Tuberkulose|Hepatitis B|Hepatitis A|Diphtherie|Tetanus|Keuchhusten|Haemophilus influenzae Typ b|Polio|Pneumokokken|Rotaviren|Masern|Mumps|Röteln|Windpocken|Meningokokken|Japanische Enzephalitis|Gelbfieber|Humane Papillomviren|Grippe',
    'Bei Geburt|{n}. Dosis|Auffrischung|Zweite Auffrischung|Auffrischung|Intramuskulär|Oral|Subkutan|Intradermal'),
  ar: P('السل|التهاب الكبد B|التهاب الكبد A|الخناق|الكزاز|السعال الديكي|المستدمية النزلية من النوع b|شلل الأطفال|المكورات الرئوية|فيروس الروتا|الحصبة|النكاف|الحصبة الألمانية|جدري الماء|المكورات السحائية|التهاب الدماغ الياباني|الحمى الصفراء|فيروس الورم الحليمي البشري|الإنفلونزا',
    'عند الولادة|الجرعة {n}|جرعة معززة|الجرعة المعززة الثانية|جرعة معززة (إعادة التطعيم)|في العضل|عن طريق الفم|تحت الجلد|داخل الجلد'),
  zh: P('结核病|乙型肝炎|甲型肝炎|白喉|破伤风|百日咳|b型流感嗜血杆菌|脊髓灰质炎|肺炎球菌|轮状病毒|麻疹|腮腺炎|风疹|水痘|脑膜炎球菌|乙型脑炎|黄热病|人乳头瘤病毒|流感',
    '出生时|第{n}剂|加强针|第二剂加强针|加强免疫|肌内注射|口服|皮下注射|皮内注射'),
  id: P('tuberkulosis|hepatitis B|hepatitis A|difteri|tetanus|batuk rejan|Haemophilus influenzae tipe b|polio|pneumokokus|rotavirus|campak|gondongan|rubela|cacar air|meningokokus|ensefalitis Jepang|demam kuning|human papillomavirus|influenza',
    'Saat lahir|Dosis ke-{n}|Booster|Booster kedua|Booster (imunisasi ulang)|Intramuskular|Oral|Subkutan|Intradermal'),
  fr: P('tuberculose|hépatite B|hépatite A|diphtérie|tétanos|coqueluche|Haemophilus influenzae de type b|poliomyélite|pneumocoque|rotavirus|rougeole|oreillons|rubéole|varicelle|méningocoque|encéphalite japonaise|fièvre jaune|papillomavirus humains|grippe',
    'À la naissance|Dose {n}|Rappel|Deuxième rappel|Rappel|Intramusculaire|Orale|Sous-cutanée|Intradermique'),
  es: P('tuberculosis|hepatitis B|hepatitis A|difteria|tétanos|tos ferina|Haemophilus influenzae tipo b|poliomielitis|neumococo|rotavirus|sarampión|paperas|rubéola|varicela|meningococo|encefalitis japonesa|fiebre amarilla|virus del papiloma humano|gripe',
    'Al nacer|Dosis {n}|Refuerzo|Segundo refuerzo|Refuerzo (revacunación)|Intramuscular|Oral|Subcutánea|Intradérmica'),
  pt: P('tuberculose|hepatite B|hepatite A|difteria|tétano|coqueluche|Haemophilus influenzae tipo b|poliomielite|pneumococo|rotavírus|sarampo|caxumba|rubéola|varicela|meningococo|encefalite japonesa|febre amarela|papilomavírus humano|gripe',
    'Ao nascer|Dose {n}|Reforço|Segundo reforço|Reforço (revacinação)|Intramuscular|Oral|Subcutânea|Intradérmica'),
  vi: P('lao|viêm gan B|viêm gan A|bạch hầu|uốn ván|ho gà|Haemophilus influenzae týp b|bại liệt|phế cầu|vi rút rota|sởi|quai bị|rubella|thủy đậu|não mô cầu|viêm não Nhật Bản|sốt vàng|vi rút u nhú ở người|cúm',
    'Khi sinh|Mũi {n}|Mũi nhắc lại|Mũi nhắc lại thứ hai|Mũi nhắc lại (tái chủng)|Tiêm bắp|Uống|Tiêm dưới da|Tiêm trong da'),
  hi: P('क्षय रोग|हेपेटाइटिस B|हेपेटाइटिस A|डिप्थीरिया|टिटनेस|काली खांसी|हीमोफिलस इन्फ्लुएंजा टाइप b|पोलियो|न्यूमोकोकल रोग|रोटावायरस|खसरा|गलसुआ|रूबेला|चिकनपॉक्स|मेनिंगोकोकल रोग|जापानी इंसेफेलाइटिस|पीत ज्वर|ह्यूमन पेपिलोमावायरस|फ्लू',
    'जन्म के समय|खुराक {n}|बूस्टर|दूसरा बूस्टर|बूस्टर (दोबारा टीकाकरण)|मांसपेशी में|मुँह से|त्वचा के नीचे|त्वचा के भीतर'),
  ja: P('結核|B型肝炎|A型肝炎|ジフテリア|破傷風|百日せき|インフルエンザ菌b型|ポリオ|肺炎球菌|ロタウイルス|麻しん|おたふくかぜ|風しん|水痘|髄膜炎菌|日本脳炎|黄熱|ヒトパピローマウイルス|インフルエンザ',
    '出生時|{n}回目|追加接種|2回目の追加接種|追加接種|筋肉内注射|経口|皮下注射|皮内注射'),
  ko: P('결핵|B형 간염|A형 간염|디프테리아|파상풍|백일해|b형 헤모필루스 인플루엔자|폴리오|폐렴구균|로타바이러스|홍역|유행성이하선염|풍진|수두|수막구균|일본뇌염|황열|사람유두종바이러스|인플루엔자',
    '출생 시|{n}차|추가 접종|2차 추가 접종|추가 접종|근육 주사|경구|피하 주사|피내 주사'),
  pl: P('gruźlica|WZW typu B|WZW typu A|błonica|tężec|krztusiec|Haemophilus influenzae typu b|polio|pneumokoki|rotawirusy|odra|świnka|różyczka|ospa wietrzna|meningokoki|japońskie zapalenie mózgu|żółta gorączka|wirus brodawczaka ludzkiego|grypa',
    'Przy urodzeniu|Dawka {n}|Dawka przypominająca|Druga dawka przypominająca|Dawka przypominająca (rewakcynacja)|Domięśniowo|Doustnie|Podskórnie|Śródskórnie'),
  nl: P('tuberculose|hepatitis B|hepatitis A|difterie|tetanus|kinkhoest|Haemophilus influenzae type b|polio|pneumokokken|rotavirus|mazelen|bof|rodehond|waterpokken|meningokokken|Japanse encefalitis|gele koorts|humaan papillomavirus|griep',
    'Bij de geboorte|Dosis {n}|Herhaalprik|Tweede herhaalprik|Herhaalprik|Intramusculair|Oraal|Subcutaan|Intradermaal'),
  sv: P('tuberkulos|hepatit B|hepatit A|difteri|stelkramp|kikhosta|Haemophilus influenzae typ b|polio|pneumokocker|rotavirus|mässling|påssjuka|röda hund|vattkoppor|meningokocker|japansk encefalit|gula febern|humant papillomvirus|influensa',
    'Vid födseln|Dos {n}|Påfyllnadsdos|Andra påfyllnadsdosen|Påfyllnadsdos|Intramuskulärt|Oralt|Subkutant|Intradermalt'),
  ky: P('кургак учук|B гепатити|A гепатити|дифтерия|селейме|көк жөтөл|гемофилдик инфекция (b тиби)|полиомиелит|пневмококк инфекциясы|ротавирус|кызамык|паротит|кызылча|суу чечек|менингококк инфекциясы|жапон энцефалити|сары безгек|адамдын папиллома вирусу|сасык тумоо',
    'Төрөлгөндө|{n}-доза|Ревакцинация|Экинчи ревакцинация|Ревакцинация|Булчунга|Ооз аркылуу|Тери астына|Тери ичине'),
  et: P('tuberkuloos|B-hepatiit|A-hepatiit|difteeria|teetanus|läkaköha|Haemophilus influenzae tüüp b|lastehalvatus|pneumokokk|rotaviirus|leetrid|mumps|punetised|tuulerõuged|meningokokk|Jaapani entsefaliit|kollapalavik|inimese papilloomiviirus|gripp',
    'Sündimisel|{n}. annus|Tõhustusannus|Teine tõhustusannus|Tõhustusannus|Lihasesse|Suu kaudu|Naha alla|Nahasiseselt'),
};

/** Vaccine code (upper-cased) → descriptive terms + the abbreviation that stays untranslated. */
const VACCINES: Record<string, { terms: Term[]; abbr: string }> = {
  BCG: { terms: ['tb'], abbr: 'BCG' },
  HEPB: { terms: ['hepB'], abbr: 'HepB' },
  HEPA: { terms: ['hepA'], abbr: 'HepA' },
  DTAP: { terms: ['diph', 'tet', 'pert'], abbr: 'DTaP' },
  DTP: { terms: ['diph', 'tet', 'pert'], abbr: 'DTP' },
  TDAP: { terms: ['tet', 'diph', 'pert'], abbr: 'Tdap' },
  TD: { terms: ['tet', 'diph'], abbr: 'Td' },
  DT: { terms: ['diph', 'tet'], abbr: 'DT' },
  HIB: { terms: ['hib'], abbr: 'Hib' },
  IPV: { terms: ['polio'], abbr: 'IPV' },
  OPV: { terms: ['polio'], abbr: 'OPV' },
  PCV: { terms: ['pneumo'], abbr: 'PCV' },
  RV: { terms: ['rota'], abbr: 'RV' },
  ROTA: { terms: ['rota'], abbr: 'RV' },
  MMR: { terms: ['measles', 'mumps', 'rubella'], abbr: 'MMR' },
  MR: { terms: ['measles', 'rubella'], abbr: 'MR' },
  VAR: { terms: ['varicella'], abbr: 'VAR' },
  VARICELLA: { terms: ['varicella'], abbr: 'VAR' },
  MENACWY: { terms: ['mening'], abbr: 'MenACWY' },
  MENB: { terms: ['mening'], abbr: 'MenB' },
  MENC: { terms: ['mening'], abbr: 'MenC' },
  JE: { terms: ['je'], abbr: 'JE' },
  YF: { terms: ['yf'], abbr: 'YF' },
  HPV: { terms: ['hpv'], abbr: 'HPV' },
  FLU: { terms: ['flu'], abbr: 'Flu' },
};

const CASELESS = new Set(['zh', 'ja', 'ko', 'ka', 'ar', 'hi']);
const pack = (lang: string) => VACCINE_LABEL_PACKS[normalizeAppLanguage(lang)] || VACCINE_LABEL_PACKS.en;
const capitalize = (s: string, lang: string) => CASELESS.has(lang) ? s : s.charAt(0).toLocaleUpperCase(appLanguageLocale(lang)) + s.slice(1);
const joinList = (items: string[], lang: string) => {
  if (items.length < 2) return items[0] || '';
  // Intl.ListFormat (ES2021) is in every supported WebView; the tsconfig lib predates it.
  const ListFormat = (Intl as unknown as { ListFormat?: new (l: string, o: object) => { format: (x: string[]) => string } }).ListFormat;
  try { if (ListFormat) return new ListFormat(appLanguageLocale(lang), { style: 'long', type: 'conjunction' }).format(items); }
  catch { /* fall through */ }
  return items.join(', ');
};

interface VaccineLike { code?: string | null; name?: string | null; name_az?: string | null }
interface RowLike {
  id?: string; dose_number?: number | null; recommended_age_days: number; min_age_days?: number | null; max_age_days?: number | null;
  age_label?: string | null; age_label_az?: string | null; dose_label?: string | null; dose_label_az?: string | null;
  schedule_meta?: unknown; vaccine: VaccineLike & { route?: string | null; route_az?: string | null };
}

/** "Measles, mumps and rubella (MMR)" in the app language; the database name when there is nothing better. */
export function vaccineDisplayName(row: RowLike, language: string): string {
  const lang = normalizeAppLanguage(language);
  const fallback = row.vaccine.name || row.vaccine.name_az || '';
  if (lang === 'az') return fallback;
  // A reviewed programme names its own product (useVaccines already put display_name into vaccine.name).
  const timing = row.id ? vaccineTiming({ id: row.id, dose_number: row.dose_number ?? 0, recommended_age_days: row.recommended_age_days,
    min_age_days: row.min_age_days ?? null, max_age_days: row.max_age_days ?? null, schedule_meta: row.schedule_meta }) : null;
  if (timing?.display_name?.[lang]) return fallback;
  const def = VACCINES[(row.vaccine.code || '').trim().toUpperCase()];
  if (!def) return fallback;
  const terms = pack(lang).terms;
  return `${capitalize(joinList(def.terms.map((t) => terms[t]), lang), lang)} (${def.abbr})`;
}

type AgeUnit = 'day' | 'week' | 'month' | 'year';
const AZ_UNITS: Record<string, AgeUnit> = { 'gün': 'day', 'həftə': 'week', 'həftəlik': 'week', 'aylıq': 'month', 'ay': 'month', 'yaş': 'year' };
const AGE_PART = /^(\d+(?:[.,]\d+)?)(?:\s*-\s*(\d+(?:[.,]\d+)?))?\s*(gün|həftəlik|həftə|aylıq|ay|yaş)$/;

function formatAgePart(text: string, lang: string): string | null {
  const m = AGE_PART.exec(text.trim());
  if (!m) return null;
  const unit = AZ_UNITS[m[3]];
  const a = Number(m[1].replace(',', '.')), b = m[2] ? Number(m[2].replace(',', '.')) : null;
  try {
    const nf = new Intl.NumberFormat(appLanguageLocale(lang), { style: 'unit', unit, unitDisplay: 'long', maximumFractionDigits: 1 });
    if (b === null) return nf.format(a);
    const ranged = nf as Intl.NumberFormat & { formatRange?: (x: number, y: number) => string };
    return typeof ranged.formatRange === 'function' ? ranged.formatRange(a, b)
      : `${new Intl.NumberFormat(appLanguageLocale(lang), { maximumFractionDigits: 1 }).format(a)}-${nf.format(b)}`;
  } catch { return null; }
}

/** Age label ("2 months", "4–6 years", "At birth") from the Azerbaijani source label; database text otherwise. */
export function vaccineAgeLabel(row: RowLike, language: string): string {
  const lang = normalizeAppLanguage(language);
  const source = (row.age_label_az ?? '').trim();
  const fallback = row.age_label || source;
  if (lang === 'az' || !source) return fallback;
  const birth = /^Doğulanda(?:\s*\((.+)\))?$/.exec(source);
  if (birth) {
    if (!birth[1]) return pack(lang).phrases.birth;
    const inner = formatAgePart(birth[1], lang);
    return inner ? `${pack(lang).phrases.birth} (${inner})` : fallback;
  }
  const yearsMonths = /^(\d+)\s*yaş\s+(\d+)\s*ay$/.exec(source);
  if (yearsMonths) {
    const y = formatAgePart(`${yearsMonths[1]} yaş`, lang), mo = formatAgePart(`${yearsMonths[2]} ay`, lang);
    return y && mo ? `${y} ${mo}` : fallback;
  }
  return formatAgePart(source, lang) ?? fallback;
}

/** Dose label ("Dose 2", "Booster") from the Azerbaijani source label; database text otherwise. */
export function vaccineDoseLabel(row: RowLike, language: string): string {
  const lang = normalizeAppLanguage(language);
  const source = (row.dose_label_az ?? '').trim();
  const fallback = row.dose_label || source;
  if (lang === 'az' || !source) return fallback;
  const p = pack(lang).phrases;
  if (/^bustər\s*\(revaksinasiya\)$/i.test(source)) return p.revacc;
  if (/^(ikinci|İkinci)\s+bustər$/i.test(source)) return p.booster2;
  if (/^bustər$/i.test(source)) return p.booster;
  const dose = /^(\d+)\s*-\s*(?:ci|cı|cu|cü|ncı|nci|ncu|ncü)\s+doza(?:\s*\((.+)\))?$/i.exec(source);
  if (!dose) return fallback;
  const label = p.dose.replace('{n}', dose[1]);
  if (!dose[2]) return label;
  if (/^doğulanda$/i.test(dose[2].trim())) return `${label} (${p.birth.charAt(0).toLocaleLowerCase(appLanguageLocale(lang)) + p.birth.slice(1)})`;
  return fallback;
}

/** Route of administration in the app language; database text for anything unrecognised. */
export function vaccineRouteLabel(row: RowLike, language: string): string {
  const lang = normalizeAppLanguage(language);
  const source = (row.vaccine.route_az ?? '').trim().toLocaleLowerCase('az');
  const fallback = row.vaccine.route || row.vaccine.route_az || '';
  if (lang === 'az' || !source) return fallback;
  const p = pack(lang).phrases;
  if (source.startsWith('əzələdaxili')) return p.im;
  if (source.startsWith('ağızdan')) return p.oral;
  if (source.startsWith('dərialtı')) return p.sc;
  if (source.startsWith('dəridaxili')) return p.id;
  return fallback;
}

/** "Hepatitis B (HepB) (Dose 1)" style text for reminders. */
export const vaccineReminderLabel = (row: RowLike, language: string) =>
  `${vaccineDisplayName(row, language)} (${vaccineDoseLabel(row, language)})`;

/** Notification title/body for one reminder slot (the same text from the calendar and the app-start refresh). */
export function vaccineReminderText(kind: 'soon' | 'today' | 'overdue', childName: string, row: RowLike | undefined, language: string) {
  const vars = { child: childName, vaccine: row ? vaccineReminderLabel(row, language) : '' };
  if (kind === 'soon') return { title: tr('sleepvax_vax_soon_title', 'Peyvənd yaxınlaşır'), body: formatTr('sleepvax_vax_soon_body', '{child}: {vaccine} 3 gün sonradır.', vars) };
  if (kind === 'today') return { title: tr('sleepvax_vax_today_title', 'Bu gün peyvənd günüdür'), body: formatTr('sleepvax_vax_today_body', '{child}: {vaccine} bu gün üçün planlanıb.', vars) };
  return { title: tr('sleepvax_vax_overdue_title', 'Peyvənd vaxtı keçib'), body: formatTr('sleepvax_vax_overdue_body', '{child}: {vaccine} hələ qeyd olunmayıb. Yeni tarix üçün həkiminizlə danışın.', vars) };
}

/**
 * Age groups for the full plan, keyed by the stable `recommended_age_days` (never by translated text).
 * The heading lists the distinct localized age labels of the group in plan order.
 */
export function vaccineAgeGroups<T extends { row: RowLike }>(items: T[], language: string): { days: number; label: string; items: T[] }[] {
  const groups = new Map<number, { days: number; labels: string[]; items: T[] }>();
  for (const item of items) {
    const days = item.row.recommended_age_days;
    let group = groups.get(days);
    if (!group) { group = { days, labels: [], items: [] }; groups.set(days, group); }
    const label = vaccineAgeLabel(item.row, language);
    if (label && !group.labels.includes(label)) group.labels.push(label);
    group.items.push(item);
  }
  return Array.from(groups.values()).sort((a, b) => a.days - b.days)
    .map(({ days, labels, items: rows }) => ({ days, label: labels.join(' / '), items: rows }));
}
