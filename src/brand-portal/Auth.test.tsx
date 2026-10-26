import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { BrandAuthProvider, parseBrandAccess, useBrandAuth } from './Auth';
import { BRAND_AUTH_STORAGE_KEY, brandBackendConfig, brandAuthStorageKey, BRAND_SOURCE_ORIGIN } from './client';

vi.mock('@/integrations/supabase/client', () => { throw new Error('Consumer auth must not enter the brand portal'); });
afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); });
const a = '11111111-1111-4111-8111-111111111111', b = '22222222-2222-4222-8222-222222222222';
const brand = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const session = (id: string) => ({ access_token: 'synthetic-' + id, refresh_token: 'synthetic-refresh', user: { id, email: 'brand@example.invalid' } });
const access = (id: string) => ({ protocol: 'anacan-brand-portal-v1', user_id: id, admin: false, allowed: true,
  brands: [{ id: brand, name: 'Owned brand', report_timezone: 'Asia/Baku' }] });
function harness(initial: Promise<any> = Promise.resolve({ data: { session: null } }), backendOrigin = BRAND_SOURCE_ORIGIN) {
  let listener: (event: string, value: any) => void = () => {};
  let current = a;
  const client: any = { auth: {
    getSession: vi.fn(() => initial), onAuthStateChange: (callback: typeof listener) => { listener = callback; return { data: { subscription: { unsubscribe() {} } } }; },
    signInWithPassword: vi.fn(async () => { listener('SIGNED_IN', session(current)); return { error: null }; }),
    signOut: vi.fn(async () => ({ error: new Error('network unavailable') })),
  }, rpc: vi.fn(() => ({ abortSignal: async () => ({ data: access(current), error: null }) })) };
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queries}><BrandAuthProvider client={client}
    backendOrigin={backendOrigin} storageKey={brandAuthStorageKey(backendOrigin)}>{children}</BrandAuthProvider></QueryClientProvider>;
  return { ...renderHook(useBrandAuth, { wrapper }), client, queries, emit: (id: string | null) => { if (id) current = id; listener(id ? 'SIGNED_IN' : 'SIGNED_OUT', id ? session(id) : null); } };
}
describe('brand web authentication isolation', () => {
  it('selects only the Source public key and refuses an Azure-only or service-role profile', () => {
    expect(() => brandBackendConfig({ VITE_SUPABASE_URL: 'https://api.anacan.az', VITE_SUPABASE_PUBLISHABLE_KEY: 'azure' })).toThrow();
    expect(brandBackendConfig({ VITE_SUPABASE_URL: BRAND_SOURCE_ORIGIN, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture' }).url).toBe(BRAND_SOURCE_ORIGIN);
    const key = 'e30.' + btoa(JSON.stringify({ ref: 'tntbjulojatnrqmylorp', role: 'service_role' })) + '.test';
    expect(() => brandBackendConfig({ VITE_SOURCE_SUPABASE_PUBLISHABLE_KEY: key })).toThrow('BRAND_PORTAL_PUBLIC_SOURCE_KEY_REQUIRED');
  });
  it('does not restore an old account after a newer sign-out event', async () => {
    let complete!: (value: any) => void;
    const h = harness(new Promise(resolve => { complete = resolve; }));
    act(() => h.emit(null));
    await act(async () => complete({ data: { session: session(a) } }));
    expect(h.result.current.session).toBeNull(); expect(h.client.rpc).not.toHaveBeenCalled();
  });
  it('uses a separate managed realm only with explicit migration configuration', () => {
    const publicKey = 'e30.' + btoa(JSON.stringify({ role: 'anon' })) + '.test';
    const env = { VITE_BRAND_PORTAL_BACKEND: 'managed-v1', VITE_SUPABASE_URL: 'https://api.anacan.az', VITE_SUPABASE_PUBLISHABLE_KEY: publicKey };
    expect(brandBackendConfig(env)).toMatchObject({ url: env.VITE_SUPABASE_URL, reportBackend: 'azure' });
    expect(brandAuthStorageKey(env.VITE_SUPABASE_URL)).not.toBe(BRAND_AUTH_STORAGE_KEY);
    expect(() => brandBackendConfig({ ...env, VITE_SUPABASE_URL: 'https://unrelated.example' })).toThrow();
    expect(() => brandBackendConfig({ ...env, VITE_SUPABASE_PUBLISHABLE_KEY: 'e30.' + btoa(JSON.stringify({ role: 'service_role' })) + '.test' })).toThrow();
    expect(() => brandBackendConfig({ ...env, VITE_SUPABASE_PUBLISHABLE_KEY: 'e30.' + btoa(JSON.stringify({ role: 'anon', ref: 'tntbjulojatnrqmylorp' })) + '.test' })).toThrow();
  });
  it('managed logout keeps Source portal and consumer sessions separate', async () => {
    const url = 'https://api.anacan.az', key = brandAuthStorageKey(url);
    localStorage.setItem(key, 'managed-session'); localStorage.setItem(BRAND_AUTH_STORAGE_KEY, 'source-session');
    localStorage.setItem('sb-tntbjulojatnrqmylorp-auth-token', 'consumer-session');
    const h = harness(Promise.resolve({ data: { session: null } }), url); await act(async () => h.emit(a));
    await act(async () => h.result.current.signOut());
    expect(localStorage.getItem(key)).toBeNull(); expect(localStorage.getItem(BRAND_AUTH_STORAGE_KEY)).toBe('source-session');
    expect(localStorage.getItem('sb-tntbjulojatnrqmylorp-auth-token')).toBe('consumer-session');
  });
  it('clears report data and rejects a previous account response on account switching', async () => {
    const h = harness();
    await act(async () => h.emit(a));
    await waitFor(() => expect(h.result.current.access?.user_id).toBe(a));
    h.queries.setQueryData(['brand-portal-report', a, brand], { private: 'old account data' });
    act(() => h.emit(b));
    expect(h.result.current.access?.user_id).not.toBe(a);
    await waitFor(() => expect(h.result.current.access?.user_id).toBe(b));
    expect(h.queries.getQueryData(['brand-portal-report', a, brand])).toBeUndefined();
    expect(() => parseBrandAccess(access(a), b)).toThrow('BRAND_PORTAL_ACCESS_RESPONSE_INVALID');
  });
  it('logout clears only the brand namespace even if the network is unavailable', async () => {
    localStorage.setItem('sb-tntbjulojatnrqmylorp-auth-token', 'consumer-session');
    localStorage.setItem(BRAND_AUTH_STORAGE_KEY, 'brand-session');
    const h = harness(); await act(async () => h.emit(a));
    await act(async () => h.result.current.signOut());
    expect(h.client.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(localStorage.getItem(BRAND_AUTH_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem('sb-tntbjulojatnrqmylorp-auth-token')).toBe('consumer-session');
    expect(h.result.current.session).toBeNull();
  });
});
