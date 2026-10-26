import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';

const mocks = vi.hoisted(() => ({ native: vi.fn(), get: vi.fn(), set: vi.fn(), remove: vi.fn(),
  getSession: vi.fn(), refresh: vi.fn(), subscribe: vi.fn(), signOut: vi.fn(), backend: {} as any }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: mocks.native } }));
vi.mock('@capacitor/preferences', () => ({ Preferences: { get: mocks.get, set: mocks.set, remove: mocks.remove } }));
vi.mock('@/integrations/supabase/backend-config', () => ({ getBackendConfig: () => mocks.backend }));
vi.mock('@/integrations/supabase/client', () => ({
  authStorage: { realm: 'https://tntbjulojatnrqmylorp.supabase.co', storageKey: 'sb-tntbjulojatnrqmylorp-auth-token', allowLegacyFallback: true },
  supabase: { auth: { getSession: mocks.getSession, refreshSession: mocks.refresh, onAuthStateChange: mocks.subscribe, signOut: mocks.signOut } },
}));
const API = 'https://api.anacan.az', SOURCE = 'https://tntbjulojatnrqmylorp.supabase.co';
const KEY = `anacan.auth.adoption.v1:${encodeURIComponent(API)}`;
const BACKUP = `anacan.auth.session.v2:${encodeURIComponent(SOURCE)}`;
const handoff = 'a'.repeat(64), user = '10000000-0000-4000-8000-000000000001';
const session = (origin: string, id = user) => ({ access_token: `${origin}-access`, refresh_token: `${origin}-refresh`, user: { id } });
const pair = value => ({ access_token: value.access_token, refresh_token: value.refresh_token });
const response = (value: any, error: any = null) => ({ data: { session: value }, error });
const prefs = new Map<string, string>();
let local: any, listener: (event: string, value: any) => void;
const run = async () => (await import('./session-persistence')).restoreAdmittedNativeSession();

beforeEach(() => {
  vi.resetModules(); vi.resetAllMocks(); prefs.clear();
  local = session('source');
  mocks.backend = { url: API, sourceFirst: true, azure: true, admission: { policy: { handoffSha256: handoff } } };
  mocks.native.mockReturnValue(true);
  mocks.get.mockImplementation(async ({ key }) => ({ value: prefs.get(key) ?? null }));
  mocks.set.mockImplementation(async ({ key, value }) => { prefs.set(key, value); });
  mocks.remove.mockImplementation(async ({ key }) => { prefs.delete(key); });
  mocks.getSession.mockImplementation(async () => response(local));
  mocks.subscribe.mockImplementation(callback => { listener = callback; return { data: { subscription: { unsubscribe: vi.fn() } } }; });
  mocks.refresh.mockImplementation(async () => { local = session('azure'); listener('TOKEN_REFRESHED', local); return response(local); });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

it('exchanges an unexpired cached Source JWT before completing the first target handoff', async () => {
  await run();
  expect(mocks.refresh).toHaveBeenCalledExactlyOnceWith();
  expect(JSON.parse(prefs.get(KEY)!)).toEqual({ schema: 'anacan-auth-adoption-v1', state: 'complete', handoff, userId: user });
  expect(JSON.parse(prefs.get(BACKUP)!).session).toEqual(pair(session('azure')));
});

it('keeps normal offline-capable cached startup after the same handoff is complete', async () => {
  await run();
  vi.resetModules(); mocks.refresh.mockClear();
  await run();
  expect(mocks.refresh).not.toHaveBeenCalled();
  expect(local).toEqual(session('azure'));
});

it('requires a new grant for a different handoff receipt', async () => {
  prefs.set(KEY, JSON.stringify({ schema: 'anacan-auth-adoption-v1', state: 'complete', handoff: 'b'.repeat(64), userId: user }));
  await run();
  expect(mocks.refresh).toHaveBeenCalledTimes(1);
});

it.each([
  new AuthRetryableFetchError('offline', 503),
  new AuthApiError('missing migration row', 400, 'refresh_token_not_found'),
  new AuthApiError('unrecognized source JWT', 403, 'bad_jwt'),
])('blocks the app and preserves a source candidate on initial adoption failure: $code', async error => {
  mocks.refresh.mockResolvedValueOnce(response(null, error));
  await expect(run()).rejects.toThrow('NATIVE_SESSION_RECOVERY_PENDING');
  expect(JSON.parse(prefs.get(BACKUP)!).session).toEqual(pair(session('source')));
  expect(JSON.parse(prefs.get(KEY)!).state).toBe('pending');
  await run();
  expect(JSON.parse(prefs.get(KEY)!).state).toBe('complete');
});

it('does not erase a backup when the SDK initial refresh reports a missing target session', async () => {
  prefs.set(BACKUP, JSON.stringify({ realm: SOURCE, session: pair(session('source')) }));
  mocks.getSession.mockResolvedValueOnce(response(null, new AuthApiError('missing', 400, 'session_not_found')));
  await expect(run()).rejects.toThrow('NATIVE_SESSION_RECOVERY_PENDING');
  expect(JSON.parse(prefs.get(BACKUP)!).session).toEqual(pair(session('source')));
  expect(prefs.has(KEY)).toBe(false);
});

it('recovers a source backup with a real grant and completes adoption before use', async () => {
  local = null;
  prefs.set('anacan.auth.session.v1', JSON.stringify(pair(session('source'))));
  await run();
  expect(mocks.refresh.mock.calls[0]).toEqual([{ refresh_token: 'source-refresh' }]);
  expect(mocks.refresh).toHaveBeenLastCalledWith();
  expect(JSON.parse(prefs.get(KEY)!).state).toBe('complete');
});

it('does not restore a logged-out source backup or require a grant for a fresh install', async () => {
  local = null;
  prefs.set(BACKUP, JSON.stringify({ realm: SOURCE, session: null }));
  prefs.set('anacan.auth.session.v1', JSON.stringify(pair(session('source'))));
  await run();
  expect(mocks.refresh).not.toHaveBeenCalled();
  expect(JSON.parse(prefs.get(KEY)!)).toMatchObject({ state: 'complete', userId: null });
});

it('never commits a target handoff into a different account and keeps the expected UUID on retry', async () => {
  mocks.refresh.mockImplementationOnce(async () => {
    local = session('wrong', '10000000-0000-4000-8000-000000000002');
    listener('TOKEN_REFRESHED', local); return response(local);
  });
  await expect(run()).rejects.toThrow('NATIVE_SESSION_RECOVERY_PENDING');
  expect(JSON.parse(prefs.get(KEY)!)).toMatchObject({ state: 'pending', userId: user });
  await expect(run()).rejects.toThrow('NATIVE_SESSION_RECOVERY_PENDING');
  expect(mocks.refresh).toHaveBeenCalledTimes(1);
});

it('requires a durable rotated backup before recording completion', async () => {
  mocks.set.mockImplementation(async ({ key, value }) => {
    if (key === BACKUP && value.includes('azure-refresh')) throw new Error('private storage failure');
    prefs.set(key, value);
  });
  await expect(run()).rejects.toThrow('NATIVE_SESSION_RECOVERY_PENDING');
  expect(JSON.parse(prefs.get(KEY)!).state).toBe('pending');
});

it.each(['not-json', JSON.stringify({ schema: 'unknown', state: 'complete', handoff })])('fails closed on corrupt completion state', async value => {
  prefs.set(KEY, value);
  await expect(run()).rejects.toThrow('NATIVE_SESSION_RECOVERY_PENDING');
  expect(mocks.refresh).not.toHaveBeenCalled();
});

it('coalesces concurrent first-handoff boot requests', async () => {
  const { restoreAdmittedNativeSession } = await import('./session-persistence');
  await Promise.all([restoreAdmittedNativeSession(), restoreAdmittedNativeSession()]);
  expect(mocks.refresh).toHaveBeenCalledTimes(1);
});

it('leaves the existing source boot path outside target adoption', async () => {
  mocks.backend = { ...mocks.backend, azure: false, url: SOURCE };
  await run();
  expect(mocks.refresh).not.toHaveBeenCalled();
  expect(prefs.has(KEY)).toBe(false);
});
