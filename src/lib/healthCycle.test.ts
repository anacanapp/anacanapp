import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ native: vi.fn(), available: vi.fn(), write: vi.fn() }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: mocks.native },
  registerPlugin: () => ({ isAvailable: mocks.available, writeMenstruation: mocks.write }) }));
beforeEach(() => {
  vi.resetModules(); vi.resetAllMocks(); localStorage.clear();
  localStorage.setItem('anacan_health_cycle_write', '1');
  mocks.native.mockReturnValue(true); mocks.available.mockResolvedValue({ available: true, apiVersion: 2 });
  mocks.write.mockResolvedValue({ written: 1 });
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 8, 14, 12));
});
afterEach(() => vi.useRealTimers());
it('writes only observed local dates and preserves per-day intensity and cycle start', async () => {
  const { syncPeriodDaysToHealth } = await import('./healthCycle');
  expect(await syncPeriodDaysToHealth([
    { date: '2026-09-10', flow: 'unspecified', cycleStart: true },
    { date: '2026-09-11', flow: 'heavy', cycleStart: false },
    { date: '2026-09-12', flow: 'none', cycleStart: false },
  ])).toBe(true);
  expect(mocks.write.mock.calls.map(([value]) => value)).toEqual([
    { startDate: '2026-09-10', endDate: '2026-09-10', flow: 'unspecified', cycleStart: true },
    { startDate: '2026-09-11', endDate: '2026-09-11', flow: 'heavy', cycleStart: false },
    { startDate: '2026-09-12', endDate: '2026-09-12', flow: 'none', cycleStart: false },
  ]);
});
it('does not send unsupported semantics to the old bridge or export predictions', async () => {
  mocks.available.mockResolvedValueOnce({ available: true });
  const { syncPeriodDaysToHealth } = await import('./healthCycle');
  expect(await syncPeriodDaysToHealth([{ date: '2026-09-14', flow: 'unspecified', cycleStart: true }])).toBe(false);
  expect(mocks.write).not.toHaveBeenCalled();
  await syncPeriodDaysToHealth([{ date: '2026-09-15', flow: 'heavy', cycleStart: false }]);
  expect(mocks.write).not.toHaveBeenCalled();
});
it('keeps spotting separate from menstrual flow and clears only the app period record', async () => {
  const { syncPeriodDaysToHealth } = await import('./healthCycle');
  await syncPeriodDaysToHealth([{ date: '2026-09-14', flow: 'spotting', cycleStart: false }]);
  expect(mocks.write).toHaveBeenCalledWith({ startDate: '2026-09-14', endDate: '2026-09-14', flow: 'clear', cycleStart: false });
});
