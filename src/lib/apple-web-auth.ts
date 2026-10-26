import { supabase } from '@/integrations/supabase/client';
import { tr } from '@/lib/tr';
import { getBackendConfig, isAzureBackend } from '@/integrations/supabase/backend-config';

// Public, operator-confirmed identifiers. This is only the Azure browser flow;
// existing source OAuth and native iOS AuthenticationServices keep their paths.
export const APPLE_WEB_CLIENT_ID = 'com.atlasoon.anacan.signin';
export const APPLE_WEB_ORIGIN = 'https://api.anacan.az';
export const APPLE_WEB_REDIRECT_URI = `${APPLE_WEB_ORIGIN}/auth/apple/callback`;
const SDK_URL = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';
const GATEWAY_ORIGIN = 'https://anacan-gateway.grayocean-6fd65b89.westeurope.azurecontainerapps.io';
const ATTEMPT_TTL = 5 * 60_000;

interface AppleResponse {
  authorization?: { state?: string; id_token?: string };
  user?: { name?: { firstName?: string; lastName?: string } };
}
interface AppleSdk {
  auth: {
    init: (config: { clientId: string; redirectURI: string; scope: string; state: string; nonce: string; usePopup: boolean }) => void;
    signIn: () => Promise<AppleResponse>;
  };
}
type AppleWebCode = 'APPLE_WEB_UNAVAILABLE' | 'APPLE_WEB_ORIGIN' | 'APPLE_SDK_UNAVAILABLE'
  | 'APPLE_NOT_READY' | 'APPLE_BUSY' | 'APPLE_CANCELLED' | 'APPLE_POPUP_BLOCKED'
  | 'APPLE_RESPONSE_INVALID' | 'APPLE_ACCOUNT_CHANGED' | 'APPLE_EXCHANGE_FAILED' | 'APPLE_SIGN_IN_FAILED';

export class AppleWebAuthError extends Error {
  constructor(readonly code: AppleWebCode) { super(code); this.name = 'AppleWebAuthError'; }
}
export function safeAppleWebError(error: unknown): AppleWebAuthError {
  return error instanceof AppleWebAuthError ? error : new AppleWebAuthError('APPLE_SIGN_IN_FAILED');
}
export function isAppleWebCancelled(error: unknown): boolean {
  return error instanceof AppleWebAuthError && error.code === 'APPLE_CANCELLED';
}
export function appleWebErrorMessage(error: unknown): string {
  switch (safeAppleWebError(error).code) {
    case 'APPLE_WEB_ORIGIN':
      return tr('auth_apple_web_origin', 'Apple girişi üçün api.anacan.az saytını açın.');
    case 'APPLE_SDK_UNAVAILABLE':
    case 'APPLE_NOT_READY':
      return tr('auth_apple_web_not_ready', 'Apple girişi hazırlana bilmədi. Bağlantını yoxlayıb yenidən cəhd edin.');
    case 'APPLE_POPUP_BLOCKED':
      return tr('auth_apple_web_popup_blocked', 'Bu sayt üçün popup pəncərələrinə icazə verib Apple düyməsinə yenidən toxunun.');
    case 'APPLE_ACCOUNT_CHANGED':
      return tr('auth_apple_web_account_changed', 'Hesab vəziyyəti dəyişdi. Səhifəni yeniləyib davam edin.');
    default:
      return tr('auth_apple_web_failed', 'Apple ilə giriş tamamlanmadı. Yenidən cəhd edin.');
  }
}

export function usesAzureAppleWebFlow(): boolean {
  const cap = typeof window !== 'undefined' ? (window as any).Capacitor : undefined;
  const native = typeof cap?.isNativePlatform === 'function' && cap.isNativePlatform();
  return typeof window !== 'undefined' && isAzureBackend() && !native;
}
function assertAvailable() {
  if (!usesAzureAppleWebFlow() || import.meta.env.VITE_AZURE_APPLE_OAUTH_ENABLED !== 'true') {
    throw new AppleWebAuthError('APPLE_WEB_UNAVAILABLE');
  }
  if (window.location.origin !== APPLE_WEB_ORIGIN) throw new AppleWebAuthError('APPLE_WEB_ORIGIN');
  try {
    const backend = new URL(getBackendConfig().url);
    if (![APPLE_WEB_ORIGIN, GATEWAY_ORIGIN].includes(backend.origin) || backend.pathname !== '/'
      || backend.search || backend.hash || backend.username || backend.password) throw new Error();
  } catch { throw new AppleWebAuthError('APPLE_WEB_UNAVAILABLE'); }
}
const sdk = (): AppleSdk | undefined => (window as Window & { AppleID?: AppleSdk }).AppleID;
const validSdk = () => typeof sdk()?.auth?.init === 'function' && typeof sdk()?.auth?.signIn === 'function';
let sdkLoading: Promise<void> | undefined;
async function loadSdk(): Promise<void> {
  if (validSdk()) return;
  if (!sdkLoading) {
    sdkLoading = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SDK_URL;
      script.async = true;
      script.referrerPolicy = 'no-referrer';
      const finish = (ok: boolean) => {
        clearTimeout(timer);
        script.onload = null; script.onerror = null;
        if (ok) resolve();
        else { script.remove(); reject(new AppleWebAuthError('APPLE_SDK_UNAVAILABLE')); }
      };
      const timer = setTimeout(() => finish(false), 15000);
      script.onload = () => finish(validSdk());
      script.onerror = () => finish(false);
      document.head.appendChild(script);
    }).catch(error => { sdkLoading = undefined; throw error; });
  }
  await sdkLoading;
}

interface Attempt {
  rawNonce: string;
  hashedNonce: string;
  state: string;
  createdAt: number;
  cancelled: boolean;
  exchanging: boolean;
}
let prepared: Attempt | undefined;
let preparing: Promise<void> | undefined;
let active: Attempt | undefined;
const randomHex = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');

/** Prepare before enabling the button so signIn() opens the popup in the click's
 * synchronous user gesture, including in Safari. Nonces are memory-only. */
export async function prepareAppleWebSignIn(): Promise<void> {
  assertAvailable();
  if (active) throw new AppleWebAuthError('APPLE_BUSY');
  if (prepared && Date.now() - prepared.createdAt < ATTEMPT_TTL) return;
  if (!preparing) {
    preparing = (async () => {
      await loadSdk();
      const rawNonce = randomHex();
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawNonce));
      prepared = { rawNonce, hashedNonce: Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join(''),
        state: randomHex(), createdAt: Date.now(), cancelled: false, exchanging: false };
    })().catch(() => { throw new AppleWebAuthError('APPLE_SDK_UNAVAILABLE'); }).finally(() => { preparing = undefined; });
  }
  await preparing;
}

export function cancelAppleWebSignIn(): void {
  prepared = undefined;
  if (active && !active.exchanging) active.cancelled = true;
}

export async function signInWithAppleWeb() {
  assertAvailable();
  if (active) throw new AppleWebAuthError('APPLE_BUSY');
  const attempt = prepared;
  if (!attempt || !validSdk() || Date.now() - attempt.createdAt >= ATTEMPT_TTL) {
    throw new AppleWebAuthError('APPLE_NOT_READY');
  }
  prepared = undefined; // Each state/nonce can initiate exactly one attempt.
  active = attempt;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const apple = sdk()!;
    apple.auth.init({ clientId: APPLE_WEB_CLIENT_ID, redirectURI: APPLE_WEB_REDIRECT_URI,
      scope: 'name email', state: attempt.state, nonce: attempt.hashedNonce, usePopup: true });
    // No await before this call: user activation must reach window.open().
    const opened = apple.auth.signIn();
    const response = await Promise.race([opened, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new AppleWebAuthError('APPLE_CANCELLED')), ATTEMPT_TTL);
    })]);
    if (attempt.cancelled) throw new AppleWebAuthError('APPLE_CANCELLED');
    const authorization = response?.authorization;
    if (authorization?.state !== attempt.state || typeof authorization.id_token !== 'string'
      || !authorization.id_token || authorization.id_token.length > 16384) throw new AppleWebAuthError('APPLE_RESPONSE_INVALID');
    const current = await supabase.auth.getSession();
    if (attempt.cancelled) throw new AppleWebAuthError('APPLE_CANCELLED');
    if (current.error || current.data.session) throw new AppleWebAuthError('APPLE_ACCOUNT_CHANGED');
    attempt.exchanging = true;
    // GoTrue v2.189 verifies Apple signature/issuer/expiry/audience and compares
    // SHA-256(raw nonce) with the ID token nonce. No developer key/code exchange.
    const { data, error } = await supabase.auth.signInWithIdToken({ provider: 'apple',
      token: authorization.id_token, nonce: attempt.rawNonce });
    if (error || !data.user?.id || !data.session || data.session.user.id !== data.user.id) {
      throw new AppleWebAuthError('APPLE_EXCHANGE_FAILED');
    }
    const name = [response.user?.name?.firstName, response.user?.name?.lastName]
      .filter((part): part is string => typeof part === 'string').map(part => part.trim()).filter(Boolean).join(' ').slice(0, 150);
    if (name) {
      // Match the native path: first-login name may fill only the default profile,
      // after server verification, never overwrite an existing user's chosen name.
      try { await supabase.from('profiles').update({ name }).eq('user_id', data.user.id).eq('name', 'İstifadəçi'); }
      catch { /* Successful auth does not depend on optional profile hydration. */ }
    }
    return data;
  } catch (error) {
    if (error instanceof AppleWebAuthError) throw error;
    const code = (error as { error?: unknown } | null)?.error;
    if (code === 'popup_closed_by_user' || code === 'user_cancelled_authorize' || code === 'user_trigger_new_signin_flow') {
      throw new AppleWebAuthError('APPLE_CANCELLED');
    }
    if (code === 'popup_blocked_by_browser') throw new AppleWebAuthError('APPLE_POPUP_BLOCKED');
    // Provider/SDK errors can include credentials; never forward their payload.
    throw new AppleWebAuthError('APPLE_SIGN_IN_FAILED');
  } finally {
    clearTimeout(timer);
    active = undefined;
  }
}
