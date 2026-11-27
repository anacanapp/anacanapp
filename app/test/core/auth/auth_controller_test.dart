// Ported from: src/contexts/AuthContext.session.test.tsx, AuthContext.offline.test.tsx,
// AuthContext.partner.test.tsx, AuthContext.apple.test.tsx (native-relevant cases)

import 'dart:convert';

import 'package:anacan/core/auth/auth.dart';
import 'package:anacan/core/session/offline_session.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'support.dart';

final userA = fakeUser('user-a', email: 'a@example.invalid');

void main() {
  late AuthHarness h;

  Map<String, dynamic> profileRow({String userId = 'user-a', String stage = 'bump'}) => {
        'id': 'p-$userId',
        'user_id': userId,
        'name': 'Fixture',
        'life_stage': stage,
        'last_period_date': '2026-01-01',
        'due_date': '2026-10-08',
        'linked_partner_id': null,
        'partner_code': 'ANACAN-ABCD2345',
        'baby_count': 1,
      };

  Future<void> signedIn([Session? session]) async {
    await h.emit(AuthChangeEvent.signedIn, session ?? fakeSession('t1', userA));
    expect(h.state.profileLoaded, isTrue);
  }

  group('session (AuthContext.session.test)', () {
    setUp(() {
      h = AuthHarness()..start();
      h.backend.tables['profiles'] = [profileRow(), profileRow(userId: 'user-b')];
    });
    tearDown(() => h.dispose());

    test('does not re-hydrate or replace the user/profile when SIGNED_IN repeats for the same account on resume', () async {
      await signedIn();
      final user = h.state.user, profile = h.state.profile;
      final fetches = h.backend.tableCalls.length;
      await h.emit(AuthChangeEvent.signedIn, fakeSession('t1', fakeUser('user-a', email: 'a@example.invalid')));
      await h.emit(AuthChangeEvent.signedIn, fakeSession('t1', fakeUser('user-a', email: 'a@example.invalid')));
      expect(h.backend.tableCalls.length, fetches);
      expect(identical(h.state.user, user), isTrue);
      expect(identical(h.state.profile, profile), isTrue);
      await h.emit(AuthChangeEvent.tokenRefreshed, fakeSession('t2', fakeUser('user-a', email: 'a@example.invalid')));
      expect(identical(h.state.user, user), isTrue);
      expect(h.state.session?.accessToken, 't2');
    });

    test('refreshes the same account lightly at most every few minutes without the prefs upsert', () async {
      await signedIn();
      final profile = h.state.profile;
      h.now += sameUserRehydrate.inMilliseconds + 1;
      h.backend.calls.clear();
      await h.emit(AuthChangeEvent.signedIn, fakeSession('t1', userA));
      expect(h.backend.tableCalls, containsAll(['profiles', 'user_roles']));
      expect(h.backend.tableCalls, isNot(contains('user_preferences')));
      expect(identical(h.state.profile, profile), isTrue);
    });

    test('hydrates fully when a different account signs in', () async {
      await signedIn();
      h.backend.calls.clear();
      await h.emit(AuthChangeEvent.signedIn, fakeSession('t9', fakeUser('user-b')));
      expect(h.backend.tableCalls, contains('user_preferences'));
      expect(h.state.user?.id, 'user-b');
    });

    test('runs the privacy cleanup before clearing the session and empties the in-memory query cache', () async {
      await signedIn();
      h.queryClient.setQueryDataValue(const ['community-feed', 'user-a'], {'private': true});
      h.store.setItem('anacan_ocache_v1:profile', '{}');
      await h.auth.signOut();
      expect(h.order, ['cleanup', 'signOut']);
      expect(h.store.getItem('anacan_ocache_v1:profile'), isNull);
      expect(h.queryClient.getQueryData<Map>(const ['community-feed', 'user-a']), isNull);
      expect(h.state.user, isNull);
      expect(h.user.isAuthenticated, isFalse);
    });

    test('still signs out when the cleanup fails', () async {
      await signedIn();
      h.cleanupError = StateError('bridge');
      final result = await h.auth.signOut();
      expect(result.error, isNull);
      expect(h.order.where((e) => e == 'signOut'), hasLength(1));
      expect(h.state.user, isNull);
    });

    test('syncs the profile into the user store (stage, dates, partner code) and caches it offline', () async {
      await signedIn();
      expect(h.user.isAuthenticated, isTrue);
      expect(h.user.lifeStage, 'bump');
      expect(h.user.isOnboarded, isTrue);
      expect(h.user.lastPeriodDate, DateTime(2026, 1, 1));
      expect(h.user.partnerCode, 'ANACAN-ABCD2345');
      expect(h.user.name, 'Fixture');
      expect(h.store.getItem('anacan_ocache_v1:profile'), contains('"user_id":"user-a"'));
      expect(h.state.isAdmin, isFalse);
    });
  });

  group('offline (AuthContext.offline.test)', () {
    final expired = {
      'access_token': 'old',
      'refresh_token': 'r1',
      'expires_at': DateTime.now().millisecondsSinceEpoch ~/ 1000 - 3600,
      'user': {
        'id': 'user-a', 'email': 'a@example.invalid', 'user_metadata': {'name': 'Fixture'}, 'app_metadata': {},
        'aud': 'authenticated', 'created_at': '2025-01-01T00:00:00Z', 'last_sign_in_at': '2026-01-01T00:00:00Z',
      },
    };
    final cachedProfile = {'id': 'p', 'user_id': 'user-a', 'name': 'Fixture', 'life_stage': 'mommy', 'baby_count': 1};

    setUp(() {
      h = AuthHarness()..start();
      h.backend.offline = true;
      h.connectivity.setOnline(false);
    });
    tearDown(() => h.dispose());

    test('opens read-only on the stored account when the expired token cannot be refreshed offline', () async {
      h.stored = parseStoredSession(jsonEncode(expired));
      h.store.setItem('anacan_ocache_v1:profile',
          jsonEncode({'userId': 'user-a', 'savedAt': DateTime.now().millisecondsSinceEpoch, 'data': cachedProfile}));
      await h.emit(AuthChangeEvent.initialSession, null);
      expect(h.state.user?.id, 'user-a');
      expect(h.state.loading, isFalse);
      expect(h.state.profileLoaded, isTrue);
      expect(h.state.profile?.lifeStage, 'mommy');
      expect(h.user.isAuthenticated, isTrue);
      expect(h.user.name, 'Fixture');
      expect(h.backend.calls, isEmpty);
    });

    test('still logs out when no session is stored (real invalid token: Auth removed it)', () async {
      h.store.setItem('anacan-user-store', '{"state":{"isAuthenticated":true,"userId":"user-a"},"version":0}');
      h.container.read(authControllerProvider);
      await h.emit(AuthChangeEvent.initialSession, null);
      expect(h.state.user, isNull);
      expect(h.state.loading, isFalse);
      expect(h.user.isAuthenticated, isFalse);
    });

    test('clears the offline account on SIGNED_OUT after an invalid refresh token', () async {
      h.stored = parseStoredSession(jsonEncode(expired));
      await h.emit(AuthChangeEvent.initialSession, null);
      expect(h.state.user?.id, 'user-a');
      h.stored = null;
      await h.emit(AuthChangeEvent.signedOut, null);
      expect(h.state.user, isNull);
      expect(h.user.isAuthenticated, isFalse);
    });

    test('refreshes when the network returns, then hydrates from the server and flushes the outbox', () async {
      h.stored = parseStoredSession(jsonEncode(expired));
      await h.emit(AuthChangeEvent.initialSession, null);
      h.backend
        ..offline = false
        ..tables['profiles'] = [cachedProfile];
      h.connectivity.setOnline(true);
      await h.settle();
      expect(h.refreshCalls, 1);
      await h.emit(AuthChangeEvent.tokenRefreshed, fakeSession('new', fakeUser('user-a', email: 'a@example.invalid')));
      expect(h.outbox.flushed, ['user-a']);
      expect(h.state.profile?.lifeStage, 'mommy');
      expect(h.backend.tableCalls, contains('profiles'));
      expect(h.state.session?.accessToken, 'new');
    });

    test('does not open on the stored account while a valid (unexpired) session loads normally', () async {
      h.stored = parseStoredSession(jsonEncode({...expired, 'expires_at': DateTime.now().millisecondsSinceEpoch ~/ 1000 + 3600}));
      h.container.read(authControllerProvider);
      await h.settle();
      expect(h.state.user, isNull);
      expect(h.user.isAuthenticated, isFalse);
    });
  });

  group('existing-account linkPartner (AuthContext.partner.test)', () {
    setUp(() {
      h = AuthHarness()..start();
      h.backend.tables['profiles'] = [
        {'id': 'my-profile', 'user_id': 'user-a', 'name': 'Fixture A', 'life_stage': 'bump', 'linked_partner_id': null,
          'partner_code': 'ANACAN-ABCD2345'},
      ];
      h.backend.onRpc = (fn, params) async {
        h.backend.tables['profiles']![0]['linked_partner_id'] = 'other-profile';
        h.backend.tables['profiles']![0]['life_stage'] = 'partner';
        return {'ok': true};
      };
    });
    tearDown(() => h.dispose());

    for (final stage in ['bump', 'mommy']) {
      test('hydrates $stage multiple-child data after a fresh login', () async {
        h.backend.tables['profiles']![0]
          ..['life_stage'] = stage
          ..['baby_count'] = 3
          ..['multiples_type'] = 'triplets';
        if (stage == 'mommy') {
          h.backend.tables['profiles']![0]
            ..['baby_name'] = 'Fixture Child'
            ..['baby_birth_date'] = '2026-08-01'
            ..['baby_gender'] = 'girl';
        }
        await signedIn();
        expect(h.user.babyCount, 3);
        expect(h.user.multiplesType, 'triplets');
        if (stage == 'mommy') {
          expect(h.user.babyBirthDate, DateTime(2026, 8, 1));
          expect(h.user.babyName, 'Fixture Child');
        }
      });
    }

    test('uses the code-only RPC then synchronizes the confirmed profile in Azure', () async {
      await signedIn();
      h.backend.updates.clear();
      final result = await h.auth.linkPartner(' anacan-abcd23 ');
      expect(result.error, isNull);
      expect(h.backend.rpcCalls, ['link_partner_by_code']);
      expect(h.backend.updates, isEmpty);
      expect(h.state.profile?.linkedPartnerId, 'other-profile');
      expect(h.user.linkedPartnerId, 'other-profile');
      expect(h.store.getItem('anacan_ocache_v1:profile'), contains('other-profile'));
    });

    test('clears a server-confirmed one-sided legacy link once, then retries the code', () async {
      h.backend.tables['profiles']![0]['linked_partner_id'] = 'stale-profile';
      var linkCalls = 0;
      h.backend.onRpc = (fn, params) async {
        if (fn == 'get_user_linked_partner_id') return null;
        if (fn == 'unlink_partners') {
          h.backend.tables['profiles']![0]['linked_partner_id'] = null;
          return null;
        }
        linkCalls++;
        if (linkCalls == 1) return {'ok': false, 'error': 'PAIRING_CONFLICT'};
        h.backend.tables['profiles']![0]['linked_partner_id'] = 'other-profile';
        return {'ok': true};
      };
      await signedIn();
      expect((await h.auth.linkPartner('ANACAN-ABCD23')).error, isNull);
      expect(h.backend.rpcCalls, ['link_partner_by_code', 'get_user_linked_partner_id', 'unlink_partners', 'link_partner_by_code']);
      expect(h.state.profile?.linkedPartnerId, 'other-profile');
    });

    test('keeps a mutual link and reports the conflict without unlinking', () async {
      h.backend.tables['profiles']![0]['linked_partner_id'] = 'other-profile';
      h.backend.onRpc = (fn, params) async =>
          fn == 'get_user_linked_partner_id' ? 'other-profile' : {'ok': false, 'error': 'PAIRING_CONFLICT'};
      await signedIn();
      final result = await h.auth.linkPartner('ANACAN-ABCD23');
      expect((result.error as PartnerLinkError).code, 'PAIRING_CONFLICT');
      expect(h.backend.rpcCalls, ['link_partner_by_code', 'get_user_linked_partner_id']);
    });

    test('returns an occupied-link rejection rather than reporting success', () async {
      h.backend.onRpc = (fn, params) async => {'ok': false, 'error': 'PAIRING_CONFLICT'};
      await signedIn();
      h.backend.calls.clear();
      final result = await h.auth.linkPartner('ANACAN-ABCD23');
      expect((result.error as PartnerLinkError).code, 'PAIRING_CONFLICT');
      expect(h.backend.tableCalls, isEmpty);
      expect(h.state.profile?.linkedPartnerId, isNull);
    });

    for (final code in ['42501', 'PGRST202']) {
      test('returns $code without falling back to direct writes', () async {
        h.backend.onRpc = (fn, params) async => throw PostgrestException(message: 'RPC unavailable', code: code);
        await signedIn();
        h.backend.calls.clear();
        final result = await h.auth.linkPartner('ANACAN-ABCD23');
        expect((result.error as PostgrestException).code, code);
        expect(h.backend.tableCalls, isEmpty);
        expect(h.backend.rpcCalls, ['link_partner_by_code']);
      });
    }

    test('does not disguise a failed post-pair refresh as a successful cached profile', () async {
      await signedIn();
      h.store.removeItem('anacan_ocache_v1:profile');
      h.backend.profileError = {'message': 'offline', 'code': 'XX000'};
      final result = await h.auth.linkPartner('ANACAN-ABCD23');
      expect(result.error, isA<PostgrestException>());
      expect(h.store.getItem('anacan_ocache_v1:profile'), isNull);
    });
  });

  group('never falls back to legacy direct updates when secure pairing is unavailable', () {
    test('PAIRING_UNAVAILABLE without RPC', () async {
      h = AuthHarness(pairing: false)..start();
      addTearDown(h.dispose);
      h.backend.tables['profiles'] = [profileRow()];
      await signedIn();
      h.backend.calls.clear();
      final result = await h.auth.linkPartner('ANACAN-ABCD23');
      expect((result.error as PartnerLinkError).code, 'PAIRING_UNAVAILABLE');
      expect(h.backend.calls, isEmpty);
    });
  });

  group('social sign-in (AuthContext.apple.test, native-auth.ts)', () {
    final tokenResponse = {
      'access_token': 'at', 'token_type': 'bearer', 'expires_in': 3600, 'refresh_token': 'rt',
      'user': {'id': 'social-user', 'aud': 'authenticated', 'app_metadata': {}, 'user_metadata': {},
        'created_at': '2025-01-01T00:00:00Z'},
    };

    test('preserves native iOS Apple authentication (nonce, id token) and applies the first-auth name', () async {
      final social = FakeSocial('ios');
      String? hashed;
      social.apple = (nonce) async {
        hashed = nonce;
        return const AppleCredential(identityToken: 'apple-id-token', givenName: 'Leyla', familyName: 'Ə');
      };
      h = AuthHarness(social: social)..start();
      addTearDown(h.dispose);
      h.backend.authSession = tokenResponse;
      final result = await h.auth.signInWithApple();
      expect(result.error, isNull);
      expect(result.data?.user?.id, 'social-user');
      expect(hashed, matches(RegExp(r'^[0-9a-f]{64}$')));
      expect(h.backend.calls, contains('auth:token'));
      expect(h.backend.updates.single, {'name': 'Leyla Ə'});
      expect(social.opened, isEmpty);
    });

    test('Apple sheet closed (1001) is silent; 1000 gives the iCloud message', () async {
      final social = FakeSocial('ios');
      h = AuthHarness(social: social)..start();
      addTearDown(h.dispose);
      social.apple = (_) async => throw Exception('(com.apple.AuthenticationServices.AuthorizationError error 1001.)');
      expect((await h.auth.signInWithApple()).error, isNull);
      social.apple = (_) async => throw Exception('(com.apple.AuthenticationServices.AuthorizationError error 1000.)');
      final result = await h.auth.signInWithApple();
      expect((result.error as SocialSignInError).message, contains('iCloud'));
    });

    test('does not apply the native Apple flow to Android (OAuth page in the browser)', () async {
      final social = FakeSocial('android');
      h = AuthHarness(social: social)..start();
      addTearDown(h.dispose);
      await h.auth.signInWithApple();
      expect(social.opened.single.path, '/auth/v1/authorize');
      expect(social.opened.single.queryParameters['provider'], 'apple');
    });

    test('Google: native picker → signInWithIdToken; old Android → browser OAuth with the app redirect', () async {
      final social = FakeSocial('android');
      h = AuthHarness(social: social)..start();
      addTearDown(h.dispose);
      h.backend.authSession = tokenResponse;
      social.google = () async => const GoogleCredential(idToken: 'g', displayName: 'Leyla');
      expect((await h.auth.signInWithGoogle()).data?.user?.id, 'social-user');
      social.google = () async => throw GoogleNativePickerError(Exception('10: '));
      final fallback = await h.auth.signInWithGoogle();
      expect(fallback.error, isNull);
      final url = social.opened.single;
      expect(url.queryParameters['provider'], 'google');
      expect(url.queryParameters['redirect_to'], nativeOAuthRedirect);
      expect(url.queryParameters['prompt'], 'select_account');
      social.google = () async => throw GoogleNativePickerError(Exception('Authorization canceled.'));
      expect((await h.auth.signInWithGoogle()).error, isNull);
    });

    test('completes the browser callback with the implicit-flow tokens', () async {
      final social = FakeSocial('android');
      h = AuthHarness(social: social)..start();
      addTearDown(h.dispose);
      h.backend.authSession = tokenResponse;
      expect(await h.auth.completeNativeOAuthCallback('https://elsewhere/#access_token=a'), isFalse);
      expect(await h.auth.completeNativeOAuthCallback('$nativeOAuthRedirect#access_token=at&refresh_token=rt&expires_in=3600'),
          isTrue);
    });
  });

  group('account', () {
    test('deleteAccount needs a session', () async {
      h = AuthHarness()..start();
      addTearDown(h.dispose);
      final result = await h.auth.deleteAccount();
      expect(result.error, isA<StateError>());
      expect(h.backend.calls, isEmpty);
    });
  });
}
