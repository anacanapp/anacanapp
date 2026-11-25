import { describe, expect, it } from 'vitest';
import { TIKTOK_EVENT_MAP, tiktokProperties, logTikTokEvent } from './tiktok-events';

describe('tiktok-events', () => {
  it('maps only marketing/conversion events and never health records', () => {
    expect(TIKTOK_EVENT_MAP.sign_up).toBe('Registration');
    expect(TIKTOK_EVENT_MAP.premium_subscribed).toBe('Subscribe');
    expect(TIKTOK_EVENT_MAP.books_purchase_confirmed).toBe('Purchase');
    for (const health of ['weight_logged', 'mood_logged', 'symptom_logged', 'kick_session_completed', 'period_logged']) {
      expect(TIKTOK_EVENT_MAP[health]).toBeUndefined();
    }
    // premium_subscribed already carries the value; the paired generic purchase must not double count.
    expect(TIKTOK_EVENT_MAP.purchase).toBeUndefined();
  });

  it('sends value/currency for revenue events and no personal fields', () => {
    expect(tiktokProperties('premium_subscribed', { plan: 'yearly', price: 29.99, currency: 'USD', email: 'x@y.z' }))
      .toEqual({ value: 29.99, currency: 'USD', content_id: 'yearly', content_type: 'subscription' });
    expect(tiktokProperties('books_purchase_confirmed', { value: 12, currency: 'AZN', order_id: 'o1' }))
      .toEqual({ value: 12, currency: 'AZN', content_type: 'product' });
    expect(tiktokProperties('book_viewed', { book_id: 'b7', topic: 'sleep' })).toEqual({ content_id: 'b7', content_type: 'product' });
    expect(tiktokProperties('premium_subscribed', { price: 5, currency: 'usd' }).currency).toBe('USD');
    expect(tiktokProperties('name_searched', { query: 'Leyla' })).toEqual({});
  });

  it('is a silent no-op on web / without consent', async () => {
    await expect(logTikTokEvent('sign_up', {})).resolves.toBeUndefined();
  });
});
