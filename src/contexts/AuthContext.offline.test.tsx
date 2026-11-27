import { createElement, type ReactNode } from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AuthProvider, useAuthContext } from './AuthContext';

const mocks = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- loose store fixture
  const store: Record<string, any> = { language: 'en', hasSelectedLanguage: true, userId: null };
  for (const key of ['setAuth', 'setRole', 'setLifeStage', 'setOnboarded', 'setLastPeriodDate', 'setCycleLength',
    'setPeriodLength', 'setDueDate', 'setBabyData', 'setMultiplesData', 'setDeliveryType', 'setPartnerCode', 'setLinkedPartnerId',
    'logout', 'setLanguage', 'setHasSelectedLanguage']) store[key] = vi.fn();
  return { store, from: vi.fn(), getSession: vi.fn(), flush: vi.fn(), stored: new Map<string, string>(),
    cache: new Map<string, unknown>(), listener: null as ((event: string, session: unknown) => Promise<void> | void) | null };
});
vi.mock('@/integrations/supabase/client', () => ({
  authStorage: { storageKey: 'sb-test-auth-token', storage: { getItem: (key: string) => mocks.stored.get(key) ?? null } },
  supabase: {
    from: mocks.from,
    auth: {
      signOut: vi.fn(),
      getSession: mocks.getSession,
      onAuthStateChange: (listener: typeof mocks.listener) => {
        mocks.listener = listener;
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
    },
  },
}));
vi.mock('@/store/userStore', () => ({ useUserStore: Object.assign(
  (selector: (state: object) => unknown) => selector(mocks.store), { getState: () => mocks.store },
) }));
vi.mock('@/lib/offlineCache', () => ({
  readCache: (key: string, userId: string) => mocks.cache.get(`${key}:${userId}`) ?? null,
  writeCache: () => {}, clearAllCaches: () => {},
}));
vi.mock('@/lib/offline-outbox', () => ({ flushOutbox: mocks.flush }));
vi.mock('@/lib/tr', () => ({ tr: (_key: string, fallback: string) => fallback }));
vi.mock('@/lib/analytics', () => ({ analytics: { setUserId: () => {}, setUserProperties: () => {} } }));
vi.mock('@/lib/mixpanel', () => ({ identifyUser: () => {}, setSuperProperties: () => {}, resetMixpanel: () => {} }));
vi.mock('@/lib/revenuecat', () => ({ identifyUser: () => {}, logOutRevenueCat: () => {} }));
vi.mock('@/lib/user-timezone', () => ({ syncUserTimeZone: () => {} }));
vi.mock('@/lib/logout-cleanup', () => ({ runLogoutCleanup: vi.fn() }));

const KEY = 'sb-test-auth-token';
const user = { id: 'user-a', email: 'a@example.invalid', user_metadata: { name: 'Fixture' }, app_metadata: {},
  created_at: '2025-01-01T00:00:00Z', last_sign_in_at: '2026-01-01T00:00:00Z' };
const expired = { access_token: 'old', refresh_token: 'r1', expires_at: Math.floor(Date.now() / 1000) - 3600, user };
const cachedProfile = { id: 'p', user_id: 'user-a', name: 'Fixture', life_stage: 'mommy', baby_count: 1 };
const offlineQuery = () => ({
  select() { return this; }, eq() { return this; }, upsert: () => Promise.resolve({ error: null }),
  maybeSingle: () => Promise.reject(new TypeError('offline')),
  then: (_resolve: unknown, reject: (e: unknown) => unknown) => Promise.reject(new TypeError('offline')).catch(reject),
});
const onlineQuery = (table: string) => {
  const rows = table === 'profiles' ? [cachedProfile] : table === 'user_roles' ? [{ role: 'user' }] : [{ language: 'en' }];
  return {
    select() { return this; }, eq() { return this; }, upsert: () => Promise.resolve({ error: null }),
    maybeSingle: () => Promise.resolve({ data: rows[0], error: null }),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(resolve),
  };
};

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client }, createElement(AuthProvider, null, children));
let online = true;

beforeEach(() => {
  vi.resetAllMocks();
  mocks.stored.clear(); mocks.cache.clear(); mocks.listener = null;
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.from.mockImplementation(offlineQuery);
  mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
  mocks.flush.mockResolvedValue({ sent: 0, failed: 0, dropped: 0, tables: [] });
  online = true;
  vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online);
  client = new QueryClient();
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

it('opens read-only on the stored account when the expired token cannot be refreshed offline', async () => {
  online = false;
  mocks.stored.set(KEY, JSON.stringify(expired));
  mocks.cache.set('profile:user-a', cachedProfile);
  const { result } = renderHook(useAuthContext, { wrapper });
  // Before the SDK gives up on its refresh retries.
  await waitFor(() => expect(result.current.user?.id).toBe('user-a'));
  expect(result.current.loading).toBe(false);
  expect(result.current.profileLoaded).toBe(true);
  expect(result.current.profile).toMatchObject({ life_stage: 'mommy' });
  expect(mocks.store.setAuth).toHaveBeenCalledWith(true, 'user-a', 'a@example.invalid', 'Fixture');
  // The SDK then reports no session (retryable refresh failure; it kept the stored one).
  await act(async () => { await mocks.listener?.('INITIAL_SESSION', null); });
  expect(result.current.user?.id).toBe('user-a');
  expect(mocks.store.logout).not.toHaveBeenCalled();
  expect(mocks.from).not.toHaveBeenCalled();
});

it('still logs out when no session is stored (real invalid token: Auth removed it)', async () => {
  const { result } = renderHook(useAuthContext, { wrapper });
  await act(async () => { await mocks.listener?.('INITIAL_SESSION', null); });
  expect(result.current.user).toBeNull();
  expect(mocks.store.logout).toHaveBeenCalled();
});

it('clears the offline account on SIGNED_OUT after an invalid refresh token', async () => {
  online = false;
  mocks.stored.set(KEY, JSON.stringify(expired));
  const { result } = renderHook(useAuthContext, { wrapper });
  await waitFor(() => expect(result.current.user?.id).toBe('user-a'));
  mocks.stored.clear();
  await act(async () => { await mocks.listener?.('SIGNED_OUT', null); });
  expect(result.current.user).toBeNull();
  expect(mocks.store.logout).toHaveBeenCalled();
});

it('refreshes when the network returns, then hydrates from the server and flushes the outbox', async () => {
  online = false;
  mocks.stored.set(KEY, JSON.stringify(expired));
  const { result } = renderHook(useAuthContext, { wrapper });
  await waitFor(() => expect(result.current.user?.id).toBe('user-a'));
  await act(async () => { await mocks.listener?.('INITIAL_SESSION', null); });

  online = true;
  mocks.from.mockImplementation(onlineQuery);
  await act(async () => { window.dispatchEvent(new Event('online')); });
  expect(mocks.getSession).toHaveBeenCalled();

  const fresh = { ...expired, access_token: 'new', refresh_token: 'r2', expires_at: Math.floor(Date.now() / 1000) + 3600 };
  await act(async () => { await mocks.listener?.('TOKEN_REFRESHED', fresh); });
  await waitFor(() => expect(mocks.flush).toHaveBeenCalledWith('user-a'));
  await waitFor(() => expect(result.current.profile).toMatchObject({ life_stage: 'mommy' }));
  expect(mocks.from.mock.calls.map(([table]) => table)).toContain('profiles');
  expect(result.current.session?.access_token).toBe('new');
});

it('does not open on the stored account while a valid (unexpired) session loads normally', async () => {
  online = false;
  mocks.stored.set(KEY, JSON.stringify({ ...expired, expires_at: Math.floor(Date.now() / 1000) + 3600 }));
  const { result } = renderHook(useAuthContext, { wrapper });
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(result.current.user).toBeNull();
  expect(mocks.store.setAuth).not.toHaveBeenCalled();
});
