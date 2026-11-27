/**
 * Baby-name pages of the public website ("Uşaq adları"): /<lang>/<hub>/, gender lists, letter pages and
 * one detail page per name. Data comes from bundled snapshots of the app's `baby_names_db`
 * (`tools/data/names-<lang>.json`, only rows with a meaning in that language). Texts live here, not in
 * `copy/*.json` (copy-key runtime rule in docs/WEBSITE_GOOGLE_20261006.md).
 *
 * Languages: az, ka (2026-11-10), ru, tr, uz, kk, es (2026-11-16, own national name lists, never the az list). Adding a language: add `data/names-<lang>.json`, a `NAMES_COPY`
 * entry, a loader line in `tool-data-client.ts` / `tool-data-server.ts`, then add the code to
 * `NAMES_ENABLED`. Only enabled languages resolve; every other language answers 404.
 *
 * URL scheme (published contract, keep stable once live):
 * - az names: ASCII like the rest of the site (ə→e, ç→c, ş→s, ğ→g, ı→i, ö→o, ü→u). When two different
 *   names collapse to one slug (e.g. Sevil / Səvil), the name that already is ASCII keeps it and the other
 *   uses the distinct letter scheme below (Səvil → saevil). Rows with the same name (Dəniz twice) are merged in
 *   the data snapshot.
 * - az letters: a b c ch(ç) d e ae(ə) f g gh(ğ) h x ii(ı) i(İ) j k q l m n o oe(ö) p r s sh(ş) t u ue(ü)
 *   v w y z: every Azerbaijani letter gets its own slug, so C/Ç, E/Ə, S/Ş never share a page.
 * - ka: Georgian script slugs, like the other ka URLs (name as written, letter as the Georgian letter).
 * A letter page exists only when at least LETTER_PAGE_MIN names start with that letter.
 */
import type { WebsiteLanguageCode } from '../../lib/app-languages';

export type NameGender = 'girl' | 'boy' | 'unisex';
export interface NameRow { name: string; gender: NameGender; popularity: number; origin: string; meaning: string }
export interface NameEntry extends NameRow { slug: string; letter: string; letterSlug: string; rank: number }
export interface NameLetter { letter: string; slug: string; count: number; page: boolean }
export interface NamesIndex {
  language: NamesLanguage;
  names: NameEntry[];
  bySlug: Map<string, NameEntry>;
  letters: NameLetter[];
}

/** Languages with a names snapshot planned. Only NAMES_ENABLED are published. */
export const NAMES_LANGUAGES = ['az', 'ka', 'tr', 'ru', 'kk', 'uz', 'es', 'en'] as const;
export type NamesLanguage = typeof NAMES_LANGUAGES[number];
/** Owner request 2026-11-16: every language shows its own names (not the Azerbaijani list). */
export const NAMES_ENABLED: readonly NamesLanguage[] = ['az', 'ka', 'ru', 'tr', 'uz', 'kk', 'es'];
export const LETTER_PAGE_MIN = 5;
/** Snapshot date of the bundled data (sitemap lastmod). */
export const NAMES_UPDATED = '2026-11-16';
export const isNamesLanguage = (language: string): language is NamesLanguage =>
  (NAMES_ENABLED as readonly string[]).includes(language) && !!NAMES_COPY[language as NamesLanguage];

export interface NamesCopy {
  hubSlug: string; girlSlug: string; boySlug: string; letterSlug: string;
  hubLabel: string; girlLabel: string; boyLabel: string;
  hubTitle: string; hubH1: string; hubDescription: (count: number) => string; hubIntro: (count: number) => string;
  girlTitle: string; girlH1: string; boyTitle: string; boyH1: string;
  listDescription: (gender: 'girl' | 'boy', count: number) => string;
  letterTitle: (letter: string) => string; letterH1: (letter: string) => string; letterDescription: (letter: string, count: number) => string;
  detailTitle: (name: string) => string; detailH1: (name: string) => string; detailDescription: (entry: NameEntry) => string;
  gender: Record<NameGender, string>; genderShort: Record<NameGender, string>;
  meaning: string; origin: string; genderLabel: string; popularity: string;
  popularityValue: (entry: NameEntry, total: number) => string;
  similar: string; popularGirls: string; popularBoys: string; byLetter: string; allNames: string;
  searchLabel: string; searchPlaceholder: string; searchCount: (count: number) => string; noResults: string;
  letterLink: (letter: string) => string; listLink: (gender: 'girl' | 'boy') => string; backToHub: string;
  faqTitle: string; faq: (entry: NameEntry) => Array<{ question: string; answer: string }>;
  appTitle: string; appText: string; appFeatures: string[];
  related?: { label: string; articleSlug: string };
  dataNote: string;
}

const azGenderSentence: Record<NameGender, (name: string) => string> = {
  girl: name => `${name} qız adıdır.`,
  boy: name => `${name} oğlan adıdır.`,
  unisex: name => `${name} uniseks addır: həm qızlara, həm də oğlanlara verilir.`,
};
const kaGenderSentence: Record<NameGender, (name: string) => string> = {
  girl: name => `${name} გოგოს სახელია.`,
  boy: name => `${name} ბიჭის სახელია.`,
  unisex: name => `${name} გამოიყენება როგორც გოგოს, ისე ბიჭის სახელად.`,
};
/** Azerbaijani ordinal numeral with vowel harmony: 1-ci, 3-cü, 6-cı, 9-cu, 10-cu, 40-cı, 100-cü. */
export function azOrdinal(value: number): string {
  const units = ['', 'ci', 'ci', 'cü', 'cü', 'ci', 'cı', 'ci', 'ci', 'cu'], tens = ['', 'cu', 'ci', 'cu', 'cı', 'ci', 'cı', 'ci', 'ci', 'cı'];
  const suffix = value % 10 ? units[value % 10] : value % 100 ? tens[(value % 100) / 10] : value % 1000 ? 'cü' : 'ci';
  return `${value}-${suffix}`;
}
const clip = (text: string, max = 158) => text.length <= max ? text : text.slice(0, text.lastIndexOf(' ', max - 1)).replace(/[,;:.]$/, '') + '…';

export const NAMES_COPY: Partial<Record<NamesLanguage, NamesCopy>> = {
  az: {
    hubSlug: 'usaq-adlari', girlSlug: 'qiz-adlari', boySlug: 'oglan-adlari', letterSlug: 'herf',
    hubLabel: 'Uşaq adları', girlLabel: 'Qız adları', boyLabel: 'Oğlan adları',
    hubTitle: 'Uşaq adları 2026-2027: qız, oğlan adları, mənaları',
    hubH1: 'Uşaq adları 2026-2027: mənaları ilə qız və oğlan adları',
    hubDescription: count => `${count} ad mənası və mənşəyi ilə: qız adları, oğlan adları, ən populyar adlar və hərflər üzrə siyahı. Adı axtarın, mənasını oxuyun.`,
    hubIntro: count => `Övladınız üçün ad seçirsiniz? Burada ${count} adın mənası, mənşəyi və populyarlığı var. Adı axtarın, qız və ya oğlan adlarına baxın, hərflər üzrə seçin.`,
    girlTitle: 'Qız adları 2026-2027: müasir qız adları, mənaları', girlH1: 'Qız adları 2026-2027: mənaları ilə',
    boyTitle: 'Oğlan adları 2026-2027: müasir adlar və mənaları', boyH1: 'Oğlan adları 2026-2027: mənaları ilə',
    listDescription: (gender, count) => `${count} müasir və klassik ${gender === 'girl' ? 'qız' : 'oğlan'} adı mənası və mənşəyi ilə. Hər adın mənası, oxşar adlar və ən populyar seçimlər.`,
    letterTitle: letter => `${letter} hərfi ilə başlayan qız və oğlan adları`,
    letterH1: letter => `${letter} hərfi ilə başlayan adlar`,
    letterDescription: (letter, count) => `${letter} hərfi ilə başlayan ${count} ad mənası və mənşəyi ilə: qız, oğlan və uniseks adlar.`,
    detailTitle: name => `${name} adının mənası və mənşəyi`,
    detailH1: name => `${name} adının mənası`,
    detailDescription: entry => clip(`${entry.name} adının mənası: ${entry.meaning}. ${entry.origin ? `Mənşəyi: ${entry.origin}. ` : ''}${({ girl: 'Qız adı', boy: 'Oğlan adı', unisex: 'Uniseks ad' } as const)[entry.gender]}. Oxşar adlar və Anacan tətbiqində ad seçimi.`),
    gender: { girl: 'Qız adı', boy: 'Oğlan adı', unisex: 'Uniseks ad' },
    genderShort: { girl: 'Qız', boy: 'Oğlan', unisex: 'Uniseks' },
    meaning: 'Mənası', origin: 'Mənşəyi', genderLabel: 'Cinsi', popularity: 'Populyarlıq',
    popularityValue: (entry, total) => `${entry.popularity}/100 · siyahıdakı ${total} ad arasında ${azOrdinal(entry.rank)} yer`,
    similar: 'Oxşar adlar', popularGirls: 'Ən populyar qız adları', popularBoys: 'Ən populyar oğlan adları',
    byLetter: 'Hərflər üzrə adlar', allNames: 'Bütün adlar',
    searchLabel: 'Ad və ya məna axtarın', searchPlaceholder: 'Məsələn: Aylin və ya “işıq”', searchCount: count => `${count} ad`, noResults: 'Ad tapılmadı. Anacan tətbiqində AI ilə istənilən adın mənasını axtara bilərsiniz.',
    letterLink: letter => `${letter} hərfi`, listLink: gender => gender === 'girl' ? 'Bütün qız adları' : 'Bütün oğlan adları', backToHub: 'Bütün uşaq adları',
    faqTitle: 'Tez-tez verilən suallar',
    faq: entry => [
      { question: `${entry.name} adı nə deməkdir?`, answer: `${entry.name} adı «${entry.meaning}» mənasını verir.` },
      { question: `${entry.name} qız adıdır, yoxsa oğlan adı?`, answer: azGenderSentence[entry.gender](entry.name) },
      ...(entry.origin ? [{ question: `${entry.name} adının mənşəyi nədir?`, answer: `Anacan ad bazasına görə ${entry.name} adının mənşəyi: ${entry.origin}.` }] : []),
    ],
    appTitle: 'Anacan tətbiqində daha çox',
    appText: 'Tətbiqdə adları saxlayın, partnyorunuzla birlikdə seçin və siyahıda olmayan adın mənasını da tapın.',
    appFeatures: ['300+ ad mənası və mənşəyi ilə', 'Siyahıda olmayan ad üçün AI ilə məna axtarışı', 'Seçilmişlər siyahısı', 'Partnyorla ad səsverməsi: hər ikinizin bəyəndiyi adlar uyğunluq kimi görünür'],
    related: { label: 'Müasir Azərbaycan adları 2026-2027: ən populyar adlar (məqalə)', articleSlug: 'muasir-azerbaycan-adlari-2026-ci-il-ucun-en-populyar-oglan-ve-qiz-adlari-menalari-ile' },
    dataNote: 'Mənalar Anacan tətbiqinin ad bazasındandır. Populyarlıq Anacan reytinqidir (0-100), rəsmi statistika deyil.',
  },
  ka: {
    hubSlug: 'ბავშვის-სახელები', girlSlug: 'გოგოს-სახელები', boySlug: 'ბიჭის-სახელები', letterSlug: 'ასო',
    hubLabel: 'ბავშვის სახელები', girlLabel: 'გოგოს სახელები', boyLabel: 'ბიჭის სახელები',
    hubTitle: 'ბავშვის სახელები 2026-2027: მნიშვნელობა და წარმოშობა',
    hubH1: 'ბავშვის სახელები 2026-2027: გოგოს და ბიჭის სახელები მნიშვნელობით',
    hubDescription: count => `${count} სახელი მნიშვნელობითა და წარმოშობით: გოგოს სახელები, ბიჭის სახელები, პოპულარული სახელები და ანბანური სია.`,
    hubIntro: count => `ბავშვისთვის სახელს არჩევთ? აქ ნახავთ ${count} სახელის მნიშვნელობას, წარმოშობას და პოპულარობას. მოძებნეთ სახელი ან აირჩიეთ ასოს მიხედვით.`,
    girlTitle: 'გოგოს სახელები 2026-2027: მნიშვნელობა და წარმოშობა', girlH1: 'გოგოს სახელები 2026-2027 მნიშვნელობით',
    boyTitle: 'ბიჭის სახელები 2026-2027: მნიშვნელობა და წარმოშობა', boyH1: 'ბიჭის სახელები 2026-2027 მნიშვნელობით',
    listDescription: (gender, count) => `${count} ${gender === 'girl' ? 'გოგოს' : 'ბიჭის'} სახელი მნიშვნელობითა და წარმოშობით. თითოეული სახელის მნიშვნელობა და მსგავსი სახელები.`,
    letterTitle: letter => `${letter}-ზე დაწყებული სახელები`,
    letterH1: letter => `${letter}-ზე დაწყებული სახელები`,
    letterDescription: (letter, count) => `${letter}-ზე დაწყებული ${count} სახელი მნიშვნელობითა და წარმოშობით: გოგოს და ბიჭის სახელები.`,
    detailTitle: name => `${name}: სახელის მნიშვნელობა და წარმოშობა`,
    detailH1: name => `${name}: სახელის მნიშვნელობა`,
    detailDescription: entry => clip(`რას ნიშნავს სახელი ${entry.name}: ${entry.meaning}. ${entry.origin ? `წარმოშობა: ${entry.origin}. ` : ''}${({ girl: 'გოგოს სახელი', boy: 'ბიჭის სახელი', unisex: 'გოგოს და ბიჭის სახელი' } as const)[entry.gender]}. მსგავსი სახელები.`),
    gender: { girl: 'გოგოს სახელი', boy: 'ბიჭის სახელი', unisex: 'გოგოს და ბიჭის სახელი' },
    genderShort: { girl: 'გოგო', boy: 'ბიჭი', unisex: 'ორივე' },
    meaning: 'მნიშვნელობა', origin: 'წარმოშობა', genderLabel: 'სქესი', popularity: 'პოპულარობა',
    popularityValue: (entry, total) => `${entry.popularity}/100 · ${total} სახელიდან ${entry.rank === 1 ? '1-ლი' : `მე-${entry.rank}`} ადგილი`,
    similar: 'მსგავსი სახელები', popularGirls: 'პოპულარული გოგოს სახელები', popularBoys: 'პოპულარული ბიჭის სახელები',
    byLetter: 'სახელები ასოების მიხედვით', allNames: 'ყველა სახელი',
    searchLabel: 'მოძებნეთ სახელი ან მნიშვნელობა', searchPlaceholder: 'მაგალითად: ნინო', searchCount: count => `${count} სახელი`, noResults: 'სახელი ვერ მოიძებნა. Anacan აპლიკაციაში ნებისმიერი სახელის მნიშვნელობას AI-ით მოძებნით.',
    letterLink: letter => `ასო ${letter}`, listLink: gender => gender === 'girl' ? 'ყველა გოგოს სახელი' : 'ყველა ბიჭის სახელი', backToHub: 'ყველა ბავშვის სახელი',
    faqTitle: 'ხშირად დასმული კითხვები',
    faq: entry => [
      { question: `რას ნიშნავს სახელი ${entry.name}?`, answer: `სახელი ${entry.name} ნიშნავს: «${entry.meaning}».` },
      { question: `${entry.name} გოგოს სახელია თუ ბიჭის?`, answer: kaGenderSentence[entry.gender](entry.name) },
      ...(entry.origin ? [{ question: `რა წარმოშობისაა სახელი ${entry.name}?`, answer: `Anacan-ის სახელების ბაზის მიხედვით, სახელის წარმოშობა: ${entry.origin}.` }] : []),
    ],
    appTitle: 'მეტი Anacan აპლიკაციაში',
    appText: 'შეინახეთ სახელები, აირჩიეთ ისინი პარტნიორთან ერთად და მოძებნეთ სიაში არარსებული სახელის მნიშვნელობაც.',
    appFeatures: ['AI-ით ნებისმიერი სახელის მნიშვნელობის ძიება', 'რჩეული სახელების სია', 'სახელის არჩევა პარტნიორთან ერთად: სახელი, რომელიც ორივეს მოგწონთ, დამთხვევად გამოჩნდება'],
    dataNote: 'მნიშვნელობები Anacan აპლიკაციის სახელების ბაზიდანაა. პოპულარობა Anacan-ის რეიტინგია (0-100) და არა ოფიციალური სტატისტიკა.',
  },
};


/** Gender sentence and generic copy for the languages added 2026-11-16 (ru, tr, uz, kk, es). */
interface SimpleNamesText {
  slugs: [hub: string, girl: string, boy: string, letter: string];
  labels: [hub: string, girl: string, boy: string];
  year: string;
  hubH1: string; girlH1: string; boyH1: string; hubTitle: string; girlTitle: string; boyTitle: string;
  hubDescription: (count: number) => string; hubIntro: (count: number) => string;
  listDescription: (gender: 'girl' | 'boy', count: number) => string;
  letterTitle: (letter: string) => string; letterH1: (letter: string) => string; letterDescription: (letter: string, count: number) => string;
  detailTitle: (name: string) => string; detailH1: (name: string) => string;
  detail: (entry: NameEntry, genderLabel: string) => string;
  gender: Record<NameGender, string>; genderShort: Record<NameGender, string>; genderSentence: Record<NameGender, (name: string) => string>;
  words: [meaning: string, origin: string, gender: string, popularity: string];
  rank: (rank: number, total: number) => string;
  ui: [similar: string, popularGirls: string, popularBoys: string, byLetter: string, allNames: string, searchLabel: string, searchPlaceholder: string, noResults: string, backToHub: string, faqTitle: string];
  count: (count: number) => string; letterLink: (letter: string) => string; listLink: [girls: string, boys: string];
  faqQ: [meaning: (name: string) => string, gender: (name: string) => string, origin: (name: string) => string];
  faqOrigin: (name: string, origin: string) => string; faqMeaning: (name: string, meaning: string) => string;
  app: [title: string, text: string, features: string[]]; dataNote: string;
}
function simpleCopy(t: SimpleNamesText): NamesCopy {
  return {
    hubSlug: t.slugs[0], girlSlug: t.slugs[1], boySlug: t.slugs[2], letterSlug: t.slugs[3],
    hubLabel: t.labels[0], girlLabel: t.labels[1], boyLabel: t.labels[2],
    hubTitle: t.hubTitle, hubH1: t.hubH1, hubDescription: t.hubDescription, hubIntro: t.hubIntro,
    girlTitle: t.girlTitle, girlH1: t.girlH1, boyTitle: t.boyTitle, boyH1: t.boyH1, listDescription: t.listDescription,
    letterTitle: t.letterTitle, letterH1: t.letterH1, letterDescription: t.letterDescription,
    detailTitle: t.detailTitle, detailH1: t.detailH1, detailDescription: entry => clip(t.detail(entry, t.gender[entry.gender])),
    gender: t.gender, genderShort: t.genderShort,
    meaning: t.words[0], origin: t.words[1], genderLabel: t.words[2], popularity: t.words[3],
    popularityValue: (entry, total) => `${entry.popularity}/100 · ${t.rank(entry.rank, total)}`,
    similar: t.ui[0], popularGirls: t.ui[1], popularBoys: t.ui[2], byLetter: t.ui[3], allNames: t.ui[4],
    searchLabel: t.ui[5], searchPlaceholder: t.ui[6], searchCount: t.count, noResults: t.ui[7],
    letterLink: t.letterLink, listLink: gender => gender === 'girl' ? t.listLink[0] : t.listLink[1], backToHub: t.ui[8],
    faqTitle: t.ui[9],
    faq: entry => [
      { question: t.faqQ[0](entry.name), answer: t.faqMeaning(entry.name, entry.meaning) },
      { question: t.faqQ[1](entry.name), answer: t.genderSentence[entry.gender](entry.name) },
      ...(entry.origin ? [{ question: t.faqQ[2](entry.name), answer: t.faqOrigin(entry.name, entry.origin) }] : []),
    ],
    appTitle: t.app[0], appText: t.app[1], appFeatures: t.app[2], dataNote: t.dataNote,
  };
}
const ruPlural = (n: number, one: string, few: string, many: string) => { const a = n % 10, b = n % 100; return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many; };
const ruNames = (n: number) => `${n} ${ruPlural(n, 'имя', 'имени', 'имен')}`;
const kkGender: Record<NameGender, string> = { girl: 'Қыз есімі', boy: 'Ұл есімі', unisex: 'Қызға да, ұлға да қойылады' };

const RU = simpleCopy({
  slugs: ['детские-имена', 'имена-для-девочек', 'имена-для-мальчиков', 'буква'], labels: ['Детские имена', 'Имена для девочек', 'Имена для мальчиков'], year: '2026-2027',
  hubTitle: 'Имена для детей 2026-2027: значение и происхождение', hubH1: 'Имена для детей 2026-2027: имена для девочек и мальчиков со значением',
  girlTitle: 'Имена для девочек 2026-2027: значение и происхождение', girlH1: 'Имена для девочек 2026-2027 со значением',
  boyTitle: 'Имена для мальчиков 2026-2027: значение и происхождение', boyH1: 'Имена для мальчиков 2026-2027 со значением',
  hubDescription: count => `${ruNames(count)} со значением и происхождением: русские, мусульманские и азербайджанские имена для девочек и мальчиков, популярные имена и список по алфавиту.`,
  hubIntro: count => `Выбираете имя для малыша? Здесь значение, происхождение и популярность ${ruPlural(count, 'имени', 'имен', 'имен')}: ${count}. Найдите имя или выберите по первой букве.`,
  listDescription: (gender, count) => `${ruNames(count)} для ${gender === 'girl' ? 'девочек' : 'мальчиков'} со значением и происхождением: русские, мусульманские и азербайджанские, современные и классические.`,
  letterTitle: letter => `Имена на букву ${letter}: для девочек и мальчиков`, letterH1: letter => `Имена на букву ${letter}`,
  letterDescription: (letter, count) => `${ruNames(count)} на букву ${letter} со значением и происхождением: имена для девочек и мальчиков.`,
  detailTitle: name => `Имя ${name}: значение и происхождение`, detailH1: name => `Значение имени ${name}`,
  detail: (entry, gender) => `Что означает имя ${entry.name}: ${entry.meaning}. ${entry.origin ? `Происхождение: ${entry.origin}. ` : ''}${gender}. Похожие имена и выбор имени в приложении Anacan.`,
  gender: { girl: 'Имя для девочки', boy: 'Имя для мальчика', unisex: 'Подходит и девочке, и мальчику' }, genderShort: { girl: 'Девочка', boy: 'Мальчик', unisex: 'Оба' },
  genderSentence: { girl: name => `${name} женское имя.`, boy: name => `${name} мужское имя.`, unisex: name => `Имя ${name} дают и девочкам, и мальчикам.` },
  words: ['Значение', 'Происхождение', 'Пол', 'Популярность'], rank: (rank, total) => `${rank}-е место из ${total}`,
  ui: ['Похожие имена', 'Популярные имена для девочек', 'Популярные имена для мальчиков', 'Имена по алфавиту', 'Все имена', 'Найдите имя или значение', 'Например: Алиса или «свет»', 'Имя не найдено. В приложении Anacan можно узнать значение любого имени с помощью ИИ.', 'Все детские имена', 'Частые вопросы'],
  count: ruNames, letterLink: letter => `Буква ${letter}`, listLink: ['Все имена для девочек', 'Все имена для мальчиков'],
  faqQ: [name => `Что означает имя ${name}?`, name => `${name} это имя для девочки или для мальчика?`, name => `Какое происхождение у имени ${name}?`],
  faqMeaning: (name, meaning) => `Имя ${name} означает «${meaning}».`, faqOrigin: (name, origin) => `По базе имен Anacan происхождение имени ${name}: ${origin}.`,
  app: ['Больше в приложении Anacan', 'Сохраняйте понравившиеся имена, выбирайте вместе с партнером и узнавайте значение любого имени, которого нет в списке.', ['Поиск значения любого имени с помощью ИИ', 'Список избранных имен', 'Выбор имени вместе с партнером: имена, которые нравятся обоим, отмечаются совпадением']],
  dataNote: 'Значения взяты из базы имен приложения Anacan. Популярность это рейтинг Anacan (0-100), а не официальная статистика.',
});
const TR = simpleCopy({
  slugs: ['bebek-isimleri', 'kiz-bebek-isimleri', 'erkek-bebek-isimleri', 'harf'], labels: ['Bebek isimleri', 'Kız bebek isimleri', 'Erkek bebek isimleri'], year: '2026-2027',
  hubTitle: 'Bebek isimleri 2026-2027: anlamları ve kökenleri', hubH1: 'Bebek isimleri 2026-2027: anlamlarıyla kız ve erkek isimleri',
  girlTitle: 'Kız bebek isimleri 2026-2027 ve anlamları', girlH1: 'Kız bebek isimleri 2026-2027 ve anlamları',
  boyTitle: 'Erkek bebek isimleri 2026-2027 ve anlamları', boyH1: 'Erkek bebek isimleri 2026-2027 ve anlamları',
  hubDescription: count => `Anlamı ve kökeniyle ${count} bebek ismi: modern ve Kuranda geçen kız isimleri, erkek isimleri, en popüler isimler ve harf harf liste.`,
  hubIntro: count => `Bebeğiniz için isim mi arıyorsunuz? Burada ${count} ismin anlamı, kökeni ve popülerliği var. İsmi arayın veya ilk harfe göre seçin.`,
  listDescription: (gender, count) => `Anlamı ve kökeniyle ${count} ${gender === 'girl' ? 'kız' : 'erkek'} bebek ismi: modern, klasik ve dini isimler, en popüler seçenekler.`,
  letterTitle: letter => `${letter} harfiyle başlayan kız ve erkek isimleri`, letterH1: letter => `${letter} harfiyle başlayan isimler`,
  letterDescription: (letter, count) => `${letter} harfiyle başlayan ${count} isim, anlamı ve kökeniyle: kız ve erkek bebek isimleri.`,
  detailTitle: name => `${name} isminin anlamı nedir? Kökeni`, detailH1: name => `${name} isminin anlamı`,
  detail: (entry, gender) => `${entry.name} isminin anlamı: ${entry.meaning}. ${entry.origin ? `Kökeni: ${entry.origin}. ` : ''}${gender}. Benzer isimler ve Anacan uygulamasında isim seçimi.`,
  gender: { girl: 'Kız ismi', boy: 'Erkek ismi', unisex: 'Hem kız hem erkek ismi' }, genderShort: { girl: 'Kız', boy: 'Erkek', unisex: 'Her ikisi' },
  genderSentence: { girl: name => `${name} bir kız ismidir.`, boy: name => `${name} bir erkek ismidir.`, unisex: name => `${name} hem kızlara hem erkeklere verilen bir isimdir.` },
  words: ['Anlamı', 'Kökeni', 'Cinsiyet', 'Popülerlik'], rank: (rank, total) => `${total} isim arasında ${rank}. sırada`,
  ui: ['Benzer isimler', 'En popüler kız isimleri', 'En popüler erkek isimleri', 'Harflere göre isimler', 'Tüm isimler', 'İsim veya anlam arayın', 'Örneğin: Zeynep veya “ışık”', 'İsim bulunamadı. Anacan uygulamasında herhangi bir ismin anlamını yapay zekâ ile arayabilirsiniz.', 'Tüm bebek isimleri', 'Sıkça sorulan sorular'],
  count: count => `${count} isim`, letterLink: letter => `${letter} harfi`, listLink: ['Tüm kız isimleri', 'Tüm erkek isimleri'],
  faqQ: [name => `${name} ne demek?`, name => `${name} kız ismi mi, erkek ismi mi?`, name => `${name} isminin kökeni nedir?`],
  faqMeaning: (name, meaning) => `${name} ismi «${meaning}» anlamına gelir.`, faqOrigin: (name, origin) => `Anacan isim veri tabanına göre ${name} isminin kökeni: ${origin}.`,
  app: ['Anacan uygulamasında daha fazlası', 'Beğendiğiniz isimleri kaydedin, eşinizle birlikte seçin ve listede olmayan bir ismin anlamını da bulun.', ['Yapay zekâ ile her ismin anlamını arama', 'Favori isimler listesi', 'Eşinizle isim oylaması: ikinizin de beğendiği isimler eşleşme olarak görünür']],
  dataNote: 'Anlamlar Anacan uygulamasının isim veri tabanındandır. Popülerlik Anacan puanıdır (0-100), resmi istatistik değildir.',
});
const UZ = simpleCopy({
  slugs: ['bolalar-ismlari', 'qiz-bola-ismlari', 'ogil-bola-ismlari', 'harf'], labels: ['Bolalar ismlari', 'Qiz bola ismlari', 'Oʻgʻil bola ismlari'], year: '2026-2027',
  hubTitle: 'Bolalar ismlari 2026-2027: maʼnosi va kelib chiqishi', hubH1: 'Bolalar ismlari 2026-2027: maʼnosi bilan qiz va oʻgʻil bola ismlari',
  girlTitle: 'Qiz bola ismlari 2026-2027: maʼnosi bilan', girlH1: 'Qiz bola ismlari 2026-2027: maʼnosi bilan',
  boyTitle: 'Oʻgʻil bola ismlari 2026-2027: maʼnosi bilan', boyH1: 'Oʻgʻil bola ismlari 2026-2027: maʼnosi bilan',
  hubDescription: count => `${count} ism maʼnosi va kelib chiqishi bilan: zamonaviy va islomiy qiz bola ismlari, oʻgʻil bola ismlari, eng mashhur ismlar va harflar boʻyicha roʻyxat.`,
  hubIntro: count => `Farzandingiz uchun ism tanlayapsizmi? Bu yerda ${count} ismning maʼnosi, kelib chiqishi va mashhurligi bor. Ismni qidiring yoki harf boʻyicha tanlang.`,
  listDescription: (gender, count) => `${count} ta ${gender === 'girl' ? 'qiz bola' : 'oʻgʻil bola'} ismi maʼnosi va kelib chiqishi bilan: zamonaviy, klassik va islomiy ismlar.`,
  letterTitle: letter => `${letter} harfi bilan boshlanadigan ismlar`, letterH1: letter => `${letter} harfi bilan boshlanadigan ismlar`,
  letterDescription: (letter, count) => `${letter} harfi bilan boshlanadigan ${count} ta ism maʼnosi va kelib chiqishi bilan: qiz va oʻgʻil bola ismlari.`,
  detailTitle: name => `${name} ismining maʼnosi va kelib chiqishi`, detailH1: name => `${name} ismining maʼnosi`,
  detail: (entry, gender) => `${entry.name} ismining maʼnosi: ${entry.meaning}. ${entry.origin ? `Kelib chiqishi: ${entry.origin}. ` : ''}${gender}. Oʻxshash ismlar va Anacan ilovasida ism tanlash.`,
  gender: { girl: 'Qiz bola ismi', boy: 'Oʻgʻil bola ismi', unisex: 'Qiz va oʻgʻil bolaga qoʻyiladi' }, genderShort: { girl: 'Qiz', boy: 'Oʻgʻil', unisex: 'Ikkalasi' },
  genderSentence: { girl: name => `${name} qiz bola ismi.`, boy: name => `${name} oʻgʻil bola ismi.`, unisex: name => `${name} ismi qizlarga ham, oʻgʻil bolalarga ham qoʻyiladi.` },
  words: ['Maʼnosi', 'Kelib chiqishi', 'Jinsi', 'Mashhurligi'], rank: (rank, total) => `${total} ta ism orasida ${rank}-oʻrin`,
  ui: ['Oʻxshash ismlar', 'Eng mashhur qiz bola ismlari', 'Eng mashhur oʻgʻil bola ismlari', 'Harflar boʻyicha ismlar', 'Barcha ismlar', 'Ism yoki maʼno qidiring', 'Masalan: Madina yoki “nur”', 'Ism topilmadi. Anacan ilovasida istalgan ismning maʼnosini sunʼiy intellekt yordamida topishingiz mumkin.', 'Barcha bolalar ismlari', 'Koʻp beriladigan savollar'],
  count: count => `${count} ta ism`, letterLink: letter => `${letter} harfi`, listLink: ['Barcha qiz bola ismlari', 'Barcha oʻgʻil bola ismlari'],
  faqQ: [name => `${name} ismi nimani anglatadi?`, name => `${name} qiz bola ismimi yoki oʻgʻil bola ismimi?`, name => `${name} ismining kelib chiqishi qanday?`],
  faqMeaning: (name, meaning) => `${name} ismi «${meaning}» degan maʼnoni anglatadi.`, faqOrigin: (name, origin) => `Anacan ismlar bazasiga koʻra ${name} ismining kelib chiqishi: ${origin}.`,
  app: ['Anacan ilovasida koʻproq', 'Yoqqan ismlarni saqlang, turmush oʻrtogʻingiz bilan birga tanlang va roʻyxatda yoʻq ismning maʼnosini ham toping.', ['Istalgan ism maʼnosini sunʼiy intellekt bilan qidirish', 'Tanlangan ismlar roʻyxati', 'Turmush oʻrtoq bilan ism tanlash: ikkalangizga yoqqan ismlar moslik sifatida koʻrinadi']],
  dataNote: 'Maʼnolar Anacan ilovasining ismlar bazasidan olingan. Mashhurlik Anacan reytingi (0-100), rasmiy statistika emas.',
});
const KK = simpleCopy({
  slugs: ['балалар-есімдері', 'қыз-балаларға-есімдер', 'ұл-балаларға-есімдер', 'әріп'], labels: ['Балалар есімдері', 'Қыз балаларға есімдер', 'Ұл балаларға есімдер'], year: '2026-2027',
  hubTitle: 'Балалар есімдері 2026-2027: мағынасы мен шығу тегі', hubH1: 'Балалар есімдері 2026-2027: мағынасымен қыз және ұл есімдері',
  girlTitle: 'Қыз балаларға есімдер 2026-2027: мағынасымен', girlH1: 'Қыз балаларға есімдер 2026-2027: мағынасымен',
  boyTitle: 'Ұл балаларға есімдер 2026-2027: мағынасымен', boyH1: 'Ұл балаларға есімдер 2026-2027: мағынасымен',
  hubDescription: count => `Мағынасы мен шығу тегі көрсетілген ${count} есім: қазақша және мұсылманша қыз есімдері, ұл есімдері, ең танымал есімдер және әріп бойынша тізім.`,
  hubIntro: count => `Балаңызға есім таңдап жүрсіз бе? Мұнда ${count} есімнің мағынасы, шығу тегі және танымалдығы бар. Есімді іздеңіз немесе әріп бойынша таңдаңыз.`,
  listDescription: (gender, count) => `Мағынасы мен шығу тегі көрсетілген ${count} ${gender === 'girl' ? 'қыз' : 'ұл'} есімі: заманауи, классикалық және мұсылманша есімдер.`,
  letterTitle: letter => `${letter} әрпінен басталатын есімдер`, letterH1: letter => `${letter} әрпінен басталатын есімдер`,
  letterDescription: (letter, count) => `${letter} әрпінен басталатын ${count} есім мағынасымен: қыз және ұл балаларға есімдер.`,
  detailTitle: name => `${name} есімінің мағынасы мен шығу тегі`, detailH1: name => `${name} есімінің мағынасы`,
  detail: (entry, gender) => `${entry.name} есімінің мағынасы: ${entry.meaning}. ${entry.origin ? `Шығу тегі: ${entry.origin}. ` : ''}${gender}. Ұқсас есімдер және Anacan қосымшасында есім таңдау.`,
  gender: kkGender, genderShort: { girl: 'Қыз', boy: 'Ұл', unisex: 'Екеуі де' },
  genderSentence: { girl: name => `${name} қыз есімі.`, boy: name => `${name} ұл есімі.`, unisex: name => `${name} есімі қызға да, ұлға да қойылады.` },
  words: ['Мағынасы', 'Шығу тегі', 'Жынысы', 'Танымалдығы'], rank: (rank, total) => `${total} есімнің ішінде ${rank}-орын`,
  ui: ['Ұқсас есімдер', 'Ең танымал қыз есімдері', 'Ең танымал ұл есімдері', 'Әріптер бойынша есімдер', 'Барлық есімдер', 'Есімді немесе мағынаны іздеңіз', 'Мысалы: Айару немесе «нұр»', 'Есім табылмады. Anacan қосымшасында кез келген есімнің мағынасын жасанды интеллект арқылы табуға болады.', 'Барлық балалар есімдері', 'Жиі қойылатын сұрақтар'],
  count: count => `${count} есім`, letterLink: letter => `${letter} әрпі`, listLink: ['Барлық қыз есімдері', 'Барлық ұл есімдері'],
  faqQ: [name => `${name} есімі нені білдіреді?`, name => `${name} қыз есімі ме, әлде ұл есімі ме?`, name => `${name} есімінің шығу тегі қандай?`],
  faqMeaning: (name, meaning) => `${name} есімі «${meaning}» дегенді білдіреді.`, faqOrigin: (name, origin) => `Anacan есімдер базасы бойынша ${name} есімінің шығу тегі: ${origin}.`,
  app: ['Anacan қосымшасында көбірек', 'Ұнаған есімдерді сақтаңыз, жұбайыңызбен бірге таңдаңыз және тізімде жоқ есімнің мағынасын да табыңыз.', ['Кез келген есімнің мағынасын жасанды интеллектпен іздеу', 'Таңдаулы есімдер тізімі', 'Жұбайыңызбен бірге таңдау: екеуіңізге де ұнаған есімдер сәйкестік ретінде көрінеді']],
  dataNote: 'Мағыналар Anacan қосымшасының есімдер базасынан алынған. Танымалдық Anacan рейтингі (0-100), ресми статистика емес.',
});
const ES = simpleCopy({
  slugs: ['nombres-de-bebe', 'nombres-de-nina', 'nombres-de-nino', 'letra'], labels: ['Nombres de bebé', 'Nombres de niña', 'Nombres de niño'], year: '2026-2027',
  hubTitle: 'Nombres de bebé 2026-2027: significado y origen', hubH1: 'Nombres de bebé 2026-2027: nombres de niña y niño con significado',
  girlTitle: 'Nombres de niña 2026-2027 y su significado', girlH1: 'Nombres de niña 2026-2027 con significado',
  boyTitle: 'Nombres de niño 2026-2027 y su significado', boyH1: 'Nombres de niño 2026-2027 con significado',
  hubDescription: count => `${count} nombres con significado y origen: nombres de niña, nombres de niño, los más populares y una lista por letra. Busca un nombre y descubre qué significa.`,
  hubIntro: count => `¿Buscas nombre para tu bebé? Aquí tienes el significado, el origen y la popularidad de ${count} nombres. Busca un nombre o elige por la primera letra.`,
  listDescription: (gender, count) => `${count} nombres de ${gender === 'girl' ? 'niña' : 'niño'} con significado y origen: modernos, clásicos y los más populares en España y Latinoamérica.`,
  letterTitle: letter => `Nombres que empiezan por ${letter}: niña y niño`, letterH1: letter => `Nombres que empiezan por ${letter}`,
  letterDescription: (letter, count) => `${count} nombres que empiezan por ${letter} con significado y origen: nombres de niña y de niño.`,
  detailTitle: name => `${name}: significado y origen del nombre`, detailH1: name => `Significado del nombre ${name}`,
  detail: (entry, gender) => `Qué significa ${entry.name}: ${entry.meaning}. ${entry.origin ? `Origen: ${entry.origin}. ` : ''}${gender}. Nombres parecidos y elección de nombre en la app Anacan.`,
  gender: { girl: 'Nombre de niña', boy: 'Nombre de niño', unisex: 'Nombre de niña y de niño' }, genderShort: { girl: 'Niña', boy: 'Niño', unisex: 'Ambos' },
  genderSentence: { girl: name => `${name} es un nombre de niña.`, boy: name => `${name} es un nombre de niño.`, unisex: name => `${name} se usa tanto para niñas como para niños.` },
  words: ['Significado', 'Origen', 'Género', 'Popularidad'], rank: (rank, total) => `puesto ${rank} de ${total}`,
  ui: ['Nombres parecidos', 'Nombres de niña más populares', 'Nombres de niño más populares', 'Nombres por letra', 'Todos los nombres', 'Busca un nombre o un significado', 'Por ejemplo: Lucía o «luz»', 'No encontramos el nombre. En la app Anacan puedes buscar el significado de cualquier nombre con IA.', 'Todos los nombres de bebé', 'Preguntas frecuentes'],
  count: count => `${count} nombres`, letterLink: letter => `Letra ${letter}`, listLink: ['Todos los nombres de niña', 'Todos los nombres de niño'],
  faqQ: [name => `¿Qué significa el nombre ${name}?`, name => `¿${name} es nombre de niña o de niño?`, name => `¿Cuál es el origen del nombre ${name}?`],
  faqMeaning: (name, meaning) => `El nombre ${name} significa «${meaning}».`, faqOrigin: (name, origin) => `Según la base de nombres de Anacan, el origen de ${name} es: ${origin}.`,
  app: ['Más en la app Anacan', 'Guarda los nombres que te gustan, elige junto a tu pareja y descubre el significado de cualquier nombre que no esté en la lista.', ['Búsqueda del significado de cualquier nombre con IA', 'Lista de nombres favoritos', 'Elegir nombre en pareja: los nombres que os gustan a los dos aparecen como coincidencia']],
  dataNote: 'Los significados proceden de la base de nombres de Anacan. La popularidad es la puntuación de Anacan (0-100), no una estadística oficial.',
});
Object.assign(NAMES_COPY, { ru: RU, tr: TR, uz: UZ, kk: KK, es: ES });

/** Azerbaijani ASCII letter scheme: every letter of the alphabet keeps a distinct slug. */
const AZ_LETTER_SLUGS: Record<string, string> = {
  a: 'a', b: 'b', c: 'c', 'ç': 'ch', d: 'd', e: 'e', 'ə': 'ae', f: 'f', g: 'g', 'ğ': 'gh', h: 'h', x: 'x', 'ı': 'ii', i: 'i',
  j: 'j', k: 'k', q: 'q', l: 'l', m: 'm', n: 'n', o: 'o', 'ö': 'oe', p: 'p', r: 'r', s: 's', 'ş': 'sh', t: 't', u: 'u', 'ü': 'ue',
  v: 'v', w: 'w', y: 'y', z: 'z',
};
/** The site's usual ASCII folding (same result as `localizedSlug` in routes.ts for Azerbaijani). */
const AZ_PLAIN: Record<string, string> = { 'ç': 'c', 'ə': 'e', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u' };
export const azLower = (value: string) => value.replace(/İ/g, 'i').replace(/I/g, 'ı').toLowerCase();
const azUpper = (value: string) => value.replace(/i/g, 'İ').replace(/ı/g, 'I').toUpperCase();
const slugify = (value: string) => value.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
export function azPlainSlug(name: string): string { return slugify([...azLower(name)].map(char => AZ_PLAIN[char] ?? char).join('')); }
export function azDistinctSlug(name: string): string { return slugify([...azLower(name)].map(char => AZ_LETTER_SLUGS[char] ?? char).join('')); }
/** First letter as shown in the index. Georgian stays Mkhedruli (toUpperCase would turn it into Mtavruli). */
export function letterOf(language: NamesLanguage, name: string): string {
  const first = [...name.trim()][0] || '';
  return language === 'az' ? azUpper(first) : language === 'ka' ? first : first.toLocaleUpperCase(language);
}
export function letterSlug(language: NamesLanguage, letter: string): string {
  if (language === 'az') return AZ_LETTER_SLUGS[azLower(letter)] ?? slugify(azLower(letter));
  return language === 'ka' ? letter : letter.toLocaleLowerCase(language);
}
function unicodeSlug(name: string): string { return name.trim().toLowerCase().replace(/[\s/\\?#<>]+/gu, '-'); }

export function buildNamesIndex(language: NamesLanguage, rows: readonly NameRow[]): NamesIndex {
  const valid = rows.filter(row => row.name?.trim() && row.meaning?.trim());
  const ranked = [...valid].sort((a, b) => b.popularity - a.popularity || a.name.localeCompare(b.name));
  const rank = new Map(ranked.map((row, index) => [row, index + 1]));
  const base = valid.map(row => language === 'az' ? azPlainSlug(row.name) : unicodeSlug(row.name));
  const groups = new Map<string, number[]>();
  base.forEach((slug, index) => groups.set(slug, [...(groups.get(slug) || []), index]));
  const slugs = base.slice();
  for (const [slug, members] of groups) {
    if (members.length < 2) continue;
    // The name that already is the plain spelling keeps the short slug; the others become distinct.
    const keeper = members.find(index => azLower(valid[index].name) === slug) ?? members[0];
    for (const index of members) if (index !== keeper) slugs[index] = language === 'az' ? azDistinctSlug(valid[index].name) : `${slug}-${index}`;
  }
  const seen = new Set<string>();
  const names = valid.map((row, index) => {
    let slug = slugs[index], suffix = 2;
    while (seen.has(slug)) slug = `${slugs[index]}-${suffix++}`;
    seen.add(slug);
    const letter = letterOf(language, row.name);
    return { ...row, slug, letter, letterSlug: letterSlug(language, letter), rank: rank.get(row)! };
  });
  const counts = new Map<string, NameLetter>();
  for (const entry of names) {
    const item = counts.get(entry.letter) || { letter: entry.letter, slug: entry.letterSlug, count: 0, page: false };
    item.count++; item.page = item.count >= LETTER_PAGE_MIN; counts.set(entry.letter, item);
  }
  return { language, names, bySlug: new Map(names.map(entry => [entry.slug, entry])), letters: [...counts.values()] };
}

export const matchesGender = (entry: NameEntry, gender: 'girl' | 'boy') => entry.gender === gender || entry.gender === 'unisex';
export function genderNames(index: NamesIndex, gender: 'girl' | 'boy') { return index.names.filter(entry => matchesGender(entry, gender)); }
export function popularNames(index: NamesIndex, gender: 'girl' | 'boy', limit = 12) {
  return genderNames(index, gender).sort((a, b) => a.rank - b.rank).slice(0, limit);
}
export function letterPage(index: NamesIndex, slug: string | undefined) { return index.letters.find(item => item.page && item.slug === slug); }
export function letterNames(index: NamesIndex, letter: NameLetter) { return index.names.filter(entry => entry.letter === letter.letter); }
/** Similar names: same gender (unisex fits both), then same origin, then same first letter; most popular first. */
export function similarNames(index: NamesIndex, entry: NameEntry, limit = 12): NameEntry[] {
  const origins = new Set(entry.origin.split('/').map(item => item.trim()).filter(Boolean));
  const score = (other: NameEntry) => (other.gender === entry.gender || other.gender === 'unisex' || entry.gender === 'unisex' ? 4 : 0)
    + (other.origin.split('/').some(item => origins.has(item.trim())) ? 2 : 0) + (other.letter === entry.letter ? 1 : 0);
  return index.names.filter(other => other.slug !== entry.slug).map(other => ({ other, value: score(other) }))
    .filter(item => item.value >= 5).sort((a, b) => b.value - a.value || a.other.rank - b.other.rank).slice(0, limit).map(item => item.other);
}
export function namesCopy(language: WebsiteLanguageCode): NamesCopy | undefined {
  return isNamesLanguage(language) ? NAMES_COPY[language] : undefined;
}
