export const LLM_READ_POLICY = 'public-read-only';
export function websiteRobots(origin = 'https://anacan.az') {
  return `# Anacan public website: search and answer-engine retrieval are allowed.\n# LLM discovery: ${origin}/llms.txt\n# Complete public content: ${origin}/llms-full.txt\nUser-agent: *\nAllow: /\nDisallow: /website/data/\nDisallow: /auth/\nDisallow: /rest/\nDisallow: /functions/\nDisallow: /admin/\nDisallow: /brands/\nSitemap: ${origin}/sitemap.xml\n`;
}
/** Every sitemap the server and the standalone build publish: one per locale (complete: pages, tools,
 * news, articles) plus the cross-language pages/blog sitemaps that older Search Console properties use. */
export const SITEMAP_GROUPS = ['pages', 'blog'];
export function sitemapIndex(languages, origin = 'https://anacan.az') {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${[...languages,...SITEMAP_GROUPS].map(code=>`<sitemap><loc>${origin}/sitemap-${code}.xml</loc></sitemap>`).join('')}</sitemapindex>\n`;
}
const escapeXml = value => String(value).replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
export const SITEMAP_NAMESPACES = 'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"';
/** Image sitemap extension: `images` is [{url,title}] with absolute URLs (article covers). */
export function sitemapImages(images = []) {
  return images.filter(item=>item?.url).map(item=>`<image:image><image:loc>${escapeXml(item.url)}</image:loc>${item.title?`<image:title>${escapeXml(item.title)}</image:title>`:''}</image:image>`).join('');
}
/** Absolute cover URL for an article card (relative self-hosted paths or Google storage URLs). */
export function coverImages(article, origin = 'https://anacan.az') {
  if(!article?.cover)return [];
  try{return [{url:new URL(article.cover,origin).href,title:article.title||article.coverAlt}];}catch{return [];}
}
export function sitemapEntries(entries) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset ${SITEMAP_NAMESPACES}>${entries.map(entry=>`<url><loc>${escapeXml(entry.url)}</loc>${entry.updatedAt?`<lastmod>${escapeXml(entry.updatedAt.slice(0,10))}</lastmod>`:''}${entry.alternates.map(item=>`<xhtml:link rel="alternate" hreflang="${item.code}" href="${escapeXml(item.url)}"/>`).join('')}${sitemapImages(entry.images)}</url>`).join('')}</urlset>\n`;
}
