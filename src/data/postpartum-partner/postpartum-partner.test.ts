import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { postpartumWeek, POSTPARTUM_WEEKS } from './index';

const dir = join(__dirname);
const languages = readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', ''));
const read = (lang: string) => JSON.parse(readFileSync(join(dir, `${lang}.json`), 'utf8'));
const shape = (x: unknown): unknown => Array.isArray(x) ? x.map(shape)
  : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, shape(v)])) : typeof x;
const strings = (x: unknown): string[] => Array.isArray(x) ? x.flatMap(strings)
  : x && typeof x === 'object' ? Object.values(x).flatMap(strings) : [x as string];

describe('postpartum partner guide', () => {
  it('has the same complete text in all 21 languages', () => {
    expect(languages).toHaveLength(21);
    const az = read('az');
    expect(az.weeks).toHaveLength(POSTPARTUM_WEEKS);
    for (const lang of languages) {
      const text = read(lang);
      expect(shape(text), lang).toEqual(shape(az));
      expect(strings(text).every((s) => s.trim().length > 0), lang).toBe(true);
      expect(text.ui.tasks_message, lang).toContain('{list}');
      expect(text.ui.mood_low_body, lang).toContain('{n}');
      // The urgent-sign result carries the local emergency number used by the call button.
      expect(text.ui.signs_urgent, lang).toMatch(/\b\d{3}\b/);
    }
  });

  it('maps the baby\'s age to weeks 1–8 and ends after 8 weeks', () => {
    expect(postpartumWeek(0)).toBe(1);
    expect(postpartumWeek(6)).toBe(1);
    expect(postpartumWeek(7)).toBe(2);
    expect(postpartumWeek(55)).toBe(8);
    expect(postpartumWeek(56)).toBeNull();
    expect(postpartumWeek(-1)).toBeNull();
  });
});
