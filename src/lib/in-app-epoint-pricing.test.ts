import { describe, expect, it } from 'vitest';
import { effectiveRate, parsePricing, resolveUsdPrices, roundAzn, serializePricing, usdToAzn, validatePricing } from './in-app-epoint-pricing';
import { bakuDate, cbarUrl, ensureUsdAznRate, fxRefreshDue, parseCbarUsd } from '../../supabase/functions/_shared/cbar';

const STORED = { default: { monthly: 3.99, yearly: 29.99 }, countries: { AZ: { monthly: 2.99, yearly: 19.99 }, GE: { yearly: 24.99 }, bad1: { monthly: 1 } },
  fallback_rate: 1.7, rounding: 'x99' };

describe('in-app Epoint USD pricing', () => {
  it('rounds like public._web_premium_round_azn (same values as the migration check and SQL test)', () => {
    expect(roundAzn(6.783)).toBe(6.99);
    expect(roundAzn(7.02)).toBe(6.99);
    expect(roundAzn(50.983)).toBe(50.99);
    expect(roundAzn(33.983)).toBe(33.99);
    expect(roundAzn(5.083)).toBe(4.99);
    expect(roundAzn(0.4)).toBe(0.99);
    expect(roundAzn(6.99)).toBe(6.99);
    expect(roundAzn(6.783, 'cents')).toBe(6.78);
    expect(roundAzn(3.99 * 1.7, 'cents')).toBe(6.78);
    expect(roundAzn(0)).toBeNull();
  });

  it('resolves per-country overrides plan by plan, else the default', () => {
    const p = parsePricing(JSON.stringify(STORED));
    expect(Object.keys(p.countries)).toEqual(['AZ', 'GE']);
    expect(resolveUsdPrices(p, 'az')).toEqual({ monthly: 2.99, yearly: 19.99, override: true });
    expect(resolveUsdPrices(p, 'GE')).toEqual({ monthly: 3.99, yearly: 24.99, override: true });
    expect(resolveUsdPrices(p, 'TR')).toEqual({ monthly: 3.99, yearly: 29.99, override: false });
    expect(resolveUsdPrices(p, null)).toEqual({ monthly: 3.99, yearly: 29.99, override: false });
  });

  it('converts at the cached CBAR rate, else the fallback; out-of-range values switch the price off', () => {
    const p = parsePricing(STORED);
    expect(effectiveRate({ rate: 1.7, date: '2026-11-25' }, p)).toEqual({ rate: 1.7, date: '2026-11-25', source: 'cbar' });
    expect(effectiveRate(null, p)).toEqual({ rate: 1.7, date: null, source: 'fallback' });
    expect(effectiveRate({ rate: 99 }, { ...p, fallbackRate: null })).toBeNull();
    expect(usdToAzn(19.99, 1.7, 'x99')).toBe(33.99);
    expect(usdToAzn(3.99, 1.7, 'cents')).toBe(6.78);
    expect(usdToAzn(0.1, 1.7, 'x99')).toBeNull();
    expect(usdToAzn(3.99, null, 'x99')).toBeNull();
  });

  it('validates the admin form and keeps the stored shape', () => {
    const p = parsePricing(STORED);
    expect(validatePricing(p)).toBeNull();
    expect(validatePricing({ ...p, default: { monthly: null, yearly: 29.99 } })).toMatch(/Default/);
    expect(validatePricing({ ...p, countries: { AZ: { monthly: 1000 } } })).toMatch(/AZ/);
    expect(validatePricing({ ...p, fallbackRate: 17 })).toMatch(/məzənnə/);
    expect(serializePricing(p)).toEqual({ default: { monthly: 3.99, yearly: 29.99 }, countries: { AZ: { monthly: 2.99, yearly: 19.99 }, GE: { yearly: 24.99 } },
      fallback_rate: 1.7, rounding: 'x99' });
  });
});

describe('CBAR rate (web-premium)', () => {
  const XML = `<?xml version="1.0" encoding="UTF-8"?><ValCurs Date="25.11.2026" Name="..."><ValType Type="Xarici valyutalar">
    <Valute Code="EUR"><Nominal>1</Nominal><Name>1 Avro</Name><Value>1.9634</Value></Valute>
    <Valute Code="USD"><Nominal>1</Nominal><Name>1 ABŞ dolları</Name><Value>1.7</Value></Valute>
    <Valute Code="JPY"><Nominal>100</Nominal><Name>100 Yapon yeni</Name><Value>1.1078</Value></Valute></ValType></ValCurs>`;

  it('builds the dated URL in Baku time and reads the USD value', () => {
    expect(bakuDate(Date.parse('2026-11-24T21:30:00Z'))).toBe('2026-11-25');
    expect(cbarUrl('2026-11-05')).toBe('https://www.cbar.az/currencies/05.11.2026.xml');
    expect(parseCbarUsd(XML)).toBe(1.7);
    expect(parseCbarUsd(XML.replace('<Value>1.7</Value>', '<Value>170</Value>'))).toBeNull();
    expect(parseCbarUsd('<html>maintenance</html>')).toBeNull();
  });

  it('refreshes at most once per day and retries at most hourly', () => {
    const now = Date.parse('2026-11-25T08:00:00Z');
    expect(fxRefreshDue({ rate: 1.7, date: '2026-11-25' }, now)).toBe(false);
    expect(fxRefreshDue({ rate: 1.7, date: '2026-11-24' }, now)).toBe(true);
    expect(fxRefreshDue({ rate: 1.7, date: '2026-11-24', last_attempt_at: '2026-11-25T07:30:00Z' }, now)).toBe(false);
    expect(fxRefreshDue(null, now)).toBe(true);
  });

  it('stores the fetched rate, or only the attempt when CBAR fails', async () => {
    const calls: Array<[string, Record<string, unknown>]> = [];
    const admin = {
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { value: JSON.stringify({ rate: 1.7, date: '2026-11-24' }) } }) }) }) }),
      rpc: async (name: string, args: Record<string, unknown>) => { calls.push([name, args]); return { error: null }; },
    };
    const now = Date.parse('2026-11-25T08:00:00Z');
    await ensureUsdAznRate(admin, (async () => new Response(XML, { status: 200 })) as unknown as typeof fetch, now);
    expect(calls[0]).toEqual(['web_premium_fx_store_v1', { p_rate: 1.7, p_date: '2026-11-25' }]);
    const error = console.error;
    console.error = () => {};
    await ensureUsdAznRate(admin, (async () => { throw new Error('blocked'); }) as unknown as typeof fetch, now);
    console.error = error;
    expect(calls[1]).toEqual(['web_premium_fx_store_v1', { p_rate: null, p_date: null }]);
  });
});
