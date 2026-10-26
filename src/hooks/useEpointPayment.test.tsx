import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEpointPayment } from './useEpointPayment';
import { epointFunctionUrl } from '@/lib/epoint';

const mocks = vi.hoisted(() => ({ session: vi.fn(), fetch: vi.fn(), toast: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { getSession: mocks.session } } }));
vi.mock('@/contexts/AuthContext', () => ({ useAuthContext: () => ({ user: { id: 'fixture-user' } }) }));
vi.mock('sonner', () => ({ toast: { error: mocks.toast } }));
vi.mock('@/lib/tr', () => ({ tr: (_key: string, fallback: string) => fallback }));

const backend = 'https://gateway.example.azurecontainerapps.io';
const request = { amount: 12.5, orderType: 'shop' as const, orderReferenceId: '11111111-1111-4111-8111-111111111111' };
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('VITE_SUPABASE_URL', `${backend}/`);
  vi.stubEnv('VITE_SUPABASE_PROJECT_ID', 'deliberately-wrong-project');
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'fixture-anon');
  vi.stubEnv('MODE', 'azure');
  vi.stubGlobal('fetch', mocks.fetch);
  mocks.session.mockResolvedValue({ data: { session: { access_token: 'fixture-session' } }, error: null });
  mocks.fetch.mockResolvedValue(Response.json({ error: 'function_disabled' }, { status: 503 }));
});
afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('Epoint configured backend and payment uncertainty', () => {
  it('uses the configured Azure URL for checkout and the operator callback', async () => {
    const { result } = renderHook(useEpointPayment);
    await act(async () => { await result.current.initiatePayment(request); });
    expect(mocks.fetch).toHaveBeenCalledExactlyOnceWith(`${backend}/functions/v1/epoint-payment?action=create`, expect.objectContaining({
      method: 'POST', headers: expect.objectContaining({ Authorization: 'Bearer fixture-session', apikey: 'fixture-anon' }),
    }));
    expect(JSON.parse(mocks.fetch.mock.calls[0][1].body)).toMatchObject(request);
    expect(epointFunctionUrl('callback')).toBe(`${backend}/functions/v1/epoint-payment?action=callback`);
    expect(result.current.loading).toBe(false);
    expect(mocks.toast).toHaveBeenCalledWith('Kartla ödəniş hazırda aktiv deyil. Sifarişiniz ödənilmiş sayılmır.');
  });

  it('also preserves the configured source Supabase endpoint', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://source-project.supabase.co');
    expect(epointFunctionUrl('callback')).toBe('https://source-project.supabase.co/functions/v1/epoint-payment?action=callback');
  });

  it.each([null, { access_token: '' }])('does not send a missing session (%j)', async (session) => {
    mocks.session.mockResolvedValue({ data: { session }, error: null });
    const { result } = renderHook(useEpointPayment);
    await act(async () => { expect(await result.current.initiatePayment(request)).toMatchObject({ success: false }); });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it.each(['premium', 'general'] as const)('explains unsupported Azure %s purchases before requesting payment', async (orderType) => {
    const { result } = renderHook(useEpointPayment);
    await act(async () => { expect(await result.current.initiatePayment({ ...request, orderType })).toEqual({ success: false, error: 'unsupported_order_type' }); });
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith('Bu sifariş üçün kartla ödəniş dəstəklənmir.');
  });

  it.each(['network', 'html', 'upstream'])('does not retry an uncertain %s outcome or report payment success', async (outcome) => {
    if (outcome === 'network') mocks.fetch.mockRejectedValue(new TypeError('offline'));
    if (outcome === 'html') mocks.fetch.mockResolvedValue(new Response('<html>gateway error</html>', { status: 502 }));
    if (outcome === 'upstream') mocks.fetch.mockResolvedValue(Response.json({ error: 'function_upstream_failed' }, { status: 502 }));
    const { result } = renderHook(useEpointPayment);
    await act(async () => { expect((await result.current.initiatePayment(request)).success).toBe(false); });
    expect(mocks.fetch).toHaveBeenCalledOnce();
    expect(mocks.toast).toHaveBeenCalledWith(expect.stringContaining('Yenidən ödəməzdən əvvəl'));
    expect(result.current.loading).toBe(false);
  });

  it('rejects an untrusted redirect even in a successful response', async () => {
    mocks.fetch.mockResolvedValue(Response.json({ success: true, redirectUrl: 'https://epoint.az.attacker.test/pay' }));
    const { result } = renderHook(useEpointPayment);
    await act(async () => { expect((await result.current.initiatePayment(request)).success).toBe(false); });
    expect(mocks.fetch).toHaveBeenCalledOnce();
  });
});
