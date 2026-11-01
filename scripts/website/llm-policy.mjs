export const LLM_READ_POLICY = 'public-read-only';
export function websiteRobots(origin = 'https://anacan.az') {
  return `# Anacan public website: search and answer-engine retrieval are allowed.\n# LLM discovery: ${origin}/llms.txt\n# Complete public content: ${origin}/llms-full.txt\nUser-agent: *\nAllow: /\nDisallow: /website/data/\nDisallow: /auth/\nDisallow: /rest/\nDisallow: /functions/\nDisallow: /admin/\nDisallow: /brands/\nSitemap: ${origin}/sitemap.xml\n`;
}
export function sitemapIndex(languages, origin = 'https://anacan.az') {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${languages.map(code=>`<sitemap><loc>${origin}/sitemap-${code}.xml</loc></sitemap>`).join('')}</sitemapindex>\n`;
}
export function sitemapEntries(entries) {
  const escape = value => String(value).replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${entries.map(entry=>`<url><loc>${escape(entry.url)}</loc>${entry.updatedAt?`<lastmod>${escape(entry.updatedAt.slice(0,10))}</lastmod>`:''}${entry.alternates.map(item=>`<xhtml:link rel="alternate" hreflang="${item.code}" href="${escape(item.url)}"/>`).join('')}</url>`).join('')}</urlset>\n`;
}
