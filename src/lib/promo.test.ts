import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: vi.fn(), functions: { invoke: vi.fn() } } }));
import { supabase } from '@/integrations/supabase/client';
import { clearPendingPromo, fetchPromoCampaign, FINAL_ERRORS, normalizePromoCode, promoCodeFromUrl, promoDurationLabel, promoErrorCode, promoErrorText,
  readPendingPromo, redeemPromo, savePendingPromo, PROMO_DURATIONS } from './promo';

const dir = join(__dirname, '../data/promo');
const az = JSON.parse(readFileSync(join(dir, 'az.json'), 'utf8')) as Record<string, string>;

describe('promo codes', () => {
  beforeEach(() => { localStorage.clear(); vi.mocked(supabase.functions.invoke).mockReset(); });

  it('normalizes and validates codes like the server', () => {
    expect(normalizePromoCode(' rossmann-2026 ')).toBe('ROSSMANN-2026');
    expect(normalizePromoCode('ab')).toBeNull();
    expect(normalizePromoCode('-ABC')).toBeNull();
    expect(normalizePromoCode('A'.repeat(33))).toBeNull();
    expect(normalizePromoCode("X'; drop")).toBeNull();
  });

  it('reads the code from web, universal and scheme links only on /h/', () => {
    expect(promoCodeFromUrl('https://app.anacan.az/h/expo26')).toBe('EXPO26');
    expect(promoCodeFromUrl('https://app.anacan.az/h/EXPO26/?utm=qr')).toBe('EXPO26');
    expect(promoCodeFromUrl('anacan://h/EXPO26')).toBe('EXPO26');
    expect(promoCodeFromUrl('https://app.anacan.az/tool/h/EXPO26')).toBeNull();
    expect(promoCodeFromUrl('https://app.anacan.az/blog/x')).toBeNull();
  });

  it('keeps a pending code for 30 days', () => {
    const now = Date.UTC(2026, 10, 21);
    expect(savePendingPromo('expo26', now)).toBe('EXPO26');
    expect(readPendingPromo(now + 29 * 86400_000)).toBe('EXPO26');
    expect(readPendingPromo(now + 31 * 86400_000)).toBeNull();
    expect(localStorage.length).toBe(0);
    savePendingPromo('EXPO26'); clearPendingPromo();
    expect(readPendingPromo()).toBeNull();
    expect(savePendingPromo('x')).toBeNull();
  });

  it('maps function results and errors', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({ data: { ok: true, duration: 'monthly', title: 'Expo', expires_at: '2026-12-21T00:00:00Z' }, error: null } as never);
    expect(await redeemPromo('EXPO26')).toEqual({ ok: true, duration: 'monthly', title: 'Expo', expires_at: '2026-12-21T00:00:00Z' });
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({ data: null, error: { context: { json: async () => ({ error: 'PROMO_ALREADY_USED' }) } } } as never);
    expect(await redeemPromo('EXPO26')).toEqual({ ok: false, code: 'PROMO_ALREADY_USED' });
    vi.mocked(supabase.functions.invoke).mockRejectedValueOnce(new Error('network'));
    expect(await redeemPromo('EXPO26')).toEqual({ ok: false, code: 'grant_failed' });
    expect(promoErrorCode({ message: 'x PROMO_NOT_NEW_USER y' })).toBe('PROMO_NOT_NEW_USER');
  });

  it('reads the public campaign card in the server shape', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: { state: 'not_found' }, error: null } as never);
    expect(await fetchPromoCampaign('NOPE-1')).toEqual({ state: 'not_found' });
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: { state: 'active', code: 'EXPO26', title: 'Expo', duration: 'monthly', eligibility: 'new_users', ends_at: null }, error: null } as never);
    expect((await fetchPromoCampaign('EXPO26')).state).toBe('active');
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: null, error: null } as never);
    expect(await fetchPromoCampaign('X-1')).toEqual({ state: 'not_found' });
  });

  it('retries only failures that can change', () => {
    expect(FINAL_ERRORS.has('grant_failed')).toBe(false);
    expect(FINAL_ERRORS.has('PROMO_IN_PROGRESS')).toBe(false);
    expect(FINAL_ERRORS.has('PROMO_NOT_STARTED')).toBe(false);
    expect(FINAL_ERRORS.has('PROMO_ALREADY_USED')).toBe(true);
  });

  it('has copy for every duration and error', () => {
    for (const d of PROMO_DURATIONS) expect(promoDurationLabel(az, d)).not.toBe(d);
    for (const code of ['PROMO_ALREADY_USED', 'PROMO_NOT_NEW_USER', 'PROMO_FULL', 'PROMO_EXPIRED', 'PROMO_NOT_FOUND', 'premium_store_subscription_active', 'grant_failed'] as const)
      expect(promoErrorText(az, code)).toBeTruthy();
  });
});

describe('promo copy files', () => {
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  it('ships all 25 app languages with the same keys and placeholders', () => {
    expect(files).toHaveLength(25);
    const keys = Object.keys(az).sort();
    for (const file of files) {
      const text = JSON.parse(readFileSync(join(dir, file), 'utf8')) as Record<string, string>;
      expect(Object.keys(text).sort(), file).toEqual(keys);
      for (const key of keys) {
        expect(text[key].trim(), `${file}:${key}`).not.toBe('');
        expect(text[key].match(/\{\w+\}/g)?.sort() ?? [], `${file}:${key}`).toEqual(az[key].match(/\{\w+\}/g)?.sort() ?? []);
      }
    }
  });
});
