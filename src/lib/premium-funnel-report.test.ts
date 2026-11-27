import { describe, expect, it } from 'vitest';
import { summariseBySource } from '@/lib/premium-funnel-report';
import { parseCountryList } from '@/lib/in-app-epoint-pricing';

describe('Premium funnel report', () => {
  const report = {
    funnel: [
      { event: 'paywall_shown', source: 'tool_ai', platform: 'android', country: 'AZ', life_stage: 'bump', count: 40 },
      { event: 'paywall_shown', source: 'tool_ai', platform: 'ios', country: 'TR', life_stage: 'mommy', count: 10 },
      { event: 'paywall_clicked', source: 'tool_ai', platform: 'android', country: 'AZ', life_stage: 'bump', count: 8 },
      { event: 'paywall_shown', source: 'onboarding', platform: 'android', country: 'AZ', life_stage: 'flow', count: 5 },
    ],
    intents: [{ source: 'tool_ai', platform: 'android', plan: 'yearly', count: 4, users: 3 }],
    purchases: [
      { source: 'tool_ai', provider: 'play_store', platform: 'android', plan: 'yearly', first_purchase: true, currency: 'USD', count: 2, amount: 59.98 },
      { source: 'renewal', provider: 'play_store', platform: 'android', plan: 'monthly', first_purchase: false, currency: 'USD', count: 9, amount: 35.91 },
      { source: 'unknown', provider: 'promo', platform: 'ios', plan: 'monthly', first_purchase: false, currency: null, count: 3, amount: null },
    ],
  };

  it('sums by placement, ignores renewals and promo, and computes conversion', () => {
    const all = summariseBySource(report, { platform: 'all', country: 'all', stage: 'all' });
    expect(all.map(s => s.source)).toEqual(['tool_ai', 'onboarding']);
    expect(all[0]).toMatchObject({ events: { paywall_shown: 50, paywall_clicked: 8 }, intents: 4, purchases: 2, firstPurchases: 2, conversion: 4 });
    expect(all[1].conversion).toBe(0);
  });

  it('filters the funnel by platform, country and stage', () => {
    expect(summariseBySource(report, { platform: 'ios', country: 'all', stage: 'all' })[0]).toMatchObject({ source: 'tool_ai', events: { paywall_shown: 10 }, purchases: 0 });
    expect(summariseBySource(report, { platform: 'all', country: 'AZ', stage: 'bump' })[0].events.paywall_shown).toBe(40);
  });

  it('parses the admin country list', () => {
    expect(parseCountryList('az, GE;tr  az')).toEqual({ countries: ['AZ', 'GE', 'TR'], invalid: [] });
    expect(parseCountryList('AZE, 1, AZ')).toEqual({ countries: ['AZ'], invalid: ['AZE', '1'] });
    expect(parseCountryList('')).toEqual({ countries: [], invalid: [] });
  });
});
