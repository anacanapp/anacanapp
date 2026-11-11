import { describe, expect, it } from 'vitest';
import { compactBlogPost } from './useBlog';

describe('compactBlogPost', () => {
  it('keeps localized fields and the active locale, drops other translations', () => {
    const post = { id: '1', title: 'Başlıq', content: 'Mətn', title_en: 'Title', content_en: 'Text', content_ru: 'Текст', excerpt_tr: 'Özet', tags: ['a'], tags_en: ['b'],
      editorial_metadata: { schema: 'anacan-blog-editorial-v1', locales: { az: { seoTitle: 'az' }, en: { seoTitle: 'en' }, ru: { seoTitle: 'ru' } }, lifeStages: [], modules: [], relatedSlugs: [] } };
    const out = compactBlogPost(post, 'en') as Record<string, any>;
    expect(out).toMatchObject({ id: '1', title: 'Başlıq', content: 'Mətn', tags: ['a'], tags_en: ['b'] });
    expect(out).not.toHaveProperty('content_en');
    expect(out).not.toHaveProperty('content_ru');
    expect(out).not.toHaveProperty('excerpt_tr');
    expect(Object.keys(out.editorial_metadata.locales).sort()).toEqual(['az', 'en']);
    expect(out.editorial_metadata.schema).toBe('anacan-blog-editorial-v1');
  });
});
