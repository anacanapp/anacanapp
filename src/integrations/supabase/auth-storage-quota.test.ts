import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { brokeredPreviewStorage } from './authStorage';
import { LEGACY_AUTH_STORAGE_KEY } from './auth-storage-key';
import { QuotaStorage } from '@/test/quota-storage';

const userId = '00000000-0000-4000-8000-000000000034';
const clients: SupabaseClient[] = [];
function session(revision: number) {
  const encode = (value: unknown) => btoa(JSON.stringify(value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return {
    access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: userId, exp: Math.floor(Date.now() / 1000) + 3600 })}.synthetic-signature`,
    refresh_token: `synthetic-refresh-${revision}`, token_type: 'bearer', expires_in: 3600,
    user: { id: userId, aud: 'authenticated', role: 'authenticated', created_at: new Date(0).toISOString(),
      app_metadata: {}, user_metadata: { name: 'Fixture', display_metadata: 'x'.repeat(1000 + revision * 300) } },
  };
}
function client(storage: Storage | ReturnType<typeof brokeredPreviewStorage>) {
  let grants = 0;
  const fetcher = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/token')) return new Response(JSON.stringify(session(++grants)),
      { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (url.pathname.endsWith('/logout')) return new Response(null, { status: 204 });
    throw new Error('UNEXPECTED_TEST_NETWORK_CALL');
  });
  const value = createClient('https://auth-quota.example.invalid', 'synthetic-publishable-key', {
    auth: { storage, storageKey: LEGACY_AUTH_STORAGE_KEY, persistSession: true, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: fetcher },
  });
  clients.push(value);
  return { value, fetcher };
}
function fullStorage() {
  const storage = new QuotaStorage();
  storage.setItem('anacan_i18n_cache:az', 'x'.repeat(4500));
  storage.setItem('anacan.backend-admission.v1', 'source-authority-pin');
  storage.setItem('anacan.auth.session.v2:source', 'explicit-logout-tombstone');
  storage.setItem('admin_draft_article', 'unsaved-draft');
  storage.limit = storage.size;
  return storage;
}
beforeEach(() => {
  vi.stubGlobal('location', { hostname: 'app.anacan.az' });
  // This fixture exercises one WebView's persistence/restart. Node's worker
  // BroadcastChannel cannot dispatch jsdom MessageEvents across test contexts.
  vi.stubGlobal('BroadcastChannel', undefined);
});
afterEach(async () => {
  for (const value of clients.splice(0)) await value.auth.stopAutoRefresh();
  vi.unstubAllGlobals();
});

describe('real Auth SDK under browser storage pressure', () => {
  it('reproduces successful server authentication failing on the old raw storage write', async () => {
    const { value, fetcher } = client(fullStorage());
    await value.auth.getSession();
    await expect(value.auth.signInWithPassword({ email: 'fixture@example.invalid', password: 'synthetic-password' }))
      .rejects.toMatchObject({ name: 'QuotaExceededError' });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it.each(['password', 'google', 'apple'] as const)('persists %s login, refresh and logout without changing namespace or unrelated state', async provider => {
    const storage = fullStorage();
    vi.stubGlobal('localStorage', storage);
    const { value } = client(brokeredPreviewStorage());
    await value.auth.getSession();
    const result = provider === 'password'
      ? await value.auth.signInWithPassword({ email: 'fixture@example.invalid', password: 'synthetic-password' })
      : await value.auth.signInWithIdToken({ provider, token: 'synthetic-provider-token', nonce: 'synthetic-nonce' });
    expect(result.error).toBeNull();
    expect(result.data.user?.id).toBe(userId);
    expect(JSON.parse(storage.getItem(LEGACY_AUTH_STORAGE_KEY)!)).toMatchObject({ refresh_token: 'synthetic-refresh-1', user: { id: userId } });
    expect(storage.getItem('anacan_i18n_cache:az')).toBeNull();
    expect(storage.getItem('anacan.backend-admission.v1')).toBe('source-authority-pin');
    expect(storage.getItem('anacan.auth.session.v2:source')).toBe('explicit-logout-tombstone');
    expect(storage.getItem('admin_draft_article')).toBe('unsaved-draft');
    storage.setItem('anacan_i18n_cache:en', 'x'.repeat(1000));
    storage.limit = storage.size;
    const refreshed = await value.auth.refreshSession();
    expect(refreshed.error).toBeNull();
    expect(JSON.parse(storage.getItem(LEGACY_AUTH_STORAGE_KEY)!)).toMatchObject({ refresh_token: 'synthetic-refresh-2', user: { id: userId } });
    expect(storage.getItem('anacan_i18n_cache:en')).toBeNull();
    const restarted = client(brokeredPreviewStorage()).value;
    expect((await restarted.auth.getSession()).data.session?.user.id).toBe(userId);
    expect((await restarted.auth.signOut({ scope: 'local' })).error).toBeNull();
    expect(storage.getItem(LEGACY_AUTH_STORAGE_KEY)).toBeNull();
    expect(storage.getItem('anacan.backend-admission.v1')).toBe('source-authority-pin');
  });
});
