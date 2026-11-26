import { afterEach, describe, expect, it } from 'vitest';
import { QuotaStorage } from '@/test/quota-storage';
import { loadThreads, saveThread } from './baby-chat';

/**
 * #13: durable device writes must go through the quota-aware writer, so under storage pressure a
 * disposable cache is evicted to keep the user's data instead of the write being silently dropped.
 */
describe('baby-chat durable write under quota pressure', () => {
  const realStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  afterEach(() => {
    if (realStorage) Object.defineProperty(globalThis, 'localStorage', realStorage);
  });

  it('evicts a disposable translation cache to keep the thread, never the session', () => {
    const storage = new QuotaStorage();
    Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });

    storage.setItem('anacan_i18n_cache:az', 'x'.repeat(4000)); // disposable (re-downloadable)
    storage.setItem('sb-source-auth-token', 'session');        // essential, never evicted
    storage.limit = storage.size + 100;                        // almost no headroom

    saveThread('u1', '2026-11-26', [{ id: 'm1', from: 'baby', text: 'y'.repeat(3000), at: 1 }]);

    expect(loadThreads('u1')['2026-11-26']).toHaveLength(1);        // the thread survived
    expect(storage.getItem('anacan_i18n_cache:az')).toBeNull();     // the disposable cache was evicted
    expect(storage.getItem('sb-source-auth-token')).toBe('session'); // the session was kept
  });
});
