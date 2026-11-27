// Ported from: src/lib/native-auth.fallback.test.ts (callback parsing cases kept) + the native error-shape contract
//              between app/lib/native/social_auth and src/lib/social-auth-errors.ts (Apple 1001 silent, 1000 message,
//              Google cancel silent, unavailable → browser on Android).
import 'package:anacan/core/auth/auth.dart';
import 'package:anacan/native/social_auth/native_social_auth.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart' hide generateNonce;

class FakeGoogle implements GooglePicker {
  final calls = <String>[];
  Object? initError;
  Object? authError;
  bool supported = true;
  (String?, String?) result = ('id.token', 'Aysel Məmmədova');
  ({String? clientId, String? serverClientId})? init;

  @override
  Future<void> initialize({String? clientId, String? serverClientId}) async {
    calls.add('init');
    init = (clientId: clientId, serverClientId: serverClientId);
    if (initError != null) throw initError!;
  }

  @override
  bool supportsAuthenticate() => supported;

  @override
  Future<void> signOut() async => calls.add('signOut');

  @override
  Future<(String?, String?)> authenticate() async {
    calls.add('authenticate');
    if (authError != null) throw authError!;
    return result;
  }
}

class FakeApple implements AppleAuthorizer {
  String? nonce;
  Object? error;
  @override
  Future<(String?, String?, String?)> authorize({required String nonce}) async {
    this.nonce = nonce;
    if (error != null) throw error!;
    return ('apple.jwt', 'Aysel', null);
  }
}

class FakeBrowser implements OAuthBrowser {
  final opened = <Uri>[];
  var closed = 0;
  bool ok = true;
  @override
  Future<bool> open(Uri url) async {
    opened.add(url);
    return ok;
  }

  @override
  Future<void> close() async => closed++;
}

void main() {
  late FakeGoogle google;
  late FakeApple apple;
  late FakeBrowser browser;
  NativeSocialAuthProvider provider(String platform) => NativeSocialAuthProvider(
        platform: platform,
        google: google,
        apple: apple,
        browser: browser,
        serverClientId: 'web-client.apps.googleusercontent.com',
        iosClientId: 'ios-client.apps.googleusercontent.com',
      );
  setUp(() {
    google = FakeGoogle();
    apple = FakeApple();
    browser = FakeBrowser();
  });

  group('Google', () {
    test('initializes once with the server client id (iOS also the iOS client), signs out first, returns the ID token', () async {
      final p = provider('ios');
      final c = await p.pickGoogleAccount();
      await p.pickGoogleAccount();
      expect(c.idToken, 'id.token');
      expect(c.displayName, 'Aysel Məmmədova');
      expect(google.calls, ['init', 'signOut', 'authenticate', 'signOut', 'authenticate']);
      expect(google.init, (clientId: 'ios-client.apps.googleusercontent.com', serverClientId: 'web-client.apps.googleusercontent.com'));
      await provider('android').pickGoogleAccount();
      expect(google.init!.clientId, isNull);
    });

    test('a cancelled picker is silent', () async {
      google.authError = const GoogleSignInException(code: GoogleSignInExceptionCode.canceled);
      final error = await provider('android').pickGoogleAccount().then<Object?>((_) => null, onError: (Object e) => e);
      expect(error, isA<GoogleNativePickerError>());
      expect(resolveGoogleNativeFailure(error, 'android').action, NativeFailureAction.silent);
    });

    test('no credential / provider configuration / developer error fall back to the browser on Android only', () async {
      for (final e in [
        const GoogleSignInException(code: GoogleSignInExceptionCode.unknownError, description: 'No credential available: none'),
        const GoogleSignInException(code: GoogleSignInExceptionCode.providerConfigurationError, description: 'x'),
        const GoogleSignInException(code: GoogleSignInExceptionCode.clientConfigurationError, description: 'x'),
        const GoogleSignInException(code: GoogleSignInExceptionCode.uiUnavailable),
      ]) {
        google.authError = e;
        final error = await provider('android').pickGoogleAccount().then<Object?>((_) => null, onError: (Object e) => e);
        expect(resolveGoogleNativeFailure(error, 'android').action, NativeFailureAction.browser, reason: '$e');
        expect(resolveGoogleNativeFailure(error, 'ios').action, NativeFailureAction.error, reason: '$e');
      }
    });

    test('an empty ID token is "returned no idToken" (→ unavailable)', () async {
      google.result = (null, null);
      final error = await provider('android').pickGoogleAccount().then<Object?>((_) => null, onError: (Object e) => e);
      expect(classifyGoogleNativeError(error), GoogleNativeFailure.unavailable);
    });

    test('authenticate() unsupported on the platform is reported as unavailable', () async {
      google.supported = false;
      final error = await provider('android').pickGoogleAccount().then<Object?>((_) => null, onError: (Object e) => e);
      expect(classifyGoogleNativeError(error), GoogleNativeFailure.unavailable);
    });
  });

  group('Apple', () {
    test('passes the SHA-256 hex of the raw nonce to Apple and returns the name parts', () async {
      final raw = generateNonce();
      final hashed = sha256Hex(raw);
      final c = await provider('ios').authorizeApple(hashedNonce: hashed);
      expect(apple.nonce, hashed);
      expect(RegExp(r'^[0-9a-f]{64}$').hasMatch(apple.nonce!), isTrue);
      expect(c.identityToken, 'apple.jwt');
      expect(appleFullName(c), 'Aysel');
    });

    test('ASAuthorizationError 1001 is silent, 1000 shows the Apple ID message, others "failed"', () async {
      Future<NativeFailureOutcome> outcome(AuthorizationErrorCode code) async {
        apple.error = SignInWithAppleAuthorizationException(code: code, message: 'x');
        final e = await provider('ios').authorizeApple(hashedNonce: 'h').then<Object?>((_) => null, onError: (Object e) => e);
        return resolveAppleNativeFailure(e);
      }

      expect((await outcome(AuthorizationErrorCode.canceled)).action, NativeFailureAction.silent);
      final unknown = await outcome(AuthorizationErrorCode.unknown);
      expect(unknown.action, NativeFailureAction.error);
      expect(unknown.error!.kind, 'unknown');
      final failed = await outcome(AuthorizationErrorCode.failed);
      expect(failed.error!.kind, 'failed');
    });
  });

  group('Google browser OAuth fallback', () {
    test('recognises and parses the app callback (implicit and PKCE)', () {
      const url = '$nativeOAuthRedirect#access_token=a.b.c&refresh_token=r1&token_type=bearer';
      expect(isNativeOAuthCallback(url), isTrue);
      expect(isNativeOAuthCallback('anacan://tool/baby-names'), isFalse);
      final parsed = parseNativeOAuthCallback(url);
      expect((parsed.accessToken, parsed.refreshToken), ('a.b.c', 'r1'));
      expect(parseNativeOAuthCallback('$nativeOAuthRedirect?code=xyz').code, 'xyz');
      expect(parseNativeOAuthCallback('$nativeOAuthRedirect?error=access_denied').error, 'access_denied');
    });

    test('opens the OAuth page outside the app and closes the custom tab', () async {
      final p = provider('android');
      await p.openBrowser(Uri.parse('https://api.example/auth/v1/authorize?provider=google'));
      expect(browser.opened.single.toString(), 'https://api.example/auth/v1/authorize?provider=google');
      await p.closeBrowser();
      expect(browser.closed, 1);
      browser.ok = false;
      expect(() => p.openBrowser(Uri.parse('https://x')), throwsStateError);
    });
  });
}
