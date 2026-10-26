import { createElement, type ReactNode } from 'react';
import { cleanup, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HEALTH_CONNECTED_KEY, disconnectHealth, getDailyMindfulness, getDailySteps,
  getRecentWorkouts, getTodaySteps, getWeekMindfulnessMinutes, installHealthConnect,
  isHealthAvailable, isHealthConnected, isNativeHealthPlatform, openHealthSettings,
  readsSupported, requestHealthPermissions
} from './health';
import { useHealthAvailability, useHealthDaily, useHealthWorkouts } from '@/hooks/useHealthData';

const { platform, nativeHealth } = vi.hoisted(() => ({
  platform: { name: 'android', native: true },
  nativeHealth: {
    isHealthAvailable: vi.fn(),
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

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  platform.name = 'android';
  platform.native = true;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('health read capability', () => {
  it.each([
    { name: 'android', native: true, stale: false },
    { name: 'android', native: true, stale: true },
    { name: 'web', native: false, stale: true },
    { name: 'ios', native: false, stale: true }
  ])('blocks reads and authorization on $name (native=$native, stale=$stale)', async ({ name, native, stale }) => {
    platform.name = name;
    platform.native = native;
    if (stale) localStorage.setItem(HEALTH_CONNECTED_KEY, 'previous-release');

    expect(isNativeHealthPlatform()).toBe(native);
    expect(readsSupported()).toBe(false);
    expect(isHealthConnected()).toBe(false);
    await expect(isHealthAvailable()).resolves.toBe(false);
    await expect(requestHealthPermissions()).resolves.toBe(false);
    await expect(getDailySteps()).resolves.toEqual([]);
    await expect(getDailyMindfulness()).resolves.toEqual([]);
    await expect(getTodaySteps()).resolves.toBe(0);
    await expect(getWeekMindfulnessMinutes()).resolves.toBe(0);
    await expect(getRecentWorkouts()).resolves.toEqual([]);
    expect(localStorage.getItem(HEALTH_CONNECTED_KEY)).toBe(stale ? 'previous-release' : null);
    Object.values(nativeHealth).forEach((method) => expect(method).not.toHaveBeenCalled());

    disconnectHealth();
    expect(localStorage.getItem(HEALTH_CONNECTED_KEY)).toBeNull();
  });

  it('preserves native iOS authorization and queries', async () => {
    platform.name = 'ios';
    nativeHealth.isHealthAvailable.mockResolvedValue({ available: true });
    nativeHealth.requestHealthPermissions.mockResolvedValue(undefined);
    nativeHealth.queryAggregated.mockImplementation(async ({ dataType }) => ({
      aggregatedData: [{ startDate: '2026-09-01T00:00:00Z', value: dataType === 'steps' ? 1234.6 : 12.2 }]
    }));
    const workout = {
      startDate: '2026-09-01T10:00:00Z', endDate: '2026-09-01T10:20:00Z',
      workoutType: 'walking', duration: 1200, calories: 85.4, sourceName: 'Watch'
    };
    nativeHealth.queryWorkouts.mockResolvedValue({ workouts: [workout] });

    expect(readsSupported()).toBe(true);
    await expect(isHealthAvailable()).resolves.toBe(true);
    await expect(requestHealthPermissions()).resolves.toBe(true);
    expect(isHealthConnected()).toBe(true);
    expect(nativeHealth.requestHealthPermissions).toHaveBeenCalledExactlyOnceWith({
      permissions: ['READ_STEPS', 'READ_WORKOUTS', 'READ_MINDFULNESS']
    });
    await expect(getDailySteps()).resolves.toEqual([{ date: '2026-09-01', value: 1235 }]);
    await expect(getDailyMindfulness()).resolves.toEqual([{ date: '2026-09-01', value: 12 }]);
    await expect(getTodaySteps()).resolves.toBe(1235);
    await expect(getWeekMindfulnessMinutes()).resolves.toBe(12);
    await expect(getRecentWorkouts()).resolves.toEqual([{ ...workout, calories: 85 }]);
    expect(nativeHealth.queryAggregated).toHaveBeenCalledWith({
      dataType: 'mindfulness', bucket: 'day', startDate: expect.any(String), endDate: expect.any(String)
    });
    expect(nativeHealth.queryWorkouts).toHaveBeenCalledExactlyOnceWith({
      startDate: expect.any(String), endDate: expect.any(String),
      includeHeartRate: false, includeRoute: false, includeSteps: false
    });
    await openHealthSettings();
    expect(nativeHealth.openAppleHealthSettings).toHaveBeenCalledOnce();
  });

  it('does not mark iOS connected when authorization rejects', async () => {
    platform.name = 'ios';
    nativeHealth.requestHealthPermissions.mockRejectedValue(new Error('denied'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(requestHealthPermissions()).resolves.toBe(false);
    expect(isHealthConnected()).toBe(false);
    expect(localStorage.getItem(HEALTH_CONNECTED_KEY)).toBeNull();
  });

  it('keeps explicit Android settings and installation actions available', async () => {
    await openHealthSettings();
    await installHealthConnect();
    expect(nativeHealth.openHealthConnectSettings).toHaveBeenCalledOnce();
    expect(nativeHealth.showHealthConnectInPlayStore).toHaveBeenCalledOnce();
    expect(nativeHealth.requestHealthPermissions).not.toHaveBeenCalled();
  });

  it.each(['android', 'ios'])('exposes persisted query data only on iOS: %s', (name) => {
    platform.name = name;
    localStorage.setItem(HEALTH_CONNECTED_KEY, 'previous-release');
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const daily = { steps: [{ date: '2026-09-01', value: 9000 }], mindfulness: [] };
    const workouts = [{ workoutType: 'walking', duration: 1200 }];
    client.setQueryData(['health-available'], true);
    client.setQueryData(['health-daily', 7], daily);
    client.setQueryData(['health-workouts', 7], workouts);

    const { result, unmount } = renderHook(() => ({
      availability: useHealthAvailability(),
      daily: useHealthDaily(7, true),
      workouts: useHealthWorkouts(7, true)
    }), {
      wrapper: ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client }, children)
    });

    expect(result.current.availability.data).toBe(name === 'ios');
    expect(result.current.daily.data).toEqual(name === 'ios' ? daily : undefined);
    expect(result.current.workouts.data).toEqual(name === 'ios' ? workouts : undefined);
    expect(result.current.daily.fetchStatus).toBe('idle');
    expect(result.current.workouts.fetchStatus).toBe('idle');
    Object.values(nativeHealth).forEach((method) => expect(method).not.toHaveBeenCalled());
    unmount();
    client.clear();
  });
});
