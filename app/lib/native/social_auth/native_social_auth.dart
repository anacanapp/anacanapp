// Ported from: src/lib/native-auth.ts (signInWithGoogleNative picker step, signInWithAppleNative authorize step,
//              browser fallback open/close), src/lib/social-auth-errors.ts (the error shapes the classifiers expect)
//
// The real [SocialAuthProvider]: Google via google_sign_in 7 (Credential Manager on Android, GIDSignIn on iOS) for an
// ID token, Apple via sign_in_with_apple (AuthenticationServices) with the SHA-256 hex of the raw nonce, and the
// system browser / custom tab for the Google OAuth fallback on old Android phones. The token exchange, the nonce
// generation, the first-login name patch and the error policy live in AuthController
// (app/lib/core/auth/auth_controller.dart); this layer only talks to the platform and reports failures in the shape
// `classifyGoogleNativeError` / `classifyAppleNativeError` understand.
//
// Client IDs are public identifiers and arrive with `--dart-define` (see app/lib/features/entry/README.md,
// "Native config needed"):
//   ANACAN_GOOGLE_SERVER_CLIENT_ID  the Web OAuth client (google-services.json `oauth_client` type 3) — the
//                                   audience of the ID token, the same one Firebase Auth used.
//   ANACAN_GOOGLE_IOS_CLIENT_ID     the iOS OAuth client (GoogleService-Info.plist CLIENT_ID); optional when
//                                   Info.plist has GIDClientID.
import 'dart:async';
import 'dart:io' show Platform;

import 'package:google_sign_in/google_sign_in.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/auth/social_auth.dart';

/// Platform seams (tests replace them).
abstract interface class GooglePicker {
  Future<void> initialize({String? clientId, String? serverClientId});
  bool supportsAuthenticate();
  Future<void> signOut();

  /// Returns (idToken, displayName). Throws [GoogleSignInException] (or anything else) on failure.
  Future<(String?, String?)> authenticate();
}

abstract interface class AppleAuthorizer {
  /// Returns (identityToken, givenName, familyName). Throws [SignInWithAppleAuthorizationException] etc.
  Future<(String?, String?, String?)> authorize({required String nonce});
}

abstract interface class OAuthBrowser {
  Future<bool> open(Uri url);
  Future<void> close();
}

class GoogleSignInPicker implements GooglePicker {
  @override
  Future<void> initialize({String? clientId, String? serverClientId}) =>
      GoogleSignIn.instance.initialize(clientId: clientId, serverClientId: serverClientId);

  @override
  bool supportsAuthenticate() => GoogleSignIn.instance.supportsAuthenticate();

  @override
  Future<void> signOut() => GoogleSignIn.instance.signOut();

  @override
  Future<(String?, String?)> authenticate() async {
    final account = await GoogleSignIn.instance.authenticate();
    return (account.authentication.idToken, account.displayName);
  }
}

class SignInWithAppleAuthorizer implements AppleAuthorizer {
  @override
  Future<(String?, String?, String?)> authorize({required String nonce}) async {
    final c = await SignInWithApple.getAppleIDCredential(
      scopes: const [AppleIDAuthorizationScopes.email, AppleIDAuthorizationScopes.fullName],
      nonce: nonce,
      state: 'signin',
    );
    return (c.identityToken, c.givenName, c.familyName);
  }
}

/// `@capacitor/browser` (custom tab / SFSafariViewController) with the system browser as fallback.
class UrlLauncherOAuthBrowser implements OAuthBrowser {
  @override
  Future<bool> open(Uri url) async {
    try {
      if (await launchUrl(url, mode: LaunchMode.inAppBrowserView)) return true;
    } catch (_) {
      // fall through to the system browser
    }
    return launchUrl(url, mode: LaunchMode.externalApplication);
  }

  @override
  Future<void> close() async {
    try {
      await closeInAppWebView();
    } catch (_) {}
  }
}

/// ASAuthorizationError codes (AuthenticationServices) for the plugin's enum.
String appleAuthorizationErrorCode(AuthorizationErrorCode code) => switch (code) {
      AuthorizationErrorCode.unknown => '1000',
      AuthorizationErrorCode.canceled => '1001',
      AuthorizationErrorCode.invalidResponse => '1002',
      AuthorizationErrorCode.notHandled => '1003',
      AuthorizationErrorCode.failed => '1004',
      AuthorizationErrorCode.notInteractive => '1005',
      AuthorizationErrorCode.matchedExcludedCredential => '1006',
      AuthorizationErrorCode.credentialImport => '1007',
      AuthorizationErrorCode.credentialExport => '1008',
    };

/// An Apple failure shaped like the Capacitor plugin's rejection (`code` + `localizedDescription`), so
/// `classifyAppleNativeError` maps 1001 → silent, 1000 → "no Apple ID" message, other 1xxx → failed.
class AppleAuthorizationFailure implements Exception {
  AppleAuthorizationFailure(this.code, String detail)
      : message = 'The operation couldn’t be completed. (com.apple.AuthenticationServices.AuthorizationError error $code.) $detail'
            .trim();
  final String code;
  final String message;
  @override
  String toString() => message;
}

/// The Google picker failure in the `{code, message}` shape of the Firebase plugin's rejections.
Map<String, String> googleFailureShape(Object error) {
  if (error is GoogleSignInException) {
    final d = error.description ?? '';
    final message = switch (error.code) {
      GoogleSignInExceptionCode.canceled => 'Sign in canceled. $d',
      GoogleSignInExceptionCode.interrupted => d.isEmpty ? 'Sign in interrupted' : d,
      GoogleSignInExceptionCode.clientConfigurationError => 'Developer console is not set up correctly (developer_error). $d',
      GoogleSignInExceptionCode.providerConfigurationError => 'Provider configuration error. $d',
      GoogleSignInExceptionCode.uiUnavailable => 'Credential Manager UI unavailable. $d',
      GoogleSignInExceptionCode.userMismatch => 'User mismatch. $d',
      _ => d.isEmpty ? 'Google Sign-In failed' : d,
    };
    return {'code': error.code.name, 'message': message.trim()};
  }
  final message = '$error';
  return {'code': '', 'message': message};
}

class NativeSocialAuthProvider implements SocialAuthProvider {
  NativeSocialAuthProvider({
    String? platform,
    GooglePicker? google,
    AppleAuthorizer? apple,
    OAuthBrowser? browser,
    this.serverClientId = const String.fromEnvironment('ANACAN_GOOGLE_SERVER_CLIENT_ID'),
    this.iosClientId = const String.fromEnvironment('ANACAN_GOOGLE_IOS_CLIENT_ID'),
  })  : platform = platform ?? (Platform.isIOS ? 'ios' : 'android'),
        _google = google ?? GoogleSignInPicker(),
        _apple = apple ?? SignInWithAppleAuthorizer(),
        _browser = browser ?? UrlLauncherOAuthBrowser();

  @override
  final String platform;
  final GooglePicker _google;
  final AppleAuthorizer _apple;
  final OAuthBrowser _browser;
  final String serverClientId;
  final String iosClientId;
  Future<void>? _initialized;

  Future<void> _init() => _initialized ??= _google
      .initialize(
        clientId: platform == 'ios' && iosClientId.isNotEmpty ? iosClientId : null,
        serverClientId: serverClientId.isEmpty ? null : serverClientId,
      )
      .catchError((Object e) {
        _initialized = null;
        throw e;
      });

  @override
  Future<GoogleCredential> pickGoogleAccount() async {
    try {
      await _init();
      if (!_google.supportsAuthenticate()) {
        throw StateError('Google Sign-In authenticate() not supported');
      }
    } catch (e) {
      throw GoogleNativePickerError(googleFailureShape(e));
    }
    // Sign out of any prior session so the account chooser shows every time.
    try {
      await _google.signOut();
    } catch (_) {}
    try {
      final (idToken, name) = await _google.authenticate();
      if (idToken == null || idToken.isEmpty) {
        throw GoogleNativePickerError(StateError('Google Sign-In returned no idToken'));
      }
      return GoogleCredential(idToken: idToken, displayName: name);
    } on GoogleNativePickerError {
      rethrow;
    } catch (e) {
      throw GoogleNativePickerError(googleFailureShape(e));
    }
  }

  @override
  Future<AppleCredential> authorizeApple({required String hashedNonce}) async {
    try {
      final (token, given, family) = await _apple.authorize(nonce: hashedNonce);
      if (token == null || token.isEmpty) throw StateError('Apple Sign-In returned no identityToken');
      return AppleCredential(identityToken: token, givenName: given, familyName: family);
    } on SignInWithAppleAuthorizationException catch (e) {
      throw AppleAuthorizationFailure(appleAuthorizationErrorCode(e.code), e.message);
    } on SignInWithAppleNotSupportedException catch (e) {
      throw AppleAuthorizationFailure('1004', e.message);
    }
  }

  @override
  Future<void> openBrowser(Uri url) async {
    final ok = await _browser.open(url);
    if (!ok) throw StateError('No browser available');
  }

  @override
  Future<void> closeBrowser() => _browser.close();
}
