import { describe, expect, it } from 'vitest';
import redesign from '../../scripts/i18n/redesign-copy.json';
import aptek from '../../scripts/i18n/aptek-copy.json';
import { APP_LANGUAGE_CODES } from './app-languages';

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const BRANDS = ['Anacan', 'ANACAN10'];

describe.each([
  ['redesign-copy.json', redesign.languages as Record<string, Record<string, string>>],
  ['aptek-copy.json', aptek.languages as Record<string, Record<string, string>>],
])('%s', (_file, languages) => {
  const reference = languages.en;

  it.each([...APP_LANGUAGE_CODES])('has every key for %s with the same placeholders', (code) => {
    const strings = languages[code];
    expect(strings, code).toBeDefined();
    for (const [key, en] of Object.entries(reference)) {
      const value = strings[key];
      expect(typeof value === 'string' && value.trim().length > 0, `${code}.${key}`).toBe(true);
      expect(placeholders(value), `${code}.${key}`).toEqual(placeholders(en));
    }
    expect(Object.keys(strings).filter((k) => !(k in reference)), `${code} extra keys`).toEqual([]);
  });

  it('keeps brand names untranslated', () => {
    for (const code of APP_LANGUAGE_CODES) {
      for (const [key, en] of Object.entries(reference)) {
        for (const brand of BRANDS) if (en.includes(brand)) expect(languages[code][key], `${code}.${key}`).toContain(brand);
      }
    }
  });
});
