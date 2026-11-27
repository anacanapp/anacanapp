// Shared fakes for the core backend tests (not a test file).

import 'dart:async';
import 'dart:convert';

import 'package:anacan/core/session/auth_gateway.dart';
import 'package:http/http.dart' as http;

typedef HttpHandler = Future<http.StreamedResponse> Function(http.BaseRequest request);

/// Records every request; [handler] answers (like `vi.fn()` + `mockResolvedValue`).
class FakeHttpClient extends http.BaseClient {
  FakeHttpClient([HttpHandler? handler]) : handler = handler ?? ((_) async => jsonResponse(null));

  HttpHandler handler;
  final List<http.BaseRequest> calls = [];

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) {
    calls.add(request);
    return handler(request);
  }
}

http.StreamedResponse textResponse(String body, int status, {Map<String, String> headers = const {}}) =>
    http.StreamedResponse(Stream.value(utf8.encode(body)), status, headers: headers);

http.StreamedResponse jsonResponse(Object? value, {int status = 200, Map<String, String>? headers}) => textResponse(
      jsonEncode(value),
      status,
      headers: headers ?? const {'content-type': 'application/json', 'cache-control': 'no-store'},
    );

/// A response whose body read fails (truncated read).
http.StreamedResponse brokenBodyResponse({int status = 200}) => http.StreamedResponse(
      Stream<List<int>>.error(http.ClientException('network')),
      status,
      headers: const {'content-type': 'application/json', 'cache-control': 'no-store'},
    );

class Deferred<T> {
  final Completer<T> _completer = Completer<T>();
  Future<T> get future => _completer.future;
  void resolve(T value) => _completer.complete(value);
  void reject(Object error) => _completer.completeError(error);
}

/// Scriptable [SessionAuthGateway] (the vitest `mocks.auth`).
class FakeAuthGateway implements SessionAuthGateway {
  AuthEventListener? listener;
  int subscribeCount = 0;
  final List<Object?> refreshCalls = [];
  int getSessionCalls = 0;
  final List<bool> signOutCalls = [];
  int stopAutoRefreshCalls = 0;

  /// Default answers; tests replace them.
  Future<AuthCallResult> Function() onGetSession = () async => const AuthCallResult();
  Future<AuthCallResult> Function(String? token)? onRefresh;
  Future<void> Function(bool others) onSignOut = (_) async {};

  /// One-shot overrides, consumed first (like `mockResolvedValueOnce`).
  final List<Future<AuthCallResult> Function()> getSessionOnce = [];
  final List<Future<AuthCallResult> Function(String? token)> refreshOnce = [];
  final List<Future<void> Function(bool others)> signOutOnce = [];

  void emit(AuthEventKind event, [AuthSessionView? session]) => listener?.call(event, session);

  @override
  Future<AuthCallResult> getSession() {
    getSessionCalls++;
    if (getSessionOnce.isNotEmpty) return getSessionOnce.removeAt(0)();
    return onGetSession();
  }

  @override
  Future<AuthCallResult> refreshSession([String? refreshToken]) {
    refreshCalls.add(refreshToken);
    if (refreshOnce.isNotEmpty) return refreshOnce.removeAt(0)(refreshToken);
    return (onRefresh ?? (_) async => const AuthCallResult())(refreshToken);
  }

  @override
  void Function() onAuthStateChange(AuthEventListener listener) {
    subscribeCount++;
    this.listener = listener;
    return () {};
  }

  @override
  Future<void> signOut({bool others = false}) {
    signOutCalls.add(others);
    if (signOutOnce.isNotEmpty) return signOutOnce.removeAt(0)(others);
    return onSignOut(others);
  }

  @override
  Future<void> stopAutoRefresh() async => stopAutoRefreshCalls++;
}

AuthSessionView view(String id, {String? userId}) =>
    AuthSessionView(accessToken: 'access-$id', refreshToken: 'refresh-$id', userId: userId);

/// Lets queued microtasks and zero-delay timers run.
Future<void> flush([int rounds = 20]) async {
  for (var i = 0; i < rounds; i++) {
    await Future<void>.delayed(Duration.zero);
  }
}

/// `vi.waitFor`: polls [condition] until it holds or [timeout] passes.
Future<void> waitFor(bool Function() condition, {Duration timeout = const Duration(seconds: 2)}) async {
  final deadline = DateTime.now().add(timeout);
  while (!condition()) {
    if (DateTime.now().isAfter(deadline)) throw StateError('waitFor timed out');
    await Future<void>.delayed(const Duration(milliseconds: 1));
  }
}
