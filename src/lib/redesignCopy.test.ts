import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { APP_LANGUAGE_CODES } from './app-languages';

type Sections = Record<'redesign' | 'aptek' | 'babycare', Record<string, string>>;
const files: Record<string, Sections> = Object.fromEntries(APP_LANGUAGE_CODES.map((code) => {
  try { return [code, JSON.parse(readFileSync(`scripts/i18n/copy/${code}.json`, 'utf8'))]; } catch { return [code, undefined]; }
}));
const section = (name: keyof Sections) => Object.fromEntries(Object.entries(files).map(([code, f]) => [code, f?.[name]])) as Record<string, Record<string, string>>;

const placeholders = (text: string) => [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort();
const BRANDS = ['Anacan', 'ANACAN10'];

describe.each([
  ['redesign', section('redesign')],
  ['aptek', section('aptek')],
  ['babycare', section('babycare')],
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
