import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { APP_LANGUAGE_CODES } from '@/lib/app-languages';
import { RECAP_COPY } from './copy';

const file = (lang: string) => (['az', 'en'].includes(lang)
  ? resolve(process.cwd(), `src/locales/${lang}.json`) : resolve(process.cwd(), `scripts/i18n/${lang}.seed.json`));
const placeholders = (text: string) => (text.match(/\{\w+\}/g) || []).sort();

describe('Anacan Recap copy in every app language', () => {
  it('covers all 23 app languages', () => {
    expect(APP_LANGUAGE_CODES).toHaveLength(23);
  });

  it('uses only known copy keys in the sources (computed persona keys included)', () => {
    const sources = ['lib/recap/model.ts', 'components/recap/RecapScreen.tsx', 'components/recap/RecapEntry.tsx']
      .map((p) => readFileSync(resolve(process.cwd(), 'src', p), 'utf8')).join('\n');
    const used = [...sources.matchAll(/'(recap_[a-z0-9_]+)'/g)].map((m) => m[1])
      .filter((k) => !['recap_opened', 'recap_completed', 'recap_exported', 'recap_shared'].includes(k));
    expect(used.filter((k) => !(k in RECAP_COPY))).toEqual([]);
    for (const p of ['night', 'planner', 'knowledge', 'community', 'caring']) {
      expect(`recap_persona_${p}` in RECAP_COPY).toBe(true);
      expect(`recap_persona_${p}_why` in RECAP_COPY).toBe(true);
    }
  });

  it.each(APP_LANGUAGE_CODES)('%s has every string, the same placeholders and the untranslated brand', (lang) => {
    const dict = JSON.parse(readFileSync(file(lang), 'utf8')) as Record<string, string>;
    const missing: string[] = [];
    for (const [key, az] of Object.entries(RECAP_COPY)) {
      const value = dict[key];
      if (typeof value !== 'string' || !value.trim()) { missing.push(key); continue; }
      expect(placeholders(value), `${lang}:${key}`).toEqual(placeholders(az));
      if (az.includes('Anacan')) expect(value, `${lang}:${key}`).toContain('Anacan');
      if (lang !== 'az' && key !== 'recap_growth_gain' && !['recap_share', 'recap_pause'].includes(key)) {
        // Translated, not copied from Azerbaijani (short brand-only strings excepted).
        if (/[əğış]/i.test(az) && lang !== 'tr') expect(value, `${lang}:${key}`).not.toBe(az);
      }
    }
    expect(missing).toEqual([]);
    if (lang === 'az') for (const [key, az] of Object.entries(RECAP_COPY)) expect(dict[key], key).toBe(az);
  });
});
