// Epoint (epoint.az) payment gateway. Requests and callbacks carry `data` (base64 JSON) and
// `signature` = base64(sha1(private_key + data + private_key)) over the raw bytes.
// Configuration (functions env): EPOINT_PUBLIC_KEY, EPOINT_PRIVATE_KEY, ENABLE_BOOK_PAYMENTS=true.
// Until all three are present the shop shows "coming soon" and no checkout is created.
const API = 'https://epoint.az/api/1';

export function epointConfig() {
  const publicKey = Deno.env.get('EPOINT_PUBLIC_KEY') || '';
  const privateKey = Deno.env.get('EPOINT_PRIVATE_KEY') || '';
  const enabled = Deno.env.get('ENABLE_BOOK_PAYMENTS') === 'true';
  return { ready: enabled && publicKey.length > 0 && privateKey.length > 0, publicKey, privateKey };
}

const encoder = new TextEncoder();
function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
export function encodeData(payload: Record<string, unknown>): string {
  return toBase64(encoder.encode(JSON.stringify(payload)));
}
export function decodeData(data: string): Record<string, unknown> | null {
  try {
    const bytes = Uint8Array.from(atob(data), char => char.charCodeAt(0));
    const value = JSON.parse(new TextDecoder().decode(bytes));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch { return null; }
}
export async function sign(data: string, privateKey: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-1', encoder.encode(privateKey + data + privateKey));
  return toBase64(new Uint8Array(digest));
}
/** Constant-time comparison of the callback signature. */
export async function verify(data: string, signature: string, privateKey: string): Promise<boolean> {
  const expected = await sign(data, privateKey);
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

export async function epointRequest(path: 'request' | 'get-status', payload: Record<string, unknown>) {
  const { publicKey, privateKey } = epointConfig();
  const data = encodeData({ public_key: publicKey, ...payload });
  const body = new URLSearchParams({ data, signature: await sign(data, privateKey) });
  const response = await fetch(`${API}/${path}`, {
    method: 'POST', body, redirect: 'error', signal: AbortSignal.timeout(20_000),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  const result = await response.json().catch(() => ({}));
  return { ok: response.ok, result: result as Record<string, unknown> };
}

/** Epoint checkout languages: az, en, ru. */
export const epointLanguage = (language: string) => (language === 'az' || language === 'ru' ? language : language === 'kk' || language === 'ky' || language === 'uz' ? 'ru' : 'en');
