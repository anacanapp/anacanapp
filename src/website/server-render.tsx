import './tools/tool-data-server';
// Calculator page texts for all 21 languages are bundled into the renderer (no runtime copy files).
import './calc-content/all';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import Website from './Website';
import { websiteMeta,websiteSchema } from './seo';
import { resolveWebsiteRoute,routePath,PAGE_SLUGS,sitePath,localizedSlug,WEBSITE_ORIGIN } from './routes';
import { WEBSITE_LANGUAGES } from '../lib/app-languages';
import type {WebsiteBoot} from './model';
import { prepareBlogContent } from '../lib/blog-content.mjs';
export {resolveWebsiteRoute,routePath,PAGE_SLUGS,sitePath,localizedSlug,WEBSITE_ORIGIN};
/** `scripts/website/server.mjs` iterates `APP_LANGUAGES` for copy, catalogs, sitemaps and
 * IndexNow. The public website keeps its 21-locale contract, so the runtime receives the
 * website language list (app-only ky/et are excluded) under that published export name. */
export {WEBSITE_LANGUAGES as APP_LANGUAGES};
export {prepareBlogContent};
/** Azerbaijani-only news (/az/xeberler/…): listed in the pages and az sitemaps with az-only hreflang. */
export {NEWS} from './news';
/** Azerbaijani-only shop pages (/az/kitablar/, /az/tortlar/): listed in the pages and az sitemaps. */
export {SHOP_PAGES} from './routes';
export {renderArticleContent} from './article-content';
/** Tool pages (baby names az/ka, AZ dekret calculator) for the pages and locale sitemaps; each entry
 * carries its own hreflang alternates (names details and letters are single-language). */
export {toolSitemapEntries,toolRobots} from './tools/tool-routes';
export {LLM_COPY,LLM_FORMAT_VERSION,LLM_PAGE_KINDS,llmLanguageName,renderLlmDocument,renderLlmFullHeader,renderLlmHub,renderLlmIndex,renderLlmJournal,renderLlmManifest} from './llm-content';
export {discoveryLinkHeader,discoveryLinks,llmFullPath,llmIndexPath,localeSitemapPath,markdownPath} from './discovery';
export function renderWebsite(boot:WebsiteBoot) {
  return {body:renderToString(createElement(Website,{boot})),meta:websiteMeta(boot),schema:websiteSchema(boot)};
}
