import { afterEach, describe, expect, it } from 'vitest';
import {
  PERSISTED_QUERY_CACHE_KEY, SENSITIVE_HEALTH_KEYS, clearPersistedQueryCache, resetPersistClearMarkForTests, shouldPersistQuery,
} from './query-persist-policy';
import { clearAllCaches, writeCache } from './offlineCache';

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

describe('sensitive health data', () => {
  afterEach(() => { resetPersistClearMarkForTests(); localStorage.clear(); });

  it('never persists mental health, vitals, illness or health-sync results', () => {
    for (const key of ['epds-assessments', 'mood-checkins', 'mood-checkin-today', 'bp-logs', 'blood-sugar-logs',
      'illness-entries', 'health-daily', 'health-report-v2', 'doctor-report-extras-v1', 'postpartum-checkins']) {
      expect(SENSITIVE_HEALTH_KEYS.has(key)).toBe(true);
      expect(shouldPersistQuery(q([key, 'user-1']))).toBe(false);
    }
    expect(shouldPersistQuery(q(['epds-questions', 'az']))).toBe(true);
  });

  it('does not re-persist data loaded before a logout, but persists data fetched after it', () => {
    localStorage.setItem(PERSISTED_QUERY_CACHE_KEY, '{"clientState":{}}');
    clearPersistedQueryCache(localStorage, 1_000);
    expect(localStorage.getItem(PERSISTED_QUERY_CACHE_KEY)).toBeNull();
    expect(shouldPersistQuery(q(['vitamins'], { state: { status: 'success', dataUpdatedAt: 900 } }))).toBe(false);
    expect(shouldPersistQuery(q(['vitamins'], { state: { status: 'success', dataUpdatedAt: 1_000 } }))).toBe(false);
    expect(shouldPersistQuery(q(['vitamins'], { state: { status: 'success', dataUpdatedAt: 1_001 } }))).toBe(true);
  });

  it('logout cleanup removes the persisted query cache, offline caches and AI insight cache but keeps first aid', () => {
    localStorage.setItem(PERSISTED_QUERY_CACHE_KEY, '{}');
    writeCache('profile', 'user-1', { name: 'x' });
    localStorage.setItem('anacan-baby-insight-v2:["b","user-1","c","az"]:sleep', '{}');
    localStorage.setItem('anacan-firstaid-v1', '{}');
    localStorage.setItem('language', 'az');
    clearAllCaches();
    expect(localStorage.getItem(PERSISTED_QUERY_CACHE_KEY)).toBeNull();
    expect(localStorage.getItem('anacan_ocache_v1:profile')).toBeNull();
    expect(localStorage.getItem('anacan-baby-insight-v2:["b","user-1","c","az"]:sleep')).toBeNull();
    expect(localStorage.getItem('anacan-firstaid-v1')).toBe('{}');
    expect(localStorage.getItem('language')).toBe('az');
    expect(shouldPersistQuery(q(['vitamins'], { state: { status: 'success', dataUpdatedAt: 1 } }))).toBe(false);
  });
});
