import { describe, expect, it, vi } from 'vitest';
import { quotaManagedStorage, writeStorageCache, writeStorageItem } from './local-storage';
import { QuotaStorage } from '@/test/quota-storage';

describe('storage pressure recovery', () => {
  it('makes room for auth rotation using translations first, preserving all user state and other realms', () => {
    const storage = new QuotaStorage();
    const retained = {
      'sb-other-auth-token': 'other-realm-session',
      'anacan.backend-admission.v1': 'authority-pin',
      'anacan.auth.adoption.v1:target': 'adoption-receipt',
      'anacan.auth.session.v2:source': 'logout-tombstone',
      'anacan.auth-key.v1:realm': 'namespace-pin',
      'anacan-user-store': 'ui-preferences',
      'admin_draft_article': 'unsaved-draft',
      'anacan-timer-store': 'active-timer',
      'anacan-cake-cart': 'cart',
      'anacan_health_cycle_write': 'consent',
      'anacan_colorsort_round_v1': 'unfinished-game',
      'anacan_colorsort_level_v1_31': 'game-definition',
      'anacan.ads.ledger.v1:live': 'ad-frequency-counters',
      'anacan_ocache_v1:profile': 'last-known-profile',
    };
    for (const [key, value] of Object.entries(retained)) storage.setItem(key, value);
    storage.setItem('sb-source-auth-token', 'old-pair');
    storage.setItem('anacan_i18n_cache:az', 'x'.repeat(4000));
    storage.limit = storage.size;
    writeStorageItem(storage, 'sb-source-auth-token', 'rotated-pair-with-more-metadata');
    expect(storage.getItem('sb-source-auth-token')).toBe('rotated-pair-with-more-metadata');
    expect(storage.getItem('anacan_i18n_cache:az')).toBeNull();
    for (const [key, value] of Object.entries(retained)) expect(storage.getItem(key)).toBe(value);
  });

  it('keeps the previous session and drafts when no safe cache can free space', () => {
    const storage = new QuotaStorage();
    storage.setItem('sb-source-auth-token', 'old-pair');
    storage.setItem('admin_draft_article', 'x'.repeat(3000));
    storage.limit = storage.size;
    expect(() => writeStorageItem(storage, 'sb-source-auth-token', 'larger-rotated-pair')).toThrow('quota');
    expect(storage.getItem('sb-source-auth-token')).toBe('old-pair');
    expect(storage.getItem('admin_draft_article')).toBe('x'.repeat(3000));
  });

  it('does not evict caches for permission failures or change logout semantics', () => {
    const storage = new QuotaStorage();
    storage.setItem('anacan_i18n_cache:en', 'cached');
    storage.setItem('sb-source-auth-token', 'old-session');
    const managed = quotaManagedStorage(storage);
    const write = vi.spyOn(storage, 'setItem').mockImplementation(() => { throw new DOMException('Denied', 'SecurityError'); });
    expect(() => managed.setItem('sb-source-auth-token', 'replacement')).toThrow('Denied');
    expect(storage.getItem('anacan_i18n_cache:en')).toBe('cached');
    write.mockRestore();
    managed.removeItem('sb-source-auth-token');
    expect(managed.getItem('sb-source-auth-token')).toBeNull();
  });

  it('bounds translation caches while retaining persistent settings and room for auth', () => {
    const storage = new QuotaStorage();
    storage.limit = 5 * 1024 * 1024;
    storage.setItem('language', 'ru');
    storage.setItem('anacan-user-store', 'user-settings');
    for (const lang of ['az', 'en', 'ru', 'tr']) {
      expect(writeStorageCache(storage, `anacan_i18n_cache:${lang}`, 'x'.repeat(700_000))).toBe(true);
    }
    expect(storage.size).toBeLessThan(2 * 1024 * 1024);
    expect(storage.getItem('anacan_i18n_cache:tr')).not.toBeNull();
    expect(storage.getItem('language')).toBe('ru');
    expect(storage.getItem('anacan-user-store')).toBe('user-settings');
    expect(() => storage.setItem('sb-source-auth-token', 's'.repeat(200_000))).not.toThrow();
  });

  it('rejects oversized optional caches without deleting existing data', () => {
    const storage = new QuotaStorage();
    storage.setItem('anacan_i18n_cache:az', 'usable-cache');
    storage.setItem('admin_draft_article', 'saved-draft');
    expect(writeStorageCache(storage, 'anacan_i18n_cache:en', 'x'.repeat(2 * 1024 * 1024))).toBe(false);
    expect(storage.getItem('anacan_i18n_cache:az')).toBe('usable-cache');
    expect(storage.getItem('admin_draft_article')).toBe('saved-draft');
    expect(() => writeStorageCache(storage, 'sb-source-auth-token', 'session')).toThrow('NOT_A_DISPOSABLE_STORAGE_CACHE');
  });

  it('only the non-authoritative UI adapter may proceed in memory when storage stays unavailable', () => {
    const storage = new QuotaStorage();
    storage.limit = 0;
    expect(() => quotaManagedStorage(storage).setItem('sb-source-auth-token', 'session')).toThrow('quota');
    expect(() => quotaManagedStorage(storage, { bestEffort: true }).setItem('anacan-user-store', 'ui')).not.toThrow();
  });
});
