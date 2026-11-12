// The Deno edge helpers read Deno.env only inside functions these tests don't call.
declare global { const Deno: { env: { get(name: string): string | undefined } } }
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// Deno helpers; Deno.env is only touched inside epointConfig(), so these import cleanly under Node.
import { decodeData, encodeData, epointAmount, isCheckoutUrl, sign, verify } from '../../supabase/functions/_shared/epoint';
import {
  callbackKeys, campaignView, cardFields, chargeOutcome, discountPct, findSubscriptionCallback, perMonth, periodEnd,
  renewalRetry, rpcErrorCode, sameAmount,
} from '../../supabase/functions/_shared/web-premium-subscription';
import { webPremiumEmailCopy } from '../../supabase/functions/_shared/web-premium-email';

describe('Epoint encoding and signature', () => {
  it('encodes UTF-8 JSON as base64 and signs base64(sha1(key + data + key))', async () => {
    const data = encodeData({ public_key: 'i000', description: 'Anacan Premium — illik abunəlik', amount: '24.99' });
    expect(decodeData(data)).toEqual({ public_key: 'i000', description: 'Anacan Premium — illik abunəlik', amount: '24.99' });
    const expected = createHash('sha1').update('secret' + data + 'secret', 'utf8').digest('base64');
    expect(await sign(data, 'secret')).toBe(expected);
    expect(await verify(data, expected, 'secret')).toBe(true);
    expect(await verify(data, expected, 'other')).toBe(false);
    expect(decodeData('not-base64!')).toBeNull();
  });

  it('formats amounts with two decimals', () => {
    expect([24.99, 4.99, 5, 0.1 + 0.2].map(epointAmount)).toEqual(['24.99', '4.99', '5.00', '0.30']);
  });

  it('accepts the bank page with the explicit :443 port only', () => {
    expect(isCheckoutUrl('https://ecomm.pashabank.az:443/ecomm2/ClientHandler?trans_id=abc')).toBe(true);
    expect(isCheckoutUrl('https://ecomm.pashabank.az/ecomm2/ClientHandler?trans_id=abc')).toBe(true);
    expect(isCheckoutUrl('https://epoint.az/pay/1')).toBe(true);
    expect(isCheckoutUrl('https://ecomm.pashabank.az:8443/x')).toBe(false);
    expect(isCheckoutUrl('http://ecomm.pashabank.az/x')).toBe(false);
    expect(isCheckoutUrl('https://evil.example.com/x')).toBe(false);
    expect(isCheckoutUrl('https://user:pw@ecomm.pashabank.az/x')).toBe(false);
    expect(isCheckoutUrl('https://ecomm.pashabank.az:443@evil.com/')).toBe(false);
  });
});

describe('callback classification', () => {
  const order = '0f8fad5b-d9cb-469f-a165-70867728950e';
  it('reads order_id and card_id defensively', () => {
    expect(callbackKeys({ order_id: order.toUpperCase(), card_id: 'abc123' })).toEqual({ orderId: order, cardId: 'abc123' });
    expect(callbackKeys({ order_id: 'x; drop', card_id: '../../etc' })).toEqual({ orderId: null, cardId: null });
    expect(callbackKeys({})).toEqual({ orderId: null, cardId: null });
  });

  function fakeAdmin(tables: Record<string, Record<string, unknown>[]>, chargeForCard: string | null = null) {
    return {
      from: (table: string) => {
        const filters: [string, unknown][] = [];
        const query = {
          select: () => query,
          eq: (column: string, value: unknown) => { filters.push([column, value]); return query; },
          maybeSingle: async () => ({ data: (tables[table] ?? []).find(row => filters.every(([c, v]) => row[c] === v)) ?? null }),
        };
        return query;
      },
      rpc: async () => ({ data: chargeForCard }),
    };
  }

  it('dispatches charges by order_id and card registrations by card_id', async () => {
    const admin = fakeAdmin({ web_premium_charges: [{ id: order }], epoint_saved_cards: [{ card_id: 'C1', purpose: 'add_card' }, { card_id: 'C2', purpose: 'subscribe' }] }, order);
    expect(await findSubscriptionCallback(admin, { order_id: order, status: 'success' })).toEqual({ kind: 'charge', chargeId: order });
    expect(await findSubscriptionCallback(admin, { card_id: 'C1', status: 'success' })).toEqual({ kind: 'card', cardId: 'C1' });
    // card-registration-with-pay callback without order_id → its pending initial charge
    expect(await findSubscriptionCallback(admin, { card_id: 'C2', status: 'success' })).toEqual({ kind: 'charge', chargeId: order });
  });

  it('leaves book, cake, funnel and app orders to the other branches', async () => {
    const admin = fakeAdmin({ web_premium_charges: [], epoint_saved_cards: [{ card_id: 'C1', purpose: 'add_card' }] });
    expect(await findSubscriptionCallback(admin, { order_id: '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed', status: 'success' })).toBeNull();
    expect(await findSubscriptionCallback(admin, { order_id: 'APP-ORDER-1', transaction: 'T1' })).toBeNull();
    // An unknown order with a card_id never falls back to the card (it belongs to another flow).
    expect(await findSubscriptionCallback(admin, { order_id: '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed', card_id: 'C1' })).toBeNull();
    expect(await findSubscriptionCallback(admin, { card_id: 'UNKNOWN' })).toBeNull();
  });

  it('maps provider states and keeps only display card fields', () => {
    expect(['success', 'failed', 'error', 'returned', 'new', 'processing', undefined].map(chargeOutcome))
      .toEqual(['paid', 'failed', 'failed', 'failed', 'pending', 'pending', 'pending']);
    expect(cardFields({ card_mask: '416973******1234', card_name: 'VISA <b>', card_expiry: '12 / 29', card_id: 'secret' }))
      .toEqual({ mask: '416973******1234', name: 'VISA b', expiry: '12/29' });
    expect(cardFields({})).toEqual({ mask: null, name: null, expiry: null });
    expect(sameAmount('24.99', 24.99)).toBe(true);
    expect(sameAmount('24.98', 24.99)).toBe(false);
    expect(sameAmount(undefined, 24.99)).toBe(false);
  });
});

describe('prices and periods', () => {
  it('shows the approved campaign discounts', () => {
    expect(discountPct(24.99, 50.98)).toBe(51);
    expect(discountPct(4.99, 6.78)).toBe(26);
    expect(discountPct(4.99, null)).toBeNull();
    expect(discountPct(4.99, 4.99)).toBeNull();
    expect(perMonth(24.99)).toBe(2.08);
    const view = campaignView({ active: true, ends_at: '2026-11-08T19:59:59+00:00',
      plans: { monthly: { price: 4.99, was: 6.78 }, yearly: { price: 24.99, was: 50.98 } } });
    expect(view.plans).toEqual({ monthly: { price: 4.99, was: 6.78, pct: 26 }, yearly: { price: 24.99, was: 50.98, pct: 51, per_month: 2.08 } });
    expect(campaignView({ active: false }).plans).toBeNull();
  });

  it('adds calendar months like PostgreSQL intervals', () => {
    expect(periodEnd(new Date('2026-11-07T10:00:00Z'), 'monthly').toISOString()).toBe('2026-12-07T10:00:00.000Z');
    expect(periodEnd(new Date('2027-01-31T10:00:00Z'), 'monthly').toISOString()).toBe('2027-02-28T10:00:00.000Z');
    expect(periodEnd(new Date('2028-01-31T10:00:00Z'), 'monthly').toISOString()).toBe('2028-02-29T10:00:00.000Z');
    expect(periodEnd(new Date('2028-02-29T10:00:00Z'), 'yearly').toISOString()).toBe('2029-02-28T10:00:00.000Z');
  });

  it('retries a failed renewal twice, 24 hours apart, then expires', () => {
    const now = Date.parse('2026-12-06T09:00:00Z');
    expect(renewalRetry(1, now).nextChargeAt?.toISOString()).toBe('2026-12-07T09:00:00.000Z');
    expect(renewalRetry(2, now).expire).toBe(false);
    expect(renewalRetry(3, now)).toEqual({ expire: true, nextChargeAt: null });
  });

  it('maps database refusals to page codes', () => {
    expect(rpcErrorCode({ message: 'WEB_PREMIUM_ALREADY_SUBSCRIBED' })).toBe('already_subscribed');
    expect(rpcErrorCode({ message: 'P0001: WEB_PREMIUM_CARD_NEEDED' })).toBe('card_needed');
    expect(rpcErrorCode({ message: 'connection reset' })).toBeNull();
    expect(rpcErrorCode(null)).toBeNull();
  });

  it('says in every e-mail that the subscription renews or how it ends', () => {
    expect(webPremiumEmailCopy('receipt', { plan: 'yearly', amount: 24.99, periodEnd: '2027-11-07T10:00:00Z' }).body).toContain('24,99 ₼');
    expect(webPremiumEmailCopy('cancelled', { plan: 'monthly', amount: 4.99 }).body).toContain('Yeni ödəniş alınmayacaq');
  });
});

describe('migration contract', () => {
  const sql = readFileSync('supabase/migrations/20261107090000_web_premium_subscriptions.sql', 'utf8');
  const manifest = JSON.parse(readFileSync('supabase/migrations/20261107090000_web_premium_subscriptions.cdc.json', 'utf8'));
  it('enrolls every new relation with CDC and the writer guard', () => {
    const created = [...sql.matchAll(/CREATE TABLE IF NOT EXISTS public\.(\w+)/g)].map(m => m[1]);
    expect(created).toEqual(['epoint_saved_cards', 'web_premium_subscriptions', 'web_premium_charges']);
    for (const table of created) {
      expect(sql).toContain(`'${table}'`);
      expect(manifest.relations.some((r: { relation: string; change: string; cdc: boolean; writer_guard: boolean }) =>
        r.relation === `public.${table}` && r.change === 'created' && r.cdc && r.writer_guard)).toBe(true);
    }
    expect(sql).toMatch(/<> 9 THEN\s+RAISE EXCEPTION 'WEB_PREMIUM_SUBSCRIPTIONS_GUARD_ENROLLMENT_INCOMPLETE'/);
    expect(sql).toContain('REVOKE ALL ON public.epoint_saved_cards, public.web_premium_subscriptions, public.web_premium_charges FROM PUBLIC, anon, authenticated');
  });
  it('stores the approved campaign prices server-side', () => {
    expect(sql).toContain('"monthly": {"price": 4.99, "was": 6.78}, "yearly": {"price": 24.99, "was": 50.98}');
  });
});

export {};

describe('standard offer view', () => {
  it('marks the standard price and the campaign', async () => {
    const { offerView } = await import('../../supabase/functions/_shared/web-premium-subscription.ts');
    const standard = offerView({ active: true, kind: 'standard', name: 'standard', plans: { monthly: { price: 3.99, was: null }, yearly: { price: 26.99, was: null } } });
    expect(standard).toMatchObject({ active: true, kind: 'standard', plans: { yearly: { price: 26.99, per_month: 2.24, pct: null }, monthly: { price: 3.99 } } });
    expect(offerView({ active: true, name: '1111', plans: { monthly: { price: 3.99, was: null }, yearly: { price: 18.89, was: 50.98 } } }).kind).toBe('campaign');
    expect(offerView(null)).toMatchObject({ active: false, kind: null, plans: null });
  });
});
