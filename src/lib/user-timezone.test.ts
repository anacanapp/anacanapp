import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

import { deviceTimeZone, isValidTimeZoneName, resetTimeZoneSyncForTests, syncUserTimeZone, type TimeZoneClient } from './user-timezone';

function fakeClient(read: { data?: unknown; error: unknown }, write: { error: unknown } = { error: null }) {
  const calls = { select: [] as string[], eq: [] as [string, string][], upsert: [] as [Record<string, unknown>, { onConflict: string }][] };
  const client: TimeZoneClient = {
    from: () => ({
      select: (columns) => {
        calls.select.push(columns);
        return { eq: (column, value) => { calls.eq.push([column, value]); return { maybeSingle: () => Promise.resolve(read) }; } };
      },
      upsert: (values, options) => { calls.upsert.push([values, options]); return Promise.resolve(write); }
    })
  };
  return { client, calls };
}

describe('time zone names', () => {
  it('accepts IANA names allowed by the database check', () => {
    for (const tz of ['Asia/Baku', 'UTC', 'Etc/GMT+4', 'America/Argentina/Buenos_Aires', 'America/Port-au-Prince']) expect(isValidTimeZoneName(tz), tz).toBe(true);
  });
  it('rejects anything else', () => {
    for (const tz of ['', 'Asia/Baku; drop', '+04:00', 'a/b/c/d', 'x'.repeat(65), null, 4]) expect(isValidTimeZoneName(tz)).toBe(false);
  });
  it('reads the device zone from Intl', () => {
    const spy = vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => ({ resolvedOptions: () => ({ timeZone: 'Europe/Tallinn' }) }) as unknown as Intl.DateTimeFormat);
    expect(deviceTimeZone()).toBe('Europe/Tallinn');
    spy.mockRestore();
  });
});

describe('syncUserTimeZone', () => {
  beforeEach(() => resetTimeZoneSyncForTests());
  afterEach(() => vi.restoreAllMocks());

  it('writes the zone when the stored value differs', async () => {
    const { client, calls } = fakeClient({ data: { timezone: 'Asia/Baku' }, error: null });
    await expect(syncUserTimeZone('u1', { client, timeZone: 'Europe/Berlin' })).resolves.toBe('updated');
    expect(calls.select).toEqual(['timezone']);
    expect(calls.eq).toEqual([['user_id', 'u1']]);
    expect(calls.upsert).toEqual([[{ user_id: 'u1', timezone: 'Europe/Berlin' }, { onConflict: 'user_id' }]]);
  });

  it('writes when there is no row yet', async () => {
    const { client, calls } = fakeClient({ data: null, error: null });
    await expect(syncUserTimeZone('u1', { client, timeZone: 'Asia/Baku' })).resolves.toBe('updated');
    expect(calls.upsert).toHaveLength(1);
  });

  it('does not write an unchanged zone', async () => {
    const { client, calls } = fakeClient({ data: { timezone: 'Asia/Baku' }, error: null });
    await expect(syncUserTimeZone('u1', { client, timeZone: 'Asia/Baku' })).resolves.toBe('unchanged');
    expect(calls.upsert).toHaveLength(0);
  });

  it('runs at most once per user per session', async () => {
    const { client, calls } = fakeClient({ data: null, error: null });
    await syncUserTimeZone('u1', { client, timeZone: 'Asia/Baku' });
    await expect(syncUserTimeZone('u1', { client, timeZone: 'Europe/Berlin' })).resolves.toBe('skipped');
    expect(calls.select).toHaveLength(1);
    await expect(syncUserTimeZone('u2', { client, timeZone: 'Asia/Baku' })).resolves.toBe('updated');
  });

  it('stays quiet when the column does not exist yet', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { client, calls } = fakeClient({ data: null, error: { code: '42703', message: 'column user_preferences.timezone does not exist' } });
    await expect(syncUserTimeZone('u1', { client, timeZone: 'Asia/Baku' })).resolves.toBe('unavailable');
    expect(calls.upsert).toHaveLength(0);
    expect(log).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it('swallows write errors and thrown errors', async () => {
    const { client } = fakeClient({ data: null, error: null }, { error: { code: 'PGRST204' } });
    await expect(syncUserTimeZone('u1', { client, timeZone: 'Asia/Baku' })).resolves.toBe('unavailable');
    const throwing = { from: () => { throw new Error('offline'); } } as unknown as TimeZoneClient;
    await expect(syncUserTimeZone('u2', { client: throwing, timeZone: 'Asia/Baku' })).resolves.toBe('unavailable');
  });

  it('skips without a user or a storable zone', async () => {
    const { client, calls } = fakeClient({ data: null, error: null });
    await expect(syncUserTimeZone(null, { client, timeZone: 'Asia/Baku' })).resolves.toBe('skipped');
    await expect(syncUserTimeZone('u1', { client, timeZone: null })).resolves.toBe('skipped');
    await expect(syncUserTimeZone('u1', { client, timeZone: '+04:00' })).resolves.toBe('skipped');
    expect(calls.select).toHaveLength(0);
  });
});
