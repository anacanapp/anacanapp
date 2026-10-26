import { APP_LANGUAGE_CODES, isAppLanguage, type AppLanguageCode } from '../lib/app-languages.ts';
import detailRoutes from './detail-routes.json' with {type:'json'};

export const WEBSITE_ORIGIN = 'https://anacan.az';
export const WEBSITE_PREVIEW_PREFIX = '/site';
export const APP_STORE_URL = 'https://apps.apple.com/us/app/anacan/id6758301924';
export const GOOGLE_PLAY_URL = 'https://play.google.com/store/apps/details?id=com.atlasoon.anacan';
export const DETAIL_PAGES=['cycle','pregnancy','motherhood','partner','memories','ai','community','health'] as const;
export type DetailPage=typeof DETAIL_PAGES[number];
export type WebsitePage = 'home' | 'journal' | 'tools' | 'ovulation' | 'dueDate' | 'symptoms' | 'features' | 'faq' | 'contact' | 'download' | 'privacy' | 'terms' | 'simulator' | 'article' | 'notFound' | DetailPage;
export type StaticPage = Exclude<WebsitePage, 'home' | 'article' | 'notFound'>;
type CoreStaticPage=Exclude<StaticPage,DetailPage>;

/** Public URLs are a published contract, independent of translated UI copy. */
const CORE_PAGE_SLUGS: Record<AppLanguageCode, Record<CoreStaticPage, string>> = {
  az: { journal:'jurnal',tools:'kalkulyatorlar',ovulation:'ovulyasiya-kalkulyatoru',dueDate:'dogus-tarixi-kalkulyatoru',symptoms:'hamilelik-elametleri',features:'anacan-tetbiqi',faq:'tez-tez-verilen-suallar',contact:'elaqe',download:'yukle',privacy:'mexfilik-siyaseti',terms:'istifade-sertleri',simulator:'ata-simulyatoru' },
  en: { journal:'journal',tools:'calculators',ovulation:'ovulation-calculator',dueDate:'due-date-calculator',symptoms:'pregnancy-symptoms',features:'anacan-app',faq:'frequently-asked-questions',contact:'contact',download:'download',privacy:'privacy-policy',terms:'terms-of-use',simulator:'partner-readiness-quiz' },
  tr: { journal:'gunluk',tools:'hesaplayicilar',ovulation:'yumurtlama-hesaplayici',dueDate:'dogum-tarihi-hesaplayici',symptoms:'hamilelik-belirtileri',features:'anacan-uygulamasi',faq:'sik-sorulan-sorular',contact:'iletisim',download:'indir',privacy:'gizlilik-politikasi',terms:'kullanim-kosullari',simulator:'babaliga-hazirlik-testi' },
  ru: { journal:'журнал',tools:'калькуляторы',ovulation:'калькулятор-овуляции',dueDate:'калькулятор-даты-родов',symptoms:'симптомы-беременности',features:'приложение-anacan',faq:'частые-вопросы',contact:'контакты',download:'скачать',privacy:'политика-конфиденциальности',terms:'условия-использования',simulator:'тест-готовности-партнёра' },
  de: { journal:'magazin',tools:'rechner',ovulation:'eisprungrechner',dueDate:'geburtsterminrechner',symptoms:'schwangerschaftsanzeichen',features:'anacan-anwendung',faq:'haeufige-fragen',contact:'kontakt',download:'herunterladen',privacy:'datenschutzerklaerung',terms:'nutzungsbedingungen',simulator:'partner-vorbereitungstest' },
  ar: { journal:'المجلة',tools:'الحاسبات',ovulation:'حاسبة-التبويض',dueDate:'حاسبة-موعد-الولادة',symptoms:'أعراض-الحمل',features:'تطبيق-anacan',faq:'الأسئلة-الشائعة',contact:'تواصل-معنا',download:'تحميل',privacy:'سياسة-الخصوصية',terms:'شروط-الاستخدام',simulator:'اختبار-استعداد-الشريك' },
  ka: { journal:'ჟურნალი',tools:'კალკულატორები',ovulation:'ოვულაციის-კალკულატორი',dueDate:'მშობიარობის-თარიღის-კალკულატორი',symptoms:'ორსულობის-სიმპტომები',features:'anacan-აპლიკაცია',faq:'ხშირად-დასმული-კითხვები',contact:'კონტაქტი',download:'ჩამოტვირთვა',privacy:'კონფიდენციალურობის-პოლიტიკა',terms:'გამოყენების-პირობები',simulator:'პარტნიორის-მზადყოფნის-ტესტი' },
  kk: { journal:'журнал',tools:'калькуляторлар',ovulation:'овуляция-калькуляторы',dueDate:'босану-күнінің-калькуляторы',symptoms:'жүктілік-белгілері',features:'anacan-қосымшасы',faq:'жиі-қойылатын-сұрақтар',contact:'байланыс',download:'жүктеу',privacy:'құпиялық-саясаты',terms:'пайдалану-шарттары',simulator:'серіктестің-дайындығын-тексеру' },
  uz: { journal:'jurnal',tools:'kalkulyatorlar',ovulation:'ovulyatsiya-kalkulyatori',dueDate:'tugruq-sanasi-kalkulyatori',symptoms:'homiladorlik-belgilari',features:'anacan-ilovasi',faq:'kop-soraladigan-savollar',contact:'aloqa',download:'yuklab-olish',privacy:'maxfiylik-siyosati',terms:'foydalanish-shartlari',simulator:'sherik-tayyorgarligi-testi' },
  zh: { journal:'健康杂志',tools:'计算工具',ovulation:'排卵期计算器',dueDate:'预产期计算器',symptoms:'怀孕症状',features:'anacan应用',faq:'常见问题',contact:'联系我们',download:'下载应用',privacy:'隐私政策',terms:'使用条款',simulator:'伴侣准备测试' },
  id: { journal:'jurnal',tools:'kalkulator',ovulation:'kalkulator-ovulasi',dueDate:'kalkulator-tanggal-persalinan',symptoms:'gejala-kehamilan',features:'aplikasi-anacan',faq:'pertanyaan-umum',contact:'hubungi-kami',download:'unduh',privacy:'kebijakan-privasi',terms:'syarat-penggunaan',simulator:'kuis-kesiapan-pasangan' },
  fr: { journal:'journal',tools:'calculateurs',ovulation:'calculateur-ovulation',dueDate:'calculateur-date-accouchement',symptoms:'symptomes-grossesse',features:'application-anacan',faq:'questions-frequentes',contact:'nous-contacter',download:'telecharger',privacy:'politique-confidentialite',terms:'conditions-utilisation',simulator:'quiz-preparation-partenaire' },
  es: { journal:'revista',tools:'calculadoras',ovulation:'calculadora-ovulacion',dueDate:'calculadora-fecha-parto',symptoms:'sintomas-embarazo',features:'aplicacion-anacan',faq:'preguntas-frecuentes',contact:'contacto',download:'descargar',privacy:'politica-privacidad',terms:'condiciones-uso',simulator:'test-preparacion-pareja' },
  pt: { journal:'revista',tools:'calculadoras',ovulation:'calculadora-ovulacao',dueDate:'calculadora-data-parto',symptoms:'sintomas-gravidez',features:'aplicacao-anacan',faq:'perguntas-frequentes',contact:'contactos',download:'descarregar',privacy:'politica-privacidade',terms:'termos-utilizacao',simulator:'teste-preparacao-parceiro' },
  vi: { journal:'tap-chi',tools:'cong-cu-tinh',ovulation:'tinh-ngay-rung-trung',dueDate:'tinh-ngay-du-sinh',symptoms:'dau-hieu-mang-thai',features:'ung-dung-anacan',faq:'cau-hoi-thuong-gap',contact:'lien-he',download:'tai-ung-dung',privacy:'chinh-sach-bao-mat',terms:'dieu-khoan-su-dung',simulator:'kiem-tra-san-sang-lam-cha' },
  hi: { journal:'पत्रिका',tools:'कैलकुलेटर',ovulation:'ओव्यूलेशन-कैलकुलेटर',dueDate:'प्रसव-तिथि-कैलकुलेटर',symptoms:'गर्भावस्था-के-लक्षण',features:'anacan-ऐप',faq:'अक्सर-पूछे-जाने-वाले-सवाल',contact:'संपर्क',download:'डाउनलोड',privacy:'गोपनीयता-नीति',terms:'उपयोग-की-शर्तें',simulator:'साथी-की-तैयारी-क्विज़' },
  ja: { journal:'ジャーナル',tools:'計算ツール',ovulation:'排卵日計算',dueDate:'出産予定日計算',symptoms:'妊娠の兆候',features:'anacanアプリ',faq:'よくある質問',contact:'お問い合わせ',download:'ダウンロード',privacy:'プライバシーポリシー',terms:'利用規約',simulator:'パートナー準備クイズ' },
  ko: { journal:'저널',tools:'계산기',ovulation:'배란일-계산기',dueDate:'출산예정일-계산기',symptoms:'임신-증상',features:'anacan-앱',faq:'자주-묻는-질문',contact:'문의하기',download:'다운로드',privacy:'개인정보-처리방침',terms:'이용약관',simulator:'파트너-준비-퀴즈' },
  pl: { journal:'poradnik',tools:'kalkulatory',ovulation:'kalkulator-owulacji',dueDate:'kalkulator-terminu-porodu',symptoms:'objawy-ciazy',features:'aplikacja-anacan',faq:'czesto-zadawane-pytania',contact:'kontakt',download:'pobierz',privacy:'polityka-prywatnosci',terms:'warunki-korzystania',simulator:'test-gotowosci-partnera' },
  nl: { journal:'magazine',tools:'rekentools',ovulation:'ovulatiecalculator',dueDate:'uitgerekende-datum-berekenen',symptoms:'zwangerschapssymptomen',features:'anacan-applicatie',faq:'veelgestelde-vragen',contact:'contact',download:'downloaden',privacy:'privacybeleid',terms:'gebruiksvoorwaarden',simulator:'partner-voorbereidingsquiz' },
  sv: { journal:'magasin',tools:'kalkylatorer',ovulation:'agglossningskalkylator',dueDate:'berakna-forlossningsdatum',symptoms:'graviditetssymtom',features:'anacan-appen',faq:'vanliga-fragor',contact:'kontakt',download:'ladda-ner',privacy:'integritetspolicy',terms:'anvandarvillkor',simulator:'partnerforberedelse-test' },
};
export const PAGE_SLUGS=Object.fromEntries(APP_LANGUAGE_CODES.map(code=>[code,{...CORE_PAGE_SLUGS[code],...detailRoutes[code]}])) as Record<AppLanguageCode,Record<StaticPage,string>>;

export interface ArticleRoute { id: string; legacySlug: string; slugs: Partial<Record<AppLanguageCode, string>> }
export interface WebsiteRoute { language: AppLanguageCode; kind: WebsitePage; articleId?: string; slug?: string; page?: number }
export function sitePath(language: AppLanguageCode, kind: WebsitePage = 'home', slug?: string, page = 1): string {
  if (kind === 'home') return `/${language}/`;
  if (kind === 'article') {
    if (!validWebsiteSlug(slug)) throw new Error('WEBSITE_ARTICLE_SLUG_REQUIRED');
    return `/${language}/${encodeURIComponent(slug)}/`;
  }
  if (kind === 'notFound') return `/${language}/404/`;
  const segment = encodeURIComponent(PAGE_SLUGS[language][kind]);
  return `/${language}/${segment}/${kind === 'journal' && page > 1 ? page + '/' : ''}`;
}
export function validWebsiteSlug(value: unknown): value is string {
  return typeof value === 'string' && !!value.length && value.length <= 220 && value !== '.' && value !== '..'
    && !/[\s/\\\u0000-\u001f<>?#]/u.test(value);
}
export function localizedSlug(title: string): string {
  const normalized=title.normalize('NFKD').toLowerCase().replace(/(\p{Script=Latin})\p{M}+/gu, '$1')
    .replace(/[ə]/g, 'e').replace(/[ı]/g, 'i').replace(/[ß]/g, 'ss').replace(/[’'`]/g, '')
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').normalize('NFC');
  const encoder=new TextEncoder();let slug='',bytes=0;
  for(const character of normalized){const size=encoder.encode(character).length;if(bytes+size>180)break;slug+=character;bytes+=size;}
  if(slug.length<normalized.length&&slug.lastIndexOf('-')>slug.length*.65)slug=slug.slice(0,slug.lastIndexOf('-'));
  return slug.replace(/-+$/g,'');
}
export function routePath(route: WebsiteRoute) { return sitePath(route.language, route.kind, route.slug, route.page); }
export function alternateRoute(route: WebsiteRoute, language: AppLanguageCode, article?: ArticleRoute): string | undefined {
  if (route.kind === 'article') return article?.slugs[language] ? sitePath(language, 'article', article.slugs[language]) : undefined;
  return sitePath(language, route.kind, undefined, route.page);
}
export function previewPrefix(pathname: string): string { return /^\/site(?:\/|$)/.test(pathname) ? WEBSITE_PREVIEW_PREFIX : ''; }
export function resolveWebsiteRoute(pathname: string, articles: readonly ArticleRoute[] = []): { route: WebsiteRoute; redirect?: string } {
  const prefix = previewPrefix(pathname);
  const raw = pathname.slice(prefix.length) || '/';
  let segments: string[];
  try { segments = raw.split('/').filter(Boolean).map(value => decodeURIComponent(value)); }
  catch { return { route: { language:'az', kind:'notFound' } }; }
  if (!segments.length) return { route:{ language:'az', kind:'home' }, redirect:sitePath('az') };
  const oldPage: Record<string, StaticPage> = { blog:'journal',contact:'contact',faq:'faq',privacy:'privacy',terms:'terms',app:'download',
    'ovulyasiya-kalkulyatoru':'ovulation','hamilelik-elamtleri':'symptoms','hamilelik-elametleri':'symptoms','ata-simulyatoru':'simulator',
    'due-date-calculator':'dueDate','ovulation-calculator':'ovulation','pregnancy-symptoms':'symptoms' };
  let language: AppLanguageCode = isAppLanguage(segments[0]) ? segments[0] : 'az';
  const hasLanguage = isAppLanguage(segments[0]);
  const rest = hasLanguage ? segments.slice(1) : segments;
  // Both historical layouts are durable aliases: /blog/en/slug and /en/blog/slug.
  if (rest[0] === 'blog') {
    const offset = isAppLanguage(rest[1]) ? 2 : 1;
    if (offset === 2) language = rest[1] as AppLanguageCode;
    if (rest.length === offset) return { route:{language,kind:'journal'}, redirect:sitePath(language,'journal') };
    if (rest.length !== offset + 1) return { route:{language,kind:'notFound'} };
    const article = articles.find(item => item.legacySlug === rest[offset] || Object.values(item.slugs).includes(rest[offset]));
    if (article?.slugs[language]) return { route:{language,kind:'article',slug:article.slugs[language],articleId:article.id}, redirect:sitePath(language,'article',article.slugs[language]) };
    return { route:{language,kind:'notFound'} };
  }
  if (!hasLanguage) {
    if (rest.length === 1 && oldPage[rest[0]]) return { route:{language,kind:oldPage[rest[0]]}, redirect:sitePath(language,oldPage[rest[0]]) };
    return { route:{language,kind:'notFound'} };
  }
  if (!rest.length) return { route:{language,kind:'home'}, ...(!raw.endsWith('/') ? {redirect:sitePath(language)} : {}) };
  const kind = (Object.entries(PAGE_SLUGS[language]) as Array<[StaticPage,string]>).find(([, slug]) => slug === rest[0])?.[0];
  if (kind && (rest.length === 1 || kind === 'journal' && rest.length === 2 && /^[1-9]\d*$/.test(rest[1]))) {
    const page = kind === 'journal' && rest[1] ? Number(rest[1]) : 1;
    const route: WebsiteRoute = {language,kind,page};
    const canonical = routePath(route);
    return {route,...(raw !== canonical && raw !== decodeURIComponent(canonical) ? {redirect:canonical} : {})};
  }
  if (rest.length === 1) {
    const article = articles.find(item => item.slugs[language] === rest[0]);
    if (article) {
      const route: WebsiteRoute = {language,kind:'article',articleId:article.id,slug:rest[0]};
      const canonical = routePath(route);
      return {route,...(!raw.endsWith('/') ? {redirect:canonical} : {})};
    }
    const oldKind = oldPage[rest[0]];
    if (oldKind) return {route:{language,kind:oldKind},redirect:sitePath(language,oldKind)};
  }
  return {route:{language,kind:'notFound'}};
}
export const WEBSITE_LANGUAGE_CODES = APP_LANGUAGE_CODES;
