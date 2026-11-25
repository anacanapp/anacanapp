import { afterEach, describe, expect, it, vi } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  AUTH_TIMEOUT_MS, FUNCTION_TIMEOUT_MS, REST_TIMEOUT_MS, SLOW_FUNCTION_TIMEOUT_MS, STORAGE_UPLOAD_TIMEOUT_MS,
  RequestTimeoutError, classifyRefreshFailure, createSupabaseFetch, fetchStreaming, fetchWithTimeout,
  isRefreshTokenRequest, setRequestTimeoutMessage, timeoutForRequest, webViewFetch,
} from './network-timeout';

const API = 'https://api.example.invalid';
const json = (body: unknown, status: number) => new Response(JSON.stringify(body),
  { status, headers: { 'Content-Type': 'application/json' } });
const html = (status: number) => new Response('<html>Hotel Wi-Fi login</html>', { status, headers: { 'Content-Type': 'text/html' } });
const hanging = () => vi.fn(() => new Promise<Response>(() => {})); // e.g. native CapacitorHttp ignoring the signal

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('timeoutForRequest', () => {
  it('bounds every SDK surface, with longer limits only for uploads and AI generation', () => {
    expect(timeoutForRequest(`${API}/rest/v1/baby_logs?select=*`, 'POST')).toBe(REST_TIMEOUT_MS);
    expect(timeoutForRequest(`${API}/rest/v1/rpc/shop_storefront_v1`, 'POST')).toBe(REST_TIMEOUT_MS);
    expect(timeoutForRequest(`${API}/auth/v1/token?grant_type=refresh_token`, 'POST')).toBe(AUTH_TIMEOUT_MS);
    expect(timeoutForRequest(`${API}/functions/v1/promo-redeem`, 'POST')).toBe(FUNCTION_TIMEOUT_MS);
    expect(timeoutForRequest(`${API}/functions/v1/analyze-cry`, 'POST')).toBe(SLOW_FUNCTION_TIMEOUT_MS);
    expect(timeoutForRequest(`${API}/storage/v1/object/avatars/a.jpg`, 'POST')).toBe(STORAGE_UPLOAD_TIMEOUT_MS);
    for (const ms of [REST_TIMEOUT_MS, AUTH_TIMEOUT_MS, FUNCTION_TIMEOUT_MS]) {
      expect(ms).toBeGreaterThanOrEqual(15_000);
      expect(ms).toBeLessThanOrEqual(20_000);
    }
  });
});

describe('fetchWithTimeout', () => {
  it('rejects a hanging mutation with a clear, localized timeout error', async () => {
    vi.useFakeTimers();
    setRequestTimeoutMessage(() => 'Slow connection. Try again.');
    const pending = fetchWithTimeout(hanging(), `${API}/rest/v1/profiles`, { method: 'PATCH' }, 20_000);
    const assertion = expect(pending).rejects.toMatchObject({ name: 'TimeoutError', code: 'REQUEST_TIMEOUT',
      message: 'Slow connection. Try again.' });
    await vi.advanceTimersByTimeAsync(20_000);
    await assertion;
  });

  it('aborts the underlying request on timeout', async () => {
    vi.useFakeTimers();
    let seen: AbortSignal | undefined;
    const impl = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => { seen = init?.signal ?? undefined; return new Promise<Response>(() => {}); });
    const pending = fetchWithTimeout(impl, `${API}/rest/v1/x`, {}, 1000);
    pending.catch(() => {});
    await vi.advanceTimersByTimeAsync(1000);
    expect(seen?.aborted).toBe(true);
    await expect(pending).rejects.toBeInstanceOf(RequestTimeoutError);
  });

  it('honours the caller AbortSignal even when the transport ignores it (Stop button)', async () => {
    const controller = new AbortController();
    const pending = fetchWithTimeout(hanging(), `${API}/functions/v1/dr-anacan-chat`, { method: 'POST', signal: controller.signal }, 30_000);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    const already = new AbortController(); already.abort();
    await expect(fetchWithTimeout(hanging(), `${API}/x`, { signal: already.signal }, 1000)).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('keeps forwarding the caller abort after the headers so a stream body read stops too', async () => {
    let seen: AbortSignal | undefined;
    const impl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => { seen = init?.signal ?? undefined; return new Response('data: x\n\n'); });
    const controller = new AbortController();
    await fetchWithTimeout(impl, `${API}/x`, { signal: controller.signal }, 1000);
    expect(seen?.aborted).toBe(false);
    controller.abort();
    expect(seen?.aborted).toBe(true);
  });

  it('passes a fast response through and clears its timer', async () => {
    vi.useFakeTimers();
    const response = await fetchWithTimeout(async () => json({ ok: true }, 200), `${API}/x`, undefined, 1000);
    expect(response.status).toBe(200);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('refresh failure classification', () => {
  it('recognises the refresh endpoint only', () => {
    expect(isRefreshTokenRequest(`${API}/auth/v1/token?grant_type=refresh_token`)).toBe(true);
    expect(isRefreshTokenRequest(`${API}/auth/v1/token?grant_type=password`)).toBe(false);
    expect(isRefreshTokenRequest(`${API}/rest/v1/token?grant_type=refresh_token`)).toBe(false);
  });

  it.each([
    ['invalid', json({ code: 'refresh_token_not_found', message: 'Invalid Refresh Token' }, 400)],
    ['invalid', json({ error: 'invalid_grant', error_description: 'Refresh Token Not Found' }, 400)],
    ['invalid', json({ code: 'session_not_found', message: 'Session not found' }, 403)],
    ['transient', html(200)], ['transient', html(302)], ['transient', html(401)], ['transient', html(403)],
    ['transient', json({ message: 'rate limited' }, 429)], ['transient', json({ message: 'db down' }, 500)],
    ['transient', json({ message: 'gateway' }, 502)], ['transient', new Response('', { status: 408 })],
    ['transient', new Response('{"code":', { status: 400, headers: { 'Content-Type': 'application/json' } })],
  ])('classifies %s for a refresh answer', async (expected, response) => {
    expect(await classifyRefreshFailure(response as Response)).toBe(expected);
  });

  it('turns a non-Auth refresh failure into a network error and passes real rejections through', async () => {
    const base = vi.fn();
    const sdkFetch = createSupabaseFetch(() => base);
    const url = `${API}/auth/v1/token?grant_type=refresh_token`;
    base.mockResolvedValueOnce(html(403));
    await expect(sdkFetch(url, { method: 'POST' })).rejects.toBeInstanceOf(TypeError);
    base.mockResolvedValueOnce(json({ code: 'refresh_token_not_found' }, 400));
    expect((await sdkFetch(url, { method: 'POST' })).status).toBe(400);
    // Other endpoints keep their answers untouched.
    base.mockResolvedValueOnce(html(403));
    expect((await sdkFetch(`${API}/rest/v1/profiles`, {})).status).toBe(403);
  });
});

describe('real Auth SDK refresh with the app fetch', () => {
  const clients: SupabaseClient[] = [];
  afterEach(async () => { for (const c of clients.splice(0)) await c.auth.stopAutoRefresh(); });
  const KEY = 'sb-refresh-classification-test';
  const expired = () => JSON.stringify({ access_token: 'a.b.c', refresh_token: 'stored-refresh', token_type: 'bearer',
    expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) - 3600,
    user: { id: '00000000-0000-4000-8000-000000000011', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date(0).toISOString() } });
  function sdk(answer: () => Response) {
    vi.stubGlobal('BroadcastChannel', undefined);
    const storage = new Map<string, string>([[KEY, expired()]]);
    const store = { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => { storage.set(k, v); },
      removeItem: (k: string) => { storage.delete(k); } };
    const base = vi.fn(async () => answer());
    const client = createClient(API, 'synthetic-publishable-key', {
      auth: { storage: store, storageKey: KEY, persistSession: true, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: createSupabaseFetch(() => base as unknown as typeof fetch) },
    });
    clients.push(client);
    return { client, storage, base };
  }

  it('signs out on a real invalid refresh token', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { client, storage } = sdk(() => json({ code: 'refresh_token_not_found', message: 'Invalid Refresh Token' }, 400));
    const { data } = await client.auth.getSession();
    expect(data.session).toBeNull();
    expect(storage.has(KEY)).toBe(false);
  });

  it('keeps the stored session when the refresh hits a captive portal page', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    const { client, storage, base } = sdk(() => html(403));
    const pending = client.auth.getSession();
    await vi.advanceTimersByTimeAsync(31_000);
    const { data } = await pending;
    expect(data.session).toBeNull(); // not usable right now…
    expect(storage.has(KEY)).toBe(true); // …but kept for the offline open and a later refresh
    expect(base.mock.calls.length).toBeGreaterThan(1); // retried as a network failure
  });
});

describe('streaming fetch', () => {
  it('prefers the WebView fetch saved by Capacitor before its native HTTP patch', async () => {
    const patched = vi.fn(async () => new Response('buffered'));
    const original = vi.fn(async () => new Response('streamed'));
    vi.stubGlobal('fetch', patched);
    vi.stubGlobal('CapacitorWebFetch', original);
    const response = await fetchStreaming(`${API}/functions/v1/dr-anacan-chat`, { method: 'POST' });
    expect(await response.text()).toBe('streamed');
    expect(patched).not.toHaveBeenCalled();
  });

  it('uses the normal fetch on the web', async () => {
    const web = vi.fn(async () => new Response('web'));
    vi.stubGlobal('fetch', web);
    vi.stubGlobal('CapacitorWebFetch', undefined);
    await webViewFetch()(`${API}/x`);
    expect(web).toHaveBeenCalledOnce();
  });
});
