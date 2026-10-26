import { createHash, webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ init: vi.fn(), signIn: vi.fn(), exchange: vi.fn(), getSession: vi.fn(),
  from: vi.fn(), update: vi.fn(), eq: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  auth: { signInWithIdToken: mocks.exchange, getSession: mocks.getSession }, from: mocks.from,
} }));
vi.mock('@/lib/tr', () => ({ tr: (_key: string, fallback: string) => fallback }));
let browser: any;
const session = { user: { id: 'verified-apple-user' } };
const result = { user: session.user, session };
const response = () => ({ authorization: { state: mocks.init.mock.lastCall![0].state, id_token: 'synthetic-apple-id-token' } });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
beforeEach(() => {
  vi.resetModules(); vi.resetAllMocks();
  vi.stubEnv('MODE', 'azure');
  vi.stubEnv('VITE_AZURE_APPLE_OAUTH_ENABLED', 'true');
  vi.stubEnv('VITE_SUPABASE_URL', 'https://api.anacan.az');
  browser = { location: { origin: 'https://api.anacan.az' }, AppleID: { auth: { init: mocks.init, signIn: mocks.signIn } } };
  vi.stubGlobal('window', browser); vi.stubGlobal('crypto', webcrypto);
  mocks.signIn.mockImplementation(async () => response());
  mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
  mocks.exchange.mockResolvedValue({ data: result, error: null });
  const query = { update: mocks.update, eq: mocks.eq,
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: null, error: null }).then(resolve) };
  mocks.from.mockReturnValue(query); mocks.update.mockReturnValue(query); mocks.eq.mockReturnValue(query);
});
afterEach(() => {
  vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks();
  document.querySelectorAll('script[src*="appleid.cdn-apple.com"]').forEach(script => script.remove());
});

describe('Azure Apple web ID-token boundary', () => {
  it('opens synchronously in the click gesture and sends hashed nonce to Apple / raw nonce to GoTrue', async () => {
    const auth = await import('./apple-web-auth');
    await auth.prepareAppleWebSignIn();
    const login = auth.signInWithAppleWeb();
    expect(mocks.signIn).toHaveBeenCalledOnce(); // Before even one microtask/await by the caller.
    expect(mocks.exchange).not.toHaveBeenCalled();
    await expect(login).resolves.toEqual(result);
    const config = mocks.init.mock.lastCall![0];
    const payload = mocks.exchange.mock.lastCall![0];
    expect(config).toMatchObject({ clientId: 'com.atlasoon.anacan.signin', redirectURI: 'https://api.anacan.az/auth/apple/callback',
      scope: 'name email', usePopup: true });
    expect(config.state).toMatch(/^[a-f0-9]{64}$/);
    expect(payload).toEqual({ provider: 'apple', token: 'synthetic-apple-id-token', nonce: expect.stringMatching(/^[a-f0-9]{64}$/) });
    expect(config.nonce).toBe(createHash('sha256').update(payload.nonce).digest('hex'));
    expect(config.nonce).not.toBe(payload.nonce);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it.each([undefined, '', 'wrong-state'])('rejects missing/mismatched state %s before any session exchange', async state => {
    const auth = await import('./apple-web-auth');
    await auth.prepareAppleWebSignIn();
    mocks.signIn.mockResolvedValue({ authorization: { state, id_token: 'synthetic-apple-id-token' } });
    await expect(auth.signInWithAppleWeb()).rejects.toMatchObject({ code: 'APPLE_RESPONSE_INVALID' });
    expect(mocks.getSession).not.toHaveBeenCalled(); expect(mocks.exchange).not.toHaveBeenCalled();
  });

  it.each([undefined, '', 123, 'x'.repeat(16385)])('rejects invalid ID-token payload shape %#', async token => {
    const auth = await import('./apple-web-auth');
    await auth.prepareAppleWebSignIn();
    mocks.signIn.mockImplementation(async () => ({ authorization: { state: mocks.init.mock.lastCall![0].state, id_token: token } }));
    await expect(auth.signInWithAppleWeb()).rejects.toMatchObject({ code: 'APPLE_RESPONSE_INVALID' });
    expect(mocks.exchange).not.toHaveBeenCalled();
  });

  it('allows only one in-flight popup and never reuses a consumed attempt', async () => {
    const auth = await import('./apple-web-auth');
    await auth.prepareAppleWebSignIn();
    const pending = deferred<ReturnType<typeof response>>();
    mocks.signIn.mockReturnValue(pending.promise);
    const first = auth.signInWithAppleWeb();
    await expect(auth.signInWithAppleWeb()).rejects.toMatchObject({ code: 'APPLE_BUSY' });
    expect(mocks.signIn).toHaveBeenCalledOnce();
    pending.resolve(response()); await first;
    await expect(auth.signInWithAppleWeb()).rejects.toMatchObject({ code: 'APPLE_NOT_READY' });
    expect(mocks.exchange).toHaveBeenCalledOnce();
  });

  it('rejects a replay from a previous popup after preparing a fresh state/nonce', async () => {
    const auth = await import('./apple-web-auth');
    await auth.prepareAppleWebSignIn(); await auth.signInWithAppleWeb();
    const old = response(), oldConfig = mocks.init.mock.lastCall![0];
    await auth.prepareAppleWebSignIn(); mocks.signIn.mockResolvedValue(old);
    await expect(auth.signInWithAppleWeb()).rejects.toMatchObject({ code: 'APPLE_RESPONSE_INVALID' });
    expect(mocks.init.mock.lastCall![0].state).not.toBe(oldConfig.state);
    expect(mocks.init.mock.lastCall![0].nonce).not.toBe(oldConfig.nonce);
    expect(mocks.exchange).toHaveBeenCalledOnce();
  });

  it('ignores a successful late popup response after the auth screen is disposed', async () => {
    const auth = await import('./apple-web-auth');
    await auth.prepareAppleWebSignIn();
    const pending = deferred<ReturnType<typeof response>>(); mocks.signIn.mockReturnValue(pending.promise);
    const login = auth.signInWithAppleWeb(); auth.cancelAppleWebSignIn(); pending.resolve(response());
    await expect(login).rejects.toMatchObject({ code: 'APPLE_CANCELLED' });
    expect(mocks.exchange).not.toHaveBeenCalled();
  });

  it('does not overwrite a session that changed while the popup was open', async () => {
    const auth = await import('./apple-web-auth'); await auth.prepareAppleWebSignIn();
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'another-user' } } }, error: null });
    await expect(auth.signInWithAppleWeb()).rejects.toMatchObject({ code: 'APPLE_ACCOUNT_CHANGED' });
    expect(mocks.exchange).not.toHaveBeenCalled(); expect(mocks.from).not.toHaveBeenCalled();
  });

  it('checks cancellation again after asynchronous session lookup', async () => {
    const auth = await import('./apple-web-auth'); await auth.prepareAppleWebSignIn();
    mocks.getSession.mockImplementation(async () => { auth.cancelAppleWebSignIn(); return { data: { session: null }, error: null }; });
    await expect(auth.signInWithAppleWeb()).rejects.toMatchObject({ code: 'APPLE_CANCELLED' });
    expect(mocks.exchange).not.toHaveBeenCalled();
  });

  it('expires a prepared attempt without opening a popup', async () => {
    const auth = await import('./apple-web-auth'); await auth.prepareAppleWebSignIn();
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 5 * 60_000 + 1);
    await expect(auth.signInWithAppleWeb()).rejects.toMatchObject({ code: 'APPLE_NOT_READY' });
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it('times out an abandoned popup and never exchanges its later token', async () => {
    const auth = await import('./apple-web-auth'); await auth.prepareAppleWebSignIn(); vi.useFakeTimers();
    const pending = deferred<ReturnType<typeof response>>(); mocks.signIn.mockReturnValue(pending.promise);
    const login = auth.signInWithAppleWeb();
    const rejected = expect(login).rejects.toMatchObject({ code: 'APPLE_CANCELLED' });
    await vi.advanceTimersByTimeAsync(5 * 60_000); await rejected;
    pending.resolve(response()); await Promise.resolve();
    expect(mocks.exchange).not.toHaveBeenCalled();
  });

  it.each([
    ['popup_closed_by_user', 'APPLE_CANCELLED'], ['user_cancelled_authorize', 'APPLE_CANCELLED'],
    ['popup_blocked_by_browser', 'APPLE_POPUP_BLOCKED'], ['unknown', 'APPLE_SIGN_IN_FAILED'],
  ])('sanitizes SDK error %s and does not exchange tokens', async (code, expected) => {
    const auth = await import('./apple-web-auth'); await auth.prepareAppleWebSignIn();
    mocks.signIn.mockRejectedValue({ error: code, message: 'sensitive-provider-response', id_token: 'synthetic-sensitive-token' });
    const error = await auth.signInWithAppleWeb().catch(error => error);
    expect(error.code).toBe(expected);
    expect(String(error) + JSON.stringify(error) + auth.appleWebErrorMessage(error)).not.toMatch(/sensitive/);
    expect(mocks.exchange).not.toHaveBeenCalled();
  });

  it('does not trust an Apple response when GoTrue rejects it, or leak its error payload', async () => {
    const auth = await import('./apple-web-auth'); await auth.prepareAppleWebSignIn();
    mocks.exchange.mockResolvedValue({ data: { user: null, session: null }, error: { message: 'sensitive-token-payload' } });
    const error = await auth.signInWithAppleWeb().catch(error => error);
    expect(error.code).toBe('APPLE_EXCHANGE_FAILED'); expect(String(error)).not.toContain('sensitive');
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('binds a first-login name update only to the verified user and default placeholder', async () => {
    const auth = await import('./apple-web-auth'); await auth.prepareAppleWebSignIn();
    mocks.signIn.mockImplementation(async () => ({ ...response(), user: { name: { firstName: ' Fixture ', lastName: ' User ' } } }));
    await expect(auth.signInWithAppleWeb()).resolves.toEqual(result);
    expect(mocks.from).toHaveBeenCalledExactlyOnceWith('profiles');
    expect(mocks.update).toHaveBeenCalledExactlyOnceWith({ name: 'Fixture User' });
    expect(mocks.eq.mock.calls).toEqual([['user_id', 'verified-apple-user'], ['name', 'İstifadəçi']]);
    expect(mocks.exchange.mock.invocationCallOrder[0]).toBeLessThan(mocks.update.mock.invocationCallOrder[0]);
  });
});

describe('scope and SDK preparation', () => {
  it.each([
    ['source mode', () => vi.stubEnv('MODE', 'production')],
    ['flag off', () => vi.stubEnv('VITE_AZURE_APPLE_OAUTH_ENABLED', 'false')],
    ['native iOS', () => { browser.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios' }; }],
    ['native Android', () => { browser.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android' }; }],
    ['foreign site', () => { browser.location.origin = 'https://api.anacan.az.attacker.example'; }],
    ['preview FQDN', () => { browser.location.origin = 'https://anacan-gateway.grayocean-6fd65b89.westeurope.azurecontainerapps.io'; }],
    ['source backend', () => vi.stubEnv('VITE_SUPABASE_URL', 'https://tntbjulojatnrqmylorp.supabase.co')],
    ['backend path', () => vi.stubEnv('VITE_SUPABASE_URL', 'https://api.anacan.az/other')],
  ])('refuses %s before SDK loading or token exchange', async (_label, configure) => {
    configure(); browser.AppleID = undefined;
    const auth = await import('./apple-web-auth');
    await expect(auth.prepareAppleWebSignIn()).rejects.toBeInstanceOf(auth.AppleWebAuthError);
    await expect(auth.signInWithAppleWeb()).rejects.toBeInstanceOf(auth.AppleWebAuthError);
    expect(document.querySelector('script[src*="appleid.cdn-apple.com"]')).toBeNull();
    expect(mocks.exchange).not.toHaveBeenCalled();
  });

  it('allows the existing Azure gateway as backend on the canonical user-facing origin', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://anacan-gateway.grayocean-6fd65b89.westeurope.azurecontainerapps.io');
    const auth = await import('./apple-web-auth'); await auth.prepareAppleWebSignIn();
    await expect(auth.signInWithAppleWeb()).resolves.toEqual(result);
  });

  it('deduplicates SDK loading and supports a retry after a network/script failure', async () => {
    browser.AppleID = undefined;
    const auth = await import('./apple-web-auth');
    const first = auth.prepareAppleWebSignIn(), second = auth.prepareAppleWebSignIn();
    const failures = Promise.all([expect(first).rejects.toMatchObject({ code: 'APPLE_SDK_UNAVAILABLE' }),
      expect(second).rejects.toMatchObject({ code: 'APPLE_SDK_UNAVAILABLE' })]);
    const scripts = document.querySelectorAll('script[src*="appleid.cdn-apple.com"]');
    expect(scripts).toHaveLength(1); scripts[0].dispatchEvent(new Event('error')); await failures;
    expect(document.querySelector('script[src*="appleid.cdn-apple.com"]')).toBeNull();
    const retry = auth.prepareAppleWebSignIn();
    browser.AppleID = { auth: { init: mocks.init, signIn: mocks.signIn } };
    document.querySelector('script[src*="appleid.cdn-apple.com"]')!.dispatchEvent(new Event('load'));
    await retry; await expect(auth.signInWithAppleWeb()).resolves.toEqual(result);
  });
});
