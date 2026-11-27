import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const native = vi.hoisted(() => ({ value: true }));
const prefs = vi.hoisted(() => ({
  store: new Map<string, string>(),
  fail: false,
  set: vi.fn(),
}));
const app = vi.hoisted(() => ({ listeners: [] as Array<(state: { isActive: boolean }) => void> }));

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => native.value, getPlatform: () => (native.value ? 'ios' : 'web') } }));
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    set: prefs.set,
    get: vi.fn(async ({ key }: { key: string }) => ({ value: prefs.store.get(key) ?? null })),
  },
}));
vi.mock('@capacitor/app', () => ({
  App: {
    addListener: vi.fn(async (_event: string, listener: (state: { isActive: boolean }) => void) => {
      app.listeners.push(listener);
      return { remove: async () => { app.listeners = app.listeners.filter(item => item !== listener); } };
    }),
  },
}));

import {
  EXPORT_DEBOUNCE_MS, EXPORT_INITIAL_DELAY_MS, MAX_EXPORT_TOTAL_CHARS, MAX_EXPORT_VALUE_CHARS, MIGRATION_EXPORT_KEY,
  MIGRATION_EXPORT_RULES, MIGRATION_EXPORT_SCHEMA, __resetMigrationExportForTests, buildMigrationExport, collectMigrationEntries,
  flushMigrationExport, isMigrationExportKey, startMigrationExport,
} from './migration-export';

const exported = () => {
  const raw = prefs.store.get(MIGRATION_EXPORT_KEY);
  return raw ? JSON.parse(raw) : null;
};

describe('migration export', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    sessionStorage.clear();
    native.value = true;
    prefs.store.clear();
    prefs.fail = false;
    prefs.set.mockReset();
    prefs.set.mockImplementation(async ({ key, value }: { key: string; value: string }) => {
      if (prefs.fail) throw new Error('bridge down');
      prefs.store.set(key, value);
    });
    app.listeners = [];
  });
  afterEach(() => {
    __resetMigrationExportForTests();
    vi.useRealTimers();
  });

  it('selects exact keys and documented prefixes only', () => {
    for (const key of ['anacan_lock_hash', 'anacan_lock_salt', 'anacan-user-store', 'anacan-timers', 'selected-child-storage',
      'anacan_outbox_v1:u1', 'anacan_word_garden_v1:az:r3:classic', 'anacan_casual_v1:leaf-flight:v1', 'silent_hours_u1',
      'anacan_tour_v1_u1', 'community_seen_posts_v2:x', 'anacan.sleepTraining.v2.u1.c1', 'anacan_minigame_progress_memory',
      'anacan.ads.ledger.v1:native', 'anacan_water_reminder_enabled']) {
      expect(isMigrationExportKey(key), key).toBe(true);
    }
    for (const key of ['anacan_lock_last_bg', 'anacan_i18n_cache:az', 'anacan_ocache_v1:children', 'anacan_colorsort_level_v1_44',
      'anacan_content_pack_hot:fr', 'anacan_premium_grant_v1:x', 'anacan_admin_language', 'random', 'anacan_app_update_v1']) {
      expect(isMigrationExportKey(key), key).toBe(false);
    }
  });

  it('never exports tokens, sessions, admission pins or the react-query cache', () => {
    for (const key of ['sb-tntbjulojatnrqmylorp-auth-token', 'sb-api-auth-token', 'sb-api-auth-token-user', 'anacan.auth-key.v1:x',
      'anacan.auth.session.v2:x', 'anacan.backend-admission.v1', 'anacan-rq-cache', 'anacan-rq-v1:azure:abc',
      'anacan_outbox_v1:refresh_token']) {
      expect(isMigrationExportKey(key), key).toBe(false);
    }
    localStorage.setItem('sb-api-auth-token', '{"access_token":"a","refresh_token":"r"}');
    localStorage.setItem('anacan-rq-cache', '{"clientState":{}}');
    localStorage.setItem('anacan_lock_enabled', '1');
    const payload = buildMigrationExport(localStorage, new Date('2026-11-27T10:00:00Z'));
    expect(payload).toMatchObject({ schema: MIGRATION_EXPORT_SCHEMA, exportedAt: '2026-11-27T10:00:00.000Z', entries: { anacan_lock_enabled: '1' }, skipped: [] });
    expect(JSON.stringify(payload)).not.toContain('refresh_token');
  });

  it('keeps raw string values exactly as stored', () => {
    const raw = '{"state":{"activeTimers":[{"id":"sleep-main-nochild-1","type":"sleep","startTime":1}]},"version":0}';
    localStorage.setItem('anacan-timers', raw);
    localStorage.setItem('anacan_app_usage_count', '17');
    expect(collectMigrationEntries(localStorage).entries).toEqual({ 'anacan-timers': raw, anacan_app_usage_count: '17' });
  });

  it('skips an oversized value and enforces the total cap by priority', () => {
    localStorage.setItem('anacan_lock_hash', 'h');
    localStorage.setItem('anacan_baby_chat_v1:u1', 'x'.repeat(MAX_EXPORT_VALUE_CHARS + 1));
    expect(collectMigrationEntries(localStorage)).toEqual({ entries: { anacan_lock_hash: 'h' }, skipped: ['anacan_baby_chat_v1:u1'] });

    localStorage.clear();
    const chunk = 'y'.repeat(MAX_EXPORT_VALUE_CHARS - 100);
    const count = Math.ceil(MAX_EXPORT_TOTAL_CHARS / chunk.length) + 1;
    for (let i = 0; i < count; i++) localStorage.setItem(`anacan_casual_v1:game${i}:r1`, chunk);
    localStorage.setItem('anacan_lock_hash', 'h');
    const { entries, skipped } = collectMigrationEntries(localStorage);
    expect(entries.anacan_lock_hash).toBe('h');
    expect(skipped.length).toBeGreaterThan(0);
    expect(Object.values(entries).reduce((sum, value) => sum + value.length, 0)).toBeLessThanOrEqual(MAX_EXPORT_TOTAL_CHARS);
  });

  it('exports once after startup, then debounces writes to exported keys', async () => {
    localStorage.setItem('anacan_lock_enabled', '1');
    startMigrationExport();
    await vi.advanceTimersByTimeAsync(EXPORT_INITIAL_DELAY_MS);
    expect(prefs.set).toHaveBeenCalledTimes(1);
    expect(exported().entries).toEqual({ anacan_lock_enabled: '1' });

    localStorage.setItem('anacan_app_usage_count', '1');
    localStorage.setItem('anacan_app_usage_count', '2');
    localStorage.setItem('anacan_i18n_cache:az', '{}');
    await vi.advanceTimersByTimeAsync(EXPORT_DEBOUNCE_MS - 1);
    expect(prefs.set).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(prefs.set).toHaveBeenCalledTimes(2);
    expect(exported().entries).toEqual({ anacan_lock_enabled: '1', anacan_app_usage_count: '2' });

    // Writes to non-exported keys do not schedule anything.
    localStorage.setItem('anacan_ocache_v1:children', '[]');
    await vi.advanceTimersByTimeAsync(EXPORT_DEBOUNCE_MS * 2);
    expect(prefs.set).toHaveBeenCalledTimes(2);
  });

  it('flushes immediately when the app goes to the background', async () => {
    startMigrationExport();
    await vi.advanceTimersByTimeAsync(0);
    localStorage.setItem('anacan-timers', '{"state":{"activeTimers":[]},"version":0}');
    expect(prefs.set).not.toHaveBeenCalled();
    app.listeners.forEach(listener => listener({ isActive: false }));
    await vi.advanceTimersByTimeAsync(0);
    expect(prefs.set).toHaveBeenCalledTimes(1);
    expect(exported().entries['anacan-timers']).toContain('activeTimers');
    // The pending debounce was replaced by the flush.
    await vi.advanceTimersByTimeAsync(EXPORT_DEBOUNCE_MS);
    expect(prefs.set).toHaveBeenCalledTimes(1);
  });

  it('propagates removal of a key', async () => {
    localStorage.setItem('anacan_lock_enabled', '1');
    localStorage.setItem('anacan_lock_hash', 'h');
    startMigrationExport();
    await flushMigrationExport();
    expect(Object.keys(exported().entries)).toEqual(['anacan_lock_enabled', 'anacan_lock_hash']);
    localStorage.removeItem('anacan_lock_hash');
    await vi.advanceTimersByTimeAsync(EXPORT_DEBOUNCE_MS);
    expect(exported().entries).toEqual({ anacan_lock_enabled: '1' });
    localStorage.clear();
    await vi.advanceTimersByTimeAsync(EXPORT_DEBOUNCE_MS);
    expect(exported().entries).toEqual({});
  });

  it('skips the Preferences write when nothing changed', async () => {
    localStorage.setItem('anacan_lock_enabled', '1');
    startMigrationExport();
    await flushMigrationExport();
    localStorage.setItem('anacan_lock_enabled', '1');
    await vi.advanceTimersByTimeAsync(EXPORT_DEBOUNCE_MS);
    expect(prefs.set).toHaveBeenCalledTimes(1);
  });

  it('is a no-op on web', async () => {
    native.value = false;
    const originalSet = Storage.prototype.setItem;
    startMigrationExport();
    expect(Storage.prototype.setItem).toBe(originalSet);
    localStorage.setItem('anacan_lock_enabled', '1');
    await vi.advanceTimersByTimeAsync(EXPORT_INITIAL_DELAY_MS + EXPORT_DEBOUNCE_MS);
    await flushMigrationExport();
    expect(prefs.set).not.toHaveBeenCalled();
    expect(app.listeners).toHaveLength(0);
  });

  it('a throwing Preferences never breaks localStorage writes and retries on the next change', async () => {
    prefs.fail = true;
    prefs.set.mockImplementation(() => { throw new Error('sync bridge failure'); });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    startMigrationExport();
    expect(() => localStorage.setItem('anacan_lock_enabled', '1')).not.toThrow();
    expect(localStorage.getItem('anacan_lock_enabled')).toBe('1');
    await vi.advanceTimersByTimeAsync(EXPORT_DEBOUNCE_MS);
    await expect(flushMigrationExport()).resolves.toBeUndefined();
    expect(prefs.set).toHaveBeenCalled();

    prefs.set.mockImplementation(async ({ key, value }: { key: string; value: string }) => { prefs.store.set(key, value); });
    localStorage.setItem('anacan_lock_hash', 'h');
    await vi.advanceTimersByTimeAsync(EXPORT_DEBOUNCE_MS);
    expect(exported().entries).toEqual({ anacan_lock_enabled: '1', anacan_lock_hash: 'h' });
    warn.mockRestore();
  });

  it('passes storage exceptions through untouched and leaves sessionStorage alone', async () => {
    startMigrationExport();
    sessionStorage.setItem('anacan_lock_enabled', '1');
    await vi.advanceTimersByTimeAsync(EXPORT_DEBOUNCE_MS);
    expect(prefs.set).not.toHaveBeenCalled();
    const quota = Object.assign(new Error('quota'), { name: 'QuotaExceededError' });
    __resetMigrationExportForTests();
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw quota; });
    startMigrationExport();
    expect(() => localStorage.setItem('anacan_lock_enabled', '1')).toThrow(quota);
    __resetMigrationExportForTests();
    spy.mockRestore();
  });

  it('documents every exported rule in docs/flutter/LEGACY_STORAGE.md', () => {
    const doc = readFileSync(resolve(__dirname, '../../docs/flutter/LEGACY_STORAGE.md'), 'utf8');
    const exportRows = doc.split('\n').filter(line => line.startsWith('|') && /\|\s*`?export`?\s*\|/.test(line)).join('\n');
    for (const rule of MIGRATION_EXPORT_RULES) {
      const shown = rule.match === 'prefix' ? `\`${rule.key}*\`` : `\`${rule.key}\``;
      expect(exportRows, rule.key).toContain(shown);
    }
  });
});
