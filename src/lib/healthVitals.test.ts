import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  VITALS_WRITE_KEY, isVitalsWriteAvailable, isVitalsWriteEnabled,
  requestVitalsWritePermission, setVitalsWriteEnabled, writeBloodGlucoseToHealth,
  writeBloodPressureToHealth, writeWeightToHealth
} from './healthVitals';

const { platform, nativeVitals } = vi.hoisted(() => ({
  platform: { name: 'android', native: true },
  nativeVitals: {
    isAvailable: vi.fn(),
    requestWritePermission: vi.fn(),
    writeWeight: vi.fn(),
    writeBloodPressure: vi.fn(),
    writeBloodGlucose: vi.fn()
  }
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => platform.native,
    getPlatform: () => platform.name
  },
  registerPlugin: () => nativeVitals
}));

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  platform.name = 'android';
  platform.native = true;
});
afterEach(() => localStorage.clear());

describe('health vitals write capability', () => {
  it.each([
    { name: 'android', native: true },
    { name: 'web', native: false },
    { name: 'ios', native: false }
  ])('blocks native calls despite a stale enabled flag on $name (native=$native)', async ({ name, native }) => {
    platform.name = name;
    platform.native = native;
    localStorage.setItem(VITALS_WRITE_KEY, '1');

    expect(isVitalsWriteEnabled()).toBe(false);
    await expect(isVitalsWriteAvailable()).resolves.toBe(false);
    await expect(requestVitalsWritePermission()).resolves.toBe(false);
    await expect(writeWeightToHealth(65)).resolves.toBe(false);
    await expect(writeBloodPressureToHealth(120, 80)).resolves.toBe(false);
    await expect(writeBloodGlucoseToHealth(95)).resolves.toBe(false);
    Object.values(nativeVitals).forEach((method) => expect(method).not.toHaveBeenCalled());

    setVitalsWriteEnabled(true);
    expect(localStorage.getItem(VITALS_WRITE_KEY)).toBeNull();
    expect(isVitalsWriteEnabled()).toBe(false);
  });

  it('preserves iOS opt-in and all three vitals writes', async () => {
    platform.name = 'ios';
    nativeVitals.isAvailable.mockResolvedValue({ available: true });
    nativeVitals.requestWritePermission.mockResolvedValue({ granted: true });
    const date = new Date('2026-09-01T12:00:00Z');

    await expect(writeWeightToHealth(65, date)).resolves.toBe(false);
    expect(nativeVitals.isAvailable).not.toHaveBeenCalled();
    await expect(isVitalsWriteAvailable()).resolves.toBe(true);
    await expect(requestVitalsWritePermission()).resolves.toBe(true);
    expect(isVitalsWriteEnabled()).toBe(false);
    setVitalsWriteEnabled(true);
    expect(isVitalsWriteEnabled()).toBe(true);
    await expect(writeWeightToHealth(65, date)).resolves.toBe(true);
    await expect(writeBloodPressureToHealth(120, 80, date)).resolves.toBe(true);
    await expect(writeBloodGlucoseToHealth(95, date)).resolves.toBe(true);
    expect(nativeVitals.writeWeight).toHaveBeenCalledExactlyOnceWith({ kg: 65, date: date.toISOString() });
    expect(nativeVitals.writeBloodPressure).toHaveBeenCalledExactlyOnceWith({ systolic: 120, diastolic: 80, date: date.toISOString() });
    expect(nativeVitals.writeBloodGlucose).toHaveBeenCalledExactlyOnceWith({ mgdl: 95, date: date.toISOString() });
    setVitalsWriteEnabled(false);
    expect(isVitalsWriteEnabled()).toBe(false);
    expect(localStorage.getItem(VITALS_WRITE_KEY)).toBeNull();
  });

  it('returns an iOS permission denial without enabling writes', async () => {
    platform.name = 'ios';
    nativeVitals.requestWritePermission.mockResolvedValue({ granted: false });
    await expect(requestVitalsWritePermission()).resolves.toBe(false);
    expect(isVitalsWriteEnabled()).toBe(false);
  });
});
