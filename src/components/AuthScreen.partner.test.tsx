import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AuthScreen from './AuthScreen';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(), from: vi.fn(), signUp: vi.fn(), signIn: vi.fn(), getSession: vi.fn(),
  toast: vi.fn(), reload: vi.fn(), update: vi.fn(),
  google: vi.fn(), apple: vi.fn(), prepareApple: vi.fn(), cancelApple: vi.fn(),
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  rpc: mocks.rpc, from: mocks.from, auth: { getSession: mocks.getSession },
} }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ signUp: mocks.signUp, signIn: mocks.signIn,
  signInWithGoogle: mocks.google, signInWithApple: mocks.apple }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/lib/apple-web-auth', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/apple-web-auth')>(),
  prepareAppleWebSignIn: mocks.prepareApple, cancelAppleWebSignIn: mocks.cancelApple,
}));
vi.mock('@/hooks/useAppBranding', () => ({ useAppBranding: () => ({ data: [] }), getBrandingUrl: () => undefined }));
vi.mock('@/hooks/useAppSettings', () => ({ useAppSetting: () => false }));
vi.mock('@/store/userStore', () => ({ useUserStore: (selector: (state: object) => unknown) => selector({ countryCode: 'AZ', setCountryCode: () => {} }) }));
vi.mock('@/lib/tr', () => ({ tr: (key: string, fallback: string) => key.startsWith('authscreen_') ? key : fallback }));
vi.mock('@/components/CountrySelect', () => ({ default: () => <div>Country</div> }));
vi.mock('@/components/ui/scroll-area', () => ({ ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('framer-motion', async () => {
  const { createElement, forwardRef } = await import('react');
  const motion = Object.fromEntries(['div', 'form', 'p', 'button'].map((tag) => [tag, forwardRef((props: any, ref) => {
    const { initial, animate, exit, variants, transition, whileTap, whileHover, ...rest } = props;
    return createElement(tag, { ...rest, ref });
  })]));
  return { motion, AnimatePresence: ({ children }: { children: React.ReactNode }) => children };
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('VITE_AZURE_PARTNER_PAIRING', 'true');
  vi.stubGlobal('location', { origin: 'https://azure.example.invalid', reload: mocks.reload });
  mocks.signUp.mockResolvedValue({ data: { user: { id: 'registered-user' } }, error: null });
  mocks.signIn.mockResolvedValue({ data: {}, error: null });
  mocks.google.mockResolvedValue({ data: {}, error: null });
  mocks.apple.mockResolvedValue({ data: {}, error: null });
  mocks.prepareApple.mockResolvedValue(undefined);
  mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'registered-user' } } }, error: null });
  mocks.rpc.mockImplementation((name: string) => Promise.resolve({
    error: null,
    data: name === 'find_partner_by_code'
      ? [{ id: 'target-profile', user_id: 'target-user', name: 'Fixture target', is_premium: false }]
      : name === 'link_partners' ? true : { ok: true },
  }));
  const query = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), update: mocks.update,
    maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'my-profile' }, error: null }),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: null, error: null }).then(resolve),
  };
  mocks.update.mockReturnValue(query);
  mocks.from.mockReturnValue(query);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function openRegistration(code = 'ANACAN-ABCD2345') {
  const view = render(<AuthScreen />);
  fireEvent.click(screen.getByRole('button', { name: /authscreen_partnyor_bolmesi_ed393a/ }));
  fireEvent.change(screen.getByPlaceholderText('E-mail'), { target: { value: 'pairing@example.invalid' } });
  fireEvent.change(screen.getByPlaceholderText('authscreen_sifre_6771ac'), { target: { value: 'Fixture-password!23' } });
  const input = screen.getByPlaceholderText('ANACAN-XXXX');
  fireEvent.change(input, { target: { value: code } });
  return { ...view, form: input.closest('form')! };
}

describe('Azure provider availability', () => {
  it('keeps unconfigured Azure providers inactive without calling auth', () => {
    vi.stubEnv('MODE', 'azure');
    vi.stubEnv('VITE_AZURE_GOOGLE_OAUTH_ENABLED', undefined);
    vi.stubEnv('VITE_AZURE_APPLE_OAUTH_ENABLED', undefined);
    render(<AuthScreen />);
    const google = screen.getByRole('button', { name: 'authscreen_google_ile_davam_et' });
    const apple = screen.getByRole('button', { name: 'authscreen_apple_ile_davam_et' });
    expect(google).toBeDisabled(); expect(apple).toBeDisabled();
    fireEvent.click(google); fireEvent.click(apple);
    expect(mocks.google).not.toHaveBeenCalled(); expect(mocks.apple).not.toHaveBeenCalled();
  });

  it('opens only the explicitly configured Google path in Azure', async () => {
    vi.stubEnv('MODE', 'azure');
    vi.stubEnv('VITE_AZURE_GOOGLE_OAUTH_ENABLED', 'true');
    vi.stubEnv('VITE_AZURE_APPLE_OAUTH_ENABLED', 'false');
    render(<AuthScreen />);
    const google = screen.getByRole('button', { name: 'authscreen_google_ile_davam_et' });
    const apple = screen.getByRole('button', { name: 'authscreen_apple_ile_davam_et' });
    expect(google).toBeEnabled(); expect(apple).toBeDisabled();
    fireEvent.click(google);
    await waitFor(() => expect(mocks.google).toHaveBeenCalledOnce());
    expect(mocks.apple).not.toHaveBeenCalled();
    expect(mocks.signUp).not.toHaveBeenCalled();
  });

  it('preserves source-build provider availability despite Azure-only flags', () => {
    vi.stubEnv('MODE', 'production');
    vi.stubEnv('VITE_AZURE_GOOGLE_OAUTH_ENABLED', 'false');
    vi.stubEnv('VITE_AZURE_APPLE_OAUTH_ENABLED', 'false');
    render(<AuthScreen />);
    expect(screen.getByRole('button', { name: 'authscreen_google_ile_davam_et' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'authscreen_apple_ile_davam_et' })).toBeEnabled();
    expect(mocks.prepareApple).not.toHaveBeenCalled();
  });

  it('keeps Apple inactive until SDK/nonce preparation, without blocking Google or email login', async () => {
    vi.stubEnv('MODE', 'azure'); vi.stubEnv('VITE_AZURE_GOOGLE_OAUTH_ENABLED', 'true');
    vi.stubEnv('VITE_AZURE_APPLE_OAUTH_ENABLED', 'true');
    let ready!: () => void;
    mocks.prepareApple.mockReturnValueOnce(new Promise<void>(resolve => { ready = resolve; }));
    render(<AuthScreen />);
    const apple = screen.getByRole('button', { name: 'authscreen_apple_ile_davam_et' });
    expect(apple).toBeDisabled();
    expect(screen.getByRole('button', { name: 'authscreen_google_ile_davam_et' })).toBeEnabled();
    expect(screen.getByPlaceholderText('E-mail')).toBeEnabled();
    fireEvent.click(apple); expect(mocks.apple).not.toHaveBeenCalled();
    await act(async () => { ready(); });
    expect(apple).toBeEnabled();
    fireEvent.click(apple);
    await waitFor(() => expect(mocks.apple).toHaveBeenCalledOnce());
  });

  it('allows a failed SDK preparation to be retried on the canonical site', async () => {
    vi.stubEnv('MODE', 'azure'); vi.stubEnv('VITE_AZURE_APPLE_OAUTH_ENABLED', 'true');
    vi.stubGlobal('location', { origin: 'https://api.anacan.az', reload: mocks.reload });
    mocks.prepareApple.mockRejectedValueOnce(new Error('script blocked'));
    render(<AuthScreen />);
    const retry = await screen.findByRole('button', { name: 'Yenidən hazırla' });
    expect(screen.getByRole('button', { name: 'authscreen_apple_ile_davam_et' })).toBeDisabled();
    fireEvent.click(retry);
    await waitFor(() => expect(screen.getByRole('button', { name: 'authscreen_apple_ile_davam_et' })).toBeEnabled());
    expect(mocks.prepareApple).toHaveBeenCalledTimes(2);
  });

  it('treats closing the Apple popup as cancellation and prepares a fresh retry', async () => {
    vi.stubEnv('MODE', 'azure'); vi.stubEnv('VITE_AZURE_APPLE_OAUTH_ENABLED', 'true');
    const { AppleWebAuthError } = await import('@/lib/apple-web-auth');
    mocks.apple.mockResolvedValue({ data: null, error: new AppleWebAuthError('APPLE_CANCELLED') });
    render(<AuthScreen />);
    const apple = screen.getByRole('button', { name: 'authscreen_apple_ile_davam_et' });
    await waitFor(() => expect(apple).toBeEnabled());
    fireEvent.click(apple);
    await waitFor(() => expect(mocks.prepareApple).toHaveBeenCalledTimes(2));
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it('disposes pending Apple sign-in when the auth screen unmounts', async () => {
    vi.stubEnv('MODE', 'azure'); vi.stubEnv('VITE_AZURE_APPLE_OAUTH_ENABLED', 'true');
    const view = render(<AuthScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'authscreen_apple_ile_davam_et' })).toBeEnabled());
    view.unmount(); expect(mocks.cancelApple).toHaveBeenCalledOnce();
  });
});

describe('partner registration routing', () => {
  it('keeps the legacy Supabase lookup, profile update and UUID RPC when not opted in', async () => {
    vi.stubEnv('VITE_AZURE_PARTNER_PAIRING', undefined);
    vi.useFakeTimers();
    const { form } = openRegistration('ANACAN-A01F');
    await act(async () => { fireEvent.submit(form); });
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(mocks.rpc).toHaveBeenNthCalledWith(1, 'find_partner_by_code', { p_partner_code: 'ANACAN-A01F' });
    expect(mocks.update).toHaveBeenCalledExactlyOnceWith({ linked_partner_id: 'target-profile', life_stage: 'partner' });
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, 'link_partners', {
      p_my_profile_id: 'my-profile', p_partner_profile_id: 'target-profile', p_partner_user_id: 'target-user',
    });
    expect(mocks.reload).toHaveBeenCalledOnce();
  });

  it('rejects a legacy invitation before signup, without anonymous profile lookup', async () => {
    const { form } = openRegistration('ANACAN-A01F');
    fireEvent.submit(form);
    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
    expect(mocks.toast.mock.calls[0][0].title).toContain('share a new code');
    expect(mocks.signUp).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('registers then sends only the normalized code to the authenticated RPC', async () => {
    const { form } = openRegistration('  anacan-abcd2345  ');
    fireEvent.submit(form);
    await waitFor(() => expect(mocks.reload).toHaveBeenCalledOnce());
    expect(mocks.signUp).toHaveBeenCalledExactlyOnceWith('pairing@example.invalid', 'Fixture-password!23', 'Partner', 'AZ');
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('link_partner_by_code', { p_partner_code: 'ANACAN-ABCD2345' });
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith({ title: 'Partner linked successfully.' });
  });

  it('allows an editable retry after signup and AuthScreen unmount, without registering again', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { ok: false, error: 'PAIRING_CONFLICT' }, error: null });
    const view = openRegistration();
    fireEvent.submit(view.form);
    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
    const failure = mocks.toast.mock.calls[0][0];
    expect(failure.title).toContain('not complete');
    expect(failure.duration).toBe(Infinity);
    expect(mocks.reload).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
    view.unmount();
    render(failure.description);
    fireEvent.change(screen.getByRole('textbox', { name: 'Partner invitation code' }), { target: { value: 'ANACAN-BCDE2345' } });
    fireEvent.click(screen.getByRole('button', { name: 'Retry pairing' }));
    await waitFor(() => expect(mocks.reload).toHaveBeenCalledOnce());
    expect(mocks.rpc).toHaveBeenLastCalledWith('link_partner_by_code', { p_partner_code: 'ANACAN-BCDE2345' });
    expect(mocks.signUp).toHaveBeenCalledOnce();
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it('offers sign-in on retry when signup requires email confirmation', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
    const view = openRegistration();
    fireEvent.submit(view.form);
    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
    expect(mocks.rpc).not.toHaveBeenCalled();
    const failure = mocks.toast.mock.calls[0][0];
    view.unmount();
    render(failure.description);
    mocks.getSession.mockResolvedValueOnce({ data: { session: null }, error: null })
      .mockResolvedValue({ data: { session: { user: { id: 'registered-user' } } }, error: null });
    fireEvent.click(screen.getByRole('button', { name: 'Retry pairing' }));
    await waitFor(() => expect(mocks.reload).toHaveBeenCalledOnce());
    expect(mocks.signIn).toHaveBeenCalledExactlyOnceWith('pairing@example.invalid', 'Fixture-password!23');
    expect(mocks.signUp).toHaveBeenCalledOnce();
  });

  it('does not link a different account after session switching', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'different-user' } } }, error: null });
    const { form } = openRegistration();
    fireEvent.submit(form);
    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.reload).not.toHaveBeenCalled();
  });

  it.each(['PGRST202', '42501'])('never reports success or uses legacy writes after %s', async (code) => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code, message: 'RPC unavailable' } });
    const { form } = openRegistration();
    fireEvent.submit(form);
    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
    expect(mocks.toast.mock.calls[0][0].title).toContain('not complete');
    expect(mocks.rpc).toHaveBeenCalledOnce();
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.reload).not.toHaveBeenCalled();
  });

  it('does not pair when signup fails', async () => {
    mocks.signUp.mockResolvedValue({ data: null, error: { code: 'user_already_exists' } });
    const { form } = openRegistration();
    fireEvent.submit(form);
    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.reload).not.toHaveBeenCalled();
  });

  it('leaves existing partner login code-free even when opted in', async () => {
    openRegistration();
    fireEvent.click(screen.getByRole('button', { name: 'authscreen_giris_1ffbd7' }));
    fireEvent.submit(screen.getByPlaceholderText('E-mail').closest('form')!);
    await waitFor(() => expect(mocks.signIn).toHaveBeenCalledOnce());
    expect(mocks.signUp).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
