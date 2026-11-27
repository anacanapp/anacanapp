// Ported from: src/lib/network-timeout.test.ts

import 'dart:async';
import 'dart:convert';

import 'package:anacan/core/net/network_timeout.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart'
    show AuthApiException, AuthRetryableFetchException, GoTrueClient;

import 'support.dart';

const api = 'https://api.example.invalid';

http.StreamedResponse json(Object? body, int status) =>
    textResponse(jsonEncode(body), status, headers: const {'content-type': 'application/json'});
http.StreamedResponse html(int status) =>
    textResponse('<html>Hotel Wi-Fi login</html>', status, headers: const {'content-type': 'text/html'});

/// e.g. a transport ignoring the abort.
FakeHttpClient hanging() => FakeHttpClient((_) => Completer<http.StreamedResponse>().future);

/// Manual timers (`vi.useFakeTimers`).
class FakeTimers {
  final List<_FakeTimer> _timers = [];
  Duration _now = Duration.zero;

  Timer call(Duration duration, void Function() callback) {
    final timer = _FakeTimer(_now + duration, callback);
    _timers.add(timer);
    return timer;
  }

  int get active => _timers.where((t) => t.isActive).length;

  Future<void> elapse(Duration duration) async {
    _now += duration;
    for (final timer in _timers.where((t) => t.isActive && t.due <= _now).toList()) {
      timer.fire();
    }
    await flush();
  }
}

class _FakeTimer implements Timer {
  _FakeTimer(this.due, this.callback);
  final Duration due;
  final void Function() callback;
  bool _active = true;

  void fire() {
    _active = false;
    callback();
  }

  @override
  void cancel() => _active = false;

  @override
  bool get isActive => _active;

  @override
  int get tick => 0;
}

http.Request request(String method, String url) => http.Request(method, Uri.parse(url));

void main() {
  tearDown(() => setRequestTimeoutMessage(() => 'Bağlantı zəifdir. Yenidən cəhd edin.'));

  group('timeoutForRequest', () {
    test('bounds every SDK surface, with longer limits only for uploads and AI generation', () {
      expect(timeoutForRequest('$api/rest/v1/baby_logs?select=*', 'POST'), restTimeout);
      expect(timeoutForRequest('$api/rest/v1/rpc/shop_storefront_v1', 'POST'), restTimeout);
      expect(timeoutForRequest('$api/auth/v1/token?grant_type=refresh_token', 'POST'), authTimeout);
      expect(timeoutForRequest('$api/functions/v1/promo-redeem', 'POST'), functionTimeout);
      expect(timeoutForRequest('$api/functions/v1/analyze-cry', 'POST'), slowFunctionTimeout);
      expect(timeoutForRequest('$api/storage/v1/object/avatars/a.jpg', 'POST'), storageUploadTimeout);
      for (final limit in [restTimeout, authTimeout, functionTimeout]) {
        expect(limit, greaterThanOrEqualTo(const Duration(seconds: 15)));
        expect(limit, lessThanOrEqualTo(const Duration(seconds: 20)));
      }
      // The per-class limits named in docs/STABILITY_PHASE2.md (#13).
      expect([restTimeout, authTimeout, slowFunctionTimeout, storageUploadTimeout].map((d) => d.inSeconds),
          [20, 15, 90, 120]);
    });
  });

  group('fetchWithTimeout', () {
    test('rejects a hanging mutation with a clear, localized timeout error', () async {
      final timers = FakeTimers();
      setRequestTimeoutMessage(() => 'Slow connection. Try again.');
      final pending = sendWithTimeout(hanging(), request('PATCH', '$api/rest/v1/profiles'),
          const Duration(seconds: 20), timerFactory: timers.call);
      final assertion = expectLater(
          pending,
          throwsA(isA<RequestTimeoutException>()
              .having((e) => e.name, 'name', 'TimeoutError')
              .having((e) => e.code, 'code', 'REQUEST_TIMEOUT')
              .having((e) => e.message, 'message', 'Slow connection. Try again.')));
      await timers.elapse(const Duration(seconds: 20));
      await assertion;
    });

    test('aborts the underlying request on timeout', () async {
      final timers = FakeTimers();
      final impl = hanging();
      final pending = sendWithTimeout(impl, request('GET', '$api/rest/v1/x'), const Duration(seconds: 1),
          timerFactory: timers.call);
      unawaited(pending.then((_) {}, onError: (_) {}));
      await flush();
      var aborted = false;
      unawaited((impl.calls.single as http.Abortable).abortTrigger!.then((_) => aborted = true));
      await timers.elapse(const Duration(seconds: 1));
      expect(aborted, isTrue);
      await expectLater(pending, throwsA(isA<RequestTimeoutException>()));
    });

    test('honours the caller AbortSignal even when the transport ignores it (Stop button)', () async {
      final controller = Completer<void>();
      final pending = sendWithTimeout(
          hanging(),
          http.AbortableRequest('POST', Uri.parse('$api/functions/v1/dr-anacan-chat'), abortTrigger: controller.future),
          const Duration(seconds: 30));
      controller.complete();
      await expectLater(pending, throwsA(isA<http.RequestAbortedException>()));
      final already = Future<void>.value();
      await expectLater(
          sendWithTimeout(hanging(), http.AbortableRequest('GET', Uri.parse('$api/x'), abortTrigger: already),
              const Duration(seconds: 1)),
          throwsA(isA<http.RequestAbortedException>()));
    });

    test('keeps forwarding the caller abort after the headers so a stream body read stops too', () async {
      final impl = FakeHttpClient((_) async => textResponse('data: x\n\n', 200));
      final controller = Completer<void>();
      await sendWithTimeout(impl, http.AbortableRequest('GET', Uri.parse('$api/x'), abortTrigger: controller.future),
          const Duration(seconds: 1));
      var aborted = false;
      unawaited((impl.calls.single as http.Abortable).abortTrigger!.then((_) => aborted = true));
      await flush();
      expect(aborted, isFalse);
      controller.complete();
      await flush();
      expect(aborted, isTrue);
    });

    test('passes a fast response through and clears its timer', () async {
      final timers = FakeTimers();
      final response = await sendWithTimeout(FakeHttpClient((_) async => json({'ok': true}, 200)),
          request('GET', '$api/x'), const Duration(seconds: 1), timerFactory: timers.call);
      expect(response.statusCode, 200);
      expect(timers.active, 0);
    });
  });

  group('refresh failure classification', () {
    test('recognises the refresh endpoint only', () {
      expect(isRefreshTokenRequest('$api/auth/v1/token?grant_type=refresh_token'), isTrue);
      expect(isRefreshTokenRequest('$api/auth/v1/token?grant_type=password'), isFalse);
      expect(isRefreshTokenRequest('$api/rest/v1/token?grant_type=refresh_token'), isFalse);
    });

    Future<RefreshFailure> classify(http.StreamedResponse response) async =>
        classifyRefreshFailure(response.statusCode, response.headers, await response.stream.toBytes());

    for (final (index, (expected, response)) in <(RefreshFailure, http.StreamedResponse Function())>[
      (RefreshFailure.invalid, () => json({'code': 'refresh_token_not_found', 'message': 'Invalid Refresh Token'}, 400)),
      (RefreshFailure.invalid, () => json({'error': 'invalid_grant', 'error_description': 'Refresh Token Not Found'}, 400)),
      (RefreshFailure.invalid, () => json({'code': 'session_not_found', 'message': 'Session not found'}, 403)),
      (RefreshFailure.transient, () => html(200)), (RefreshFailure.transient, () => html(302)),
      (RefreshFailure.transient, () => html(401)), (RefreshFailure.transient, () => html(403)),
      (RefreshFailure.transient, () => json({'message': 'rate limited'}, 429)),
      (RefreshFailure.transient, () => json({'message': 'db down'}, 500)),
      (RefreshFailure.transient, () => json({'message': 'gateway'}, 502)),
      (RefreshFailure.transient, () => textResponse('', 408)),
      (RefreshFailure.transient, () => textResponse('{"code":', 400, headers: const {'content-type': 'application/json'})),
    ].indexed) {
      test('classifies ${expected.name} for a refresh answer (#$index)', () async {
        expect(await classify(response()), expected);
      });
    }

    test('turns a non-Auth refresh failure into a network error and passes real rejections through', () async {
      final base = FakeHttpClient();
      final sdk = AnacanHttpClient(inner: base);
      final url = Uri.parse('$api/auth/v1/token?grant_type=refresh_token');
      base.handler = (_) async => html(403);
      await expectLater(sdk.post(url), throwsA(isA<http.ClientException>()));
      base.handler = (_) async => json({'code': 'refresh_token_not_found'}, 400);
      expect((await sdk.post(url)).statusCode, 400);
      // Other endpoints keep their answers untouched.
      base.handler = (_) async => html(403);
      expect((await sdk.get(Uri.parse('$api/rest/v1/profiles'))).statusCode, 403);
    });
  });

  group('real Auth SDK refresh with the app fetch', () {
    String b64(Object value) => base64Url.encode(utf8.encode(jsonEncode(value))).replaceAll('=', '');
    String expired() {
      final exp = DateTime.now().millisecondsSinceEpoch ~/ 1000 - 3600;
      final jwt = '${b64({'alg': 'HS256', 'typ': 'JWT'})}.${b64({'exp': exp, 'sub': 'u'})}.sig';
      return jsonEncode({
        'access_token': jwt, 'refresh_token': 'stored-refresh', 'token_type': 'bearer',
        'expires_in': 3600, 'expires_at': exp,
        'user': {'id': '00000000-0000-4000-8000-000000000011', 'aud': 'authenticated', 'app_metadata': {},
          'user_metadata': {}, 'created_at': DateTime.fromMillisecondsSinceEpoch(0).toIso8601String()},
      });
    }

    Future<(GoTrueClient, FakeHttpClient)> sdk(http.StreamedResponse Function() answer) async {
      final base = FakeHttpClient((_) async => answer());
      final client = GoTrueClient(url: '$api/auth/v1', httpClient: AnacanHttpClient(inner: base), autoRefreshToken: false);
      client.onAuthStateChange.listen((_) {}, onError: (_) {});
      await client.setInitialSession(expired());
      return (client, base);
    }

    test('signs out on a real invalid refresh token', () async {
      final (client, _) =
          await sdk(() => json({'code': 'refresh_token_not_found', 'message': 'Invalid Refresh Token'}, 400));
      await expectLater(client.getSession(), throwsA(isA<AuthApiException>()));
      expect(client.currentSession, isNull);
    });

    test('keeps the stored session when the refresh hits a captive portal page', () async {
      final (client, base) = await sdk(() => html(403));
      await expectLater(client.getSession(), throwsA(isA<AuthRetryableFetchException>())); // not usable right now…
      expect(client.currentSession, isNotNull); // …but kept for the offline open and a later refresh
      expect(base.calls.length, greaterThan(1)); // retried as a network failure
    }, timeout: const Timeout(Duration(seconds: 30)));
  });

  group('streaming fetch', () {
    test('prefers the WebView fetch saved by Capacitor before its native HTTP patch', () {},
        skip: 'No CapacitorHttp patch in Flutter: the Dart http client streams natively');

    test('uses the normal fetch on the web', () async {
      final web = FakeHttpClient((_) async => textResponse('web', 200));
      final response = await sendStreaming(web, request('POST', '$api/functions/v1/dr-anacan-chat'));
      expect(await response.stream.bytesToString(), 'web');
      expect(web.calls, hasLength(1));
    });
  });
}
