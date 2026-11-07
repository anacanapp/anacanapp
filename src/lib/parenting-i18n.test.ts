import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/tr', () => ({ tr: (_k: string, fallback: string) => fallback, formatTr: (_k: string, fallback: string) => fallback }));

import { APP_LANGUAGE_CODES } from './app-languages';
import { PARENTING_COPY } from './parenting-copy';

const file = (lang: string) => (['az', 'en'].includes(lang)
  ? resolve(process.cwd(), `src/locales/${lang}.json`) : resolve(process.cwd(), `scripts/i18n/${lang}.seed.json`));
const placeholders = (text: string) => (text.match(/\{\w+\}/g) || []).sort();

describe('Tərbiyə UI copy in every app language', () => {
  it('uses only the shared copy keys in the tool source', () => {
    const sources = ['components/tools/parenting/ParentingScreens.tsx', 'components/tools/parenting/ParentingTool.tsx', 'components/ToolsHub.tsx', 'lib/parenting-copy.ts',
      'components/tools/parenting/ParentingEntry.tsx', 'components/tools/parenting/useParentingReminders.ts', 'components/partner/v2/PartnerTogetherScreen.tsx']
      .map((p) => readFileSync(resolve(process.cwd(), 'src', p), 'utf8')).join('\n');
    const used = [...sources.matchAll(/'(par_[a-z0-9_]+)'/g)].map((m) => m[1]).filter((k) => !k.endsWith('_'));
    expect(used.filter((k) => !(k in PARENTING_COPY))).toEqual([]);
  });

  it.each(APP_LANGUAGE_CODES)('%s has every Tərbiyə string with the same placeholders', (lang) => {
    const dict = JSON.parse(readFileSync(file(lang), 'utf8')) as Record<string, string>;
    const missing: string[] = [];
    for (const [key, az] of Object.entries(PARENTING_COPY)) {
      const value = dict[key];
      if (typeof value !== 'string' || !value.trim()) { missing.push(key); continue; }
      expect(placeholders(value), `${lang}:${key}`).toEqual(placeholders(az));
      // Emergency numbers come from the country helper, never from the copy.
      expect(value, `${lang}:${key}`).not.toMatch(/(^|[^\d])(103|112|911|999)(?!\d)/);
    }
    expect(missing).toEqual([]);
    if (lang === 'az') for (const [key, az] of Object.entries(PARENTING_COPY)) expect(dict[key], key).toBe(az);
  });
});
