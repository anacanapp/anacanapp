/**
 * Routing, metadata and sitemap rows of the pregnancy week pages, called from tools/tool-routes.ts
 * (which routes.ts and seo.ts already use for tool pages). Azerbaijani and Russian (locale.ts); other languages 404.
 * route.slug is the az week slug (e.g. 12-ci-hefte) in both languages, so hreflang pairs map one to one.
 */
import type { WebsiteLanguageCode } from '../../lib/app-languages';
import type { ToolMeta } from '../tools/tool-routes';
import { pregnancyWeekContent } from './registry';
import {
  PREGNANCY_WEEK_NUMBERS, PREGNANCY_WEEKS_ROBOTS, PREGNANCY_WEEKS_UPDATED, isPregnancyWeek, pregnancyWeekFromSlug, pregnancyWeekSlug,
  pregnancyWeeksPublished, pregnancyWeeksEnabled,
} from './weeks';
import { PREGNANCY_WEEK_LANGUAGES, isPregnancyWeekLanguage, weekLocale } from './locale';

export const PREGNANCY_WEEK_PAGES = ['pregnancyWeeks', 'pregnancyWeek'] as const;
export type PregnancyWeekPage = typeof PREGNANCY_WEEK_PAGES[number];
export const isPregnancyWeekPage = (kind: string): kind is PregnancyWeekPage => (PREGNANCY_WEEK_PAGES as readonly string[]).includes(kind);

export function localizedWeekHubPath(language: string) { const l = weekLocale(language); return `/${isPregnancyWeekLanguage(language) ? language : 'az'}/${l.parent}/${l.hubSlug}/`; }
export function localizedWeekPath(week: number, language: string) { const l = weekLocale(language); return `/${isPregnancyWeekLanguage(language) ? language : 'az'}/${l.parent}/${l.weekSlug(week)}/`; }

export function pregnancyWeekSitePath(kind: PregnancyWeekPage, slug?: string, language = 'az'): string {
  if (kind === 'pregnancyWeeks') return localizedWeekHubPath(language);
  const week = pregnancyWeekFromSlug(slug);
  if (!week) throw new Error('WEBSITE_PREGNANCY_WEEK_SLUG_REQUIRED');
  return localizedWeekPath(week, language);
}
/** `rest` = decoded segments after the language. undefined: not one of these URLs (e.g. /az/hamilelik/ itself). */
export function resolvePregnancyWeekRoute(language: WebsiteLanguageCode, rest: string[]): { kind: PregnancyWeekPage | 'notFound'; slug?: string } | undefined {
  if (!isPregnancyWeekLanguage(language)) return undefined;
  const l = weekLocale(language);
  if (rest[0] !== l.parent || rest.length < 2) return undefined;
  if (rest.length > 2 || !pregnancyWeeksEnabled()) return { kind: 'notFound' };
  if (rest[1] === l.hubSlug) return { kind: 'pregnancyWeeks' };
  const week = PREGNANCY_WEEK_NUMBERS.find(value => l.weekSlug(value) === rest[1]);
  return week && isPregnancyWeek(week) ? { kind: 'pregnancyWeek', slug: pregnancyWeekSlug(week) } : { kind: 'notFound' };
}
/** robots value while unpublished (meta tag and X-Robots-Tag); undefined once published. */
export const pregnancyWeekRobots = (kind: string) => isPregnancyWeekPage(kind) && !pregnancyWeeksPublished() ? PREGNANCY_WEEKS_ROBOTS : undefined;
export const pregnancyWeekAlternateLanguages = (): WebsiteLanguageCode[] => [...PREGNANCY_WEEK_LANGUAGES];

export function pregnancyWeekMeta(route: { language: WebsiteLanguageCode; kind: string; slug?: string }, labels: { home: string }): ToolMeta | undefined {
  if (!isPregnancyWeekPage(route.kind) || !isPregnancyWeekLanguage(route.language)) return undefined;
  const lang = route.language, l = weekLocale(lang);
  const crumbs = [{ name: labels.home, path: `/${lang}/` }, { name: l.parentLabel, path: `/${lang}/${l.parent}/` }, { name: l.hub.label, path: localizedWeekHubPath(lang) }];
  const robots = pregnancyWeekRobots(route.kind);
  if (route.kind === 'pregnancyWeeks') return { title: l.hub.title, description: l.hub.description, pageType: 'CollectionPage', breadcrumb: crumbs, faq: [],
    items: PREGNANCY_WEEK_NUMBERS.map(week => ({ name: l.label(week), path: localizedWeekPath(week, lang) })), ...(robots ? { robots } : {}) };
  const week = pregnancyWeekFromSlug(route.slug)!, content = pregnancyWeekContent(week, lang);
  // FAQPage carries only the two questions the teaser page shows.
  return { title: l.title(week), description: content?.description || l.hub.description, pageType: 'MedicalWebPage',
    breadcrumb: [...crumbs, { name: l.label(week), path: localizedWeekPath(week, lang) }], faq: content?.faq.slice(0, 2) || [], ...(robots ? { robots } : {}) };
}
/** Hub + 42 weeks per language for the sitemaps; empty while unpublished. */
export function pregnancyWeekSitemapRows(): Array<{ path: string; updated: string; language: WebsiteLanguageCode; kind: PregnancyWeekPage; slug?: string }> {
  if (!pregnancyWeeksPublished()) return [];
  return PREGNANCY_WEEK_LANGUAGES.flatMap(language => [
    { path: localizedWeekHubPath(language), updated: PREGNANCY_WEEKS_UPDATED, language, kind: 'pregnancyWeeks' as const },
    ...PREGNANCY_WEEK_NUMBERS.map(week => ({ path: localizedWeekPath(week, language), updated: PREGNANCY_WEEKS_UPDATED, language, kind: 'pregnancyWeek' as const, slug: pregnancyWeekSlug(week) })),
  ]);
}
