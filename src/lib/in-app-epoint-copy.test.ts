import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/tr', () => ({ tr: (_k: string, fallback: string) => fallback, formatTr: (_k: string, fallback: string) => fallback }));

import { APP_LANGUAGE_CODES } from './app-languages';
import { IEP_COPY } from './in-app-epoint-copy';

const file = (lang: string) => (['az', 'en'].includes(lang)
  ? resolve(process.cwd(), `src/locales/${lang}.json`) : resolve(process.cwd(), `scripts/i18n/${lang}.seed.json`));
const placeholders = (text: string) => (text.match(/\{\w+\}/g) || []).sort();
const NAMES = ['Epoint', 'Premium', 'App Store', 'Google Play', 'anacan.az'];

describe('in-app Epoint copy in every app language', () => {
  it('covers all 25 app languages', () => expect(APP_LANGUAGE_CODES).toHaveLength(25));

  it('uses only known keys in the sources', () => {
    const sources = ['lib/in-app-epoint.ts', 'components/paywall/EpointPayOption.tsx']
      .map((p) => readFileSync(resolve(process.cwd(), 'src', p), 'utf8')).join('\n');
    const used = [...sources.matchAll(/'(iep_[a-z_]+)'/g)].map((m) => m[1]);
    expect(used.length).toBeGreaterThan(10);
    expect(used.filter((k) => !(k in IEP_COPY))).toEqual([]);
  });

  it.each(APP_LANGUAGE_CODES)('%s has every string, the same placeholders, the untranslated names and no long dashes', (lang) => {
    const dict = JSON.parse(readFileSync(file(lang), 'utf8')) as Record<string, string>;
    const missing: string[] = [];
    for (const [key, az] of Object.entries(IEP_COPY)) {
      const value = dict[key];
      if (typeof value !== 'string' || !value.trim()) { missing.push(key); continue; }
      expect(placeholders(value), `${lang}:${key}`).toEqual(placeholders(az));
      for (const name of NAMES) if (az.includes(name)) expect(value, `${lang}:${key}`).toContain(name);
      expect(value, `${lang}:${key}`).not.toMatch(/[—–]/);
      // Same text as Azerbaijani only where the languages genuinely agree (Turkish "{price} / ay").
      if (lang !== 'az' && value === az) expect(['tr:iep_price_monthly'], 'untranslated').toContain(`${lang}:${key}`);
    }
    expect(missing).toEqual([]);
    if (lang === 'az') for (const [key, az] of Object.entries(IEP_COPY)) expect(dict[key], key).toBe(az);
  });
});
