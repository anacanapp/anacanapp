/**
 * Baby-name pages of the public website ("Uşaq adları"): /<lang>/<hub>/, gender lists, letter pages and
 * one detail page per name. Data comes from bundled snapshots of the app's `baby_names_db`
 * (`tools/data/names-<lang>.json`, only rows with a meaning in that language). Texts live here, not in
 * `copy/*.json` (copy-key runtime rule in docs/WEBSITE_GOOGLE_20261006.md).
 *
 * Adding a language later (tr/ru/kk/en are planned): add `data/names-<lang>.json`, a `NAMES_COPY`
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
export const NAMES_LANGUAGES = ['az', 'ka', 'tr', 'ru', 'kk', 'en'] as const;
export type NamesLanguage = typeof NAMES_LANGUAGES[number];
export const NAMES_ENABLED: readonly NamesLanguage[] = ['az', 'ka'];
export const LETTER_PAGE_MIN = 5;
/** Snapshot date of the bundled data (sitemap lastmod). */
export const NAMES_UPDATED = '2026-11-10';
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
    hubTitle: 'Uşaq adları 2026: qız və oğlan adları, mənaları',
    hubH1: 'Uşaq adları 2026: mənaları ilə qız və oğlan adları',
    hubDescription: count => `${count} ad mənası və mənşəyi ilə: qız adları, oğlan adları, ən populyar adlar və hərflər üzrə siyahı. Adı axtarın, mənasını oxuyun.`,
    hubIntro: count => `Övladınız üçün ad seçirsiniz? Burada ${count} adın mənası, mənşəyi və populyarlığı var. Adı axtarın, qız və ya oğlan adlarına baxın, hərflər üzrə seçin.`,
    girlTitle: 'Qız adları 2026: müasir qız adları və mənaları', girlH1: 'Qız adları 2026: mənaları ilə',
    boyTitle: 'Oğlan adları 2026: müasir oğlan adları və mənaları', boyH1: 'Oğlan adları 2026: mənaları ilə',
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
    related: { label: 'Müasir Azərbaycan adları 2026: məqalə', articleSlug: 'muasir-azerbaycan-adlari-2026-ci-il-ucun-en-populyar-oglan-ve-qiz-adlari-menalari-ile' },
    dataNote: 'Mənalar Anacan tətbiqinin ad bazasındandır. Populyarlıq Anacan reytinqidir (0-100), rəsmi statistika deyil.',
  },
  ka: {
    hubSlug: 'ბავშვის-სახელები', girlSlug: 'გოგოს-სახელები', boySlug: 'ბიჭის-სახელები', letterSlug: 'ასო',
    hubLabel: 'ბავშვის სახელები', girlLabel: 'გოგოს სახელები', boyLabel: 'ბიჭის სახელები',
    hubTitle: 'ბავშვის სახელები 2026: მნიშვნელობა და წარმოშობა',
    hubH1: 'ბავშვის სახელები 2026: გოგოს და ბიჭის სახელები მნიშვნელობით',
    hubDescription: count => `${count} სახელი მნიშვნელობითა და წარმოშობით: გოგოს სახელები, ბიჭის სახელები, პოპულარული სახელები და ანბანური სია.`,
    hubIntro: count => `ბავშვისთვის სახელს არჩევთ? აქ ნახავთ ${count} სახელის მნიშვნელობას, წარმოშობას და პოპულარობას. მოძებნეთ სახელი ან აირჩიეთ ასოს მიხედვით.`,
    girlTitle: 'გოგოს სახელები 2026: მნიშვნელობა და წარმოშობა', girlH1: 'გოგოს სახელები 2026 მნიშვნელობით',
    boyTitle: 'ბიჭის სახელები 2026: მნიშვნელობა და წარმოშობა', boyH1: 'ბიჭის სახელები 2026 მნიშვნელობით',
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
