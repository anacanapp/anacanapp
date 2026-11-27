import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/tr', () => ({ tr: (_key: string, fallback: string) => fallback }));
import {
  classifyAppleNativeError,
  classifyGoogleNativeError,
  resolveAppleNativeFailure,
  resolveGoogleNativeFailure,
  SocialSignInError,
} from './social-auth-errors';

describe('Google native sign-in failure classification', () => {
  it.each([
    'activity is cancelled by the user.',
    'Authorization canceled.',
    'User cancelled the selector',
    '12501: ',
  ])('cancel: %s', (message) => {
    expect(classifyGoogleNativeError({ message })).toBe('cancelled');
  });

  it.each([
    'No credentials available',
    '[28433] Cannot find a matching credential.',
    '[28444] Developer console is not set up correctly.',
    '10: ',
    '12500: ',
    'getCredentialAsync no provider dependencies found - please ensure the desired provider dependencies are added',
    'Credential Manager is not available on this device',
    'Google Play services is missing',
    'SERVICE_VERSION_UPDATE_REQUIRED',
    '"signInWithGoogle" not implemented on android',
    'Google Sign-In returned no idToken',
  ])('old-device / unavailable: %s', (message) => {
    expect(classifyGoogleNativeError(new Error(message))).toBe('unavailable');
  });

  it('network and generic failures', () => {
    expect(classifyGoogleNativeError({ message: 'A network error (such as timeout, interrupted connection) has occurred.', code: 'auth/network-request-failed' })).toBe('network');
    expect(classifyGoogleNativeError({ message: 'request timed out after 10 seconds' })).toBe('network');
    expect(classifyGoogleNativeError({ message: 'The supplied auth credential is malformed', code: 'auth/invalid-credential' })).toBe('failed');
    expect(classifyGoogleNativeError(undefined)).toBe('failed');
  });

  it('falls back to the browser only on Android, cancels silently, never shows raw codes', () => {
    expect(resolveGoogleNativeFailure({ message: '10: ' }, 'android')).toEqual({ action: 'browser', report: true });
    expect(resolveGoogleNativeFailure({ message: 'Authorization canceled.' }, 'android')).toEqual({ action: 'silent', report: false });
    const ios = resolveGoogleNativeFailure({ message: '12500: ' }, 'ios');
    expect(ios.action).toBe('error');
    if (ios.action === 'error') {
      expect(ios.error).toBeInstanceOf(SocialSignInError);
      expect(ios.error.message).not.toMatch(/12500/);
    }
    const network = resolveGoogleNativeFailure({ code: 'auth/network-request-failed', message: 'network error' }, 'android');
    expect(network).toMatchObject({ action: 'error', report: false });
  });
});

describe('Apple native sign-in failure classification', () => {
  const ns = (code: number, prefix = 'The operation couldn’t be completed.') => `${prefix} (com.apple.AuthenticationServices.AuthorizationError error ${code}.)`;

  it('1001 (sheet closed) is a silent no-op', () => {
    expect(classifyAppleNativeError(ns(1001))).toBe('cancelled');
    expect(classifyAppleNativeError({ message: ns(1001, 'Der Vorgang konnte nicht abgeschlossen werden.') })).toBe('cancelled');
    expect(classifyAppleNativeError({ code: '1001', message: 'x' })).toBe('cancelled');
    expect(resolveAppleNativeFailure(new Error(ns(1001)))).toEqual({ action: 'silent', report: false });
  });

  it('1000 (unknown) shows a clear iCloud message without the raw code', () => {
    expect(classifyAppleNativeError(new Error(ns(1000)))).toBe('unknown');
    const outcome = resolveAppleNativeFailure(new Error(ns(1000)));
    expect(outcome.action).toBe('error');
    if (outcome.action === 'error') {
      expect(outcome.error.message).toMatch(/Apple ID|iCloud/);
      expect(outcome.error.message).not.toMatch(/1000|AuthorizationError/);
    }
  });

  it('other AuthenticationServices codes get a friendly message; backend errors keep their path', () => {
    const failed = resolveAppleNativeFailure(new Error(ns(1004)));
    expect(failed.action).toBe('error');
    if (failed.action === 'error') expect(failed.error.message).not.toMatch(/1004/);
    expect(resolveAppleNativeFailure(new Error('Database error saving new user'))).toEqual({ action: 'rethrow', report: false });
    expect(resolveAppleNativeFailure(new Error('Apple Sign-In returned no identityToken'))).toEqual({ action: 'rethrow', report: false });
  });
});
