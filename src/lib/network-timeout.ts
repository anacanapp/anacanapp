/**
 * Request timeouts and failure classification for the Supabase SDK and edge calls.
 *
 * - Every SDK request (REST, RPC, Auth, Functions, Storage) gets a bounded wait, so a
 *   save on a weak network ends with a clear, retryable error instead of hanging.
 * - The timeout races the request: native CapacitorHttp (POST/PATCH/DELETE go through the
 *   native layer there) ignores AbortSignal, so the caller is released even if the native
 *   request cannot be cancelled.
 * - A refresh-token answer that is not a real Auth rejection (captive portal page, proxy
 *   error, 5xx, 408/429, non-JSON) is reported to the SDK as a network failure. auth-js
 *   then keeps the stored session (retryable) instead of signing the user out.
 * - Streaming (AI chat) uses the WebView's own fetch on native: the CapacitorHttp patch
 *   buffers the whole body and cannot be aborted.
 *
 * No i18n import here (the client imports this module; i18n imports the client). The
 * user-facing timeout text is supplied by `setRequestTimeoutMessage`.
 */

export const AUTH_TIMEOUT_MS = 15_000;
export const REST_TIMEOUT_MS = 20_000;
export const FUNCTION_TIMEOUT_MS = 20_000;
/** AI/generation functions answer only after a model call; a 20 s cap would fail healthy requests. */
export const SLOW_FUNCTION_TIMEOUT_MS = 90_000;
export const STORAGE_DOWNLOAD_TIMEOUT_MS = 60_000;
export const STORAGE_UPLOAD_TIMEOUT_MS = 120_000;
/** AI chat: time to the first response headers, and the longest silence between stream chunks. */
export const AI_STREAM_CONNECT_TIMEOUT_MS = 30_000;
export const AI_STREAM_IDLE_TIMEOUT_MS = 30_000;

export const SLOW_FUNCTIONS: ReadonlySet<string> = new Set([
  'dr-anacan-chat', 'generate-fairy-tale', 'generate-baby-photo', 'generate-blog-content',
  'analyze-poop', 'analyze-cry', 'analyze-horoscope', 'baby-insight', 'baby-chat-reply',
  'safety-ai-lookup', 'name-ai-lookup', 'food-calories', 'translate-content', 'translate-post',
  'send-bulk-push', 'admin-notification-dispatch', 'book-download',
]);

let timeoutMessage: () => string = () => 'Bağlantı zəifdir. Yenidən cəhd edin.';
/** Localized text for timeouts (registered by the app shell, which may import i18n). */
export function setRequestTimeoutMessage(provider: () => string): void {
  timeoutMessage = provider;
}

export class RequestTimeoutError extends Error {
  readonly code = 'REQUEST_TIMEOUT';
  readonly timeoutMs: number;
  constructor(timeoutMs: number) {
    let message = 'Request timed out';
    try { message = timeoutMessage() || message; } catch { /* keep default */ }
    super(message);
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

export const isRequestTimeoutError = (error: unknown): error is RequestTimeoutError =>
  !!error && typeof error === 'object' && (error as { name?: string }).name === 'TimeoutError';

export const isAbortError = (error: unknown): boolean =>
  !!error && typeof error === 'object' && (error as { name?: string }).name === 'AbortError';

function abortError(): Error {
  try { return new DOMException('The operation was aborted.', 'AbortError'); }
  catch {
    const error = new Error('The operation was aborted.');
    error.name = 'AbortError';
    return error;
  }
}

const requestUrl = (input: RequestInfo | URL): string =>
  typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;

const requestMethod = (input: RequestInfo | URL, init?: RequestInit): string =>
  String(init?.method ?? (typeof input === 'object' && 'method' in input ? (input as Request).method : 'GET')).toUpperCase();

/** Timeout for one SDK request, by API surface. */
export function timeoutForRequest(url: string, method = 'GET'): number {
  let path = url;
  try { path = new URL(url, 'https://local.invalid').pathname; } catch { /* use raw */ }
  const fn = path.match(/\/functions\/v1\/([^/?#]+)/);
  if (fn) return SLOW_FUNCTIONS.has(fn[1]) ? SLOW_FUNCTION_TIMEOUT_MS : FUNCTION_TIMEOUT_MS;
  if (path.includes('/storage/v1/')) {
    return method === 'GET' || method === 'HEAD' ? STORAGE_DOWNLOAD_TIMEOUT_MS : STORAGE_UPLOAD_TIMEOUT_MS;
  }
  if (path.includes('/auth/v1/')) return AUTH_TIMEOUT_MS;
  return REST_TIMEOUT_MS;
}

/**
 * fetch with a deadline that also honours the caller's AbortSignal. Rejects with
 * RequestTimeoutError (name 'TimeoutError') on the deadline and with an AbortError when the
 * caller aborts, even when the underlying fetch ignores its signal.
 * The deadline covers the time to the response headers; the body is the caller's to read.
 */
export function fetchWithTimeout(fetchImpl: typeof fetch, input: RequestInfo | URL, init: RequestInit | undefined,
  timeoutMs: number): Promise<Response> {
  const callerSignal = init?.signal ?? undefined;
  if (callerSignal?.aborted) return Promise.reject(abortError());
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stopped = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const error = new RequestTimeoutError(timeoutMs);
      reject(error);
      try { controller.abort(error); } catch { controller.abort(); }
    }, timeoutMs);
    if (callerSignal) {
      callerSignal.addEventListener('abort', () => {
        reject(abortError());
        try { controller.abort(callerSignal.reason); } catch { controller.abort(); }
      }, { once: true });
    }
  });
  let request: Promise<Response>;
  try {
    request = Promise.resolve(fetchImpl(input, { ...(init ?? {}), signal: controller.signal }));
  } catch (error) { request = Promise.reject(error); }
  // A late native result/rejection after the race is settled must not surface as unhandled.
  request.catch(() => {});
  stopped.catch(() => {});
  // The caller's abort keeps reaching the request after the headers (stream body reads);
  // only the header deadline ends here.
  return Promise.race([request, stopped]).finally(() => { if (timer) clearTimeout(timer); });
}

export const isRefreshTokenRequest = (url: string): boolean =>
  /\/auth\/v1\/token(?:\?|$)/.test(url) && /[?&]grant_type=refresh_token(?:&|$)/.test(url);

/**
 * 'invalid': the Auth server really rejected the refresh token (JSON 400/401/403/404/422
 * with an Auth error body) and signing out is correct.
 * 'transient': anything else that is not a success (offline proxy, captive portal HTML,
 * gateway errors, rate limit, timeouts); the session must be kept.
 */
export async function classifyRefreshFailure(response: Response): Promise<'invalid' | 'transient'> {
  if (![400, 401, 403, 404, 422].includes(response.status)) return 'transient';
  if (!(response.headers.get('content-type') ?? '').toLowerCase().includes('application/json')) return 'transient';
  try {
    const body = await response.clone().json() as Record<string, unknown> | null;
    if (!body || typeof body !== 'object') return 'transient';
    return ['code', 'error_code', 'error', 'msg', 'error_description'].some(key => typeof body[key] === 'string')
      ? 'invalid' : 'transient';
  } catch { return 'transient'; }
}

/** SDK fetch: per-surface timeout plus refresh-failure classification. */
export function createSupabaseFetch(getFetch: () => typeof fetch = () => globalThis.fetch): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = requestUrl(input);
    const method = requestMethod(input, init);
    const response = await fetchWithTimeout(getFetch(), input, init, timeoutForRequest(url, method));
    if (!response.ok && isRefreshTokenRequest(url) && await classifyRefreshFailure(response) === 'transient') {
      // auth-js maps a thrown fetch error to AuthRetryableFetchError and keeps the session.
      throw new TypeError(`Auth refresh temporarily unavailable (${response.status})`);
    }
    return response;
  }) as typeof fetch;
}

/**
 * The WebView's own fetch. On native the CapacitorHttp plugin replaces window.fetch with a
 * bridge that buffers the full response and ignores AbortSignal; Capacitor keeps the
 * original as `window.CapacitorWebFetch`. Use this only for streaming/abortable requests
 * to endpoints that send CORS headers.
 */
export function webViewFetch(): typeof fetch {
  const scope = globalThis as typeof globalThis & { CapacitorWebFetch?: typeof fetch };
  const original = typeof scope.CapacitorWebFetch === 'function' ? scope.CapacitorWebFetch : scope.fetch;
  return original.bind(globalThis) as typeof fetch;
}

/** Streaming request: WebView fetch (progressive body, real abort) with a connect deadline. */
export function fetchStreaming(input: RequestInfo | URL, init?: RequestInit,
  connectTimeoutMs = AI_STREAM_CONNECT_TIMEOUT_MS): Promise<Response> {
  return fetchWithTimeout(webViewFetch(), input, init, connectTimeoutMs);
}
