/**
 * The SEO content page texts (content-az.ts, content-ru.ts) are registered at import by the SSR renderer and tests
 * (tools/tool-data-server.ts) and loaded by the browser only on these URLs, one language chunk (tools/tool-data-client.ts).
 */
import type * as Content from './content-az';

export type SeoHubContent = typeof Content;
const content = new Map<string, SeoHubContent>();
export function registerSeoHubContent(language: string, module: SeoHubContent) { content.set(language, module); }
export const seoHubContent = (language: string) => content.get(language);
export const seoHubContentLoaded = (language: string) => content.has(language);
