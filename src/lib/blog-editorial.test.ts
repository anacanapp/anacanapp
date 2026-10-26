import { expect, it } from 'vitest';
import { blogMatchesStage, blogPath, blogLocale } from './blog-editorial';
import { consumeBlogModule, rememberBlogModule, isBlogModule } from './blog-module-navigation';
const metadata = { schema: 'anacan-blog-editorial-v1', lifeStages: ['mommy','bump'], modules:['feeding'], relatedSlugs:[],
  locales:{az:{seoTitle:'Ana südü',seoDescription:'Qidalanma',coverAlt:'Şəkil',tags:['süd'],faq:[]}} };
it('uses explicit multi-stage editorial targeting and preserves legacy all-stage content',()=>{
  expect(blogMatchesStage({life_stage:'mommy',editorial_metadata:metadata},'bump')).toBe(true);
  expect(blogMatchesStage({life_stage:'mommy',editorial_metadata:metadata},'flow')).toBe(false);
  expect(blogMatchesStage({life_stage:'all'},'flow')).toBe(true);
});
it('does not silently project an absent SEO locale and provides stable crawlable paths',()=>{
  expect(blogLocale(metadata,'ja')).toBeNull();expect(blogLocale(metadata,'az')?.seoTitle).toBe('Ana südü');
  expect(blogPath('süd','en')).toBe('/blog/en/s%C3%BCd/');
});
it('retains only known expiring module navigation across authentication',()=>{
  sessionStorage.clear();expect(isBlogModule('admin')).toBe(false);
  rememberBlogModule('feeding');expect(consumeBlogModule()).toBe('feeding');expect(consumeBlogModule()).toBeNull();
});
