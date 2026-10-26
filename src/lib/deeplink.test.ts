import { expect, it, vi } from 'vitest';
import { parseDeeplink, generateDeeplink } from './deeplink';
import { appLaunchLinks } from '@/web-entry/policy.mjs';
import { APP_LANGUAGE_CODES } from './app-languages';
vi.mock('@/lib/tr',()=>({tr:(_key:string,fallback:string)=>fallback}));
it('carries module intent and locale from all three public hosts and the registered scheme',()=>{
  for(const host of ['app.anacan.az','gcp.anacan.az','api.anacan.az'])expect(parseDeeplink(`https://${host}/?blog_module=sleep&blog_language=az`)).toEqual({action:'blog-module',params:{module:'sleep',language:'az'}});
  expect(parseDeeplink('anacan:///?blog_module=feeding&blog_language=ru')).toEqual({action:'blog-module',params:{module:'feeding',language:'ru'}});
  expect(parseDeeplink('anacan://blog/article?language=az')).toEqual({action:'screen',params:{screen:'blog/article',language:'az'}});
});
it('round-trips every locale and module through the actual browser launch scheme',()=>{
  for(const language of APP_LANGUAGE_CODES){
    const article=appLaunchLinks(`https://gcp.anacan.az/blog/${language}/article/`);
    expect(parseDeeplink(article.scheme)).toEqual({action:'screen',params:{screen:'blog/article',language}});
    for(const module of ['sleep','feeding','diaper','babyGrowth','hospitalBag','calendar']){
      const links=appLaunchLinks(`https://api.anacan.az/?blog_module=${module}&blog_language=${language}`);
      expect(parseDeeplink(links.scheme)).toEqual({action:'blog-module',params:{module,language}});
    }
  }
  expect(parseDeeplink('anacan://tool/baby-names?language=ja')).toEqual({action:'tool',params:{tool_id:'baby-names',language:'ja'}});
  expect(parseDeeplink('anacan://blog/article?language=not-a-language')).toEqual({action:'screen',params:{screen:'blog/article'}});
});
it('keeps locale-prefixed articles exact and rejects deceptive destinations',()=>{
  expect(parseDeeplink('https://gcp.anacan.az/blog/ja/article/')).toEqual({action:'screen',params:{screen:'blog/article',language:'ja'}});
  expect(parseDeeplink('https://gcp.anacan.az.evil.invalid/blog/article')).toBeNull();
  expect(parseDeeplink('https://gcp.anacan.az/blog/en/%2Fadmin')).toBeNull();
  expect(generateDeeplink('/',{},'scheme')).toBe('anacan:///');
});
