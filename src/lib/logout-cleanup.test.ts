import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ native: vi.fn(), getPending: vi.fn(), cancel: vi.fn(), removeDelivered: vi.fn(), unregister: vi.fn() }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: mocks.native } }));
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: {
  getPending: mocks.getPending, cancel: mocks.cancel, removeAllDeliveredNotifications: mocks.removeDelivered } }));
vi.mock('@/hooks/useDeviceToken', () => ({ unregisterDeviceForLogout: mocks.unregister }));
import { runLogoutCleanup } from './logout-cleanup';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.native.mockReturnValue(true);
  mocks.getPending.mockResolvedValue({ notifications: [{ id: 11 }, { id: 42 }] });
  mocks.cancel.mockResolvedValue(undefined);
  mocks.removeDelivered.mockResolvedValue(undefined);
  mocks.unregister.mockResolvedValue(undefined);
});
afterEach(() => { vi.useRealTimers(); });

it('cancels every pending reminder and unregisters this device for the signed-out account', async () => {
  await runLogoutCleanup('user-a');
  expect(mocks.cancel).toHaveBeenCalledWith({ notifications: [{ id: 11 }, { id: 42 }] });
  expect(mocks.removeDelivered).toHaveBeenCalledOnce();
  expect(mocks.unregister).toHaveBeenCalledWith('user-a', expect.any(Number));
});

it('never throws when a step fails', async () => {
  mocks.getPending.mockRejectedValue(new Error('bridge'));
  mocks.unregister.mockRejectedValue(new Error('network'));
  await expect(runLogoutCleanup('user-a')).resolves.toBeUndefined();
});

it('is bounded when a native bridge or request hangs', async () => {
  vi.useFakeTimers();
  mocks.getPending.mockReturnValue(new Promise(() => {}));
  mocks.unregister.mockReturnValue(new Promise(() => {}));
  let done = false;
  void runLogoutCleanup('user-a', 1000).then(() => { done = true; });
  await vi.advanceTimersByTimeAsync(2600);
  expect(done).toBe(true);
});

it('does nothing to local notifications on the web', async () => {
  mocks.native.mockReturnValue(false);
  await runLogoutCleanup(null);
  expect(mocks.getPending).not.toHaveBeenCalled();
  expect(mocks.unregister).not.toHaveBeenCalled();
});
