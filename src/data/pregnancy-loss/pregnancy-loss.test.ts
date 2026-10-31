import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { emergencyNumber, lossDays, lossPhase, lossWeek, type PregnancyLossText } from './index';

const dir = __dirname;
const languages = readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', ''));
const read = (lang: string) => JSON.parse(readFileSync(join(dir, `${lang}.json`), 'utf8')) as PregnancyLossText;
const az = read('az');

const shape = (value: unknown): unknown => Array.isArray(value)
  ? (typeof value[0] === 'string' ? ['strings', value.length] : value.map(shape))
  : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shape(v)])) : typeof value;

describe('pregnancy loss content', () => {
  it('has the same shape, placeholders and an emergency number in all 21 languages', () => {
    expect(languages.sort()).toEqual(['ar', 'az', 'de', 'en', 'es', 'fr', 'hi', 'id', 'ja', 'ka', 'kk', 'ko', 'nl', 'pl', 'pt', 'ru', 'sv', 'tr', 'uz', 'vi', 'zh']);
    for (const lang of languages) {
      const t = read(lang);
      expect(shape(t), lang).toEqual(shape(az));
      for (const [key, value] of Object.entries(az.ui)) {
        if (typeof value !== 'string') continue;
        const placeholders = (s: string) => (s.match(/\{\w+\}/g) || []).sort();
        expect(placeholders((t.ui as Record<string, unknown>)[key] as string), `${lang}.${key}`).toEqual(placeholders(value));
      }
      expect(emergencyNumber(t), lang).toMatch(/^\d{3}$/);
      expect(t.weeks).toHaveLength(8);
      expect(t.partner.phases).toHaveLength(4);
      expect(t.ui.moods).toHaveLength(5);
      expect(t.ui.mood_reply).toHaveLength(5);
    }
  });
});

describe('recovery weeks', () => {
  const at = (iso: string) => new Date(`${iso}T12:00:00`);
  it('counts weeks 1..8 from the loss date and ends after eight weeks', () => {
    expect(lossDays('2026-10-01', at('2026-10-01'))).toBe(0);
    expect(lossWeek('2026-10-01', at('2026-10-01'))).toBe(1);
    expect(lossWeek('2026-10-01', at('2026-10-07'))).toBe(1);
    expect(lossWeek('2026-10-01', at('2026-10-08'))).toBe(2);
    expect(lossWeek('2026-10-01', at('2026-11-25'))).toBe(8);
    expect(lossWeek('2026-10-01', at('2026-11-26'))).toBeNull();
    expect(lossWeek(null)).toBeNull();
    expect(lossWeek('not a date')).toBeNull();
  });
  it('groups weeks into four partner phases', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(lossPhase)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
  });
});
