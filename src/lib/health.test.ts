import { createElement, type ReactNode } from 'react';
import { cleanup, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HEALTH_CONNECTED_KEY, bucketDayKey, disconnectHealth, fillDays, getDailyMindfulness, getDailySteps,
  getReadAccess, getRecentWorkouts, installHealthConnect, isHealthAvailable, isHealthConnected,
  isNativeHealthPlatform, lastDays, localDayKey, openHealthSettings, readsSupported, requestHealthPermissions
} from './health';
import { useHealthAvailability, useHealthDaily, useHealthWorkouts } from '@/hooks/useHealthData';

const { platform, nativeHealth } = vi.hoisted(() => ({
  platform: { name: 'ios', native: true },
  nativeHealth: {
    isHealthAvailable: vi.fn(),
    checkHealthPermissions: vi.fn(),
    requestHealthPermissions: vi.fn(),
    queryAggregated: vi.fn(),
    queryWorkouts: vi.fn(),
    openAppleHealthSettings: vi.fn(),
    openHealthConnectSettings: vi.fn(),
    showHealthConnectInPlayStore: vi.fn()
  }
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => platform.native,
    getPlatform: () => platform.name
  }
}));
vi.mock('capacitor-health', () => ({ Health: nativeHealth }));

const today = new Date();
const todayKey = localDayKey(today);
const localMidnight = (daysAgo: number) => new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysAgo);

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  platform.name = 'ios';
  platform.native = true;
  nativeHealth.isHealthAvailable.mockResolvedValue({ available: true });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('bucket dates', () => {
  it('reads every native date shape as the local calendar day', () => {
    const midnight = localMidnight(2);
    const key = localDayKey(midnight);
    expect(bucketDayKey(midnight.getTime())).toBe(key); // iOS steps: epoch ms
    expect(bucketDayKey(midnight.toISOString())).toBe(key); // iOS mindfulness: ISO with zone
    expect(bucketDayKey(`${key}T00:00`)).toBe(key); // Health Connect LocalDateTime
    expect(bucketDayKey(midnight)).toBe(key);
    expect(bucketDayKey('nonsense')).toBeNull();
    expect(bucketDayKey(undefined)).toBeNull();
  });

  it('fills a full window of local days, oldest first', () => {
    const days = lastDays(7);
    expect(days).toHaveLength(7);
    expect(days[6]).toBe(todayKey);
    const filled = fillDays([{ startDate: localMidnight(0).getTime(), value: 1234.6 }, { startDate: localMidnight(0).getTime(), value: 10 }], 7);
    expect(filled).toHaveLength(7);
    expect(filled[6]).toEqual({ date: todayKey, value: 1245 });
    expect(filled.slice(0, 6).every((d) => d.value === 0)).toBe(true);
  });
});

describe('iOS (Apple Health)', () => {
  it('reads steps sent as epoch milliseconds (the device shape) and mindfulness seconds as minutes', async () => {
    nativeHealth.queryAggregated.mockImplementation(async ({ dataType }) => ({
      aggregatedData: dataType === 'steps' ?
      [{ startDate: localMidnight(1).getTime(), endDate: localMidnight(0).getTime(), value: 4321 }, { startDate: localMidnight(0).getTime(), endDate: Date.now(), value: 1234.6 }] :
      [{ startDate: localMidnight(0).toISOString(), endDate: Date.now(), value: 600 }]
    }));
    const steps = await getDailySteps(7);
    expect(steps).toHaveLength(7);
    expect(steps[6]).toEqual({ date: todayKey, value: 1235 });
    expect(steps[5].value).toBe(4321);
    const mindful = await getDailyMindfulness(7);
    expect(mindful[6]).toEqual({ date: todayKey, value: 10 });
    expect(nativeHealth.queryAggregated).toHaveBeenCalledWith({
      dataType: 'steps', bucket: 'day', startDate: localMidnight(6).toISOString(), endDate: expect.any(String)
    });
  });

  it('requests the iOS read set and marks the device connected', async () => {
    nativeHealth.requestHealthPermissions.mockResolvedValue({ permissions: {} });
    await expect(requestHealthPermissions()).resolves.toBe(true);
    expect(nativeHealth.requestHealthPermissions).toHaveBeenCalledExactlyOnceWith({ permissions: ['READ_STEPS', 'READ_WORKOUTS', 'READ_MINDFULNESS'] });
    expect(isHealthConnected()).toBe(true);
    await expect(getReadAccess()).resolves.toBeNull();
    disconnectHealth();
    expect(isHealthConnected()).toBe(false);
  });

  it('does not mark iOS connected when authorization rejects', async () => {
    nativeHealth.requestHealthPermissions.mockRejectedValue(new Error('denied'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(requestHealthPermissions()).resolves.toBe(false);
    expect(localStorage.getItem(HEALTH_CONNECTED_KEY)).toBeNull();
  });

  it('maps workouts newest first without heart rate, route or steps', async () => {
    nativeHealth.queryWorkouts.mockResolvedValue({ workouts: [
      { startDate: '2026-09-01T10:00:00.000Z', endDate: '2026-09-01T10:20:00.000Z', workoutType: 'walking', duration: 1200, calories: 85.4 },
      { startDate: '2026-09-02T10:00:00.000Z', endDate: '2026-09-02T10:30:00.000Z', workoutType: 'yoga', duration: 1800, calories: 0 }]
    });
    const workouts = await getRecentWorkouts(7);
    expect(workouts.map((w) => w.workoutType)).toEqual(['yoga', 'walking']);
    expect(workouts[1]).toMatchObject({ duration: 1200, calories: 85 });
    expect(nativeHealth.queryWorkouts).toHaveBeenCalledExactlyOnceWith({
      startDate: expect.any(String), endDate: expect.any(String),
      includeHeartRate: false, includeRoute: false, includeSteps: false
    });
    await openHealthSettings();
    expect(nativeHealth.openAppleHealthSettings).toHaveBeenCalledOnce();
  });
});

describe('Android (Health Connect)', () => {
  beforeEach(() => {platform.name = 'android';});

  it('creates the Health Connect client before the first query and reads LocalDateTime buckets', async () => {
    const yesterday = localDayKey(localMidnight(1));
    nativeHealth.queryAggregated.mockResolvedValue({ aggregatedData: [{ startDate: `${yesterday}T00:00`, endDate: `${todayKey}T00:00`, value: 8000 }] });
    const steps = await getDailySteps(7);
    expect(nativeHealth.isHealthAvailable.mock.invocationCallOrder[0]).toBeLessThan(nativeHealth.queryAggregated.mock.invocationCallOrder[0]);
    expect(steps[5]).toEqual({ date: yesterday, value: 8000 });
    await expect(getDailyMindfulness(7)).resolves.toEqual([]);
    expect(nativeHealth.queryAggregated).toHaveBeenCalledOnce();
  });

  it('requests steps + exercise only and trusts the real grant result', async () => {
    nativeHealth.requestHealthPermissions.mockResolvedValueOnce({ permissions: { READ_STEPS: false, READ_WORKOUTS: false } });
    await expect(requestHealthPermissions()).resolves.toBe(false);
    expect(isHealthConnected()).toBe(false);
    nativeHealth.requestHealthPermissions.mockResolvedValueOnce({ permissions: { READ_STEPS: true, READ_WORKOUTS: false } });
    await expect(requestHealthPermissions()).resolves.toBe(true);
    expect(isHealthConnected()).toBe(true);
    expect(nativeHealth.requestHealthPermissions).toHaveBeenLastCalledWith({ permissions: ['READ_STEPS', 'READ_WORKOUTS'] });
    nativeHealth.checkHealthPermissions.mockResolvedValue({ permissions: { READ_STEPS: true, READ_WORKOUTS: false } });
    await expect(getReadAccess()).resolves.toEqual({ steps: true, workouts: false });
  });

  it('reports Health Connect missing and offers the store/settings', async () => {
    nativeHealth.isHealthAvailable.mockResolvedValue({ available: false });
    await expect(isHealthAvailable()).resolves.toBe(false);
    await installHealthConnect();
    expect(nativeHealth.showHealthConnectInPlayStore).toHaveBeenCalledOnce();
  });
});

describe('web', () => {
  it('never calls native health and masks persisted data', async () => {
    platform.name = 'web';
    platform.native = false;
    localStorage.setItem(HEALTH_CONNECTED_KEY, 'previous-release');
    expect(isNativeHealthPlatform()).toBe(false);
    expect(readsSupported()).toBe(false);
    expect(isHealthConnected()).toBe(false);
    await expect(requestHealthPermissions()).resolves.toBe(false);
    await expect(getDailySteps()).resolves.toEqual([]);
    await expect(getRecentWorkouts()).resolves.toEqual([]);

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(['health-available'], true);
    client.setQueryData(['health-daily', 7], { steps: [{ date: '2026-09-01', value: 9000 }], mindfulness: [] });
    const { result, unmount } = renderHook(() => ({
      availability: useHealthAvailability(),
      daily: useHealthDaily(7, true),
      workouts: useHealthWorkouts(7, true)
    }), { wrapper: ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children) });
    expect(result.current.availability.data).toBe(false);
    expect(result.current.daily.data).toBeUndefined();
    expect(result.current.workouts.data).toBeUndefined();
    Object.values(nativeHealth).forEach((method) => expect(method).not.toHaveBeenCalled());
    unmount();
    client.clear();
  });
});
