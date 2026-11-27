// Ported from: (no React test) — the dr-anacan-chat streaming of src/components/AIChatScreen.tsx (request,
//              SSE parsing, Stop, idle and connect timeouts, API errors).
import 'dart:async';
import 'dart:convert';

import 'package:anacan/core/net/network_timeout.dart';
import 'package:anacan/features/ai_chat/ai_chat_stream.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support.dart';

AiStreamRequest _req() => const AiStreamRequest(
      backendUrl: 'https://api.anacan.az',
      publishableKey: 'pk-1',
      accessToken: 'jwt-1',
      body: {'messages': [{'role': 'user', 'content': 'Salam'}], 'stream': true},
    );

void main() {
  group('SseDeltaParser', () {
    test('appends delta content of complete data lines and keeps the incomplete one', () {
      final p = SseDeltaParser();
      expect(p.push('data: {"choices":[{"delta":{"content":"Sa'), isEmpty);
      expect(p.push('lam"}}]}\ndata: [DONE]\n\n: ping\n'), ['Salam']);
      expect(p.push('data: not json\ndata: {"choices":[{"delta":{}}]}\ndata: {"choices":[{"delta":{"content":" ana"}}]}'), isEmpty);
      expect(p.finish(), [' ana']);
    });

    test('CRLF lines and empty data are tolerated', () {
      final p = SseDeltaParser();
      expect(p.push('data: {"choices":[{"delta":{"content":"a"}}]}\r\ndata: \r\n'), ['a']);
    });
  });

  group('streamDrAnacanChat', () {
    test('POSTs the body with the session JWT, the publishable key and JSON content type; streams deltas', () async {
      final client = ScriptedClient();
      final seen = <String>[];
      client.onCall = (call) {
        call.open();
        call.add(sse('Sa'));
        call.add(sse('lam'));
        // A multi-byte character split across two chunks.
        final bytes = utf8.encode(sse(' ə'));
        call.addBytes(bytes.sublist(0, bytes.length - 4));
        call.addBytes(bytes.sublist(bytes.length - 4));
        call.add('data: [DONE]\n');
        unawaited(call.close());
      };
      final full = await streamDrAnacanChat(client, _req(), abort: AiAbortController(), onContent: seen.add);
      expect(full, 'Salam ə');
      expect(seen, ['Sa', 'Salam', 'Salam ə']);
      final call = client.calls.single;
      expect(call.request.method, 'POST');
      expect(call.request.url.toString(), 'https://api.anacan.az/functions/v1/dr-anacan-chat');
      expect(call.request.headers['Authorization'], 'Bearer jwt-1');
      expect(call.request.headers['apikey'], 'pk-1');
      expect(call.request.headers['Content-Type'], startsWith('application/json'));
      expect(call.json['stream'], true);
    });

    test('the trailing buffer without a newline is parsed at the end', () async {
      final client = ScriptedClient()
        ..onCall = (call) {
          call.open();
          call.add('data: {"choices":[{"delta":{"content":"son"}}]}');
          unawaited(call.close());
        };
      expect(await streamDrAnacanChat(client, _req(), abort: AiAbortController(), onContent: (_) {}), 'son');
    });

    test('a non-2xx answer throws with the server error text', () async {
      final client = ScriptedClient()
        ..onCall = (call) {
          call.open(status: 429);
          call.add('{"error":"Rate limited"}');
          unawaited(call.close());
        };
      await expectLater(
        streamDrAnacanChat(client, _req(), abort: AiAbortController(), onContent: (_) {}),
        throwsA(isA<AiChatApiError>().having((e) => e.message, 'message', 'Rate limited').having((e) => e.status, 'status', 429)),
      );
    });

    test('Stop aborts the request mid-stream', () async {
      final client = ScriptedClient();
      final abort = AiAbortController();
      client.onCall = (call) {
        call.open();
        call.add(sse('Yarım'));
      };
      final seen = <String>[];
      final future = streamDrAnacanChat(client, _req(), abort: abort, onContent: (c) {
        seen.add(c);
        abort.abort();
      });
      await expectLater(future, throwsA(isA<AiStreamAborted>()));
      expect(seen, ['Yarım']);
      expect(client.calls.single.aborted, isTrue);
    });

    test('Stop before the headers rejects as aborted', () async {
      final client = ScriptedClient();
      final abort = AiAbortController();
      client.onCall = (_) => abort.abort();
      await expectLater(streamDrAnacanChat(client, _req(), abort: abort, onContent: (_) {}), throwsA(isA<AiStreamAborted>()));
    });

    test('a silent stream is stopped after the idle timeout', () async {
      final client = ScriptedClient()
        ..onCall = (call) {
          call.open();
          call.add(sse('a'));
        };
      await expectLater(
        streamDrAnacanChat(client, _req(), abort: AiAbortController(), onContent: (_) {}, idleTimeout: const Duration(milliseconds: 30)),
        throwsA(isA<AiStreamIdleTimeout>()),
      );
      await Future<void>.delayed(const Duration(milliseconds: 5));
      expect(client.calls.single.aborted, isTrue);
    });

    test('no headers in time is a request timeout', () async {
      final client = ScriptedClient();
      await expectLater(
        streamDrAnacanChat(client, _req(), abort: AiAbortController(), onContent: (_) {}, connectTimeout: const Duration(milliseconds: 30)),
        throwsA(isA<RequestTimeoutException>()),
      );
    });
  });
}
