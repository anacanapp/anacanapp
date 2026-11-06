import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/tr', () => ({ tr: (_k: string, fallback: string) => fallback, formatTr: (_k: string, fallback: string) => fallback }));

import { APP_LANGUAGE_CODES } from './app-languages';
import { QC_COPY } from './qaygicash-copy';

const file = (lang: string) => (['az', 'en'].includes(lang)
  ? resolve(process.cwd(), `src/locales/${lang}.json`) : resolve(process.cwd(), `scripts/i18n/${lang}.seed.json`));
const placeholders = (text: string) => (text.match(/\{\w+\}/g) || []).sort();

describe('QayğıCash copy in every app language', () => {
  it('covers all 23 app languages', () => {
    expect(APP_LANGUAGE_CODES).toHaveLength(23);
  });

  it('uses only known copy keys in the sources', () => {
    const sources = ['components/qaygicash/QaygiCashScreen.tsx', 'components/qaygicash/QcParts.tsx', 'components/qaygicash/QaygiCashHomeCard.tsx',
      'components/qaygicash/QaygiCashPremium.tsx', 'lib/qaygicash.ts', 'components/cakes/CakeOrderForm.tsx', 'components/ProfileScreen.tsx']
      .map((p) => readFileSync(resolve(process.cwd(), 'src', p), 'utf8')).join('\n');
    const used = [...sources.matchAll(/'(qc_[a-z0-9_]+)'/g)].map((m) => m[1])
      .filter((k) => !k.endsWith('_') && !['qc_wallet_view', 'qc_redeem_toggle', 'qc_redeem_commit', 'qc_premium_redeem'].includes(k));
    expect(used.filter((k) => !(k in QC_COPY))).toEqual([]);
    // Computed keys (history titles, rate labels) must exist too.
    for (const channel of ['premium_yearly', 'premium_monthly', 'book', 'cake', 'own_shop', 'adjust']) expect(`qc_hist_earn_${channel}` in QC_COPY).toBe(true);
    for (const channel of ['aptek', 'cake', 'book', 'premium', 'other']) expect(`qc_hist_use_${channel}` in QC_COPY).toBe(true);
    for (const channel of ['premium_yearly', 'premium_monthly', 'book', 'cake', 'own_shop', 'partner']) expect(`qc_rate_${channel}` in QC_COPY).toBe(true);
  });

  it.each(APP_LANGUAGE_CODES)('%s has every string, the same placeholders and the untranslated brand', (lang) => {
    const dict = JSON.parse(readFileSync(file(lang), 'utf8')) as Record<string, string>;
    const missing: string[] = [];
    for (const [key, az] of Object.entries(QC_COPY)) {
      const value = dict[key];
      if (typeof value !== 'string' || !value.trim()) { missing.push(key); continue; }
      expect(placeholders(value), `${lang}:${key}`).toEqual(placeholders(az));
      if (az.includes('QayğıCash')) expect(value, `${lang}:${key}`).toContain('QayğıCash');
    }
    expect(missing).toEqual([]);
    if (lang === 'az') for (const [key, az] of Object.entries(QC_COPY)) expect(dict[key], key).toBe(az);
  });
});
