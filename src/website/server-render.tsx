import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import Website from './Website';
import { websiteMeta,websiteSchema } from './seo';
import { resolveWebsiteRoute,routePath,PAGE_SLUGS,sitePath,localizedSlug,WEBSITE_ORIGIN } from './routes';
import { APP_LANGUAGES } from '../lib/app-languages';
import type {WebsiteBoot} from './model';
import { prepareBlogContent } from '../lib/blog-content.mjs';
export {resolveWebsiteRoute,routePath,PAGE_SLUGS,sitePath,localizedSlug,WEBSITE_ORIGIN,APP_LANGUAGES};
export {prepareBlogContent};
export {renderArticleContent} from './article-content';
export function renderWebsite(boot:WebsiteBoot) {
  return {body:renderToString(createElement(Website,{boot})),meta:websiteMeta(boot),schema:websiteSchema(boot)};
}
