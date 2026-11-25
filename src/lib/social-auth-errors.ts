import { tr } from '@/lib/tr';

/**
 * Classification of native social sign-in failures.
 *
 * Google (Android, @capacitor-firebase/authentication → Credential Manager /
 * Play Services) rejects with the platform exception message only, e.g.
 * "No credentials available", "[28444] Developer console is not set up
 * correctly.", "10: ", "12500: ", "getCredentialAsync no provider dependencies
 * found". On old phones these are dead ends for the native picker, so the app
 * falls back to the browser OAuth flow instead of showing them.
 *
 * Apple (iOS, @capacitor-community/apple-sign-in) rejects with
 * `error.localizedDescription`, which carries the ASAuthorizationError code:
 * "... (com.apple.AuthenticationServices.AuthorizationError error 1001.)".
 */

export type GoogleNativeFailure = 'cancelled' | 'unavailable' | 'network' | 'failed';
export type AppleNativeFailure = 'cancelled' | 'unknown' | 'failed';

function describe(error: unknown): { message: string; code: string } {
  if (error == null) return { message: '', code: '' };
  if (typeof error === 'string') return { message: error, code: '' };
  const record = error as { message?: unknown; code?: unknown; errorMessage?: unknown };
  const message = typeof record.message === 'string' ? record.message
    : typeof record.errorMessage === 'string' ? record.errorMessage : String(error);
  const code = record.code == null ? '' : String(record.code);
  return { message, code };
}

const GOOGLE_CANCEL = /cancel|12501\b/i;
const GOOGLE_NETWORK = /network|timed? ?out|unreachable|no internet|offline|auth\/network-request-failed|(^|\D)7:\s/i;
const GOOGLE_UNAVAILABLE = new RegExp([
  'no credentials? available',
  'cannot find a matching credential',
  'no provider dependenc',
  'provider ?configuration',
  'credential ?manager',
  'unsupported',
  'not (?:available|supported|implemented)',
  'play ?services',
  'service_(?:missing|version_update_required|invalid|disabled)',
  'developer (?:console|error)',
  'developer_error',
  // ApiException / Credential Manager status codes: "10: …", "[28444] …", "12500: …"
  '(?:^|\\D)(?:10|12500|28433|28434|28436|28444)(?:\\]|:)',
  'no idtoken',
  'returned no id ?token',
].join('|'), 'i');

export function classifyGoogleNativeError(error: unknown): GoogleNativeFailure {
  const { message, code } = describe(error);
  const text = `${code} ${message}`;
  if (GOOGLE_CANCEL.test(text)) return 'cancelled';
  if (GOOGLE_NETWORK.test(text)) return 'network';
  if (GOOGLE_UNAVAILABLE.test(text)) return 'unavailable';
  return 'failed';
}

const APPLE_DOMAIN = /AuthorizationError|AuthenticationServices/i;

/**
 * Only AuthenticationServices failures are classified; anything else (e.g. a
 * backend signInWithIdToken error) is 'other' and keeps its existing handling.
 */
export function classifyAppleNativeError(error: unknown): AppleNativeFailure | 'other' {
  const { message, code } = describe(error);
  const numeric = /^\d+$/.test(code) ? code : '';
  const domainCode = APPLE_DOMAIN.test(message) ? (message.match(/(?:^|\D)(1\d{3})(?:\D|$)/)?.[1] ?? '') : '';
  const value = numeric || domainCode;
  // ASAuthorizationError.canceled = 1001 (user closed the sheet).
  if (value === '1001') return 'cancelled';
  // ASAuthorizationError.unknown = 1000 (typically no Apple ID signed in on the device).
  if (value === '1000') return 'unknown';
  if (value || APPLE_DOMAIN.test(message)) return 'failed';
  return 'other';
}

export type NativeFailureOutcome =
  | { action: 'silent'; report: false }
  | { action: 'browser'; report: true }
  | { action: 'error'; report: boolean; error: SocialSignInError }
  | { action: 'rethrow'; report: false };

/** Google picker failure → what the sign-in button should do. */
export function resolveGoogleNativeFailure(error: unknown, platform: string | undefined): NativeFailureOutcome {
  const kind = classifyGoogleNativeError(error);
  if (kind === 'cancelled') return { action: 'silent', report: false };
  if (kind === 'unavailable' && platform === 'android') return { action: 'browser', report: true };
  return { action: 'error', report: kind !== 'network', error: new SocialSignInError('google', kind, googleFailureMessage(kind)) };
}

/** Apple native failure → silent cancel, clear message, or the existing path. */
export function resolveAppleNativeFailure(error: unknown): NativeFailureOutcome {
  const kind = classifyAppleNativeError(error);
  if (kind === 'other') return { action: 'rethrow', report: false };
  if (kind === 'cancelled') return { action: 'silent', report: false };
  return { action: 'error', report: true, error: new SocialSignInError('apple', kind, appleFailureMessage(kind)) };
}

/** Error carrying a localized, user-safe message (never the raw platform code). */
export class SocialSignInError extends Error {
  constructor(readonly provider: 'google' | 'apple', readonly kind: string, message: string) {
    super(message);
    this.name = 'SocialSignInError';
  }
}

export function googleFailureMessage(kind: GoogleNativeFailure): string {
  if (kind === 'network') return tr('socialauth_google_network', 'İnternet bağlantısını yoxlayıb yenidən cəhd edin.');
  return tr('socialauth_google_failed', 'Google ilə giriş tamamlanmadı. Yenidən cəhd edin və ya e-poçtla daxil olun.');
}

export function appleFailureMessage(kind: AppleNativeFailure): string {
  if (kind === 'unknown') {
    return tr('socialauth_apple_unknown', 'Apple ilə giriş alınmadı. Ayarlarda Apple ID (iCloud) hesabına daxil olduğunuzu yoxlayın və yenidən cəhd edin.');
  }
  return tr('socialauth_apple_failed', 'Apple ilə giriş tamamlanmadı. Yenidən cəhd edin.');
}
