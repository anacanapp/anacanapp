import { describe, expect, it } from 'vitest';
import { shouldPersistQuery } from './query-persist-policy';

const q = (queryKey: unknown[], extra: Partial<Parameters<typeof shouldPersistQuery>[0]> = {}) =>
  ({ queryKey, state: { status: 'success' }, ...extra });

describe('shouldPersistQuery', () => {
  it('persists stable content queries', () => {
    expect(shouldPersistQuery(q(['pregnancy_content', 'az', 12]))).toBe(true);
    expect(shouldPersistQuery(q(['force-update-config'], { options: { refetchInterval: 300_000 } }))).toBe(true);
  });
  it('skips failed, opted-out, feed, chat and story queries', () => {
    expect(shouldPersistQuery({ queryKey: ['vitamins'], state: { status: 'error' } })).toBe(false);
    expect(shouldPersistQuery(q(['vitamins'], { meta: { persist: false } }))).toBe(false);
    for (const key of ['community-feed', 'chat-messages-v2', 'story-replies', 'stories', 'post-comments'])
      expect(shouldPersistQuery(q([key, 'x']))).toBe(false);
  });
  it('skips polled and admin queries', () => {
    expect(shouldPersistQuery(q(['notifications'], { options: { refetchInterval: 30_000 } }))).toBe(false);
    expect(shouldPersistQuery(q(['faqs-admin']))).toBe(false);
    expect(shouldPersistQuery(q(['content', 'AdMob']))).toBe(false);
    expect(shouldPersistQuery(q(['content', { id: 1 }, null]))).toBe(true);
  });
});
