import { getBackendConfig } from '@/integrations/supabase/backend-config';
import { blogEditorial, blogLocale } from '@/lib/blog-editorial';
import { isAppLanguage, APP_LANGUAGE_CODES, type AppLanguageCode } from '@/lib/app-languages';
import type { PublicBlogArticle } from './model';

function projection(row: Record<string, any>, language: AppLanguageCode): PublicBlogArticle | null {
  if (!row.is_published) return null;
  const title = language === 'az' ? row.title_az || row.title : row[`title_${language}`];
  const content = language === 'az' ? row.content_az || row.content : row[`content_${language}`];
  if (typeof title !== 'string' || !title.trim() || typeof content !== 'string' || !content.trim()) return null;
  const metadata = blogEditorial(row.editorial_metadata), locale = blogLocale(row.editorial_metadata, language);
  const excerpt = (language === 'az' ? row.excerpt_az || row.excerpt : row[`excerpt_${language}`]) || '';
  return {
    id: row.id, slug: row.slug, title, content, excerpt, author_name: row.author_name || 'Anacan',
    cover_image_url: row.cover_image_url, reading_time: row.reading_time || 5, category: row.category,
    category_slugs: [row.category, ...(row.blog_post_categories || []).map((item: any) => item.blog_categories?.slug).filter(Boolean)],
    life_stage: row.life_stage || 'all', lifeStages: metadata?.lifeStages || [row.life_stage || 'all'],
    modules: metadata?.modules || [], relatedSlugs: metadata?.relatedSlugs || [], tags: locale?.tags || row.tags || [],
    faq: locale?.faq || [], references: locale?.references || [], seoTitle: locale?.seoTitle || title,
    seoDescription: locale?.seoDescription || excerpt, coverAlt: locale?.coverAlt || title,
    created_at: row.created_at, updated_at: row.updated_at,
    languages: metadata ? Object.keys(metadata.locales).filter(code => isAppLanguage(code))
      : APP_LANGUAGE_CODES.filter(code => code === 'az' || typeof row[`title_${code}`] === 'string' && !!row[`title_${code}`].trim()),
  };
}
/** Anonymous public-content reads never instantiate or refresh a consumer/brand
 * session. Server RLS still excludes drafts. Explicit locale fields do not fall
 * back to another language. */
export async function fetchPublicArticles(language: AppLanguageCode, slug?: string, signal?: AbortSignal): Promise<PublicBlogArticle[]> {
  const config = getBackendConfig();
  const base = ['id','slug','title','title_az','excerpt','excerpt_az','content','content_az','author_name','cover_image_url','reading_time',
    'category','tags','life_stage','is_published','created_at','updated_at','editorial_metadata'];
  if (language !== 'az') base.push(`title_${language}`, `excerpt_${language}`, `content_${language}`);
  if (slug) base.push(...APP_LANGUAGE_CODES.map(code => `title_${code}`).filter(field => !base.includes(field)));
  base.push('blog_post_categories(category_id,blog_categories(slug))');
  const url = new URL('/rest/v1/blog_posts', config.url);
  url.searchParams.set('select', base.join(','));
  url.searchParams.set('is_published', 'eq.true');
  url.searchParams.set('order', 'created_at.desc,id');
  url.searchParams.set('limit', slug ? '1' : '200');
  if (slug) url.searchParams.set('slug', `eq.${slug}`);
  const response = await fetch(url, { credentials: 'omit', redirect: 'error', signal,
    headers: { apikey: config.publishableKey, ...(config.publishableKey?.startsWith('eyJ') ? { Authorization: `Bearer ${config.publishableKey}` } : {}) } });
  if (!response.ok) throw new Error('BLOG_PUBLIC_UNAVAILABLE');
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error('BLOG_PUBLIC_INVALID');
  return rows.map(row => projection(row, language)).filter((row): row is PublicBlogArticle => !!row);
}
