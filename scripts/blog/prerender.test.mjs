import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { pathFor, renderPage, schemaFor, CANONICAL } from './prerender.mjs';

const article = { id:'fixture',slug:'safe-sleep',title:'Safe infant sleep',excerpt:'Practical steps',content:'<p>Full article</p><h2 id="section-1">Sleep surface</h2><p>A firm, flat cot.</p>',
  seoTitle:'Safe infant sleep',seoDescription:'Choose a firm flat cot and place your baby on their back.',coverAlt:'Original cot illustration',
  cover_image_url:CANONICAL+'/blog-covers/safe-sleep.webp',reading_time:5,author_name:'Anacan',lifeStages:['mommy','bump'],
  modules:['sleep'],relatedSlugs:[],tags:['sleep'],faq:[{question:'Which surface?',answer:'Firm and flat.'}],references:[],
  languages:['az','en'],created_at:'2026-10-05T18:00:00Z',updated_at:'2026-10-05T18:00:00Z' };
test('serves complete readable metadata and reciprocal real-locale links without JavaScript',()=>{
  const html=renderPage({shell:'<!doctype html><html><head><title>App</title></head><body><div id="root"></div><script type="module" src="/assets/main.js"></script></body></html>',language:'en',articles:[article],article,css:'body{}'});
  const document=new JSDOM(html).window.document;
  assert.equal(document.querySelector('h1').textContent,article.title);
  assert.equal(document.querySelector('.public-blog-prose h2').textContent,'Sleep surface');
  assert.equal(document.querySelector('link[rel="canonical"]').href,CANONICAL+'/blog/en/safe-sleep/');
  assert.equal(document.querySelector('link[hreflang="az"]').href,CANONICAL+'/blog/safe-sleep/');
  assert.equal(document.querySelectorAll('details').length,1);
  assert.equal(JSON.parse(document.querySelector('script[data-blog-schema]').textContent)['@graph'][0].mainEntityOfPage['@id'],CANONICAL+'/blog/en/safe-sleep/');
});
test('untrusted text is escaped and inert boot JSON cannot create active markup',()=>{
  const hostile={...article,title:'<img src=x onerror=alert(1)>',excerpt:'</script><script>evil()</script>'};
  const html=renderPage({shell:'<html><head></head><body><div id="root"></div></body></html>',language:'en',articles:[hostile],article:hostile,css:''});
  const document=new JSDOM(html).window.document;
  assert.equal(document.querySelector('h1 img'),null);
  assert.equal(document.querySelectorAll('script').length,2);
  assert.equal(JSON.parse(document.getElementById('anacan-blog-boot').textContent).article.title,hostile.title);
});
test('schema represents real publisher and never fabricates medical reviewer or outcomes',()=>{
  const schema=schemaFor('en',article)['@graph'][0];
  assert.equal(schema.author.name,'Anacan');assert.equal(schema.reviewedBy,undefined);assert.equal(schema.aggregateRating,undefined);
  assert.equal(pathFor('ja','safe-sleep'),'/blog/ja/safe-sleep/');
});
