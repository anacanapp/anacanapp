// Ported from: src/lib/social-auth-errors.ts
//
// Classification of native social sign-in failures. Google (Credential Manager / Play Services)
// rejects with the platform message only ("No credentials available", "[28444] …", "10: ",
// "12500: "); on old phones these are dead ends for the native picker, so the app falls back to
// the browser OAuth flow. Apple rejects with `localizedDescription` carrying the
// ASAuthorizationError code ("… AuthorizationError error 1001.").

import '../i18n/tr.dart';

enum GoogleNativeFailure { cancelled, unavailable, network, failed }

enum AppleNativeFailure { cancelled, unknown, failed, other }

({String message, String code}) _describe(Object? error) {
  if (error == null) return (message: '', code: '');
  if (error is String) return (message: error, code: '');
  Object? message, code;
  if (error is Map) {
    message = error['message'] ?? error['errorMessage'];
    code = error['code'];
  } else {
    try {
      message = (error as dynamic).message;
    } catch (_) {}
    try {
      code = (error as dynamic).code;
    } catch (_) {}
  }
  return (message: message is String ? message : error.toString(), code: code == null ? '' : '$code');
}

final RegExp _googleCancel = RegExp(r'cancel|12501\b', caseSensitive: false);
final RegExp _googleNetwork = RegExp(
  r'network|timed? ?out|unreachable|no internet|offline|auth/network-request-failed|(^|\D)7:\s',
  caseSensitive: false,
);
final RegExp _googleUnavailable = RegExp(
  [
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
    r'(?:^|\D)(?:10|12500|28433|28434|28436|28444)(?:\]|:)',
    'no idtoken',
    'returned no id ?token',
  ].join('|'),
  caseSensitive: false,
);

GoogleNativeFailure classifyGoogleNativeError(Object? error) {
  final d = _describe(error);
  final text = '${d.code} ${d.message}';
  if (_googleCancel.hasMatch(text)) return GoogleNativeFailure.cancelled;
  if (_googleNetwork.hasMatch(text)) return GoogleNativeFailure.network;
  if (_googleUnavailable.hasMatch(text)) return GoogleNativeFailure.unavailable;
  return GoogleNativeFailure.failed;
}

final RegExp _appleDomain = RegExp('AuthorizationError|AuthenticationServices', caseSensitive: false);

/// Only AuthenticationServices failures are classified; anything else (e.g. a backend
/// signInWithIdToken error) is [AppleNativeFailure.other] and keeps its existing handling.
AppleNativeFailure classifyAppleNativeError(Object? error) {
  final d = _describe(error);
  final numeric = RegExp(r'^\d+$').hasMatch(d.code) ? d.code : '';
  final domainCode =
      _appleDomain.hasMatch(d.message) ? (RegExp(r'(?:^|\D)(1\d{3})(?:\D|$)').firstMatch(d.message)?.group(1) ?? '') : '';
  final value = numeric.isNotEmpty ? numeric : domainCode;
  if (value == '1001') return AppleNativeFailure.cancelled; // ASAuthorizationError.canceled
  if (value == '1000') return AppleNativeFailure.unknown; // no Apple ID signed in
  if (value.isNotEmpty || _appleDomain.hasMatch(d.message)) return AppleNativeFailure.failed;
  return AppleNativeFailure.other;
}

/// Error carrying a localized, user-safe message (never the raw platform code).
class SocialSignInError implements Exception {
  const SocialSignInError(this.provider, this.kind, this.message);
  final String provider;
  final String kind;
  final String message;
  String get name => 'SocialSignInError';
  @override
  String toString() => message;
}

enum NativeFailureAction { silent, browser, error, rethrow_ }

class NativeFailureOutcome {
  const NativeFailureOutcome(this.action, {this.report = false, this.error});
  final NativeFailureAction action;
  final bool report;
  final SocialSignInError? error;

  @override
  bool operator ==(Object other) =>
      other is NativeFailureOutcome && other.action == action && other.report == report && other.error == error;
  @override
  int get hashCode => Object.hash(action, report, error);
  @override
  String toString() => 'NativeFailureOutcome($action, report: $report)';
}

String googleFailureMessage(GoogleNativeFailure kind) {
  if (kind == GoogleNativeFailure.network) {
    return tr('socialauth_google_network', 'İnternet bağlantısını yoxlayıb yenidən cəhd edin.');
  }
  return tr('socialauth_google_failed', 'Google ilə giriş tamamlanmadı. Yenidən cəhd edin və ya e-poçtla daxil olun.');
}

String appleFailureMessage(AppleNativeFailure kind) {
  if (kind == AppleNativeFailure.unknown) {
    return tr('socialauth_apple_unknown',
        'Apple ilə giriş alınmadı. Ayarlarda Apple ID (iCloud) hesabına daxil olduğunuzu yoxlayın və yenidən cəhd edin.');
  }
  return tr('socialauth_apple_failed', 'Apple ilə giriş tamamlanmadı. Yenidən cəhd edin.');
}

/// Google picker failure → what the sign-in button should do. [platform]: 'android' | 'ios'.
NativeFailureOutcome resolveGoogleNativeFailure(Object? error, String? platform) {
  final kind = classifyGoogleNativeError(error);
  if (kind == GoogleNativeFailure.cancelled) return const NativeFailureOutcome(NativeFailureAction.silent);
  if (kind == GoogleNativeFailure.unavailable && platform == 'android') {
    return const NativeFailureOutcome(NativeFailureAction.browser, report: true);
  }
  return NativeFailureOutcome(
    NativeFailureAction.error,
    report: kind != GoogleNativeFailure.network,
    error: SocialSignInError('google', kind.name, googleFailureMessage(kind)),
  );
}

/// Apple native failure → silent cancel, clear message, or the existing path.
NativeFailureOutcome resolveAppleNativeFailure(Object? error) {
  final kind = classifyAppleNativeError(error);
  if (kind == AppleNativeFailure.other) return const NativeFailureOutcome(NativeFailureAction.rethrow_);
  if (kind == AppleNativeFailure.cancelled) return const NativeFailureOutcome(NativeFailureAction.silent);
  return NativeFailureOutcome(
    NativeFailureAction.error,
    report: true,
    error: SocialSignInError('apple', kind.name, appleFailureMessage(kind)),
  );
}
