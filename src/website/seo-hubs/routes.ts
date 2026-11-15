/**
 * Routes and metadata of the Azerbaijani SEO content pages (owner request 2026-11-15), called from tools/tool-routes.ts:
 *   /az/usaqda-qizdirma/                       fever checker
 *   /az/elave-qida/  /az/elave-qida/<6..12>-ay/ solid food table and month pages
 *   /az/hamilelikde-olar-olmaz/[<slug>/]        pregnancy "can I" hub and 20 answers
 *   /az/ana-sudu-saxlama/                       breast milk storage table
 *   /az/aybasi/                                 period hub
 * Owner approved 2026-11-15: published (indexable, in sitemaps, linked from the calculators and detail pages).
 * Set SEO_HUBS_PUBLISHED=false to hide them again (noindex,nofollow, out of sitemaps and links).
 */
import type { WebsiteLanguageCode } from '../../lib/app-languages';
import type { ToolMeta } from '../tools/tool-routes';
import { seoHubContent } from './registry';

export const SEO_HUBS_PUBLISHED = true;
let published: boolean = SEO_HUBS_PUBLISHED;
export const seoHubsPublished = () => published;
/** Tests only. */
export function overrideSeoHubsPublished(value?: boolean) { published = value ?? SEO_HUBS_PUBLISHED; }
export const SEO_HUBS_UPDATED = '2026-11-15';

export const SEO_HUB_PAGES = ['feverGuide', 'solidFoods', 'solidFoodMonth', 'pregnancySafe', 'pregnancySafeItem', 'milkStorage', 'periodHub'] as const;
export type SeoHubPage = typeof SEO_HUB_PAGES[number];
export const isSeoHubPage = (kind: string): kind is SeoHubPage => (SEO_HUB_PAGES as readonly string[]).includes(kind);

export const SEO_HUB_SLUGS = { feverGuide: 'usaqda-qizdirma', solidFoods: 'elave-qida', pregnancySafe: 'hamilelikde-olar-olmaz', milkStorage: 'ana-sudu-saxlama', periodHub: 'aybasi' } as const;
export const SOLID_MONTH_NUMBERS = [6, 7, 8, 9, 10, 11, 12] as const;
/** Same order and slugs as SAFE_ITEMS in content-az.ts (seo-hubs.test.ts keeps them equal). */
export const SAFE_SLUGS = ['kofe', 'cay', 'hamam-sauna', 'sac-boyasi', 'teyyare', 'baliq', 'susi', 'yumurta', 'pendir', 'qaraciyer', 'alkoqol', 'siqaret',
  'idman', 'uzmek', 'cinsi-elaqe', 'parasetamol', 'ibuprofen', 'arxasi-ustu-yatmaq', 'pisik', 'dis-hekimi'] as const;
const HUB_LABELS = { feverGuide: 'Uşaqda qızdırma', solidFoods: 'Əlavə qida cədvəli', pregnancySafe: 'Hamiləlikdə olar və olmaz', milkStorage: 'Ana südünün saxlanması', periodHub: 'Aybaşı' };

const monthSlug = (month: number) => `${month}-ay`;
export function seoHubSitePath(kind: SeoHubPage, slug?: string): string {
  if (kind === 'solidFoodMonth') return `/az/${SEO_HUB_SLUGS.solidFoods}/${monthSlug(Number(slug))}/`;
  if (kind === 'pregnancySafeItem') return `/az/${SEO_HUB_SLUGS.pregnancySafe}/${slug}/`;
  return `/az/${SEO_HUB_SLUGS[kind]}/`;
}
export function resolveSeoHubRoute(language: WebsiteLanguageCode, rest: string[]): { kind: SeoHubPage | 'notFound'; slug?: string } | undefined {
  if (language !== 'az') return undefined;
  const entry = (Object.entries(SEO_HUB_SLUGS) as Array<[keyof typeof SEO_HUB_SLUGS, string]>).find(([, value]) => value === rest[0]);
  if (!entry) return undefined;
  const [kind] = entry;
  if (rest.length === 1) return { kind };
  if (rest.length > 2) return { kind: 'notFound' };
  if (kind === 'solidFoods') {
    const month = SOLID_MONTH_NUMBERS.find(value => monthSlug(value) === rest[1]);
    return month ? { kind: 'solidFoodMonth', slug: String(month) } : { kind: 'notFound' };
  }
  if (kind === 'pregnancySafe') return (SAFE_SLUGS as readonly string[]).includes(rest[1]) ? { kind: 'pregnancySafeItem', slug: rest[1] } : { kind: 'notFound' };
  return { kind: 'notFound' };
}
export const SEO_HUBS_ROBOTS = 'noindex,nofollow';
export const seoHubRobots = (kind: string) => isSeoHubPage(kind) && !seoHubsPublished() ? SEO_HUBS_ROBOTS : undefined;

export function seoHubMeta(route: { language: WebsiteLanguageCode; kind: string; slug?: string }, labels: { home: string }): ToolMeta | undefined {
  if (!isSeoHubPage(route.kind) || route.language !== 'az') return undefined;
  const c = seoHubContent();
  const robots = seoHubRobots(route.kind), extra = robots ? { robots } : {};
  const home = { name: labels.home, path: '/az/' };
  const hubKind = route.kind === 'solidFoodMonth' ? 'solidFoods' : route.kind === 'pregnancySafeItem' ? 'pregnancySafe' : route.kind;
  const hubCrumb = { name: HUB_LABELS[hubKind], path: seoHubSitePath(hubKind) };
  if (!c) return { title: HUB_LABELS[hubKind], description: '', pageType: 'WebPage', breadcrumb: [home, hubCrumb], faq: [], ...extra };
  switch (route.kind) {
    case 'feverGuide': return { title: c.FEVER.title, description: c.FEVER.description, pageType: 'MedicalWebPage', breadcrumb: [home, hubCrumb], faq: c.FEVER.faq, ...extra };
    case 'milkStorage': return { title: c.MILK.title, description: c.MILK.description, pageType: 'MedicalWebPage', breadcrumb: [home, hubCrumb], faq: c.MILK.faq, ...extra };
    case 'periodHub': return { title: c.PERIOD.title, description: c.PERIOD.description, pageType: 'MedicalWebPage', breadcrumb: [home, hubCrumb], faq: c.PERIOD.faq, ...extra };
    case 'solidFoods': return { title: c.SOLID_HUB.title, description: c.SOLID_HUB.description, pageType: 'MedicalWebPage', breadcrumb: [home, hubCrumb], faq: [],
      items: c.SOLID_MONTHS.map(item => ({ name: item.title, path: seoHubSitePath('solidFoodMonth', String(item.month)) })), ...extra };
    case 'pregnancySafe': return { title: c.SAFE_HUB.title, description: c.SAFE_HUB.description, pageType: 'CollectionPage', breadcrumb: [home, hubCrumb],
      faq: c.SAFE_ITEMS.map(item => ({ question: item.question, answer: item.answer })), items: c.SAFE_ITEMS.map(item => ({ name: item.question, path: seoHubSitePath('pregnancySafeItem', item.slug) })), ...extra };
    case 'solidFoodMonth': {
      const month = c.solidMonth(Number(route.slug))!;
      return { title: month.title, description: month.description, pageType: 'MedicalWebPage',
        breadcrumb: [home, hubCrumb, { name: `${month.month} ay`, path: seoHubSitePath('solidFoodMonth', String(month.month)) }], faq: month.faq, ...extra };
    }
    case 'pregnancySafeItem': {
      const item = c.safeItem(route.slug)!;
      return { title: item.title, description: item.description, pageType: 'MedicalWebPage',
        breadcrumb: [home, hubCrumb, { name: item.label, path: seoHubSitePath('pregnancySafeItem', item.slug) }], faq: [{ question: item.question, answer: item.answer }], ...extra };
    }
  }
}
/** Sitemap rows once published. */
export function seoHubSitemapRows(): Array<{ path: string; updated: string }> {
  if (!seoHubsPublished()) return [];
  const paths = [seoHubSitePath('feverGuide'), seoHubSitePath('solidFoods'), ...SOLID_MONTH_NUMBERS.map(month => seoHubSitePath('solidFoodMonth', String(month))),
    seoHubSitePath('pregnancySafe'), ...SAFE_SLUGS.map(slug => seoHubSitePath('pregnancySafeItem', slug)), seoHubSitePath('milkStorage'), seoHubSitePath('periodHub')];
  return paths.map(path => ({ path, updated: SEO_HUBS_UPDATED }));
}
