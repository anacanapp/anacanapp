import { describe, expect, it, vi } from 'vitest';
import { localizePremiumRows } from './premium-i18n';

vi.mock('@/lib/i18n', () => ({ getCachedTranslation: () => undefined }));
vi.mock('@/lib/content-i18n', () => ({ getBundledContentTranslation: () => undefined }));
const row = { id: '0591890c-70df-4ab3-a153-a0af339f386c', title: 'Blood Sugar Tracker', title_az: 'Qan Şəkəri', title_en: 'Blood Sugar Tracker' };

describe('public Premium source-bound copy', () => {
  it('provides Georgian and Kazakh labels without falling back to Russian or Azerbaijani', () => {
    expect(localizePremiumRows([row], 'ka', ['title'])[0].title).toMatch(/\p{Script=Georgian}/u);
    expect(localizePremiumRows([row], 'kk', ['title'])[0].title).toMatch(/\p{Script=Cyrillic}/u);
    expect(localizePremiumRows([row], 'uz', ['title'])[0].title).not.toBe(row.title);
  });
  it('preserves an explicit server translation', () => {
    expect(localizePremiumRows([{ ...row, title_ka: 'ოპერატორის სათაური' }], 'ka', ['title'])[0].title).toBe('ოპერატორის სათაური');
  });
  it('does not reuse a label after any part of its source tuple changes', () => {
    const translated = localizePremiumRows([row], 'ka', ['title'])[0].title;
    for (const field of ['title','title_az','title_en']) expect(localizePremiumRows([{ ...row, [field]: 'Edited source' }], 'ka', ['title'])[0].title).not.toBe(translated);
  });
});
