import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const LANGS = ['az', 'en', 'tr', 'ru', 'de', 'ar', 'ka', 'kk', 'uz', 'zh', 'id', 'fr', 'es', 'pt', 'vi', 'hi', 'ja', 'ko', 'pl', 'nl', 'sv', 'ky', 'et', 'tk', 'uk'];
const file = (lang: string) => resolve(__dirname, lang === 'az' || lang === 'en' ? `../locales/${lang}.json` : `../../scripts/i18n/${lang}.seed.json`);
const dicts: Record<string, Record<string, string>> = Object.fromEntries(LANGS.map((lang) => [lang, JSON.parse(readFileSync(file(lang), 'utf8'))]));
const state = vi.hoisted(() => ({ lang: 'ru' }));
vi.mock('./tr', () => ({
  getPersistedLanguage: () => state.lang,
  tr: (key: string, fallback: string) => dicts[state.lang]?.[key] ?? fallback,
  formatTr: (key: string, fallback: string, values: Record<string, unknown>) =>
    (dicts[state.lang]?.[key] ?? fallback).replace(/\{(\w+)\}/g, (m, name) => (name in values ? String(values[name]) : m)),
}));

import { formatCount, trimesterOrdinal, weekOrdinal } from './count-plural';

afterEach(() => { state.lang = 'ru'; });

const NEW_KEYS = [
  'ordinal_week_label', 'ordinal_trimester_label',
  ...['one', 'few', 'many', 'other'].flatMap((c) => [`count_articles_${c}`, `count_records_${c}`]),
  'toolshub_tool_opens_from_week', 'toolshub_tile_from_week', 'toolshub_tile_other_stage', 'consent_save_failed', 'consent_retry',
  'weighttracker_trend_up', 'weighttracker_trend_down', 'weighttracker_trend_stable', 'weighttracker_ai_prompt_change',
  'weighttracker_ai_context_pregnant_unknown', 'weighttracker_ai_context_cycle', 'weighttracker_ai_context_postpartum',
  'weighttracker_eyebrow_postpartum', 'weighttracker_week_unknown', 'weighttracker_bmi_label', 'weighttracker_bmi_now',
  'weighttracker_height_for_bmi', 'weighttracker_postpartum_note',
];

describe('counted nouns', () => {
  it('pluralizes Russian correctly (no "93 статей", no truncated "запис.")', () => {
    expect(formatCount('count_articles', 93)).toBe('93 статьи');
    expect(formatCount('count_articles', 1)).toBe('1 статья');
    expect(formatCount('count_articles', 11)).toBe('11 статей');
    expect(formatCount('count_articles', 25)).toBe('25 статей');
    expect(formatCount('count_records', 1)).toBe('1 запись');
    expect(formatCount('count_records', 3)).toBe('3 записи');
    expect(formatCount('count_records', 12)).toBe('12 записей');
  });
  it('uses the other inflecting languages\' forms', () => {
    const inLang = (lang: string, noun: 'count_articles' | 'count_records', n: number) => { state.lang = lang; return formatCount(noun, n); };
    expect(inLang('en', 'count_articles', 1)).toBe('1 article');
    expect(inLang('en', 'count_articles', 2)).toBe('2 articles');
    expect(inLang('pl', 'count_records', 22)).toBe('22 wpisy');
    expect(inLang('pl', 'count_records', 25)).toBe('25 wpisów');
    expect(inLang('uk', 'count_articles', 21)).toBe('21 стаття');
    expect(inLang('fr', 'count_articles', 0)).toBe('0 article');
    expect(inLang('az', 'count_records', 5)).toBe('5 qeyd');
  });
});

describe('ordinals', () => {
  it('reads naturally per language', () => {
    expect(weekOrdinal(19)).toBe('19-я неделя');
    expect(trimesterOrdinal(2)).toBe('2-й триместр');
    state.lang = 'en';
    expect(weekOrdinal(19)).toBe('Week 19');
    state.lang = 'az';
    expect(weekOrdinal(19)).toBe('19. həftə');
  });
});

describe('new keys exist in all 25 app languages', () => {
  it('has every key with the same placeholders and no long dashes', () => {
    const placeholders = (text: string) => (text.match(/\{\w+\}/g) || []).sort().join(',');
    for (const key of NEW_KEYS) {
      for (const lang of LANGS) {
        const value = dicts[lang][key];
        expect(typeof value === 'string' && value.trim().length > 0, `${lang}:${key}`).toBe(true);
        expect(placeholders(value), `${lang}:${key}`).toBe(placeholders(dicts.az[key]));
        expect(value, `${lang}:${key}`).not.toMatch(/[—–]/);
      }
    }
  });
});
