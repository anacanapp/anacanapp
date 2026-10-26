import type { AppLanguageCode } from '../lib/app-languages';
import type { ArticleRoute, WebsiteRoute } from './routes';
import type sourceCopy from './copy/az.json';
import type detailCopy from './details/az.json';

export type WebsiteCopy = Record<keyof typeof sourceCopy, string> & Partial<Record<keyof typeof detailCopy,string>>;
export type WebsiteCopyKey = keyof WebsiteCopy;
export interface WebsiteArticle extends ArticleRoute {
  language: AppLanguageCode;
  slug: string;
  title: string;
  excerpt: string;
  content?: string;
  contentFormat?: 'anacan-article-html-v1';
  cover: string | null;
  coverAlt: string;
  author: string;
  minutes: number;
  category: string;
  stages: string[];
  tags: string[];
  modules: string[];
  relatedIds: string[];
  faq: Array<{ question:string; answer:string }>;
  references: Array<{ title:string; url:string }>;
  headings: Array<{ id:string; title:string }>;
  seoTitle: string;
  seoDescription: string;
  publishedAt: string;
  updatedAt: string;
}
export interface WebsiteBoot {
  schema: 'anacan-website-boot-v1';
  route: WebsiteRoute;
  copy: WebsiteCopy;
  details?: Record<keyof typeof detailCopy,string>;
  articles: WebsiteArticle[];
  article?: WebsiteArticle;
  legalContent?: string;
  legalUpdated?: string;
  generatedAt: string;
  basePath: string;
}
export interface WebsiteCatalog {
  schema: 'anacan-website-catalog-v1';
  language: AppLanguageCode;
  generatedAt: string;
  articles: WebsiteArticle[];
  legal: Partial<Record<'privacy'|'terms', { content:string; updatedAt:string }>>;
}
export function formatCopy(copy: WebsiteCopy, key: WebsiteCopyKey, values: Record<string,string|number> = {}): string {
  return copy[key].replace(/\{(\w+)\}/g, (token, name) => Object.prototype.hasOwnProperty.call(values,name) ? String(values[name]) : token);
}
