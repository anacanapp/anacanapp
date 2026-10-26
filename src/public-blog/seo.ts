import { APP_LANGUAGES } from '@/lib/app-languages';
import { BLOG_CANONICAL_ORIGIN, blogPath } from '@/lib/blog-editorial';
import { blogText } from '@/lib/blog-i18n';
import type { AppLanguageCode } from '@/lib/app-languages';
import type { PublicBlogArticle } from './model';

export function updatePublicBlogHead(language: AppLanguageCode, article?: PublicBlogArticle | null, unavailable = false) {
  const title = unavailable ? blogText('unavailable', language) : article?.seoTitle || blogText('seoTitle', language);
  const description = article?.seoDescription || blogText('seoDescription', language);
  const canonical = BLOG_CANONICAL_ORIGIN + blogPath(article?.slug, language);
  document.documentElement.lang = language;
  document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  document.title = `${title} | Anacan`;
  const setMeta = (key: string, value: string, property = false) => {
    const selector = property ? 'property' : 'name';
    const element = document.head.querySelector<HTMLMetaElement>(`meta[${selector}="${key}"]`) || document.createElement('meta');
    element.setAttribute(selector, key); element.content = value;
    if (!element.parentNode) document.head.append(element);
  };
  setMeta('description', description);
  setMeta('robots', unavailable ? 'noindex,follow' : 'index,follow,max-image-preview:large');
  setMeta('og:title', title, true); setMeta('og:description', description, true);
  setMeta('og:type', article ? 'article' : 'website', true); setMeta('og:url', canonical, true);
  setMeta('og:locale', APP_LANGUAGES.find(item => item.code === language)!.locale.replace('-', '_'), true);
  setMeta('twitter:title', title); setMeta('twitter:description', description); setMeta('twitter:card', 'summary_large_image');
  const image = new URL(article?.cover_image_url || '/brand-mark.png', BLOG_CANONICAL_ORIGIN).href;
  setMeta('og:image', image, true); setMeta('og:image:alt', article?.coverAlt || 'Anacan', true); setMeta('twitter:image', image);
  if (article) { setMeta('article:published_time', article.created_at, true); setMeta('article:modified_time', article.updated_at, true); }
  else document.head.querySelectorAll('meta[property="article:published_time"],meta[property="article:modified_time"]').forEach(node => node.remove());
  const link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]') || document.createElement('link');
  link.rel = 'canonical'; link.href = canonical;
  if (!link.parentNode) document.head.append(link);
  document.head.querySelectorAll('link[hreflang]').forEach(element => element.remove());
  const available = article?.languages || APP_LANGUAGES.map(item => item.code);
  for (const code of [...available, 'x-default']) {
    const alternate = document.createElement('link'); alternate.rel = 'alternate'; alternate.hreflang = code;
    alternate.href = BLOG_CANONICAL_ORIGIN + blogPath(article?.slug, code === 'x-default' ? 'az' : code);
    document.head.append(alternate);
  }
  document.querySelector('script[data-blog-schema]')?.remove();
  if (article && !unavailable) {
    const script = document.createElement('script'); script.type = 'application/ld+json'; script.dataset.blogSchema = '';
    const articleSchema = { '@type': 'BlogPosting', '@id': canonical + '#article', headline: article.title,
      description, inLanguage: language, datePublished: article.created_at, dateModified: article.updated_at,
      mainEntityOfPage: { '@type': 'WebPage', '@id': canonical }, image: { '@type': 'ImageObject', url: image, width: 1200, height: 630 },
      author: { '@type': 'Organization', name: article.author_name }, publisher: { '@type': 'Organization', name: 'Anacan',
        logo: { '@type': 'ImageObject', url: `${BLOG_CANONICAL_ORIGIN}/brand-mark.png` } }, keywords: article.tags.join(', '), citation: article.references.map(reference => reference.url) };
    script.textContent = JSON.stringify({ '@context': 'https://schema.org', '@graph': [articleSchema,
      { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: blogText('blog', language), item: BLOG_CANONICAL_ORIGIN + blogPath(undefined, language) },
        { '@type': 'ListItem', position: 2, name: article.title, item: canonical }] },
      ...(article.faq.length ? [{ '@type': 'FAQPage', '@id': canonical + '#faq', mainEntity: article.faq.map(faq => ({ '@type': 'Question', name: faq.question,
        acceptedAnswer: { '@type': 'Answer', text: faq.answer } })) }] : []),
    ] });
    document.head.append(script);
  }
}
