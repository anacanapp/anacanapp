// Ported from: src/lib/native-auth.ts
//
// Native Google / Apple sign-in deliver ID tokens that are exchanged with
// `auth.signInWithIdToken`. The native plugins (Credential Manager / Firebase, AuthenticationServices,
// custom-tab browser) arrive later behind [SocialAuthProvider]. The browser OAuth fallback for old
// Android phones returns through `com.atlasoon.anacan://auth-callback`; [parseNativeOAuthCallback]
// is the pure parser of that URL.

import 'dart:convert';
import 'dart:math';

import 'package:crypto/crypto.dart';

/// Default name the `handle_new_user()` trigger writes when the provider gave none.
const String defaultPlaceholderName = 'İstifadəçi';

/// Redirect of the browser OAuth fallback (must be in the backend redirect allow-list).
const String nativeOAuthRedirect = 'com.atlasoon.anacan://auth-callback';

/// Result of the native Google account picker.
class GoogleCredential {
  const GoogleCredential({required this.idToken, this.displayName});
  final String idToken;
  final String? displayName;
}

/// Result of Sign in with Apple (iOS).
class AppleCredential {
  const AppleCredential({required this.identityToken, this.givenName, this.familyName});
  final String identityToken;

  /// Apple sends the name only on the first authorization.
  final String? givenName;
  final String? familyName;
}

/// Failure of the native Google picker (not of the backend exchange); [cause] is classified by
/// `resolveGoogleNativeFailure`.
class GoogleNativePickerError implements Exception {
  GoogleNativePickerError(this.cause) {
    String? msg, c;
    final Object? source = cause;
    if (source is Map) {
      msg = source['message']?.toString();
      c = source['code']?.toString();
    } else if (source != null) {
      try {
        final dynamic d = source;
        msg = d.message?.toString();
      } catch (_) {}
      try {
        final dynamic d = source;
        c = d.code?.toString();
      } catch (_) {}
    }
    message = msg ?? '$cause';
    code = c ?? '';
  }

  final Object? cause;
  late final String message;
  late final String code;
  String get name => 'GoogleNativePickerError';
  @override
  String toString() => message;
}

/// Native social sign-in plumbing (implemented by the native layer).
abstract interface class SocialAuthProvider {
  /// 'android' | 'ios'.
  String get platform;

  /// Signs out of any prior picker session (account chooser every time), shows the Google picker.
  /// Throws [GoogleNativePickerError] on picker failures.
  Future<GoogleCredential> pickGoogleAccount();

  /// iOS Sign in with Apple with the SHA-256 hex of the raw nonce.
  Future<AppleCredential> authorizeApple({required String hashedNonce});

  /// Opens [url] in a custom tab / system browser (Google blocks OAuth in embedded web views).
  Future<void> openBrowser(Uri url);

  /// Closes the custom tab if it is still shown.
  Future<void> closeBrowser();
}

bool isNativeOAuthCallback(String? url) => url != null && url.startsWith(nativeOAuthRedirect);

class NativeOAuthCallback {
  const NativeOAuthCallback({this.accessToken, this.refreshToken, this.code, this.error, this.params = const {}});
  final String? accessToken;
  final String? refreshToken;
  final String? code;
  final String? error;

  /// Query + fragment parameters (fragment wins), e.g. `expires_in`, `token_type`.
  final Map<String, String> params;
}

String? _nonEmpty(String? v) => v == null || v.isEmpty ? null : v;

/// Tokens (implicit flow) or a code (PKCE) from the callback URL. Never logs them.
NativeOAuthCallback parseNativeOAuthCallback(String url) {
  try {
    final parsed = Uri.parse(url);
    final params = <String, String>{...parsed.queryParameters};
    final fragment = parsed.fragment;
    if (fragment.isNotEmpty) params.addAll(Uri.splitQueryString(fragment));
    return NativeOAuthCallback(
      accessToken: _nonEmpty(params['access_token']),
      refreshToken: _nonEmpty(params['refresh_token']),
      code: _nonEmpty(params['code']),
      error: _nonEmpty(params['error_description']) ?? _nonEmpty(params['error']),
      params: params,
    );
  } catch (_) {
    return const NativeOAuthCallback(error: 'invalid_callback');
  }
}

const String _nonceCharset = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._';

/// `generateNonce(32)`.
String generateNonce([int length = 32, Random? random]) {
  final r = random ?? Random.secure();
  return List.generate(length, (_) => _nonceCharset[r.nextInt(256) % _nonceCharset.length]).join();
}

/// `sha256Hex(input)`.
String sha256Hex(String input) => sha256.convert(utf8.encode(input)).toString();

/// Apple full name from the first authorization (`[given, family].filter(non-blank).join(' ')`).
String? appleFullName(AppleCredential credential) {
  final parts = [credential.givenName, credential.familyName].whereType<String>().where((p) => p.trim().isNotEmpty);
  final name = parts.join(' ').trim();
  return name.isEmpty ? null : name;
}
