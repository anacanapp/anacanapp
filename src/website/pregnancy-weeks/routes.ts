/**
 * Routing, metadata and sitemap rows of the pregnancy week pages, called from tools/tool-routes.ts
 * (which routes.ts and seo.ts already use for tool pages). Azerbaijani only; other languages 404.
 */
import type { WebsiteLanguageCode } from '../../lib/app-languages';
import type { ToolMeta } from '../tools/tool-routes';
import { pregnancyWeekContent } from './registry';
import {
  PREGNANCY_WEEK_NUMBERS, PREGNANCY_WEEKS_HUB, PREGNANCY_WEEKS_HUB_SLUG, PREGNANCY_WEEKS_PARENT, PREGNANCY_WEEKS_ROBOTS, PREGNANCY_WEEKS_UPDATED,
  pregnancyWeekFromSlug, pregnancyWeekLabel, pregnancyWeekPath, pregnancyWeekSlug, pregnancyWeekTitle, pregnancyWeeksHubPath, pregnancyWeeksPublished, pregnancyWeeksEnabled,
} from './weeks';

export const PREGNANCY_WEEK_PAGES = ['pregnancyWeeks', 'pregnancyWeek'] as const;
export type PregnancyWeekPage = typeof PREGNANCY_WEEK_PAGES[number];
export const isPregnancyWeekPage = (kind: string): kind is PregnancyWeekPage => (PREGNANCY_WEEK_PAGES as readonly string[]).includes(kind);
/** Label of the Azerbaijani pregnancy detail page (breadcrumb parent). */
const PARENT_LABEL = 'Hamiləlik';

export function pregnancyWeekSitePath(kind: PregnancyWeekPage, slug?: string): string {
  if (kind === 'pregnancyWeeks') return pregnancyWeeksHubPath();
  const week = pregnancyWeekFromSlug(slug);
  if (!week) throw new Error('WEBSITE_PREGNANCY_WEEK_SLUG_REQUIRED');
  return pregnancyWeekPath(week);
}
/** `rest` = decoded segments after the language. undefined: not one of these URLs (e.g. /az/hamilelik/ itself). */
export function resolvePregnancyWeekRoute(language: WebsiteLanguageCode, rest: string[]): { kind: PregnancyWeekPage | 'notFound'; slug?: string } | undefined {
  if (language !== 'az' || rest[0] !== PREGNANCY_WEEKS_PARENT || rest.length < 2) return undefined;
  if (rest.length > 2 || !pregnancyWeeksEnabled()) return { kind: 'notFound' };
  if (rest[1] === PREGNANCY_WEEKS_HUB_SLUG) return { kind: 'pregnancyWeeks' };
  const week = pregnancyWeekFromSlug(rest[1]);
  return week ? { kind: 'pregnancyWeek', slug: pregnancyWeekSlug(week) } : { kind: 'notFound' };
}
/** robots value while unpublished (meta tag and X-Robots-Tag); undefined once published. */
export const pregnancyWeekRobots = (kind: string) => isPregnancyWeekPage(kind) && !pregnancyWeeksPublished() ? PREGNANCY_WEEKS_ROBOTS : undefined;

export function pregnancyWeekMeta(route: { language: WebsiteLanguageCode; kind: string; slug?: string }, labels: { home: string }): ToolMeta | undefined {
  if (!isPregnancyWeekPage(route.kind) || route.language !== 'az') return undefined;
  const crumbs = [{ name: labels.home, path: '/az/' }, { name: PARENT_LABEL, path: `/az/${PREGNANCY_WEEKS_PARENT}/` }, { name: PREGNANCY_WEEKS_HUB.label, path: pregnancyWeeksHubPath() }];
  const robots = pregnancyWeekRobots(route.kind);
  if (route.kind === 'pregnancyWeeks') return { title: PREGNANCY_WEEKS_HUB.title, description: PREGNANCY_WEEKS_HUB.description, pageType: 'CollectionPage', breadcrumb: crumbs, faq: [],
    items: PREGNANCY_WEEK_NUMBERS.map(week => ({ name: pregnancyWeekLabel(week), path: pregnancyWeekPath(week) })), ...(robots ? { robots } : {}) };
  const week = pregnancyWeekFromSlug(route.slug)!, content = pregnancyWeekContent(week);
  return { title: pregnancyWeekTitle(week), description: content?.description || PREGNANCY_WEEKS_HUB.description, pageType: 'MedicalWebPage',
    breadcrumb: [...crumbs, { name: pregnancyWeekLabel(week), path: pregnancyWeekPath(week) }], faq: content?.faq || [], ...(robots ? { robots } : {}) };
}
/** Hub + 42 weeks for sitemap-pages.xml and sitemap-az.xml; empty while unpublished. */
export function pregnancyWeekSitemapRows(): Array<{ path: string; updated: string }> {
  if (!pregnancyWeeksPublished()) return [];
  return [pregnancyWeeksHubPath(), ...PREGNANCY_WEEK_NUMBERS.map(pregnancyWeekPath)].map(path => ({ path, updated: PREGNANCY_WEEKS_UPDATED }));
}
