import { describe, expect, it } from 'vitest';
import { WEBSITE_LANGUAGE_CODES_ALL } from '../lib/app-languages';
import { ALL_CALC_CONTENT } from './calc-content/all';
import { calcContent } from './calc-content';
import { CALC_PAGES, PAGE_SLUGS, resolveWebsiteRoute, sitePath } from './routes';
import { websiteMeta, websiteSchema } from './seo';
import type { WebsiteBoot } from './model';
import az from './copy/az.json';

/** Search result snippets are cut by width: East Asian wide characters count double. */
const width = (text: string) => [...text].reduce((sum, character) => sum + (/[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/.test(character) ? 2 : 1), 0);
const texts =(value: unknown): string[] => typeof value === 'string' ? [value] : Array.isArray(value) ? value.flatMap(texts) : value && typeof value === 'object' ? Object.values(value).flatMap(texts) : [];

describe('calculator page content', () => {
  it('exists for every website language with SEO limits and no long dashes', () => {
    expect(Object.keys(ALL_CALC_CONTENT).sort()).toEqual([...WEBSITE_LANGUAGE_CODES_ALL].sort());
    for (const language of WEBSITE_LANGUAGE_CODES_ALL) {
      const content = calcContent(language);
      for (const text of texts(content)) expect(text, `${language}: ${text}`).not.toMatch(/—/);
      for (const kind of CALC_PAGES) {
        const page = content[kind], where = `${language}/${kind}`;
        expect(width(page.title + ' | Anacan'), where + ' title').toBeLessThanOrEqual(60);
        expect(width(page.description), where + ' description').toBeGreaterThanOrEqual(120);
        expect(width(page.description), where + ' description').toBeLessThanOrEqual(158);
        expect(page.faq.length, where + ' faq').toBeGreaterThanOrEqual(4);
        expect(page.faq.length, where + ' faq').toBeLessThanOrEqual(6);
        expect(page.facts.length, where + ' facts').toBeGreaterThanOrEqual(4);
        expect(page.doctor.length, where + ' doctor').toBeGreaterThanOrEqual(3);
      }
      expect(content.babyGrowth.labels.ageValue, language).toContain('{months}');
    }
  });
  it('has stable ASCII slugs per language that resolve back to the page', () => {
    for (const language of WEBSITE_LANGUAGE_CODES_ALL) {
      const slugs = CALC_PAGES.map(kind => PAGE_SLUGS[language][kind]);
      expect(new Set(slugs).size).toBe(slugs.length);
      for (const kind of CALC_PAGES) {
        expect(PAGE_SLUGS[language][kind], `${language}/${kind}`).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
        const path = sitePath(language, kind);
        expect(resolveWebsiteRoute(path, []).route).toMatchObject({ language, kind });
      }
    }
    expect(sitePath('az', 'babyGrowth')).toBe('/az/korpe-boy-ceki-persentili/');
    expect(sitePath('ru', 'pregnancyWeight')).toBe('/ru/kalkulyator-nabora-vesa-pri-beremennosti/');
  });
  it('publishes WebApplication, BreadcrumbList, FAQPage and all 21 hreflang alternates', () => {
    const boot = { schema: 'anacan-website-boot-v1', route: { language: 'az', kind: 'babyGrowth' }, copy: az, details: undefined, articles: [], generatedAt: '2026-11-10T00:00:00Z', basePath: '' } as unknown as WebsiteBoot;
    const meta = websiteMeta(boot);
    expect(meta.title).toBe(calcContent('az').babyGrowth.title + ' | Anacan');
    expect(meta.alternates).toHaveLength(22);
    expect(meta.alternates.find(item => item.code === 'en')?.url).toBe('https://anacan.az/en/baby-growth-percentile-calculator/');
    const graph = (websiteSchema(boot) as { '@graph': Array<Record<string, unknown>> })['@graph'];
    const types = graph.map(node => node['@type']);
    expect(types).toEqual(expect.arrayContaining(['WebApplication', 'BreadcrumbList', 'FAQPage']));
    expect(graph.find(node => node['@type'] === 'WebApplication')).toMatchObject({ applicationCategory: 'HealthApplication', isAccessibleForFree: true });
    const crumbs = graph.find(node => node['@type'] === 'BreadcrumbList')!.itemListElement as Array<{ name: string }>;
    expect(crumbs.map(item => item.name)).toEqual([az.home, az.tools, calcContent('az').babyGrowth.name]);
  });
});
