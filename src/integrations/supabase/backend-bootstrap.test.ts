import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ADMISSION_PIN_KEY as PIN, ADMISSION_URL, AZURE_API_ORIGIN as AZURE,
  INITIAL_SOURCE_ADMISSION as SOURCE, advanceAdmission } from './backend-admission';
import { LEGACY_AUTH_STORAGE_KEY as LEGACY, SOURCE_AUTH_REALM } from './auth-storage-key';

const mocks = vi.hoisted(() => ({ native: vi.fn(), get: vi.fn(), set: vi.fn(), fetch: vi.fn(), createClient: vi.fn() }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: mocks.native } }));
vi.mock('@capacitor/preferences', () => ({ Preferences: { get: mocks.get, set: mocks.set } }));
vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createClient }));
vi.mock('./authStorage', () => ({ brokeredPreviewStorage: () => localStorage }));
const prefs = new Map<string, string>();
const azure = { ...SOURCE, generation: 2, phase: 'azure' as const, handoffSha256: 'a'.repeat(64) };
const paused = { ...SOURCE, generation: 1, phase: 'maintenance' as const };
const response = (value: unknown = SOURCE, status = 200, headers = { 'content-type': 'application/json', 'cache-control': 'no-store' }) =>
  ({ status, headers: new Headers(headers), text: async () => JSON.stringify(value) });

beforeEach(() => {
  vi.resetModules(); vi.resetAllMocks(); localStorage.clear(); prefs.clear();
  vi.stubEnv('MODE', 'azure');
  vi.stubEnv('VITE_BACKEND_BOOTSTRAP', 'source-first-v1');
  vi.stubEnv('VITE_SUPABASE_URL', AZURE);
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'synthetic-target-public');
  vi.stubEnv('VITE_SOURCE_SUPABASE_PUBLISHABLE_KEY', 'synthetic-source-public');
  vi.stubEnv('VITE_APP_VERSION', '28.0');
  vi.stubEnv('VITE_AUTH_CUTOVER', 'false');
  vi.stubEnv('VITE_AZURE_PARTNER_PAIRING', 'true');
  vi.stubGlobal('window', { location: { hostname: 'app.anacan.az', protocol: 'https:' }, localStorage,
    addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.stubGlobal('fetch', mocks.fetch);
  mocks.native.mockReturnValue(true);
  mocks.get.mockImplementation(async ({ key }) => ({ value: prefs.get(key) ?? null }));
  mocks.set.mockImplementation(async ({ key, value }) => { prefs.set(key, value); });
  mocks.fetch.mockResolvedValue(response());
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); vi.useRealTimers(); });
const boot = async () => (await import('./backend-bootstrap')).bootstrapBackend();

it('does not construct or refresh a client before admission, including indirect early imports', async () => {
  await expect(import('./client')).rejects.toThrow('ADMISSION_CONFIGURATION');
  expect(mocks.createClient).not.toHaveBeenCalled();
  expect(mocks.fetch).not.toHaveBeenCalled();
});

it('source-first uses the source URL/key/namespace and leaves destination credentials untouched', async () => {
  localStorage.setItem(LEGACY, 'synthetic-source-session');
  localStorage.setItem('sb-api-auth-token', 'different-preview-account');
  prefs.set('anacan.auth.session.v1', 'synthetic-backup');
  await boot();
  expect(mocks.createClient).not.toHaveBeenCalled();
  const { authStorage } = await import('./client');
  const config = await import('./backend-config');
  expect(mocks.createClient).toHaveBeenCalledExactlyOnceWith(SOURCE_AUTH_REALM, 'synthetic-source-public', {
    auth: { storage: localStorage, storageKey: LEGACY, persistSession: true, autoRefreshToken: true },
  });
  expect(authStorage).toMatchObject({ realm: SOURCE_AUTH_REALM, allowLegacyFallback: true });
  expect(config.isAzureBackend()).toBe(false);
  expect(config.isAzurePairingBackend()).toBe(false);
  expect(localStorage.getItem('sb-api-auth-token')).toBe('different-preview-account');
  expect(localStorage.getItem(LEGACY)).toBe('synthetic-source-session');
  expect(prefs.get('anacan.auth.session.v1')).toBe('synthetic-backup');
  expect(mocks.fetch).toHaveBeenCalledExactlyOnceWith(ADMISSION_URL, expect.objectContaining({
    method: 'GET', cache: 'no-store', credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer',
  }));
  expect(mocks.fetch.mock.calls[0][1]).not.toHaveProperty('headers');
  expect(localStorage.getItem(PIN)).toBe(prefs.get(PIN));
});

it('pins a verified target decision before constructing the SDK and preserves the same source namespace', async () => {
  mocks.fetch.mockResolvedValue(response(azure));
  const writes: string[] = [];
  mocks.set.mockImplementation(async ({ key, value }) => { writes.push('pin'); prefs.set(key, value); });
  mocks.createClient.mockImplementation(() => { writes.push('client'); });
  await boot(); await import('./client');
  expect(writes).toEqual(['pin', 'client']);
  expect(mocks.createClient.mock.calls[0]).toEqual([AZURE, 'synthetic-target-public', {
    auth: { storage: localStorage, storageKey: LEGACY, persistSession: true, autoRefreshToken: true },
  }]);
  expect((await import('./backend-config')).isAzurePairingBackend()).toBe(true);
});

it('retains Azure on offline restart when only the native pin survived WebView eviction', async () => {
  prefs.set(PIN, JSON.stringify(advanceAdmission(null, azure)));
  mocks.fetch.mockRejectedValue(new TypeError('offline'));
  await boot(); await import('./client');
  expect(mocks.createClient.mock.calls[0][0]).toBe(AZURE);
  expect(localStorage.getItem(PIN)).toBe(prefs.get(PIN));
});

it.each([401, 403, 404, 408, 429, 503])('retains source on a control-plane %s without probing Azure Auth', async status => {
  mocks.fetch.mockResolvedValue(response(null, status));
  await boot(); await import('./client');
  expect(mocks.createClient.mock.calls[0][0]).toBe(SOURCE_AUTH_REALM);
  expect(mocks.fetch).toHaveBeenCalledTimes(1);
});
it.each([401, 403, 503])('does not roll an admitted Azure device back to Source during a %s outage', async status => {
  prefs.set(PIN, JSON.stringify(advanceAdmission(null, azure)));
  mocks.fetch.mockResolvedValue(response(null, status));
  await boot(); await import('./client');
  expect(mocks.createClient.mock.calls[0][0]).toBe(AZURE);
});
it('starts a new Source-first installation when Azure DNS/network is unavailable', async () => {
  mocks.fetch.mockRejectedValue(new TypeError('network unavailable'));
  await boot(); await import('./client');
  expect(mocks.createClient.mock.calls[0][0]).toBe(SOURCE_AUTH_REALM);
  expect(JSON.parse(prefs.get(PIN)!).authority).toBe('source');
});
it('starts a future Google-native installation on its verified bundled managed admission when control is offline', async () => {
  vi.stubEnv('VITE_NATIVE_BUILD', 'true');
  vi.stubEnv('VITE_INITIAL_MANAGED_ADMISSION', JSON.stringify(azure));
  mocks.fetch.mockRejectedValue(new TypeError('offline'));
  await boot(); await import('./client');
  expect(mocks.createClient.mock.calls[0][0]).toBe(AZURE);
  expect(JSON.parse(prefs.get(PIN)!).authority).toBe('azure');
});
it('keeps a previously observed maintenance decision ahead of a future bundled managed default', async () => {
  vi.stubEnv('VITE_NATIVE_BUILD', 'true');
  vi.stubEnv('VITE_INITIAL_MANAGED_ADMISSION', JSON.stringify(azure));
  prefs.set(PIN, JSON.stringify(advanceAdmission(null, paused)));
  mocks.fetch.mockRejectedValue(new TypeError('offline'));
  await expect(boot()).rejects.toThrow('ADMISSION_MAINTENANCE');
  expect(mocks.createClient).not.toHaveBeenCalled();
});
it('moves an existing Source-only installation to the verified Google-native default during a control outage', async () => {
  vi.stubEnv('VITE_NATIVE_BUILD', 'true');
  vi.stubEnv('VITE_INITIAL_MANAGED_ADMISSION', JSON.stringify(azure));
  prefs.set(PIN, JSON.stringify(advanceAdmission(null, SOURCE)));
  mocks.fetch.mockRejectedValue(new TypeError('offline'));
  await boot(); await import('./client');
  expect(mocks.createClient.mock.calls[0][0]).toBe(AZURE);
  expect(JSON.parse(prefs.get(PIN)!).authority).toBe('azure');
});
it('rejects an obsolete Source control response in a post-cutover Google-native build', async () => {
  vi.stubEnv('VITE_NATIVE_BUILD', 'true');
  vi.stubEnv('VITE_INITIAL_MANAGED_ADMISSION', JSON.stringify(azure));
  mocks.fetch.mockResolvedValue(response(SOURCE));
  await expect(boot()).rejects.toThrow('ADMISSION_ROLLBACK');
  expect(mocks.createClient).not.toHaveBeenCalled();
  expect(mocks.set).not.toHaveBeenCalled();
});
it('blocks an incompatible Source pin instead of choosing Source during an offline Google-default startup', async () => {
  vi.stubEnv('VITE_NATIVE_BUILD', 'true');
  vi.stubEnv('VITE_INITIAL_MANAGED_ADMISSION', JSON.stringify(azure));
  prefs.set(PIN, JSON.stringify(advanceAdmission(null, { ...SOURCE, generation: azure.generation })));
  mocks.fetch.mockRejectedValue(new TypeError('offline'));
  await expect(boot()).rejects.toThrow('ADMISSION_ROLLBACK');
  expect(mocks.createClient).not.toHaveBeenCalled();
  expect(mocks.set).not.toHaveBeenCalled();
});
it('rejects a newer Source response after an older maintenance pin in a Google-default build', async () => {
  vi.stubEnv('VITE_NATIVE_BUILD', 'true');
  vi.stubEnv('VITE_INITIAL_MANAGED_ADMISSION', JSON.stringify(azure));
  prefs.set(PIN, JSON.stringify(advanceAdmission(null, paused)));
  mocks.fetch.mockResolvedValue(response({ ...SOURCE, generation: azure.generation }));
  await expect(boot()).rejects.toThrow('ADMISSION_ROLLBACK');
  expect(mocks.createClient).not.toHaveBeenCalled();
  expect(mocks.set).not.toHaveBeenCalled();
});

it('keeps maintenance latched on offline restart without importing Auth or clearing sessions', async () => {
  mocks.fetch.mockResolvedValue(response(paused));
  localStorage.setItem(LEGACY, 'unchanged-session');
  await expect(boot()).rejects.toThrow('ADMISSION_MAINTENANCE');
  vi.resetModules(); mocks.fetch.mockRejectedValue(new TypeError('offline'));
  await expect(boot()).rejects.toThrow('ADMISSION_MAINTENANCE');
  expect(mocks.createClient).not.toHaveBeenCalled();
  expect(localStorage.getItem(LEGACY)).toBe('unchanged-session');
});

it('refuses a newer source policy after a device has attempted Azure', async () => {
  prefs.set(PIN, JSON.stringify(advanceAdmission(null, azure)));
  mocks.fetch.mockResolvedValue(response({ ...SOURCE, generation: 3 }));
  await expect(boot()).rejects.toThrow('ADMISSION_ROLLBACK');
  expect(mocks.set).not.toHaveBeenCalled();
  expect(mocks.createClient).not.toHaveBeenCalled();
});

it.each(['corrupt-native', 'corrupt-browser', 'native-read', 'native-write', 'browser-write'])
  ('blocks on %s instead of guessing another account/authority', async failure => {
    localStorage.setItem(LEGACY, 'unchanged-session');
    if (failure === 'corrupt-native') prefs.set(PIN, 'corrupt');
    if (failure === 'corrupt-browser') localStorage.setItem(PIN, 'corrupt');
    if (failure === 'native-read') mocks.get.mockRejectedValue(new Error('private-payload'));
    if (failure === 'native-write') mocks.set.mockRejectedValue(new Error('private-payload'));
    if (failure === 'browser-write') vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    await expect(boot()).rejects.toThrow('ADMISSION_STORAGE');
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(localStorage.getItem(LEGACY)).toBe('unchanged-session');
  });

it.each([
  response({ ...azure, handoffSha256: null }), response(SOURCE, 200, { 'content-type': 'text/html', 'cache-control': 'no-store' }),
  response(SOURCE, 200, { 'content-type': 'application/json', 'cache-control': 'public' }), response(SOURCE, 302),
])('refuses invalid published decisions without persisting them', async reply => {
  mocks.fetch.mockResolvedValue(reply);
  await expect(boot()).rejects.toThrow('ADMISSION_INVALID');
  expect(mocks.set).not.toHaveBeenCalled();
  expect(mocks.createClient).not.toHaveBeenCalled();
});

it('coalesces concurrent startup and performs only one authority selection', async () => {
  const { bootstrapBackend } = await import('./backend-bootstrap');
  const first = bootstrapBackend(), second = bootstrapBackend();
  expect(first).toBe(second);
  await Promise.all([first, second]);
  expect(mocks.fetch).toHaveBeenCalledTimes(1);
  expect(mocks.set).toHaveBeenCalledTimes(1);
});

it('never imports an older candidate after the minimum-version gate is observed', async () => {
  mocks.fetch.mockResolvedValue(response({ ...SOURCE, generation: 1, minNativeVersion: '29.0' }));
  await expect(boot()).rejects.toThrow('ADMISSION_UPDATE_REQUIRED');
  expect(mocks.createClient).not.toHaveBeenCalled();
  expect(prefs.has(PIN)).toBe(true);
});

it('does not opt a browser/Lovable preview into native session handoff', async () => {
  mocks.native.mockReturnValue(false);
  await expect(boot()).rejects.toThrow('ADMISSION_CONFIGURATION');
  expect(mocks.get).not.toHaveBeenCalled(); expect(mocks.fetch).not.toHaveBeenCalled();
});

it('leaves non-transition builds on their existing direct backend without control requests', async () => {
  vi.stubEnv('VITE_BACKEND_BOOTSTRAP', undefined);
  await boot(); await import('./client');
  expect(mocks.fetch).not.toHaveBeenCalled(); expect(mocks.get).not.toHaveBeenCalled();
  expect(mocks.createClient.mock.calls[0][0]).toBe(AZURE);
});

it('bounds an unavailable control request and retains source rather than trying Azure', async () => {
  vi.useFakeTimers();
  mocks.fetch.mockImplementation((_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('fixture timeout')));
  }));
  const pending = boot();
  await vi.waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(1));
  await vi.advanceTimersByTimeAsync(4000);
  await pending;
  expect((await import('./backend-config')).getBackendConfig().url).toBe(SOURCE_AUTH_REALM);
});

it('requests one full restart on a published change without rebinding or pinning a live SDK', async () => {
  await boot();
  vi.useFakeTimers();
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  const restart = vi.fn();
  const stop = (await import('./backend-bootstrap')).watchBackendAdmission(restart);
  try {
    mocks.fetch.mockRejectedValueOnce(new TypeError('offline'));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(restart).not.toHaveBeenCalled();
    mocks.fetch.mockResolvedValue(response(azure));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(restart).toHaveBeenCalledTimes(1);
    expect((await import('./backend-config')).getBackendConfig().url).toBe(SOURCE_AUTH_REALM);
    expect(JSON.parse(prefs.get(PIN)!).authority).toBe('source');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(restart).toHaveBeenCalledTimes(1);
  } finally { stop(); }
});
