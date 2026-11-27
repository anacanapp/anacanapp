import { describe, expect, it } from 'vitest';
import { hasParentingContent, loadBundledParentingContent, PARENTING_CONTENT_LANGUAGES, PARENTING_LANGUAGE_LOADERS } from './index';
import azContent from './az';
import { AGE_BANDS, type Source } from './types';

const c = azContent;
const allText = JSON.stringify(c);

describe('Tərbiyə content (az)', () => {
  it('loads lazily through the registry, the same object as the az chunk', async () => {
    expect(await loadBundledParentingContent('az')).toBe(azContent);
    expect(await loadBundledParentingContent('xx')).toBeNull();
  });

  it('carries search / Anacan.AI tags on SOS cards and articles (ids all exist)', async () => {
    const { ARTICLE_TAGS, SOS_TAGS, PROGRAMME_TAGS } = await import('./az/tags');
    for (const id of Object.keys(ARTICLE_TAGS)) expect(c.articles.some((a) => a.id === id), id).toBe(true);
    for (const id of Object.keys(SOS_TAGS)) expect(c.sos.some((s) => s.id === id), id).toBe(true);
    for (const id of Object.keys(PROGRAMME_TAGS)) expect(c.programmes.some((p) => p.id === id), id).toBe(true);
    expect(c.sos.every((s) => (s.tags || []).length > 0)).toBe(true);
  });

  it('exists only in Azerbaijani for now', () => {
    expect(PARENTING_CONTENT_LANGUAGES).toContain('az');
    expect(PARENTING_CONTENT_LANGUAGES).toEqual(Object.keys(PARENTING_LANGUAGE_LOADERS));
    expect(hasParentingContent('az')).toBe(true);
    expect(hasParentingContent('xx')).toBe(false);
    expect(hasParentingContent(null)).toBe(false);
    expect(hasParentingContent('constructor')).toBe(false);
  });

  it('is a rich library: 4 bands, 60+ articles, 25+ SOS cards, 6 programmes, 2 quizzes, 30 daily tips per band', () => {
    expect(c.bands.map((b) => b.id)).toEqual(AGE_BANDS);
    expect(c.articles.length).toBeGreaterThanOrEqual(60);
    expect(c.sos.length).toBeGreaterThanOrEqual(25);
    expect(c.programmes.map((p) => [p.id, p.days.length])).toEqual([['no-shouting-21', 21], ['tantrums-14', 14], ['sleep-7', 7], ['siblings-7', 7], ['screen-reset-7', 7], ['special-time-7', 7]]);
    expect(c.styleQuiz.items.length).toBeGreaterThanOrEqual(10);
    expect(c.milestoneQuiz.checkpoints.length).toBeGreaterThanOrEqual(5);
    for (const band of AGE_BANDS) expect(c.tips[band].length).toBeGreaterThanOrEqual(30);
  });

  it('has unique ids and every age band is covered by articles and SOS cards', () => {
    const ids = c.articles.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    const sosIds = c.sos.map((s) => s.id);
    expect(new Set(sosIds).size).toBe(sosIds.length);
    for (const band of AGE_BANDS) {
      expect(c.articles.filter((a) => a.bands.includes(band)).length, band).toBeGreaterThanOrEqual(8);
      expect(c.sos.filter((s) => s.bands.includes(band)).length, band).toBeGreaterThanOrEqual(3);
    }
  });

  it('gives every topic area at least one full free article and keeps several SOS cards free', () => {
    for (const area of c.areas) {
      const inArea = c.articles.filter((a) => a.area === area.id);
      expect(inArea.length, area.id).toBeGreaterThan(0);
      expect(inArea.some((a) => a.free), area.id).toBe(true);
    }
    expect(c.articles.filter((a) => !a.free).length).toBeGreaterThanOrEqual(15);
    expect(c.sos.filter((s) => s.free).length).toBeGreaterThanOrEqual(6);
    expect(c.sos.filter((s) => !s.free).length).toBeGreaterThanOrEqual(10);
  });

  it('every article is complete: science, a practical step, mistakes, specialist signals and real sources', () => {
    for (const a of c.articles) {
      expect(a.science.length, a.id).toBeGreaterThan(0);
      expect(a.tryToday.length, a.id).toBeGreaterThanOrEqual(2);
      expect(a.mistakes.length, a.id).toBeGreaterThanOrEqual(2);
      expect(a.specialist.length, a.id).toBeGreaterThan(0);
      expect(a.sources.length, a.id).toBeGreaterThanOrEqual(2);
      for (const s of a.sources as Source[]) {
        expect(s.who && s.title, a.id).toBeTruthy();
        if (s.year) expect(s.year, a.id).toMatch(/^(19|20)\d\d$/);
      }
    }
    for (const s of c.sos) {
      expect(s.steps).toHaveLength(3);
      expect(s.say.length, s.id).toBeGreaterThan(0);
      expect(s.avoid.length, s.id).toBeGreaterThan(0);
    }
  });

  it('never hardcodes an emergency number (the country helper fills {emergency})', () => {
    expect(allText).not.toMatch(/(^|[^\d])(103|112|911|999)(?!\d)/);
    expect(allText).toContain('{emergency}');
  });

  it('never recommends physical punishment or sleep training as mandatory', () => {
    expect(allText).not.toMatch(/şillə vur|vurmaq lazımdır|ağlamağa burax(ın|) mütləq/i);
    const sleep = c.articles.find((a) => a.id === 'sleep-routine')!;
    expect(sleep.mistakes.join(' ')).toMatch(/Heç bir üsul hamı üçün vacib deyil/);
  });

  it('every SOS card cites 1–3 sources from the shared list; support cards sit on the safety content', async () => {
    const { S } = await import('./az/sources');
    for (const s of c.sos) {
      expect(s.sources?.length, s.id).toBeGreaterThanOrEqual(1);
      expect(s.sources!.length, s.id).toBeLessThanOrEqual(3);
      for (const id of s.sources!) expect(Object.prototype.hasOwnProperty.call(S, id), `${s.id}: ${id}`).toBe(true);
      expect(new Set(s.sources).size, s.id).toBe(s.sources!.length);
    }
    const support = (list: { id: string; support?: string }[]) => Object.fromEntries(list.filter((x) => x.support).map((x) => [x.id, x.support]));
    expect(support(c.sos)).toEqual({ 'about-to-lose-it': 'mental-health', 'baby-crying': 'mental-health' });
    expect(support(c.articles)).toMatchObject({ 'fourth-trimester': 'mental-health', 'body-safety': 'child-safety' });
    expect(support(c.bands)).toEqual({ '0-1': 'mental-health', '6-12': 'child-safety' });
  });

  it('every language mirrors the SOS source ids and support kinds of az', async () => {
    for (const lang of PARENTING_CONTENT_LANGUAGES) {
      const other = await loadBundledParentingContent(lang);
      expect(other!.sos.map((s) => [s.id, s.sources, s.support]), lang).toEqual(c.sos.map((s) => [s.id, s.sources, s.support]));
      expect(other!.articles.map((a) => a.support), lang).toEqual(c.articles.map((a) => a.support));
      expect(other!.bands.map((b) => b.support), lang).toEqual(c.bands.map((b) => b.support));
    }
  }, 60_000);
});
