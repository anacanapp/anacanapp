// Dodo Payments (Merchant of Record) helpers for web purchases on anacan.az.
// Plain fetch + Web Crypto: no SDK in the functions image. Never log keys, signatures or bodies.

export type DodoPlan = 'monthly' | 'yearly';

// Typed access to Deno.env, so this file also type-checks (and is unit-tested) outside Deno.
const env = (name: string): string => (globalThis as { Deno?: { env: { get(key: string): string | undefined } } }).Deno?.env.get(name) ?? '';

export function dodoConfig() {
  const apiKey = env('DODO_PAYMENTS_API_KEY');
  const environment = env('DODO_PAYMENTS_ENVIRONMENT') === 'live_mode' ? 'live_mode' : 'test_mode';
  // The key prefix must agree with the configured environment, so a live key never runs as "test".
  const keyMode = apiKey.startsWith('dodo_live_') ? 'live_mode' : apiKey.startsWith('dodo_test_') ? 'test_mode' : null;
  let products: Partial<Record<DodoPlan, string>> = {};
  try { products = JSON.parse(env('DODO_PRODUCTS_JSON') || '{}'); } catch { products = {}; }
  return {
    apiKey,
    environment,
    ready: !!apiKey && keyMode === environment && !!products.monthly && !!products.yearly,
    baseUrl: environment === 'live_mode' ? 'https://live.dodopayments.com' : 'https://test.dodopayments.com',
    webhookKey: env('DODO_PAYMENTS_WEBHOOK_KEY'),
    products,
    testMode: environment !== 'live_mode',
  };
}

export async function dodoRequest<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const config = dodoConfig();
  const response = await fetch(`${config.baseUrl}${path}`, {
    method: init.method || 'GET',
    headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`dodo_http_${response.status}`);
  return await response.json() as T;
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function bytesToBase64(bytes: ArrayBuffer): string {
  let binary = '';
  for (const b of new Uint8Array(bytes)) binary += String.fromCharCode(b);
  return btoa(binary);
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Standard Webhooks verification (what Dodo uses): HMAC-SHA256 over "id.timestamp.body" with the
 * base64 secret after "whsec_", compared against every "v1,<base64>" signature; 5-minute tolerance.
 */
export async function verifyStandardWebhook(raw: string, headers: Headers, secret: string, nowMs = Date.now()): Promise<boolean> {
  const id = headers.get('webhook-id');
  const timestamp = headers.get('webhook-timestamp');
  const signatures = headers.get('webhook-signature');
  if (!secret || !id || !timestamp || !signatures || !/^\d{1,12}$/.test(timestamp)) return false;
  if (Math.abs(nowMs / 1000 - Number(timestamp)) > 300) return false;
  let keyBytes: Uint8Array;
  try { keyBytes = base64ToBytes(secret.startsWith('whsec_') ? secret.slice(6) : secret); } catch { return false; }
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const expected = bytesToBase64(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${timestamp}.${raw}`)));
  return signatures.split(' ').some((part) => {
    const [version, value] = part.split(',', 2);
    return version === 'v1' && !!value && constantTimeEqual(value, expected);
  });
}

export interface DodoSubscription {
  subscription_id: string;
  status: string;
  product_id: string;
  next_billing_date?: string | null;
  cancel_at_next_billing_date?: boolean | null;
  customer?: { customer_id?: string; email?: string } | null;
  metadata?: Record<string, string> | null;
}

export const WEBSITE_ORIGINS = ['https://anacan.az', 'https://www.anacan.az'];
