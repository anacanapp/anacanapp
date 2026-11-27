// Ported from: (test support for src/contexts/AuthContext.*.test.tsx) — a fake PostgREST/Auth server behind
// the real SupabaseClient, and a ProviderContainer wired like the app.

import 'dart:async';
import 'dart:convert';

import 'package:anacan/core/auth/auth.dart';
import 'package:anacan/core/cache/cache.dart';
import 'package:anacan/core/i18n/language_controller.dart';
import 'package:anacan/core/offline/offline.dart';
import 'package:anacan/core/session/logout_cleanup.dart';
import 'package:anacan/core/session/offline_session.dart';
import 'package:anacan/state/state.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../support/i18n_fakes.dart';

class FakeBackend {
  final tables = <String, List<Map<String, dynamic>>>{
    'profiles': [],
    'user_roles': [{'role': 'user'}],
    'user_preferences': [{'language': 'en'}],
  };

  /// Table name or `rpc:<fn>` / `auth:<path>` of every request.
  final calls = <String>[];
  final updates = <Map<String, dynamic>>[];
  bool offline = false;
  Object? profileError;
  Future<Object?> Function(String fn, Map<String, dynamic> params)? onRpc;
  Map<String, dynamic>? authSession;

  late final SupabaseClient client = SupabaseClient(
    'https://backend.test',
    'anon',
    httpClient: MockClient(_handle),
    authOptions: const AuthClientOptions(autoRefreshToken: false, authFlowType: AuthFlowType.implicit),
  );

  List<String> get tableCalls => calls.where((c) => !c.contains(':')).toList();
  List<String> get rpcCalls => [for (final c in calls) if (c.startsWith('rpc:')) c.substring(4)];

  http.Response _json(http.Request request, Object? body, [int status = 200]) =>
      http.Response.bytes(utf8.encode(jsonEncode(body)), status, headers: {'content-type': 'application/json'}, request: request);

  Future<http.Response> _handle(http.Request request) async {
    final path = request.url.path;
    if (path.startsWith('/auth/v1/')) {
      calls.add('auth:${path.substring(9)}');
      if (authSession != null) return _json(request, path.endsWith('/user') ? authSession!['user'] : authSession);
      return _json(request, {'code': 'unexpected', 'msg': 'no fake auth'}, 400);
    }
    if (path.startsWith('/functions/v1/')) {
      calls.add('fn:${path.substring(14)}');
      return _json(request, {'ok': true});
    }
    if (offline) throw http.ClientException('Failed host lookup: offline');
    if (path.startsWith('/rest/v1/rpc/')) {
      final fn = path.substring(13);
      calls.add('rpc:$fn');
      final decoded = request.body.isEmpty ? null : jsonDecode(request.body);
      final params = decoded is Map<String, dynamic> ? decoded : <String, dynamic>{};
      try {
        return _json(request, await onRpc?.call(fn, params));
      } on PostgrestException catch (e) {
        return _json(request, {'code': e.code, 'message': e.message}, 400);
      }
    }
    final table = path.substring(9);
    calls.add(table);
    if (table == 'profiles' && profileError != null) return _json(request, profileError, 400);
    var rows = tables[table] ??= [];
    final filters = <String, String>{};
    request.url.queryParameters.forEach((k, v) {
      if (v.startsWith('eq.')) filters[k] = v.substring(3);
    });
    bool match(Map<String, dynamic> row) =>
        filters.entries.every((f) => !row.containsKey(f.key) || '${row[f.key]}' == f.value);
    switch (request.method) {
      case 'PATCH':
        final body = jsonDecode(request.body) as Map<String, dynamic>;
        updates.add(body);
        final hit = rows.where(match).toList();
        for (final row in hit) {
          row.addAll(body);
        }
        return _json(request, hit);
      case 'POST':
        return _json(request, [jsonDecode(request.body)], 201);
      default:
        return _json(request, rows.where(match).toList());
    }
  }
}

User fakeUser(String id, {String? email, Map<String, dynamic> metadata = const {}}) => User(
      id: id,
      appMetadata: const {},
      userMetadata: metadata,
      aud: 'authenticated',
      email: email ?? '$id@example.invalid',
      createdAt: '2025-01-01T00:00:00Z',
      lastSignInAt: '2026-01-01T00:00:00Z',
    );

Session fakeSession(String token, User user) =>
    Session(accessToken: token, refreshToken: 'r', tokenType: 'bearer', user: user);

class RecordingOutbox extends OfflineOutbox {
  RecordingOutbox(LocalStore store) : super(store: store, sender: (_, _) async => const SendResult(), log: (_) {});
  final flushed = <String>[];
  @override
  Future<FlushResult> flush(String? userId, [OutboxSender? send]) async {
    if (userId != null) flushed.add(userId);
    return FlushResult();
  }
}

class FakeSocial implements SocialAuthProvider {
  FakeSocial(this.platform);
  @override
  final String platform;
  Future<GoogleCredential> Function()? google;
  Future<AppleCredential> Function(String hashedNonce)? apple;
  final opened = <Uri>[];
  @override
  Future<GoogleCredential> pickGoogleAccount() => google!();
  @override
  Future<AppleCredential> authorizeApple({required String hashedNonce}) => apple!(hashedNonce);
  @override
  Future<void> openBrowser(Uri url) async => opened.add(url);
  @override
  Future<void> closeBrowser() async {}
}

class AuthHarness {
  AuthHarness({this.social, this.pairing = true, this.extraOverrides = const []});

  final List<Override> extraOverrides;

  final FakeSocial? social;
  final bool pairing;
  final backend = FakeBackend();
  final events = StreamController<AuthState>();
  final store = LocalStore.memory();
  final connectivity = ManualConnectivitySource();
  final queryClient = QueryClient(defaults: const QueryDefaults(retry: noRetry));
  final order = <String>[];
  StoredSession? stored;
  int refreshCalls = 0;
  int now = DateTime.now().millisecondsSinceEpoch;
  Object? cleanupError;
  late final RecordingOutbox outbox = RecordingOutbox(store);
  late final ProviderContainer container;

  AuthController get auth => container.read(authControllerProvider.notifier);
  AuthViewState get state => container.read(authControllerProvider);
  UserState get user => container.read(userStoreProvider);

  void start() {
    final runtime = installTestI18n();
    container = ProviderContainer(overrides: [
      localStoreProvider.overrideWithValue(store),
      i18nRuntimeProvider.overrideWithValue(runtime),
      userStorePlatformProvider.overrideWithValue(_NoopPlatform()),
      connectivitySourceProvider.overrideWithValue(connectivity),
      queryClientProvider.overrideWithValue(queryClient),
      offlineOutboxProvider.overrideWithValue(outbox),
      authEnvironmentProvider.overrideWithValue(AuthEnvironment(
        client: backend.client,
        authEvents: events.stream,
        currentSession: () => null,
        signOutSdk: () async => order.add('signOut'),
        readPersistedSession: () async => stored,
        refreshSession: () async => refreshCalls++,
        logoutCleanup: LogoutCleanupSteps(dropQueuedNotificationTaps: () async {
          order.add('cleanup');
          if (cleanupError != null) throw cleanupError!;
        }),
        social: social,
        partnerPairingEnabled: pairing,
        now: () => now,
      )),
      ...extraOverrides,
    ]);
    container.listen(authControllerProvider, (_, _) {});
  }

  Future<void> emit(AuthChangeEvent event, Session? session) async {
    events.add(AuthState(event, session));
    await settle();
  }

  Future<void> settle() async {
    for (var i = 0; i < 20; i++) {
      await Future<void>.delayed(Duration.zero);
    }
    await Future<void>.delayed(const Duration(milliseconds: 5));
  }

  void dispose() {
    container.dispose();
    unawaited(events.close());
  }
}

class _NoopPlatform implements UserStorePlatform {
  @override
  void languageChanged(String language) {}
  @override
  void writePreference(String key, String value) {}
}
