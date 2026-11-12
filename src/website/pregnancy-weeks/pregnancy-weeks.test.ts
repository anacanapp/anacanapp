import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import '../tools/tool-data-server';
import { FRUIT_SIZES } from '../../types/anacan';
import { getFetalWeightBand } from '../../lib/fetalGrowth';
import { getTrimester } from '../../lib/pregnancy-utils';
import { resolveWebsiteRoute, sitePath } from '../routes';
import { websiteMeta, websiteSchema } from '../seo';
import Website from '../Website';
import { toolSitemapEntries, toolRobots } from '../tools/tool-routes';
import { appDeepLinks } from '../tools/AppOpen';
import { parseDeeplink } from '../../lib/deeplink';
import { LLM_PAGE_KINDS, renderLlmHub } from '../llm-content';
import azCopy from '../copy/az.json';
import enCopy from '../copy/en.json';
import azDetails from '../details/az.json';
import type { WebsiteBoot, WebsiteCopy } from '../model';
import { PREGNANCY_WEEKS_AZ } from './az';
import {
  APP_FRUIT_SIZES, APP_MEDIAN_WEIGHT_G, PREGNANCY_SOURCES, PREGNANCY_WEEKS_PUBLISHED, PREGNANCY_WEEK_NUMBERS, azOrdinal, overridePregnancyWeeksPublished, overridePregnancyWeeksEnabled, PREGNANCY_WEEKS_ENABLED,
  pregnancyTrimester, pregnancyWeekFacts, pregnancyWeekFromSlug, pregnancyWeekNextTest, pregnancyWeekPath, pregnancyWeekQuick, pregnancyWeekSharedTodo,
  pregnancyWeekSharedWarnings, pregnancyWeekSize, pregnancyWeekSlug, pregnancyWeekTests,
} from './weeks';

const boot = (path: string, language: 'az' | 'en' = 'az'): WebsiteBoot => ({ schema: 'anacan-website-boot-v1', route: resolveWebsiteRoute(path).route,
  copy: (language === 'az' ? azCopy : enCopy) as WebsiteCopy, details: azDetails as WebsiteBoot['details'], articles: [], generatedAt: '2026-11-10T00:00:00Z', basePath: '' });
const html = (path: string) => renderToString(createElement(Website, { boot: boot(path) }));
const HUB = '/az/hamilelik/heftelik/';

describe('PREGNANCY_WEEKS_ENABLED switch (owner: content lives in the app)', () => {
  it('is off: hub and week URLs answer 404 and nothing is published', () => {
    expect(PREGNANCY_WEEKS_ENABLED).toBe(false);
    overridePregnancyWeeksEnabled();
    expect(resolveWebsiteRoute(HUB).route.kind).toBe('notFound');
    expect(resolveWebsiteRoute('/az/hamilelik/12-ci-hefte/').route.kind).toBe('notFound');
    expect(resolveWebsiteRoute('/az/hamilelik/').route.kind).not.toBe('notFound');
    expect(toolSitemapEntries().some(entry => entry.path.includes('-hefte/') || entry.path.includes('heftelik'))).toBe(false);
    overridePregnancyWeeksEnabled(true);
  });
});
// The page tests below exercise the switched-off pages so they can be brought back safely.
beforeAll(() => overridePregnancyWeeksEnabled(true));
afterAll(() => overridePregnancyWeeksEnabled());
const words = (text: string) => text.split(/\s+/).filter(Boolean).length;
/** Every text a reader sees for the week, in page order (facts table excluded). */
function visibleText(week: number) {
  const content = PREGNANCY_WEEKS_AZ.find(item => item.week === week)!, tests = pregnancyWeekTests(week);
  return [pregnancyWeekQuick(content), ...content.baby, ...content.body, ...content.symptoms, ...(tests.length ? tests : [pregnancyWeekNextTest(week)]),
    ...content.todo, ...pregnancyWeekSharedTodo(week), ...content.warning, ...pregnancyWeekSharedWarnings(week), ...content.faq.flatMap(item => [item.question, item.answer])];
}
afterEach(() => overridePregnancyWeeksPublished());

describe('pregnancy week ordinals and URLs', () => {
  it('writes Azerbaijani ordinal suffixes with vowel harmony', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 13, 20, 26, 30, 40, 42].map(azOrdinal))
      .toEqual(['1-ci', '2-ci', '3-cü', '4-cü', '5-ci', '6-cı', '7-ci', '8-ci', '9-cu', '10-cu', '13-cü', '20-ci', '26-cı', '30-cu', '40-cı', '42-ci']);
  });
  it('folds the suffix to ASCII in the URL and round-trips every week', () => {
    expect([1, 3, 6, 9, 10, 16, 40].map(pregnancyWeekSlug)).toEqual(['1-ci-hefte', '3-cu-hefte', '6-ci-hefte', '9-cu-hefte', '10-cu-hefte', '16-ci-hefte', '40-ci-hefte']);
    expect(new Set(PREGNANCY_WEEK_NUMBERS.map(pregnancyWeekSlug)).size).toBe(42);
    for (const week of PREGNANCY_WEEK_NUMBERS) expect(pregnancyWeekFromSlug(pregnancyWeekSlug(week))).toBe(week);
    expect(() => pregnancyWeekSlug(0)).toThrow();
    expect(() => pregnancyWeekSlug(43)).toThrow();
  });
  it('routes the hub and the 42 weeks under /az/ only', () => {
    expect(resolveWebsiteRoute(HUB).route).toMatchObject({ language: 'az', kind: 'pregnancyWeeks' });
    expect(resolveWebsiteRoute('/az/hamilelik/12-ci-hefte/').route).toMatchObject({ kind: 'pregnancyWeek', slug: '12-ci-hefte' });
    expect(resolveWebsiteRoute('/az/hamilelik/12-ci-hefte').redirect).toBe('/az/hamilelik/12-ci-hefte/');
    expect(resolveWebsiteRoute('/az/hamilelik/heftelik').redirect).toBe(HUB);
    expect(resolveWebsiteRoute('/az/hamilelik/').route.kind).toBe('pregnancy');
    for (const path of ['/az/hamilelik/3-ci-hefte/', '/az/hamilelik/43-cu-hefte/', '/az/hamilelik/0-ci-hefte/', '/az/hamilelik/12-ci-hefte/x/', '/az/hamilelik/yoxdur/'])
      expect(resolveWebsiteRoute(path).route.kind, path).toBe('notFound');
    for (const language of ['en', 'tr', 'ru', 'ka', 'de']) {
      expect(resolveWebsiteRoute(`/${language}/hamilelik/heftelik/`).route.kind).toBe('notFound');
      expect(resolveWebsiteRoute(`/${language}/hamilelik/12-ci-hefte/`).route.kind).toBe('notFound');
    }
    expect(resolveWebsiteRoute(`/en/${encodeURIComponent('pregnancy')}/12-ci-hefte/`).route.kind).toBe('notFound');
    expect(sitePath('az', 'pregnancyWeek', '40-ci-hefte')).toBe('/az/hamilelik/40-ci-hefte/');
  });
});

describe('pregnancy week numbers match the app', () => {
  it('copies FRUIT_SIZES and the fetal growth medians exactly', () => {
    expect(Object.keys(APP_FRUIT_SIZES)).toEqual(Object.keys(FRUIT_SIZES));
    for (const [week, row] of Object.entries(FRUIT_SIZES)) expect(APP_FRUIT_SIZES[Number(week)]).toEqual({ fruit: row.fruit, lengthCm: row.lengthCm, weightG: row.weightG });
    for (const [week, grams] of Object.entries(APP_MEDIAN_WEIGHT_G)) expect(getFetalWeightBand(Number(week)).p50).toBe(grams);
  });
  it('uses the app row, the app fruit and the app median in between and the app trimesters', () => {
    expect(pregnancyWeekSize(12)).toEqual({ kind: 'table', fruit: 'Laym', lengthCm: 5.6, weightG: 14 });
    expect(pregnancyWeekSize(22)).toMatchObject({ kind: 'table', fruit: 'Qreypfrut', lengthCm: 27.8, weightG: 478 });
    expect(pregnancyWeekSize(41)).toMatchObject({ kind: 'table', fruit: 'Böyük qarpız', lengthCm: 51.7, weightG: 3787 });
    for (const week of PREGNANCY_WEEK_NUMBERS) expect(pregnancyTrimester(week)).toBe(getTrimester(week));
    expect(pregnancyWeekFacts(20).map(fact => fact.value)).toEqual(expect.arrayContaining(['2-ci trimestr', 'təxminən 25,6 sm', 'təxminən 331 q', 'Banan boyda']));
    expect(pregnancyWeekFacts(40).map(fact => fact.value)).toEqual(expect.arrayContaining(['3-cü trimestr', 'təxminən 51,2 sm', 'təxminən 3,6 kq', 'Qarpız boyda']));
    expect(pregnancyWeekQuick(PREGNANCY_WEEKS_AZ[11])).toContain('təxminən laym boydadır (5,6 sm, 14 q)');
  });
});

describe('pregnancy week texts', () => {
  it('has 42 complete, week-specific weeks within the length limits', () => {
    expect(PREGNANCY_WEEKS_AZ.map(item => item.week)).toEqual(PREGNANCY_WEEK_NUMBERS);
    const seen = new Set<string>();
    for (const content of PREGNANCY_WEEKS_AZ) {
      const label = `week ${content.week}`, count = words(visibleText(content.week).join(' '));
      expect(count, label).toBeGreaterThanOrEqual(450);
      expect(count, label).toBeLessThanOrEqual(700);
      expect(content.description.length, label).toBeGreaterThanOrEqual(120);
      expect(content.description.length, label).toBeLessThanOrEqual(158);
      expect(content.description, label).toContain(`Hamiləliyin ${azOrdinal(content.week)} həftəsi`);
      const sentences = pregnancyWeekQuick(content).split(/(?<=[.!?])\s+/).filter(Boolean).length;
      expect(sentences, label).toBeGreaterThanOrEqual(2);
      expect(sentences, label).toBeLessThanOrEqual(3);
      expect(content.faq.length, label).toBeGreaterThanOrEqual(3);
      expect(content.faq.length, label).toBeLessThanOrEqual(5);
      expect(content.warning.length, label).toBeGreaterThan(0);
      for (const id of content.sources) expect(PREGNANCY_SOURCES[id], `${label} ${id}`).toBeDefined();
      expect(content.quick.split('{size}').length, label).toBe(content.week <= 3 ? 1 : 2);
      for (const text of [content.description, ...visibleText(content.week)]) {
        expect(text, label).not.toMatch(/[—–]/);
        expect(text, label).not.toMatch(/\{size\}|<|>/);
      }
      // Each week has its own paragraphs (no copied sections between weeks).
      for (const text of [...content.baby, ...content.body]) { expect(seen.has(text), `${label}: ${text}`).toBe(false); seen.add(text); }
      // No medication dosing: only the caffeine limit carries an amount in milligrams.
      for (const text of visibleText(content.week)) expect(text.replace('200 mq-dan', ''), label).not.toMatch(/\d\s*(mq|mg|mkq|mcg|ml|tablet)\b/i);
    }
  });
  it('counts weeks 1-2 from the last period and discusses post-term induction in weeks 41-42', () => {
    for (const week of [1, 2]) expect(visibleText(week).join(' ')).toMatch(/son menstruasiya/);
    for (const week of [41, 42]) {
      const text = visibleText(week).join(' ');
      expect(text).toMatch(/stimullaşdırıl/);
      expect(text).toMatch(/həkim/);
    }
  });
  it('lists standard tests only in their weeks', () => {
    const tested = PREGNANCY_WEEK_NUMBERS.filter(week => pregnancyWeekTests(week).length);
    expect(tested).toEqual([11, 12, 13, 18, 19, 20, 21, 22, 24, 25, 26, 27, 28, 36, 37]);
    expect(pregnancyWeekTests(12).join(' ')).toContain('NT');
    expect(pregnancyWeekTests(20).join(' ')).toContain('anomaliya');
    expect(pregnancyWeekTests(26).join(' ')).toContain('qlükoza');
    expect(pregnancyWeekTests(36).join(' ')).toContain('GBS');
  });
  it('has no reviewer field and no review-pending line', () => {
    const source = JSON.stringify(PREGNANCY_WEEKS_AZ);
    expect(source).not.toMatch(/reviewer|lastReviewed|yoxlama gözlənilir|review pending/i);
    for (const path of [HUB, '/az/hamilelik/12-ci-hefte/']) expect(html(path)).not.toMatch(/reviewer|lastReviewed|yoxlama gözlənilir/i);
  });
});

describe('pregnancy week pages', () => {
  it('renders the week anatomy, the app card and the due date link', () => {
    const page = html('/az/hamilelik/12-ci-hefte/');
    expect(page).toContain('Hamiləliyin 12-ci həftəsi: körpənin ölçüsü, əlamətlər və məsləhətlər</h1>');
    for (const heading of ['Qısa cavab', 'Əsas göstəricilər', 'Körpənin inkişafı', 'Sizin bədəninizdə nələr dəyişir', 'Bu həftənin əlamətləri', 'Müayinələr və testlər',
      'Bu həftə nə etməli', 'Nə vaxt həkimə müraciət etməli', 'Tez-tez verilən suallar', 'Mənbələr', 'Hər həftəni Anacan-da izlə'])
      expect(page, heading).toContain(heading);
    expect(page).toContain('href="/az/dogus-tarixi-kalkulyatoru/"');
    expect(page).toContain('href="/az/hamilelik/11-ci-hefte/"');
    expect(page).toContain('href="/az/hamilelik/13-cu-hefte/"');
    expect(page).toContain('https://www.nhs.uk/best-start-in-life/pregnancy/week-by-week-guide-to-pregnancy/1st-trimester/week-12/');
    expect(page).toContain('5,6 sm');
    const hub = html(HUB);
    for (const week of PREGNANCY_WEEK_NUMBERS) expect(hub).toContain(`href="${pregnancyWeekPath(week)}"`);
    expect(hub).toContain('1-ci trimestr');
  });
  it('opens the app on the home tab (the pregnancy tracker)', () => {
    const links = appDeepLinks('pregnancy', 'web-week-12');
    expect(links.scheme).toBe('anacan://?src=web-week-12');
    expect(parseDeeplink(links.scheme)).toMatchObject({ action: 'tab', params: { tab: 'home' } });
    expect(links.intent).toContain('package=com.atlasoon.anacan');
  });
  it('keeps titles within 60 characters and emits MedicalWebPage, BreadcrumbList and FAQPage', () => {
    for (const path of [HUB, ...PREGNANCY_WEEK_NUMBERS.map(pregnancyWeekPath)]) {
      const meta = websiteMeta(boot(path));
      expect(meta.title.length, meta.title).toBeLessThanOrEqual(60);
      expect(meta.canonical).toBe('https://anacan.az' + path);
      expect(meta.alternates.map(item => item.code)).toEqual(['az', 'x-default']);
    }
    expect(websiteMeta(boot('/az/hamilelik/3-cu-hefte/')).title).toBe('Hamiləliyin 3-cü həftəsi: körpə və əlamətlər | Anacan');
    const graph = websiteSchema(boot('/az/hamilelik/20-ci-hefte/'))['@graph'] as Array<Record<string, unknown>>;
    expect(graph.map(node => node['@type'])).toEqual(expect.arrayContaining(['MedicalWebPage', 'BreadcrumbList', 'FAQPage']));
    const crumbs = graph.find(node => node['@type'] === 'BreadcrumbList')!.itemListElement as Array<{ name: string }>;
    expect(crumbs.map(item => item.name)).toEqual([azCopy.home, 'Hamiləlik', 'Həftəbəhəftə', '20-ci həftə']);
    expect((websiteSchema(boot(HUB))['@graph'] as Array<{ '@type': string }>).map(node => node['@type'])).toEqual(expect.arrayContaining(['CollectionPage', 'ItemList', 'BreadcrumbList']));
  });
});

describe('PREGNANCY_WEEKS_PUBLISHED gate', () => {
  const linked = () => [html('/az/hamilelik/'), html('/az/kalkulyatorlar/')].map(page => page.includes(`href="${HUB}"`));
  it('ships unpublished', () => expect(PREGNANCY_WEEKS_PUBLISHED).toBe(false));
  it('false: pages render with noindex,nofollow, outside sitemaps and llms, linked from nowhere', () => {
    overridePregnancyWeeksPublished(false);
    for (const path of [HUB, '/az/hamilelik/1-ci-hefte/', '/az/hamilelik/40-ci-hefte/']) {
      expect(websiteMeta(boot(path)).robots).toBe('noindex,nofollow');
      expect(toolRobots(boot(path).route)).toBe('noindex,nofollow');
      expect(html(path)).toContain('<h1>');
    }
    expect(toolSitemapEntries().filter(entry => entry.path.startsWith('/az/hamilelik/'))).toEqual([]);
    expect(linked()).toEqual([false, false]);
    expect(LLM_PAGE_KINDS).not.toContain('pregnancyWeek');
    expect(LLM_PAGE_KINDS).not.toContain('pregnancyWeeks');
    expect(renderLlmHub()).not.toContain('heftelik');
    expect(websiteMeta(boot('/az/dekret-pulu-kalkulyatoru/')).robots).toBe('index,follow,max-image-preview:large,max-snippet:-1');
  });
  it('true: indexable, in the sitemaps and linked from the pregnancy page and the calculators page', () => {
    overridePregnancyWeeksPublished(true);
    expect(websiteMeta(boot('/az/hamilelik/12-ci-hefte/')).robots).toBe('index,follow,max-image-preview:large,max-snippet:-1');
    expect(toolRobots(boot(HUB).route)).toBeUndefined();
    const paths = toolSitemapEntries().filter(entry => entry.path.startsWith('/az/hamilelik/'));
    expect(paths.map(entry => entry.path)).toEqual([HUB, ...PREGNANCY_WEEK_NUMBERS.map(pregnancyWeekPath)]);
    expect(paths[0].alternates.map(item => item.code)).toEqual(['az', 'x-default']);
    expect(linked()).toEqual([true, true]);
    expect(renderToString(createElement(Website, { boot: boot('/en/pregnancy/', 'en') }))).not.toContain('heftelik');
  });
});
