import { act, render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CustomerIoSession from './CustomerIoSession';

const state = vi.hoisted(() => ({ user: null as { id: string } | null, language: 'az',
  backend: 'https://backend.example.test', setIdentity: vi.fn().mockResolvedValue(undefined),
  preference: vi.fn(), enabled: true }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: state.user }) }));
vi.mock('@/store/userStore', () => ({ useUserStore: (selector: any) => selector({ language: state.language }) }));
vi.mock('@/integrations/supabase/backend-config', () => ({ getBackendConfig: () => ({ url: state.backend }) }));
vi.mock('@/lib/customerio', () => ({ customerIo: { setIdentity: state.setIdentity },
  get customerIoEnabled() { return state.enabled; }, CUSTOMER_IO_CONSENT_EVENT: 'anacan:analytics-consent-changed' }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => ({ select: () => ({
  eq: (_column: string, actor: string) => ({ maybeSingle: () => state.preference(actor) }),
}) }) } }));

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const tree = () => <QueryClientProvider client={client}><CustomerIoSession /></QueryClientProvider>;
  const rendered = render(tree());
  return { ...rendered, rerenderSession: () => rendered.rerender(tree()) };
}
beforeEach(() => {
  vi.clearAllMocks(); state.enabled = true; state.user = null; state.language = 'az';
  state.preference.mockResolvedValue({ data: { privacy_share_analytics: true }, error: null });
});
describe('Customer.io existing auth lifecycle', () => {
  it('identifies a restored session only after its analytics preference is loaded', async () => {
    state.user = { id: 'integration-test-restored' };
    const view = mount();
    expect(state.setIdentity).toHaveBeenCalledWith(null);
    await waitFor(() => expect(state.setIdentity).toHaveBeenLastCalledWith({ userId: state.user!.id,
      backend: state.backend, language: 'az', consent: true }));
    view.unmount();
    expect(state.setIdentity).toHaveBeenLastCalledWith(null);
  });
  it('identifies after login and clears identity on logout', async () => {
    const view = mount();
    expect(state.preference).not.toHaveBeenCalled();
    state.user = { id: 'integration-test-login' }; view.rerenderSession();
    await waitFor(() => expect(state.setIdentity).toHaveBeenLastCalledWith(expect.objectContaining({ userId: 'integration-test-login' })));
    state.user = null; view.rerenderSession();
    await waitFor(() => expect(state.setIdentity).toHaveBeenLastCalledWith(null));
  });
  it('does not apply a delayed preference result to another account', async () => {
    let finish!: (value: unknown) => void;
    state.preference.mockImplementation((actor: string) => actor === 'integration-test-alice'
      ? new Promise(resolve => { finish = resolve; })
      : Promise.resolve({ data: { privacy_share_analytics: false }, error: null }));
    state.user = { id: 'integration-test-alice' };
    const view = mount();
    await waitFor(() => expect(finish).toBeTypeOf('function'));
    state.user = { id: 'integration-test-bob' }; view.rerenderSession();
    await act(async () => { finish({ data: { privacy_share_analytics: true }, error: null }); });
    expect(state.setIdentity.mock.calls.every(([identity]) => identity === null)).toBe(true);
  });
  it('honors live opt-out and ignores events for other accounts', async () => {
    state.user = { id: 'integration-test-consent' };
    mount();
    await waitFor(() => expect(state.setIdentity).toHaveBeenLastCalledWith(expect.objectContaining({ consent: true })));
    act(() => window.dispatchEvent(new CustomEvent('anacan:analytics-consent-changed', {
      detail: { userId: 'different-user', backend: state.backend, allowed: false },
    })));
    expect(state.setIdentity).toHaveBeenLastCalledWith(expect.objectContaining({ consent: true }));
    act(() => window.dispatchEvent(new CustomEvent('anacan:analytics-consent-changed', {
      detail: { userId: state.user!.id, backend: state.backend, allowed: false },
    })));
    await waitFor(() => expect(state.setIdentity).toHaveBeenLastCalledWith(null));
  });
  it('does not fetch preferences or identify on unconfigured/web builds', () => {
    state.enabled = false; state.user = { id: 'integration-test-web' };
    mount();
    expect(state.preference).not.toHaveBeenCalled();
    expect(state.setIdentity).toHaveBeenLastCalledWith(null);
  });
});
