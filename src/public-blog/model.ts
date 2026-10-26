import type { AppLanguageCode } from '@/lib/app-languages';
import type { BlogFaq, BlogModule, BlogReference } from '@/lib/blog-editorial';

export interface PublicBlogArticle {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  author_name: string;
  cover_image_url: string | null;
  reading_time: number;
  category: string;
  category_slugs: string[];
  life_stage: string;
  lifeStages: string[];
  modules: BlogModule[];
  relatedSlugs: string[];
  tags: string[];
  faq: BlogFaq[];
  references: BlogReference[];
  seoTitle: string;
  seoDescription: string;
  coverAlt: string;
  created_at: string;
  updated_at: string;
  languages: AppLanguageCode[];
}
export interface PublicBlogCatalog {
  schema: 'anacan-public-blog-catalog-v1';
  language: AppLanguageCode;
  generatedAt: string;
  articles: PublicBlogArticle[];
}
export interface PublicBlogBoot {
  language: AppLanguageCode;
  slug?: string;
  article?: PublicBlogArticle;
  articles?: PublicBlogArticle[];
}
