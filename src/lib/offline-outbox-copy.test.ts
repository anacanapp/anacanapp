import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/tr', () => ({ tr: (_k: string, fallback: string) => fallback }));

import { APP_LANGUAGE_CODES } from './app-languages';
import { OFFLINE_OUTBOX_COPY } from './offline-outbox-copy';

const file = (lang: string) => (['az', 'en'].includes(lang)
  ? resolve(process.cwd(), `src/locales/${lang}.json`) : resolve(process.cwd(), `scripts/i18n/${lang}.seed.json`));

describe('offline save copy in every app language', () => {
  it('covers all 25 app languages', () => {
    expect(APP_LANGUAGE_CODES).toHaveLength(25);
  });

  it.each(APP_LANGUAGE_CODES)('%s has every offline save string', (lang) => {
    const dict = JSON.parse(readFileSync(file(lang), 'utf8')) as Record<string, string>;
    for (const [key, az] of Object.entries(OFFLINE_OUTBOX_COPY)) {
      const value = dict[key];
      expect(typeof value === 'string' && value.trim().length > 0, `${lang}:${key}`).toBe(true);
      expect(value, `${lang}:${key}`).not.toMatch(/[–—]/);
      if (lang === 'az') expect(value, key).toBe(az);
      else if (lang !== 'en') expect(value, `${lang}:${key} translated`).not.toBe(az);
    }
  });
});
