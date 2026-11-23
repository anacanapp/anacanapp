import { describe, expect, it } from 'vitest';
import { campaignDiscount, campaignReturnPage } from '../../supabase/functions/_shared/dodo-campaign';

const window = { starts_at: '2026-11-23T04:00:00Z', ends_at: '2026-11-30T19:59:59Z' };
const now = Date.parse('2026-11-25T10:00:00Z');

describe('dodo campaign discount', () => {
  it('Mərcan Cümə: a code per plan inside the window', () => {
    const c = { campaign: 'mercan', codes: { yearly: 'MERCAN', monthly: 'MERCANAY' }, ...window };
    expect(campaignDiscount(c, 'mercan', 'yearly', now)).toBe('MERCAN');
    expect(campaignDiscount(c, 'mercan', 'monthly', now)).toBe('MERCANAY');
    expect(campaignDiscount(c, '1111', 'yearly', now)).toBeNull();
    expect(campaignDiscount(c, 'mercan', 'yearly', Date.parse('2026-11-30T20:00:00Z'))).toBeNull();
    expect(campaignDiscount(c, 'mercan', 'yearly', Date.parse('2026-11-23T03:00:00Z'))).toBeNull();
    expect(campaignDiscount({ ...c, codes: { yearly: 'x' } }, 'mercan', 'yearly', now)).toBeNull();
  });

  it('keeps the 11.11 shape (one code, one plan)', () => {
    const c = { code: '1111', plan: 'yearly', ...window };
    expect(campaignDiscount(c, '1111', 'yearly', now)).toBe('1111');
    expect(campaignDiscount(c, '1111', 'monthly', now)).toBeNull();
    expect(campaignDiscount(null, '1111', 'yearly', now)).toBeNull();
    expect(campaignDiscount('x', '1111', 'yearly', now)).toBeNull();
  });

  it('returns only to an anacan.az campaign page', () => {
    expect(campaignReturnPage('https://anacan.az/website/premium/mercan/index.html')).toBe('https://anacan.az/website/premium/mercan/index.html');
    expect(campaignReturnPage('https://evil.example/website/premium/mercan/index.html')).toBeNull();
    expect(campaignReturnPage('https://anacan.az/website/premium/mercan/index.html?x=1')).toBeNull();
    expect(campaignReturnPage(undefined)).toBeNull();
  });
});
