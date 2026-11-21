import { describe, expect, it } from 'vitest';
import { promoLink, validateDraft } from './AdminPromoQr';

const base = { code: 'EXPO-26', title: 'Expo', duration: 'monthly' as const, eligibility: 'new_users' as const, new_user_days: '7', max_uses: '',
  starts_at: '2026-11-21T10:00', ends_at: '', is_active: true, notes: '' };

describe('AdminPromoQr', () => {
  it('builds the printed link', () => expect(promoLink('EXPO-26')).toBe('https://app.anacan.az/h/EXPO-26'));
  it('validates the campaign form', () => {
    expect(validateDraft(base, true)).toBeNull();
    expect(validateDraft({ ...base, code: 'ab' }, true)).toMatch(/Kod/);
    expect(validateDraft({ ...base, code: '' }, false)).toBeNull();
    expect(validateDraft({ ...base, title: ' ' }, true)).toMatch(/adını/);
    expect(validateDraft({ ...base, new_user_days: '0' }, true)).toMatch(/1–90/);
    expect(validateDraft({ ...base, eligibility: 'everyone', new_user_days: '0' }, true)).toBeNull();
    expect(validateDraft({ ...base, max_uses: '-3' }, true)).toMatch(/Limit/);
    expect(validateDraft({ ...base, ends_at: '2026-11-20T10:00' }, true)).toMatch(/Bitmə/);
  });
});
