import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ setSession: vi.fn(), exchange: vi.fn(), signInWithOAuth: vi.fn(), close: vi.fn(), open: vi.fn(),
  addListener: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {
  setSession: mocks.setSession, exchangeCodeForSession: mocks.exchange, signInWithOAuth: mocks.signInWithOAuth } } }));
vi.mock('@capacitor/core', () => ({ registerPlugin: () => ({ close: mocks.close, open: mocks.open }) }));
vi.mock('@capacitor/app', () => ({ App: { addListener: mocks.addListener } }));

import { completeNativeOAuthCallback, isNativeOAuthCallback, NATIVE_OAUTH_REDIRECT, parseNativeOAuthCallback,
  signInWithGoogleBrowserFallback } from './native-auth';
import { parseDeeplink } from './deeplink';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.setSession.mockResolvedValue({ error: null });
  mocks.exchange.mockResolvedValue({ error: null });
  mocks.close.mockResolvedValue(undefined);
  mocks.addListener.mockResolvedValue({ remove: vi.fn() });
});

describe('Google browser OAuth fallback', () => {
  it('recognises and parses the app callback (implicit and PKCE)', () => {
    const url = `${NATIVE_OAUTH_REDIRECT}#access_token=a.b.c&refresh_token=r1&token_type=bearer`;
    expect(isNativeOAuthCallback(url)).toBe(true);
    expect(isNativeOAuthCallback('anacan://tool/baby-names')).toBe(false);
    expect(parseNativeOAuthCallback(url)).toMatchObject({ accessToken: 'a.b.c', refreshToken: 'r1' });
    expect(parseNativeOAuthCallback(`${NATIVE_OAUTH_REDIRECT}?code=xyz`).code).toBe('xyz');
    expect(parseNativeOAuthCallback(`${NATIVE_OAUTH_REDIRECT}?error=access_denied`).error).toBe('access_denied');
  });

  it('the generic deeplink router ignores the auth callback', () => {
    expect(parseDeeplink(`${NATIVE_OAUTH_REDIRECT}#access_token=a&refresh_token=b`)).toBeNull();
  });

  it('stores the session from the callback', async () => {
    await expect(completeNativeOAuthCallback(`${NATIVE_OAUTH_REDIRECT}#access_token=t&refresh_token=r`)).resolves.toBe(true);
    expect(mocks.setSession).toHaveBeenCalledWith({ access_token: 't', refresh_token: 'r' });
    await expect(completeNativeOAuthCallback(`${NATIVE_OAUTH_REDIRECT}?code=c1`)).resolves.toBe(true);
    expect(mocks.exchange).toHaveBeenCalledWith('c1');
    await expect(completeNativeOAuthCallback(`${NATIVE_OAUTH_REDIRECT}?error=access_denied`)).resolves.toBe(false);
    await expect(completeNativeOAuthCallback('https://evil.example/#access_token=t&refresh_token=r')).resolves.toBe(false);
  });

  it('opens Supabase OAuth outside the WebView with the app redirect', async () => {
    mocks.signInWithOAuth.mockResolvedValue({ data: { url: 'https://api.example/auth/v1/authorize?provider=google' }, error: null });
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    await signInWithGoogleBrowserFallback();
    expect(mocks.signInWithOAuth).toHaveBeenCalledWith(expect.objectContaining({ provider: 'google',
      options: expect.objectContaining({ redirectTo: NATIVE_OAUTH_REDIRECT, skipBrowserRedirect: true }) }));
    expect(mocks.addListener).toHaveBeenCalledWith('appUrlOpen', expect.any(Function));
    expect(open).toHaveBeenCalledWith('https://api.example/auth/v1/authorize?provider=google', '_blank', 'noopener,noreferrer');
    open.mockRestore();
  });
});
