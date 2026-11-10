import { describe, it, expect } from 'vitest';
import './tool-data-server';
import { maternityRules } from '../../data/maternityRules';
import { resolveWebsiteRoute, sitePath, alternateRoute } from '../routes';
import { websiteMeta, websiteSchema } from '../seo';
import azCopy from '../copy/az.json';
import kaCopy from '../copy/ka.json';
import type { WebsiteBoot, WebsiteCopy } from '../model';
import { NAMES_COPY, NAMES_ENABLED, azDistinctSlug, azOrdinal, azPlainSlug, letterSlug, similarNames, buildNamesIndex } from './names';
import { namesIndex } from './tool-data';
import { toolSitemapEntries } from './tool-routes';
import { estimateDekret, formatAzn, leaveDays, DekretInputError } from './dekret';
import { answerText } from './dekret-copy';
import namesAz from './data/names-az.json';
import namesKa from './data/names-ka.json';

const boot = (language: 'az' | 'ka', path: string): WebsiteBoot => {
  const { route } = resolveWebsiteRoute(path);
  return { schema: 'anacan-website-boot-v1', route, copy: (language === 'az' ? azCopy : kaCopy) as WebsiteCopy, articles: [], generatedAt: '2026-11-10T00:00:00Z', basePath: '' };
};

describe('baby names slug and letter scheme', () => {
  it('folds Azerbaijani names like the site and keeps letters distinct', () => {
    expect(azPlainSlug('Adəm')).toBe('adem');
    expect(azPlainSlug('Şəbnəm')).toBe('sebnem');
    expect(azPlainSlug('İsgəndər')).toBe('isgender');
    expect(azDistinctSlug('Aidə')).toBe('aidae');
    expect(['C', 'Ç', 'E', 'Ə', 'S', 'Ş', 'G', 'Ğ', 'O', 'Ö', 'U', 'Ü', 'I', 'İ'].map(letter => letterSlug('az', letter)))
      .toEqual(['c', 'ch', 'e', 'ae', 's', 'sh', 'g', 'gh', 'o', 'oe', 'u', 'ue', 'ii', 'i']);
    expect(letterSlug('ka', 'ნ')).toBe('ნ');
  });
  it('gives two different names that fold to one slug distinct URLs', () => {
    const index = namesIndex('az')!;
    expect(index.bySlug.get('aida')?.name).toBe('Aida');
    expect(index.bySlug.get('aide')?.name).toBe('Aidə');
    expect(new Set(index.names.map(entry => entry.slug)).size).toBe(index.names.length);
    const row = (name: string) => ({ name, gender: 'girl' as const, popularity: 1, origin: '', meaning: 'x' });
    expect(buildNamesIndex('az', [row('Səvil'), row('Sevil'), row('Sevıl')]).names.map(entry => entry.slug)).toEqual(['saevil', 'sevil', 'seviil']);
  });
  it('only builds pages for names with a meaning and merges duplicate rows in the snapshot', () => {
    for (const rows of [namesAz, namesKa]) for (const row of rows) expect(row.meaning.trim()).not.toBe('');
    const deniz = namesAz.filter(row => row.name === 'Dəniz');
    expect(deniz).toHaveLength(1);
    expect(deniz[0].gender).toBe('unisex');
  });
  it('creates letter pages only for letters with at least five names', () => {
    for (const language of ['az', 'ka'] as const) {
      const index = namesIndex(language)!;
      for (const letter of index.letters) expect(letter.page).toBe(letter.count >= 5);
      const small = index.letters.find(letter => !letter.page);
      if (small) expect(resolveWebsiteRoute(`/${language}/${encodeURIComponent(NAMES_COPY[language]!.hubSlug)}/${encodeURIComponent(NAMES_COPY[language]!.letterSlug)}/${encodeURIComponent(small.slug)}/`).route.kind).toBe('notFound');
    }
    expect(resolveWebsiteRoute('/az/usaq-adlari/herf/a/').route).toMatchObject({ kind: 'namesLetter', slug: 'a' });
    expect(resolveWebsiteRoute('/az/usaq-adlari/herf/ae/').route).toMatchObject({ kind: 'namesLetter', slug: 'ae' });
  });
  it('writes Azerbaijani ordinals with vowel harmony', () => {
    expect([1, 3, 6, 9, 10, 12, 40, 100, 329].map(azOrdinal)).toEqual(['1-ci', '3-cü', '6-cı', '9-cu', '10-cu', '12-ci', '40-cı', '100-cü', '329-cu']);
  });
  it('suggests similar names of a compatible gender', () => {
    const index = namesIndex('az')!, entry = index.bySlug.get('adem')!;
    const similar = similarNames(index, entry);
    expect(similar.length).toBeGreaterThan(0);
    for (const other of similar) expect(other.gender === 'girl').toBe(false);
  });
});

describe('names language gating and routes', () => {
  it('publishes only the enabled languages', () => {
    expect(NAMES_ENABLED).toEqual(['az', 'ka']);
    expect(resolveWebsiteRoute('/az/usaq-adlari/').route.kind).toBe('names');
    expect(resolveWebsiteRoute('/az/usaq-adlari/qiz-adlari/').route).toMatchObject({ kind: 'namesGender', slug: 'girl' });
    expect(resolveWebsiteRoute('/az/usaq-adlari/oglan-adlari/').route).toMatchObject({ kind: 'namesGender', slug: 'boy' });
    expect(resolveWebsiteRoute('/az/usaq-adlari/adem/').route).toMatchObject({ kind: 'nameDetail', slug: 'adem' });
    expect(resolveWebsiteRoute('/az/usaq-adlari/adem').redirect).toBe('/az/usaq-adlari/adem/');
    expect(resolveWebsiteRoute('/az/usaq-adlari/yoxdur/').route.kind).toBe('notFound');
    const ka = sitePath('ka', 'names');
    expect(decodeURIComponent(ka)).toBe('/ka/ბავშვის-სახელები/');
    expect(resolveWebsiteRoute(ka).route.kind).toBe('names');
    expect(resolveWebsiteRoute(sitePath('ka', 'nameDetail', 'ნინო')).route).toMatchObject({ kind: 'nameDetail', slug: 'ნინო' });
  });
  it('answers 404 for disabled languages', () => {
    for (const language of ['tr', 'ru', 'kk', 'en', 'de']) {
      expect(resolveWebsiteRoute(`/${language}/usaq-adlari/`).route.kind).toBe('notFound');
      expect(resolveWebsiteRoute(`/${language}/${encodeURIComponent('ბავშვის-სახელები')}/`).route.kind).toBe('notFound');
      expect(() => sitePath(language as 'tr', 'names')).toThrow();
    }
    expect(resolveWebsiteRoute('/ka/usaq-adlari/').route.kind).toBe('notFound');
    expect(resolveWebsiteRoute('/en/dekret-pulu-kalkulyatoru/').route.kind).toBe('notFound');
  });
  it('links hreflang only between corresponding pages', () => {
    const hub = resolveWebsiteRoute('/az/usaq-adlari/').route;
    expect(alternateRoute(hub, 'ka')).toBe(sitePath('ka', 'names'));
    expect(alternateRoute(hub, 'tr')).toBeUndefined();
    const girls = resolveWebsiteRoute('/az/usaq-adlari/qiz-adlari/').route;
    expect(alternateRoute(girls, 'ka')).toBe(sitePath('ka', 'namesGender', 'girl'));
    const detail = resolveWebsiteRoute('/az/usaq-adlari/adem/').route;
    expect(alternateRoute(detail, 'ka')).toBeUndefined();
    const kaDetail = boot('ka', sitePath('ka', 'nameDetail', 'ნინო'));
    expect(websiteMeta(kaDetail).alternates.map(item => item.code)).toEqual(['ka', 'x-default']);
    expect(websiteMeta(boot('az', '/az/usaq-adlari/')).alternates.map(item => item.code)).toEqual(['az', 'ka', 'x-default']);
  });
  it('keeps titles within 60 characters and emits the expected JSON-LD', () => {
    for (const entry of toolSitemapEntries()) {
      const language = entry.language as 'az' | 'ka', meta = websiteMeta(boot(language, entry.path));
      expect(meta.title.length, meta.title).toBeLessThanOrEqual(60);
      expect(meta.title + meta.description).not.toContain('—');
      expect(meta.canonical).toBe('https://anacan.az' + entry.path);
    }
    const types = (path: string, language: 'az' | 'ka' = 'az') => (websiteSchema(boot(language, path))['@graph'] as Array<{ '@type': string }>).map(node => node['@type']);
    expect(types('/az/usaq-adlari/')).toEqual(expect.arrayContaining(['CollectionPage', 'ItemList', 'BreadcrumbList']));
    expect(types('/az/usaq-adlari/adem/')).toEqual(expect.arrayContaining(['WebPage', 'BreadcrumbList', 'FAQPage']));
    expect(types('/az/dekret-pulu-kalkulyatoru/')).toEqual(expect.arrayContaining(['WebApplication', 'BreadcrumbList', 'FAQPage']));
    expect(websiteMeta(boot('az', '/az/usaq-adlari/adem/')).title).toBe('Adəm adının mənası və mənşəyi | Anacan');
  });
  it('lists every tool page in the sitemap entries', () => {
    const entries = toolSitemapEntries();
    const count = (language: string) => entries.filter(entry => entry.language === language).length;
    const pages = (language: 'az' | 'ka') => 3 + namesIndex(language)!.letters.filter(letter => letter.page).length + namesIndex(language)!.names.length;
    expect(count('az')).toBe(pages('az') + 1);
    expect(count('ka')).toBe(pages('ka'));
    expect(entries.find(entry => entry.path === '/az/usaq-adlari/')!.alternates.map(item => item.code)).toEqual(['az', 'ka', 'x-default']);
  });
});

describe('dekret pulu calculator', () => {
  const rule = maternityRules.find(item => item.code === 'AZ')!;
  it('takes the leave days from maternityRules', () => {
    expect(leaveDays(rule, 'normal')).toEqual({ before: rule.normalDaysBefore, after: rule.normalDaysAfter, total: rule.normalDaysBefore + rule.normalDaysAfter });
    expect(leaveDays(rule, 'complicated')).toEqual({ before: rule.normalDaysBefore, after: rule.complicatedDaysAfter, total: rule.normalDaysBefore + rule.complicatedDaysAfter });
    // Labour Code 125.1: two or more children get the same 70 days after birth as a complicated birth.
    expect(leaveDays(rule, 'multiple')).toEqual(leaveDays(rule, 'complicated'));
    expect(leaveDays(rule, 'normal').total).toBe(126);
    expect(leaveDays(rule, 'complicated').total).toBe(140);
  });
  it('computes 100% of the average daily salary for each birth type', () => {
    const normal = estimateDekret(rule, { salary: 1000, type: 'normal', dueDate: '2027-03-01' });
    expect(normal).toMatchObject({ daily: 32.88, benefit: 4142.47, total: 126, start: '2026-12-21', end: '2027-04-25', returnDate: '2027-04-26' });
    expect(estimateDekret(rule, { salary: 1000, type: 'complicated' })).toMatchObject({ total: 140, benefit: 4602.74 });
    expect(estimateDekret(rule, { salary: 1000, type: 'multiple' })).toMatchObject({ total: 140, benefit: 4602.74 });
    expect(estimateDekret(rule, { salary: 730, type: 'normal' }).benefit).toBe(3024);
    expect(formatAzn(4142.47)).toBe('4 142,47');
    expect(() => estimateDekret(rule, { salary: 0, type: 'normal' })).toThrow(DekretInputError);
    expect(() => estimateDekret(rule, { salary: 1000, type: 'normal', dueDate: '2027-02-30' })).toThrow(DekretInputError);
    expect(answerText(rule)).toContain('126 təqvim günüdür');
  });
});
