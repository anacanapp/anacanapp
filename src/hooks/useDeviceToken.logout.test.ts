import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ eq: vi.fn(), del: vi.fn(), from: vi.fn(), getToken: vi.fn(), deleteToken: vi.fn(),
  checkPermissions: vi.fn(), unregister: vi.fn() }));
vi.mock('@/lib/native', () => ({ isNative: true, isIOS: true, isAndroid: false }));
vi.mock('@/lib/tr', () => ({ tr: (_key: string, fallback: string) => fallback }));
vi.mock('./useAuth', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: mocks.from } }));
vi.mock('@capacitor-firebase/messaging', () => ({ FirebaseMessaging: {
  getToken: mocks.getToken, deleteToken: mocks.deleteToken, checkPermissions: mocks.checkPermissions } }));
vi.mock('@capacitor/push-notifications', () => ({ PushNotifications: { unregister: mocks.unregister } }));
import { unregisterDeviceForLogout } from './useDeviceToken';

beforeEach(() => {
  vi.resetAllMocks();
  const chain = { eq: (...args: unknown[]) => { mocks.eq(...args); return chain; },
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve) };
  mocks.from.mockReturnValue({ delete: () => { mocks.del(); return chain; } });
  mocks.checkPermissions.mockResolvedValue({ receive: 'granted' });
  mocks.getToken.mockResolvedValue({ token: 'fcm-token-fixture' });
  mocks.deleteToken.mockResolvedValue(undefined);
});

it('deletes only this device row for this account, then drops the FCM token', async () => {
  await unregisterDeviceForLogout('user-a');
  expect(mocks.from).toHaveBeenCalledWith('device_tokens');
  expect(mocks.eq.mock.calls).toEqual([['user_id', 'user-a'], ['token', 'fcm-token-fixture']]);
  expect(mocks.deleteToken).toHaveBeenCalledOnce();
});

it('never prompts for push permission during logout', async () => {
  mocks.checkPermissions.mockResolvedValue({ receive: 'prompt' });
  await unregisterDeviceForLogout('user-a');
  expect(mocks.getToken).not.toHaveBeenCalled();
  expect(mocks.del).not.toHaveBeenCalled();
});

it('falls back to the push plugin unregister when Firebase Messaging is unavailable', async () => {
  mocks.deleteToken.mockRejectedValue(new Error('unavailable'));
  await unregisterDeviceForLogout('user-a');
  expect(mocks.unregister).toHaveBeenCalledOnce();
});
