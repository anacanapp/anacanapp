/**
 * Routes, metadata, breadcrumbs and sitemap entries of the website tool pages:
 * - names hub/lists/letters/details in NAMES_ENABLED languages (see names.ts for the slug scheme);
 * - the Azerbaijani-only maternity benefit calculator /az/dekret-pulu-kalkulyatoru/.
 * routes.ts and seo.ts call into this module; it does not import them (no cycle).
 */
import type { WebsiteLanguageCode } from '../../lib/app-languages';
import { NAMES_COPY, NAMES_ENABLED, NAMES_UPDATED, genderNames, isNamesLanguage, letterNames, letterPage, type NamesLanguage } from './names';
import { maternityData, namesIndex } from './tool-data';
import { leaveDays } from './dekret';
import { DEKRET_COPY, DEKRET_SLUG, DEKRET_UPDATED, dekretFaq } from './dekret-copy';
import { PREGNANCY_WEEK_PAGES, isPregnancyWeekPage, pregnancyWeekMeta, pregnancyWeekRobots, pregnancyWeekSitePath, pregnancyWeekSitemapRows, resolvePregnancyWeekRoute } from '../pregnancy-weeks/routes';

export const TOOL_PAGES = ['names', 'namesGender', 'namesLetter', 'nameDetail', 'maternityBenefit', ...PREGNANCY_WEEK_PAGES] as const;
export type ToolPage = typeof TOOL_PAGES[number];
export const isToolPage = (kind: string): kind is ToolPage => (TOOL_PAGES as readonly string[]).includes(kind);
interface ToolRoute { language: WebsiteLanguageCode; kind: string; slug?: string }
const encode = (value: string) => encodeURIComponent(value);

export function toolSitePath(language: WebsiteLanguageCode, kind: ToolPage, slug?: string): string {
  if (kind === 'maternityBenefit') return `/az/${DEKRET_SLUG}/`;
  if (isPregnancyWeekPage(kind)) return pregnancyWeekSitePath(kind, slug);
  const copy = isNamesLanguage(language) ? NAMES_COPY[language]! : undefined;
  if (!copy) throw new Error('WEBSITE_NAMES_LANGUAGE_DISABLED');
  const hub = `/${language}/${encode(copy.hubSlug)}/`;
  if (kind === 'names') return hub;
  if (kind === 'namesGender') {
    if (slug !== 'girl' && slug !== 'boy') throw new Error('WEBSITE_NAMES_GENDER_REQUIRED');
    return hub + encode(slug === 'girl' ? copy.girlSlug : copy.boySlug) + '/';
  }
  if (!slug) throw new Error('WEBSITE_NAMES_SLUG_REQUIRED');
  return kind === 'namesLetter' ? `${hub}${encode(copy.letterSlug)}/${encode(slug)}/` : hub + encode(slug) + '/';
}

/** `rest` are the decoded segments after the language. undefined: not a tool URL; notFound: a tool URL
 * that does not exist (unknown name, small letter, disabled language). */
export function resolveToolRoute(language: WebsiteLanguageCode, rest: string[]): { kind: ToolPage | 'notFound'; slug?: string } | undefined {
  if (language === 'az' && rest[0] === DEKRET_SLUG) return rest.length === 1 ? { kind: 'maternityBenefit' } : { kind: 'notFound' };
  const pregnancy = resolvePregnancyWeekRoute(language, rest);
  if (pregnancy) return pregnancy;
  if (!isNamesLanguage(language) || rest[0] !== NAMES_COPY[language]!.hubSlug) return undefined;
  const copy = NAMES_COPY[language]!, index = namesIndex(language);
  if (!index) return { kind: 'notFound' };
  if (rest.length === 1) return { kind: 'names' };
  if (rest.length === 2 && rest[1] === copy.girlSlug) return { kind: 'namesGender', slug: 'girl' };
  if (rest.length === 2 && rest[1] === copy.boySlug) return { kind: 'namesGender', slug: 'boy' };
  if (rest.length === 2 && index.bySlug.has(rest[1])) return { kind: 'nameDetail', slug: rest[1] };
  if (rest.length === 3 && rest[1] === copy.letterSlug && letterPage(index, rest[2])) return { kind: 'namesLetter', slug: rest[2] };
  return { kind: 'notFound' };
}

/** hreflang only where the pages truly correspond: hub↔hub and gender list↔gender list across enabled
 * languages; letters, names and the dekret page are single-language. */
export function toolAlternateLanguages(route: ToolRoute): WebsiteLanguageCode[] {
  if (route.kind === 'names' || route.kind === 'namesGender') return NAMES_ENABLED.filter(code => !!NAMES_COPY[code]) as WebsiteLanguageCode[];
  return [route.language];
}
export function toolAlternatePath(route: ToolRoute, language: WebsiteLanguageCode): string | undefined {
  if (!isToolPage(route.kind) || !toolAlternateLanguages(route).includes(language)) return undefined;
  return toolSitePath(language, route.kind, route.kind === 'namesGender' || language === route.language ? route.slug : undefined);
}
export function toolXDefaultPath(route: ToolRoute): string | undefined {
  const languages = toolAlternateLanguages(route);
  return toolAlternatePath(route, languages.includes('az') ? 'az' : route.language);
}

export interface ToolMeta {
  title: string; description: string; pageType: 'CollectionPage' | 'WebPage' | 'MedicalWebPage';
  breadcrumb: Array<{ name: string; path: string }>;
  faq: Array<{ question: string; answer: string }>;
  items?: Array<{ name: string; path: string }>;
  /** Set only on pages that must not be indexed (pregnancy weeks while unpublished). */
  robots?: string;
}
/** robots override of a tool page (undefined: the site default). */
export const toolRobots = (route: { kind: string }) => pregnancyWeekRobots(route.kind);
/** `labels.home`/`labels.tools` come from the page copy so breadcrumbs match the visible ones. */
export function toolMeta(route: ToolRoute, labels: { home: string; tools: string }): ToolMeta | undefined {
  if (!isToolPage(route.kind)) return undefined;
  if (isPregnancyWeekPage(route.kind)) return pregnancyWeekMeta(route, labels);
  const home = { name: labels.home, path: `/${route.language}/` };
  if (route.kind === 'maternityBenefit') {
    const data = maternityData();
    return { title: DEKRET_COPY.title, description: DEKRET_COPY.description(data ? leaveDays(data.rule, 'normal') : undefined), pageType: 'WebPage',
      breadcrumb: [home, { name: labels.tools, path: '/az/kalkulyatorlar/' }, { name: DEKRET_COPY.label, path: toolSitePath('az', 'maternityBenefit') }],
      faq: data ? dekretFaq(data.rule) : [] };
  }
  const language = route.language as NamesLanguage, copy = NAMES_COPY[language], index = namesIndex(language);
  if (!copy || !index) return undefined;
  const hubPath = toolSitePath(route.language, 'names');
  const crumbs = [home, { name: copy.hubLabel, path: hubPath }];
  const list = (entries: typeof index.names) => entries.map(entry => ({ name: entry.name, path: toolSitePath(route.language, 'nameDetail', entry.slug) }));
  if (route.kind === 'names') return { title: copy.hubTitle, description: copy.hubDescription(index.names.length), pageType: 'CollectionPage', breadcrumb: crumbs, faq: [], items: list(index.names) };
  if (route.kind === 'namesGender') {
    const gender = route.slug as 'girl' | 'boy', entries = genderNames(index, gender);
    return { title: gender === 'girl' ? copy.girlTitle : copy.boyTitle, description: copy.listDescription(gender, entries.length), pageType: 'CollectionPage',
      breadcrumb: [...crumbs, { name: gender === 'girl' ? copy.girlLabel : copy.boyLabel, path: toolSitePath(route.language, 'namesGender', gender) }], faq: [], items: list(entries) };
  }
  if (route.kind === 'namesLetter') {
    const letter = letterPage(index, route.slug)!, entries = letterNames(index, letter);
    return { title: copy.letterTitle(letter.letter), description: copy.letterDescription(letter.letter, entries.length), pageType: 'CollectionPage',
      breadcrumb: [...crumbs, { name: copy.letterH1(letter.letter), path: toolSitePath(route.language, 'namesLetter', letter.slug) }], faq: [], items: list(entries) };
  }
  const entry = index.bySlug.get(route.slug || '')!;
  return { title: copy.detailTitle(entry.name), description: copy.detailDescription(entry), pageType: 'WebPage',
    breadcrumb: [...crumbs, { name: copy.detailH1(entry.name), path: toolSitePath(route.language, 'nameDetail', entry.slug) }], faq: copy.faq(entry) };
}

/** Sitemap rows for `scripts/website/server.mjs` (pages sitemap and the per-locale sitemaps). */
export interface ToolSitemapEntry { language: WebsiteLanguageCode; path: string; updated: string; alternates: Array<{ code: string; path: string }> }
export function toolSitemapEntries(): ToolSitemapEntry[] {
  const entries: ToolSitemapEntry[] = [];
  const add = (route: ToolRoute & { kind: ToolPage }, updated: string) => {
    const path = toolSitePath(route.language, route.kind, route.slug), xDefault = toolXDefaultPath(route);
    entries.push({ language: route.language, path, updated, alternates: [...toolAlternateLanguages(route).map(code => ({ code, path: toolAlternatePath(route, code)! })), ...(xDefault ? [{ code: 'x-default', path: xDefault }] : [])] });
  };
  if (maternityData()) add({ language: 'az', kind: 'maternityBenefit' }, DEKRET_UPDATED);
  // Pregnancy weeks: only once PREGNANCY_WEEKS_PUBLISHED (az-only, no other-language alternates).
  for (const row of pregnancyWeekSitemapRows()) entries.push({ language: 'az', path: row.path, updated: row.updated, alternates: [{ code: 'az', path: row.path }, { code: 'x-default', path: row.path }] });
  for (const language of NAMES_ENABLED) {
    const index = namesIndex(language);
    if (!index || !NAMES_COPY[language]) continue;
    const code = language as WebsiteLanguageCode;
    add({ language: code, kind: 'names' }, NAMES_UPDATED);
    for (const gender of ['girl', 'boy']) add({ language: code, kind: 'namesGender', slug: gender }, NAMES_UPDATED);
    for (const letter of index.letters.filter(item => item.page)) add({ language: code, kind: 'namesLetter', slug: letter.slug }, NAMES_UPDATED);
    for (const entry of index.names) add({ language: code, kind: 'nameDetail', slug: entry.slug }, NAMES_UPDATED);
  }
  return entries;
}
