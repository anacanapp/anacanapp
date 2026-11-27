// Ported from: src/lib/social-auth-errors.test.ts, src/lib/partner-link.test.ts
// (+ AuthScreen error mapping and native-auth.ts callback parsing)

import 'package:anacan/core/auth/auth.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../support/i18n_fakes.dart';

String ns(int code, [String prefix = 'The operation couldn’t be completed.']) =>
    '$prefix (com.apple.AuthenticationServices.AuthorizationError error $code.)';

void main() {
  setUpAll(installTestI18n);

  group('Google native sign-in failure classification', () {
    for (final message in ['activity is cancelled by the user.', 'Authorization canceled.', 'User cancelled the selector', '12501: ']) {
      test('cancel: $message', () => expect(classifyGoogleNativeError({'message': message}), GoogleNativeFailure.cancelled));
    }
    for (final message in [
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
    ]) {
      test('old-device / unavailable: $message',
          () => expect(classifyGoogleNativeError(StateError(message)), GoogleNativeFailure.unavailable));
    }

    test('network and generic failures', () {
      expect(
          classifyGoogleNativeError({
            'message': 'A network error (such as timeout, interrupted connection) has occurred.',
            'code': 'auth/network-request-failed',
          }),
          GoogleNativeFailure.network);
      expect(classifyGoogleNativeError({'message': 'request timed out after 10 seconds'}), GoogleNativeFailure.network);
      expect(
          classifyGoogleNativeError({'message': 'The supplied auth credential is malformed', 'code': 'auth/invalid-credential'}),
          GoogleNativeFailure.failed);
      expect(classifyGoogleNativeError(null), GoogleNativeFailure.failed);
    });

    test('falls back to the browser only on Android, cancels silently, never shows raw codes', () {
      expect(resolveGoogleNativeFailure({'message': '10: '}, 'android'),
          const NativeFailureOutcome(NativeFailureAction.browser, report: true));
      expect(resolveGoogleNativeFailure({'message': 'Authorization canceled.'}, 'android'),
          const NativeFailureOutcome(NativeFailureAction.silent));
      final ios = resolveGoogleNativeFailure({'message': '12500: '}, 'ios');
      expect(ios.action, NativeFailureAction.error);
      expect(ios.error!.message, isNot(contains('12500')));
      final network = resolveGoogleNativeFailure({'code': 'auth/network-request-failed', 'message': 'network error'}, 'android');
      expect(network.action, NativeFailureAction.error);
      expect(network.report, isFalse);
    });
  });

  group('Apple native sign-in failure classification', () {
    test('1001 (sheet closed) is a silent no-op', () {
      expect(classifyAppleNativeError(ns(1001)), AppleNativeFailure.cancelled);
      expect(classifyAppleNativeError({'message': ns(1001, 'Der Vorgang konnte nicht abgeschlossen werden.')}),
          AppleNativeFailure.cancelled);
      expect(classifyAppleNativeError({'code': '1001', 'message': 'x'}), AppleNativeFailure.cancelled);
      expect(resolveAppleNativeFailure(StateError(ns(1001))), const NativeFailureOutcome(NativeFailureAction.silent));
    });

    test('1000 (unknown) shows a clear iCloud message without the raw code', () {
      expect(classifyAppleNativeError(StateError(ns(1000))), AppleNativeFailure.unknown);
      final outcome = resolveAppleNativeFailure(StateError(ns(1000)));
      expect(outcome.action, NativeFailureAction.error);
      expect(outcome.error!.message, matches(RegExp('Apple ID|iCloud')));
      expect(outcome.error!.message, isNot(matches(RegExp('1000|AuthorizationError'))));
    });

    test('other AuthenticationServices codes get a friendly message; backend errors keep their path', () {
      final failed = resolveAppleNativeFailure(StateError(ns(1004)));
      expect(failed.action, NativeFailureAction.error);
      expect(failed.error!.message, isNot(contains('1004')));
      expect(resolveAppleNativeFailure(StateError('Database error saving new user')),
          const NativeFailureOutcome(NativeFailureAction.rethrow_));
      expect(resolveAppleNativeFailure(StateError('Apple Sign-In returned no identityToken')),
          const NativeFailureOutcome(NativeFailureAction.rethrow_));
    });
  });

  group('Azure pairing opt-in', () {
    late List<(String, Map<String, dynamic>?)> calls;
    Object? Function(String, Map<String, dynamic>?) answer = (_, _) => {'ok': true};
    PartnerLink link({bool enabled = true}) => PartnerLink(
          pairingEnabled: enabled,
          rpc: (fn, [params]) async {
            calls.add((fn, params));
            final value = answer(fn, params);
            if (value is Exception) throw value;
            return value;
          },
        );

    setUp(() {
      calls = [];
      answer = (_, _) => {'ok': true};
    });

    test('isAzurePairingBackend follows the build flags', () {
      for (final flag in ['', 'false', '1', 'TRUE']) {
        expect(isAzurePairingBackend(buildMode: 'production', azurePartnerPairing: flag, sourceFirst: false, azure: false), isFalse);
      }
      expect(isAzurePairingBackend(buildMode: 'google', azurePartnerPairing: '', sourceFirst: true, azure: false), isTrue);
      expect(isAzurePairingBackend(buildMode: 'x', azurePartnerPairing: 'true', sourceFirst: true, azure: false), isFalse);
      expect(isAzurePairingBackend(buildMode: 'x', azurePartnerPairing: 'true', sourceFirst: true, azure: true), isTrue);
    });

    test('does not opt in when disabled', () async {
      expect(await link(enabled: false).getPartnerCodeForSharing('ANACAN-A01F'), 'ANACAN-A01F');
      await expectLater(link(enabled: false).linkPartnerByCode('ANACAN-ABCD2345'),
          throwsA(isA<PartnerLinkError>().having((e) => e.code, 'code', 'PAIRING_UNAVAILABLE')));
      expect(calls, isEmpty);
    });

    test('normalizes current 6/8 character codes and sends only the code', () async {
      expect(normalizeSecurePartnerCode('  anacan-abcd23  '), 'ANACAN-ABCD23');
      await link().linkPartnerByCode('  anacan-abcd2345  ');
      expect(calls.single.$1, 'link_partner_by_code');
      expect(calls.single.$2, {'p_partner_code': 'ANACAN-ABCD2345'});
    });

    test('rejects weak invitations before any signup preflight or RPC', () async {
      await expectLater(link().linkPartnerByCode(' anacan-a01f '),
          throwsA(isA<PartnerLinkError>().having((e) => e.code, 'code', 'PARTNER_CODE_EXPIRED')));
      expect(getPartnerLinkErrorMessage(const PartnerLinkError('PARTNER_CODE_EXPIRED')), contains('share a new code'));
      expect(calls, isEmpty);
    });

    for (final code in ['', 'ANACAN-ABCDE', 'ANACAN-ABCDEF2', 'ANACAN-ABCD01', 'ANACAN-ABCDEFGI', 'ANACAN-ABCD23456', 'X' * 65, null]) {
      test('rejects malformed or oversized input $code', () async {
        await expectLater(link().linkPartnerByCode(code),
            throwsA(isA<PartnerLinkError>().having((e) => e.code, 'code', 'INVALID_PARTNER_CODE')));
        expect(calls, isEmpty);
      });
    }

    for (final error in ['PAIRING_SELF_LINK', 'PAIRING_CONFLICT', 'PAIRING_RATE_LIMITED', 'PROFILE_NOT_READY', 'PAIRING_RETRY']) {
      test('propagates the server rejection $error without falling back', () async {
        answer = (_, _) => {'ok': false, 'error': error};
        await expectLater(link().linkPartnerByCode('ANACAN-ABCD2345'),
            throwsA(isA<PartnerLinkError>().having((e) => e.code, 'code', error)));
        expect(calls, hasLength(1));
      });
    }

    for (final data in [null, false, true, [], {}, {'ok': false}, {'ok': 'true'}]) {
      test('does not mistake $data for success', () async {
        answer = (_, _) => data;
        await expectLater(link().linkPartnerByCode('ANACAN-ABCD2345'),
            throwsA(isA<PartnerLinkError>().having((e) => e.code, 'code', 'PAIRING_FAILED')));
      });
    }

    test('propagates transport failure / missing RPC without a fallback', () async {
      final error = const PostgrestException(message: 'Server detail', code: 'PGRST202');
      answer = (_, _) => error;
      await expectLater(link().linkPartnerByCode('ANACAN-ABCD2345'), throwsA(same(error)));
      expect(calls, hasLength(1));
    });
  });

  group('secure invitation sharing', () {
    for (final code in ['ANACAN-ABCD23', 'ANACAN-ABCD2345']) {
      test('uses the owner-authenticated RPC value $code', () async {
        final calls = <String>[];
        final link = PartnerLink(pairingEnabled: true, rpc: (fn, [_]) async {
          calls.add(fn);
          return code;
        });
        expect(await link.getPartnerCodeForSharing('ANACAN-A01F'), code);
        expect(calls, ['ensure_secure_partner_code']);
      });
    }

    for (final data in [null, 'ANACAN-A01F', false]) {
      test('does not share a stale code when the server returns $data', () async {
        final link = PartnerLink(pairingEnabled: true, rpc: (_, [_]) async => data);
        await expectLater(link.getPartnerCodeForSharing('ANACAN-A01F'),
            throwsA(isA<PartnerLinkError>().having((e) => e.code, 'code', 'PAIRING_UNAVAILABLE')));
      });
    }

    test('propagates rotation errors and hides unrecognized server details in UI messages', () {
      const error = PostgrestException(message: 'private-server-detail', code: 'PGRST202');
      expect(getPartnerLinkErrorMessage(error), isNot(contains(error.message)));
      expect(getPartnerLinkErrorMessage(const PostgrestException(message: 'PROFILE_NOT_READY', code: 'P0001')),
          contains('do not register again'));
    });
  });

  group('AuthScreen error messages', () {
    test('sign-in', () {
      expect(getLoginErrorMessage(const AuthApiException('Invalid login credentials', code: 'invalid_credentials')),
          'E-mail və ya şifrə yanlışdır.');
      expect(getLoginErrorMessage(const AuthApiException('Email not confirmed')), 'E-mail təsdiqlənməyib.');
      expect(getLoginErrorMessage(AuthRetryableFetchException(message: 'Connection failed')),
          startsWith('Serverə qoşulmaq mümkün olmadı'));
      expect(getLoginErrorMessage(null), startsWith('Giriş zamanı xəta'));
      expect(getLoginErrorMessage(const AuthApiException('Something else')), 'Something else');
    });

    test('sign-up', () {
      expect(getSignupErrorMessage(const AuthApiException('weak', code: 'weak_password')), startsWith('Şifrə çox zəifdir'));
      expect(getSignupErrorMessage(const AuthApiException('User already registered')), startsWith('Bu e-mail artıq'));
      expect(getSignupErrorMessage({'message': 'Password should be at least 6 characters'}), startsWith('Şifrə ən azı 6'));
      expect(getSignupErrorMessage({'message': 'over rate limit'}), startsWith('Çox sayda cəhd edildi. Bir az sonra yenidən cəhd'));
      expect(isModeratorSignupError({'message': 'MODERATOR_SIGNUP_NETWORK_RESTRICTED'}), isTrue);
    });
  });

  group('native OAuth callback', () {
    test('parses tokens from the fragment and errors, never other schemes', () {
      expect(isNativeOAuthCallback('com.atlasoon.anacan://auth-callback#access_token=a'), isTrue);
      expect(isNativeOAuthCallback('anacan://tool/x'), isFalse);
      final cb = parseNativeOAuthCallback('com.atlasoon.anacan://auth-callback?x=1#access_token=a&refresh_token=r&expires_in=3600');
      expect((cb.accessToken, cb.refreshToken, cb.code), ('a', 'r', null));
      expect(cb.params['expires_in'], '3600');
      expect(parseNativeOAuthCallback('com.atlasoon.anacan://auth-callback?code=c').code, 'c');
      expect(parseNativeOAuthCallback('com.atlasoon.anacan://auth-callback?error=access_denied&error_description=Denied').error,
          'Denied');
      expect(sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
      expect(generateNonce(), hasLength(32));
    });
  });
}
