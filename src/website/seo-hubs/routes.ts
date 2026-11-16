/**
 * Routes and metadata of the SEO content pages (owner requests 2026-11-15/16), called from tools/tool-routes.ts.
 * Azerbaijani and Russian, same pages under localized slugs (hreflang az↔ru):
 *   fever checker        /az/usaqda-qizdirma/                 /ru/температура-у-ребенка/
 *   solid foods + month  /az/elave-qida/[<n>-ay/]             /ru/прикорм/[<n>-месяцев/]
 *   pregnancy can/can't  /az/hamilelikde-olar-olmaz/[<id>/]   /ru/можно-ли-беременным/[<slug>/]
 *   milk storage         /az/ana-sudu-saxlama/                /ru/хранение-грудного-молока/
 *   periods              /az/aybasi/                          /ru/месячные/
 * route.slug is language independent: the month number, or the az id of the pregnancy question.
 * Owner approved: published. Set SEO_HUBS_PUBLISHED=false to hide them again (noindex,nofollow, out of sitemaps and links).
 */
import type { WebsiteLanguageCode } from '../../lib/app-languages';
import type { ToolMeta } from '../tools/tool-routes';
import { seoHubContent } from './registry';

export const SEO_HUBS_PUBLISHED = true;
let published: boolean = SEO_HUBS_PUBLISHED;
export const seoHubsPublished = () => published;
/** Tests only. */
export function overrideSeoHubsPublished(value?: boolean) { published = value ?? SEO_HUBS_PUBLISHED; }
export const SEO_HUBS_UPDATED = '2026-11-16';

export const SEO_HUB_PAGES = ['feverGuide', 'solidFoods', 'solidFoodMonth', 'pregnancySafe', 'pregnancySafeItem', 'milkStorage', 'periodHub'] as const;
export type SeoHubPage = typeof SEO_HUB_PAGES[number];
export const isSeoHubPage = (kind: string): kind is SeoHubPage => (SEO_HUB_PAGES as readonly string[]).includes(kind);

export const SEO_HUB_LANGUAGES = ['az', 'ru'] as const;
export type SeoHubLanguage = typeof SEO_HUB_LANGUAGES[number];
export const isSeoHubLanguage = (language: string): language is SeoHubLanguage => (SEO_HUB_LANGUAGES as readonly string[]).includes(language);
type HubKind = 'feverGuide' | 'solidFoods' | 'pregnancySafe' | 'milkStorage' | 'periodHub';
export const SEO_HUB_SLUGS: Record<SeoHubLanguage, Record<HubKind, string>> = {
  az: { feverGuide: 'usaqda-qizdirma', solidFoods: 'elave-qida', pregnancySafe: 'hamilelikde-olar-olmaz', milkStorage: 'ana-sudu-saxlama', periodHub: 'aybasi' },
  ru: { feverGuide: 'температура-у-ребенка', solidFoods: 'прикорм', pregnancySafe: 'можно-ли-беременным', milkStorage: 'хранение-грудного-молока', periodHub: 'месячные' },
};
export const SOLID_MONTH_NUMBERS = [6, 7, 8, 9, 10, 11, 12] as const;
const MONTH_SLUG: Record<SeoHubLanguage, (month: number) => string> = { az: month => `${month}-ay`, ru: month => `${month}-месяцев` };
/** Ids (= az URL slugs) in the order of SAFE_ITEMS (seo-hubs.test.ts keeps them equal), and the Russian URL slugs. */
export const SAFE_SLUGS = ['kofe', 'cay', 'hamam-sauna', 'sac-boyasi', 'teyyare', 'baliq', 'susi', 'yumurta', 'pendir', 'qaraciyer', 'alkoqol', 'siqaret',
  'idman', 'uzmek', 'cinsi-elaqe', 'parasetamol', 'ibuprofen', 'arxasi-ustu-yatmaq', 'pisik', 'dis-hekimi'] as const;
const SAFE_RU: Record<typeof SAFE_SLUGS[number], string> = {
  kofe: 'кофе', cay: 'чай', 'hamam-sauna': 'баня-и-сауна', 'sac-boyasi': 'красить-волосы', teyyare: 'летать-на-самолете', baliq: 'рыба', susi: 'суши',
  yumurta: 'яйца', pendir: 'сыр', qaraciyer: 'печень', alkoqol: 'алкоголь', siqaret: 'курение-и-кальян', idman: 'спорт', uzmek: 'плавание',
  'cinsi-elaqe': 'секс', parasetamol: 'парацетамол', ibuprofen: 'ибупрофен', 'arxasi-ustu-yatmaq': 'спать-на-спине', pisik: 'кошка', 'dis-hekimi': 'лечить-зубы',
};
const safeUrlSlug = (language: SeoHubLanguage, id: string) => language === 'ru' ? SAFE_RU[id as typeof SAFE_SLUGS[number]] : id;
const HUB_LABELS: Record<SeoHubLanguage, Record<HubKind, string>> = {
  az: { feverGuide: 'Uşaqda qızdırma', solidFoods: 'Əlavə qida cədvəli', pregnancySafe: 'Hamiləlikdə olar və olmaz', milkStorage: 'Ana südünün saxlanması', periodHub: 'Aybaşı' },
  ru: { feverGuide: 'Температура у ребенка', solidFoods: 'Прикорм по месяцам', pregnancySafe: 'Можно ли беременным', milkStorage: 'Хранение грудного молока', periodHub: 'Месячные' },
};
const hubOf = (kind: SeoHubPage): HubKind => kind === 'solidFoodMonth' ? 'solidFoods' : kind === 'pregnancySafeItem' ? 'pregnancySafe' : kind;

export function seoHubSitePath(kind: SeoHubPage, slug?: string, language: string = 'az'): string {
  const lang: SeoHubLanguage = isSeoHubLanguage(language) ? language : 'az', slugs = SEO_HUB_SLUGS[lang];
  if (kind === 'solidFoodMonth') return `/${lang}/${slugs.solidFoods}/${MONTH_SLUG[lang](Number(slug))}/`;
  if (kind === 'pregnancySafeItem') return `/${lang}/${slugs.pregnancySafe}/${safeUrlSlug(lang, slug || '')}/`;
  return `/${lang}/${slugs[kind]}/`;
}
export function resolveSeoHubRoute(language: WebsiteLanguageCode, rest: string[]): { kind: SeoHubPage | 'notFound'; slug?: string } | undefined {
  if (!isSeoHubLanguage(language)) return undefined;
  const entry = (Object.entries(SEO_HUB_SLUGS[language]) as Array<[HubKind, string]>).find(([, value]) => value === rest[0]);
  if (!entry) return undefined;
  const [kind] = entry;
  if (rest.length === 1) return { kind };
  if (rest.length > 2) return { kind: 'notFound' };
  if (kind === 'solidFoods') {
    const month = SOLID_MONTH_NUMBERS.find(value => MONTH_SLUG[language](value) === rest[1]);
    return month ? { kind: 'solidFoodMonth', slug: String(month) } : { kind: 'notFound' };
  }
  if (kind === 'pregnancySafe') {
    const id = SAFE_SLUGS.find(value => safeUrlSlug(language, value) === rest[1]);
    return id ? { kind: 'pregnancySafeItem', slug: id } : { kind: 'notFound' };
  }
  return { kind: 'notFound' };
}
export const SEO_HUBS_ROBOTS = 'noindex,nofollow';
export const seoHubRobots = (kind: string) => isSeoHubPage(kind) && !seoHubsPublished() ? SEO_HUBS_ROBOTS : undefined;
/** Every page exists in both languages under the same route.slug. */
export const seoHubAlternateLanguages = (): WebsiteLanguageCode[] => [...SEO_HUB_LANGUAGES];

export function seoHubMeta(route: { language: WebsiteLanguageCode; kind: string; slug?: string }, labels: { home: string }): ToolMeta | undefined {
  if (!isSeoHubPage(route.kind) || !isSeoHubLanguage(route.language)) return undefined;
  const lang = route.language, c = seoHubContent(lang);
  const robots = seoHubRobots(route.kind), extra = robots ? { robots } : {};
  const home = { name: labels.home, path: `/${lang}/` }, path = (kind: SeoHubPage, slug?: string) => seoHubSitePath(kind, slug, lang);
  const hubKind = hubOf(route.kind);
  const hubCrumb = { name: HUB_LABELS[lang][hubKind], path: path(hubKind) };
  if (!c) return { title: HUB_LABELS[lang][hubKind], description: '', pageType: 'WebPage', breadcrumb: [home, hubCrumb], faq: [], ...extra };
  switch (route.kind) {
    case 'feverGuide': return { title: c.FEVER.title, description: c.FEVER.description, pageType: 'MedicalWebPage', breadcrumb: [home, hubCrumb], faq: c.FEVER.faq, ...extra };
    case 'milkStorage': return { title: c.MILK.title, description: c.MILK.description, pageType: 'MedicalWebPage', breadcrumb: [home, hubCrumb], faq: c.MILK.faq, ...extra };
    case 'periodHub': return { title: c.PERIOD.title, description: c.PERIOD.description, pageType: 'MedicalWebPage', breadcrumb: [home, hubCrumb], faq: c.PERIOD.faq, ...extra };
    case 'solidFoods': return { title: c.SOLID_HUB.title, description: c.SOLID_HUB.description, pageType: 'MedicalWebPage', breadcrumb: [home, hubCrumb], faq: [],
      items: c.SOLID_MONTHS.map(item => ({ name: item.title, path: path('solidFoodMonth', String(item.month)) })), ...extra };
    case 'pregnancySafe': return { title: c.SAFE_HUB.title, description: c.SAFE_HUB.description, pageType: 'CollectionPage', breadcrumb: [home, hubCrumb],
      faq: c.SAFE_ITEMS.map(item => ({ question: item.question, answer: item.answer })), items: c.SAFE_ITEMS.map(item => ({ name: item.question, path: path('pregnancySafeItem', item.slug) })), ...extra };
    case 'solidFoodMonth': {
      const month = c.solidMonth(Number(route.slug))!;
      return { title: month.title, description: month.description, pageType: 'MedicalWebPage',
        breadcrumb: [home, hubCrumb, { name: c.UI.solid.month(month.month), path: path('solidFoodMonth', String(month.month)) }], faq: month.faq, ...extra };
    }
    case 'pregnancySafeItem': {
      const item = c.safeItem(route.slug)!;
      return { title: item.title, description: item.description, pageType: 'MedicalWebPage',
        breadcrumb: [home, hubCrumb, { name: item.label, path: path('pregnancySafeItem', item.slug) }], faq: [{ question: item.question, answer: item.answer }], ...extra };
    }
  }
}
/** Sitemap rows once published: every page in both languages. */
export function seoHubSitemapRows(): Array<{ path: string; updated: string; kind: SeoHubPage; slug?: string; language: SeoHubLanguage }> {
  if (!seoHubsPublished()) return [];
  const pages: Array<{ kind: SeoHubPage; slug?: string }> = [{ kind: 'feverGuide' }, { kind: 'solidFoods' }, ...SOLID_MONTH_NUMBERS.map(month => ({ kind: 'solidFoodMonth' as const, slug: String(month) })),
    { kind: 'pregnancySafe' }, ...SAFE_SLUGS.map(slug => ({ kind: 'pregnancySafeItem' as const, slug })), { kind: 'milkStorage' }, { kind: 'periodHub' }];
  return SEO_HUB_LANGUAGES.flatMap(language => pages.map(page => ({ ...page, language, path: seoHubSitePath(page.kind, page.slug, language), updated: SEO_HUBS_UPDATED })));
}
