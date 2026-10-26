import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthApiError, AuthRetryableFetchError, AuthSessionMissingError } from '@supabase/supabase-js';
import { LEGACY_AUTH_STORAGE_KEY, SOURCE_AUTH_REALM } from '@/integrations/supabase/auth-storage-key';

const mocks = vi.hoisted(() => {
  const signOut = vi.fn();
  return {
    native: vi.fn(), get: vi.fn(), set: vi.fn(), remove: vi.fn(), signOut,
    auth: { getSession: vi.fn(), refreshSession: vi.fn(), setSession: vi.fn(),
      onAuthStateChange: vi.fn(), signOut },
    config: { realm: '', storageKey: '', allowLegacyFallback: false,
      storage: { removeItem: vi.fn() } },
  };
});
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: mocks.native } }));
vi.mock('@capacitor/preferences', () => ({ Preferences: {
  get: mocks.get, set: mocks.set, remove: mocks.remove,
} }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: mocks.auth }, authStorage: mocks.config }));

const LEGACY = 'anacan.auth.session.v1';
const AZURE = 'https://anacan-gateway.example.azurecontainerapps.io';
const backupKey = (realm = mocks.config.realm) => `anacan.auth.session.v2:${encodeURIComponent(realm)}`;
const pair = (id: string) => ({ access_token: `access-${id}`, refresh_token: `refresh-${id}` });
const old = pair('old');
const fresh = pair('fresh');
const response = (session = null, error = null) => ({ data: { session }, error });
const prefs = new Map<string, string>();
let listener: (event: string, session: any) => void;
const emit = (event: string, session: any = null) => listener(event, session);
const stored = () => JSON.parse(prefs.get(backupKey()) ?? 'null');
const putBackup = (session: unknown, realm = mocks.config.realm) =>
  prefs.set(backupKey(realm), JSON.stringify({ realm, session }));
const load = () => import('./session-persistence');

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  prefs.clear();
  localStorage.clear();
  mocks.native.mockReturnValue(true);
  Object.assign(mocks.config, {
    realm: SOURCE_AUTH_REALM, storageKey: LEGACY_AUTH_STORAGE_KEY, allowLegacyFallback: true,
  });
  mocks.auth.signOut = mocks.signOut;
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.config.storage.removeItem.mockImplementation((key) => localStorage.removeItem(key));
  mocks.get.mockImplementation(async ({ key }) => ({ value: prefs.get(key) ?? null }));
  mocks.set.mockImplementation(async ({ key, value }) => { prefs.set(key, value); });
  mocks.remove.mockImplementation(async ({ key }) => { prefs.delete(key); });
  mocks.auth.getSession.mockResolvedValue(response());
  mocks.auth.refreshSession.mockImplementation(async () => {
    emit('TOKEN_REFRESHED', fresh);
    return response(fresh);
  });
  mocks.auth.onAuthStateChange.mockImplementation((callback) => {
    listener = callback;
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

it('does nothing on web and preserves the SDK signOut API', async () => {
  mocks.native.mockReturnValue(false);
  const persistence = await load();
  persistence.startNativeSessionSync();
  await persistence.restoreNativeSession();
  expect(mocks.auth.signOut).toBe(mocks.signOut);
  expect(mocks.auth.onAuthStateChange).not.toHaveBeenCalled();
  expect(mocks.auth.getSession).not.toHaveBeenCalled();
  expect(mocks.get).not.toHaveBeenCalled();
});

it('keeps the current SDK session ahead of any backup and stores only the token pair', async () => {
  prefs.set(LEGACY, JSON.stringify(old));
  mocks.auth.getSession.mockResolvedValue(response({ ...fresh, user: { id: 'u1' } }));
  const persistence = await load();
  await persistence.restoreNativeSession();
  persistence.startNativeSessionSync();
  expect(stored()).toEqual({ realm: SOURCE_AUTH_REALM, session: fresh });
  expect(prefs.has(LEGACY)).toBe(false);
  expect(mocks.auth.refreshSession).not.toHaveBeenCalled();
  expect(mocks.auth.onAuthStateChange).toHaveBeenCalledTimes(1);
});

it('recovers the eligible v1 backup only through a real refresh grant and saves the rotated pair', async () => {
  prefs.set(LEGACY, JSON.stringify(old));
  await (await load()).restoreNativeSession();
  expect(mocks.auth.refreshSession).toHaveBeenCalledExactlyOnceWith({ refresh_token: old.refresh_token });
  expect(mocks.auth.setSession).not.toHaveBeenCalled();
  expect(stored()).toEqual({ realm: SOURCE_AUTH_REALM, session: fresh });
  expect(prefs.has(LEGACY)).toBe(false);
});

it('uses the realm-bound backup ahead of the legacy fallback', async () => {
  putBackup(fresh);
  prefs.set(LEGACY, JSON.stringify(old));
  await (await load()).restoreNativeSession();
  expect(mocks.auth.refreshSession).toHaveBeenCalledExactlyOnceWith({ refresh_token: fresh.refresh_token });
});

it('never restores source backups into standalone Azure preview', async () => {
  putBackup(old, SOURCE_AUTH_REALM);
  prefs.set(LEGACY, JSON.stringify(old));
  Object.assign(mocks.config, { realm: AZURE, storageKey: 'sb-anacan-gateway-auth-token', allowLegacyFallback: false });
  const persistence = await load();
  await persistence.restoreNativeSession();
  emit('INITIAL_SESSION');
  expect(mocks.get).toHaveBeenCalledExactlyOnceWith({ key: backupKey(AZURE) });
  expect(mocks.auth.refreshSession).not.toHaveBeenCalled();
  expect(prefs.size).toBe(2);
});

it('maintains an Azure realm backup without erasing the old source backup', async () => {
  prefs.set(LEGACY, JSON.stringify(old));
  Object.assign(mocks.config, { realm: AZURE, storageKey: 'sb-anacan-gateway-auth-token', allowLegacyFallback: false });
  mocks.auth.getSession.mockResolvedValue(response(fresh));
  await (await load()).restoreNativeSession();
  expect(stored()).toEqual({ realm: AZURE, session: fresh });
  expect(prefs.get(LEGACY)).toBe(JSON.stringify(old));
});

it.each([
  'null', 'not-json', JSON.stringify({ realm: AZURE, session: old }),
  JSON.stringify({ realm: SOURCE_AUTH_REALM, session: null }),
  JSON.stringify({ realm: SOURCE_AUTH_REALM, session: { access_token: 'a', refresh_token: 7 } }),
])('does not fall back from a tombstone or malformed/mismatched realm record: %s', async (value) => {
  prefs.set(backupKey(), value);
  prefs.set(LEGACY, JSON.stringify(old));
  await (await load()).restoreNativeSession();
  expect(mocks.auth.refreshSession).not.toHaveBeenCalled();
  expect(mocks.get).toHaveBeenCalledTimes(1);
  expect(prefs.get(backupKey())).toBe(value);
  expect(prefs.has(LEGACY)).toBe(true);
});

it('fails closed on Preferences read errors without trying v1 or removing credentials', async () => {
  prefs.set(LEGACY, JSON.stringify(old));
  mocks.get.mockRejectedValueOnce(new Error('private error payload'));
  await (await load()).restoreNativeSession();
  expect(mocks.auth.refreshSession).not.toHaveBeenCalled();
  expect(mocks.remove).not.toHaveBeenCalled();
  expect(mocks.set).not.toHaveBeenCalled();
});

describe.each(['query', 'refresh'] as const)('%s nonterminal errors', (stage) => {
  it.each([
    new AuthRetryableFetchError('network', 0),
    new AuthRetryableFetchError('maintenance', 502),
    new AuthRetryableFetchError('maintenance', 503),
    new AuthRetryableFetchError('maintenance', 504),
    new AuthApiError('invalid refresh secret-in-message', 500, 'unexpected_failure'),
    new AuthApiError('rate limited', 429, 'refresh_token_not_found'),
    new AuthApiError('signature configuration', 401, 'bad_jwt'),
  ])('retains the backup for $name / $status and ignores null events', async (error) => {
    prefs.set(LEGACY, JSON.stringify(old));
    const method = stage === 'query' ? mocks.auth.getSession : mocks.auth.refreshSession;
    method.mockResolvedValueOnce(response(null, error));
    const persistence = await load();
    await persistence.restoreNativeSession();
    emit('INITIAL_SESSION');
    emit('SIGNED_OUT');
    expect(prefs.get(LEGACY)).toBe(JSON.stringify(old));
    expect(mocks.set).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    if (stage === 'query') expect(mocks.auth.refreshSession).not.toHaveBeenCalled();
  });
});

it('allows a later recovery after a retryable maintenance failure', async () => {
  putBackup(old);
  mocks.auth.refreshSession.mockResolvedValueOnce(response(null, new AuthRetryableFetchError('maintenance', 503)));
  const persistence = await load();
  await persistence.restoreNativeSession();
  expect(stored().session).toEqual(old);
  await persistence.restoreNativeSession();
  expect(stored().session).toEqual(fresh);
});

it.each([
  'refresh_token_not_found', 'refresh_token_already_used', 'session_not_found',
  'session_expired', 'user_banned', 'user_not_found',
])('blocks replay after an authoritative %s', async (code) => {
  prefs.set(LEGACY, JSON.stringify(old));
  mocks.auth.refreshSession.mockImplementationOnce(async () => {
    emit('SIGNED_OUT');
    return response(null, new AuthApiError('sensitive server detail', 400, code));
  });
  const persistence = await load();
  await persistence.restoreNativeSession();
  expect(stored()).toEqual({ realm: SOURCE_AUTH_REALM, session: null });
  expect(prefs.has(LEGACY)).toBe(false);
  await persistence.restoreNativeSession();
  expect(mocks.auth.refreshSession).toHaveBeenCalledTimes(1);
});

it('does not mistake a code-less local query error for revocation', async () => {
  putBackup(old);
  mocks.auth.getSession.mockResolvedValueOnce(response(null, new AuthSessionMissingError()));
  await (await load()).restoreNativeSession();
  expect(stored().session).toEqual(old);
  expect(mocks.auth.refreshSession).not.toHaveBeenCalled();
});

it('never installs a backup on a code-less grant error, whose SDK provenance is ambiguous', async () => {
  putBackup(old);
  mocks.auth.refreshSession.mockResolvedValueOnce(response(null, new AuthSessionMissingError()));
  await (await load()).restoreNativeSession();
  expect(stored().session).toEqual(old);
  expect(mocks.auth.setSession).not.toHaveBeenCalled();
  expect(mocks.set).not.toHaveBeenCalled();
});

it('handles a terminal getSession refresh failure without replaying a different backup', async () => {
  putBackup(old);
  mocks.auth.getSession.mockResolvedValueOnce(response(null,
    new AuthApiError('revoked', 400, 'refresh_token_already_used')));
  await (await load()).restoreNativeSession();
  expect(stored().session).toBeNull();
  expect(mocks.auth.refreshSession).not.toHaveBeenCalled();
});

it.each(['success', 'error', 'throw'])('honors explicit logout on %s, including offline local cleanup', async (outcome) => {
  prefs.set(LEGACY, JSON.stringify(old));
  putBackup(old);
  for (const suffix of ['', '-user', '-code-verifier']) localStorage.setItem(mocks.config.storageKey + suffix, 'old');
  localStorage.setItem('anacan.auth-key.v1:pin', mocks.config.storageKey);
  localStorage.setItem('sb-alternate-auth-token', 'do-not-touch');
  const failure = new AuthRetryableFetchError('offline', 503);
  if (outcome === 'error') mocks.signOut.mockResolvedValueOnce({ error: failure });
  if (outcome === 'throw') mocks.signOut.mockRejectedValueOnce(failure);
  const persistence = await load();
  persistence.startNativeSessionSync();
  const logout = mocks.auth.signOut();
  if (outcome === 'throw') await expect(logout).rejects.toBe(failure);
  else await expect(logout).resolves.toEqual({ error: outcome === 'error' ? failure : null });
  emit('INITIAL_SESSION', old);
  emit('TOKEN_REFRESHED', old);
  await persistence.restoreNativeSession();
  expect(stored().session).toBeNull();
  expect(prefs.has(LEGACY)).toBe(false);
  expect(localStorage.getItem(mocks.config.storageKey)).toBeNull();
  expect(localStorage.getItem('anacan.auth-key.v1:pin')).toBe(mocks.config.storageKey);
  expect(localStorage.getItem('sb-alternate-auth-token')).toBe('do-not-touch');
  expect(mocks.auth.refreshSession).not.toHaveBeenCalled();
});

it('retains a durable logout tombstone across a module restart, even if v1 reappears', async () => {
  const persistence = await load();
  persistence.startNativeSessionSync();
  await mocks.auth.signOut();
  prefs.set(LEGACY, JSON.stringify(old));
  vi.resetModules();
  mocks.auth.signOut = mocks.signOut;
  await (await load()).restoreNativeSession();
  expect(mocks.auth.refreshSession).not.toHaveBeenCalled();
  expect(stored().session).toBeNull();
});

it('does not clear this session for signOut scope others', async () => {
  putBackup(old);
  (await load()).startNativeSessionSync();
  await mocks.auth.signOut({ scope: 'others' });
  expect(mocks.signOut).toHaveBeenCalledExactlyOnceWith({ scope: 'others' });
  expect(stored().session).toEqual(old);
  expect(mocks.set).not.toHaveBeenCalled();
  expect(mocks.config.storage.removeItem).not.toHaveBeenCalled();
});

it('serializes writes so a slow old save cannot overwrite refresh or logout', async () => {
  const firstWrite = deferred<void>();
  mocks.set.mockImplementationOnce(async ({ key, value }) => {
    await firstWrite.promise;
    prefs.set(key, value);
  });
  (await load()).startNativeSessionSync();
  emit('SIGNED_IN', old);
  await vi.waitFor(() => expect(mocks.set).toHaveBeenCalledTimes(1));
  emit('TOKEN_REFRESHED', fresh);
  let finished = false;
  const logout = mocks.auth.signOut().then(() => { finished = true; });
  expect(mocks.set).toHaveBeenCalledTimes(1);
  expect(finished).toBe(false);
  firstWrite.resolve();
  await logout;
  expect(mocks.set.mock.calls.map(([arg]) => JSON.parse(arg.value).session)).toEqual([old, fresh, null]);
  expect(stored().session).toBeNull();
});

it('recovers the write queue after an error without logging credentials', async () => {
  mocks.set.mockRejectedValueOnce(new Error(`private ${old.refresh_token}`));
  (await load()).startNativeSessionSync();
  emit('SIGNED_IN', old);
  emit('TOKEN_REFRESHED', fresh);
  await vi.waitFor(() => expect(stored()?.session).toEqual(fresh));
  expect(console.warn).toHaveBeenCalledExactlyOnceWith('[session-persistence] backup write failed');
});

it('coalesces concurrent boot restores into a single grant', async () => {
  prefs.set(LEGACY, JSON.stringify(old));
  const query = deferred<ReturnType<typeof response>>();
  mocks.auth.getSession.mockReturnValueOnce(query.promise);
  const persistence = await load();
  const first = persistence.restoreNativeSession();
  const second = persistence.restoreNativeSession();
  query.resolve(response());
  await Promise.all([first, second]);
  expect(mocks.auth.getSession).toHaveBeenCalledTimes(1);
  expect(mocks.auth.refreshSession).toHaveBeenCalledTimes(1);
});

it('does not overwrite a newer event with a stale getSession result', async () => {
  const query = deferred<ReturnType<typeof response>>();
  mocks.auth.getSession.mockReturnValueOnce(query.promise);
  const restoring = (await load()).restoreNativeSession();
  emit('TOKEN_REFRESHED', fresh);
  query.resolve(response(old));
  await restoring;
  expect(stored().session).toEqual(fresh);
  expect(mocks.set).toHaveBeenCalledTimes(1);
});

it('does not erase a newer session when an older query reports revocation', async () => {
  const query = deferred<ReturnType<typeof response>>();
  mocks.auth.getSession.mockReturnValueOnce(query.promise);
  const restoring = (await load()).restoreNativeSession();
  emit('SIGNED_IN', fresh);
  query.resolve(response(null, new AuthApiError('old session revoked', 400, 'session_expired')));
  await restoring;
  expect(stored().session).toEqual(fresh);
});

it.each(['refresh', 'logout'])('abandons an old Preferences read after a newer %s', async (event) => {
  const read = deferred<{ value: string | null }>();
  mocks.get.mockReturnValueOnce(read.promise);
  const persistence = await load();
  const restoring = persistence.restoreNativeSession();
  await vi.waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(1));
  if (event === 'logout') await mocks.auth.signOut();
  else emit('TOKEN_REFRESHED', fresh);
  read.resolve({ value: JSON.stringify({ realm: SOURCE_AUTH_REALM, session: old }) });
  await restoring;
  expect(mocks.auth.refreshSession).not.toHaveBeenCalled();
  expect(stored().session).toEqual(event === 'logout' ? null : fresh);
});

it('does not save a refresh completing during explicit logout', async () => {
  putBackup(old);
  const grant = deferred<ReturnType<typeof response>>();
  mocks.auth.refreshSession.mockReturnValueOnce(grant.promise);
  const persistence = await load();
  const restoring = persistence.restoreNativeSession();
  await vi.waitFor(() => expect(mocks.auth.refreshSession).toHaveBeenCalledTimes(1));
  const logout = mocks.auth.signOut();
  emit('TOKEN_REFRESHED', fresh);
  grant.resolve(response(fresh));
  await Promise.all([logout, restoring]);
  expect(stored().session).toBeNull();
});

it('allows a genuine later sign-in after explicit logout', async () => {
  (await load()).startNativeSessionSync();
  await mocks.auth.signOut();
  emit('SIGNED_IN', fresh);
  await vi.waitFor(() => expect(stored()?.session).toEqual(fresh));
  emit('INITIAL_SESSION');
  expect(stored().session).toEqual(fresh);
});

it('holds transition boot on a retryable backup refresh instead of displaying a login form', async () => {
  putBackup(old);
  mocks.auth.refreshSession.mockResolvedValueOnce(response(null, new AuthRetryableFetchError('offline', 503)));
  await expect((await load()).restoreNativeSession({ requireRecovery: true })).rejects.toThrow('NATIVE_SESSION_RECOVERY_PENDING');
  expect(stored().session).toEqual(old);
  expect(mocks.auth.setSession).not.toHaveBeenCalled();
});

it('holds transition boot on a malformed successful grant without installing unverified backup claims', async () => {
  putBackup(old);
  mocks.auth.refreshSession.mockResolvedValueOnce(response());
  await expect((await load()).restoreNativeSession({ requireRecovery: true })).rejects.toThrow('NATIVE_SESSION_RECOVERY_PENDING');
  expect(stored().session).toEqual(old);
  expect(mocks.auth.setSession).not.toHaveBeenCalled();
});

it('still admits a genuinely signed-out device after a terminal revocation in transition mode', async () => {
  putBackup(old);
  mocks.auth.refreshSession.mockResolvedValueOnce(response(null, new AuthApiError('revoked', 400, 'session_expired')));
  await expect((await load()).restoreNativeSession({ requireRecovery: true })).resolves.toBeUndefined();
  expect(stored().session).toBeNull();
});

it('does not require a refresh for a fresh install with no stored credentials', async () => {
  await expect((await load()).restoreNativeSession({ requireRecovery: true })).resolves.toBeUndefined();
  expect(mocks.auth.refreshSession).not.toHaveBeenCalled();
});
