import { APP_LANGUAGE_CODES, normalizeAppLanguage, type AppLanguageCode } from './app-languages';

export const BLOG_MODULES = ['feeding', 'sleep', 'diaper', 'babyGrowth', 'hospitalBag', 'calendar'] as const;
export type BlogModule = typeof BLOG_MODULES[number];
export interface BlogFaq { question: string; answer: string }
export interface BlogReference { title: string; url: string }
export interface BlogEditorialLocale {
  seoTitle: string;
  seoDescription: string;
  coverAlt: string;
  tags: string[];
  faq: BlogFaq[];
  references?: BlogReference[];
}
export interface BlogEditorialMetadata {
  schema: 'anacan-blog-editorial-v1';
  sourceDocument?: string;
  sourceSha256?: string;
  lifeStages: Array<'flow' | 'bump' | 'mommy'>;
  modules: BlogModule[];
  relatedSlugs: string[];
  locales: Partial<Record<AppLanguageCode, BlogEditorialLocale>>;
  publishedAt?: string;
  website?: { schema:'anacan-website-article-v1'; origin:string; legacySlug:string; slugs:Partial<Record<AppLanguageCode,string>> };
}
export function blogEditorial(value: unknown): BlogEditorialMetadata | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const metadata = value as BlogEditorialMetadata;
  if (metadata.schema !== 'anacan-blog-editorial-v1' || !metadata.locales || typeof metadata.locales !== 'object'
    || !Array.isArray(metadata.lifeStages) || !Array.isArray(metadata.modules) || !Array.isArray(metadata.relatedSlugs)) return null;
  return metadata;
}
export function blogLocale(value: unknown, language: string): BlogEditorialLocale | null {
  const locale = blogEditorial(value)?.locales[normalizeAppLanguage(language)];
  return locale && typeof locale.seoTitle === 'string' && typeof locale.seoDescription === 'string'
    && typeof locale.coverAlt === 'string' && Array.isArray(locale.tags) && Array.isArray(locale.faq) ? locale : null;
}
export function blogMatchesStage(post: { life_stage?: string; editorial_metadata?: unknown }, stage: string): boolean {
  const stages = blogEditorial(post.editorial_metadata)?.lifeStages;
  return stages?.length ? stages.some(value => value === stage) : post.life_stage === stage || post.life_stage === 'all';
}
export function blogPath(slug?: string, language = 'az'): string {
  const code = normalizeAppLanguage(language);
  return `/blog${code === 'az' ? '' : `/${code}`}${slug ? `/${encodeURIComponent(slug)}` : ''}/`;
}
export const BLOG_CANONICAL_ORIGIN = 'https://app.anacan.az';
export function blogCoverUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value, BLOG_CANONICAL_ORIGIN);
    // Public editorial artwork ships identically on each web backend. Native
    // packages keep the real remote URL, including older already-delivered apps.
    if (typeof window !== 'undefined' && ((window.location.protocol === 'https:'
      && (['app.anacan.az','api.anacan.az','gcp.anacan.az'].includes(window.location.hostname) || window.location.hostname.endsWith('.lovable.app')))
      || window.location.protocol === 'http:' && ['localhost','127.0.0.1'].includes(window.location.hostname))
      && ['app.anacan.az','api.anacan.az','gcp.anacan.az'].includes(url.hostname)
      && /^\/blog-covers\/[a-z0-9-]+\.webp$/.test(url.pathname)
      && import.meta.env.VITE_NATIVE_BUILD !== 'true') return url.pathname;
  } catch { /* Existing image hosts keep their original presentation. */ }
  return value;
}
export function blogAvailableLanguages(post: Record<string, unknown>): AppLanguageCode[] {
  return APP_LANGUAGE_CODES.filter(language => {
    const title = language === 'az' ? post.title_az || post.title : post[`title_${language}`];
    const content = language === 'az' ? post.content_az || post.content : post[`content_${language}`];
    return typeof title === 'string' && !!title.trim() && typeof content === 'string' && !!content.trim();
  });
}
