/** JSON-LD nodes of the tool pages, added by seo.ts: BreadcrumbList on every page, ItemList on the
 * names hub/lists/letters (the WebPage node is typed CollectionPage there) and WebApplication on the
 * dekret calculator. FAQPage comes from seo.ts (visible FAQ of the name details and the calculator). */
import type { WebsiteLanguageCode } from '../../lib/app-languages';
import type { ToolMeta } from './tool-routes';

const ORIGIN = 'https://anacan.az';
export function toolSchemaNodes(route: { language: WebsiteLanguageCode; kind: string }, meta: ToolMeta, canonical: string): Record<string, unknown>[] {
  const nodes: Record<string, unknown>[] = [{ '@type': 'BreadcrumbList', '@id': canonical + '#breadcrumb',
    itemListElement: meta.breadcrumb.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, item: ORIGIN + item.path })) }];
  if (meta.items) nodes.push({ '@type': 'ItemList', '@id': canonical + '#names', numberOfItems: meta.items.length,
    itemListElement: meta.items.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, url: ORIGIN + item.path })) });
  if (route.kind === 'maternityBenefit') nodes.push({ '@type': 'WebApplication', '@id': canonical + '#calculator', name: meta.title, description: meta.description,
    url: canonical, applicationCategory: 'FinanceApplication', operatingSystem: 'Any', inLanguage: route.language, isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'AZN' } });
  return nodes;
}
