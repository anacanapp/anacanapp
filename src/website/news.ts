// Dates confirmed by the owner on 2026-11-10: Microsoft for Startups (Azure) 3 Jul 2026, Google for Startups 5 Jul 2026,
// Anthropic for Startups 1 Sep 2026, Inmerge Innovation Summit talk + Startup Booth 30 Nov - 1 Dec 2026.
/**
 * Anacan news ("Xəbərlər" / "News"): Azerbaijani is the source (/az/xeberler/<slug>/), English versions live in
 * `en` (/en/news/<en-slug>/). Edit this array to add, change or remove a news item (newest first). Texts are plain
 * strings (no HTML, no Markdown); slugs are published URLs, keep them stable once live. An item without `en` stays
 * Azerbaijani-only (no English page, no hreflang to en), e.g. the PDF books item: the shop is not promoted outside AZ.
 * No copy keys: the website copy-key guard stays untouched (inline labels are in NEWS_LABELS).
 */
export type NewsBlock =
  | { type: 'p'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'quote'; text: string };

export const PARTNER_IDS = ['google', 'microsoft', 'aws', 'nvidia', 'anthropic', 'idda', 'epoint', 'inmerge', 'thetech'] as const;
export type PartnerId = typeof PARTNER_IDS[number];
/** Logo file under public/, its display name and shape: `icon` marks (square symbols) are shown with
 * the name next to them, `wide` logos already contain the name. */
export const PARTNERS: Record<PartnerId, { name: string; src: string; shape: 'icon' | 'wide' }> = {
  google: { name: 'Google', src: '/website/partners/google.svg', shape: 'icon' },
  microsoft: { name: 'Microsoft', src: '/website/partners/microsoft.svg', shape: 'icon' },
  aws: { name: 'AWS', src: '/website/partners/aws.svg', shape: 'wide' },
  nvidia: { name: 'NVIDIA', src: '/website/partners/nvidia.svg', shape: 'icon' },
  anthropic: { name: 'Anthropic', src: '/website/partners/anthropic.svg', shape: 'icon' },
  idda: { name: 'İDDA', src: '/website/partners/idda.svg', shape: 'wide' },
  epoint: { name: 'Epoint', src: '/website/partners/epoint.svg', shape: 'wide' },
  inmerge: { name: 'Inmerge', src: '/website/partners/inmerge.svg', shape: 'wide' },
  thetech: { name: 'The Tech', src: '/website/partners/thetech.png', shape: 'icon' },
};

/** Languages with a news section. Other website languages have no news pages (404). */
export const NEWS_LANGUAGES = ['az', 'en'] as const;
export type NewsLanguage = typeof NEWS_LANGUAGES[number];
export const isNewsLanguage = (value: string): value is NewsLanguage => (NEWS_LANGUAGES as readonly string[]).includes(value);

/** Inline UI labels of the news section (list/detail pages, home block, footer link, breadcrumb, SEO). */
export const NEWS_LABELS: Record<NewsLanguage, {
  news: string; eyebrow: string; homeIntro: string; listIntro: string; all: string; others: string; read: string;
  minutes: (count: number) => string; metaTitle: string; metaDescription: string;
}> = {
  az: { news: 'Xəbərlər', eyebrow: 'Yeniliklər', homeIntro: 'Anacan-dan son yeniliklər: dəstək proqramları, tərəfdaşlıqlar və yeni funksiyalar.',
    listIntro: 'Anacan-dan son yeniliklər: dəstək proqramları, tərəfdaşlıqlar, yeni dillər və yeni funksiyalar.', all: 'Bütün xəbərlər',
    others: 'Digər xəbərlər', read: 'Oxu', minutes: (count) => `${count} dəq oxu`, metaTitle: 'Anacan xəbərləri',
    metaDescription: 'Anacan-dan son yeniliklər: dəstək proqramları, tərəfdaşlıqlar, yeni dillər və yeni funksiyalar.' },
  en: { news: 'News', eyebrow: 'Updates', homeIntro: 'The latest from Anacan: startup programs, partnerships and new features.',
    listIntro: 'The latest from Anacan: startup programs, partnerships, new languages and new features.', all: 'All news',
    others: 'More news', read: 'Read', minutes: (count) => `${count} min read`, metaTitle: 'Anacan news',
    metaDescription: 'The latest news from Anacan: startup programs, partnerships, new languages and new features of the app.' },
};

/** A translated version of a news item (same facts, numbers, dates and quotes as the Azerbaijani source). */
export interface NewsTranslation {
  /** ASCII URL slug in this language; keep it stable once live. */
  slug: string;
  title: string;
  lead: string;
  tag: string;
  body: NewsBlock[];
  /** Label of the item's shop button; without it the button is left out in this language. */
  linkLabel?: string;
  /** Label of the item's external source button. */
  sourceLabel?: string;
  /** Caption of the art cover in this language (art covers carry text, so they get a localized file). */
  coverSub?: string;
}

export interface NewsItem {
  /** Azerbaijani slug: the /az/ URL and the item's stable id. */
  slug: string;
  /** ISO date, yyyy-mm-dd. */
  date: string;
  title: string;
  /** One or two sentences: used on cards, as the page lead and as the meta description. */
  lead: string;
  tag: string;
  partner?: PartnerId;
  readMinutes: number;
  body: NewsBlock[];
  /** Optional button after the text that opens an Azerbaijani shop page. */
  link?: { kind: 'books' | 'cakes'; label: string };
  /** Optional external source (media mention), opened in a new tab. */
  source?: { href: string; label: string };
  /** Cover art for items without a partner logo: a character pose and a big number with a caption. */
  coverArt?: { character: string; big: string; sub: string };
  /** English version; absent means the item is Azerbaijani-only. */
  en?: NewsTranslation;
}

/** Minimal 1200x630 cover (generated by scripts/website/news-covers.mjs into public/website/news/). Partner covers
 * show logos only and are shared by every language; art covers have a caption, so a translated item gets its own
 * file under public/website/news/<lang>/<localized-slug>.jpg. */
export const newsCover = (item: NewsItem, language: NewsLanguage = 'az') => {
  const local = !item.partner && language !== 'az' ? item[language] : undefined;
  const art = item.coverArt ?? { character: 'qucaq-welcome', big: 'Anacan', sub: '' };
  return {
    src: local ? `/website/news/${language}/${local.slug}.jpg` : `/website/news/${item.slug}.jpg`,
    ...(item.partner ? { kind: 'partner' as const, partner: item.partner } : { kind: 'art' as const, ...art, ...(local?.coverSub ? { sub: local.coverSub } : {}) }),
  };
};
export type NewsCover = ReturnType<typeof newsCover>;

/** One item as shown in one language: localized texts, `id` = the Azerbaijani slug. */
export interface LocalNews extends Omit<NewsItem, 'en'> { id: string; language: NewsLanguage; cover: NewsCover }

export function localNews(item: NewsItem, language: NewsLanguage): LocalNews | undefined {
  const { en: _en, ...base } = item;
  if (language === 'az') return { ...base, id: item.slug, language, cover: newsCover(item, 'az') };
  const local = item[language];
  if (!local) return undefined;
  return {
    ...base, id: item.slug, language, slug: local.slug, title: local.title, lead: local.lead, tag: local.tag, body: local.body,
    link: item.link && local.linkLabel ? { kind: item.link.kind, label: local.linkLabel } : undefined,
    source: item.source && local.sourceLabel ? { href: item.source.href, label: local.sourceLabel } : undefined,
    cover: newsCover(item, language),
  };
}

export const NEWS: NewsItem[] = [
  {
    slug: 'anacan-aws-activate-proqramina-qebul-olundu',
    date: '2026-11-10',
    title: 'Anacan AWS Activate proqramına qəbul olundu: 10 000 dollarlıq bulud dəstəyi',
    lead: 'Anacan Amazon Web Services (AWS) şirkətinin startaplar üçün əsas dəstək proqramı olan AWS Activate-ə qəbul olunub və 10 000 ABŞ dolları həcmində AWS bulud krediti əldə edib.',
    tag: 'Dəstək',
    partner: 'aws',
    readMinutes: 3,
    body: [
      { type: 'p', text: 'Azərbaycanın süni intellektə əsaslanan analıq və valideynlik super-tətbiqi Anacan Amazon Web Services (AWS) şirkətinin startaplar üçün əsas dəstək proqramı olan AWS Activate-ə qəbul olunub. Proqram çərçivəsində Anacan 10 000 ABŞ dolları həcmində AWS bulud krediti əldə edib.' },
      { type: 'p', text: 'Bu dəstək Anacan-ın texnoloji infrastrukturunu gücləndirməyə, süni intellekt funksiyalarını daha sürətli inkişaf etdirməyə və tətbiqi daha çox ölkədə daha çox ailəyə çatdırmağa imkan verəcək.' },
      { type: 'h2', text: 'AWS Activate nədir?' },
      { type: 'p', text: 'AWS Activate 2013-cü ildən fəaliyyət göstərən və dünya üzrə 330 mindən çox startapı birləşdirən qlobal proqramdır. Proqram iştirakçılarına AWS bulud xidmətlərinin xərclərini qarşılamaq üçün kreditlər, texniki dəstək, arxitektura üzrə ekspert məsləhətləri, təlimlər və xüsusi təkliflər təqdim edir. Proqrama qəbul olunmaq üçün startapın müəyyən mərhələ və uyğunluq meyarlarına cavab verməsi tələb olunur.' },
      { type: 'h2', text: 'Bu dəstək Anacan-a nə qazandıracaq?' },
      { type: 'p', text: 'AWS kreditləri Anacan komandasına aşağıdakı istiqamətlərdə imkan yaradacaq:' },
      { type: 'list', items: [
        'Süni intellekt funksiyalarının inkişafı: Anacan AI assistenti, Ağlama Tərcüməçisi və fərdi nağıl generatoru kimi alətlərin daha sürətli və dəqiq işləməsi;',
        'Etibarlı və təhlükəsiz infrastruktur: istifadəçi məlumatlarının yüksək təhlükəsizlik standartları ilə qorunması;',
        'Miqyaslanma: istifadəçi sayı artdıqca tətbiqin sabit və sürətli işləməsi;',
        'Yeni bazarlara çıxış: Azərbaycandan sonra Qazaxıstan, Özbəkistan və digər ölkələrdəki ailələrə xidmətin genişləndirilməsi.',
      ] },
      { type: 'h2', text: 'Qlobal texnoloji ekosistemdə daha bir addım' },
      { type: 'p', text: 'AWS Activate Anacan-ın qlobal texnologiya liderləri ilə əməkdaşlıq yolunda növbəti mərhələdir. Bundan əvvəl Anacan Microsoft for Startups (100 000 dollarlıq Azure krediti ilə), Google for Startups və NVIDIA Inception proqramlarına qəbul olunub.' },
      { type: 'quote', text: 'AWS Activate proqramına qəbul olunmaq bizim üçün böyük məsuliyyət və motivasiyadır. Məqsədimiz qadınlara və ailələrə hamiləliyi planlaşdırmaqdan körpənin ilk addımlarına qədər etibarlı, təhlükəsiz və fərdi dəstək verən qlobal rəqəmsal ekosistem qurmaqdır. AWS-in imkanları bu yolda daha sürətli irəliləməyimizə kömək edəcək. (Türkan Sultanlı, Anacan-ın həmtəsisçisi və baş icraçı direktoru)' },
      { type: 'h2', text: 'Anacan haqqında' },
      { type: 'p', text: 'Anacan hamiləliyi planlaşdıran qadınlar, gələcək analar və 3 yaşadək uşağı olan valideynlər üçün yaradılmış, süni intellektə əsaslanan super-tətbiqdir. Tətbiq hamiləliyin və uşağın inkişafının izlənməsi, Anacan AI assistenti, Ağlama Tərcüməçisi, fərdi nağıl generatoru və onlarla digər faydalı aləti bir məkanda birləşdirir. «Partnyor rejimi» sayəsində atalar və digər ailə üzvləri də tətbiqdən öz dillərində istifadə edə bilirlər. Anacan App Store və Google Play-də mövcuddur.' },
    ],
    en: {
      slug: 'anacan-accepted-into-aws-activate',
      title: 'Anacan accepted into AWS Activate: $10,000 in cloud support',
      lead: 'Anacan has been accepted into AWS Activate, the main startup support program of Amazon Web Services (AWS), and has received USD 10,000 in AWS cloud credits.',
      tag: 'Support',
      body: [
        { type: 'p', text: 'Anacan, Azerbaijan\'s AI-powered motherhood and parenting super app, has been accepted into AWS Activate, the main startup support program of Amazon Web Services (AWS). Under the program, Anacan has received USD 10,000 in AWS cloud credits.' },
        { type: 'p', text: 'This support will help Anacan strengthen its technology infrastructure, develop its artificial intelligence features faster and bring the app to more families in more countries.' },
        { type: 'h2', text: 'What is AWS Activate?' },
        { type: 'p', text: 'AWS Activate is a global program that has been running since 2013 and brings together more than 330,000 startups worldwide. It offers participants credits to cover the cost of AWS cloud services, technical support, expert architecture guidance, training and special offers. To be accepted, a startup must meet certain stage and eligibility criteria.' },
        { type: 'h2', text: 'What will this support bring to Anacan?' },
        { type: 'p', text: 'The AWS credits will create opportunities for the Anacan team in the following areas:' },
        { type: 'list', items: [
          'Developing artificial intelligence features: faster and more accurate performance of tools such as the Anacan AI assistant, the Cry Translator and the personalized fairy tale generator;',
          'Reliable and secure infrastructure: protecting user data to high security standards;',
          'Scaling: keeping the app stable and fast as the number of users grows;',
          'Entering new markets: expanding the service beyond Azerbaijan to families in Kazakhstan, Uzbekistan and other countries.',
        ] },
        { type: 'h2', text: 'Another step in the global technology ecosystem' },
        { type: 'p', text: 'AWS Activate is the next stage in Anacan\'s collaboration with global technology leaders. Anacan was previously accepted into Microsoft for Startups (with USD 100,000 in Azure credits), Google for Startups and NVIDIA Inception.' },
        { type: 'quote', text: 'Being accepted into AWS Activate is a great responsibility and a source of motivation for us. Our goal is to build a global digital ecosystem that gives women and families reliable, safe and personalized support, from planning a pregnancy to a baby\'s first steps. AWS\'s capabilities will help us move faster on this path. (Türkan Sultanlı, co-founder and CEO of Anacan)' },
        { type: 'h2', text: 'About Anacan' },
        { type: 'p', text: 'Anacan is an AI-powered super app created for women planning a pregnancy, expectant mothers and parents of children up to 3 years old. The app brings together pregnancy and child development tracking, the Anacan AI assistant, the Cry Translator, a personalized fairy tale generator and dozens of other useful tools in one place. Thanks to Partner mode, fathers and other family members can also use the app in their own language. Anacan is available on the App Store and Google Play.' },
      ],
    },
  },
  {
    slug: 'anacan-inmerge-innovation-summit-2026-da',
    date: '2026-11-10',
    title: 'Anacan Inmerge Innovation Summit 2026-da çıxış edəcək',
    lead: '30 noyabr və 1 dekabr 2026-cı il tarixlərində keçiriləcək Inmerge Innovation Summit-də Anacan həm səhnədə çıxış edəcək, həm də Startup Booth zonasında öz stendi ilə iştirak edəcək.',
    tag: 'Tədbir',
    partner: 'inmerge',
    readMinutes: 3,
    body: [
      { type: 'p', text: 'Sevindirici xəbər: Anacan 30 noyabr və 1 dekabr 2026-cı il tarixlərində keçiriləcək Inmerge Innovation Summit-də iştirak edəcək. Komandamız sammitdə səhnədə çıxış edəcək, iki gün boyunca isə Startup Booth zonasında öz stendimizdə qonaqlarla görüşəcəyik.' },
      { type: 'h2', text: 'Inmerge Innovation Summit nədir?' },
      { type: 'p', text: 'Inmerge Innovation Summit startapları, investorları, şirkətləri və texnologiya ilə maraqlanan hər kəsi bir araya gətirən innovasiya tədbiridir. Burada yeni ideyalar təqdim olunur, tərəfdaşlıqlar qurulur və ekosistemin gələcəyi müzakirə edilir. Azərbaycanda yaradılmış bir məhsul kimi bu səhnədə olmaq bizim üçün böyük şərəfdir.' },
      { type: 'h2', text: 'Stendimizdə nələr olacaq?' },
      { type: 'list', items: [
        'Anacan tətbiqini yerində sınamaq: həftə-həftə hamiləlik, körpə izləyicisi, dövr təqvimi və Anacan AI köməkçisi;',
        'Anacan-ın təsisçiləri və komandası ilə canlı söhbət;',
        'tərəfdaşlıq, investisiya və birgə layihələr barədə görüşlər;',
        'ailələr üçün texnologiyanın necə daha faydalı ola biləcəyi haqqında fikir mübadiləsi.',
      ] },
      { type: 'p', text: 'Anacan 2026-cı ilin martında istifadəyə verilib və qısa müddətdə 54-dən çox ölkədən istifadəçi qazanıb. Sammitdə bu yolu, qarşılaşdığımız çətinlikləri və növbəti planlarımızı paylaşmaq istəyirik.' },
      { type: 'quote', text: 'Hər görüş yeni bir ideya, hər ideya isə analar üçün daha rahat bir gün deməkdir.' },
      { type: 'p', text: 'Sammitdə olacaqsınızsa, Startup Booth zonasında Anacan stendinə yaxınlaşın, sizi görməyə şad olarıq. Çıxışın dəqiq vaxtını və stendin yerini sosial şəbəkələrimizdə paylaşacağıq.' },
    ],
    en: {
      slug: 'anacan-at-inmerge-innovation-summit-2026',
      title: 'Anacan to speak at Inmerge Innovation Summit 2026',
      lead: 'At Inmerge Innovation Summit, taking place on 30 November and 1 December 2026, Anacan will speak on stage and present its own stand in the Startup Booth area.',
      tag: 'Event',
      body: [
        { type: 'p', text: 'We are happy to share that Anacan will take part in Inmerge Innovation Summit, taking place on 30 November and 1 December 2026. Our team will speak on stage at the summit, and throughout both days we will welcome guests at our own stand in the Startup Booth area.' },
        { type: 'h2', text: 'What is Inmerge Innovation Summit?' },
        { type: 'p', text: 'Inmerge Innovation Summit is an innovation event that brings together startups, investors, companies and everyone interested in technology. It is where new ideas are presented, partnerships are formed and the future of the ecosystem is discussed. As a product created in Azerbaijan, being on this stage is a great honor for us.' },
        { type: 'h2', text: 'What will be at our stand?' },
        { type: 'list', items: [
          'trying the Anacan app on the spot: week-by-week pregnancy, the baby tracker, the cycle calendar and the Anacan AI assistant;',
          'live conversations with Anacan\'s founders and team;',
          'meetings about partnerships, investment and joint projects;',
          'an exchange of ideas on how technology can be more useful for families.',
        ] },
        { type: 'p', text: 'Anacan was launched in March 2026 and in a short time has gained users from more than 54 countries. At the summit, we want to share this journey, the challenges we have faced and our next plans.' },
        { type: 'quote', text: 'Every meeting brings a new idea, and every idea means an easier day for mothers.' },
        { type: 'p', text: 'If you are attending the summit, stop by the Anacan stand in the Startup Booth area. We will be glad to see you. We will share the exact time of the talk and the location of the stand on our social media.' },
      ],
    },
  },
  {
    slug: 'anacan-artiq-23-dilde',
    coverArt: { character: 'qucaq-welcome', big: '23', sub: 'dildə Anacan' },
    date: '2026-11-08',
    title: 'Anacan artıq 23 dildə',
    lead: 'Anacan tətbiqi artıq 23 dildə, rəsmi sayt 21 dildə, App Store səhifəsi isə 17 dildə mövcuddur. Ana dilində məlumat almaq hər ana üçün rahatlıq və güvən deməkdir.',
    tag: 'Məhsul',
    readMinutes: 3,
    body: [
      { type: 'p', text: 'Hamiləlik və körpə baxımı ilə bağlı məlumatı ana dilində oxumaq tamamilə fərqli hissdir. Hər termin aydın olur, hər tövsiyə daha rahat başa düşülür, narahatlıq azalır. Bu səbəbdən Anacan-ı ilk gündən çoxdilli məhsul kimi qurmağa çalışdıq. Bu gün sevinclə deyə bilərik: Anacan tətbiqi artıq 23 dildə mövcuddur.' },
      { type: 'h2', text: 'Rəqəmlərlə Anacan-ın dilləri' },
      { type: 'list', items: [
        'Tətbiq: 23 dil. Tətbiqin interfeysi və bölmələri seçdiyiniz dildə göstərilir.',
        'Sayt: anacan.az 21 dildə açılır, hər dilin öz ünvanı və tərcümə olunmuş məqalələri var.',
        'App Store səhifəsi: 17 dildə lokallaşdırılıb, yəni tətbiqi yükləməzdən əvvəl də onun haqqında öz dilinizdə oxuya bilərsiniz.',
      ] },
      { type: 'p', text: 'Bu yol bir gündə qət edilmədi. Hər yeni dil ilə birlikdə tətbiqdəki mətnlər, düymələr və izahatlar yenidən nəzərdən keçirilir, ekranlarda düzgün yerləşdiyi yoxlanılır. Daha çox dil daha çox ailə deməkdir və biz bu işi davam etdirəcəyik.' },
      { type: 'h2', text: 'Niyə bu qədər dil?' },
      { type: 'p', text: 'Azərbaycanlı ailələr dünyanın bir çox ölkəsində yaşayır. Almaniyada, Türkiyədə və ya Böyük Britaniyada yaşayan ana həkimlə yerli dildə danışır, evdə isə Azərbaycan dilində düşünür. Bəzi ailələrdə valideynlər fərqli dillərdə danışır, nənə və babalar isə başqa bir dili daha rahat başa düşür. Belə ailələrdə hər kəsin eyni məlumata öz dilində çata bilməsi çox dəyərlidir.' },
      { type: 'p', text: 'Partnyor hesabı bu baxımdan xüsusilə faydalıdır: ana və partnyor eyni hamiləlik səyahətini izləyir, amma hər biri tətbiqi özünə doğma olan dildə istifadə edə bilər. Beləliklə, heç kim tərcümə axtarmağa vaxt itirmir və vacib məqamlar diqqətdən yayınmır.' },
      { type: 'p', text: 'Diaspora ilə yanaşı, Anacan-ı başqa ölkələrdən olan analar da istifadə edə bilər. Mərkəzi Asiyadan Avropaya, Yaxın Şərqdən Şərqi Asiyaya qədər müxtəlif dillərdə danışan ailələr üçün tətbiqi əlçatan etmək istəyirik. Həftə-həftə hamiləlik məlumatı, körpə izləyicisi, dövr təqvimi və Anacan AI köməkçisi hər dildə eyni qayğı ilə işləməlidir.' },
      { type: 'h2', text: 'Tərcümə sadəcə sözlərin dəyişdirilməsi deyil' },
      { type: 'p', text: 'Lokallaşdırma zamanı təkcə mətnləri deyil, tarix formatlarını, sağdan sola yazılan dilləri və hər dilin öz ifadə tərzini nəzərə alırıq. Məsələn, ərəb dilində sayt sağdan sola göstərilir, Çin, Yapon və Koreya dillərində isə tarixlər həmin dillərin qaydası ilə yazılır. Saytda hər dilin öz səhifə ünvanları var, buna görə də axtarış sistemləri məqalələri istifadəçiyə öz dilində təqdim edə bilir.' },
      { type: 'p', text: 'Sağlamlıq mövzusunda dəqiqlik xüsusilə vacibdir. Ona görə də tərcümələri yoxlamağa və istifadəçilərin rəylərinə əsasən yaxşılaşdırmağa davam edirik. Bir sözün səhv seçilməsi bəzən bütün tövsiyənin mənasını dəyişə bilər, biz isə buna yol vermək istəmirik.' },
      { type: 'quote', text: 'Ana dilində verilən məlumat daha tez başa düşülür, daha uzun yadda qalır və daha çox güvən yaradır.' },
      { type: 'h2', text: 'Dilinizi necə seçmək olar?' },
      { type: 'p', text: 'Saytda yuxarı menyudakı dil seçimindən istifadə edin: hər səhifənin tərcüməsi öz ünvanında açılır. Tətbiqdə isə dili parametrlərdən dəyişmək mümkündür.' },
      { type: 'p', text: 'Sizin dilinizdə nəsə səhv və ya qeyri-təbii səslənirsə, bizə info@anacan.az ünvanına yazın. Hər rəy Anacan-ı bir az daha yaxşı edir və növbəti dillər üzərində işləyərkən bizə yol göstərir. Hansı dili növbəti görmək istədiyinizi də bizə yaza bilərsiniz.' },
    ],
    en: {
      slug: 'anacan-now-in-23-languages',
      title: 'Anacan is now available in 23 languages',
      lead: 'The Anacan app is now available in 23 languages, the official website in 21 languages and the App Store page in 17 languages. Information in their native language brings every mother comfort and trust.',
      tag: 'Product',
      coverSub: 'languages in Anacan',
      body: [
        { type: 'p', text: 'Reading about pregnancy and baby care in your native language feels completely different. Every term becomes clear, every recommendation is easier to understand and worry eases. That is why we set out to build Anacan as a multilingual product from day one. Today we are delighted to say that the Anacan app is now available in 23 languages.' },
        { type: 'h2', text: 'Anacan\'s languages in numbers' },
        { type: 'list', items: [
          'App: 23 languages. The app\'s interface and sections are shown in the language you choose.',
          'Website: anacan.az opens in 21 languages, and each language has its own address and translated articles.',
          'App Store page: localized into 17 languages, so you can read about the app in your own language even before downloading it.',
        ] },
        { type: 'p', text: 'This journey did not happen overnight. With every new language, the texts, buttons and explanations in the app are reviewed again and checked to make sure they fit correctly on screen. More languages mean more families, and we will continue this work.' },
        { type: 'h2', text: 'Why so many languages?' },
        { type: 'p', text: 'Azerbaijani families live in many countries around the world. A mother living in Germany, Türkiye or the United Kingdom speaks to her doctor in the local language but thinks in Azerbaijani at home. In some families the parents speak different languages, while the grandparents understand yet another language more easily. In families like these, it is very valuable for everyone to be able to access the same information in their own language.' },
        { type: 'p', text: 'The partner account is especially useful here: the mother and her partner follow the same pregnancy journey, but each of them can use the app in the language that feels most natural to them. This way, no one loses time looking for translations and important details are not missed.' },
        { type: 'p', text: 'Beyond the diaspora, mothers from other countries can use Anacan too. We want to make the app accessible to families who speak different languages, from Central Asia to Europe and from the Middle East to East Asia. Week-by-week pregnancy information, the baby tracker, the cycle calendar and the Anacan AI assistant should work with the same care in every language.' },
        { type: 'h2', text: 'Translation is more than swapping words' },
        { type: 'p', text: 'When localizing, we take into account not only the texts but also date formats, right-to-left languages and each language\'s own style of expression. For example, the website is displayed right to left in Arabic, while in Chinese, Japanese and Korean dates are written according to the conventions of those languages. Each language on the website has its own page addresses, so search engines can show articles to users in their own language.' },
        { type: 'p', text: 'Accuracy is especially important when it comes to health. That is why we keep reviewing the translations and improving them based on user feedback. Choosing the wrong word can sometimes change the meaning of an entire recommendation, and we do not want to let that happen.' },
        { type: 'quote', text: 'Information given in your native language is understood faster, remembered longer and builds more trust.' },
        { type: 'h2', text: 'How do I choose my language?' },
        { type: 'p', text: 'On the website, use the language selector in the top menu: each page\'s translation opens at its own address. In the app, you can change the language in the settings.' },
        { type: 'p', text: 'If something in your language sounds wrong or unnatural, write to us at info@anacan.az. Every piece of feedback makes Anacan a little better and guides us as we work on the next languages. You can also tell us which language you would like to see next.' },
      ],
    },
  },
  {
    slug: 'usaqlar-ucun-pdf-cap-kitablari-70-kitab-evde-cap',
    coverArt: { character: 'tumurcuq-success', big: '70', sub: 'PDF çap kitabı' },
    date: '2026-11-06',
    title: 'Uşaqlar üçün PDF çap kitabları: 70 kitab, evdə çap',
    lead: '6 aydan 6 yaşa qədər uşaqlar üçün 70 PDF çap kitabı: boyama, say, hərflər və məntiq. Kitab e-poçtla gəlir, siz onu evdə A4 kağıza çap edirsiniz.',
    tag: 'Məhsul',
    readMinutes: 3,
    link: { kind: 'books', label: 'Kitablara bax' },
    body: [
      { type: 'p', text: 'Uşaqla birlikdə keçirilən sakit vaxt çox dəyərlidir. Bir vərəq kağız, bir neçə karandaş və maraqlı tapşırıq kiçik uşaq üçün bütöv bir oyun dünyasına çevrilə bilər. Bu fikirlə Anacan-da yeni bölmə hazırladıq: uşaqlar üçün PDF çap kitabları. Kolleksiyada 6 aydan 6 yaşa qədər uşaqlar üçün 70 kitab var.' },
      { type: 'h2', text: 'Kitablarda nələr var?' },
      { type: 'p', text: 'Kitablar yaşa görə qruplaşdırılıb və hər birində uşağın inkişaf mərhələsinə uyğun tapşırıqlar yer alır:' },
      { type: 'list', items: [
        'Boyama: kiçik yaş üçün sadə şəkillər, böyük uşaqlar üçün daha detallı səhifələr;',
        'Say: əşyaları saymaq, rəqəmləri tanımaq və müqayisə etmək;',
        'Hərflər: hərfləri tanımaq, onları izləyərək yazmaq və ilk sözlərlə tanış olmaq;',
        'Məntiq: oxşarını tap, fərqi tap, ardıcıllığı davam etdir kimi tapşırıqlar.',
      ] },
      { type: 'p', text: 'Tapşırıqların çətinliyi yaşla birlikdə tədricən artır. Ən kiçiklər üçün sadə şəkillər, rənglər və formalarla tanışlıq əsas yer tutur. Məktəbəqədər yaşda isə hərflər, rəqəmlər və məntiq tapşırıqları çoxalır ki, uşaq məktəbə rahat və həvəslə hazırlaşsın.' },
      { type: 'p', text: 'Tapşırıqlar qısa və aydındır ki, uşaq yorulmadan, oyun kimi öyrənsin. Valideyn isə yanında oturub kömək edə, birlikdə danışa və uşağın kiçik uğurlarını sevinclə qeyd edə bilər.' },
      { type: 'h2', text: 'Necə işləyir?' },
      { type: 'list', items: [
        'Kitablar səhifəsində uşağın yaşına uyğun kitabları seçin.',
        'Ödənişi kartla edin: saytda ödənişlər Azərbaycan ödəniş xidməti Epoint vasitəsilə qəbul olunur.',
        'PDF fayl e-poçtunuza göndərilir.',
        'Kitabı evdə adi A4 kağıza çap edin və uşağınızla birlikdə başlayın.',
      ] },
      { type: 'p', text: 'Çatdırılma gözləmək lazım deyil: ödənişdən sonra fayl e-poçtla gəlir. Bir səhifə cırılsa və ya eyni tapşırığı bir daha etmək istəsəniz, sadəcə həmin səhifəni yenidən çap edirsiniz.' },
      { type: 'p', text: 'Çap üçün xüsusi printer və ya kağız lazım deyil: evdəki adi printer və standart A4 vərəq kifayətdir. Rəngli printeriniz yoxdursa, narahat olmayın: boyama səhifələri onsuz da uşağın öz rəngləri ilə canlanır.' },
      { type: 'h2', text: 'Niyə məhz çap kitabı?' },
      { type: 'p', text: 'Ekran qarşısında keçirilən vaxtı azaltmaq bir çox valideynin məqsədidir. Kağız üzərində işləmək uşağın əl hərəkətlərini, diqqətini və səbrini inkişaf etdirməyə kömək edir. Karandaşı düzgün tutmaq, xəttin içində qalmaq, şəkli axıra qədər rəngləmək kiçik, amma çox vacib bacarıqlardır. Üstəlik, çap edilmiş səhifə uşağın öz əsərinə çevrilir: onu soyuducunun qapısına yapışdırmaq, nənəyə göstərmək və ya xatirə qovluğunda saxlamaq olar.' },
      { type: 'p', text: 'Çap kitabları səfərdə, həkim növbəsində, xəstəlik günlərində və ya sadəcə yağışlı bir axşamda əla köməkçidir. Bir neçə vərəqi çantaya qoyun, uşağın harada olursa olsun maraqlı bir məşğuliyyəti olacaq. Uzun yolda, qonaqlıqda və ya kiçik qardaşı yatarkən belə sakit və faydalı bir oyun hər zaman əlinizin altında olacaq.' },
      { type: 'quote', text: 'Ən yaxşı oyuncaq bəzən sadə bir vərəq, rəngli karandaşlar və yanında oturan valideyndir.' },
      { type: 'h2', text: 'Anacan ailəsinin bir parçası' },
      { type: 'p', text: 'PDF kitablar Anacan-ın əsas məqsədinə xidmət edir: hamiləlikdən başlayaraq uşağın ilk illərinə qədər ailənin yanında olmaq. Tətbiqdə həftə-həftə hamiləlik, körpə izləyicisi, dövr təqvimi və Anacan AI köməkçisi var, kitablar isə bu qayğını kağız üzərinə, evinizin masasına gətirir.' },
      { type: 'p', text: 'Kolleksiyaya baxmaq və uşağınızın yaşına uyğun kitabları seçmək üçün Kitablar səhifəsinə keçin.' },
    ],
  },
  {
    slug: 'qazaxistanin-the-tech-nesri-anacan-haqqinda-yazdi',
    date: '2026-10-22',
    title: 'Qazaxıstanın The Tech nəşri Anacan haqqında yazdı',
    lead: 'Qazaxıstanın The Tech nəşri Bakıdan çıxan Anacan startapı haqqında məqalə dərc etdi. Yazıda tətbiqin analar üçün 30-dan çox süni intellekt alətini bir yerdə necə birləşdirdiyindən danışılır.',
    tag: 'Media',
    partner: 'thetech',
    readMinutes: 3,
    source: { href: 'https://the-tech.kz/kak-startap-iz-baku-obedinil-bolshe-30-ii-instrumentov-dlya-mam-v-odnom-prilozhenii/', label: 'Məqaləni The Tech saytında oxu' },
    body: [
      { type: 'p', text: 'Qazaxıstanın texnologiya nəşri The Tech Anacan haqqında geniş məqalə dərc etdi. Yazıda Bakıdan çıxan startapın analar üçün 30-dan çox süni intellekt alətini bir tətbiqdə necə birləşdirdiyi danışılır. Bu diqqət bizim üçün çox qiymətlidir: Anacan-ı artıq Azərbaycandan kənarda da tanıyır və izləyirlər.' },
      { type: 'h2', text: 'Məqalədə nələr deyilir?' },
      { type: 'p', text: 'Yazıda Anacan-ın yaranma hekayəsi, komandası və ilk aylarda əldə etdiyi nəticələr təqdim olunur. Tətbiq 1 mart 2026-cı ildə istifadəyə verilib. Anacan-ı Türkan Sultanlı (CEO, məhsul və strategiya) və Camil Sultanlı (CTO və CMO) qurub. Anacan hamiləlik, analıq və menstrual dövr üçün yaradılmış, iOS və Android-də işləyən yoldaş tətbiqdir.' },
      { type: 'p', text: 'Xatırladaq ki, tətbiqdə həftə-həftə hamiləlik, körpə izləyicisi, dövr təqvimi, Anacan AI köməkçisi, icma, partnyor hesabı və həkim üçün PDF hesabatı kimi bölmələr var. Anacan 23 dildə mövcuddur, backend xidmətləri və verilənlər bazası isə Google Cloud-un europe-west1 (Belçika) regionunda işləyir.' },
      { type: 'h2', text: 'Rəqəmlərlə ilk yeddi ay' },
      { type: 'p', text: 'Məqalədə qeyd olunan nəticələr bunlardır:' },
      { type: 'list', items: [
        '7 ayda 35 000-dən çox yükləmə;',
        'ayda təxminən 30 000 aktiv istifadəçi;',
        '54-dən çox ölkədən istifadəçilər, o cümlədən Qazaxıstan və Özbəkistandan minlərlə ana;',
        'App Store-da 500-dən çox qiymətləndirmə əsasında 4,84 reytinq;',
        '7 ölkədə ödənişli abunəçilər;',
        'aylıq 10 000-dən çox aktiv istifadəçisi olan icma;',
        '30-dan çox süni intellekt aləti.',
      ] },
      { type: 'p', text: 'Bu rəqəmlərin arxasında hər gün tətbiqi açan, sual verən, qeyd aparan və bir-birinə dəstək olan analar dayanır. Onların etimadı bizim üçün ən böyük motivasiyadır.' },
      { type: 'p', text: 'Qazaxıstan və Özbəkistandan olan istifadəçilərin çoxluğu bizi xüsusilə sevindirir. Tətbiq qazax və özbək dillərində də mövcuddur, bu da həmin ölkələrdəki analara məlumatı öz ana dillərində almaq imkanı verir.' },
      { type: 'h2', text: 'Ekosistem və dəstək' },
      { type: 'p', text: 'Məqalədə Anacan-ın Microsoft for Startups və Google for Startups proqramlarının iştirakçısı olduğu da qeyd edilir. NVIDIA, AWS və Google Cloud infrastruktur tərəfdaşları kimi çıxış edir, onların təqdim etdiyi kreditlərin ümumi dəyəri 705 000 ABŞ dollarıdır. Anacan Azərbaycanda rəsmi startap şəhadətnaməsinə malikdir.' },
      { type: 'p', text: 'Ekosistemə verdiyi dəstəyə görə İDDA-ya, eləcə də Azerbaijan Startup Community-yə təşəkkür edirik. Belə dəstək gənc komandaya daha cəsarətli addımlar atmağa imkan verir.' },
      { type: 'h2', text: 'Növbəti mərhələ' },
      { type: 'p', text: 'Hazırda Anacan seed investisiya raunduna hazırlaşır. Məqsədimiz tətbiqi daha çox ölkədə daha çox ailəyə çatdırmaq, süni intellekt alətlərini təkmilləşdirmək və məxfiliyə verdiyimiz önəmi qoruyaraq böyüməkdir.' },
      { type: 'quote', text: 'Hər yeni ölkə və hər yeni istifadəçi bizim üçün məsuliyyətdir: ana dəstəyi öz dilində və öz ritmində almalıdır.' },
      { type: 'p', text: 'The Tech komandasına Anacan-a göstərdiyi diqqət üçün təşəkkür edirik. Məqalənin tam mətni rus dilindədir və onu aşağıdakı keçiddən oxuya bilərsiniz.' },
    ],
    en: {
      slug: 'kazakhstan-the-tech-writes-about-anacan',
      title: 'Kazakhstan\'s The Tech writes about Anacan',
      lead: 'Kazakhstan\'s The Tech has published an article about Anacan, a startup from Baku. The piece describes how the app brings more than 30 artificial intelligence tools for mothers together in one place.',
      tag: 'Media',
      sourceLabel: 'Read the article on The Tech',
      body: [
        { type: 'p', text: 'Kazakhstan\'s technology publication The Tech has published an in-depth article about Anacan. It describes how the startup from Baku has brought more than 30 artificial intelligence tools for mothers together in a single app. This attention means a great deal to us: Anacan is now known and followed beyond Azerbaijan as well.' },
        { type: 'h2', text: 'What does the article say?' },
        { type: 'p', text: 'The article presents Anacan\'s origin story, its team and the results it achieved in its first months. The app was launched on 1 March 2026. Anacan was founded by Türkan Sultanlı (CEO, product and strategy) and Camil Sultanlı (CTO and CMO). Anacan is a companion app for pregnancy, motherhood and the menstrual cycle that runs on iOS and Android.' },
        { type: 'p', text: 'As a reminder, the app includes sections such as week-by-week pregnancy, the baby tracker, the cycle calendar, the Anacan AI assistant, the community, the partner account and a PDF report for the doctor. Anacan is available in 23 languages, and its backend services and database run in the Google Cloud europe-west1 (Belgium) region.' },
        { type: 'h2', text: 'The first seven months in numbers' },
        { type: 'p', text: 'These are the results mentioned in the article:' },
        { type: 'list', items: [
          'more than 35,000 downloads in 7 months;',
          'about 30,000 monthly active users;',
          'users from more than 54 countries, including thousands of mothers from Kazakhstan and Uzbekistan;',
          'a 4.84 rating on the App Store based on more than 500 ratings;',
          'paying subscribers in 7 countries;',
          'a community with more than 10,000 monthly active users;',
          'more than 30 artificial intelligence tools.',
        ] },
        { type: 'p', text: 'Behind these numbers are mothers who open the app every day, ask questions, keep notes and support one another. Their trust is our greatest motivation.' },
        { type: 'p', text: 'We are especially pleased by the large number of users from Kazakhstan and Uzbekistan. The app is also available in Kazakh and Uzbek, which gives mothers in these countries the opportunity to receive information in their native languages.' },
        { type: 'h2', text: 'Ecosystem and support' },
        { type: 'p', text: 'The article also notes that Anacan is a participant in the Microsoft for Startups and Google for Startups programs. NVIDIA, AWS and Google Cloud act as infrastructure partners, and the credits they provide have a total value of USD 705,000. Anacan holds an official startup certificate in Azerbaijan.' },
        { type: 'p', text: 'We thank İDDA for its support of the ecosystem, as well as the Azerbaijan Startup Community. Support like this allows a young team to take bolder steps.' },
        { type: 'h2', text: 'The next stage' },
        { type: 'p', text: 'Anacan is currently preparing for a seed investment round. Our goal is to bring the app to more families in more countries, improve our artificial intelligence tools and grow while keeping privacy a priority.' },
        { type: 'quote', text: 'Every new country and every new user is a responsibility for us: a mother should receive support in her own language and at her own pace.' },
        { type: 'p', text: 'We thank the team at The Tech for the attention they have given Anacan. The full text of the article is in Russian, and you can read it at the link below.' },
      ],
    },
  },
  {
    slug: 'anacan-anthropic-for-startups-proqramina-qebul-olundu',
    date: '2026-09-01',
    title: 'Anacan Anthropic for Startups proqramına qəbul olundu',
    lead: 'Anacan süni intellekt şirkəti Anthropic-in startaplar üçün proqramına qəbul olundu. Bu, Anacan AI köməkçisini daha təhlükəsiz, daha dəqiq və daha faydalı etmək üçün yeni imkanlar açır.',
    tag: 'Dəstək',
    partner: 'anthropic',
    readMinutes: 3,
    body: [
      { type: 'p', text: 'Anacan komandasından yeni xəbər: tətbiqimiz Anthropic for Startups proqramına qəbul olundu. Anthropic Claude süni intellekt modellərini hazırlayan və təhlükəsiz süni intellekt sahəsində tanınan şirkətdir. Proqram süni intellekt əsasında məhsul quran startaplara dəstək olur.' },
      { type: 'h2', text: 'Bu, Anacan üçün niyə önəmlidir?' },
      { type: 'p', text: 'Anacan AI köməkçisi hamiləlik, körpə baxımı və dövr sağlamlığı ilə bağlı gündəlik suallarda analara yol göstərir. Bu mövzular həssasdır, ona görə də cavabların təkcə sürətli deyil, həm də diqqətli, aydın və təhlükəsiz olması bizim üçün əsasdır. Təhlükəsizliyə xüsusi önəm verən bir şirkətin proqramında iştirak bu yanaşmamızla üst-üstə düşür.' },
      { type: 'list', items: [
        'Anacan AI köməkçisinin cavab keyfiyyətini müxtəlif modellərlə sınamaq və müqayisə etmək;',
        'həssas mövzularda daha ehtiyatlı və mehriban cavablar üzərində işləmək;',
        'cavabların tətbiqin dəstəklədiyi dillərdə daha təbii səslənməsi;',
        'süni intellekt funksiyalarının xərclərini səmərəli idarə etmək.',
      ] },
      { type: 'p', text: 'Bir məqamı yenə vurğulayırıq: Anacan AI həkim məsləhətini əvəz etmir. Narahatedici əlamətlər olduqda həmişə həkimə müraciət etməyi tövsiyə edirik.' },
      { type: 'quote', text: 'Süni intellekt ananın yanında olmalıdır: sakit, diqqətli və hər zaman təhlükəsiz.' },
      { type: 'p', text: 'Anacan artıq Microsoft for Startups və Google for Startups proqramlarının iştirakçısıdır. Anthropic for Startups bu siyahını süni intellekt tərəfdən tamamlayır. Gördüyümüz işlərin nəticələrini bu bölmədə paylaşacağıq.' },
    ],
    en: {
      slug: 'anacan-accepted-into-anthropic-for-startups',
      title: 'Anacan accepted into Anthropic for Startups',
      lead: 'Anacan has been accepted into the startup program of the artificial intelligence company Anthropic. This opens new opportunities to make the Anacan AI assistant safer, more accurate and more helpful.',
      tag: 'Support',
      body: [
        { type: 'p', text: 'News from the Anacan team: our app has been accepted into the Anthropic for Startups program. Anthropic is the company that develops the Claude artificial intelligence models and is known for its work on safe artificial intelligence. The program supports startups that build products based on artificial intelligence.' },
        { type: 'h2', text: 'Why does this matter for Anacan?' },
        { type: 'p', text: 'The Anacan AI assistant guides mothers through everyday questions about pregnancy, baby care and cycle health. These topics are sensitive, so for us it is essential that answers are not only fast but also careful, clear and safe. Taking part in the program of a company that places special emphasis on safety is in line with our approach.' },
        { type: 'list', items: [
          'testing and comparing the answer quality of the Anacan AI assistant with different models;',
          'working on more careful and kinder answers on sensitive topics;',
          'making answers sound more natural in the languages the app supports;',
          'managing the costs of artificial intelligence features efficiently.',
        ] },
        { type: 'p', text: 'We want to emphasize one point again: Anacan AI does not replace medical advice. If there are any worrying symptoms, we always recommend seeing a doctor.' },
        { type: 'quote', text: 'Artificial intelligence should be at a mother\'s side: calm, attentive and always safe.' },
        { type: 'p', text: 'Anacan is already a participant in the Microsoft for Startups and Google for Startups programs. Anthropic for Startups completes this list on the artificial intelligence side. We will share the results of our work in this section.' },
      ],
    },
  },
  {
    slug: 'anacan-google-for-startups-cloud-proqramina-qebul-olundu',
    date: '2026-07-05',
    title: 'Anacan Google for Startups Cloud proqramına qəbul olundu',
    lead: 'Anacan Google for Startups Cloud proqramına qəbul olundu. Bu addım tətbiqin sürətini, sabitliyini və süni intellekt funksiyalarını gücləndirmək üçün bizə yeni imkanlar açır.',
    tag: 'Dəstək',
    partner: 'google',
    readMinutes: 4,
    body: [
      { type: 'p', text: 'Anacan komandası üçün sevindirici xəbərimiz var: tətbiqimiz Google for Startups Cloud proqramına qəbul olundu. Anacan hamiləlik, analıq və menstrual dövr üçün yaradılmış, iOS və Android cihazlarında işləyən yoldaş tətbiqdir. Onu Azərbaycanda, Anacan MMC komandası hazırlayır. Bu proqram bizim kimi gənc texnologiya şirkətlərinə daha etibarlı və daha sürətli məhsul qurmaqda kömək edir, biz də bu imkandan ilk növbədə istifadəçilərimizin xeyrinə yararlanmaq istəyirik.' },
      { type: 'h2', text: 'Google for Startups Cloud proqramı nədir?' },
      { type: 'p', text: 'Google for Startups Cloud proqramı Google-un erkən və inkişaf mərhələsindəki startaplar üçün hazırladığı dəstək proqramıdır. Onun hamıya məlum olan əsas imkanları bunlardır:' },
      { type: 'list', items: [
        'Google Cloud xidmətlərində istifadə üçün bulud kreditləri;',
        'Google Cloud mütəxəssislərindən texniki məsləhət və arxitektura üzrə yönləndirmə;',
        'təlim materiallarına və öyrənmə resurslarına çıxış;',
        'tərəfdaş təkliflərinə və startap icmasına qoşulmaq imkanı.',
      ] },
      { type: 'p', text: 'Bu xəbər Anacan üçün yayın ən yaxşı günlərindən biridir: cəmi iki gün əvvəl, 3 iyulda Microsoft for Startups proqramına da qəbul olunmuşduq.' },
      { type: 'p', text: 'Kiçik komanda üçün bu dəstək xüsusilə dəyərlidir. İnfrastruktur xərcləri azaldıqca resursları daha çox məhsulun özünə, yəni istifadəçinin hər gün gördüyü və istifadə etdiyi funksiyalara yönəltmək mümkün olur.' },
      { type: 'h2', text: 'Bu, Anacan üçün niyə vacibdir?' },
      { type: 'p', text: 'Proqram bizə backend xidmətlərini, verilənlər bazasını və rəsmi saytı Google Cloud-a, Avropa İttifaqında yerləşən europe-west1 (Belçika) regionuna köçürmək imkanı verir. Bizim üçün dörd istiqamət xüsusilə önəmlidir:' },
      { type: 'list', items: [
        'Etibarlılıq: hamiləlik həftələri, körpə qeydləri və dövr təqvimi istədiyiniz anda əlçatan olmalıdır. Güclü bulud infrastrukturu kəsintisiz işin əsasıdır.',
        'Məlumatların AB regionunda saxlanması: xidmətlərimizi Belçikadakı Google Cloud regionunda yerləşdirməyi planlaşdırırıq. Bu, məxfiliyə verdiyimiz önəmin bir hissəsidir.',
        'Daha sürətli süni intellekt funksiyaları: Anacan AI köməkçisi gündəlik suallara cavab verir. Əlavə bulud resursları onu daha sürətli və daha faydalı etmək üzərində işləməyə imkan yaradır.',
        'Yeni ölkələrə genişlənmə: tətbiq artıq bir çox dildə mövcuddur. Daha çox ölkədə ailələrə xidmət etmək üçün infrastrukturun rahat böyüyə bilməsi vacibdir.',
      ] },
      { type: 'p', text: 'Anacan bir neçə xidmətin birləşməsidir: həftə-həftə hamiləlik, körpə izləyicisi, dövr təqvimi, icma, partnyor hesabı və həkim üçün PDF hesabatı. Bütün bu bölmələrin bir-biri ilə ahəngdar işləməsi üçün etibarlı backend və düzgün qurulmuş verilənlər bazası lazımdır. Proqram çərçivəsindəki texniki məsləhətlər bu sistemi daha sadə, daha qənaətcil və daha dayanıqlı etməyə kömək edəcək.' },
      { type: 'h2', text: 'İstifadəçilər nə qazanır?' },
      { type: 'p', text: 'Bu xəbər bir qədər texniki səslənə bilər, amma onun nəticəsini gündəlik təcrübənizdə hiss edəcəksiniz. Məqsədimiz tətbiqin daha tez açılması, məlumatların daha sürətlə sinxronlaşması və ən yoğun saatlarda belə sabit işləməsidir. Gecə saat üçdə körpənin qidalanmasını qeyd edən ana üçün hər saniyə önəmlidir.' },
      { type: 'p', text: 'Məxfilik də bizim üçün əsas prinsipdir. Sağlamlıq və ailə məlumatları həssasdır, ona görə də infrastrukturu qurarkən təhlükəsizliyi və məlumatların AB regionunda emal olunmasını ön planda tuturuq. Yeni imkanlar bu yanaşmanı dəyişmir, əksinə, onu daha da möhkəmləndirir.' },
      { type: 'quote', text: 'Güclü infrastruktur görünməz olmalıdır: istifadəçi onu yalnız tətbiqin hər dəfə sakit, sürətli və etibarlı işləməsindən hiss etməlidir.' },
      { type: 'h2', text: 'Növbəti addımlar' },
      { type: 'p', text: 'Qarşıdakı aylarda proqramın imkanlarından istifadə edərək bir neçə istiqamətdə işləyəcəyik: tətbiqin performansını ölçmək və yaxşılaşdırmaq, ehtiyat nüsxə və bərpa proseslərini gücləndirmək, Anacan AI köməkçisinin cavab sürətini artırmaq və yeni dillərdə xidmətə hazırlaşmaq. Görülən işlərin nəticələrini bu bölmədə və sosial şəbəkələrimizdə paylaşacağıq.' },
      { type: 'p', text: 'Anacan-ı hələ yükləməmisinizsə, tətbiqi App Store və Google Play-dən yükləyə bilərsiniz. Bizə inanan və dəstək olan hər kəsə təşəkkür edirik.' },
      { type: 'h2', text: 'Yeniləmə, noyabr 2026' },
      { type: 'p', text: 'Oktyabr ayında Anacan-ın backend xidmətləri, verilənlər bazası və rəsmi saytı Google Cloud-un europe-west1 (Belçika) regionuna köçürüldü. Bu gün Anacan Google for Startups, Microsoft for Startups və Anthropic for Startups proqramlarının iştirakçısıdır. NVIDIA, AWS və Google Cloud Anacan-ın infrastruktur tərəfdaşlarıdır, onların təqdim etdiyi kreditlərin ümumi dəyəri 705 000 ABŞ dollarıdır.' },
    ],
    en: {
      slug: 'anacan-accepted-into-google-for-startups-cloud-program',
      title: 'Anacan accepted into Google for Startups Cloud Program',
      lead: 'Anacan has been accepted into the Google for Startups Cloud Program. This step opens new opportunities for us to strengthen the app\'s speed, stability and artificial intelligence features.',
      tag: 'Support',
      body: [
        { type: 'p', text: 'We have exciting news from the Anacan team: our app has been accepted into the Google for Startups Cloud Program. Anacan is a companion app for pregnancy, motherhood and the menstrual cycle that runs on iOS and Android devices. It is developed in Azerbaijan by the Anacan LLC team. The program helps young technology companies like ours build more reliable and faster products, and we want to use this opportunity first and foremost for the benefit of our users.' },
        { type: 'h2', text: 'What is the Google for Startups Cloud Program?' },
        { type: 'p', text: 'The Google for Startups Cloud Program is Google\'s support program for early-stage and growth-stage startups. Its main, publicly known benefits are:' },
        { type: 'list', items: [
          'cloud credits for use on Google Cloud services;',
          'technical advice and architecture guidance from Google Cloud experts;',
          'access to training materials and learning resources;',
          'the opportunity to access partner offers and join the startup community.',
        ] },
        { type: 'p', text: 'This news makes it one of the best days of the summer for Anacan: just two days earlier, on 3 July, we had also been accepted into the Microsoft for Startups program.' },
        { type: 'p', text: 'For a small team, this support is especially valuable. As infrastructure costs go down, more resources can be directed to the product itself, meaning the features users see and use every day.' },
        { type: 'h2', text: 'Why does this matter for Anacan?' },
        { type: 'p', text: 'The program gives us the opportunity to move our backend services, database and official website to Google Cloud, in the europe-west1 (Belgium) region located in the European Union. Four areas are especially important to us:' },
        { type: 'list', items: [
          'Reliability: pregnancy weeks, baby records and the cycle calendar should be available whenever you need them. Strong cloud infrastructure is the foundation of uninterrupted service.',
          'Storing data in the EU region: we plan to host our services in the Google Cloud region in Belgium. This is part of the importance we place on privacy.',
          'Faster artificial intelligence features: the Anacan AI assistant answers everyday questions. Additional cloud resources allow us to work on making it faster and more helpful.',
          'Expansion to new countries: the app is already available in many languages. To serve families in more countries, it is important that the infrastructure can grow easily.',
        ] },
        { type: 'p', text: 'Anacan combines several services: week-by-week pregnancy, the baby tracker, the cycle calendar, the community, the partner account and a PDF report for the doctor. For all these sections to work together smoothly, a reliable backend and a well-structured database are needed. The technical advice within the program will help make this system simpler, more cost-efficient and more resilient.' },
        { type: 'h2', text: 'What do users gain?' },
        { type: 'p', text: 'This news may sound somewhat technical, but you will feel its results in your everyday experience. Our goal is for the app to open faster, for data to sync more quickly and for the app to run stably even at the busiest hours. For a mother logging her baby\'s feeding at three in the morning, every second counts.' },
        { type: 'p', text: 'Privacy is also a core principle for us. Health and family data are sensitive, so when building our infrastructure we prioritize security and the processing of data in the EU region. The new opportunities do not change this approach; on the contrary, they strengthen it further.' },
        { type: 'quote', text: 'Strong infrastructure should be invisible: users should only notice it in the app working calmly, quickly and reliably every time.' },
        { type: 'h2', text: 'Next steps' },
        { type: 'p', text: 'In the coming months, we will use the program\'s opportunities to work in several directions: measuring and improving the app\'s performance, strengthening backup and recovery processes, increasing the response speed of the Anacan AI assistant and preparing to serve new languages. We will share the results of this work in this section and on our social media.' },
        { type: 'p', text: 'If you have not downloaded Anacan yet, you can get the app from the App Store and Google Play. Thank you to everyone who believes in us and supports us.' },
        { type: 'h2', text: 'Update, November 2026' },
        { type: 'p', text: 'In October, Anacan\'s backend services, database and official website were moved to the Google Cloud europe-west1 (Belgium) region. Today Anacan is a participant in the Google for Startups, Microsoft for Startups and Anthropic for Startups programs. NVIDIA, AWS and Google Cloud are Anacan\'s infrastructure partners, and the credits they provide have a total value of USD 705,000.' },
      ],
    },
  },
  {
    slug: 'anacan-microsoft-for-startups-proqramindan-destek-aldi',
    date: '2026-07-03',
    title: 'Anacan Microsoft for Startups proqramından dəstək aldı',
    lead: 'Anacan Microsoft for Startups proqramına qəbul olundu və 100 000 dollarlıq Azure krediti əldə etdi. Proqramın mentorluq, süni intellekt alətləri və bulud imkanları yeni funksiyaları daha tez hazırlamağa kömək edəcək.',
    tag: 'Dəstək',
    partner: 'microsoft',
    readMinutes: 4,
    body: [
      { type: 'p', text: 'Xoş xəbər paylaşırıq: Anacan Microsoft for Startups proqramına qəbul olundu və 100 000 ABŞ dolları həcmində Microsoft Azure krediti əldə etdi. Founders Hub adı ilə də tanınan bu proqram dünyanın müxtəlif ölkələrindən olan startaplara bulud infrastrukturu, süni intellekt alətləri və təcrübəli mütəxəssislərin məsləhətləri ilə kömək edir. Azərbaycanda yaradılmış bir ailə tətbiqi kimi bu dəstəyi həm böyük fürsət, həm də məsuliyyət hesab edirik.' },
      { type: 'h2', text: 'Microsoft for Startups nə təklif edir?' },
      { type: 'p', text: 'Proqram startaplara məhsul qurmaq və onu böyütmək üçün lazım olan alətləri bir yerdə təqdim edir. Onun ümumi tanınan imkanları bunlardır:' },
      { type: 'list', items: [
        'Microsoft Azure xidmətlərində istifadə üçün bulud kreditləri;',
        'Azure üzərindəki süni intellekt xidmətlərinə çıxış;',
        'texniki və biznes mövzularında mentorluq və mütəxəssis məsləhətləri;',
        'proqram çərçivəsində təqdim olunan tərəfdaş alətləri və təkliflər.',
      ] },
      { type: 'p', text: 'Bu imkanlar kiçik komandalar üçün xüsusilə vacibdir. Yeni ideyanı sınamaq, onu real ehtiyaclarla yoxlamaq və uğurlu olanı genişləndirmək daha az vaxt və xərc tələb edir.' },
      { type: 'p', text: 'Startap üçün mentorluq bəzən kreditlər qədər dəyərli olur. Təcrübəli mütəxəssislərlə söhbət komandaya səhvləri erkən görməyə, arxitektura qərarlarını yoxlamağa və prioritetləri düzgün seçməyə kömək edir. Biz bu məsləhətlərdən xüsusilə süni intellekt funksiyalarının keyfiyyətinə və təhlükəsizliyinə nəzarət, eləcə də xərclərin səmərəli idarə olunması istiqamətində yararlanmaq istəyirik.' },
      { type: 'h2', text: 'Süni intellekt funksiyalarına təsiri' },
      { type: 'p', text: 'Anacan AI köməkçisi hamiləlik, körpə baxımı və dövr sağlamlığı ilə bağlı gündəlik suallarda yanınızda olmaq üçün yaradılıb. Azure üzərindəki süni intellekt xidmətlərinə çıxış bizə müxtəlif yanaşmaları sınamağa, cavabların keyfiyyətini və sürətini müqayisə etməyə və ən uyğun həlli seçməyə imkan verir. Məqsəd sadədir: cavablar aydın, mehriban və tətbiqin dəstəklədiyi dillərdə rahat oxunan olsun.' },
      { type: 'p', text: 'Bir məqamı xüsusi vurğulayırıq: Anacan AI həkim məsləhətini əvəz etmir. Narahatedici əlamətlər olduqda həmişə həkimə müraciət etməyi tövsiyə edirik. Tətbiqdəki həkim üçün PDF hesabatı da məhz bu görüşlərə hazırlaşmağı asanlaşdırmaq üçün hazırlanıb.' },
      { type: 'h2', text: 'Dayanıqlılıq və yeni bazarlar' },
      { type: 'p', text: 'Azure-un bulud imkanları bizə xidmətlərimizin dayanıqlılığını artırmaq, ehtiyat həllərini araşdırmaq və bəzi xidmətləri yeni bulud platformasında sınaqdan keçirmək imkanı verir. Bir platformada problem yaranarsa belə, xidmətin işləməyə davam etməsi üçün düşünülmüş arxitektura istifadəçi üçün rahatlıq və güvən deməkdir.' },
      { type: 'p', text: 'Tətbiq artıq bir çox dildə mövcuddur. Yeni bazarlara çıxarkən hər ölkənin öz ehtiyaclarını, dilini və gözləntilərini nəzərə almaq lazımdır. Mentorluq və mütəxəssis məsləhətləri bu addımları daha düşünülmüş və daha əmin şəkildə atmağa kömək edəcək.' },
      { type: 'h2', text: 'Bu sizə nə verir?' },
      { type: 'p', text: 'Bütün bu işlərin məqsədi bir sualın cavabıdır: Anacan ananın gündəlik həyatını necə daha da asanlaşdıra bilər? Qarşıdakı dövrdə bunları gözləyə bilərsiniz:' },
      { type: 'list', items: [
        'Anacan AI köməkçisindən daha sürətli və daha keyfiyyətli cavablar;',
        'tətbiqin daha dayanıqlı və fasiləsiz işləməsi;',
        'yeni dillər və yeni ölkələr üçün daha tez hazırlanan funksiyalar;',
        'məxfiliyə və təhlükəsizliyə əvvəlki kimi ciddi diqqət.',
      ] },
      { type: 'quote', text: 'Texnologiya ailəyə xidmət etməlidir: hər yeni imkanı ilk növbədə ananın vaxtına, rahatlığına və sakitliyinə nə qatdığı ilə ölçürük.' },
      { type: 'p', text: 'Microsoft for Startups proqramına bu imkan üçün təşəkkür edirik. Gördüyümüz işlərin nəticələrini bu bölmədə mütəmadi paylaşacağıq, çünki bu yolu istifadəçilərimizlə birlikdə keçmək istəyirik. Sualınız və ya təklifiniz varsa, bizə info@anacan.az ünvanına yaza bilərsiniz.' },
      { type: 'h2', text: 'Yeniləmə, noyabr 2026' },
      { type: 'p', text: 'Microsoft for Startups-dan iki gün sonra, 5 iyulda Anacan Google for Startups Cloud proqramına, 1 sentyabrda isə Anthropic for Startups proqramına qəbul olundu. NVIDIA, AWS və Google Cloud Anacan-ın infrastruktur tərəfdaşlarıdır, onların təqdim etdiyi kreditlərin ümumi dəyəri 705 000 ABŞ dollarıdır.' },
    ],
    en: {
      slug: 'anacan-receives-support-from-microsoft-for-startups',
      title: 'Anacan receives support from Microsoft for Startups',
      lead: 'Anacan has been accepted into Microsoft for Startups and has received USD 100,000 in Azure credits. The program\'s mentorship, artificial intelligence tools and cloud capabilities will help us build new features faster.',
      tag: 'Support',
      body: [
        { type: 'p', text: 'We are pleased to share good news: Anacan has been accepted into the Microsoft for Startups program and has received USD 100,000 in Microsoft Azure credits. Also known as Founders Hub, the program supports startups from countries around the world with cloud infrastructure, artificial intelligence tools and advice from experienced experts. As a family app created in Azerbaijan, we see this support as both a great opportunity and a responsibility.' },
        { type: 'h2', text: 'What does Microsoft for Startups offer?' },
        { type: 'p', text: 'The program brings together in one place the tools startups need to build and grow a product. Its generally known benefits are:' },
        { type: 'list', items: [
          'cloud credits for use on Microsoft Azure services;',
          'access to artificial intelligence services on Azure;',
          'mentorship and expert advice on technical and business topics;',
          'partner tools and offers provided within the program.',
        ] },
        { type: 'p', text: 'These opportunities are especially important for small teams. Testing a new idea, validating it against real needs and scaling what works takes less time and money.' },
        { type: 'p', text: 'For a startup, mentorship is sometimes as valuable as credits. Conversations with experienced experts help a team spot mistakes early, review architecture decisions and set the right priorities. We especially want to use this advice to oversee the quality and safety of our artificial intelligence features and to manage costs efficiently.' },
        { type: 'h2', text: 'Impact on artificial intelligence features' },
        { type: 'p', text: 'The Anacan AI assistant was created to be by your side with everyday questions about pregnancy, baby care and cycle health. Access to artificial intelligence services on Azure allows us to test different approaches, compare the quality and speed of answers and choose the most suitable solution. The goal is simple: answers should be clear, kind and easy to read in the languages the app supports.' },
        { type: 'p', text: 'We want to stress one point in particular: Anacan AI does not replace medical advice. If there are any worrying symptoms, we always recommend seeing a doctor. The PDF report for the doctor in the app was designed precisely to make it easier to prepare for these appointments.' },
        { type: 'h2', text: 'Resilience and new markets' },
        { type: 'p', text: 'Azure\'s cloud capabilities give us the opportunity to increase the resilience of our services, explore backup solutions and test some services on a new cloud platform. An architecture designed to keep the service running even if a problem occurs on one platform means comfort and trust for users.' },
        { type: 'p', text: 'The app is already available in many languages. When entering new markets, it is necessary to take into account each country\'s own needs, language and expectations. Mentorship and expert advice will help us take these steps in a more considered and confident way.' },
        { type: 'h2', text: 'What does this mean for you?' },
        { type: 'p', text: 'All of this work aims to answer one question: how can Anacan make a mother\'s everyday life even easier? In the coming period, you can expect:' },
        { type: 'list', items: [
          'faster and higher-quality answers from the Anacan AI assistant;',
          'a more resilient app that runs without interruption;',
          'features for new languages and new countries prepared more quickly;',
          'the same serious attention to privacy and security as before.',
        ] },
        { type: 'quote', text: 'Technology should serve the family: we measure every new capability first by what it adds to a mother\'s time, comfort and peace of mind.' },
        { type: 'p', text: 'We thank the Microsoft for Startups program for this opportunity. We will regularly share the results of our work in this section, because we want to walk this path together with our users. If you have any questions or suggestions, you can write to us at info@anacan.az.' },
        { type: 'h2', text: 'Update, November 2026' },
        { type: 'p', text: 'Two days after Microsoft for Startups, on 5 July, Anacan was accepted into the Google for Startups Cloud Program, and on 1 September into the Anthropic for Startups program. NVIDIA, AWS and Google Cloud are Anacan\'s infrastructure partners, and the credits they provide have a total value of USD 705,000.' },
      ],
    },
  },
];

/** Items that exist in a language, newest first. */
export const newsIn = (language: NewsLanguage): LocalNews[] => NEWS.flatMap((item) => localNews(item, language) ?? []);
/** Find an item by its slug in that language (Azerbaijani by default). */
export const findNews = (slug: string | undefined, language: NewsLanguage = 'az') => newsIn(language).find((item) => item.slug === slug);
/** The same item in another language, if translated. */
export const newsTranslation = (item: LocalNews, language: NewsLanguage) => {
  const source = NEWS.find((entry) => entry.slug === item.id);
  return source ? localNews(source, language) : undefined;
};
