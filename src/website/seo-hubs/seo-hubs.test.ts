import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import '../tools/tool-data-server';
import Website from '../Website';
import { resolveWebsiteRoute } from '../routes';
import type { WebsiteBoot, WebsiteCopy } from '../model';
import azCopy from '../copy/az.json';
import azDetails from '../details/az.json';
import { SAFE_ITEMS, SOLID_MONTHS, feverAdvice } from './content-az';
import { SAFE_SLUGS, SOLID_MONTH_NUMBERS, overrideSeoHubsPublished, seoHubSitemapRows } from './routes';
import { toolRobots } from '../tools/tool-routes';

const html = (path: string) => renderToString(createElement(Website, { boot: { schema: 'anacan-website-boot-v1', route: resolveWebsiteRoute(path).route,
  copy: azCopy as WebsiteCopy, details: azDetails as WebsiteBoot['details'], articles: [], generatedAt: '2026-11-15T00:00:00Z', basePath: '' } as WebsiteBoot }));
const PAGES = ['/az/usaqda-qizdirma/', '/az/elave-qida/', '/az/elave-qida/6-ay/', '/az/hamilelikde-olar-olmaz/', '/az/hamilelikde-olar-olmaz/kofe/', '/az/ana-sudu-saxlama/', '/az/aybasi/'];

describe('SEO content pages', () => {
  it('keeps the routing slugs equal to the content', () => {
    expect(SAFE_ITEMS.map(item => item.slug)).toEqual([...SAFE_SLUGS]);
    expect(SOLID_MONTHS.map(item => item.month)).toEqual([...SOLID_MONTH_NUMBERS]);
  });
  it('resolves every page, 404s unknown children and other languages', () => {
    for (const path of PAGES) expect(resolveWebsiteRoute(path).route.kind, path).not.toBe('notFound');
    expect(resolveWebsiteRoute('/az/elave-qida/3-ay/').route.kind).toBe('notFound');
    expect(resolveWebsiteRoute('/az/hamilelikde-olar-olmaz/yoxdur/').route.kind).toBe('notFound');
  });
  it('is indexable and in the sitemaps once published; hidden again with the switch off', () => {
    for (const path of PAGES) expect(toolRobots(resolveWebsiteRoute(path).route)).toBeUndefined();
    expect(seoHubSitemapRows()).toHaveLength(32);
    overrideSeoHubsPublished(false);
    for (const path of PAGES) expect(toolRobots(resolveWebsiteRoute(path).route)).toBe('noindex,nofollow');
    expect(seoHubSitemapRows()).toEqual([]);
    overrideSeoHubsPublished();
  });
  it('names the period page with its other words (menstruasiya, period, regl)', () => {
    const page = html('/az/aybasi/');
    for (const word of ['menstruasiya', 'period', 'regl']) expect(page.toLowerCase()).toContain(word);
  });
  it('renders the answer, the app gate with a tracked store link and the sources', () => {
    for (const path of PAGES) {
      const page = html(path);
      expect(page, path).toContain('class="sh-gate"');
      expect(page, path).toContain('ct=web_seo_');
      expect(page, path).toContain('Mənbələr');
      expect(page, path).not.toContain('—');
    }
  });
  it('follows the NHS fever thresholds', () => {
    expect(feverAdvice({ age: 0, temp: 38, days: 1, redFlag: false, dehydrated: false }).level).toBe('doctor');
    expect(feverAdvice({ age: 1, temp: 38.9, days: 1, redFlag: false, dehydrated: false }).level).toBe('home');
    expect(feverAdvice({ age: 1, temp: 39, days: 1, redFlag: false, dehydrated: false }).level).toBe('doctor');
    expect(feverAdvice({ age: 2, temp: 38.5, days: 5, redFlag: false, dehydrated: false }).level).toBe('doctor');
    expect(feverAdvice({ age: 3, temp: 37, days: 1, redFlag: true, dehydrated: false }).level).toBe('emergency');
  });
});
