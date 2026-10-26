import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { APP_LANGUAGE_CODES } from '@/lib/app-languages';
import { getDefaultBillingConfig, getDefaultPaywallConfig, useBillingConfig, usePaywallConfig } from './usePaywallConfig';

const fixture = vi.hoisted(() => ({ language: 'az', seed: {} as Record<string, string>, overrides: {} as Record<string, string>, settings: {} as Record<string, any>, lookups: [] as string[] }));
vi.mock('@/hooks/useAppSettings', () => ({ useAppSetting: (key: string) => fixture.settings[key], useUpdateAppSetting: () => ({}) }));
vi.mock('@/store/userStore', () => ({ useUserStore: (select: (state: { language: string }) => unknown) => select({ language: fixture.language }) }));
vi.mock('@/lib/tr', () => ({ tr: (key: string, fallback: string) => { fixture.lookups.push(key); return fixture.seed[key] ?? fallback; } }));
vi.mock('@/lib/i18n', () => ({ getCachedTranslation: (key: string) => fixture.overrides[key] }));

beforeEach(() => { fixture.language = 'az'; fixture.seed = {}; fixture.overrides = {}; fixture.settings = {}; fixture.lookups = []; });
describe('localized Premium configuration', () => {
  it.each(APP_LANGUAGE_CODES)('does not replace %s copy with the live Azerbaijani admin configuration', language => {
    fixture.settings.premium_paywall_config = { ...getDefaultPaywallConfig(), subtitle: 'Tam təcrübə · Limitsiz imkanlar', gradient_from: '#123456', free_trial_enabled: true, free_trial_days: 14 };
    fixture.settings.billing_page_config = { ...getDefaultBillingConfig(), header_gradient_from: '#abcdef' };
    fixture.language = language;
    fixture.seed = JSON.parse(readFileSync(resolve(process.cwd(), language === 'az' || language === 'en' ? `src/locales/${language}.json` : `scripts/i18n/${language}.seed.json`), 'utf8'));
    fixture.lookups = [];
    const { result } = renderHook(() => ({ paywall: usePaywallConfig(), billing: useBillingConfig() }));
    const { paywall, billing } = result.current;
    expect(paywall.yearly_label).toBe(getDefaultPaywallConfig().yearly_label);
    expect(paywall.monthly_label).toBe(getDefaultPaywallConfig().monthly_label);
    expect(paywall.cancel_notice).toBe(getDefaultPaywallConfig().cancel_notice);
    expect(paywall.pills.map(p => p.text)).toEqual(getDefaultPaywallConfig().pills.map(p => p.text));
    expect(billing.features.map(p => p.text)).toEqual(getDefaultBillingConfig().features.map(p => p.text));
    expect(billing.free_plan_name).toBe(getDefaultBillingConfig().free_plan_name);
    if (language !== 'az') expect(paywall.subtitle).toBe(getDefaultPaywallConfig().subtitle);
    expect(paywall.gradient_from).toBe('#123456'); expect(billing.header_gradient_from).toBe('#abcdef');
    expect(paywall.free_trial_enabled).toBe(false); expect(paywall.free_trial_days).toBe(0);
    for (const key of new Set(fixture.lookups)) expect(fixture.seed[key], `${language}:${key}`).toBeTypeOf('string');
  });

  it('uses explicit translated admin copy and preserves deliberately empty labels', () => {
    fixture.language = 'fr'; fixture.overrides.paywallcfg_subtitle = 'Un message personnalisé';
    fixture.settings.premium_paywall_config = { subtitle: 'Xüsusi mətn', native_notice: '', pills: [{ icon: 'Heart', text: 'Xüsusi' }] };
    fixture.overrides.paywallcfg_pill_1 = 'Pour vous';
    const { result } = renderHook(usePaywallConfig);
    expect(result.current.subtitle).toBe('Un message personnalisé');
    expect(result.current.pills).toEqual([{ icon: 'Heart', text: 'Pour vous' }]);
    expect(result.current.native_notice).toBe('');
  });
});
