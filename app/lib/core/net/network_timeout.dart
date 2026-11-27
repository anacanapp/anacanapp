// Ported from: src/lib/network-timeout.ts
//
// Request timeouts and failure classification for the Supabase SDK and edge calls.
//
// - Every SDK request (REST, RPC, Auth, Functions, Storage) gets a bounded wait, so a
//   save on a weak network ends with a clear, retryable error instead of hanging.
// - The deadline covers the time to the response headers; the body is the caller's to
//   read. On the deadline the underlying request is aborted (http `Abortable`).
// - A refresh-token answer that is not a real Auth rejection (captive portal page, proxy
//   error, 5xx, 408/429, non-JSON) is reported to the SDK as a network failure. gotrue
//   then raises AuthRetryableFetchException and keeps the stored session instead of
//   signing the user out.
// - React's `webViewFetch` (CapacitorHttp bypass for streaming) has no Flutter
//   counterpart: the Dart http client streams natively. [sendStreaming] keeps the
//   streaming connect deadline.

import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:http/http.dart' as http;

const Duration authTimeout = Duration(milliseconds: 15000);
const Duration restTimeout = Duration(milliseconds: 20000);
const Duration functionTimeout = Duration(milliseconds: 20000);

/// AI/generation functions answer only after a model call; a 20 s cap would fail healthy requests.
const Duration slowFunctionTimeout = Duration(milliseconds: 90000);
const Duration storageDownloadTimeout = Duration(milliseconds: 60000);
const Duration storageUploadTimeout = Duration(milliseconds: 120000);

/// AI chat: time to the first response headers, and the longest silence between stream chunks.
const Duration aiStreamConnectTimeout = Duration(milliseconds: 30000);
const Duration aiStreamIdleTimeout = Duration(milliseconds: 30000);

const Set<String> slowFunctions = {
  'dr-anacan-chat', 'generate-fairy-tale', 'generate-baby-photo', 'generate-blog-content',
  'analyze-poop', 'analyze-cry', 'analyze-horoscope', 'baby-insight', 'baby-chat-reply',
  'safety-ai-lookup', 'name-ai-lookup', 'food-calories', 'translate-content', 'translate-post',
  'send-bulk-push', 'admin-notification-dispatch', 'book-download',
};

String Function() _timeoutMessage = () => 'Bağlantı zəifdir. Yenidən cəhd edin.';

/// Localized text for timeouts (registered by the app shell, which may import i18n).
void setRequestTimeoutMessage(String Function() provider) => _timeoutMessage = provider;

/// Deadline reached. Extends [http.ClientException] so every SDK treats it as a
/// network failure (gotrue: AuthRetryableFetchException).
class RequestTimeoutException extends http.ClientException {
  RequestTimeoutException(this.timeout, [Uri? uri]) : super(_message(), uri);

  final Duration timeout;
  String get name => 'TimeoutError';
  String get code => 'REQUEST_TIMEOUT';

  static String _message() {
    try {
      final text = _timeoutMessage();
      if (text.isNotEmpty) return text;
    } catch (_) {
      // keep default
    }
    return 'Request timed out';
  }
}

bool isRequestTimeoutError(Object? error) => error is RequestTimeoutException;

/// The caller aborted (http's own [http.RequestAbortedException]).
bool isAbortError(Object? error) => error is http.RequestAbortedException;

final RegExp _functionPath = RegExp(r'/functions/v1/([^/?#]+)');

/// Timeout for one SDK request, by API surface.
Duration timeoutForRequest(String url, [String method = 'GET']) {
  var path = url;
  try {
    path = Uri.parse('https://local.invalid').resolve(url).path;
  } catch (_) {
    // use raw
  }
  final fn = _functionPath.firstMatch(path);
  if (fn != null) return slowFunctions.contains(fn.group(1)) ? slowFunctionTimeout : functionTimeout;
  if (path.contains('/storage/v1/')) {
    final upper = method.toUpperCase();
    return upper == 'GET' || upper == 'HEAD' ? storageDownloadTimeout : storageUploadTimeout;
  }
  if (path.contains('/auth/v1/')) return authTimeout;
  return restTimeout;
}

final RegExp _refreshPath = RegExp(r'/auth/v1/token(?:\?|$)');
final RegExp _refreshGrant = RegExp(r'[?&]grant_type=refresh_token(?:&|$)');

bool isRefreshTokenRequest(String url) => _refreshPath.hasMatch(url) && _refreshGrant.hasMatch(url);

/// 'invalid': the Auth server really rejected the refresh token (JSON 400/401/403/404/422
/// with an Auth error body) and signing out is correct.
/// 'transient': anything else that is not a success; the session must be kept.
enum RefreshFailure { invalid, transient }

RefreshFailure classifyRefreshFailure(int status, Map<String, String> headers, List<int> body) {
  if (!const [400, 401, 403, 404, 422].contains(status)) return RefreshFailure.transient;
  final contentType = (_header(headers, 'content-type') ?? '').toLowerCase();
  if (!contentType.contains('application/json')) return RefreshFailure.transient;
  try {
    final decoded = jsonDecode(utf8.decode(body));
    if (decoded is! Map) return RefreshFailure.transient;
    return const ['code', 'error_code', 'error', 'msg', 'error_description'].any((key) => decoded[key] is String)
        ? RefreshFailure.invalid
        : RefreshFailure.transient;
  } catch (_) {
    return RefreshFailure.transient;
  }
}

String? _header(Map<String, String> headers, String name) {
  for (final entry in headers.entries) {
    if (entry.key.toLowerCase() == name) return entry.value;
  }
  return null;
}

/// Timer factory, replaceable in tests.
typedef TimerFactory = Timer Function(Duration duration, void Function() callback);

/// Sends [request] through [inner] with a header deadline and the caller's own abort
/// trigger (when [request] is [http.Abortable]). Rejects with [RequestTimeoutException]
/// on the deadline and with [http.RequestAbortedException] when the caller aborts,
/// even when the transport ignores the abort. The caller's abort keeps reaching the
/// request after the headers (stream body reads); only the header deadline ends here.
Future<http.StreamedResponse> sendWithTimeout(
  http.Client inner,
  http.BaseRequest request,
  Duration timeout, {
  TimerFactory timerFactory = Timer.new,
}) {
  final callerAbort = request is http.Abortable ? (request as http.Abortable).abortTrigger : null;
  final abort = Completer<void>();
  final result = Completer<http.StreamedResponse>();
  var callerAborted = false;

  void fail(Object error) {
    if (!result.isCompleted) result.completeError(error);
    if (!abort.isCompleted) abort.complete();
  }

  callerAbort?.whenComplete(() {
    callerAborted = true;
    fail(http.RequestAbortedException(request.url));
  });

  final timer = timerFactory(timeout, () => fail(RequestTimeoutException(timeout, request.url)));

  http.BaseRequest outgoing;
  try {
    outgoing = _abortable(request, abort.future);
  } catch (error) {
    timer.cancel();
    return Future.error(error);
  }
  Future<http.StreamedResponse>.sync(() => inner.send(outgoing)).then((response) {
    timer.cancel();
    if (!result.isCompleted) {
      result.complete(response);
    } else {
      // A late result after the race is settled must not leak a connection.
      unawaited(response.stream.drain<void>().catchError((_) {}));
    }
  }, onError: (Object error, StackTrace stack) {
    timer.cancel();
    if (!result.isCompleted) result.completeError(callerAborted ? http.RequestAbortedException(request.url) : error, stack);
  });
  return result.future;
}

/// Copy [request] into an abortable request driven by [trigger].
http.BaseRequest _abortable(http.BaseRequest request, Future<void> trigger) {
  final copy = http.AbortableStreamedRequest(request.method, request.url, abortTrigger: trigger)
    ..headers.addAll(request.headers)
    ..followRedirects = request.followRedirects
    ..maxRedirects = request.maxRedirects
    ..persistentConnection = request.persistentConnection
    ..contentLength = request.contentLength;
  request.finalize().listen(copy.sink.add, onError: copy.sink.addError, onDone: copy.sink.close, cancelOnError: true);
  return copy;
}

/// SDK http client: per-surface timeout plus refresh-failure classification.
/// Pass it as `httpClient` to `Supabase.initialize`.
class AnacanHttpClient extends http.BaseClient {
  AnacanHttpClient({http.Client? inner, this.timerFactory = Timer.new}) : inner = inner ?? http.Client();

  final http.Client inner;
  final TimerFactory timerFactory;

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    final url = request.url.toString();
    final response = await sendWithTimeout(inner, request, timeoutForRequest(url, request.method),
        timerFactory: timerFactory);
    final ok = response.statusCode >= 200 && response.statusCode < 300;
    if (ok || !isRefreshTokenRequest(url)) return response;
    final Uint8List body;
    try {
      body = await response.stream.toBytes();
    } catch (_) {
      throw http.ClientException('Auth refresh temporarily unavailable (${response.statusCode})', request.url);
    }
    if (classifyRefreshFailure(response.statusCode, response.headers, body) == RefreshFailure.transient) {
      // gotrue maps a thrown client error to AuthRetryableFetchException and keeps the session.
      throw http.ClientException('Auth refresh temporarily unavailable (${response.statusCode})', request.url);
    }
    return http.StreamedResponse(
      Stream.value(body),
      response.statusCode,
      contentLength: body.length,
      request: response.request,
      headers: response.headers,
      isRedirect: response.isRedirect,
      persistentConnection: response.persistentConnection,
      reasonPhrase: response.reasonPhrase,
    );
  }

  @override
  void close() => inner.close();
}

/// Streaming request (AI chat) with a connect deadline; abort through an
/// [http.Abortable] request.
Future<http.StreamedResponse> sendStreaming(
  http.Client client,
  http.BaseRequest request, {
  Duration connectTimeout = aiStreamConnectTimeout,
  TimerFactory timerFactory = Timer.new,
}) =>
    sendWithTimeout(client, request, connectTimeout, timerFactory: timerFactory);
