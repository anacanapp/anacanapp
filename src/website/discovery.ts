import type { WebsiteLanguageCode } from '../lib/app-languages';
import { routePath, WEBSITE_ORIGIN, type WebsiteRoute } from './routes';

/** Machine-readable twins of the public HTML pages. Paths are part of the
 * published LLM/discovery contract served by `scripts/website/server.mjs`. */
export interface DiscoveryLink { rel: 'alternate' | 'describedby'; type: string; href: string }

export function markdownPath(route: WebsiteRoute): string { return routePath(route) + 'index.md'; }
export function llmIndexPath(language: WebsiteLanguageCode): string { return `/${language}/llms.txt`; }
export function llmFullPath(language: WebsiteLanguageCode): string { return `/${language}/llms-full.txt`; }
export function localeSitemapPath(language: WebsiteLanguageCode): string { return `/sitemap-${language}.xml`; }

export function discoveryLinks(route: WebsiteRoute): DiscoveryLink[] {
  if (route.kind === 'notFound') return [];
  return [
    { rel:'alternate', type:'text/markdown', href:WEBSITE_ORIGIN + markdownPath(route) },
    { rel:'describedby', type:'text/plain', href:WEBSITE_ORIGIN + llmIndexPath(route.language) },
    { rel:'describedby', type:'application/json', href:WEBSITE_ORIGIN + '/llms-manifest.json' },
  ];
}
export function discoveryLinkHeader(route: WebsiteRoute): string {
  return discoveryLinks(route).map(link => `<${link.href}>; rel="${link.rel}"; type="${link.type}"`).join(', ');
}
