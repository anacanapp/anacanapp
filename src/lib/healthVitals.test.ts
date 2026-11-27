import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  VITALS_WRITE_KEY, getLastVitalsSync, isVitalsWriteAvailable, isVitalsWriteEnabled,
  requestVitalsWritePermission, setVitalsWriteEnabled, syncVitalsToHealth, weightMoment
} from './healthVitals';

type Row = Record<string, unknown> & { created_at: string };

const { platform, nativeVitals, tables, queries } = vi.hoisted(() => ({
  platform: { name: 'ios', native: true },
  nativeVitals: {
    isAvailable: vi.fn(),
    requestWritePermission: vi.fn(),
    writeWeight: vi.fn(),
    writeBloodPressure: vi.fn(),
    writeBloodGlucose: vi.fn()
  },
  tables: {} as Record<string, Row[]>,
  queries: [] as { table: string; user: unknown; since: string }[]
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => platform.native,
    getPlatform: () => platform.name
  },
  registerPlugin: () => nativeVitals
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      const state = { user: undefined as unknown, since: '' };
      const chain = {
        select: () => chain,
        eq: (_: string, value: unknown) => {state.user = value;return chain;},
        gt: (_: string, value: string) => {state.since = value;return chain;},
        order: () => chain,
        limit: async () => {
          queries.push({ table, user: state.user, since: state.since });
          return { data: (tables[table] ?? []).filter((r) => r.created_at > state.since).sort((a, b) => a.created_at.localeCompare(b.created_at)), error: null };
        }
      };
      return chain;
    }
  }
}));

const recent = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000).toISOString();

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  platform.name = 'ios';
  platform.native = true;
  queries.length = 0;
  tables.weight_entries = [];
  tables.blood_pressure_logs = [];
  tables.blood_sugar_logs = [];
  nativeVitals.isAvailable.mockResolvedValue({ available: true });
  nativeVitals.writeWeight.mockResolvedValue({ written: true });
  nativeVitals.writeBloodPressure.mockResolvedValue({ written: true });
  nativeVitals.writeBloodGlucose.mockResolvedValue({ written: true });
});
afterEach(() => localStorage.clear());

describe('vitals write capability', () => {
  it('never calls native code on the web, even with a stale flag', async () => {
    platform.name = 'web';
    platform.native = false;
    localStorage.setItem(VITALS_WRITE_KEY, '1');
    expect(isVitalsWriteEnabled()).toBe(false);
    await expect(isVitalsWriteAvailable()).resolves.toBe(false);
    await expect(requestVitalsWritePermission()).resolves.toBe(false);
    await expect(syncVitalsToHealth('u1')).resolves.toEqual({ written: 0, failed: 0, skipped: true });
    setVitalsWriteEnabled(true);
    expect(localStorage.getItem(VITALS_WRITE_KEY)).toBeNull();
    Object.values(nativeVitals).forEach((method) => expect(method).not.toHaveBeenCalled());
  });

  it.each(['ios', 'android'])('allows the opt-in on %s', async (name) => {
    platform.name = name;
    nativeVitals.requestWritePermission.mockResolvedValue({ granted: true });
    await expect(isVitalsWriteAvailable()).resolves.toBe(true);
    await expect(requestVitalsWritePermission()).resolves.toBe(true);
    setVitalsWriteEnabled(true);
    expect(isVitalsWriteEnabled()).toBe(true);
  });

  it('does nothing while the switch is off', async () => {
    tables.weight_entries = [{ weight: 65, entry_date: '2026-10-31', created_at: recent(5) }];
    await expect(syncVitalsToHealth('u1')).resolves.toMatchObject({ skipped: true });
    expect(nativeVitals.writeWeight).not.toHaveBeenCalled();
  });
});

describe('syncVitalsToHealth', () => {
  beforeEach(() => setVitalsWriteEnabled(true));

  it('copies the last 30 days once, then only new records', async () => {
    const old = new Date(Date.now() - 40 * 86400_000).toISOString();
    tables.weight_entries = [
      { weight: 60, entry_date: old.slice(0, 10), created_at: old },
      { weight: 65.4, entry_date: recent(60).slice(0, 10), created_at: recent(60) }];
    tables.blood_pressure_logs = [{ systolic: 118, diastolic: 76, measured_at: '2026-10-30T08:15:00+00:00', created_at: recent(50) }];
    tables.blood_sugar_logs = [{ reading_value: 92, logged_at: null, created_at: recent(40) }];

    await expect(syncVitalsToHealth('u1')).resolves.toEqual({ written: 3, failed: 0, skipped: false });
    expect(nativeVitals.writeWeight).toHaveBeenCalledExactlyOnceWith({ kg: 65.4, date: expect.any(String) });
    expect(nativeVitals.writeBloodPressure).toHaveBeenCalledExactlyOnceWith({ systolic: 118, diastolic: 76, date: '2026-10-30T08:15:00.000Z' });
    expect(nativeVitals.writeBloodGlucose).toHaveBeenCalledExactlyOnceWith({ mgdl: 92, date: new Date(tables.blood_sugar_logs[0].created_at).toISOString() });
    expect(queries.every((q) => q.user === 'u1')).toBe(true);
    expect(getLastVitalsSync('u1')).toEqual(expect.any(Number));

    // Nothing new: nothing written again.
    await expect(syncVitalsToHealth('u1')).resolves.toEqual({ written: 0, failed: 0, skipped: false });
    expect(nativeVitals.writeWeight).toHaveBeenCalledOnce();

    // A new record after a save is copied alone.
    tables.weight_entries.push({ weight: 65.8, entry_date: recent(1).slice(0, 10), created_at: recent(1) });
    await expect(syncVitalsToHealth('u1')).resolves.toMatchObject({ written: 1 });
    expect(nativeVitals.writeWeight).toHaveBeenLastCalledWith({ kg: 65.8, date: expect.any(String) });
  });

  it('retries a failed record next time and keeps the other measurements going', async () => {
    tables.weight_entries = [
      { weight: 64, entry_date: recent(30).slice(0, 10), created_at: recent(30) },
      { weight: 65, entry_date: recent(20).slice(0, 10), created_at: recent(20) }];
    tables.blood_sugar_logs = [{ reading_value: 100, logged_at: recent(10), created_at: recent(10) }];
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    nativeVitals.writeWeight.mockRejectedValueOnce(new Error('denied'));

    await expect(syncVitalsToHealth('u1')).resolves.toEqual({ written: 1, failed: 1, skipped: false });
    expect(nativeVitals.writeWeight).toHaveBeenCalledOnce(); // stopped at the first weight failure
    expect(getLastVitalsSync('u1')).toBeNull();

    await expect(syncVitalsToHealth('u1')).resolves.toEqual({ written: 2, failed: 0, skipped: false });
    expect(nativeVitals.writeWeight.mock.calls.map((c) => c[0].kg)).toEqual([64, 64, 65]);
    expect(nativeVitals.writeBloodGlucose).toHaveBeenCalledOnce();
  });

  it('keeps separate progress per account', async () => {
    tables.weight_entries = [{ weight: 70, entry_date: recent(5).slice(0, 10), created_at: recent(5) }];
    await syncVitalsToHealth('u1');
    await syncVitalsToHealth('u2');
    expect(nativeVitals.writeWeight).toHaveBeenCalledTimes(2);
  });

  it('skips when the native plugin is missing (older build)', async () => {
    nativeVitals.isAvailable.mockRejectedValue(new Error('not implemented'));
    tables.weight_entries = [{ weight: 70, entry_date: recent(5).slice(0, 10), created_at: recent(5) }];
    await expect(syncVitalsToHealth('u1')).resolves.toMatchObject({ skipped: true });
    expect(nativeVitals.writeWeight).not.toHaveBeenCalled();
  });
});

describe('weightMoment', () => {
  it('uses the save time on the entry day, otherwise local noon of that day', () => {
    const created = new Date(2026, 9, 31, 9, 30);
    expect(weightMoment('2026-10-31', created.toISOString())).toBe(created.toISOString());
    expect(weightMoment('2026-10-29', created.toISOString())).toBe(new Date(2026, 9, 29, 12).toISOString());
  });
});
