import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const store: Record<string, any> = { language: 'az', hasSelectedLanguage: true };
  for (const key of ['setAuth', 'setRole', 'setLifeStage', 'setOnboarded', 'setLastPeriodDate', 'setCycleLength',
    'setPeriodLength', 'setDueDate', 'setBabyData', 'setMultiplesData', 'setDeliveryType', 'setPartnerCode', 'setLinkedPartnerId',
    'logout', 'setLanguage', 'setHasSelectedLanguage']) store[key] = vi.fn();
  return { store, web: vi.fn(), native: vi.fn(), oauth: vi.fn(), report: vi.fn() };
});
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {
  onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }), signInWithOAuth: mocks.oauth,
} } }));
vi.mock('@/store/userStore', () => ({ useUserStore: Object.assign(
  (selector: (state: object) => unknown) => selector(mocks.store), { getState: () => mocks.store },
) }));
vi.mock('@/lib/offlineCache', () => ({ readCache: () => null, writeCache: () => {}, clearAllCaches: () => {} }));
vi.mock('@/lib/tr', () => ({ tr: (_key: string, fallback: string) => fallback }));
vi.mock('@/lib/analytics', () => ({ analytics: { logLogin: () => {} } }));
vi.mock('@/lib/crashReporter', () => ({ reportAuthError: mocks.report }));
vi.mock('@/lib/native-auth', () => ({ signInWithAppleNative: mocks.native }));
vi.mock('@/lib/apple-web-auth', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/apple-web-auth')>(), signInWithAppleWeb: mocks.web,
}));

beforeEach(() => {
  vi.resetModules(); vi.resetAllMocks();
  vi.stubEnv('MODE', 'azure'); vi.stubEnv('VITE_AZURE_APPLE_OAUTH_ENABLED', 'true');
  vi.stubGlobal('Capacitor', undefined);
  mocks.web.mockResolvedValue({ user: { id: 'azure-apple-user' } });
  mocks.native.mockResolvedValue({ user: { id: 'native-apple-user' } });
  mocks.oauth.mockResolvedValue({ data: { url: 'https://provider.example.invalid' }, error: null });
});
afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
async function auth() {
  const { AuthProvider, useAuthContext } = await import('./AuthContext');
  return renderHook(useAuthContext, { wrapper: AuthProvider });
}

describe('Apple routing remains platform/build scoped', () => {
  it('uses the Azure browser ID-token helper without redirect/code OAuth', async () => {
    const { result } = await auth();
    await act(async () => { await expect(result.current.signInWithApple()).resolves.toMatchObject({ data: { user: { id: 'azure-apple-user' } }, error: null }); });
    expect(mocks.web).toHaveBeenCalledOnce(); expect(mocks.oauth).not.toHaveBeenCalled(); expect(mocks.native).not.toHaveBeenCalled();
  });

  it('preserves the source web OAuth path even if the Azure flag is present', async () => {
    vi.stubEnv('MODE', 'production');
    const { result } = await auth();
    await act(async () => { await result.current.signInWithApple(); });
    expect(mocks.oauth).toHaveBeenCalledExactlyOnceWith({ provider: 'apple', options: { redirectTo: window.location.origin } });
    expect(mocks.web).not.toHaveBeenCalled(); expect(mocks.native).not.toHaveBeenCalled();
  });

  it('preserves native iOS Apple authentication in an Azure build', async () => {
    vi.stubGlobal('Capacitor', { isNativePlatform: () => true, getPlatform: () => 'ios' });
    const { result } = await auth();
    await act(async () => { await expect(result.current.signInWithApple()).resolves.toMatchObject({ data: { user: { id: 'native-apple-user' } } }); });
    expect(mocks.native).toHaveBeenCalledOnce(); expect(mocks.web).not.toHaveBeenCalled(); expect(mocks.oauth).not.toHaveBeenCalled();
  });

  it('does not apply the browser SDK to native Android', async () => {
    vi.stubGlobal('Capacitor', { isNativePlatform: () => true, getPlatform: () => 'android' });
    const { result } = await auth();
    await act(async () => { await result.current.signInWithApple(); });
    expect(mocks.oauth).toHaveBeenCalledOnce(); expect(mocks.web).not.toHaveBeenCalled(); expect(mocks.native).not.toHaveBeenCalled();
  });

  it('never falls back to OAuth or logs a provider payload on an Azure JS failure', async () => {
    mocks.web.mockRejectedValue({ error: 'unexpected', id_token: 'sensitive-provider-token' });
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = await auth();
    let outcome: any;
    await act(async () => { outcome = await result.current.signInWithApple(); });
    expect(outcome).toMatchObject({ data: null, error: { code: 'APPLE_SIGN_IN_FAILED' } });
    expect(JSON.stringify(outcome)).not.toContain('sensitive');
    expect(mocks.oauth).not.toHaveBeenCalled(); expect(log).not.toHaveBeenCalled(); expect(mocks.report).not.toHaveBeenCalled();
  });

  it('keeps Google web sign-in on the existing OAuth route', async () => {
    const { result } = await auth();
    await act(async () => { await result.current.signInWithGoogle(); });
    expect(mocks.oauth).toHaveBeenCalledExactlyOnceWith({ provider: 'google', options: { redirectTo: window.location.origin } });
    expect(mocks.web).not.toHaveBeenCalled();
  });
});
