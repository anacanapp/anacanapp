// Ported from: src/components/AIChatScreen.tsx (sendMessage: the dr-anacan-chat streaming fetch, SSE parsing,
//              Stop / AbortController, AI_STREAM_IDLE_TIMEOUT_MS), src/lib/network-timeout.ts (fetchStreaming)
//
// POST {backend}/functions/v1/dr-anacan-chat with the user's session JWT (`Authorization: Bearer`), the
// publishable key (`apikey`) and `Content-Type: application/json`. The response is read progressively:
// `data: {json}` lines, `choices[0].delta.content` appended, `[DONE]` and blank lines skipped, unparseable chunks
// ignored, the trailing buffer parsed at the end. The time to the headers is bounded (30 s, RequestTimeoutException)
// and so is every silence between chunks (30 s → [AiStreamIdleTimeout]); Stop aborts the request.
import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../core/i18n/tr.dart';
import '../../core/net/network_timeout.dart';

/// Incremental SSE parser (`buffer.split('\n')`, incomplete last line kept).
class SseDeltaParser {
  String _buffer = '';

  static String? _delta(String line) {
    if (!line.startsWith('data: ')) return null;
    final data = line.substring(6).trim();
    if (data == '[DONE]' || data.isEmpty) return null;
    try {
      final parsed = jsonDecode(data);
      if (parsed is! Map) return null;
      final choices = parsed['choices'];
      if (choices is! List || choices.isEmpty) return null;
      final first = choices.first;
      if (first is! Map) return null;
      final delta = first['delta'];
      if (delta is! Map) return null;
      final content = delta['content'];
      return content is String && content.isNotEmpty ? content : null;
    } catch (_) {
      // skipped unparseable SSE chunk
      return null;
    }
  }

  /// Adds decoded text; returns the content deltas of the complete lines.
  List<String> push(String text) {
    _buffer += text;
    final lines = _buffer.split('\n');
    _buffer = lines.removeLast();
    return [for (final line in lines) ?_delta(line)];
  }

  /// The deltas of whatever is left after the stream ended.
  List<String> finish() {
    final rest = _buffer;
    _buffer = '';
    if (rest.trim().isEmpty) return const [];
    return [for (final line in rest.split('\n')) ?_delta(line)];
  }
}

/// The server answered with a non-2xx status (`errorData.error || 'API xətası'`).
class AiChatApiError implements Exception {
  const AiChatApiError(this.message, this.status);
  final String message;
  final int status;
  @override
  String toString() => message;
}

/// No session token (`Sessiya tapılmadı. Yenidən daxil olun.`).
class AiChatNoSession implements Exception {
  const AiChatNoSession();
  @override
  String toString() => tr('aichatscreen_sessiya_tapilmadi_yeniden_daxi_455503', 'Sessiya tapılmadı. Yenidən daxil olun.');
}

/// A silent stream was stopped (`streamTimedOut`).
class AiStreamIdleTimeout implements Exception {
  const AiStreamIdleTimeout();
}

/// The user pressed Stop (`AbortError`).
class AiStreamAborted implements Exception {
  const AiStreamAborted();
}

/// `AbortController`.
class AiAbortController {
  final Completer<void> _c = Completer<void>();
  bool get aborted => _c.isCompleted;
  Future<void> get signal => _c.future;
  void abort() {
    if (!_c.isCompleted) _c.complete();
  }
}

/// The request of one question.
class AiStreamRequest {
  const AiStreamRequest({required this.backendUrl, required this.publishableKey, required this.accessToken, required this.body});
  final String backendUrl;
  final String publishableKey;
  final String accessToken;
  final Map<String, Object?> body;

  Uri get uri => Uri.parse('$backendUrl/functions/v1/dr-anacan-chat');

  Map<String, String> get headers => {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $accessToken',
        'apikey': publishableKey,
      };
}

/// Streams one answer. [onContent] receives the full text so far after every delta. Returns the full content.
/// Throws [AiStreamAborted] (Stop), [AiStreamIdleTimeout] (silent stream), [RequestTimeoutException] (no headers
/// in time), [AiChatApiError] (non-2xx) or a network error.
Future<String> streamDrAnacanChat(
  http.Client client,
  AiStreamRequest request, {
  required AiAbortController abort,
  required void Function(String fullContent) onContent,
  Duration connectTimeout = aiStreamConnectTimeout,
  Duration idleTimeout = aiStreamIdleTimeout,
  TimerFactory timerFactory = Timer.new,
}) async {
  var idleFired = false;
  final idle = AiAbortController();
  final trigger = Future.any([abort.signal, idle.signal]);
  final http.Request req = http.AbortableRequest('POST', request.uri, abortTrigger: trigger)
    ..headers.addAll(request.headers)
    ..body = jsonEncode(request.body);

  http.StreamedResponse response;
  try {
    response = await sendStreaming(client, req, connectTimeout: connectTimeout, timerFactory: timerFactory);
  } on http.RequestAbortedException {
    throw const AiStreamAborted();
  }

  if (response.statusCode < 200 || response.statusCode >= 300) {
    String message = tr('aichatscreen_api_xetasi_1b7c03', 'API xətası');
    try {
      final data = jsonDecode(await response.stream.bytesToString());
      if (data is Map && data['error'] is String && (data['error'] as String).isNotEmpty) message = data['error'] as String;
    } catch (_) {}
    throw AiChatApiError(message, response.statusCode);
  }

  final parser = SseDeltaParser();
  final decoder = const Utf8Decoder(allowMalformed: true);
  final chunks = StringBuffer();
  final sink = decoder.startChunkedConversion(_StringSink(chunks));
  var full = '';
  final done = Completer<void>();
  Timer? idleTimer;
  void clearIdle() {
    idleTimer?.cancel();
    idleTimer = null;
  }

  void fail(Object error) {
    clearIdle();
    if (!done.isCompleted) done.completeError(error);
  }

  void arm() {
    clearIdle();
    idleTimer = timerFactory(idleTimeout, () {
      idleFired = true;
      idle.abort();
      fail(const AiStreamIdleTimeout());
    });
  }

  unawaited(abort.signal.then((_) => fail(const AiStreamAborted())));

  void take(List<String> deltas) {
    for (final d in deltas) {
      full += d;
    }
    if (deltas.isNotEmpty) onContent(full);
  }

  arm();
  final sub = response.stream.listen(
    (bytes) {
      if (done.isCompleted) return;
      arm();
      sink.add(bytes);
      final text = chunks.toString();
      chunks.clear();
      take(parser.push(text));
    },
    onError: (Object error) {
      if (abort.aborted) return fail(const AiStreamAborted());
      if (idleFired) return fail(const AiStreamIdleTimeout());
      fail(error is http.RequestAbortedException ? const AiStreamAborted() : error);
    },
    onDone: () {
      if (done.isCompleted) return;
      clearIdle();
      sink.close();
      final rest = chunks.toString();
      chunks.clear();
      final deltas = [...parser.push(rest), ...parser.finish()];
      // Trailing deltas are added without a separate flush (React: `fullContent += content`).
      for (final d in deltas) {
        full += d;
      }
      done.complete();
    },
    cancelOnError: true,
  );
  try {
    await done.future;
  } finally {
    clearIdle();
    unawaited(sub.cancel());
  }
  return full;
}

class _StringSink implements Sink<String> {
  _StringSink(this.buffer);
  final StringBuffer buffer;
  @override
  void add(String data) => buffer.write(data);
  @override
  void close() {}
}
