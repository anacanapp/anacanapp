/**
 * The SEO content page texts (content-az.ts) are registered at import by the SSR renderer and tests
 * (tools/tool-data-server.ts) and loaded by the browser only on these URLs (tools/tool-data-client.ts).
 */
import type * as Content from './content-az';

let content: typeof Content | undefined;
export function registerSeoHubContent(module: typeof Content) { content = module; }
export const seoHubContent = () => content;
export const seoHubContentLoaded = () => !!content;
