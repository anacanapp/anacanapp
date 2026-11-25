import { createElement, type ReactNode } from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AuthProvider, SAME_USER_REHYDRATE_MS, useAuthContext } from './AuthContext';

const mocks = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- loose store fixture
  const store: Record<string, any> = { language: 'en', hasSelectedLanguage: true, userId: null };
  for (const key of ['setAuth', 'setRole', 'setLifeStage', 'setOnboarded', 'setLastPeriodDate', 'setCycleLength',
    'setPeriodLength', 'setDueDate', 'setBabyData', 'setMultiplesData', 'setDeliveryType', 'setPartnerCode', 'setLinkedPartnerId',
    'logout', 'setLanguage', 'setHasSelectedLanguage']) store[key] = vi.fn();
  return { store, from: vi.fn(), signOut: vi.fn(), cleanup: vi.fn(), order: [] as string[],
    listener: null as ((event: string, session: unknown) => void) | null };
});
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  from: mocks.from,
  auth: {
    signOut: mocks.signOut,
    onAuthStateChange: (listener: typeof mocks.listener) => {
      mocks.listener = listener;
      return { data: { subscription: { unsubscribe: () => {} } } };
    },
  },
} }));
vi.mock('@/store/userStore', () => ({ useUserStore: Object.assign(
  (selector: (state: object) => unknown) => selector(mocks.store), { getState: () => mocks.store },
) }));
vi.mock('@/lib/offlineCache', () => ({ readCache: () => null, writeCache: () => {}, clearAllCaches: () => { mocks.order.push('clearAllCaches'); } }));
vi.mock('@/lib/tr', () => ({ tr: (_key: string, fallback: string) => fallback }));
vi.mock('@/lib/analytics', () => ({ analytics: { setUserId: () => {}, setUserProperties: () => {} } }));
vi.mock('@/lib/mixpanel', () => ({ identifyUser: () => {}, setSuperProperties: () => {}, resetMixpanel: () => {} }));
vi.mock('@/lib/revenuecat', () => ({ identifyUser: () => {}, logOutRevenueCat: () => {} }));
vi.mock('@/lib/user-timezone', () => ({ syncUserTimeZone: () => {} }));
vi.mock('@/lib/logout-cleanup', () => ({ runLogoutCleanup: mocks.cleanup }));

const profileRow = { id: 'p', user_id: 'user-a', name: 'Fixture', life_stage: 'bump', last_period_date: '2026-01-01', due_date: '2026-10-08',
  linked_partner_id: null, partner_code: 'ANACAN-ABCD2345', baby_count: 1 };
function query(table: string) {
  const rows = table === 'profiles' ? [profileRow] : table === 'user_roles' ? [{ role: 'user' }] : [{ language: 'en' }];
  return {
    select() { return this; }, eq() { return this; }, upsert: () => Promise.resolve({ error: null }),
    maybeSingle: () => Promise.resolve({ data: rows[0], error: null }),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(resolve),
  };
}
const session = (token: string, extra: object = {}) => ({ access_token: token, refresh_token: 'r', expires_at: 1, user: {
  id: 'user-a', email: 'a@example.invalid', user_metadata: {}, app_metadata: {},
  created_at: '2025-01-01T00:00:00Z', last_sign_in_at: '2026-01-01T00:00:00Z', ...extra } });

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client }, createElement(AuthProvider, null, children));
const tables = () => mocks.from.mock.calls.map(([table]) => table);

beforeEach(() => {
  vi.resetAllMocks();
  mocks.order.length = 0;
  vi.spyOn(console, 'log').mockImplementation(() => {});
  mocks.from.mockImplementation(query);
  mocks.cleanup.mockImplementation(async () => { mocks.order.push('cleanup'); });
  mocks.signOut.mockImplementation(async () => { mocks.order.push('signOut'); return { error: null }; });
  client = new QueryClient();
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

async function signedIn() {
  const hook = renderHook(useAuthContext, { wrapper });
  await act(async () => { mocks.listener?.('SIGNED_IN', session('t1')); });
  await waitFor(() => expect(hook.result.current.profileLoaded).toBe(true));
  return hook;
}

it('does not re-hydrate or replace the user/profile when SIGNED_IN repeats for the same account on resume', async () => {
  const { result } = await signedIn();
  const user = result.current.user, profile = result.current.profile;
  const fetches = mocks.from.mock.calls.length;
  mocks.store.setLastPeriodDate.mockClear();
  mocks.store.lastPeriodDate = new Date('2026-01-01');
  await act(async () => { mocks.listener?.('SIGNED_IN', session('t1')); mocks.listener?.('SIGNED_IN', session('t1')); });
  expect(mocks.from.mock.calls.length).toBe(fetches);
  expect(result.current.user).toBe(user);
  expect(result.current.profile).toBe(profile);
  // TOKEN_REFRESHED: new session, same user object.
  await act(async () => { mocks.listener?.('TOKEN_REFRESHED', session('t2')); });
  expect(result.current.user).toBe(user);
  expect(result.current.session?.access_token).toBe('t2');
  expect(mocks.store.setLastPeriodDate).not.toHaveBeenCalled();
});

it('refreshes the same account lightly at most every few minutes without the prefs upsert', async () => {
  const { result } = await signedIn();
  const profile = result.current.profile;
  const now = Date.now();
  vi.spyOn(Date, 'now').mockReturnValue(now + SAME_USER_REHYDRATE_MS + 1);
  mocks.from.mockClear();
  await act(async () => { mocks.listener?.('SIGNED_IN', session('t1')); });
  await waitFor(() => expect(tables()).toEqual(expect.arrayContaining(['profiles', 'user_roles'])));
  expect(tables()).not.toContain('user_preferences');
  expect(result.current.profile).toBe(profile); // unchanged row keeps its reference
});

it('hydrates fully when a different account signs in', async () => {
  const { result } = await signedIn();
  mocks.from.mockClear();
  await act(async () => { mocks.listener?.('SIGNED_IN', session('t9', { id: 'user-b' })); });
  await waitFor(() => expect(tables()).toContain('user_preferences'));
  expect(result.current.user?.id).toBe('user-b');
});

it('runs the privacy cleanup before clearing the session and empties the in-memory query cache', async () => {
  const { result } = await signedIn();
  client.setQueryData(['community-feed', 'user-a'], { private: true });
  await act(async () => { await result.current.signOut(); });
  expect(mocks.cleanup).toHaveBeenCalledWith('user-a');
  expect(mocks.order.indexOf('cleanup')).toBeLessThan(mocks.order.indexOf('signOut'));
  expect(mocks.order).toContain('clearAllCaches');
  expect(client.getQueryData(['community-feed', 'user-a'])).toBeUndefined();
  expect(result.current.user).toBeNull();
});

it('still signs out when the cleanup fails', async () => {
  const { result } = await signedIn();
  mocks.cleanup.mockRejectedValue(new Error('bridge'));
  await act(async () => { await expect(result.current.signOut()).resolves.toEqual({ error: null }); });
  expect(mocks.signOut).toHaveBeenCalledOnce();
  expect(result.current.user).toBeNull();
});
