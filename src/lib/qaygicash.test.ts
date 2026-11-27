import { describe, expect, it } from 'vitest';
import {
  aptekEarnMinor, availableFrom, clampRedeem, earnPreview, formatQc, formatQcSigned, formatRate, hasQcActivity, historyStatusKey,
  historyTitleKey, historyTone, maxRedeemMinor, parseHistory, parseWallet, premiumEarnMinor, premiumRedeemOption, qcErrorCode, qcErrorKey,
  redeemLimits, toAzn, toMinor, type QcWallet,
} from './qaygicash';

const RAW = {
  enabled: true, status: 'live', country: 'AZ', currency: 'AZN',
  available_minor: 659, pending_minor: 108, expiring_30d_minor: 0, next_expiry_at: null, debt_minor: 0,
  rates: { premium_yearly: 500, premium_monthly: 300, book: 500, cake: 300, own_shop: 500, partner: 0, affiliate: 0 },
  hold_days_physical: 14, hold_days_digital: 7, expiry_months: 12, max_redeem_pct: 30, min_redeem_minor: 100,
  redeem_channels: ['aptek', 'cake', 'book'], terms_version: 1,
  premium_redeem: { enabled: false, monthly: { enabled: false, price_minor: 399 }, yearly: { enabled: false, price_minor: 2699 }, platforms: { ios: false, android: false, web: false } },
};
const wallet = (patch: Partial<QcWallet> = {}) => ({ ...(parseWallet(RAW) as QcWallet), ...patch });

describe('parseWallet', () => {
  it('hides the programme unless the server says enabled', () => {
    expect(parseWallet({ enabled: false })).toEqual({ enabled: false });
    expect(parseWallet(null)).toEqual({ enabled: false });
    expect(parseWallet('garbage')).toEqual({ enabled: false });
  });
  it('normalises the wallet (also JSON-encoded) and keeps only known spend channels', () => {
    const w = parseWallet(JSON.stringify({ ...RAW, redeem_channels: ['aptek', 'premium', 'cake'], available_minor: '659' })) as QcWallet;
    expect(w.enabled).toBe(true);
    expect(w.available_minor).toBe(659);
    expect(w.redeem_channels).toEqual(['aptek', 'cake']);
    expect(w.rates.own_shop).toBe(500);
    expect(w.premium_redeem.yearly).toEqual({ enabled: false, price_minor: 2699 });
  });
  it('treats an unknown status as live and a paused one as paused', () => {
    expect((parseWallet({ ...RAW, status: 'paused' }) as QcWallet).status).toBe('paused');
  });
});

describe('formatting', () => {
  it('shows minor units with comma decimals in Azerbaijani', () => {
    expect(formatQc(134, 'az')).toBe('1,34\u00a0₼');
    expect(formatQc(0, 'az')).toBe('0,00\u00a0₼');
    expect(formatQc(2699, 'az')).toBe('26,99\u00a0₼');
    expect(formatQc(134, 'en')).toBe('1.34\u00a0₼');
    expect(formatQcSigned(-150, 'az')).toBe('−1,50\u00a0₼');
    expect(formatQcSigned(108, 'az')).toBe('+1,08\u00a0₼');
  });
  it('formats basis points as a percentage', () => {
    expect(formatRate(500, 'en')).toBe('5%');
    expect(formatRate(250, 'en')).toBe('2.5%');
  });
  it('converts between AZN and minor units without float drift', () => {
    expect(toMinor(2.3)).toBe(230);
    expect(toMinor(0.1 + 0.2)).toBe(30);
    expect(toAzn(659)).toBe(6.59);
  });
});

describe('earning', () => {
  it('floors amount × rate (never more than the rate)', () => {
    expect(earnPreview(2699, 500)).toBe(134);
    expect(earnPreview(399, 300)).toBe(11);
    expect(earnPreview(1999, 500)).toBe(99);
    expect(earnPreview(1000, 0)).toBe(0);
    expect(earnPreview(-5, 500)).toBe(0);
    expect(earnPreview(1000, undefined)).toBe(0);
  });
  it('previews Premium on the fixed base', () => {
    expect(premiumEarnMinor(wallet(), 'yearly')).toBe(134);
    expect(premiumEarnMinor(wallet(), 'monthly')).toBe(11);
    expect(premiumEarnMinor({ enabled: false }, 'yearly')).toBe(0);
  });
  it('earns on Aptek only for own lines, on their share of what is paid', () => {
    const lines = [{ priceMinor: 1200, quantity: 2, own: true }, { priceMinor: 3290, quantity: 1, own: false }];
    // Nothing used: 2400 own of 5690 paid → 5% of 2400.
    expect(aptekEarnMinor(lines, 0, 0, 500)).toBe(120);
    // 6,59 ₼ bonus spread over all lines: own share = floor(2400 × 5031 / 5690) = 2122 → 106.
    expect(aptekEarnMinor(lines, 0, 659, 500)).toBe(106);
    expect(aptekEarnMinor([{ priceMinor: 3290, quantity: 1, own: false }], 0, 0, 500)).toBe(0);
    expect(aptekEarnMinor(lines, 0, 0, 0)).toBe(0);
  });
  it('dates the bonus by the hold days', () => {
    const now = new Date('2026-11-06T10:00:00Z');
    expect(availableFrom(14, now).toISOString()).toBe('2026-11-20T10:00:00.000Z');
  });
});

describe('spending limits', () => {
  it('caps at max % of goods and the available balance', () => {
    expect(maxRedeemMinor(5690, wallet())).toBe(659); // 30 % = 1707, balance 659
    expect(maxRedeemMinor(1000, wallet())).toBe(300);
    expect(maxRedeemMinor(1999, wallet())).toBe(599); // floor(599.7)
    expect(maxRedeemMinor(1000, { enabled: false })).toBe(0);
  });
  it('hides the switch when off, paused, closed or under the minimum balance', () => {
    expect(redeemLimits({ enabled: false }, 'aptek', 5000)).toMatchObject({ show: false });
    expect(redeemLimits(wallet({ status: 'paused' }), 'aptek', 5000)).toMatchObject({ show: false, block: 'paused' });
    expect(redeemLimits(wallet({ redeem_channels: ['cake'] }), 'aptek', 5000)).toMatchObject({ show: false, block: 'channel' });
    expect(redeemLimits(wallet({ available_minor: 99 }), 'aptek', 5000)).toMatchObject({ show: false, block: 'balance' });
  });
  it('marks a too-small order and gives the range otherwise', () => {
    expect(redeemLimits(wallet(), 'book', 300)).toMatchObject({ show: true, block: 'order', max: 0 }); // 30 % of 3 ₼ = 0,90 < 1 ₼
    expect(redeemLimits(wallet(), 'book', 400)).toEqual({ show: true, block: null, min: 100, max: 120 });
  });
  it('snaps to the 0,10 ₼ grid but always allows the exact max', () => {
    expect(clampRedeem(659, 100, 659)).toBe(659);
    expect(clampRedeem(5000, 100, 659)).toBe(659);
    expect(clampRedeem(10, 100, 659)).toBe(100);
    expect(clampRedeem(234, 100, 659)).toBe(230);
    expect(clampRedeem(300, 100, 50)).toBe(0);
  });
});

describe('premium with bonus', () => {
  it('is hidden by default', () => {
    expect(premiumRedeemOption(wallet(), 'yearly', 'ios')).toBeNull();
  });
  it('needs the programme switch, the plan switch and the platform', () => {
    const on = (platforms: Record<string, boolean>, yearly = true) => wallet({ premium_redeem: {
      enabled: true, monthly: { enabled: false, price_minor: 399 }, yearly: { enabled: yearly, price_minor: 2699 }, platforms } });
    expect(premiumRedeemOption(on({ ios: true }), 'yearly', 'ios')).toEqual({ price: 2699, affordable: false });
    expect(premiumRedeemOption(on({ ios: true }), 'yearly', 'android')).toBeNull();
    expect(premiumRedeemOption(on({ ios: true }), 'monthly', 'ios')).toBeNull();
    expect(premiumRedeemOption(on({ ios: true }, false), 'yearly', 'ios')).toBeNull();
    expect(premiumRedeemOption({ ...on({ web: true }), available_minor: 3000 }, 'yearly', 'web')).toEqual({ price: 2699, affordable: true });
    expect(premiumRedeemOption({ ...on({ web: true }), status: 'paused' }, 'yearly', 'web')).toBeNull();
  });
});

describe('errors and history', () => {
  it('maps server codes to copy keys', () => {
    expect(qcErrorCode({ message: 'QC_ABOVE_MAX' })).toBe('QC_ABOVE_MAX');
    expect(qcErrorCode({ error: 'premium_store_subscription_active' })).toBe('premium_store_subscription_active');
    expect(qcErrorCode({ message: 'APTEK_BAD_PHONE' })).toBeNull();
    expect(qcErrorKey('QC_INSUFFICIENT')).toBe('qc_err_insufficient');
    expect(qcErrorKey('QC_ORDER_NOT_ELIGIBLE')).toBe('qc_err_order_not_eligible');
    expect(qcErrorKey('premium_store_subscription_active')).toBe('qc_err_store_subscription');
    expect(qcErrorKey('grant_failed')).toBe('qc_err_generic');
    expect(qcErrorKey(null)).toBe('qc_err_generic');
  });
  it('colours rows by status', () => {
    expect(historyTone({ type: 'earn', status: 'pending' })).toBe('pending');
    expect(historyTone({ type: 'earn', status: 'available' })).toBe('available');
    expect(historyTone({ type: 'earn', status: 'expired' })).toBe('gone');
    expect(historyTone({ type: 'earn', status: 'reversed' })).toBe('gone');
    expect(historyTone({ type: 'redeem', status: 'committed' })).toBe('used');
    expect(historyTone({ type: 'redeem', status: 'reserved' })).toBe('used');
    expect(historyTone({ type: 'redeem', status: 'released' })).toBe('gone');
    expect(historyStatusKey({ type: 'redeem', status: 'released' })).toBe('qc_status_returned');
    expect(historyStatusKey({ type: 'earn', status: 'pending' })).toBe('qc_status_pending');
    expect(historyTitleKey({ type: 'earn', channel: 'own_shop' })).toBe('qc_hist_earn_own_shop');
    expect(historyTitleKey({ type: 'earn', channel: 'cake', source_type: 'adjust' })).toBe('qc_hist_earn_adjust');
    expect(historyTitleKey({ type: 'redeem', channel: 'premium' })).toBe('qc_hist_use_premium');
    expect(historyTitleKey({ type: 'redeem', channel: 'mystery' })).toBe('qc_hist_use_other');
  });
  it('parses the history and drops malformed rows', () => {
    const rows = parseHistory([{ id: 'l1', type: 'earn', channel: 'cake', amount_minor: 108, status: 'pending', at: '2026-11-01T00:00:00Z', available_at: '2026-11-15T00:00:00Z' },
      { type: 'other', at: 'x' }, { id: 'r1', type: 'redeem', channel: 'aptek', amount_minor: '150', status: 'committed', at: '2026-10-17T00:00:00Z' }]);
    expect(rows.map((r) => r.id)).toEqual(['l1', 'r1']);
    expect(rows[1].amount_minor).toBe(150);
  });
  it('knows whether there was any bonus activity', () => {
    expect(hasQcActivity(wallet())).toBe(true);
    expect(hasQcActivity(wallet({ available_minor: 0, pending_minor: 0 }))).toBe(false);
    expect(hasQcActivity({ enabled: false })).toBe(false);
  });
});
